import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AuthUser } from "../middleware/auth";
import { getPrisma } from "../lib/prisma";
import type { AppEnv } from "../types";
import { analyticsApp } from "./analytics";

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
	app.route("/agents/:agentId/analytics", analyticsApp);
	return app;
}

const tag = `an${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
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
		data: { organizationId: orgId, name: `Agent ${tag}`, slug: `a-${tag}` },
	});
	agentId = agent.id;

	// Seed a few DailyStat rows in the recent window (relative to wall now).
	const today = new Date();
	const utcMidnight = new Date(
		Date.UTC(
			today.getUTCFullYear(),
			today.getUTCMonth(),
			today.getUTCDate(),
		),
	);
	const days = [3, 2, 1];
	for (let i = 0; i < days.length; i++) {
		const d = new Date(utcMidnight.getTime() - days[i] * 24 * 60 * 60 * 1000);
		await prisma.dailyStat.create({
			data: {
				organizationId: orgId,
				agentId,
				date: d,
				conversations: i + 5, // 5, 6, 7
				leadsCaptured: i + 1, // 1, 2, 3
				handoffs: i, // 0, 1, 2
				avgTurnsPerConv: i + 2, // 2, 3, 4
			},
		});
	}
});

afterAll(async () => {
	await prisma.organization
		.deleteMany({ where: { slug: { startsWith: `org-${tag}` } } })
		.catch(() => {});
	await prisma.user
		.deleteMany({ where: { id: { startsWith: tag } } })
		.catch(() => {});
});

describe("GET /agents/:agentId/analytics/summary", () => {
	it("aggregates the seeded window for a member", async () => {
		const res = await makeApp(owner).request(
			`/agents/${agentId}/analytics/summary?windowDays=30`,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			conversations: number;
			leadsCaptured: number;
			handoffs: number;
			avgTurnsPerConv: number;
		};
		expect(body.conversations).toBe(5 + 6 + 7);
		expect(body.leadsCaptured).toBe(1 + 2 + 3);
		expect(body.handoffs).toBe(0 + 1 + 2);
		// avg = (5*2 + 6*3 + 7*4) / (5+6+7) = (10+18+28)/18 = 56/18 ≈ 3.111
		expect(body.avgTurnsPerConv).toBeGreaterThan(3.1);
		expect(body.avgTurnsPerConv).toBeLessThan(3.2);
	});

	it("returns zeros for a tight window with no rows", async () => {
		// Create an agent with no DailyStat at all.
		const empty = await prisma.agent.create({
			data: { organizationId: orgId, name: `Empty ${tag}`, slug: `e-${tag}` },
		});
		const res = await makeApp(owner).request(
			`/agents/${empty.id}/analytics/summary?windowDays=30`,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			conversations: number;
			avgTurnsPerConv: number;
		};
		expect(body.conversations).toBe(0);
		expect(body.avgTurnsPerConv).toBe(0);
	});

	it("returns 403 for outsider", async () => {
		const res = await makeApp(outsider).request(
			`/agents/${agentId}/analytics/summary`,
		);
		expect(res.status).toBe(403);
	});
});

describe("GET /agents/:agentId/analytics/timeseries", () => {
	it("returns one point per day in the window, padded with zeros", async () => {
		const res = await makeApp(owner).request(
			`/agents/${agentId}/analytics/timeseries?windowDays=7`,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			points: Array<{
				date: string;
				conversations: number;
				leadsCaptured: number;
				handoffs: number;
			}>;
		};
		expect(body.points).toHaveLength(7);
		// Dates ascending.
		for (let i = 1; i < body.points.length; i++) {
			expect(body.points[i].date > body.points[i - 1].date).toBe(true);
		}
		// At least one non-zero day from the seeds.
		expect(body.points.some((p) => p.conversations > 0)).toBe(true);
		// And the days that don't have a stat row come back as zeros.
		expect(body.points.some((p) => p.conversations === 0)).toBe(true);
	});

	it("respects ?windowDays bounds", async () => {
		const res = await makeApp(owner).request(
			`/agents/${agentId}/analytics/timeseries?windowDays=14`,
		);
		const body = (await res.json()) as { points: unknown[] };
		expect(body.points).toHaveLength(14);
	});

	it("returns 403 for outsider", async () => {
		const res = await makeApp(outsider).request(
			`/agents/${agentId}/analytics/timeseries`,
		);
		expect(res.status).toBe(403);
	});
});

function mkUser(id: string): AuthUser {
	return { id, name: id, email: `${id}@test.local`, image: null };
}
