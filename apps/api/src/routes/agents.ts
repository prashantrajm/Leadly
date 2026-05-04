import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
	AgentSchema,
	CreateAgentSchema,
	ErrorSchema,
	SuccessSchema,
	UpdateAgentSchema,
} from "@leadly/schemas";
import { slugify } from "@leadly/utils";
import { requireAgentAccess, requireOrgMember } from "../middleware/org";
import { getPrisma } from "../lib/prisma";
import type { AppEnv } from "../types";

// Two routers — under /orgs/:orgId/agents (create + list) and /agents/:agentId
// (get + patch + delete). Both mount under the authed parent in routes/index.ts.

export const orgAgentsApp = new OpenAPIHono<AppEnv>();
export const agentsApp = new OpenAPIHono<AppEnv>();

// ---------- list (per-org) ----------

const listAgentsRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Agents"],
	request: { params: z.object({ orgId: z.string() }) },
	middleware: [requireOrgMember] as const,
	responses: {
		200: {
			content: { "application/json": { schema: z.array(AgentSchema) } },
			description: "Agents in the org",
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

orgAgentsApp.openapi(listAgentsRoute, async (c) => {
	const { orgId } = c.req.valid("param");
	const prisma = getPrisma(c.env.DATABASE_URL);
	const agents = await prisma.agent.findMany({
		where: { organizationId: orgId },
		orderBy: { createdAt: "asc" },
	});
	return c.json(agents.map(toWire), 200);
});

// ---------- create (per-org) ----------

const createAgentRoute = createRoute({
	method: "post",
	path: "/",
	tags: ["Agents"],
	request: {
		params: z.object({ orgId: z.string() }),
		body: { content: { "application/json": { schema: CreateAgentSchema } } },
	},
	middleware: [requireOrgMember] as const,
	responses: {
		201: {
			content: { "application/json": { schema: AgentSchema } },
			description: "Created",
		},
		400: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Invalid input",
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

orgAgentsApp.openapi(createAgentRoute, async (c) => {
	const { orgId } = c.req.valid("param");
	const input = c.req.valid("json");
	const prisma = getPrisma(c.env.DATABASE_URL);

	const slug = await pickAvailableAgentSlug(
		prisma,
		orgId,
		slugify(input.name) || "agent",
	);

	const agent = await prisma.agent.create({
		data: {
			organizationId: orgId,
			name: input.name,
			slug,
			...(input.greeting !== undefined && { greeting: input.greeting }),
			...(input.accentColor !== undefined && { accentColor: input.accentColor }),
			...(input.identityPolicy !== undefined && {
				identityPolicy: input.identityPolicy,
			}),
			...(input.defaultProvider !== undefined && {
				defaultProvider: input.defaultProvider,
			}),
			...(input.defaultModel !== undefined && {
				defaultModel: input.defaultModel,
			}),
			...(input.systemPromptOverlay !== undefined && {
				systemPromptOverlay: input.systemPromptOverlay,
			}),
			...(input.fallbackMessage !== undefined && {
				fallbackMessage: input.fallbackMessage,
			}),
			...(input.maxTurns !== undefined && { maxTurns: input.maxTurns }),
		},
	});

	return c.json(toWire(agent), 201);
});

// ---------- get :agentId ----------

const getAgentRoute = createRoute({
	method: "get",
	path: "/{agentId}",
	tags: ["Agents"],
	request: { params: z.object({ agentId: z.string() }) },
	middleware: [requireAgentAccess] as const,
	responses: {
		200: {
			content: { "application/json": { schema: AgentSchema } },
			description: "Agent",
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

agentsApp.openapi(getAgentRoute, async (c) => {
	const { agentId } = c.req.valid("param");
	const prisma = getPrisma(c.env.DATABASE_URL);
	// requireAgentAccess already loaded the basic agent, but we want the full
	// row here. Cheap re-query.
	const agent = await prisma.agent.findUnique({ where: { id: agentId } });
	if (!agent) return c.json({ error: "Agent not found" }, 404);
	return c.json(toWire(agent), 200);
});

// ---------- patch :agentId ----------

const patchAgentRoute = createRoute({
	method: "patch",
	path: "/{agentId}",
	tags: ["Agents"],
	request: {
		params: z.object({ agentId: z.string() }),
		body: { content: { "application/json": { schema: UpdateAgentSchema } } },
	},
	middleware: [requireAgentAccess] as const,
	responses: {
		200: {
			content: { "application/json": { schema: AgentSchema } },
			description: "Updated",
		},
		400: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Invalid input",
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

agentsApp.openapi(patchAgentRoute, async (c) => {
	const { agentId } = c.req.valid("param");
	const patch = c.req.valid("json");
	const prisma = getPrisma(c.env.DATABASE_URL);
	const updated = await prisma.agent.update({
		where: { id: agentId },
		data: patch,
	});
	return c.json(toWire(updated), 200);
});

// ---------- delete :agentId ----------

const deleteAgentRoute = createRoute({
	method: "delete",
	path: "/{agentId}",
	tags: ["Agents"],
	request: { params: z.object({ agentId: z.string() }) },
	middleware: [requireAgentAccess] as const,
	responses: {
		200: {
			content: { "application/json": { schema: SuccessSchema } },
			description: "Deleted",
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

agentsApp.openapi(deleteAgentRoute, async (c) => {
	const { agentId } = c.req.valid("param");
	const prisma = getPrisma(c.env.DATABASE_URL);
	await prisma.agent.delete({ where: { id: agentId } });
	return c.json({ success: true as const }, 200);
});

// ---------- helpers ----------

function toWire(a: {
	id: string;
	organizationId: string;
	name: string;
	slug: string;
	greeting: string;
	accentColor: string;
	identityPolicy: "optional" | "required_before_chat" | "identified_only";
	defaultProvider:
		| "openai"
		| "anthropic"
		| "google"
		| "mistral"
		| "groq"
		| "openrouter"
		| "other";
	defaultModel: string;
	systemPromptOverlay: string | null;
	fallbackMessage: string;
	maxTurns: number;
	createdAt: Date;
	updatedAt: Date;
}) {
	return {
		id: a.id,
		organizationId: a.organizationId,
		name: a.name,
		slug: a.slug,
		greeting: a.greeting,
		accentColor: a.accentColor,
		identityPolicy: a.identityPolicy,
		defaultProvider: a.defaultProvider,
		defaultModel: a.defaultModel,
		systemPromptOverlay: a.systemPromptOverlay,
		fallbackMessage: a.fallbackMessage,
		maxTurns: a.maxTurns,
		createdAt: a.createdAt.toISOString(),
		updatedAt: a.updatedAt.toISOString(),
	};
}

async function pickAvailableAgentSlug(
	prisma: ReturnType<typeof getPrisma>,
	organizationId: string,
	base: string,
) {
	const existing = await prisma.agent.findUnique({
		where: { organizationId_slug: { organizationId, slug: base } },
		select: { id: true },
	});
	if (!existing) return base;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `${base}-${suffix}`;
}
