import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AuthUser } from "../middleware/auth";
import { getPrisma } from "../lib/prisma";
import type { AppEnv } from "../types";
import { kbApp } from "./kb";

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
	app.route("/agents/:agentId/kb", kbApp);
	return app;
}

const tag = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let owner: AuthUser;
let outsider: AuthUser;
let orgId: string;
let agentId: string;
let articleId: string;

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
			name: `Agent ${tag}`,
			slug: `agent-${tag}`,
		},
	});
	agentId = agent.id;

	const article = await prisma.kbArticle.create({
		data: {
			organizationId: orgId,
			agentId,
			title: "Returns Policy",
			contentMarkdown: "# Returns\n\nWe accept returns within 30 days.",
		},
	});
	articleId = article.id;
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

describe("GET /agents/:agentId/kb/articles", () => {
	it("returns the seed article without contentMarkdown", async () => {
		const res = await makeApp(owner).request(`/agents/${agentId}/kb/articles`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<{
			id: string;
			title: string;
			chunkCount: number;
		}>;
		const found = body.find((a) => a.id === articleId);
		expect(found?.title).toBe("Returns Policy");
		expect(found?.chunkCount).toBe(0);
		// list view must not include the markdown body
		expect((found as unknown as { contentMarkdown?: string }).contentMarkdown).toBeUndefined();
	});

	it("returns 403 for outsider", async () => {
		const res = await makeApp(outsider).request(
			`/agents/${agentId}/kb/articles`,
		);
		expect(res.status).toBe(403);
	});
});

// ---------- get ----------

describe("GET /agents/:agentId/kb/articles/:articleId", () => {
	it("returns the article with contentMarkdown", async () => {
		const res = await makeApp(owner).request(
			`/agents/${agentId}/kb/articles/${articleId}`,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { contentMarkdown: string };
		expect(body.contentMarkdown).toContain("Returns");
	});

	it("returns 404 when articleId belongs to a different agent", async () => {
		const otherAgent = await prisma.agent.create({
			data: {
				organizationId: orgId,
				name: `Other ${tag}`,
				slug: `other-${tag}`,
			},
		});
		const res = await makeApp(owner).request(
			`/agents/${otherAgent.id}/kb/articles/${articleId}`,
		);
		expect(res.status).toBe(404);
	});
});

// ---------- create ----------

describe("POST /agents/:agentId/kb/articles", () => {
	it("creates an article", async () => {
		const res = await makeApp(owner).request(
			`/agents/${agentId}/kb/articles`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					title: "Pricing",
					contentMarkdown: "## Pricing\n\nFree tier available.",
				}),
			},
		);
		expect(res.status).toBe(201);
		const body = (await res.json()) as { id: string; title: string };
		expect(body.title).toBe("Pricing");
	});

	it("rejects empty body with 400", async () => {
		const res = await makeApp(owner).request(
			`/agents/${agentId}/kb/articles`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ title: "Empty", contentMarkdown: "" }),
			},
		);
		expect(res.status).toBe(400);
	});
});

// ---------- patch ----------

describe("PATCH /agents/:agentId/kb/articles/:articleId", () => {
	it("updates title only", async () => {
		const res = await makeApp(owner).request(
			`/agents/${agentId}/kb/articles/${articleId}`,
			{
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ title: "Returns Policy v2" }),
			},
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { title: string };
		expect(body.title).toBe("Returns Policy v2");
	});

	it("returns 403 for outsider", async () => {
		const res = await makeApp(outsider).request(
			`/agents/${agentId}/kb/articles/${articleId}`,
			{
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ title: "Hacked" }),
			},
		);
		expect(res.status).toBe(403);
	});
});

// ---------- delete ----------

describe("DELETE /agents/:agentId/kb/articles/:articleId", () => {
	it("deletes when caller is a member", async () => {
		const tmp = await prisma.kbArticle.create({
			data: {
				organizationId: orgId,
				agentId,
				title: "Doomed",
				contentMarkdown: "Will be deleted.",
			},
		});
		const res = await makeApp(owner).request(
			`/agents/${agentId}/kb/articles/${tmp.id}`,
			{ method: "DELETE" },
		);
		expect(res.status).toBe(200);
		const after = await prisma.kbArticle.findUnique({ where: { id: tmp.id } });
		expect(after).toBeNull();
	});

	it("returns 404 for unknown id", async () => {
		const res = await makeApp(owner).request(
			`/agents/${agentId}/kb/articles/does-not-exist`,
			{ method: "DELETE" },
		);
		expect(res.status).toBe(404);
	});
});

function mkUser(id: string): AuthUser {
	return { id, name: id, email: `${id}@test.local`, image: null };
}
