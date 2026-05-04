import { z } from "@hono/zod-openapi";
import { Cuid } from "./common.ts";
import { AgentIdentityPolicy } from "./enums.ts";

// What the iframe fetches on every load. Cached in KV with a 60s TTL and
// invalidated on agent settings save (Phase 4 PATCH /agents/:id).
// No secrets and no internal IDs leak here — only what the visitor's
// browser needs to render the bubble + greet.
export const WidgetConfigSchema = z
	.object({
		agentId: Cuid,
		name: z.string(),
		greeting: z.string(),
		accentColor: z.string(),
		identityPolicy: AgentIdentityPolicy,
	})
	.openapi("WidgetConfig");
export type WidgetConfig = z.infer<typeof WidgetConfigSchema>;

export const StartWidgetConversationSchema = z
	.object({
		// Visitor token from the prior /api/widget/visitor call lives in a
		// header, not in the body. Body is reserved for future fields.
	})
	.openapi("StartWidgetConversation");
export type StartWidgetConversation = z.infer<typeof StartWidgetConversationSchema>;

export const StartWidgetConversationResponseSchema = z
	.object({
		conversationId: Cuid,
		// URL the widget dials with WebSocket, including a short-lived token
		// query param that the DO verifies on Upgrade.
		wsUrl: z.string(),
	})
	.openapi("StartWidgetConversationResponse");
export type StartWidgetConversationResponse = z.infer<
	typeof StartWidgetConversationResponseSchema
>;
