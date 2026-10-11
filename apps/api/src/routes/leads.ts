// Lead routes for the dashboard. CREATE happens implicitly through the
// agent's capture_contact tool — no public POST. Read / update / delete
// only.

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
	ErrorSchema,
	LeadSchema,
	SuccessSchema,
	UpdateLeadSchema,
	LeadIntent,
} from "@leadly/schemas";
import { getPrisma } from "../lib/prisma";
import { parseKeyFacts, patchLeadCustomFields } from "../services/lead-capture";
import { requireAgentAccess, requireOrgMember } from "../middleware/org";
import type { AppEnv } from "../types";

export const agentLeadsApp = new OpenAPIHono<AppEnv>();
export const leadsApp = new OpenAPIHono<AppEnv>();
export const orgLeadsApp = new OpenAPIHono<AppEnv>();

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
	const leads = await listLeads(c.env.DATABASE_URL, { agentId }, c.req.valid("query"));
	return c.json(leads, 200);
});

// ---------- list (org-wide, optional agent filter) ----------

const listOrgLeadsRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Leads"],
	request: {
		params: z.object({ orgId: z.string() }),
		query: z.object({
			agentId: z.string().optional(),
			limit: z.coerce.number().int().min(1).max(100).default(50),
			search: z.string().optional(),
		}),
	},
	middleware: [requireOrgMember] as const,
	responses: {
		200: {
			content: { "application/json": { schema: z.array(LeadSchema) } },
			description: "Leads across the org's agents (newest first)",
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

orgLeadsApp.openapi(listOrgLeadsRoute, async (c) => {
	const { orgId } = c.req.valid("param");
	const { agentId, ...opts } = c.req.valid("query");
	// organizationId stays in the filter even when agentId is set, so an
	// agentId from another org simply matches nothing.
	const leads = await listLeads(
		c.env.DATABASE_URL,
		{ organizationId: orgId, ...(agentId ? { agentId } : {}) },
		opts,
	);
	return c.json(leads, 200);
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
	const { customFields, ...fields } = patch;
	if (customFields) await patchLeadCustomFields(prisma, leadId, customFields);
	const updated = await prisma.lead.update({
		where: { id: leadId },
		data: fields,
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

type LeadScope = { agentId: string } | { organizationId: string; agentId?: string };

async function listLeads(
	databaseUrl: string,
	scope: LeadScope,
	{ limit, search }: { limit: number; search?: string },
) {
	const prisma = getPrisma(databaseUrl);

	// `search` matches email / phone / name with case-insensitive contains.
	// Postgres handles ILIKE well; v1 orgs never blow past hundreds of
	// leads, so a scan within the scope is fine.
	const where = search
		? {
				...scope,
				OR: [
					{ email: { contains: search, mode: "insensitive" as const } },
					{ phone: { contains: search } },
					{ name: { contains: search, mode: "insensitive" as const } },
				],
			}
		: scope;

	const leads = await prisma.lead.findMany({
		where,
		orderBy: { createdAt: "desc" },
		take: limit,
	});
	return leads.map(toWire);
}

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
	intent: string | null;
	score: number | null;
	need: string | null;
	keyFacts: unknown;
	createdAt: Date;
	updatedAt: Date;
}) {
	const intent = LeadIntent.safeParse(l.intent);
	return {
		id: l.id,
		organizationId: l.organizationId,
		agentId: l.agentId,
		email: l.email,
		phone: l.phone,
		name: l.name,
		customFields: (l.customFields as Record<string, unknown>) ?? {},
		intent: intent.success ? intent.data : null,
		score: l.score,
		need: l.need,
		keyFacts: parseKeyFacts(l.keyFacts),
		createdAt: l.createdAt.toISOString(),
		updatedAt: l.updatedAt.toISOString(),
	};
}
