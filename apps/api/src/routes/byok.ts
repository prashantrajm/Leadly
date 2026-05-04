// BYOK credential routes. The plaintext API key flows in on a single POST
// and is encrypted before any DB write. Every other read returns only the
// "public" view (id, provider, label, maskedSuffix, isDefault, timestamps).
// There is no GET /credentials/:id/secret endpoint, ever.

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
	CreateLlmCredentialSchema,
	ErrorSchema,
	OrgLlmCredentialPublicSchema,
	SetAgentCredentialOverrideSchema,
	SuccessSchema,
} from "@leadly/schemas";
import { encryptForOrg, maskedSuffixOf } from "../lib/crypto";
import { getPrisma } from "../lib/prisma";
import { requireAgentAccess, requireOrgAdmin, requireOrgMember } from "../middleware/org";
import type { AppEnv } from "../types";

export const byokOrgApp = new OpenAPIHono<AppEnv>();
export const byokAgentApp = new OpenAPIHono<AppEnv>();

// ---------- POST /orgs/:orgId/credentials ----------

const createRouteSpec = createRoute({
	method: "post",
	path: "/",
	tags: ["BYOK"],
	request: {
		params: z.object({ orgId: z.string() }),
		body: { content: { "application/json": { schema: CreateLlmCredentialSchema } } },
	},
	middleware: [requireOrgAdmin] as const,
	responses: {
		201: {
			content: { "application/json": { schema: OrgLlmCredentialPublicSchema } },
			description: "Stored",
		},
		400: { content: { "application/json": { schema: ErrorSchema } }, description: "Invalid input" },
		401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthorized" },
		403: { content: { "application/json": { schema: ErrorSchema } }, description: "Forbidden" },
	},
});

byokOrgApp.openapi(createRouteSpec, async (c) => {
	const { orgId } = c.req.valid("param");
	const { provider, label, apiKey, isDefault } = c.req.valid("json");

	// Encrypt before any DB call. If anything throws downstream we'd rather
	// fail before the plaintext can land in any logging path that might
	// capture the request body.
	const blob = await encryptForOrg(c.env, orgId, apiKey);
	const suffix = maskedSuffixOf(apiKey);

	const prisma = getPrisma(c.env.DATABASE_URL);
	const created = await prisma.$transaction(async (tx) => {
		// If isDefault, demote any other default for the same provider so the
		// "exactly one default per provider per org" invariant holds.
		if (isDefault) {
			await tx.orgLlmCredential.updateMany({
				where: { organizationId: orgId, provider, isDefault: true },
				data: { isDefault: false },
			});
		}
		return tx.orgLlmCredential.create({
			data: {
				organizationId: orgId,
				provider,
				label,
				ciphertext: blob.ciphertext,
				iv: blob.iv,
				tag: blob.tag,
				maskedSuffix: suffix,
				isDefault: isDefault ?? false,
			},
		});
	});

	return c.json(toWire(created), 201);
});

// ---------- GET /orgs/:orgId/credentials ----------

const listRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["BYOK"],
	request: { params: z.object({ orgId: z.string() }) },
	middleware: [requireOrgMember] as const,
	responses: {
		200: {
			content: {
				"application/json": { schema: z.array(OrgLlmCredentialPublicSchema) },
			},
			description: "Public credential list (no plaintext)",
		},
		401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthorized" },
		403: { content: { "application/json": { schema: ErrorSchema } }, description: "Forbidden" },
	},
});

byokOrgApp.openapi(listRoute, async (c) => {
	const { orgId } = c.req.valid("param");
	const prisma = getPrisma(c.env.DATABASE_URL);
	const rows = await prisma.orgLlmCredential.findMany({
		where: { organizationId: orgId },
		orderBy: [{ provider: "asc" }, { createdAt: "asc" }],
	});
	return c.json(rows.map(toWire), 200);
});

// ---------- DELETE /orgs/:orgId/credentials/:id ----------

const deleteRoute = createRoute({
	method: "delete",
	path: "/{credentialId}",
	tags: ["BYOK"],
	request: {
		params: z.object({ orgId: z.string(), credentialId: z.string() }),
	},
	middleware: [requireOrgAdmin] as const,
	responses: {
		200: { content: { "application/json": { schema: SuccessSchema } }, description: "Deleted" },
		401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthorized" },
		403: { content: { "application/json": { schema: ErrorSchema } }, description: "Forbidden" },
		404: { content: { "application/json": { schema: ErrorSchema } }, description: "Not found" },
	},
});

