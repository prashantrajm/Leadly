// Lead routes for the dashboard. CREATE happens implicitly through the
// agent's capture_contact tool — no public POST. Read / update / delete
// only.

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
	ErrorSchema,
	LeadSchema,
	SuccessSchema,
	UpdateLeadSchema,
} from "@leadly/schemas";
import { getPrisma } from "../lib/prisma";
import { requireAgentAccess } from "../middleware/org";
import type { AppEnv } from "../types";

export const agentLeadsApp = new OpenAPIHono<AppEnv>();
export const leadsApp = new OpenAPIHono<AppEnv>();

// ---------- list (per-agent) ----------

const listLeadsRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Leads"],
	request: {
		params: z.object({ agentId: z.string() }),
		query: z.object({
			limit: z.coerce.number().int().min(1).max(100).default(50),
			search: z.string().optional(),
		}),
	},
	middleware: [requireAgentAccess] as const,
	responses: {
		200: {
			content: { "application/json": { schema: z.array(LeadSchema) } },
			description: "Leads for the agent (newest first)",
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

agentLeadsApp.openapi(listLeadsRoute, async (c) => {
	const { agentId } = c.req.valid("param");
	const { limit, search } = c.req.valid("query");
	const prisma = getPrisma(c.env.DATABASE_URL);

	// `search` matches email / phone / name with case-insensitive contains.
	// Postgres handles ILIKE well; on a per-agent index we'd never blow past
	// hundreds of leads in v1, so a sequential scan is fine.
	const where = search
		? {
				agentId,
				OR: [
					{ email: { contains: search, mode: "insensitive" as const } },
					{ phone: { contains: search } },
					{ name: { contains: search, mode: "insensitive" as const } },
				],
			}
		: { agentId };

	const leads = await prisma.lead.findMany({
		where,
		orderBy: { createdAt: "desc" },
		take: limit,
	});
	return c.json(leads.map(toWire), 200);
});

// ---------- get :leadId ----------

const getLeadRoute = createRoute({
	method: "get",
	path: "/{leadId}",
	tags: ["Leads"],
	request: { params: z.object({ leadId: z.string() }) },
	responses: {
		200: {
			content: { "application/json": { schema: LeadSchema } },
			description: "Lead",
		},
		401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthorized" },
		403: { content: { "application/json": { schema: ErrorSchema } }, description: "Forbidden" },
		404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
	},
});

leadsApp.openapi(getLeadRoute, async (c) => {
	const { leadId } = c.req.valid("param");
	const access = await checkLeadAccess(c, leadId);
	if (!access.ok) return c.json(access.body, access.status);
	return c.json(toWire(access.lead), 200);
});

// ---------- patch :leadId ----------

const patchLeadRoute = createRoute({
	method: "patch",
	path: "/{leadId}",
	tags: ["Leads"],
	request: {
		params: z.object({ leadId: z.string() }),
		body: { content: { "application/json": { schema: UpdateLeadSchema } } },
	},
	responses: {
		200: {
			content: { "application/json": { schema: LeadSchema } },
			description: "Updated",
		},
		400: { content: { "application/json": { schema: ErrorSchema } }, description: "Invalid input" },
		401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthorized" },
		403: { content: { "application/json": { schema: ErrorSchema } }, description: "Forbidden" },
		404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
	},
});

leadsApp.openapi(patchLeadRoute, async (c) => {
	const { leadId } = c.req.valid("param");
	const patch = c.req.valid("json");
	const access = await checkLeadAccess(c, leadId);
	if (!access.ok) return c.json(access.body, access.status);

	const prisma = getPrisma(c.env.DATABASE_URL);
	const updated = await prisma.lead.update({
		where: { id: leadId },
		data: patch,
	});
	return c.json(toWire(updated), 200);
});

// ---------- delete :leadId ----------

const deleteLeadRoute = createRoute({
	method: "delete",
	path: "/{leadId}",
	tags: ["Leads"],
	request: { params: z.object({ leadId: z.string() }) },
	responses: {
		200: { content: { "application/json": { schema: SuccessSchema } }, description: "Deleted" },
		401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthorized" },
		403: { content: { "application/json": { schema: ErrorSchema } }, description: "Forbidden" },
		404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
	},
});

leadsApp.openapi(deleteLeadRoute, async (c) => {
	const { leadId } = c.req.valid("param");
	const access = await checkLeadAccess(c, leadId);
	if (!access.ok) return c.json(access.body, access.status);

	const prisma = getPrisma(c.env.DATABASE_URL);
	await prisma.lead.delete({ where: { id: leadId } });
	return c.json({ success: true as const }, 200);
});

// ---------- helpers ----------

// biome-ignore lint/suspicious/noExplicitAny: shared inline guard across three OpenAPIHono routes whose Context types are distinct generics
async function checkLeadAccess(c: any, leadId: string) {
	const user = c.get("user") as { id: string };
	const prisma = getPrisma(c.env.DATABASE_URL);

	const lead = await prisma.lead.findUnique({ where: { id: leadId } });
	if (!lead) {
		return { ok: false as const, status: 404 as const, body: { error: "Lead not found" } };
	}
	const membership = await prisma.membership.findUnique({
		where: {
			organizationId_userId: {
				organizationId: lead.organizationId,
				userId: user.id,
			},
		},
		select: { id: true },
	});
	if (!membership) {
		return { ok: false as const, status: 403 as const, body: { error: "Forbidden" } };
	}
	return { ok: true as const, lead };
}

function toWire(l: {
	id: string;
	organizationId: string;
	agentId: string;
	email: string | null;
	phone: string | null;
	name: string | null;
	customFields: unknown;
	createdAt: Date;
	updatedAt: Date;
}) {
	return {
		id: l.id,
		organizationId: l.organizationId,
		agentId: l.agentId,
		email: l.email,
		phone: l.phone,
		name: l.name,
		customFields: (l.customFields as Record<string, unknown>) ?? {},
		createdAt: l.createdAt.toISOString(),
		updatedAt: l.updatedAt.toISOString(),
	};
}
