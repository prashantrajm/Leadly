import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
	CreateOrganizationSchema,
	ErrorSchema,
	InviteMemberSchema,
	MembershipWithUserSchema,
	OrganizationSchema,
	OrganizationWithMembersSchema,
	SuccessSchema,
	UpdateOrganizationSchema,
} from "@leadly/schemas";
import { slugify } from "@leadly/utils";
import { requireOrgAdmin, requireOrgMember } from "../middleware/org";
import { getPrisma } from "../lib/prisma";
import type { AppEnv, MembershipWithUser } from "../types";

// authMiddleware is applied at the parent mount in routes/index.ts so tests
// can substitute a fake auth shim without rebuilding the whole route tree.
export const orgsApp = new OpenAPIHono<AppEnv>();

// ---------- list (caller's orgs) ----------

const listOrgsRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Organizations"],
	responses: {
		200: {
			content: { "application/json": { schema: z.array(OrganizationSchema) } },
			description: "Organizations the caller belongs to",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
	},
});

orgsApp.openapi(listOrgsRoute, async (c) => {
	const user = c.get("user");
	const prisma = getPrisma(c.env.DATABASE_URL);
	const orgs = await prisma.organization.findMany({
		where: { memberships: { some: { userId: user.id } } },
		orderBy: { createdAt: "asc" },
	});
	return c.json(orgs.map(toWire), 200);
});

// ---------- create ----------

const createOrgRoute = createRoute({
	method: "post",
	path: "/",
	tags: ["Organizations"],
	request: {
		body: {
			content: { "application/json": { schema: CreateOrganizationSchema } },
		},
	},
	responses: {
		201: {
			content: { "application/json": { schema: OrganizationSchema } },
			description: "Created",
		},
		400: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Invalid input",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
	},
});

orgsApp.openapi(createOrgRoute, async (c) => {
	const user = c.get("user");
	const { name } = c.req.valid("json");
	const prisma = getPrisma(c.env.DATABASE_URL);

	const slug = await pickAvailableSlug(prisma, slugify(name) || "org");
	const org = await prisma.organization.create({
		data: {
			name,
			slug,
			memberships: { create: { userId: user.id, role: "owner" } },
		},
	});
	return c.json(toWire(org), 201);
});

// ---------- get :orgId ----------

const getOrgRoute = createRoute({
	method: "get",
	path: "/{orgId}",
	tags: ["Organizations"],
	request: { params: z.object({ orgId: z.string() }) },
	middleware: [requireOrgMember] as const,
	responses: {
		200: {
			content: {
				"application/json": { schema: OrganizationWithMembersSchema },
			},
			description: "Organization with members",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
	},
});

orgsApp.openapi(getOrgRoute, async (c) => {
	const { orgId } = c.req.valid("param");
	const prisma = getPrisma(c.env.DATABASE_URL);

	const [org, membershipsRaw] = await Promise.all([
		prisma.organization.findUnique({ where: { id: orgId } }),
		prisma.membership.findMany({
			where: { organizationId: orgId },
			orderBy: { createdAt: "asc" },
			include: {
				user: { select: { id: true, name: true, email: true, image: true } },
			},
		}),
	]);
	const memberships = membershipsRaw as unknown as MembershipWithUser[];
	// Membership was already verified by requireOrgMember, so a missing org
	// here would only happen if it was deleted between checks.
	if (!org) return c.json({ error: "Organization not found" }, 403);
	return c.json(
		{
			id: org.id,
			name: org.name,
			slug: org.slug,
			createdAt: org.createdAt.toISOString(),
			updatedAt: org.updatedAt.toISOString(),
			memberships: memberships.map((m) => ({
				id: m.id,
				organizationId: m.organizationId,
				userId: m.userId,
				role: m.role,
				createdAt: m.createdAt.toISOString(),
				user: {
					id: m.user.id,
					name: m.user.name,
					email: m.user.email,
					image: m.user.image,
				},
			})),
		},
		200,
	);
});

// ---------- patch :orgId (admin only) ----------

const patchOrgRoute = createRoute({
	method: "patch",
	path: "/{orgId}",
	tags: ["Organizations"],
	request: {
		params: z.object({ orgId: z.string() }),
		body: {
			content: { "application/json": { schema: UpdateOrganizationSchema } },
		},
	},
	middleware: [requireOrgAdmin] as const,
	responses: {
		200: {
			content: { "application/json": { schema: OrganizationSchema } },
			description: "Updated",
		},
		400: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Invalid input",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
	},
});

orgsApp.openapi(patchOrgRoute, async (c) => {
	const { orgId } = c.req.valid("param");
	const patch = c.req.valid("json");
	const prisma = getPrisma(c.env.DATABASE_URL);
	const updated = await prisma.organization.update({
		where: { id: orgId },
		data: patch,
	});
	return c.json(toWire(updated), 200);
});

// ---------- members: invite ----------

const inviteMemberRoute = createRoute({
	method: "post",
	path: "/{orgId}/members",
	tags: ["Organizations"],
	request: {
		params: z.object({ orgId: z.string() }),
		body: { content: { "application/json": { schema: InviteMemberSchema } } },
	},
	middleware: [requireOrgAdmin] as const,
	responses: {
		201: {
			content: { "application/json": { schema: MembershipWithUserSchema } },
			description: "Member added",
		},
		400: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Invalid input",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "User not found",
		},
		409: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Already a member",
		},
	},
});

