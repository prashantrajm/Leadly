// Workspace invitations.
//
//   orgInvitationsApp — /orgs/:orgId/invitations (admins)
//     GET    /                 pending invitations
//     POST   /                 invite an email (re-inviting refreshes the
//                              existing pending invite and keeps its link)
//     DELETE /{invitationId}   revoke
//
//   invitationsApp — /invitations (any signed-in user holding the link)
//     GET  /{token}            preview: workspace, role, status
//     POST /{token}/accept     join — only if your email is the invited one
//
// The token is the secret in the /invite/<token> link. Requiring the
// invitee's email on top means a forwarded link is useless to anyone else.

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
	CreateInvitationSchema,
	ErrorSchema,
	type InvitationStatus,
	InvitationPreviewSchema,
	InvitationSchema,
	OrganizationSchema,
	SuccessSchema,
} from "@leadly/schemas";
import { getPrisma } from "../lib/prisma";
import { requireOrgAdmin } from "../middleware/org";
import type { AppEnv } from "../types";

export const orgInvitationsApp = new OpenAPIHono<AppEnv>();
export const invitationsApp = new OpenAPIHono<AppEnv>();

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

type InvitationRow = {
	id: string;
	organizationId: string;
	email: string;
	role: "owner" | "admin" | "member";
	token: string;
	createdAt: Date;
	expiresAt: Date;
	acceptedAt: Date | null;
	revokedAt: Date | null;
	invitedBy: { name: string; email: string } | null;
};

// ---------- list (admins) ----------

