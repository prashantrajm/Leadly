// The signed-in user's own account.
//
//   GET    /me/deletion-preview  what deleting the account would do
//   DELETE /me                   delete it (409 while it would orphan a
//                                shared workspace)

import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import {
	AccountDeletionPreviewSchema,
	ErrorSchema,
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
