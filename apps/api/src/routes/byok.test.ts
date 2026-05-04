// BYOK route tests against the dev DB. Validates the contract:
//   • plaintext apiKey never appears in any response
//   • only the org's admins can create/delete credentials
//   • cross-org credential reuse is blocked at the override route
//   • duplicates with isDefault=true demote the previous default

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AuthUser } from "../middleware/auth";
import { decryptForOrg } from "../lib/crypto";
import { getPrisma } from "../lib/prisma";
import type { AppEnv } from "../types";
import { byokAgentApp, byokOrgApp } from "./byok";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");
const prisma = getPrisma(DATABASE_URL);

// Real 32-byte base64 key for tests. Different from any production value.
const TEST_ROOT = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

function makeApp(user: AuthUser | null) {
	const app = new OpenAPIHono<AppEnv>();
	app.use("*", async (c, next) => {
		// biome-ignore lint/suspicious/noExplicitAny: shoehorning a partial env for the test
		(c as any).env = {
			DATABASE_URL,
			SECRETS_ENCRYPTION_KEY: TEST_ROOT,
		};
		if (user) c.set("user", user);
		else return c.json({ error: "Unauthorized" }, 401);
		return next();
	});
	app.route("/orgs/:orgId/credentials", byokOrgApp);
	app.route("/agents/:agentId", byokAgentApp);
	return app;
}

