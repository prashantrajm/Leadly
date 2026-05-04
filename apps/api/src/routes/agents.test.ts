import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AuthUser } from "../middleware/auth";
import { getPrisma } from "../lib/prisma";
import type { AppEnv } from "../types";
import { agentsApp, orgAgentsApp } from "./agents";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const prisma = getPrisma(DATABASE_URL);

function makeApp(user: AuthUser | null) {
	const app = new OpenAPIHono<AppEnv>();
	app.use("*", async (c, next) => {
		// biome-ignore lint/suspicious/noExplicitAny: shoehorning a partial env for the test
		(c as any).env = { DATABASE_URL };
		if (user) c.set("user", user);
		else return c.json({ error: "Unauthorized" }, 401);
		return next();
	});
	app.route("/orgs/:orgId/agents", orgAgentsApp);
	app.route("/agents", agentsApp);
	return app;
}

const tag = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let owner: AuthUser;
let outsider: AuthUser;
let orgId: string;
let agentId: string;

beforeAll(async () => {
	for (const role of ["owner", "outsider"]) {
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
	outsider = mkUser(`${tag}-outsider`);

	const org = await prisma.organization.create({
		data: {
			name: `Org ${tag}`,
			slug: `org-${tag}`,
			memberships: { create: { userId: owner.id, role: "owner" } },
		},
	});
	orgId = org.id;

	const agent = await prisma.agent.create({
		data: {
			organizationId: orgId,
			name: `Seed Agent ${tag}`,
			slug: `seed-agent-${tag}`,
		},
	});
	agentId = agent.id;
});

afterAll(async () => {
	await prisma.organization
		.deleteMany({ where: { slug: { startsWith: `org-${tag}` } } })
		.catch(() => {});
	await prisma.user
		.deleteMany({ where: { id: { startsWith: tag } } })
		.catch(() => {});
});

// ---------- list ----------

describe("GET /orgs/:orgId/agents", () => {
	it("returns agents for a member", async () => {
		const res = await makeApp(owner).request(`/orgs/${orgId}/agents`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<{ id: string }>;
		expect(body.some((a) => a.id === agentId)).toBe(true);
	});

	it("returns 403 for outsider", async () => {
		const res = await makeApp(outsider).request(`/orgs/${orgId}/agents`);
		expect(res.status).toBe(403);
	});
});

// ---------- create ----------

describe("POST /orgs/:orgId/agents", () => {
	it("creates an agent and slugifies the name", async () => {
		const res = await makeApp(owner).request(`/orgs/${orgId}/agents`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: `Acme Support ${tag}` }),
		});
		expect(res.status).toBe(201);
		const body = (await res.json()) as { id: string; slug: string };
		expect(body.slug).toMatch(new RegExp(`^acme-support-`));
	});

	it("rejects too-short name with 400", async () => {
		const res = await makeApp(owner).request(`/orgs/${orgId}/agents`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: "x" }),
		});
		expect(res.status).toBe(400);
	});

	it("rejects bad accentColor with 400", async () => {
		const res = await makeApp(owner).request(`/orgs/${orgId}/agents`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: `Coloured ${tag}`, accentColor: "blue" }),
		});
		expect(res.status).toBe(400);
	});

	it("returns 403 for outsider", async () => {
		const res = await makeApp(outsider).request(`/orgs/${orgId}/agents`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: `Hacked ${tag}` }),
		});
		expect(res.status).toBe(403);
	});
});

// ---------- get / patch / delete ----------

describe("GET /agents/:agentId", () => {
	it("returns the agent for a member", async () => {
		const res = await makeApp(owner).request(`/agents/${agentId}`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { id: string };
		expect(body.id).toBe(agentId);
	});

	it("returns 403 for outsider", async () => {
		const res = await makeApp(outsider).request(`/agents/${agentId}`);
		expect(res.status).toBe(403);
	});

	it("returns 404 for unknown agent id", async () => {
		const res = await makeApp(owner).request(`/agents/does-not-exist`);
		expect(res.status).toBe(404);
	});
});

describe("PATCH /agents/:agentId", () => {
	it("updates greeting and maxTurns", async () => {
		const res = await makeApp(owner).request(`/agents/${agentId}`, {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ greeting: "Welcome!", maxTurns: 100 }),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { greeting: string; maxTurns: number };
		expect(body.greeting).toBe("Welcome!");
		expect(body.maxTurns).toBe(100);
	});

	it("rejects invalid slug regex", async () => {
		const res = await makeApp(owner).request(`/agents/${agentId}`, {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ slug: "Bad Slug" }),
		});
		expect(res.status).toBe(400);
	});

	it("returns 403 for outsider", async () => {
		const res = await makeApp(outsider).request(`/agents/${agentId}`, {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ greeting: "Hacked" }),
		});
		expect(res.status).toBe(403);
	});
});

describe("DELETE /agents/:agentId", () => {
	it("deletes when caller is a member", async () => {
		// Create a throwaway agent so the rest of the suite still has agentId.
		const tmp = await prisma.agent.create({
			data: {
				organizationId: orgId,
				name: `Tmp ${tag}`,
				slug: `tmp-${tag}-${Math.random().toString(36).slice(2, 6)}`,
			},
		});
		const res = await makeApp(owner).request(`/agents/${tmp.id}`, {
			method: "DELETE",
		});
		expect(res.status).toBe(200);
		const after = await prisma.agent.findUnique({ where: { id: tmp.id } });
		expect(after).toBeNull();
	});

	it("returns 403 for outsider", async () => {
		const res = await makeApp(outsider).request(`/agents/${agentId}`, {
			method: "DELETE",
		});
		expect(res.status).toBe(403);
	});
});

function mkUser(id: string): AuthUser {
	return { id, name: id, email: `${id}@test.local`, image: null };
}
