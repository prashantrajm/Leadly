// Org-wide list endpoints that back the dashboard's top-level Inbox, Leads,
// Visitors and Analytics pages. Fixtures: org A with two agents, org B with
// one agent, so we can check that results span every agent in the org, that
// ?agentId narrows them, and that nothing leaks across orgs.

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AuthUser } from "../middleware/auth";
import { getPrisma } from "../lib/prisma";
import type { AppEnv } from "../types";
import { orgAnalyticsApp } from "./analytics";
import { orgConversationsApp } from "./conversations";
import { orgLeadsApp } from "./leads";
import { orgVisitorsApp } from "./visitors";

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
	app.route("/orgs/:orgId/conversations", orgConversationsApp);
	app.route("/orgs/:orgId/leads", orgLeadsApp);
	app.route("/orgs/:orgId/visitors", orgVisitorsApp);
	app.route("/orgs/:orgId/analytics", orgAnalyticsApp);
	return app;
}

const tag = `ol${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let owner: AuthUser;
let outsider: AuthUser;
let orgA: string;
let orgB: string;
let agentA1: string;
let agentA2: string;
let agentB1: string;

beforeAll(async () => {
	for (const role of ["owner", "outsider"]) {
		const id = `${tag}-${role}`;
		await prisma.user.create({
			data: { id, name: id, email: `${id}@test.local`, emailVerified: true },
		});
	}
	owner = mkUser(`${tag}-owner`);
	outsider = mkUser(`${tag}-outsider`);

	orgA = (
		await prisma.organization.create({
			data: {
				name: `Org A ${tag}`,
				slug: `org-${tag}-a`,
				memberships: { create: { userId: owner.id, role: "owner" } },
			},
		})
	).id;
	orgB = (
		await prisma.organization.create({
			data: {
				name: `Org B ${tag}`,
				slug: `org-${tag}-b`,
				memberships: { create: { userId: outsider.id, role: "owner" } },
			},
		})
	).id;

	agentA1 = await seedAgent(orgA, "a1", { paused: true });
	agentA2 = await seedAgent(orgA, "a2", { paused: false });
	agentB1 = await seedAgent(orgB, "b1", { paused: true });
});

afterAll(async () => {
	await prisma.organization
		.deleteMany({ where: { slug: { startsWith: `org-${tag}` } } })
		.catch(() => {});
	await prisma.user
		.deleteMany({ where: { id: { startsWith: tag } } })
		.catch(() => {});
});

// One agent with one visitor, one lead, and one active conversation that
// requested a handoff. `paused` controls whether the conversation is still
// waiting on a human.
async function seedAgent(
	organizationId: string,
	suffix: string,
	{ paused }: { paused: boolean },
) {
	const agent = await prisma.agent.create({
		data: { organizationId, name: `Agent ${suffix}`, slug: `${tag}-${suffix}` },
	});
	const visitor = await prisma.visitor.create({
		data: { organizationId, agentId: agent.id, externalId: `v-${tag}-${suffix}` },
	});
	const lead = await prisma.lead.create({
		data: {
			organizationId,
			agentId: agent.id,
			email: `${suffix}-${tag}@test.local`,
			name: `Lead ${suffix}`,
		},
	});
	const conv = await prisma.conversation.create({
		data: {
			organizationId,
			agentId: agent.id,
			visitorId: visitor.id,
			leadId: lead.id,
			mode: paused ? "paused" : "auto",
		},
	});
	await prisma.turn.createMany({
		data: [
			{ conversationId: conv.id, role: "user", text: "hi" },
			{ conversationId: conv.id, role: "tool", text: "", toolName: "request_handoff" },
		],
	});
	return agent.id;
}

describe("GET /orgs/:orgId/conversations", () => {
	it("lists conversations across every agent in the org", async () => {
		const res = await makeApp(owner).request(`/orgs/${orgA}/conversations`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { items: Array<{ agentId: string }> };
		expect(new Set(body.items.map((i) => i.agentId))).toEqual(
			new Set([agentA1, agentA2]),
		);
	});

	it("narrows to one agent with ?agentId", async () => {
		const res = await makeApp(owner).request(
			`/orgs/${orgA}/conversations?agentId=${agentA2}`,
		);
		const body = (await res.json()) as { items: Array<{ agentId: string }> };
		expect(body.items.map((i) => i.agentId)).toEqual([agentA2]);
	});

	it("returns nothing for an agentId that belongs to another org", async () => {
		const res = await makeApp(owner).request(
			`/orgs/${orgA}/conversations?agentId=${agentB1}`,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { items: unknown[] };
		expect(body.items).toEqual([]);
	});

	it("returns 403 for a non-member", async () => {
		const res = await makeApp(outsider).request(`/orgs/${orgA}/conversations`);
		expect(res.status).toBe(403);
	});

	it("returns 400 for a malformed cursor", async () => {
		const res = await makeApp(owner).request(
			`/orgs/${orgA}/conversations?cursor=not-a-cursor`,
		);
		expect(res.status).toBe(400);
	});
});

describe("GET /orgs/:orgId/conversations/counts", () => {
	it("counts active and waiting-on-human conversations for the org only", async () => {
		const res = await makeApp(owner).request(
			`/orgs/${orgA}/conversations/counts`,
		);
		expect(res.status).toBe(200);
		expect((await res.json()) as unknown).toEqual({
			active: 2,
			waitingOnHuman: 1,
		});
	});

	it("returns 403 for a non-member", async () => {
		const res = await makeApp(outsider).request(
			`/orgs/${orgA}/conversations/counts`,
		);
		expect(res.status).toBe(403);
	});
});

describe("GET /orgs/:orgId/leads", () => {
	it("lists leads across every agent in the org", async () => {
		const res = await makeApp(owner).request(`/orgs/${orgA}/leads`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<{ agentId: string }>;
		expect(new Set(body.map((l) => l.agentId))).toEqual(
			new Set([agentA1, agentA2]),
		);
	});

	it("combines ?agentId with ?search", async () => {
		const hit = await makeApp(owner).request(
			`/orgs/${orgA}/leads?agentId=${agentA1}&search=lead%20a1`,
		);
		expect(((await hit.json()) as unknown[]).length).toBe(1);
		const miss = await makeApp(owner).request(
			`/orgs/${orgA}/leads?agentId=${agentA2}&search=lead%20a1`,
		);
		expect(((await miss.json()) as unknown[]).length).toBe(0);
	});

	it("returns 403 for a non-member", async () => {
		const res = await makeApp(outsider).request(`/orgs/${orgA}/leads`);
		expect(res.status).toBe(403);
	});
});

describe("GET /orgs/:orgId/visitors", () => {
	it("lists visitors across every agent in the org", async () => {
		const res = await makeApp(owner).request(`/orgs/${orgA}/visitors`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<{ agentId: string }>;
		expect(new Set(body.map((v) => v.agentId))).toEqual(
			new Set([agentA1, agentA2]),
		);
	});

	it("narrows to one agent with ?agentId", async () => {
		const res = await makeApp(owner).request(
			`/orgs/${orgA}/visitors?agentId=${agentA1}`,
		);
		const body = (await res.json()) as Array<{ agentId: string }>;
		expect(body.map((v) => v.agentId)).toEqual([agentA1]);
	});
});

describe("GET /orgs/:orgId/analytics", () => {
	it("sums the summary across agents in the org", async () => {
		const res = await makeApp(owner).request(
			`/orgs/${orgA}/analytics/summary?windowDays=7`,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			conversations: number;
			leadsCaptured: number;
			handoffs: number;
			avgTurnsPerConv: number;
		};
		expect(body.conversations).toBe(2);
		expect(body.leadsCaptured).toBe(2);
		expect(body.handoffs).toBe(2);
		expect(body.avgTurnsPerConv).toBe(2);
	});

	it("narrows the summary with ?agentId", async () => {
		const res = await makeApp(owner).request(
			`/orgs/${orgA}/analytics/summary?windowDays=7&agentId=${agentA1}`,
		);
		const body = (await res.json()) as { conversations: number };
		expect(body.conversations).toBe(1);
	});

	it("puts today's org-wide activity in the timeseries", async () => {
		const res = await makeApp(owner).request(
			`/orgs/${orgA}/analytics/timeseries?windowDays=7`,
		);
		expect(res.status).toBe(200);
		const { points } = (await res.json()) as {
			points: Array<{ conversations: number; leadsCaptured: number }>;
		};
		expect(points).toHaveLength(7);
		expect(points[6]).toMatchObject({ conversations: 2, leadsCaptured: 2 });
	});

	it("returns 403 for a non-member", async () => {
		const res = await makeApp(outsider).request(
			`/orgs/${orgA}/analytics/summary`,
		);
		expect(res.status).toBe(403);
	});
});

function mkUser(id: string): AuthUser {
	return { id, name: id, email: `${id}@test.local`, image: null };
}
