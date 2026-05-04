// WebSocket envelope for Leadly's live conversation pipe.
// One discriminated union per direction:
//
//   ClientFrame    — visitor (widget) sends, server receives
//   ServerFrame    — server sends, visitor + observers receive
//   ObserverFrame  — dashboard observer sends, server receives
//
// Every inbound frame goes through its parser before the DO trusts the
// payload. Outbound frames are constructed in code so they're typed at the
// emit site; we don't parse our own output.
//
// Frame names are stable strings — they ship in the bundled widget loader
// and any rename breaks pinned tabs. Add new frame types; don't rename.

import { z } from "zod";

// ---------- common ----------

export const Cuid = z.string().min(1);

// ---------- client → server ----------

// First frame the widget sends after the WS opens. The `visitorToken` is the
// short-lived signed token issued by /api/widget/visitor (Phase 10) — the DO
// verifies it before accepting any user_msg.
export const WidgetHelloFrame = z.object({
	type: z.literal("widget_hello"),
	visitorToken: z.string().min(1),
});
export type WidgetHelloFrame = z.infer<typeof WidgetHelloFrame>;

// Visitor sent a message. Server responds with agent_token… agent_turn_end.
export const UserMsgFrame = z.object({
	type: z.literal("user_msg"),
	text: z.string().min(1).max(4000),
});
export type UserMsgFrame = z.infer<typeof UserMsgFrame>;

// Heartbeat. Hibernated DOs still answer.
export const PingFrame = z.object({ type: z.literal("ping") });
export type PingFrame = z.infer<typeof PingFrame>;

export const ClientFrame = z.discriminatedUnion("type", [
	WidgetHelloFrame,
	UserMsgFrame,
	PingFrame,
]);
export type ClientFrame = z.infer<typeof ClientFrame>;

export function parseClientFrame(raw: unknown): ClientFrame {
	return ClientFrame.parse(raw);
}

// ---------- server → visitor + observers ----------

// One delta from the streaming agent reply. The widget concatenates these.
export const AgentTokenFrame = z.object({
	type: z.literal("agent_token"),
	turnId: Cuid,
	delta: z.string(),
});
export type AgentTokenFrame = z.infer<typeof AgentTokenFrame>;

// Sent once when the agent's reply finishes. Carries the final text so
// reconnecting clients can rehydrate without replaying every delta.
export const AgentTurnEndFrame = z.object({
	type: z.literal("agent_turn_end"),
	turnId: Cuid,
	text: z.string(),
	finishReason: z.string(),
});
export type AgentTurnEndFrame = z.infer<typeof AgentTurnEndFrame>;

// LLM emitted a tool call. Echoed to observers so the dashboard transcript
// reflects the call inline. The result frame follows.
export const ToolCallFrame = z.object({
	type: z.literal("tool_call"),
	turnId: Cuid,
	toolCallId: z.string(),
	name: z.string(),
	args: z.unknown(),
});
export type ToolCallFrame = z.infer<typeof ToolCallFrame>;

export const ToolResultFrame = z.object({
	type: z.literal("tool_result"),
	turnId: Cuid,
	toolCallId: z.string(),
	name: z.string(),
	result: z.unknown(),
});
export type ToolResultFrame = z.infer<typeof ToolResultFrame>;

// Typing indicator. Sent at turn start; widget shows "..." until first token.
export const TypingFrame = z.object({
	type: z.literal("typing"),
	on: z.boolean(),
});
export type TypingFrame = z.infer<typeof TypingFrame>;

// Conversation mode flipped (auto ↔ paused, e.g. on take-over).
export const ModeChangeFrame = z.object({
	type: z.literal("mode_change"),
	mode: z.enum(["auto", "paused"]),
});
export type ModeChangeFrame = z.infer<typeof ModeChangeFrame>;

// Human (dashboard observer who took over) message — visitor sees it as a
// regular agent reply per design §7.1 ("Visitor never sees that a human
// took over").
export const HumanMsgFrame = z.object({
	type: z.literal("human_msg"),
	turnId: Cuid,
	text: z.string(),
});
export type HumanMsgFrame = z.infer<typeof HumanMsgFrame>;

// Server-initiated error frame. Closes the WS in most cases.
export const ErrorFrame = z.object({
	type: z.literal("error"),
	code: z.enum([
		"unauthenticated",
		"forbidden",
		"rate_limited",
		"internal",
		"invalid_frame",
	]),
	message: z.string(),
});
export type ErrorFrame = z.infer<typeof ErrorFrame>;

export const PongFrame = z.object({ type: z.literal("pong") });
export type PongFrame = z.infer<typeof PongFrame>;

export const ServerFrame = z.discriminatedUnion("type", [
	AgentTokenFrame,
	AgentTurnEndFrame,
	ToolCallFrame,
	ToolResultFrame,
	TypingFrame,
	ModeChangeFrame,
	HumanMsgFrame,
	ErrorFrame,
	PongFrame,
]);
export type ServerFrame = z.infer<typeof ServerFrame>;

export function parseServerFrame(raw: unknown): ServerFrame {
	return ServerFrame.parse(raw);
}

// ---------- observer (dashboard) → server ----------

// Dashboard tab connected to the same WS path with role=observer. The token
// is a short-lived JWT scoped to (conversationId, userId) issued by the
// take-over endpoint (Phase 8).
export const ObserverHelloFrame = z.object({
	type: z.literal("observer_hello"),
	observerToken: z.string().min(1),
});
export type ObserverHelloFrame = z.infer<typeof ObserverHelloFrame>;

// Operator clicks "take over" — flips conversation.mode = paused.
export const ObserverTakeOverFrame = z.object({
	type: z.literal("observer_take_over"),
});
export type ObserverTakeOverFrame = z.infer<typeof ObserverTakeOverFrame>;

// Operator clicks "release" — flips back to auto.
export const ObserverReleaseFrame = z.object({
	type: z.literal("observer_release"),
});
export type ObserverReleaseFrame = z.infer<typeof ObserverReleaseFrame>;

// Operator typed a reply while paused. Goes back through the WS as a
// human_msg frame to the visitor.
export const ObserverHumanMsgFrame = z.object({
	type: z.literal("observer_human_msg"),
	text: z.string().min(1).max(4000),
});
export type ObserverHumanMsgFrame = z.infer<typeof ObserverHumanMsgFrame>;

export const ObserverFrame = z.discriminatedUnion("type", [
	ObserverHelloFrame,
	ObserverTakeOverFrame,
	ObserverReleaseFrame,
	ObserverHumanMsgFrame,
	PingFrame,
]);
export type ObserverFrame = z.infer<typeof ObserverFrame>;

export function parseObserverFrame(raw: unknown): ObserverFrame {
	return ObserverFrame.parse(raw);
}

// ---------- helpers ----------

// Parse a JSON string off the wire and route it through the right parser.
// Throws on JSON-parse failure or schema-validation failure; the DO catches
// and emits an `invalid_frame` error.
export function parseInbound(
	raw: string,
	role: "client" | "observer",
): ClientFrame | ObserverFrame {
	const json = JSON.parse(raw);
	return role === "client" ? parseClientFrame(json) : parseObserverFrame(json);
}
