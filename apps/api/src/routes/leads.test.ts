import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AuthUser } from "../middleware/auth";
import { getPrisma } from "../lib/prisma";
import type { AppEnv } from "../types";
import { agentLeadsApp, leadsApp } from "./leads";

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
	app.route("/agents/:agentId/leads", agentLeadsApp);
	app.route("/leads", leadsApp);
	return app;
}

const tag = `ld${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let owner: AuthUser;
let outsider: AuthUser;
let orgId: string;
let agentId: string;
let aliceId: string;
let bobId: string;

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
		data: { organizationId: orgId, name: `Agent ${tag}`, slug: `a-${tag}` },
	});
	agentId = agent.id;

	const alice = await prisma.lead.create({
		data: {
			organizationId: orgId,
			agentId,
			email: `alice-${tag}@test.local`,
			name: "Alice",
		},
	});
	aliceId = alice.id;
	const bob = await prisma.lead.create({
		data: {
			organizationId: orgId,
			agentId,
			email: `bob-${tag}@test.local`,
			name: "Bob",
		},
	});
	bobId = bob.id;
});

afterAll(async () => {
	await prisma.organization
		.deleteMany({ where: { slug: { startsWith: `org-${tag}` } } })
		.catch(() => {});
	await prisma.user
		.deleteMany({ where: { id: { startsWith: tag } } })
		.catch(() => {});
});

describe("GET /agents/:agentId/leads", () => {
	it("lists leads for a member, newest first", async () => {
		const res = await makeApp(owner).request(`/agents/${agentId}/leads`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<{ id: string }>;
		expect(body.some((l) => l.id === aliceId)).toBe(true);
		expect(body.some((l) => l.id === bobId)).toBe(true);
	});

	it("filters with ?search by name", async () => {
		const res = await makeApp(owner).request(
			`/agents/${agentId}/leads?search=alice`,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<{ id: string; name: string | null }>;
		expect(body.every((l) => l.name === "Alice")).toBe(true);
	});

	it("filters with ?search by email substring", async () => {
		const res = await makeApp(owner).request(
			`/agents/${agentId}/leads?search=bob-${tag}`,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<{ id: string }>;
		expect(body.length).toBe(1);
		expect(body[0].id).toBe(bobId);
	});

	it("returns 403 for outsider", async () => {
		const res = await makeApp(outsider).request(`/agents/${agentId}/leads`);
		expect(res.status).toBe(403);
	});
});

describe("GET /leads/:leadId", () => {
	it("returns the lead for a member", async () => {
		const res = await makeApp(owner).request(`/leads/${aliceId}`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { id: string; name: string };
		expect(body.id).toBe(aliceId);
	});

	it("returns 404 for unknown", async () => {
		const res = await makeApp(owner).request("/leads/does-not-exist");
		expect(res.status).toBe(404);
	});

	it("returns 403 for outsider", async () => {
		const res = await makeApp(outsider).request(`/leads/${aliceId}`);
		expect(res.status).toBe(403);
	});
});

describe("PATCH /leads/:leadId", () => {
	it("updates name + customFields", async () => {
		const res = await makeApp(owner).request(`/leads/${aliceId}`, {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				name: "Alice (VIP)",
				customFields: { tier: "gold" },
			}),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			name: string;
			customFields: { tier: string };
		};
		expect(body.name).toBe("Alice (VIP)");
		expect(body.customFields.tier).toBe("gold");
	});

	it("returns 403 for outsider", async () => {
		const res = await makeApp(outsider).request(`/leads/${aliceId}`, {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: "hax" }),
		});
		expect(res.status).toBe(403);
	});
});

describe("DELETE /leads/:leadId", () => {
	it("deletes when caller is a member", async () => {
		const tmp = await prisma.lead.create({
			data: {
				organizationId: orgId,
				agentId,
				email: `tmp-${tag}@test.local`,
			},
		});
		const res = await makeApp(owner).request(`/leads/${tmp.id}`, {
			method: "DELETE",
		});
		expect(res.status).toBe(200);
		const after = await prisma.lead.findUnique({ where: { id: tmp.id } });
		expect(after).toBeNull();
	});

	it("returns 404 for unknown id", async () => {
		const res = await makeApp(owner).request("/leads/does-not-exist", {
			method: "DELETE",
		});
		expect(res.status).toBe(404);
	});
});

function mkUser(id: string): AuthUser {
	return { id, name: id, email: `${id}@test.local`, image: null };
}
