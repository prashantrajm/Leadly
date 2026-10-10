import { z } from "@hono/zod-openapi";
import { Cuid, IsoDate } from "./common.ts";
import {
	ConversationChannel,
	ConversationMode,
	ConversationStatus,
	TurnRole,
} from "./enums.ts";

// ---------- Turn ----------

export const TurnSchema = z
	.object({
		id: Cuid,
		conversationId: Cuid,
		role: TurnRole,
		text: z.string(),
		// Voice columns — null in v1 chat-only.
		audioUrl: z.string().nullable(),
		durationMs: z.number().int().nullable(),
		asrConfidence: z.number().nullable(),
		// Tool execution metadata
		toolName: z.string().nullable(),
		toolArgs: z.unknown().nullable(),
		toolResult: z.unknown().nullable(),
		// LLM telemetry
		llmProvider: z.string().nullable(),
		model: z.string().nullable(),
		latencyMs: z.number().int().nullable(),
		tokensIn: z.number().int().nullable(),
		tokensOut: z.number().int().nullable(),
		createdAt: IsoDate,
	})
	.openapi("Turn");
export type Turn = z.infer<typeof TurnSchema>;

// ---------- Conversation ----------

export const ConversationSchema = z
	.object({
		id: Cuid,
		organizationId: Cuid,
		agentId: Cuid,
		visitorId: Cuid,
		leadId: Cuid.nullable(),
		channel: ConversationChannel,
		mode: ConversationMode,
		status: ConversationStatus,
		startedAt: IsoDate,
		endedAt: IsoDate.nullable(),
		summary: z.string().nullable(),
		sentiment: z.string().nullable(),
		tags: z.array(z.string()).nullable(),
		lastActivityAt: IsoDate,
	})
	.openapi("Conversation");
export type Conversation = z.infer<typeof ConversationSchema>;

// Inbox list row — slim, no turns.
export const ConversationListItemSchema = ConversationSchema.extend({
	visitor: z.object({
		id: Cuid,
		externalId: z.string(),
	}),
	lead: z
		.object({
			id: Cuid,
			email: z.string().nullable(),
			name: z.string().nullable(),
		})
		.nullable(),
	turnCount: z.number().int().nonnegative(),
}).openapi("ConversationListItem");
export type ConversationListItem = z.infer<typeof ConversationListItemSchema>;

// Org-wide inbox counters for the sidebar badge. `waitingOnHuman` is active
// conversations in paused mode — a handoff was requested or an operator
// took over, so the agent is silent until someone replies or releases it.
export const InboxCountsSchema = z
	.object({
		active: z.number().int().nonnegative(),
		waitingOnHuman: z.number().int().nonnegative(),
	})
	.openapi("InboxCounts");
export type InboxCounts = z.infer<typeof InboxCountsSchema>;

// Detail view — turns inline.
export const ConversationWithTurnsSchema = ConversationSchema.extend({
	turns: z.array(TurnSchema),
}).openapi("ConversationWithTurns");
export type ConversationWithTurns = z.infer<typeof ConversationWithTurnsSchema>;

// ---------- Inbox actions ----------

export const TakeOverResponseSchema = z
	.object({
		// Short-lived signed token the dashboard uses to connect to the WS
		// in observer-with-write role.
		observerToken: z.string(),
	})
	.openapi("TakeOverResponse");
export type TakeOverResponse = z.infer<typeof TakeOverResponseSchema>;

export const HumanMessageSchema = z
	.object({
		text: z.string().min(1).max(4000),
	})
	.openapi("HumanMessage");
export type HumanMessage = z.infer<typeof HumanMessageSchema>;

export const EndConversationSchema = z
	.object({
		note: z.string().max(500).optional(),
	})
	.openapi("EndConversation");
export type EndConversation = z.infer<typeof EndConversationSchema>;

// ---------- List query filters ----------

export const ConversationListQuery = z.object({
	cursor: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(100).default(20),
	status: ConversationStatus.optional(),
	mode: ConversationMode.optional(),
	leadId: Cuid.optional(),
});
export type ConversationListQuery = z.infer<typeof ConversationListQuery>;
