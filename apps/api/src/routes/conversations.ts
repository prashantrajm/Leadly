// Conversation routes split into two routers:
//
//   conversationsPublicApp — mounted at /api/conversations (no auth):
//     GET /:id/ws   — visitor WebSocket upgrade
//
//   conversationsInboxApp  — mounted at /api/conversations (authed):
//     POST /:id/take-over     — flip mode=paused, broadcast mode_change
//     POST /:id/release       — flip mode=auto,  broadcast mode_change
//     POST /:id/human-message — operator reply, broadcast human_msg
//
// All inbox routes call into the ConversationDO via its internal /control
// endpoint so attached WebSockets see the broadcast immediately even
// though the operator isn't on the WS themselves.

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
	ErrorSchema,
	HumanMessageSchema,
	SuccessSchema,
	TakeOverResponseSchema,
} from "@leadly/schemas";
import { getPrisma } from "../lib/prisma";
import { requireAgentAccess } from "../middleware/org";
import type { AppEnv } from "../types";

export const conversationsApp = new OpenAPIHono<AppEnv>();
export const conversationsInboxApp = new OpenAPIHono<AppEnv>();

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

// ---------- inbox routes (authed) ----------
//
// These run under apiApp's authed sub-app, so c.get("user") is set.
// requireConversationAccess is a per-route inline guard: load the agent
// from the conversation, then check membership on the user's org. Saves
// us threading agentId through the URL when the conversation already
// names its agent.

// biome-ignore lint/suspicious/noExplicitAny: this guard runs in three different OpenAPIHono routes whose Context types are all distinct generics; widening to `any` here is the price of having ONE inline guard rather than three copies.
type AnyRouteCtx = any;

async function loadConversationAndCheckAccess(
	c: AnyRouteCtx,
	conversationId: string,
): Promise<
	| { ok: true; conversation: { id: string; agentId: string; organizationId: string } }
	| { ok: false; status: 403 | 404; body: { error: string } }
> {
	const user = c.get("user") as { id: string };
	const env = c.env as { DATABASE_URL: string };
	const prisma = getPrisma(env.DATABASE_URL);
	const conv = await prisma.conversation.findUnique({
		where: { id: conversationId },
		select: { id: true, agentId: true, organizationId: true },
	});
	if (!conv) return { ok: false, status: 404, body: { error: "Conversation not found" } };

	const membership = await prisma.membership.findUnique({
		where: {
			organizationId_userId: {
				organizationId: conv.organizationId,
				userId: user.id,
			},
		},
		select: { id: true },
	});
	if (!membership) return { ok: false, status: 403, body: { error: "Forbidden" } };

	return { ok: true, conversation: conv };
}

async function callDoControl(
	env: AppEnv["Bindings"],
	conversationId: string,
	body: Record<string, unknown>,
): Promise<Response> {
	const stub = env.CONVERSATION.get(env.CONVERSATION.idFromName(conversationId));
	// The DO's fetch dispatches by url.pathname endsWith /control. Origin
	// doesn't matter — DO stubs route by binding, not by URL.
	return stub.fetch("https://do.local/control", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ ...body, conversationId }),
	});
}

// POST /api/conversations/:id/take-over
const takeOverRoute = createRoute({
	method: "post",
	path: "/{id}/take-over",
	tags: ["Conversations"],
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			content: { "application/json": { schema: TakeOverResponseSchema } },
			description: "Conversation paused, observer token issued",
		},
		401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthorized" },
		403: { content: { "application/json": { schema: ErrorSchema } }, description: "Forbidden" },
		404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
	},
});

conversationsInboxApp.openapi(takeOverRoute, async (c) => {
	const { id } = c.req.valid("param");
	const access = await loadConversationAndCheckAccess(c, id);
	if (!access.ok) return c.json(access.body, access.status);

	const res = await callDoControl(c.env, id, { action: "take_over" });
	if (!res.ok) return c.json({ error: "DO control failed" }, 404);

	// Observer token minting belongs to Phase 10 (widget/observer JWT
	// signing). For v1 we return a stub token; the dashboard will use it
	// to connect to the WS in observer role once Phase 10 wires the
	// verifier. Until then the WS path doesn't enforce it.
	return c.json({ observerToken: `stub-${id}` }, 200);
});

// POST /api/conversations/:id/release
const releaseRoute = createRoute({
	method: "post",
	path: "/{id}/release",
	tags: ["Conversations"],
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: { content: { "application/json": { schema: SuccessSchema } }, description: "Released" },
		401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthorized" },
		403: { content: { "application/json": { schema: ErrorSchema } }, description: "Forbidden" },
		404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
	},
});

conversationsInboxApp.openapi(releaseRoute, async (c) => {
	const { id } = c.req.valid("param");
	const access = await loadConversationAndCheckAccess(c, id);
	if (!access.ok) return c.json(access.body, access.status);

	const res = await callDoControl(c.env, id, { action: "release" });
	if (!res.ok) return c.json({ error: "DO control failed" }, 404);
	return c.json({ success: true as const }, 200);
});

// POST /api/conversations/:id/human-message
const humanMessageRoute = createRoute({
	method: "post",
	path: "/{id}/human-message",
	tags: ["Conversations"],
	request: {
		params: z.object({ id: z.string() }),
		body: { content: { "application/json": { schema: HumanMessageSchema } } },
	},
	responses: {
		200: { content: { "application/json": { schema: SuccessSchema } }, description: "Sent" },
		400: { content: { "application/json": { schema: ErrorSchema } }, description: "Invalid input" },
		401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthorized" },
		403: { content: { "application/json": { schema: ErrorSchema } }, description: "Forbidden" },
		404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
	},
});

conversationsInboxApp.openapi(humanMessageRoute, async (c) => {
	const { id } = c.req.valid("param");
	const { text } = c.req.valid("json");
	const access = await loadConversationAndCheckAccess(c, id);
	if (!access.ok) return c.json(access.body, access.status);

	const res = await callDoControl(c.env, id, { action: "human_message", text });
	if (!res.ok) return c.json({ error: "DO control failed" }, 404);
	return c.json({ success: true as const }, 200);
});

// requireAgentAccess re-exported for downstream use; not currently consumed
// here but Phase 9's listing routes will need it.
void requireAgentAccess;
