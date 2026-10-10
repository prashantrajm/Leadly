// Org-scoped authorization middleware. Always runs *after* authMiddleware —
// these helpers assume c.get("user") is already set. Each middleware reads a
// route param (`:orgId` or `:agentId`), looks up the caller's Membership, and
// either attaches it to the context or returns 403.
//
// The lookups use the request-scoped Prisma client and cache the resolved
// Membership / Agent on the context so downstream handlers don't re-query.

import type { Context, Next } from "hono";
import { getPrisma } from "../lib/prisma";

export type ResolvedMembership = {
	id: string;
	organizationId: string;
	userId: string;
	role: "owner" | "admin" | "member";
};

export type ResolvedAgent = {
	id: string;
	organizationId: string;
};

// biome-ignore lint/suspicious/noExplicitAny: hono context is generic across routes
type Ctx = Context<any>;

function getUser(c: Ctx) {
	return c.get("user") as
		| { id: string; name: string; email: string; image?: string | null }
		| undefined;
}

async function loadMembership(
	c: Ctx,
	userId: string,
	organizationId: string,
): Promise<ResolvedMembership | null> {
	const prisma = getPrisma((c.env as { DATABASE_URL: string }).DATABASE_URL);
	const m = await prisma.membership.findUnique({
		where: { organizationId_userId: { organizationId, userId } },
		select: { id: true, organizationId: true, userId: true, role: true },
	});
	return m as ResolvedMembership | null;
}

// requireOrgMember — caller must belong to :orgId in any role.
export const requireOrgMember = async (c: Ctx, next: Next) => {
	const user = getUser(c);
	if (!user) return c.json({ error: "Unauthorized" }, 401);

	const orgId = c.req.param("orgId");
	if (!orgId) return c.json({ error: "Missing orgId in path" }, 400);

	const membership = await loadMembership(c, user.id, orgId);
	if (!membership) return c.json({ error: "Forbidden" }, 403);

	c.set("membership", membership);
	return next();
};

// requireOrgAdmin — caller must be `owner` or `admin` of :orgId.
export const requireOrgAdmin = async (c: Ctx, next: Next) => {
	const user = getUser(c);
	if (!user) return c.json({ error: "Unauthorized" }, 401);

	const orgId = c.req.param("orgId");
	if (!orgId) return c.json({ error: "Missing orgId in path" }, 400);

	const membership = await loadMembership(c, user.id, orgId);
	if (!membership) return c.json({ error: "Forbidden" }, 403);
	if (membership.role !== "owner" && membership.role !== "admin") {
		return c.json(
			{ error: "Forbidden", message: "Org admin or owner required" },
			403,
		);
	}

	c.set("membership", membership);
	return next();
};

// requireOrgOwner — caller must be an `owner` of :orgId. Used for
// destructive / ownership actions: deleting the org, changing roles.
export const requireOrgOwner = async (c: Ctx, next: Next) => {
	const user = getUser(c);
	if (!user) return c.json({ error: "Unauthorized" }, 401);

	const orgId = c.req.param("orgId");
	if (!orgId) return c.json({ error: "Missing orgId in path" }, 400);

	const membership = await loadMembership(c, user.id, orgId);
	if (!membership) return c.json({ error: "Forbidden" }, 403);
	if (membership.role !== "owner") {
		return c.json({ error: "Forbidden", message: "Org owner required" }, 403);
	}

	c.set("membership", membership);
	return next();
};

// requireAgentAccess — derives orgId from :agentId, then checks membership.
// Used by every per-agent route (KB, conversations, leads, settings, …).
export const requireAgentAccess = async (c: Ctx, next: Next) => {
	const user = getUser(c);
	if (!user) return c.json({ error: "Unauthorized" }, 401);

	const agentId = c.req.param("agentId");
	if (!agentId) return c.json({ error: "Missing agentId in path" }, 400);

	const prisma = getPrisma((c.env as { DATABASE_URL: string }).DATABASE_URL);
	const agent = await prisma.agent.findUnique({
		where: { id: agentId },
		select: { id: true, organizationId: true },
	});
	if (!agent) return c.json({ error: "Agent not found" }, 404);

	const membership = await loadMembership(c, user.id, agent.organizationId);
	if (!membership) return c.json({ error: "Forbidden" }, 403);

	c.set("agent", agent satisfies ResolvedAgent);
	c.set("membership", membership);
	return next();
};
