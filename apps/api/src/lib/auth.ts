import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { slugify } from "@leadly/utils";
import { getPrisma } from "./prisma";

export const getAuth = (env: {
	DATABASE_URL: string;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL?: string;
	GOOGLE_CLIENT_ID?: string;
	GOOGLE_CLIENT_SECRET?: string;
	CORS_ORIGIN?: string;
}) => {
	const prisma = getPrisma(env.DATABASE_URL);

	return betterAuth({
		database: prismaAdapter(prisma, {
			provider: "postgresql",
		}),
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		trustedOrigins: env.CORS_ORIGIN
			? env.CORS_ORIGIN.split(",")
					.map((o) => o.trim())
					.filter(Boolean)
			: [],
		user: {
			additionalFields: {
				isOnboarded: {
					type: "boolean",
					required: false,
					defaultValue: false,
					input: false,
				},
			},
		},
		databaseHooks: {
			user: {
				create: {
					// Every new user gets a personal Organization with themselves
					// as owner. Multi-tenancy is baked in from day one even though
					// the v1 dashboard only ever surfaces one org per user. Without
					// this, a fresh sign-up would land on a dashboard with no
					// org-scoped resources to manage.
					after: async (user) => {
						await ensurePersonalOrganization(prisma, {
							id: user.id,
							name: user.name,
							email: user.email,
						});
					},
				},
			},
		},
		emailAndPassword: {
			enabled: true,
		},
		socialProviders: {
			google: {
				clientId: env.GOOGLE_CLIENT_ID as string,
				clientSecret: env.GOOGLE_CLIENT_SECRET as string,
			},
		},
		advanced: {
			defaultCookieAttributes: {
				sameSite: "none",
				secure: true,
				httpOnly: true,
			},
		},
	});
};

// Idempotent: safe to re-run on re-login or on retry. We check membership
// existence rather than relying on a "first login" flag because Better Auth
// fires `user.create.after` only once anyway, but social-login flows have
// historically had edge cases where this hook can fire twice.
async function ensurePersonalOrganization(
	prisma: ReturnType<typeof getPrisma>,
	user: { id: string; name: string; email: string },
) {
	const existing = await prisma.membership.findFirst({
		where: { userId: user.id },
		select: { id: true },
	});
	if (existing) return;

	const baseName = user.name?.trim() || user.email.split("@")[0] || "Personal";
	const baseSlug = slugify(baseName) || `user-${user.id.slice(0, 8)}`;

	// Slug uniqueness collision is rare but possible (two users named "Acme").
	// Append a 6-char random suffix on conflict and try once more — if that
	// fails, surface the error rather than looping forever.
	const slug = await pickAvailableSlug(prisma, baseSlug);

	await prisma.organization.create({
		data: {
			name: `${baseName}'s workspace`,
			slug,
			memberships: {
				create: {
					userId: user.id,
					role: "owner",
				},
			},
		},
	});
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
