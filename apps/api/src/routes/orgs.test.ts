// Integration tests for /api/orgs/*. Mounts the orgs router under a fake auth
// guard that injects a known AuthUser, so tests don't have to drive the
// full Better Auth signup flow. Real Prisma queries against the dev DB.

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { AuthUser } from "../middleware/auth";
import { getPrisma } from "../lib/prisma";
import type { AppEnv } from "../types";
import { orgsApp } from "./orgs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");

const prisma = getPrisma(DATABASE_URL);

// Build a small wrapper app: env injection + fake auth + mount orgs.
function makeApp(user: AuthUser | null) {
	const app = new OpenAPIHono<AppEnv>();
	app.use("*", async (c, next) => {
		// biome-ignore lint/suspicious/noExplicitAny: shoehorning a partial env for the test
		(c as any).env = { DATABASE_URL };
		if (user) c.set("user", user);
		else return c.json({ error: "Unauthorized" }, 401);
		return next();
	});
	app.route("/orgs", orgsApp);
	return app;
}

const tag = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let owner: AuthUser;
let member: AuthUser;
let outsider: AuthUser;
let invitee: AuthUser;
let orgId: string;

beforeAll(async () => {
	for (const role of ["owner", "member", "outsider", "invitee"]) {
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
	invitee = mkUser(`${tag}-invitee`);

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
});

afterAll(async () => {
	// Best-effort cleanup. Cascades on org take memberships with them.
	await prisma.organization
		.deleteMany({ where: { slug: { startsWith: `org-${tag}` } } })
		.catch(() => {});
	await prisma.user
		.deleteMany({ where: { id: { startsWith: tag } } })
		.catch(() => {});
});

// ---------- list ----------

describe("GET /orgs", () => {
	it("returns 401 without a user", async () => {
		const res = await makeApp(null).request("/orgs");
		expect(res.status).toBe(401);
	});

	it("returns only orgs the caller belongs to", async () => {
		const res = await makeApp(member).request("/orgs");
		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<{ id: string }>;
		expect(body.some((o) => o.id === orgId)).toBe(true);
	});

	it("returns empty for a user with no memberships", async () => {
		const res = await makeApp(outsider).request("/orgs");
		expect(res.status).toBe(200);
		const body = (await res.json()) as Array<{ id: string }>;
		expect(body.find((o) => o.id === orgId)).toBeUndefined();
	});
});

// ---------- create ----------

describe("POST /orgs", () => {
	it("creates an org and makes the caller owner", async () => {
		const res = await makeApp(outsider).request("/orgs", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: `New Org ${tag}` }),
		});
		expect(res.status).toBe(201);
		const body = (await res.json()) as { id: string; name: string };
		expect(body.name).toBe(`New Org ${tag}`);
		const m = await prisma.membership.findFirst({
			where: { organizationId: body.id, userId: outsider.id },
		});
		expect(m?.role).toBe("owner");
	});

	it("rejects a too-short name with 400", async () => {
		const res = await makeApp(outsider).request("/orgs", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: "x" }),
		});
		expect(res.status).toBe(400);
	});
});

// ---------- get ----------

describe("GET /orgs/:orgId", () => {
	it("returns the org with member list for a member", async () => {
		const res = await makeApp(member).request(`/orgs/${orgId}`);
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			memberships: Array<{ user: { email: string }; role: string }>;
		};
		expect(body.memberships.length).toBe(2);
		expect(body.memberships.some((m) => m.role === "owner")).toBe(true);
	});

	it("returns 403 for an outsider", async () => {
		const res = await makeApp(outsider).request(`/orgs/${orgId}`);
		expect(res.status).toBe(403);
	});
});

// ---------- patch ----------

describe("PATCH /orgs/:orgId", () => {
	it("rejects update from a non-admin member with 403", async () => {
		const res = await makeApp(member).request(`/orgs/${orgId}`, {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: "Hacked" }),
		});
		expect(res.status).toBe(403);
	});

	it("accepts update from an owner", async () => {
		const res = await makeApp(owner).request(`/orgs/${orgId}`, {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ name: `Renamed ${tag}` }),
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as { name: string };
		expect(body.name).toBe(`Renamed ${tag}`);
	});
});

// ---------- invite + remove members ----------

describe("POST /orgs/:orgId/members", () => {
	it("returns 404 when the email is not a registered user", async () => {
		const res = await makeApp(owner).request(`/orgs/${orgId}/members`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: `nobody-${tag}@nowhere.local`, role: "member" }),
		});
		expect(res.status).toBe(404);
	});

	it("invites an existing user as member", async () => {
		const res = await makeApp(owner).request(`/orgs/${orgId}/members`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: invitee.email, role: "member" }),
		});
		expect(res.status).toBe(201);
		const body = (await res.json()) as { user: { email: string }; role: string };
		expect(body.user.email).toBe(invitee.email);
		expect(body.role).toBe("member");
	});

	it("returns 409 on duplicate invite", async () => {
		const res = await makeApp(owner).request(`/orgs/${orgId}/members`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: invitee.email, role: "member" }),
		});
		expect(res.status).toBe(409);
	});

	it("returns 403 when caller is not admin", async () => {
		const res = await makeApp(member).request(`/orgs/${orgId}/members`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ email: invitee.email, role: "member" }),
		});
		expect(res.status).toBe(403);
	});
});

describe("DELETE /orgs/:orgId/members/:userId", () => {
	it("removes a non-owner member", async () => {
		const res = await makeApp(owner).request(
			`/orgs/${orgId}/members/${invitee.id}`,
			{ method: "DELETE" },
		);
		expect(res.status).toBe(200);
		const m = await prisma.membership.findFirst({
			where: { organizationId: orgId, userId: invitee.id },
		});
		expect(m).toBeNull();
	});

	it("refuses to remove the last owner", async () => {
		const res = await makeApp(owner).request(
			`/orgs/${orgId}/members/${owner.id}`,
			{ method: "DELETE" },
		);
		expect(res.status).toBe(400);
	});

	it("returns 404 for a non-existent membership", async () => {
		const res = await makeApp(owner).request(
			`/orgs/${orgId}/members/does-not-exist`,
			{ method: "DELETE" },
		);
		expect(res.status).toBe(404);
	});
});

function mkUser(id: string): AuthUser {
	return { id, name: id, email: `${id}@test.local`, image: null };
}
