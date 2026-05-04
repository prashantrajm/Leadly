// Integration tests against the dev DB. We don't mock prisma — the middleware
// IS the prisma query, so a stub would only test our stub. Each test creates
// its own org/user/agent rows with random ids and cleans them up at the end.

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context, Next } from "hono";
import type { AuthUser } from "./auth";
import { getPrisma } from "../lib/prisma";
import type { AppEnv } from "../types";
import {
	requireAgentAccess,
	requireOrgAdmin,
	requireOrgMember,
} from "./org";

// Widened middleware type so the test helper can accept any of the three
// guards even though they each return narrower status-code unions.
// biome-ignore lint/suspicious/noExplicitAny: union of Hono middleware variants
type AnyOrgMiddleware = (c: Context<any>, next: Next) => Promise<unknown>;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const prisma = getPrisma(DATABASE_URL);

// Helper — build a Hono app with a fake auth middleware that hard-codes
// the AuthUser, then mount one route guarded by the middleware under test.
function makeApp(
	middleware: AnyOrgMiddleware,
	user: AuthUser | null,
	path: string,
) {
	const app = new OpenAPIHono<AppEnv>();
	app.use("*", async (c, next) => {
		// biome-ignore lint/suspicious/noExplicitAny: shoehorning a partial env for the test
		(c as any).env = { DATABASE_URL };
		if (user) c.set("user", user);
		return next();
	});
	// biome-ignore lint/suspicious/noExplicitAny: middleware is intentionally widened
	app.use(path, middleware as any);
	app.get(path, (c) => {
		const m = c.get("membership");
		const a = c.get("agent");
		return c.json({ ok: true, membership: m, agent: a });
	});
	return app;
}

// --- fixture state ----------------------------------------------------------

const idTag = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let userOwner: { id: string };
let userMember: { id: string };
let userOutsider: { id: string };
let orgId: string;
let agentId: string;

beforeAll(async () => {
	// Three users: owner, member, and an outsider with no membership.
	for (const tag of ["owner", "member", "outsider"]) {
		await prisma.user.create({
			data: {
				id: `${idTag}-${tag}`,
				name: `${tag} ${idTag}`,
				email: `${tag}-${idTag}@test.local`,
				emailVerified: true,
			},
		});
	}
	userOwner = { id: `${idTag}-owner` };
	userMember = { id: `${idTag}-member` };
	userOutsider = { id: `${idTag}-outsider` };

	const org = await prisma.organization.create({
		data: {
			name: `Org ${idTag}`,
			slug: `org-${idTag}`,
			memberships: {
				create: [
					{ userId: userOwner.id, role: "owner" },
					{ userId: userMember.id, role: "member" },
				],
			},
		},
	});
	orgId = org.id;

	const agent = await prisma.agent.create({
		data: {
			organizationId: orgId,
			name: `Agent ${idTag}`,
			slug: `agent-${idTag}`,
		},
	});
	agentId = agent.id;
});

afterAll(async () => {
	// Children cascade via onDelete: Cascade — dropping the org takes the
	// memberships and agent with it. User rows have no FK back to org.
	await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
	await prisma.user
		.deleteMany({ where: { id: { startsWith: idTag } } })
		.catch(() => {});
});

// --- requireOrgMember -------------------------------------------------------

describe("requireOrgMember", () => {
	const path = "/orgs/:orgId";

	it("returns 401 when no user is on the context", async () => {
		const app = makeApp(requireOrgMember, null, path);
		const res = await app.request(`/orgs/${orgId}`);
		expect(res.status).toBe(401);
	});

	it("returns 403 when the user has no membership in this org", async () => {
		const app = makeApp(
			requireOrgMember,
			fakeUser(userOutsider.id),
			path,
		);
		const res = await app.request(`/orgs/${orgId}`);
		expect(res.status).toBe(403);
	});

	it("returns 200 and attaches membership when the user is a member", async () => {
		const app = makeApp(requireOrgMember, fakeUser(userMember.id), path);
		const res = await app.request(`/orgs/${orgId}`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { membership: { role: string } };
		expect(body.membership.role).toBe("member");
	});

	it("returns 200 for an owner too (any role passes)", async () => {
		const app = makeApp(requireOrgMember, fakeUser(userOwner.id), path);
		const res = await app.request(`/orgs/${orgId}`);
		expect(res.status).toBe(200);
	});
});

// --- requireOrgAdmin --------------------------------------------------------

describe("requireOrgAdmin", () => {
	const path = "/orgs/:orgId/admin";

	it("returns 200 for owner", async () => {
		const app = makeApp(requireOrgAdmin, fakeUser(userOwner.id), path);
		const res = await app.request(`/orgs/${orgId}/admin`);
		expect(res.status).toBe(200);
	});

	it("returns 403 for plain member", async () => {
		const app = makeApp(requireOrgAdmin, fakeUser(userMember.id), path);
		const res = await app.request(`/orgs/${orgId}/admin`);
		expect(res.status).toBe(403);
	});

	it("returns 403 for outsider", async () => {
		const app = makeApp(requireOrgAdmin, fakeUser(userOutsider.id), path);
		const res = await app.request(`/orgs/${orgId}/admin`);
		expect(res.status).toBe(403);
	});
});

// --- requireAgentAccess -----------------------------------------------------

describe("requireAgentAccess", () => {
	const path = "/agents/:agentId";

	it("returns 200 for a member of the agent's org", async () => {
		const app = makeApp(requireAgentAccess, fakeUser(userMember.id), path);
		const res = await app.request(`/agents/${agentId}`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { agent: { id: string } };
		expect(body.agent.id).toBe(agentId);
	});

	it("returns 403 for outsider", async () => {
		const app = makeApp(
			requireAgentAccess,
			fakeUser(userOutsider.id),
			path,
		);
		const res = await app.request(`/agents/${agentId}`);
		expect(res.status).toBe(403);
	});

	it("returns 404 for an agent id that doesn't exist", async () => {
		const app = makeApp(requireAgentAccess, fakeUser(userOwner.id), path);
		const res = await app.request("/agents/does-not-exist");
		expect(res.status).toBe(404);
	});

	it("returns 401 with no user on context", async () => {
		const app = makeApp(requireAgentAccess, null, path);
		const res = await app.request(`/agents/${agentId}`);
		expect(res.status).toBe(401);
	});
});

function fakeUser(id: string): AuthUser {
	return {
		id,
		name: id,
		email: `${id}@test.local`,
		image: null,
	};
}
