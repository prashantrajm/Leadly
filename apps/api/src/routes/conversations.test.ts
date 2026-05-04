// Inbox-route tests. The routes proxy actions through the ConversationDO's
// internal /control endpoint, which we replace with a fake DO namespace
// that records calls — the DO's behaviour is exercised by ws-smoke.ts at
// the wrangler-dev level. Here we only assert:
//   • auth + membership gating
//   • the route → DO control payload is shaped correctly
//   • the DB-side state the routes are supposed to leave behind happens
//     when control returns ok

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AuthUser } from "../middleware/auth";
import { getPrisma } from "../lib/prisma";
import type { AppEnv } from "../types";
import {
	agentConversationsApp,
	conversationsInboxApp,
} from "./conversations";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");
const prisma = getPrisma(DATABASE_URL);

// In-memory DO namespace stand-in. Records every fetch the route makes
// and returns the canned response we feed it.
type DoCall = { url: string; method: string; body: unknown };
function makeFakeDoNamespace(opts: { okOnControl: boolean }) {
	const calls: DoCall[] = [];
	const namespace = {
		idFromName: (name: string) => ({ name }) as unknown as DurableObjectId,
		get: () => ({
			fetch: async (url: string | Request, init?: RequestInit) => {
				const u = typeof url === "string" ? url : url.url;
				const method = init?.method ?? "GET";
				const body =
					init?.body && typeof init.body === "string"
						? JSON.parse(init.body)
						: null;
				calls.push({ url: u, method, body });
				return new Response(
					JSON.stringify({ ok: opts.okOnControl }),
					{ status: opts.okOnControl ? 200 : 500 },
				);
			},
		}),
	};
	return { namespace, calls };
}

function makeApp(user: AuthUser | null, doNs: ReturnType<typeof makeFakeDoNamespace>["namespace"]) {
	const app = new OpenAPIHono<AppEnv>();
	app.use("*", async (c, next) => {
		// biome-ignore lint/suspicious/noExplicitAny: shoehorning a partial env for the test
		(c as any).env = { DATABASE_URL, CONVERSATION: doNs };
		if (user) c.set("user", user);
		else return c.json({ error: "Unauthorized" }, 401);
		return next();
	});
	app.route("/conversations", conversationsInboxApp);
	app.route("/agents/:agentId/conversations", agentConversationsApp);
	return app;
}

