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
	ConversationListItemSchema,
	ConversationStatus,
	ConversationMode,
	ConversationWithTurnsSchema,
	ErrorSchema,
	HumanMessageSchema,
	SuccessSchema,
	TakeOverResponseSchema,
} from "@leadly/schemas";
import { decodeCursor, encodeCursor } from "../lib/cursor";
import { getPrisma } from "../lib/prisma";
import { verifyWidgetToken } from "../lib/widget-token";
import { requireAgentAccess } from "../middleware/org";
import type { AppEnv } from "../types";

export const conversationsApp = new OpenAPIHono<AppEnv>();
export const conversationsInboxApp = new OpenAPIHono<AppEnv>();
export const agentConversationsApp = new OpenAPIHono<AppEnv>();

// GET /api/conversations/:id/ws
//
// Two roles share this path. ?role=observer puts the WS on the dashboard
// side (validated against the observer token from /take-over — Phase 10
// scope). Default visitor role requires ?token=<widgetToken>.
//
// We accept the token via query string because browsers' WebSocket API
// can't attach arbitrary headers on Upgrade. The token is short-lived
// and bound to (visitorId, agentId, exp), so leaking it in a URL log
// has minimal blast radius.
conversationsApp.get("/:id/ws", async (c) => {
	const conversationId = c.req.param("id");
	if (request_is_not_websocket(c.req.raw)) {
		return c.text("WebSocket upgrade required", 426);
	}

	const url = new URL(c.req.url);
	const role = url.searchParams.get("role") === "observer" ? "observer" : "visitor";

	if (role === "visitor") {
		const token = url.searchParams.get("token");
		if (!token) return c.text("Missing widget token", 401);

		const verified = await verifyWidgetToken(c.env.BETTER_AUTH_SECRET, token);
		if (!verified.ok) {
			return c.text(`Invalid widget token (${verified.reason})`, 401);
		}
		// Confirm the token actually belongs to this conversation. A leaked
		// token from agent A must not be usable to attach to a conversation
		// hosted on agent B even if conversationIds collide unpredictably.
		const prisma = getPrisma(c.env.DATABASE_URL);
		const conv = await prisma.conversation.findUnique({
			where: { id: conversationId },
			select: { agentId: true, visitorId: true },
		});
		if (
			!conv ||
			conv.agentId !== verified.payload.a ||
			conv.visitorId !== verified.payload.v
		) {
			return c.text("Token does not match conversation", 403);
		}
	}

	// All instances for the same conversationId share the same DO. The id
	// is derived from the conversationId string so we don't need a separate
	// "conversation table → DO id" mapping.
	const stub = c.env.CONVERSATION.get(
		c.env.CONVERSATION.idFromName(conversationId),
	);

	// Forward the original Request — the DO's fetch reads role + the
	// Upgrade header from there.
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

// ---------- list (per-agent, cursor-paginated) ----------

const listConversationsRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Conversations"],
	request: {
		params: z.object({ agentId: z.string() }),
		query: z.object({
			cursor: z.string().optional(),
			limit: z.coerce.number().int().min(1).max(100).default(20),
			status: ConversationStatus.optional(),
			mode: ConversationMode.optional(),
			leadId: z.string().optional(),
		}),
	},
	middleware: [requireAgentAccess] as const,
	responses: {
		200: {
			content: {
				"application/json": {
					schema: z.object({
						items: z.array(ConversationListItemSchema),
						nextCursor: z.string().nullable(),
					}),
				},
			},
			description: "Conversations page (newest first)",
		},
		400: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Bad cursor",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
	},
});

