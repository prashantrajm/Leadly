// Conversation routes. Phase 7 ships only the WS upgrade endpoint that
// proxies to the ConversationDO. Phase 8 adds take-over / release /
// human-message REST endpoints and Phase 9 fills in inbox listing.

import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppEnv } from "../types";

export const conversationsApp = new OpenAPIHono<AppEnv>();

// GET /api/conversations/:id/ws
//
// Two roles share this path. The `?role=observer` query param + observer
// token (Phase 8) puts the WS on the dashboard side. Default is the
// visitor side — the widget never passes ?role.
//
// Authentication for visitors lives in Phase 10's widgetTokenMiddleware
// (a short-lived signed token). Until that ships, the route is open in
// dev — Phase 10 wires the middleware here.
conversationsApp.get("/:id/ws", async (c) => {
	const conversationId = c.req.param("id");
	if (request_is_not_websocket(c.req.raw)) {
		return c.text("WebSocket upgrade required", 426);
	}

	// All instances for the same conversationId share the same DO. The id
	// is derived from the conversationId string so we don't need a separate
	// "conversation table → DO id" mapping.
	const stub = c.env.CONVERSATION.get(
		c.env.CONVERSATION.idFromName(conversationId),
	);

	// We forward the original Request object — the DO's fetch handler reads
	// the role from the query string and the Upgrade header from there.
	const url = new URL(c.req.url);
	url.searchParams.set("conversationId", conversationId);
	const forwarded = new Request(url.toString(), c.req.raw);
	return stub.fetch(forwarded);
});

function request_is_not_websocket(req: Request): boolean {
	return req.headers.get("Upgrade") !== "websocket";
}