byokOrgApp.openapi(deleteRoute, async (c) => {
	const { orgId, credentialId } = c.req.valid("param");
	const prisma = getPrisma(c.env.DATABASE_URL);

	// Verify the credential actually belongs to this org before deleting —
	// org-admin gates the route by orgId, but a request with a wrong-org
	// credentialId should 404 not silently no-op.
	const cred = await prisma.orgLlmCredential.findUnique({
		where: { id: credentialId },
	});
	if (!cred || cred.organizationId !== orgId) {
		return c.json({ error: "Credential not found" }, 404);
	}

	// Delete cascades to AgentLlmOverride rows referencing this credential —
	// the schema's onDelete: Cascade handles it.
	await prisma.orgLlmCredential.delete({ where: { id: credentialId } });
	return c.json({ success: true as const }, 200);
});

// ---------- POST /agents/:agentId/credential-override ----------

const setOverrideRoute = createRoute({
	method: "post",
	path: "/credential-override",
	tags: ["BYOK"],
	request: {
		params: z.object({ agentId: z.string() }),
		body: {
			content: { "application/json": { schema: SetAgentCredentialOverrideSchema } },
		},
	},
	middleware: [requireAgentAccess] as const,
	responses: {
		200: { content: { "application/json": { schema: SuccessSchema } }, description: "Override set" },
		401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthorized" },
		403: { content: { "application/json": { schema: ErrorSchema } }, description: "Forbidden" },
		404: { content: { "application/json": { schema: ErrorSchema } }, description: "Credential not found" },
	},
});

byokAgentApp.openapi(setOverrideRoute, async (c) => {
	const { agentId } = c.req.valid("param");
	const { credentialId } = c.req.valid("json");
	const agent = c.get("agent");
	const prisma = getPrisma(c.env.DATABASE_URL);

	// The credential must belong to the same org as the agent — cross-org
	// override is the kind of bug that quietly burns the wrong customer's
	// API budget if we don't guard against it here.
	const cred = await prisma.orgLlmCredential.findUnique({
		where: { id: credentialId },
	});
	if (!cred || cred.organizationId !== agent.organizationId) {
		return c.json({ error: "Credential not found in this org" }, 404);
	}

	await prisma.agentLlmOverride.upsert({
		where: { agentId },
		create: { agentId, credentialId },
		update: { credentialId },
	});
	return c.json({ success: true as const }, 200);
});

// ---------- DELETE /agents/:agentId/credential-override ----------

const clearOverrideRoute = createRoute({
	method: "delete",
	path: "/credential-override",
	tags: ["BYOK"],
	request: { params: z.object({ agentId: z.string() }) },
	middleware: [requireAgentAccess] as const,
	responses: {
		200: { content: { "application/json": { schema: SuccessSchema } }, description: "Cleared" },
		401: { content: { "application/json": { schema: ErrorSchema } }, description: "Unauthorized" },
		403: { content: { "application/json": { schema: ErrorSchema } }, description: "Forbidden" },
	},
});

byokAgentApp.openapi(clearOverrideRoute, async (c) => {
	const { agentId } = c.req.valid("param");
	const prisma = getPrisma(c.env.DATABASE_URL);
	// deleteMany so a no-op (override never existed) returns 200 cleanly
	// instead of throwing a P2025.
	await prisma.agentLlmOverride.deleteMany({ where: { agentId } });
	return c.json({ success: true as const }, 200);
});

// ---------- helpers ----------

function toWire(c: {
	id: string;
	organizationId: string;
	provider:
		| "openai"
		| "anthropic"
		| "google"
		| "mistral"
		| "groq"
		| "openrouter"
		| "other";
	label: string;
	maskedSuffix: string;
	isDefault: boolean;
	createdAt: Date;
	updatedAt: Date;
}) {
	return {
		id: c.id,
		organizationId: c.organizationId,
		provider: c.provider,
		label: c.label,
		maskedSuffix: c.maskedSuffix,
		isDefault: c.isDefault,
		createdAt: c.createdAt.toISOString(),
		updatedAt: c.updatedAt.toISOString(),
	};
}
