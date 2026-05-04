import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AuthUser } from "../middleware/auth";
import { getPrisma } from "../lib/prisma";
import type { AppEnv } from "../types";
import { agentVisitorsApp, visitorsApp } from "./visitors";

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
	app.route("/agents/:agentId/visitors", agentVisitorsApp);
	app.route("/visitors", visitorsApp);
	return app;
}

const tag = `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let owner: AuthUser;
let outsider: AuthUser;
let orgId: string;
let agentId: string;
let visitorId: string;

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
	const visitor = await prisma.visitor.create({
		data: {
			organizationId: orgId,
			agentId,
			externalId: `ext-${tag}`,
			userAgent: "Mozilla/5.0 (test)",
		},
	});
	visitorId = visitor.id;
});

afterAll(async () => {
	await prisma.organization
		.deleteMany({ where: { slug: { startsWith: `org-${tag}` } } })
		.catch(() => {});
	await prisma.user
		.deleteMany({ where: { id: { startsWith: tag } } })
		.catch(() => {});
});

describe("GET /agents/:agentId/visitors", () => {
	it("lists for a member", async () => {
		const res = await makeApp(owner).request(
			`/agents/${agentId}/visitors`,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<{ id: string }>;
		expect(body.some((v) => v.id === visitorId)).toBe(true);
	});

	it("returns 403 for outsider", async () => {
		const res = await makeApp(outsider).request(
			`/agents/${agentId}/visitors`,
		);
		expect(res.status).toBe(403);
	});

	it("respects ?limit", async () => {
		const res = await makeApp(owner).request(
			`/agents/${agentId}/visitors?limit=1`,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as unknown[];
		expect(body.length).toBeLessThanOrEqual(1);
	});
});

describe("GET /visitors/:visitorId", () => {
	it("returns the visitor for a member", async () => {
		const res = await makeApp(owner).request(`/visitors/${visitorId}`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { id: string; userAgent: string };
		expect(body.id).toBe(visitorId);
		expect(body.userAgent).toBe("Mozilla/5.0 (test)");
	});

	it("returns 404 for unknown id", async () => {
		const res = await makeApp(owner).request("/visitors/does-not-exist");
		expect(res.status).toBe(404);
	});

	it("returns 403 for outsider", async () => {
		const res = await makeApp(outsider).request(`/visitors/${visitorId}`);
		expect(res.status).toBe(403);
	});

	it("returns 401 with no user", async () => {
		const res = await makeApp(null).request(`/visitors/${visitorId}`);
		expect(res.status).toBe(401);
	});
});

function mkUser(id: string): AuthUser {
	return { id, name: id, email: `${id}@test.local`, image: null };
}