const tag = `byok${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let owner: AuthUser;
let member: AuthUser;
let outsider: AuthUser;
let orgId: string;
let otherOrgId: string;
let agentId: string;

beforeAll(async () => {
	for (const role of ["owner", "member", "outsider"]) {
		const id = `${tag}-${role}`;
		await prisma.user.create({
			data: {
				id,
				name: id,
				email: `${id}@test.local`,
				emailVerified: true,
			},
		});
	}
	owner = mkUser(`${tag}-owner`);
	member = mkUser(`${tag}-member`);
	outsider = mkUser(`${tag}-outsider`);

	const org = await prisma.organization.create({
		data: {
			name: `Org ${tag}`,
			slug: `org-${tag}`,
			memberships: {
				create: [
					{ userId: owner.id, role: "owner" },
					{ userId: member.id, role: "member" },
				],
			},
		},
	});
	orgId = org.id;
	const other = await prisma.organization.create({
		data: {
			name: `Other ${tag}`,
			slug: `org-other-${tag}`,
			memberships: { create: { userId: outsider.id, role: "owner" } },
		},
	});
	otherOrgId = other.id;
	const agent = await prisma.agent.create({
		data: { organizationId: orgId, name: `Agent ${tag}`, slug: `a-${tag}` },
	});
	agentId = agent.id;
	await prisma.agent.create({
		data: {
			organizationId: otherOrgId,
			name: `OAgent ${tag}`,
			slug: `oa-${tag}`,
		},
	});
});

afterAll(async () => {
	await prisma.organization
		.deleteMany({ where: { slug: { startsWith: `org-` }, name: { contains: tag } } })
		.catch(() => {});
	await prisma.user
		.deleteMany({ where: { id: { startsWith: tag } } })
		.catch(() => {});
});

// ---------- POST /orgs/:orgId/credentials ----------

describe("POST /orgs/:orgId/credentials", () => {
	it("encrypts the apiKey and returns ONLY the public view", async () => {
		const res = await makeApp(owner).request(
			`/orgs/${orgId}/credentials`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					provider: "openrouter",
					label: "Production",
					apiKey: "sk-or-secret-12345abcde",
				}),
			},
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as {
			id: string;
			provider: string;
			label: string;
			maskedSuffix: string;
			isDefault: boolean;
		};
		expect(body.maskedSuffix).toBe("bcde");
		expect(body.provider).toBe("openrouter");
		// The body must NOT carry plaintext, ciphertext, iv, or tag.
		const json = JSON.stringify(body);
		expect(json).not.toContain("sk-or-secret");
		expect(json).not.toContain("ciphertext");
		expect(json).not.toContain("iv");

		// And verify the stored ciphertext actually round-trips.
		const stored = await prisma.orgLlmCredential.findUnique({
			where: { id: body.id },
		});
		const decrypted = await decryptForOrg(
			{ SECRETS_ENCRYPTION_KEY: TEST_ROOT },
			orgId,
			{
				ciphertext: stored?.ciphertext as string,
				iv: stored?.iv as string,
				tag: stored?.tag as string,
			},
		);
		expect(decrypted).toBe("sk-or-secret-12345abcde");
	});

	it("returns 403 for a non-admin member", async () => {
		const res = await makeApp(member).request(
			`/orgs/${orgId}/credentials`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					provider: "openrouter",
					label: "x",
					apiKey: "sk-12345678",
				}),
			},
		);
		expect(res.status).toBe(403);
	});

	it("returns 401 with no user", async () => {
		const res = await makeApp(null).request(`/orgs/${orgId}/credentials`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				provider: "openrouter",
				label: "x",
				apiKey: "sk-12345678",
			}),
		});
		expect(res.status).toBe(401);
	});

	it("rejects too-short apiKey with 400", async () => {
		const res = await makeApp(owner).request(
			`/orgs/${orgId}/credentials`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					provider: "openrouter",
					label: "x",
					apiKey: "short",
				}),
			},
		);
		expect(res.status).toBe(400);
	});

	it("isDefault=true demotes the previous default for the same provider", async () => {
		// First default.
		const a = await makeApp(owner).request(
			`/orgs/${orgId}/credentials`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					provider: "openrouter",
					label: "First",
					apiKey: "sk-or-aaaaaaaa",
					isDefault: true,
				}),
			},
		);
		const aBody = (await a.json()) as { id: string };
		// Second default for same provider.
		const b = await makeApp(owner).request(
			`/orgs/${orgId}/credentials`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					provider: "openrouter",
					label: "Second",
					apiKey: "sk-or-bbbbbbbb",
					isDefault: true,
				}),
			},
		);
		expect(b.status).toBe(201);

		const stillDefault = await prisma.orgLlmCredential.findUnique({
			where: { id: aBody.id },
		});
		expect(stillDefault?.isDefault).toBe(false);
	});
});

// ---------- GET /orgs/:orgId/credentials ----------

describe("GET /orgs/:orgId/credentials", () => {
	it("lists credentials for a member, returning masked view only", async () => {
		const res = await makeApp(member).request(
			`/orgs/${orgId}/credentials`,
		);
		expect(res.status).toBe(200);
		const list = (await res.json()) as Array<{
			id: string;
			maskedSuffix: string;
		}>;
		expect(list.length).toBeGreaterThan(0);
		const json = JSON.stringify(list);
		expect(json).not.toContain("ciphertext");
		expect(json).not.toContain("sk-or-");
	});

	it("returns 403 for outsider", async () => {
		const res = await makeApp(outsider).request(
			`/orgs/${orgId}/credentials`,
		);
		expect(res.status).toBe(403);
	});
});

// ---------- DELETE ----------

describe("DELETE /orgs/:orgId/credentials/:id", () => {
	it("deletes when caller is admin", async () => {
		const created = await prisma.orgLlmCredential.create({
			data: {
				organizationId: orgId,
				provider: "openrouter",
				label: "Doomed",
				ciphertext: "x",
				iv: "y",
				tag: "z",
				maskedSuffix: "dddd",
			},
		});
		const res = await makeApp(owner).request(
			`/orgs/${orgId}/credentials/${created.id}`,
			{ method: "DELETE" },
		);
		expect(res.status).toBe(200);
		const after = await prisma.orgLlmCredential.findUnique({
			where: { id: created.id },
		});
		expect(after).toBeNull();
	});

	it("returns 404 for cross-org id", async () => {
		const otherCred = await prisma.orgLlmCredential.create({
			data: {
				organizationId: otherOrgId,
				provider: "openrouter",
				label: "OtherCred",
				ciphertext: "x",
				iv: "y",
				tag: "z",
				maskedSuffix: "oooo",
			},
		});
		// Try to delete the other org's cred via THIS org's URL.
		const res = await makeApp(owner).request(
			`/orgs/${orgId}/credentials/${otherCred.id}`,
			{ method: "DELETE" },
		);
		expect(res.status).toBe(404);

		// And the cred is still there.
		const after = await prisma.orgLlmCredential.findUnique({
			where: { id: otherCred.id },
		});
		expect(after).not.toBeNull();
	});

	it("returns 403 for non-admin member", async () => {
		const res = await makeApp(member).request(
			`/orgs/${orgId}/credentials/anything`,
			{ method: "DELETE" },
		);
		expect(res.status).toBe(403);
	});
});

// ---------- POST /agents/:agentId/credential-override ----------

describe("POST /agents/:agentId/credential-override", () => {
	it("sets the override when credential belongs to the agent's org", async () => {
		const cred = await prisma.orgLlmCredential.create({
			data: {
				organizationId: orgId,
				provider: "openrouter",
				label: "ForOverride",
				ciphertext: "x",
				iv: "y",
				tag: "z",
				maskedSuffix: "ovrd",
			},
		});
		const res = await makeApp(owner).request(
			`/agents/${agentId}/credential-override`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ credentialId: cred.id }),
			},
		);
		expect(res.status).toBe(200);
		const ovr = await prisma.agentLlmOverride.findUnique({ where: { agentId } });
		expect(ovr?.credentialId).toBe(cred.id);
	});

	it("rejects cross-org credential with 404", async () => {
		const otherCred = await prisma.orgLlmCredential.create({
			data: {
				organizationId: otherOrgId,
				provider: "openrouter",
				label: "OtherCred",
				ciphertext: "x",
				iv: "y",
				tag: "z",
				maskedSuffix: "xorg",
			},
		});
		const res = await makeApp(owner).request(
			`/agents/${agentId}/credential-override`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ credentialId: otherCred.id }),
			},
		);
		expect(res.status).toBe(404);
	});

	it("returns 403 for outsider on the agent's org", async () => {
		const res = await makeApp(outsider).request(
			`/agents/${agentId}/credential-override`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ credentialId: "anything" }),
			},
		);
		expect(res.status).toBe(403);
	});
});

describe("DELETE /agents/:agentId/credential-override", () => {
	it("clears the override (idempotent)", async () => {
		const res = await makeApp(owner).request(
			`/agents/${agentId}/credential-override`,
			{ method: "DELETE" },
		);
		expect(res.status).toBe(200);
		const ovr = await prisma.agentLlmOverride.findUnique({ where: { agentId } });
		expect(ovr).toBeNull();

		// Calling again must still 200.
		const res2 = await makeApp(owner).request(
			`/agents/${agentId}/credential-override`,
			{ method: "DELETE" },
		);
		expect(res2.status).toBe(200);
	});
});

function mkUser(id: string): AuthUser {
	return { id, name: id, email: `${id}@test.local`, image: null };
}