orgsApp.openapi(inviteMemberRoute, async (c) => {
	const { orgId } = c.req.valid("param");
	const { email, role } = c.req.valid("json");
	const prisma = getPrisma(c.env.DATABASE_URL);

	// v1 only adds existing users by email. Pending-invite tokens for
	// not-yet-registered users are a v1.5 feature (no email layer to send
	// them with anyway — see design §6.5).
	const user = await prisma.user.findUnique({ where: { email } });
	if (!user) {
		return c.json(
			{ error: "User not found", message: `No user with email ${email}` },
			404,
		);
	}

	const existing = await prisma.membership.findUnique({
		where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
	});
	if (existing) return c.json({ error: "Already a member" }, 409);

	const createdRaw = await prisma.membership.create({
		data: { organizationId: orgId, userId: user.id, role },
		include: {
			user: { select: { id: true, name: true, email: true, image: true } },
		},
	});
	const created = createdRaw as unknown as MembershipWithUser;

	return c.json(
		{
			id: created.id,
			organizationId: created.organizationId,
			userId: created.userId,
			role: created.role,
			createdAt: created.createdAt.toISOString(),
			user: {
				id: created.user.id,
				name: created.user.name,
				email: created.user.email,
				image: created.user.image,
			},
		},
		201,
	);
});

// ---------- members: remove ----------

const removeMemberRoute = createRoute({
	method: "delete",
	path: "/{orgId}/members/{userId}",
	tags: ["Organizations"],
	request: {
		params: z.object({ orgId: z.string(), userId: z.string() }),
	},
	middleware: [requireOrgAdmin] as const,
	responses: {
		200: {
			content: { "application/json": { schema: SuccessSchema } },
			description: "Removed",
		},
		400: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Cannot remove last owner",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Membership not found",
		},
	},
});

orgsApp.openapi(removeMemberRoute, async (c) => {
	const { orgId, userId } = c.req.valid("param");
	const prisma = getPrisma(c.env.DATABASE_URL);

	const target = await prisma.membership.findUnique({
		where: { organizationId_userId: { organizationId: orgId, userId } },
	});
	if (!target) return c.json({ error: "Membership not found" }, 404);

	// Don't allow removing the last owner — the org would become unmanageable.
	if (target.role === "owner") {
		const ownerCount = await prisma.membership.count({
			where: { organizationId: orgId, role: "owner" },
		});
		if (ownerCount <= 1) {
			return c.json(
				{
					error: "Cannot remove last owner",
					message: "Promote another member to owner before removing this one.",
				},
				400,
			);
		}
	}

	await prisma.membership.delete({ where: { id: target.id } });
	return c.json({ success: true as const }, 200);
});

// ---------- helpers ----------

function toWire(org: {
	id: string;
	name: string;
	slug: string;
	createdAt: Date;
	updatedAt: Date;
}) {
	return {
		id: org.id,
		name: org.name,
		slug: org.slug,
		createdAt: org.createdAt.toISOString(),
		updatedAt: org.updatedAt.toISOString(),
	};
}

async function pickAvailableSlug(
	prisma: ReturnType<typeof getPrisma>,
	base: string,
) {
	const existing = await prisma.organization.findUnique({
		where: { slug: base },
		select: { id: true },
	});
	if (!existing) return base;
	const suffix = Math.random().toString(36).slice(2, 8);
	return `${base}-${suffix}`;
}
