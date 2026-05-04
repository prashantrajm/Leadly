// System tools (design §4.3). v1 ships four:
//
//   capture_contact          create/update Lead + link Visitor
//   request_handoff          flip conversation.mode = paused, signal observers
//   set_conversation_summary write summary/sentiment/tags (post-end deterministic call)
//   end_conversation         close the conversation, fire summarization workflow
//
// The `Tool` table's row-per-agent representation is for v2 customer-defined
// tools. v1 only emits scope=system, so we declare them in code instead of
// reading from the table — this gives us compile-time type safety on tool
// arguments and stops customers from accidentally disabling capture_contact
// from the dashboard before v2 ships.
//
// Each tool exposes:
//   • spec      — name + description + Zod input schema, used by streamText
//                 to register the tool with the LLM.
//   • execute   — a side-effect function the DO calls *after* the LLM emits
//                 a tool call. Pure-ish: takes { conversationId, args, prisma },
//                 mutates DB rows, returns a JSON-serializable result.
//
// Splitting spec from execute keeps the AI SDK's typed-tool plumbing happy
// (it owns the execute fn) while the DO stays in control of how/when each
// tool's side effects propagate to the WS observers.

import { tool } from "ai";
import { z } from "zod";
import type { ExtendedPrismaClient } from "../lib/prisma";

// ---------- shared executor context ----------

export type ToolExecCtx = {
	conversationId: string;
	agentId: string;
	organizationId: string;
	visitorId: string;
	prisma: ExtendedPrismaClient;
};

export type ToolExecResult = {
	ok: boolean;
	[key: string]: unknown;
};

// ---------- capture_contact ----------

export const CaptureContactInput = z
	.object({
		email: z.string().email().optional(),
		phone: z.string().min(5).max(40).optional(),
		name: z.string().min(1).max(120).optional(),
	})
	.refine((d) => Boolean(d.email || d.phone), {
		message: "At least one of email or phone is required",
	});

export type CaptureContactArgs = z.infer<typeof CaptureContactInput>;

export const captureContactSpec = tool({
	description:
		"Record the visitor's contact info. Call this as soon as you have at least an email or a phone number, optionally with their name. Idempotent — call again to update.",
	inputSchema: CaptureContactInput,
});

export async function executeCaptureContact(
	ctx: ToolExecCtx,
	args: CaptureContactArgs,
): Promise<ToolExecResult> {
	const { prisma, agentId, organizationId, visitorId, conversationId } = ctx;

	// Find an existing lead by email (preferred) or phone, scoped to this
	// agent. The partial-unique indexes on lead make these direct lookups.
	const matchByEmail = args.email
		? await prisma.lead.findFirst({ where: { agentId, email: args.email } })
		: null;
	const matchByPhone =
		!matchByEmail && args.phone
			? await prisma.lead.findFirst({ where: { agentId, phone: args.phone } })
			: null;
	const existing = matchByEmail ?? matchByPhone;

	const lead = existing
		? await prisma.lead.update({
				where: { id: existing.id },
				data: {
					email: args.email ?? existing.email,
					phone: args.phone ?? existing.phone,
					name: args.name ?? existing.name,
				},
			})
		: await prisma.lead.create({
				data: {
					organizationId,
					agentId,
					email: args.email ?? null,
					phone: args.phone ?? null,
					name: args.name ?? null,
				},
			});

	// Link visitor + conversation to the lead, in parallel.
	await Promise.all([
		prisma.visitor.update({
			where: { id: visitorId },
			data: { leadId: lead.id },
		}),
		prisma.conversation.update({
			where: { id: conversationId },
			data: { leadId: lead.id },
		}),
	]);

	return { ok: true, leadId: lead.id, created: !existing };
}

// ---------- request_handoff ----------

export const RequestHandoffInput = z.object({
	reason: z.string().min(2).max(500),
	urgency: z.enum(["low", "normal", "high"]).default("normal"),
});

export type RequestHandoffArgs = z.infer<typeof RequestHandoffInput>;