const listRoute = createRoute({
	method: "get",
	path: "/",
	tags: ["Invitations"],
	request: { params: z.object({ orgId: z.string() }) },
	middleware: [requireOrgAdmin] as const,
	responses: {
		200: {
			content: { "application/json": { schema: z.array(InvitationSchema) } },
			description: "Pending invitations, newest first",
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

orgInvitationsApp.openapi(listRoute, async (c) => {
	const { orgId } = c.req.valid("param");
	const prisma = getPrisma(c.env.DATABASE_URL);
	const rows = (await prisma.invitation.findMany({
		where: {
			organizationId: orgId,
			acceptedAt: null,
			revokedAt: null,
			expiresAt: { gt: new Date() },
		},
		orderBy: { createdAt: "desc" },
		include: { invitedBy: { select: { name: true, email: true } } },
	})) as unknown as InvitationRow[];
	return c.json(rows.map(toWire), 200);
});

// ---------- create (admins) ----------

const createInvitationRoute = createRoute({
	method: "post",
	path: "/",
	tags: ["Invitations"],
	request: {
		params: z.object({ orgId: z.string() }),
		body: {
			content: { "application/json": { schema: CreateInvitationSchema } },
		},
	},
	middleware: [requireOrgAdmin] as const,
	responses: {
		201: {
			content: { "application/json": { schema: InvitationSchema } },
			description: "Invitation created (or refreshed)",
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
		409: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Already a member",
		},
	},
});

orgInvitationsApp.openapi(createInvitationRoute, async (c) => {
	const { orgId } = c.req.valid("param");
	const { email, role } = c.req.valid("json");
	const user = c.get("user");
	const membership = c.get("membership");
	const prisma = getPrisma(c.env.DATABASE_URL);

	if (role === "owner" && membership?.role !== "owner") {
		return c.json(
			{
				error: "Forbidden",
				message: "Only an owner can invite another owner.",
			},
			403,
		);
	}

	const existingMember = await prisma.membership.findFirst({
		where: {
			organizationId: orgId,
			user: { email: { equals: email, mode: "insensitive" } },
		},
		select: { id: true },
	});
	if (existingMember) {
		return c.json({ error: "Already a member of this workspace." }, 409);
	}

	const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
	const pending = await prisma.invitation.findFirst({
		where: {
			organizationId: orgId,
			email,
			acceptedAt: null,
			revokedAt: null,
			expiresAt: { gt: new Date() },
		},
		select: { id: true },
	});

	const include = { invitedBy: { select: { name: true, email: true } } };
	const row = (pending
		? await prisma.invitation.update({
				where: { id: pending.id },
				data: { role, expiresAt, invitedById: user.id },
				include,
			})
		: await prisma.invitation.create({
				data: {
					organizationId: orgId,
					email,
					role,
					token: newInviteToken(),
					invitedById: user.id,
					expiresAt,
				},
				include,
			})) as unknown as InvitationRow;
	return c.json(toWire(row), 201);
});

// ---------- revoke (admins) ----------

const revokeRoute = createRoute({
	method: "delete",
	path: "/{invitationId}",
	tags: ["Invitations"],
	request: {
		params: z.object({ orgId: z.string(), invitationId: z.string() }),
	},
	middleware: [requireOrgAdmin] as const,
	responses: {
		200: {
			content: { "application/json": { schema: SuccessSchema } },
			description: "Revoked",
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
			description: "Not found",
		},
	},
});

orgInvitationsApp.openapi(revokeRoute, async (c) => {
	const { orgId, invitationId } = c.req.valid("param");
	const prisma = getPrisma(c.env.DATABASE_URL);
	const { count } = await prisma.invitation.updateMany({
		where: { id: invitationId, organizationId: orgId, acceptedAt: null },
		data: { revokedAt: new Date() },
	});
	if (count === 0) return c.json({ error: "Invitation not found" }, 404);
	return c.json({ success: true as const }, 200);
});

// ---------- preview (invitee) ----------

const previewRoute = createRoute({
	method: "get",
	path: "/{token}",
	tags: ["Invitations"],
	request: { params: z.object({ token: z.string() }) },
	responses: {
		200: {
			content: { "application/json": { schema: InvitationPreviewSchema } },
			description: "What accepting this invitation would do",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
		404: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "No such invitation",
		},
	},
});

invitationsApp.openapi(previewRoute, async (c) => {
	const { token } = c.req.valid("param");
	const user = c.get("user");
	const prisma = getPrisma(c.env.DATABASE_URL);
	const invite = await loadByToken(prisma, token);
	if (!invite) return c.json({ error: "Invitation not found" }, 404);

	const alreadyMember = Boolean(
		await prisma.membership.findUnique({
			where: {
				organizationId_userId: {
					organizationId: invite.organizationId,
					userId: user.id,
				},
			},
			select: { id: true },
		}),
	);

	return c.json(
		{
			organization: invite.organization,
			email: invite.email,
			role: invite.role,
			invitedByName: invite.invitedBy?.name ?? null,
			status: statusOf(invite),
			emailMatches: emailMatches(user.email, invite.email),
			alreadyMember,
		},
		200,
	);
});

// ---------- accept (invitee) ----------

const acceptRoute = createRoute({
	method: "post",
	path: "/{token}/accept",
	tags: ["Invitations"],
	request: { params: z.object({ token: z.string() }) },
	responses: {
		200: {
			content: { "application/json": { schema: OrganizationSchema } },
			description: "Joined; returns the workspace",
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
			description: "No such invitation",
		},
		410: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Revoked, expired, or already used",
		},
	},
});

invitationsApp.openapi(acceptRoute, async (c) => {
	const { token } = c.req.valid("param");
	const user = c.get("user");
	const prisma = getPrisma(c.env.DATABASE_URL);
	const invite = await loadByToken(prisma, token);
	if (!invite) return c.json({ error: "Invitation not found" }, 404);

	const status = statusOf(invite);
	if (status !== "pending") {
		return c.json({ error: `This invitation is ${status}.` }, 410);
	}
	if (!emailMatches(user.email, invite.email)) {
		return c.json(
			{
				error: "Forbidden",
				message: `This invitation is for ${invite.email}. Sign in with that email to accept it.`,
			},
			403,
		);
	}

	const membershipKey = {
		organizationId_userId: {
			organizationId: invite.organizationId,
			userId: user.id,
		},
	};
	await prisma.$transaction([
		prisma.membership.upsert({
			where: membershipKey,
			create: {
				organizationId: invite.organizationId,
				userId: user.id,
				role: invite.role,
			},
			// Already a member (e.g. added another way): keep their role.
			update: {},
		}),
		prisma.invitation.update({
			where: { id: invite.id },
			data: { acceptedAt: new Date() },
		}),
	]);

	const org = await prisma.organization.findUniqueOrThrow({
		where: { id: invite.organizationId },
	});
	return c.json(
		{
			id: org.id,
			name: org.name,
			slug: org.slug,
			createdAt: org.createdAt.toISOString(),
			updatedAt: org.updatedAt.toISOString(),
		},
		200,
	);
});

// ---------- helpers ----------

async function loadByToken(
	prisma: ReturnType<typeof getPrisma>,
	token: string,
) {
	return (await prisma.invitation.findUnique({
		where: { token },
		include: {
			organization: { select: { name: true, slug: true } },
			invitedBy: { select: { name: true, email: true } },
		},
	})) as unknown as
		| (InvitationRow & { organization: { name: string; slug: string } })
		| null;
}

export function statusOf(invite: {
	acceptedAt: Date | null;
	revokedAt: Date | null;
	expiresAt: Date;
}): InvitationStatus {
	if (invite.revokedAt) return "revoked";
	if (invite.acceptedAt) return "accepted";
	if (invite.expiresAt.getTime() <= Date.now()) return "expired";
	return "pending";
}

export function emailMatches(userEmail: string, invitedEmail: string): boolean {
	return userEmail.trim().toLowerCase() === invitedEmail.trim().toLowerCase();
}

// 32 random bytes, base64url — unguessable, URL-safe.
export function newInviteToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function toWire(row: InvitationRow) {
	return {
		id: row.id,
		organizationId: row.organizationId,
		email: row.email,
		role: row.role,
		token: row.token,
		createdAt: row.createdAt.toISOString(),
		expiresAt: row.expiresAt.toISOString(),
		invitedBy: row.invitedBy,
	};
}