agentConversationsApp.openapi(listConversationsRoute, async (c) => {
	const { agentId } = c.req.valid("param");
	const { cursor, limit, status, mode, leadId } = c.req.valid("query");
	const prisma = getPrisma(c.env.DATABASE_URL);

	// Cursor decodes to (createdAt, id). We page on (startedAt DESC, id DESC)
	// so newer conversations always appear first; the id tiebreak keeps the
	// page stable when many rows share the same startedAt timestamp.
	let after: { startedAt: Date; id: string } | null = null;
	if (cursor) {
		try {
			const decoded = decodeCursor(cursor);
			after = { startedAt: new Date(decoded.createdAt), id: decoded.id };
		} catch {
			return c.json({ error: "Invalid cursor" }, 400);
		}
	}

	const where = {
		agentId,
		...(status ? { status } : {}),
		...(mode ? { mode } : {}),
		...(leadId ? { leadId } : {}),
		...(after
			? {
					OR: [
						{ startedAt: { lt: after.startedAt } },
						{
							startedAt: after.startedAt,
							id: { lt: after.id },
						},
					],
				}
			: {}),
	};

	// Pull `limit + 1` so we can tell whether there's a next page without
	// a separate count query.
	const rows = await prisma.conversation.findMany({
		where,
		orderBy: [{ startedAt: "desc" }, { id: "desc" }],
		take: limit + 1,
		include: {
			visitor: { select: { id: true, externalId: true } },
			lead: { select: { id: true, email: true, name: true } },
			_count: { select: { turns: true } },
		},
	});

	type Row = {
		id: string;
		organizationId: string;
		agentId: string;
		visitorId: string;
		leadId: string | null;
		channel: "chat" | "voice";
		mode: "auto" | "paused";
		status: "active" | "ended" | "abandoned";
		startedAt: Date;
		endedAt: Date | null;
		summary: string | null;
		sentiment: string | null;
		tags: unknown;
		lastActivityAt: Date;
		visitor: { id: string; externalId: string };
		lead: { id: string; email: string | null; name: string | null } | null;
		_count: { turns: number };
	};
	const typed = rows as unknown as Row[];

	const hasMore = typed.length > limit;
	const items = typed.slice(0, limit);

	const nextCursor = hasMore
		? encodeCursor({
				createdAt: items[items.length - 1].startedAt.toISOString(),
				id: items[items.length - 1].id,
			})
		: null;

	return c.json(
		{
			items: items.map((r) => ({
				id: r.id,
				organizationId: r.organizationId,
				agentId: r.agentId,
				visitorId: r.visitorId,
				leadId: r.leadId,
				channel: r.channel,
				mode: r.mode,
				status: r.status,
				startedAt: r.startedAt.toISOString(),
				endedAt: r.endedAt ? r.endedAt.toISOString() : null,
				summary: r.summary,
				sentiment: r.sentiment,
				tags: (r.tags as string[] | null) ?? null,
				lastActivityAt: r.lastActivityAt.toISOString(),
				visitor: r.visitor,
				lead: r.lead,
				turnCount: r._count.turns,
			})),
			nextCursor,
		},
		200,
	);
});

// ---------- detail (with turns inline) ----------

const getConversationRoute = createRoute({
	method: "get",
	path: "/{id}",
	tags: ["Conversations"],
	request: { params: z.object({ id: z.string() }) },
	responses: {
		200: {
			content: {
				"application/json": { schema: ConversationWithTurnsSchema },
			},
			description: "Conversation with turn history",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Not found",
		},
	},
});

conversationsInboxApp.openapi(getConversationRoute, async (c) => {
	const { id } = c.req.valid("param");
	const access = await loadConversationAndCheckAccess(c, id);
	if (!access.ok) return c.json(access.body, access.status);

	const prisma = getPrisma(c.env.DATABASE_URL);
	type Loaded = {
		id: string;
		organizationId: string;
		agentId: string;
		visitorId: string;
		leadId: string | null;
		channel: "chat" | "voice";
		mode: "auto" | "paused";
		status: "active" | "ended" | "abandoned";
		startedAt: Date;
		endedAt: Date | null;
		summary: string | null;
		sentiment: string | null;
		tags: unknown;
		lastActivityAt: Date;
		turns: Array<{
			id: string;
			conversationId: string;
			role: "user" | "agent" | "human" | "tool" | "system";
			text: string;
			audioUrl: string | null;
			durationMs: number | null;
			asrConfidence: number | null;
			toolName: string | null;
			toolArgs: unknown;
			toolResult: unknown;
			llmProvider: string | null;
			model: string | null;
			latencyMs: number | null;
			tokensIn: number | null;
			tokensOut: number | null;
			createdAt: Date;
		}>;
	};

	const conv = (await prisma.conversation.findUnique({
		where: { id },
		include: {
			turns: { orderBy: { createdAt: "asc" } },
		},
	})) as unknown as Loaded;

	return c.json(
		{
			id: conv.id,
			organizationId: conv.organizationId,
			agentId: conv.agentId,
			visitorId: conv.visitorId,
			leadId: conv.leadId,
			channel: conv.channel,
			mode: conv.mode,
			status: conv.status,
			startedAt: conv.startedAt.toISOString(),
			endedAt: conv.endedAt ? conv.endedAt.toISOString() : null,
			summary: conv.summary,
			sentiment: conv.sentiment,
			tags: (conv.tags as string[] | null) ?? null,
			lastActivityAt: conv.lastActivityAt.toISOString(),
			turns: conv.turns.map((t) => ({
				id: t.id,
				conversationId: t.conversationId,
				role: t.role,
				text: t.text,
				audioUrl: t.audioUrl,
				durationMs: t.durationMs,
				asrConfidence: t.asrConfidence,
				toolName: t.toolName,
				toolArgs: t.toolArgs ?? null,
				toolResult: t.toolResult ?? null,
				llmProvider: t.llmProvider,
				model: t.model,
				latencyMs: t.latencyMs,
				tokensIn: t.tokensIn,
				tokensOut: t.tokensOut,
				createdAt: t.createdAt.toISOString(),
			})),
		},
		200,
	);
});
