// Public widget endpoints. All three are unauthenticated (no Better Auth
// session) — the widget runs on a third-party site, not in the dashboard.
// Two of them mint a short-lived widget token; the WS upgrade route
// (Phase 7) uses verifyWidgetToken to authorize the visitor.
//
//   GET  /api/widget/config?agentId=...     KV-cached 60s, returns the
//                                           bare-minimum render config
//   POST /api/widget/visitor                upserts Visitor by externalId,
//                                           returns visitor token
//   POST /api/widget/conversation           creates Conversation, returns
//                                           conversationId + ws URL
//
// Rate-limit on the conversation-creation endpoint — anyone with the
// public agentId can hit it, so we cap per (agentId, externalId) before
// any DB write. 30/min matches the design's per-visitor message ceiling.

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
	ErrorSchema,
	StartWidgetConversationResponseSchema,
	VisitorHelloSchema,
	WidgetConfigSchema,
} from "@leadly/schemas";
import { getPrisma } from "../lib/prisma";
import { signWidgetToken } from "../lib/widget-token";
import { consumeToken } from "../middleware/rate-limit";
import type { AppEnv } from "../types";

export const widgetApp = new OpenAPIHono<AppEnv>();

// ---------- GET /config ----------

const CONFIG_TTL_SECONDS = 60;
const cacheKey = (agentId: string) => `widget:config:${agentId}`;

const getConfigRoute = createRoute({
	method: "get",
	path: "/config",
	tags: ["Widget"],
	request: {
		query: z.object({ agentId: z.string().min(1) }),
	},
	responses: {
		200: {
			content: { "application/json": { schema: WidgetConfigSchema } },
			description: "Render config for the widget iframe",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Agent not found",
		},
	},
});

widgetApp.openapi(getConfigRoute, async (c) => {
	const { agentId } = c.req.valid("query");

	// 1. KV cache hit — return immediately. KV is eventually consistent;
	//    a stale config for 60s after a settings change is the design's
	//    accepted bound (§5.6).
	const cached = await c.env.WIDGET_CACHE.get(cacheKey(agentId));
	if (cached) {
		return c.json(JSON.parse(cached), 200);
	}

	// 2. Cache miss — read from Postgres + write through to KV.
	const prisma = getPrisma(c.env.DATABASE_URL);
	const agent = await prisma.agent.findUnique({
		where: { id: agentId },
		select: {
			id: true,
			name: true,
			greeting: true,
			accentColor: true,
			identityPolicy: true,
		},
	});
	if (!agent) return c.json({ error: "Agent not found" }, 404);

	const config = {
		agentId: agent.id,
		name: agent.name,
		greeting: agent.greeting,
		accentColor: agent.accentColor,
		identityPolicy: agent.identityPolicy,
	};
	await c.env.WIDGET_CACHE.put(cacheKey(agentId), JSON.stringify(config), {
		expirationTtl: CONFIG_TTL_SECONDS,
	});
	return c.json(config, 200);
});

// ---------- POST /visitor ----------

const VisitorResponseSchema = z.object({
	visitorId: z.string(),
	token: z.string(),
}).openapi("VisitorHelloResponse");

const helloRoute = createRoute({
	method: "post",
	path: "/visitor",
	tags: ["Widget"],
	request: {
		query: z.object({ agentId: z.string().min(1) }),
		body: { content: { "application/json": { schema: VisitorHelloSchema } } },
	},
	responses: {
		200: {
			content: { "application/json": { schema: VisitorResponseSchema } },
			description: "Visitor upserted, token issued",
		},
		400: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Invalid input",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Agent not found",
		},
	},
});

widgetApp.openapi(helloRoute, async (c) => {
	const { agentId } = c.req.valid("query");
	const { externalId, userAgent } = c.req.valid("json");
	const prisma = getPrisma(c.env.DATABASE_URL);

	// Need the agent's organizationId to seed the visitor. Use a single
	// SELECT — most widget loads will be for an existing visitor anyway.
	const agent = await prisma.agent.findUnique({
		where: { id: agentId },
		select: { id: true, organizationId: true },
	});
	if (!agent) return c.json({ error: "Agent not found" }, 404);

	const visitor = await prisma.visitor.upsert({
		where: { agentId_externalId: { agentId, externalId } },
		create: {
			organizationId: agent.organizationId,
			agentId,
			externalId,
			userAgent: userAgent ?? null,
		},
		update: {
			lastSeenAt: new Date(),
			...(userAgent ? { userAgent } : {}),
		},
	});

	const token = await signWidgetToken(c.env.BETTER_AUTH_SECRET, {
		visitorId: visitor.id,
		agentId,
	});
	return c.json({ visitorId: visitor.id, token }, 200);
});

// ---------- POST /conversation ----------

const startRoute = createRoute({
	method: "post",
	path: "/conversation",
	tags: ["Widget"],
	request: {
		// Visitor token in Authorization header (Bearer ...). The body is
		// reserved for future fields (agent overrides, locale) — empty for v1.
		body: {
			content: {
				"application/json": {
					schema: z.object({}).strict(),
				},
			},
		},
	},
	responses: {
		200: {
			content: {
				"application/json": { schema: StartWidgetConversationResponseSchema },
			},
			description: "Conversation created, WS URL ready",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Missing or invalid widget token",
		},
		429: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Rate limit exceeded",
		},
	},
});

widgetApp.openapi(startRoute, async (c) => {
	const auth = c.req.header("authorization") ?? "";
	const tokenStr = auth.startsWith("Bearer ") ? auth.slice(7) : "";
	if (!tokenStr) return c.json({ error: "Missing widget token" }, 401);

	const { verifyWidgetToken } = await import("../lib/widget-token");
	const verified = await verifyWidgetToken(c.env.BETTER_AUTH_SECRET, tokenStr);
	if (!verified.ok) {
		return c.json({ error: `Invalid token (${verified.reason})` }, 401);
	}
	const { v: visitorId, a: agentId } = verified.payload;

	// Per-visitor rate limit. Same KV namespace, dedicated bucket.
	const rl = await consumeToken(
		{
			kv: c.env.WIDGET_CACHE,
			bucket: "rl:widget:start",
			windowSeconds: 60,
			max: 30,
		},
		`${agentId}:${visitorId}`,
	);
	if (!rl.allowed) {
		return c.json({ error: "Rate limit exceeded" }, 429);
	}

	const prisma = getPrisma(c.env.DATABASE_URL);
	const visitor = await prisma.visitor.findUnique({ where: { id: visitorId } });
	if (!visitor || visitor.agentId !== agentId) {
		return c.json({ error: "Token references invalid visitor" }, 401);
	}

	const conv = await prisma.conversation.create({
		data: {
			organizationId: visitor.organizationId,
			agentId,
			visitorId,
		},
	});

	const wsUrl = buildWsUrl(c.req.url, conv.id);
	return c.json({ conversationId: conv.id, wsUrl }, 200);
});

// ---------- helpers ----------

function buildWsUrl(reqUrl: string, conversationId: string): string {
	const u = new URL(reqUrl);
	const proto = u.protocol === "https:" ? "wss:" : "ws:";
	return `${proto}//${u.host}/api/conversations/${conversationId}/ws`;
}

// Exposed so PATCH /agents/:id can invalidate after settings save. Avoids
// a 60-second window where the widget shows stale greeting/accentColor.
export async function invalidateWidgetConfigCache(
	kv: KVNamespace,
	agentId: string,
): Promise<void> {
	await kv.delete(cacheKey(agentId));
}