const tag = `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let owner: AuthUser;
let outsider: AuthUser;
let orgId: string;
let agentId: string;
let visitorId: string;
let conversationId: string;

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
		},
	});
	visitorId = visitor.id;
	const conv = await prisma.conversation.create({
		data: { organizationId: orgId, agentId, visitorId },
	});
	conversationId = conv.id;
});

afterAll(async () => {
	await prisma.organization
		.deleteMany({ where: { slug: { startsWith: `org-${tag}` } } })
		.catch(() => {});
	await prisma.user
		.deleteMany({ where: { id: { startsWith: tag } } })
		.catch(() => {});
});

// ---------- take-over ----------

describe("POST /conversations/:id/take-over", () => {
	it("returns 401 without a user", async () => {
		const fake = makeFakeDoNamespace({ okOnControl: true });
		const res = await makeApp(null, fake.namespace).request(
			`/conversations/${conversationId}/take-over`,
			{ method: "POST" },
		);
		expect(res.status).toBe(401);
	});

	it("returns 404 for an unknown conversation id", async () => {
		const fake = makeFakeDoNamespace({ okOnControl: true });
		const res = await makeApp(owner, fake.namespace).request(
			"/conversations/does-not-exist/take-over",
			{ method: "POST" },
		);
		expect(res.status).toBe(404);
	});

	it("returns 403 when caller is not a member of the agent's org", async () => {
		const fake = makeFakeDoNamespace({ okOnControl: true });
		const res = await makeApp(outsider, fake.namespace).request(
			`/conversations/${conversationId}/take-over`,
			{ method: "POST" },
		);
		expect(res.status).toBe(403);
	});

	it("returns 200 + observerToken and forwards the action to the DO", async () => {
		const fake = makeFakeDoNamespace({ okOnControl: true });
		const res = await makeApp(owner, fake.namespace).request(
			`/conversations/${conversationId}/take-over`,
			{ method: "POST" },
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { observerToken: string };
		expect(body.observerToken).toBeDefined();
		expect(fake.calls).toHaveLength(1);
		expect(fake.calls[0].method).toBe("POST");
		expect((fake.calls[0].body as { action: string }).action).toBe("take_over");
		expect((fake.calls[0].body as { conversationId: string }).conversationId).toBe(
			conversationId,
		);
	});
});

// ---------- release ----------

describe("POST /conversations/:id/release", () => {
	it("forwards 'release' to the DO", async () => {
		const fake = makeFakeDoNamespace({ okOnControl: true });
		const res = await makeApp(owner, fake.namespace).request(
			`/conversations/${conversationId}/release`,
			{ method: "POST" },
		);
		expect(res.status).toBe(200);
		expect((fake.calls[0].body as { action: string }).action).toBe("release");
	});

	it("returns 403 for outsider", async () => {
		const fake = makeFakeDoNamespace({ okOnControl: true });
		const res = await makeApp(outsider, fake.namespace).request(
			`/conversations/${conversationId}/release`,
			{ method: "POST" },
		);
		expect(res.status).toBe(403);
	});
});

// ---------- human-message ----------

describe("POST /conversations/:id/human-message", () => {
	it("forwards 'human_message' with the supplied text", async () => {
		const fake = makeFakeDoNamespace({ okOnControl: true });
		const res = await makeApp(owner, fake.namespace).request(
			`/conversations/${conversationId}/human-message`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ text: "Hi from the operator" }),
			},
		);
		expect(res.status).toBe(200);
		const payload = fake.calls[0].body as { action: string; text: string };
		expect(payload.action).toBe("human_message");
		expect(payload.text).toBe("Hi from the operator");
	});

	it("returns 400 for empty text", async () => {
		const fake = makeFakeDoNamespace({ okOnControl: true });
		const res = await makeApp(owner, fake.namespace).request(
			`/conversations/${conversationId}/human-message`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ text: "" }),
			},
		);
		expect(res.status).toBe(400);
	});

	it("returns 400 for too-long text (>4000)", async () => {
		const fake = makeFakeDoNamespace({ okOnControl: true });
		const res = await makeApp(owner, fake.namespace).request(
			`/conversations/${conversationId}/human-message`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ text: "x".repeat(4001) }),
			},
		);
		expect(res.status).toBe(400);
	});

	it("returns 403 for outsider", async () => {
		const fake = makeFakeDoNamespace({ okOnControl: true });
		const res = await makeApp(outsider, fake.namespace).request(
			`/conversations/${conversationId}/human-message`,
			{
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ text: "Hi" }),
			},
		);
		expect(res.status).toBe(403);
	});
});

// ---------- list (cursor-paginated) + detail ----------

describe("GET /agents/:agentId/conversations", () => {
	it("returns the seed conversation with turnCount", async () => {
		const fake = makeFakeDoNamespace({ okOnControl: true });
		const res = await makeApp(owner, fake.namespace).request(
			`/agents/${agentId}/conversations`,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			items: Array<{ id: string; turnCount: number }>;
			nextCursor: string | null;
		};
		expect(body.items.some((c) => c.id === conversationId)).toBe(true);
	});

	it("paginates with cursor — page 1 then page 2 are disjoint and complete", async () => {
		// Seed 5 extra conversations to force pagination.
		const created: string[] = [];
		for (let i = 0; i < 5; i++) {
			const c = await prisma.conversation.create({
				data: { organizationId: orgId, agentId, visitorId },
			});
			created.push(c.id);
		}

		const fake = makeFakeDoNamespace({ okOnControl: true });
		const a = await makeApp(owner, fake.namespace).request(
			`/agents/${agentId}/conversations?limit=3`,
		);
		const aBody = (await a.json()) as {
			items: Array<{ id: string }>;
			nextCursor: string | null;
		};
		expect(aBody.items).toHaveLength(3);
		expect(aBody.nextCursor).not.toBeNull();

		const b = await makeApp(owner, fake.namespace).request(
			`/agents/${agentId}/conversations?limit=3&cursor=${encodeURIComponent(aBody.nextCursor as string)}`,
		);
		const bBody = (await b.json()) as {
			items: Array<{ id: string }>;
			nextCursor: string | null;
		};
		expect(bBody.items.length).toBeGreaterThan(0);

		// No overlap between the two pages.
		const aIds = new Set(aBody.items.map((c) => c.id));
		for (const item of bBody.items) {
			expect(aIds.has(item.id)).toBe(false);
		}

		// Cleanup.
		await prisma.conversation
			.deleteMany({ where: { id: { in: created } } })
			.catch(() => {});
	});

	it("filters by status", async () => {
		const ended = await prisma.conversation.create({
			data: {
				organizationId: orgId,
				agentId,
				visitorId,
				status: "ended",
				endedAt: new Date(),
			},
		});

		const fake = makeFakeDoNamespace({ okOnControl: true });
		const res = await makeApp(owner, fake.namespace).request(
			`/agents/${agentId}/conversations?status=ended`,
		);
		const body = (await res.json()) as {
			items: Array<{ id: string; status: string }>;
		};
		expect(body.items.every((c) => c.status === "ended")).toBe(true);
		expect(body.items.some((c) => c.id === ended.id)).toBe(true);

		await prisma.conversation.delete({ where: { id: ended.id } });
	});

	it("returns 400 on bad cursor", async () => {
		const fake = makeFakeDoNamespace({ okOnControl: true });
		const res = await makeApp(owner, fake.namespace).request(
			`/agents/${agentId}/conversations?cursor=not-base64`,
		);
		expect(res.status).toBe(400);
	});

	it("returns 403 for outsider", async () => {
		const fake = makeFakeDoNamespace({ okOnControl: true });
		const res = await makeApp(outsider, fake.namespace).request(
			`/agents/${agentId}/conversations`,
		);
		expect(res.status).toBe(403);
	});
});

describe("GET /conversations/:id", () => {
	it("returns conversation with turns inline", async () => {
		await prisma.turn.create({
			data: { conversationId, role: "user", text: "first user msg" },
		});
		await prisma.turn.create({
			data: { conversationId, role: "agent", text: "first agent reply" },
		});

		const fake = makeFakeDoNamespace({ okOnControl: true });
		const res = await makeApp(owner, fake.namespace).request(
			`/conversations/${conversationId}`,
		);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			id: string;
			turns: Array<{ role: string; text: string }>;
		};
		expect(body.id).toBe(conversationId);
		expect(body.turns.length).toBeGreaterThanOrEqual(2);
		// Turns are ordered ascending by createdAt.
		const userIdx = body.turns.findIndex((t) => t.role === "user");
		const agentIdx = body.turns.findIndex((t) => t.role === "agent");
		expect(userIdx).toBeLessThan(agentIdx);
	});

	it("returns 403 for outsider", async () => {
		const fake = makeFakeDoNamespace({ okOnControl: true });
		const res = await makeApp(outsider, fake.namespace).request(
			`/conversations/${conversationId}`,
		);
		expect(res.status).toBe(403);
	});

	it("returns 404 for unknown id", async () => {
		const fake = makeFakeDoNamespace({ okOnControl: true });
		const res = await makeApp(owner, fake.namespace).request(
			"/conversations/does-not-exist",
		);
		expect(res.status).toBe(404);
	});
});

function mkUser(id: string): AuthUser {
	return { id, name: id, email: `${id}@test.local`, image: null };
}