export const requestHandoffSpec = tool({
	description:
		"Pause the agent and request a human takeover. Call when the visitor explicitly asks for a human, when you cannot help, or when the issue is sensitive (refunds, complaints, escalations).",
	inputSchema: RequestHandoffInput,
});

export async function executeRequestHandoff(
	ctx: ToolExecCtx,
	args: RequestHandoffArgs,
): Promise<ToolExecResult> {
	await ctx.prisma.conversation.update({
		where: { id: ctx.conversationId },
		data: { mode: "paused" },
	});
	// Broadcasting the mode_change frame to observers is the DO's job; this
	// executor only writes the durable state.
	return { ok: true, reason: args.reason, urgency: args.urgency };
}

// ---------- set_conversation_summary ----------

export const SetConversationSummaryInput = z.object({
	summary: z.string().min(2).max(2000),
	sentiment: z.enum(["positive", "neutral", "negative", "mixed"]).optional(),
	tags: z.array(z.string().min(1).max(40)).max(10).optional(),
});

export type SetConversationSummaryArgs = z.infer<
	typeof SetConversationSummaryInput
>;

export const setConversationSummarySpec = tool({
	description:
		"Persist a one-paragraph summary, an overall sentiment, and short tags. Called deterministically by the system after end_conversation; do not call this yourself.",
	inputSchema: SetConversationSummaryInput,
});

export async function executeSetConversationSummary(
	ctx: ToolExecCtx,
	args: SetConversationSummaryArgs,
): Promise<ToolExecResult> {
	await ctx.prisma.conversation.update({
		where: { id: ctx.conversationId },
		data: {
			summary: args.summary,
			sentiment: args.sentiment ?? null,
			tags: args.tags ?? [],
		},
	});
	return { ok: true };
}

// ---------- end_conversation ----------

export const EndConversationInput = z.object({
	resolution: z.enum(["resolved", "handed_off", "abandoned", "other"]),
	note: z.string().max(500).optional(),
});

export type EndConversationArgs = z.infer<typeof EndConversationInput>;

export const endConversationSpec = tool({
	description:
		"End the conversation. Use 'resolved' when the visitor's question is answered, 'handed_off' if a human took over, 'abandoned' if the visitor disengaged, 'other' otherwise.",
	inputSchema: EndConversationInput,
});

export async function executeEndConversation(
	ctx: ToolExecCtx,
	args: EndConversationArgs,
): Promise<ToolExecResult> {
	await ctx.prisma.conversation.update({
		where: { id: ctx.conversationId },
		data: { status: "ended", endedAt: new Date() },
	});
	// Triggering the ConversationSummarize workflow + closing the WS lives
	// with the DO. This executor's job is only the durable state flip.
	return { ok: true, resolution: args.resolution, note: args.note ?? null };
}

// ---------- registry ----------

// One place the DO can pull all four tools from. The shape is intentionally
// flat — name, spec for streamText, execute for the DO's post-call dispatch.
export const SYSTEM_TOOLS = {
	capture_contact: {
		spec: captureContactSpec,
		execute: executeCaptureContact,
	},
	request_handoff: {
		spec: requestHandoffSpec,
		execute: executeRequestHandoff,
	},
	set_conversation_summary: {
		spec: setConversationSummarySpec,
		execute: executeSetConversationSummary,
	},
	end_conversation: {
		spec: endConversationSpec,
		execute: executeEndConversation,
	},
} as const;

export type SystemToolName = keyof typeof SYSTEM_TOOLS;

// The ToolSet shape AI SDK v6 wants. The DO passes this to runTurn; the
// model sees the descriptions + schemas, the AI SDK handles arg validation.
export const SYSTEM_TOOL_SET = {
	capture_contact: SYSTEM_TOOLS.capture_contact.spec,
	request_handoff: SYSTEM_TOOLS.request_handoff.spec,
	set_conversation_summary: SYSTEM_TOOLS.set_conversation_summary.spec,
	end_conversation: SYSTEM_TOOLS.end_conversation.spec,
};
