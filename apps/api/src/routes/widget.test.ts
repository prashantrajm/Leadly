// Tests for the public widget endpoints. The KV binding is faked with an
// in-memory Map; the dev DB handles the actual upserts.

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import { getPrisma } from "../lib/prisma";
import { verifyWidgetToken } from "../lib/widget-token";
import type { AppEnv } from "../types";
import { widgetApp } from "./widget";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");
const prisma = getPrisma(DATABASE_URL);
const SECRET = "phase-10-test-secret";

function makeFakeKv() {
	const store = new Map<string, { value: string; expiresAt: number | null }>();
	const ns = {
		get: async (k: string) => {
			const e = store.get(k);
			if (!e) return null;
			if (e.expiresAt && Date.now() >= e.expiresAt) {
				store.delete(k);
				return null;
			}
			return e.value;
		},
		put: async (k: string, v: string, opts?: { expirationTtl?: number }) => {
			store.set(k, {
				value: v,
				expiresAt: opts?.expirationTtl
					? Date.now() + opts.expirationTtl * 1000
					: null,
			});
		},
		delete: async (k: string) => {
			store.delete(k);
		},
	};
	return { store, ns: ns as unknown as KVNamespace };
}

function makeApp(kv: KVNamespace) {
	const app = new OpenAPIHono<AppEnv>();
	app.use("*", async (c, next) => {
		// biome-ignore lint/suspicious/noExplicitAny: shoehorning a partial env for the test
		(c as any).env = {
			DATABASE_URL,
			BETTER_AUTH_SECRET: SECRET,
			WIDGET_CACHE: kv,
		};
		return next();
	});
	app.route("/widget", widgetApp);
	return app;
}

const tag = `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let agentId: string;

beforeAll(async () => {
	const userId = `${tag}-u`;
	await prisma.user.create({
		data: {
			id: userId,
			name: userId,
			email: `${userId}@test.local`,
			emailVerified: true,
		},
	});
	const org = await prisma.organization.create({
		data: {
			name: `Org ${tag}`,
			slug: `org-${tag}`,
			memberships: { create: { userId, role: "owner" } },
		},
	});
	const agent = await prisma.agent.create({
		data: {
			organizationId: org.id,
			name: `Acme ${tag}`,
			slug: `a-${tag}`,
			greeting: "Hi from Acme!",
			accentColor: "#FF6600",
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

// ---------- GET /config ----------

describe("GET /widget/config", () => {
	it("returns the agent's public config on cache miss", async () => {
		const kv = makeFakeKv();
		const res = await makeApp(kv.ns).request(`/widget/config?agentId=${agentId}`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			agentId: string;
			name: string;
			greeting: string;
			accentColor: string;
		};
		expect(body.agentId).toBe(agentId);
		expect(body.greeting).toBe("Hi from Acme!");
		expect(body.accentColor).toBe("#FF6600");
		// Cache populated.
		expect(kv.store.has(`widget:config:${agentId}`)).toBe(true);
	});

	it("serves from KV on cache hit (DB not consulted)", async () => {
		const kv = makeFakeKv();
		// Pre-populate KV with a stale-on-purpose payload.
		kv.store.set(`widget:config:${agentId}`, {
			value: JSON.stringify({
				agentId,
				name: "Stale",
				greeting: "From cache",
				accentColor: "#000000",
				identityPolicy: "optional",
			}),
			expiresAt: null,
		});
		const res = await makeApp(kv.ns).request(`/widget/config?agentId=${agentId}`);
		const body = (await res.json()) as { name: string };
		expect(body.name).toBe("Stale");
	});

	it("returns 404 for unknown agentId", async () => {
		const kv = makeFakeKv();
		const res = await makeApp(kv.ns).request(
			"/widget/config?agentId=does-not-exist",
		);
		expect(res.status).toBe(404);
	});
});

// ---------- POST /visitor ----------

describe("POST /widget/visitor", () => {
	it("creates a visitor on first hello and returns a token bound to it", async () => {
		const kv = makeFakeKv();
		const res = await makeApp(kv.ns).request(
			`/widget/visitor?agentId=${agentId}`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ externalId: `ext-${tag}-fresh` }),
			},
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { visitorId: string; token: string };

		const verified = await verifyWidgetToken(SECRET, body.token);
		expect(verified.ok).toBe(true);
		if (verified.ok) {
			expect(verified.payload.v).toBe(body.visitorId);
			expect(verified.payload.a).toBe(agentId);
		}
	});

	it("upserts on second hello with the same externalId (idempotent)", async () => {
		const kv = makeFakeKv();
		const ext = `ext-${tag}-idem`;
		const a = await makeApp(kv.ns).request(
			`/widget/visitor?agentId=${agentId}`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ externalId: ext }),
			},
		);
		const aBody = (await a.json()) as { visitorId: string };
		const b = await makeApp(kv.ns).request(
			`/widget/visitor?agentId=${agentId}`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ externalId: ext }),
			},
		);
		const bBody = (await b.json()) as { visitorId: string };
		expect(aBody.visitorId).toBe(bBody.visitorId);
	});

	it("returns 404 for unknown agent", async () => {
		const kv = makeFakeKv();
		const res = await makeApp(kv.ns).request(
			"/widget/visitor?agentId=does-not-exist",
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ externalId: "x" }),
			},
		);
		expect(res.status).toBe(404);
	});
});

// ---------- POST /conversation ----------

describe("POST /widget/conversation", () => {
	it("returns 401 without a token", async () => {
		const kv = makeFakeKv();
		const res = await makeApp(kv.ns).request("/widget/conversation", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(401);
	});

	it("returns 401 for a token signed with a different secret", async () => {
		const { signWidgetToken } = await import("../lib/widget-token");
		const tok = await signWidgetToken("OTHER-SECRET", {
			visitorId: "fake",
			agentId,
		});
		const kv = makeFakeKv();
		const res = await makeApp(kv.ns).request("/widget/conversation", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${tok}`,
			},
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(401);
	});

	it("creates a conversation and returns a wss-prefixed wsUrl", async () => {
		const kv = makeFakeKv();
		// First call /visitor to mint a real token.
		const helloRes = await makeApp(kv.ns).request(
			`/widget/visitor?agentId=${agentId}`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ externalId: `ext-${tag}-conv` }),
			},
		);
		const { token } = (await helloRes.json()) as { token: string };

		const res = await makeApp(kv.ns).request("/widget/conversation", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({}),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { conversationId: string; wsUrl: string };
		expect(body.conversationId).toBeDefined();
		expect(body.wsUrl).toMatch(/^wss?:\/\//);
		expect(body.wsUrl).toContain(`/api/conversations/${body.conversationId}/ws`);
	});

	it(
		"rate-limits past 30 requests per visitor in a minute",
		async () => {
			const kv = makeFakeKv();
			const helloRes = await makeApp(kv.ns).request(
				`/widget/visitor?agentId=${agentId}`,
				{
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ externalId: `ext-${tag}-rl` }),
				},
			);
			const { token } = (await helloRes.json()) as { token: string };

			// Eat the budget — 30 sequential conversation creates hit the dev DB
			// each time, so allow some headroom past Bun's default 5s timeout.
			for (let i = 0; i < 30; i++) {
				const r = await makeApp(kv.ns).request("/widget/conversation", {
					method: "POST",
					headers: {
						"content-type": "application/json",
						authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({}),
				});
				expect(r.status).toBe(200);
			}
			// 31st attempt is rejected.
			const final = await makeApp(kv.ns).request("/widget/conversation", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({}),
			});
			expect(final.status).toBe(429);
		},
		30_000,
	);
});

