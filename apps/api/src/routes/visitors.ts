// Visitor read-only endpoints for the dashboard. Visitors are created
// implicitly by the widget's hello flow (Phase 10) — there's no
// CREATE/UPDATE/DELETE here, just listing and detail views.

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { ErrorSchema, VisitorSchema } from "@leadly/schemas";
import { getPrisma } from "../lib/prisma";
import { requireAgentAccess } from "../middleware/org";
import type { AppEnv } from "../types";

export const agentVisitorsApp = new OpenAPIHono<AppEnv>();
export const visitorsApp = new OpenAPIHono<AppEnv>();

// ---------- list (per-agent) ----------

const listVisitorsRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Visitors"],
	request: {
		params: z.object({ agentId: z.string() }),
		query: z.object({
			limit: z.coerce.number().int().min(1).max(100).default(50),
		}),
	},
	middleware: [requireAgentAccess] as const,
	responses: {
		200: {
			content: { "application/json": { schema: z.array(VisitorSchema) } },
			description: "Visitors for the agent (most recently seen first)",
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

agentVisitorsApp.openapi(listVisitorsRoute, async (c) => {
	const { agentId } = c.req.valid("param");
	const { limit } = c.req.valid("query");
	const prisma = getPrisma(c.env.DATABASE_URL);
	const visitors = await prisma.visitor.findMany({
		where: { agentId },
		orderBy: { lastSeenAt: "desc" },
		take: limit,
	});
	return c.json(visitors.map(toWire), 200);
});

// ---------- get :visitorId ----------

const getVisitorRoute = createRoute({
	method: "get",
	path: "/{visitorId}",
	tags: ["Visitors"],
	request: { params: z.object({ visitorId: z.string() }) },
	responses: {
		200: {
			content: { "application/json": { schema: VisitorSchema } },
			description: "Visitor",
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

visitorsApp.openapi(getVisitorRoute, async (c) => {
	const { visitorId } = c.req.valid("param");
	const user = c.get("user");
	const prisma = getPrisma(c.env.DATABASE_URL);

	// Inline membership check — the visitorId path doesn't carry the
	// agentId, so requireAgentAccess can't be reused here.
	const visitor = await prisma.visitor.findUnique({
		where: { id: visitorId },
	});
	if (!visitor) return c.json({ error: "Visitor not found" }, 404);

	const membership = await prisma.membership.findUnique({
		where: {
			organizationId_userId: {
				organizationId: visitor.organizationId,
				userId: user.id,
			},
		},
		select: { id: true },
	});
	if (!membership) return c.json({ error: "Forbidden" }, 403);

	return c.json(toWire(visitor), 200);
});

// ---------- helpers ----------

function toWire(v: {
	id: string;
	organizationId: string;
	agentId: string;
	externalId: string;
	firstSeenAt: Date;
	lastSeenAt: Date;
	userAgent: string | null;
	ipHash: string | null;
	leadId: string | null;
}) {
	return {
		id: v.id,
		organizationId: v.organizationId,
		agentId: v.agentId,
		externalId: v.externalId,
		firstSeenAt: v.firstSeenAt.toISOString(),
		lastSeenAt: v.lastSeenAt.toISOString(),
		userAgent: v.userAgent,
		ipHash: v.ipHash,
		leadId: v.leadId,
	};
}
