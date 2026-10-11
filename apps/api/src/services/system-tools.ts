// System tools (design §4.3). v1 ships five:
//
//   capture_contact          create/update Lead + link Visitor
//   save_lead_details        record answers for the agent's lead fields
//   request_handoff          flip conversation.mode = paused, signal observers
//   set_conversation_summary write the post-chat analysis (deterministic, post-end)
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

import { type LeadField, LeadIntent } from "@leadly/schemas";
import { tool } from "ai";
import { z } from "zod";
import type { ExtendedPrismaClient } from "../lib/prisma";
import {
	copyConversationDetailsToLead,
	ExtractedFieldsInput,
	ExtractedKeyFactsInput,
	mergeKeyFacts,
	normalizeLeadDetails,
	parseKeyFacts,
	saveLeadValues,
} from "./lead-capture";

// ---------- shared executor context ----------

export type ToolExecCtx = {
	conversationId: string;
	agentId: string;
	organizationId: string;
	visitorId: string;
	// The agent's lead fields, already loaded by the caller.
	leadFields: LeadField[];
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
	await copyConversationDetailsToLead(prisma, conversationId, lead.id);

	return { ok: true, leadId: lead.id, created: !existing };
}

// ---------- save_lead_details ----------

export const SaveLeadDetailsInput = z.object({
	details: z
		.record(z.string().min(1).max(200), z.string().min(1).max(1000))
		.refine((d) => Object.keys(d).length > 0 && Object.keys(d).length <= 15, {
			message: "Provide between 1 and 15 details",
		}),
});

export type SaveLeadDetailsArgs = z.infer<typeof SaveLeadDetailsInput>;

export const saveLeadDetailsSpec = tool({
	description:
		"Record answers for the lead fields listed in your instructions, as field key → the visitor's answer (e.g. { \"budget\": \"$2k/month\" }). Only use the listed keys. Call again to add or update answers.",
	inputSchema: SaveLeadDetailsInput,
});

export async function executeSaveLeadDetails(
	ctx: ToolExecCtx,
	args: SaveLeadDetailsArgs,
): Promise<ToolExecResult> {
	const { values, ignored } = normalizeLeadDetails(ctx.leadFields, args.details);
	if (Object.keys(values).length === 0) {
		return {
			ok: false,
			error: "None of these keys match a lead field. Use the keys listed in your instructions.",
			ignored,
		};
	}
	await saveLeadValues(ctx.prisma, ctx.conversationId, values, "overwrite");
	return { ok: true, saved: Object.keys(values), ignored };
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
	// Lead + quality analysis. All optional: free-tier models that can't
	// manage the full object still land a summary.
	intent: z.enum(LeadIntent.options).optional(),
	leadScore: z.number().int().min(0).max(100).optional(),
	qualityScore: z.number().int().min(1).max(5).optional(),
	resolved: z.boolean().optional(),
	need: z.string().max(500).optional(),
	unansweredQuestions: z.array(z.string().max(300)).max(10).optional(),
	objections: z.array(z.string().max(300)).max(10).optional(),
	nextStep: z.string().max(300).optional(),
	// Post-chat extraction (see services/lead-capture/extraction.ts).
	fields: ExtractedFieldsInput.optional(),
	keyFacts: ExtractedKeyFactsInput.optional(),
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
	const { prisma } = ctx;
	const keyFacts = args.keyFacts ?? [];
	const conversation = await prisma.conversation.update({
		where: { id: ctx.conversationId },
		data: {
			summary: args.summary,
			sentiment: args.sentiment ?? null,
			tags: args.tags ?? [],
			intent: args.intent ?? null,
			leadScore: args.leadScore ?? null,
			qualityScore: args.qualityScore ?? null,
			resolved: args.resolved ?? null,
			insights: {
				need: args.need ?? null,
				unansweredQuestions: args.unansweredQuestions ?? [],
				objections: args.objections ?? [],
				nextStep: args.nextStep ?? null,
				keyFacts,
			},
		},
		select: { leadId: true },
	});

	// Extraction only fills gaps: live captures and teammate edits win.
	const { values } = normalizeLeadDetails(
		ctx.leadFields,
		Object.fromEntries((args.fields ?? []).map((f) => [f.key, f.value])),
	);
	await saveLeadValues(prisma, ctx.conversationId, values, "fill");

	if (conversation.leadId) {
		const lead = await prisma.lead.findUnique({
			where: { id: conversation.leadId },
			select: { keyFacts: true },
		});
		// Keep the lead's latest analysis; a thinner summary doesn't blank it.
		await prisma.lead.update({
			where: { id: conversation.leadId },
			data: {
				...(args.intent !== undefined && { intent: args.intent }),
				...(args.leadScore !== undefined && { score: args.leadScore }),
				...(args.need !== undefined && { need: args.need }),
				...(keyFacts.length > 0 && {
					keyFacts: mergeKeyFacts(parseKeyFacts(lead?.keyFacts), keyFacts),
				}),
			},
		});
	}
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
	save_lead_details: {
		spec: saveLeadDetailsSpec,
		execute: executeSaveLeadDetails,
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
	save_lead_details: SYSTEM_TOOLS.save_lead_details.spec,
	request_handoff: SYSTEM_TOOLS.request_handoff.spec,
	set_conversation_summary: SYSTEM_TOOLS.set_conversation_summary.spec,
	end_conversation: SYSTEM_TOOLS.end_conversation.spec,
};
