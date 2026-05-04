import { z } from "@hono/zod-openapi";
import { Cuid, IsoDate } from "./common.ts";
import { MembershipRole } from "./enums.ts";

// ---------- Organization ----------

export const OrganizationSchema = z
	.object({
		id: Cuid,
		name: z.string(),
		slug: z.string(),
		createdAt: IsoDate,
		updatedAt: IsoDate,
	})
	.openapi("Organization");
export type Organization = z.infer<typeof OrganizationSchema>;

export const CreateOrganizationSchema = z
	.object({
		name: z.string().min(2).max(100),
		// slug is derived server-side from name on create; updates can override.
	})
	.openapi("CreateOrganization");
export type CreateOrganization = z.infer<typeof CreateOrganizationSchema>;

export const UpdateOrganizationSchema = z
	.object({
		name: z.string().min(2).max(100).optional(),
		slug: z.string().min(2).max(64).regex(/^[a-z0-9-]+$/).optional(),
	})
	.openapi("UpdateOrganization");
export type UpdateOrganization = z.infer<typeof UpdateOrganizationSchema>;

// ---------- Membership ----------

export const MembershipSchema = z
	.object({
		id: Cuid,
		organizationId: Cuid,
		userId: Cuid,
		role: MembershipRole,
		createdAt: IsoDate,
	})
	.openapi("Membership");
export type Membership = z.infer<typeof MembershipSchema>;

export const MembershipWithUserSchema = MembershipSchema.extend({
	user: z.object({
		id: Cuid,
		name: z.string(),
		email: z.string(),
		image: z.string().nullable(),
	}),
}).openapi("MembershipWithUser");
export type MembershipWithUser = z.infer<typeof MembershipWithUserSchema>;

export const InviteMemberSchema = z
	.object({
		email: z.string().email(),
		role: MembershipRole.default("member"),
	})
	.openapi("InviteMember");
export type InviteMember = z.infer<typeof InviteMemberSchema>;

// ---------- Composed views ----------

export const OrganizationWithMembersSchema = OrganizationSchema.extend({
	memberships: z.array(MembershipWithUserSchema),
}).openapi("OrganizationWithMembers");
export type OrganizationWithMembers = z.infer<typeof OrganizationWithMembersSchema>;
