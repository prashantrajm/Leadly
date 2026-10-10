// The signed-in user's own account.
//
//   GET    /me/invitations       pending invites to my (verified) email
//   GET    /me/deletion-preview  what deleting the account would do
//   DELETE /me                   delete it (409 while it would orphan a
//                                shared workspace)

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
	AccountDeletionPreviewSchema,
	ErrorSchema,
	MyInvitationSchema,
	SuccessSchema,
} from "@leadly/schemas";
import {
	loadMembershipFacts,
	planAccountDeletion,
} from "../lib/account-deletion";
import { deleteOrganizationCompletely } from "../lib/org-deletion";
import { getPrisma } from "../lib/prisma";
import type { AppEnv } from "../types";

export const meApp = new OpenAPIHono<AppEnv>();

const myInvitationsRoute = createRoute({
	method: "get",
	path: "/invitations",
	tags: ["Account"],
	responses: {
		200: {
			content: { "application/json": { schema: z.array(MyInvitationSchema) } },
			description:
				"Pending invitations to the signed-in user's email (empty unless verified)",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
	},
});

meApp.openapi(myInvitationsRoute, async (c) => {
	const sessionUser = c.get("user");
	const prisma = getPrisma(c.env.DATABASE_URL);

	// Email/password sign-ups aren't verified, so anyone could register an
	// address and see its invites. Only verified emails (e.g. Google) get
	// them in-app; everyone else still joins through the shared link.
	const user = await prisma.user.findUnique({
		where: { id: sessionUser.id },
		select: { email: true, emailVerified: true },
	});
	if (!user?.emailVerified) return c.json([], 200);

	const rows = (await prisma.invitation.findMany({
		where: {
			email: user.email.trim().toLowerCase(),
			acceptedAt: null,
			revokedAt: null,
			declinedAt: null,
			expiresAt: { gt: new Date() },
			// Skip workspaces they've already joined some other way.
			organization: { memberships: { none: { userId: sessionUser.id } } },
		},
		orderBy: { createdAt: "desc" },
		select: {
			token: true,
			role: true,
			expiresAt: true,
			organization: { select: { name: true, slug: true } },
			invitedBy: { select: { name: true } },
		},
	})) as unknown as Array<{
		token: string;
		role: "owner" | "admin" | "member";
		expiresAt: Date;
		organization: { name: string; slug: string };
		invitedBy: { name: string } | null;
	}>;

	return c.json(
		rows.map((r) => ({
			token: r.token,
			organization: r.organization,
			role: r.role,
			invitedByName: r.invitedBy?.name ?? null,
			expiresAt: r.expiresAt.toISOString(),
		})),
		200,
	);
});

const previewRoute = createRoute({
	method: "get",
	path: "/deletion-preview",
	tags: ["Account"],
	responses: {
		200: {
			content: { "application/json": { schema: AccountDeletionPreviewSchema } },
			description:
				"Workspaces that would be deleted, left, or that block deletion",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
	},
});

meApp.openapi(previewRoute, async (c) => {
	const user = c.get("user");
	const prisma = getPrisma(c.env.DATABASE_URL);
	return c.json(
		planAccountDeletion(await loadMembershipFacts(prisma, user.id)),
		200,
	);
});

const deleteRoute = createRoute({
	method: "delete",
	path: "/",
	tags: ["Account"],
	responses: {
		200: {
			content: { "application/json": { schema: SuccessSchema } },
			description:
				"Account deleted, with workspaces where you were the only member",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
		409: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "You're the only owner of a shared workspace",
		},
	},
});

meApp.openapi(deleteRoute, async (c) => {
	const user = c.get("user");
	const prisma = getPrisma(c.env.DATABASE_URL);
	const plan = planAccountDeletion(await loadMembershipFacts(prisma, user.id));

	if (plan.blocking.length > 0) {
		return c.json(
			{
				error: "Transfer ownership first",
				message: `You're the only owner of ${plan.blocking
					.map((w) => w.name)
					.join(", ")}. Make another member an owner, or delete the workspace.`,
			},
			409,
		);
	}

	for (const ws of plan.deleteWorkspaces) {
		await deleteOrganizationCompletely(prisma, c.env, ws.id);
	}
	// Cascades: sessions, OAuth accounts, remaining memberships. Invitations
	// this user sent keep existing with invitedBy cleared.
	await prisma.user.delete({ where: { id: user.id } });
	return c.json({ success: true as const }, 200);
});
