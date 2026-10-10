import { z } from "@hono/zod-openapi";
import { Cuid, IsoDate } from "./common.ts";
import { MembershipRole } from "./enums.ts";

// ---------- Organization slugs ----------
//
// The dashboard lives at /<orgSlug>/… on the same domain as the marketing
// site, and the router resolves static routes before the slug. A slug equal
// to a top-level page (/pricing, /docs, …) would therefore be unreachable,
// so these are refused on rename and suffixed on create. Every new
// top-level web route must be added here — a web test enforces it.
export const RESERVED_ORG_SLUGS: ReadonlySet<string> = new Set([
	// current top-level web routes
	"about", "auth", "blog", "careers", "changelog", "community", "contact-us",
	"dashboard", "docs", "guides", "help", "integrations", "pricing",
	"privacy-policy", "refund-policy", "terms-and-conditions",
	// likely future marketing / legal pages
	"contact", "customers", "enterprise", "features", "legal", "partners",
	"press", "privacy", "security", "status", "support", "terms", "jobs",
	"team", "templates", "use-cases", "compare", "solutions", "demo",
	// auth & account flows
	"login", "logout", "signin", "sign-in", "signup", "sign-up", "register",
	"oauth", "callback", "verify", "invite", "invitations", "onboarding",
	"account", "billing", "new", "join",
	// app sections and infrastructure
	"agents", "analytics", "inbox", "leads", "visitors", "overview", "home",
	"settings", "profile", "admin", "api", "app", "assets", "cdn", "embed",
	"static", "public", "widget", "www", "mail", "org", "orgs", "sitemap",
	"robots",
]);

export function isReservedOrgSlug(slug: string): boolean {
	return RESERVED_ORG_SLUGS.has(slug);
}

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

// The workspace URL segment: /<slug>/inbox. Reserved words would shadow a
// top-level page, so they're refused here and in the availability check.
export const OrgSlugSchema = z
	.string()
	.min(2, "At least 2 characters")
	.max(64, "At most 64 characters")
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and single dashes")
	.refine((s) => !isReservedOrgSlug(s), {
		message: "This URL is reserved. Pick another.",
	});

export const CreateOrganizationSchema = z
	.object({
		name: z.string().trim().min(2).max(100),
		// Optional: derived from name server-side when omitted.
		slug: OrgSlugSchema.optional(),
	})
	.openapi("CreateOrganization");
export type CreateOrganization = z.infer<typeof CreateOrganizationSchema>;

export const UpdateOrganizationSchema = z
	.object({
		name: z.string().min(2).max(100).optional(),
		slug: OrgSlugSchema.optional(),
	})
	.openapi("UpdateOrganization");
export type UpdateOrganization = z.infer<typeof UpdateOrganizationSchema>;

// Live "is this workspace URL free?" check for the create / rename forms.
// When unavailable, `suggestion` is a nearby slug that is free.
export const OrgSlugAvailabilitySchema = z
	.object({
		slug: z.string(),
		available: z.boolean(),
		reason: z.enum(["invalid", "reserved", "taken"]).nullable(),
		suggestion: z.string().nullable(),
	})
	.openapi("OrgSlugAvailability");
export type OrgSlugAvailability = z.infer<typeof OrgSlugAvailabilitySchema>;

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

// Owners can change anyone's role (incl. making someone else owner);
// the last owner can't be demoted.
export const UpdateMemberRoleSchema = z
	.object({ role: MembershipRole })
	.openapi("UpdateMemberRole");
export type UpdateMemberRole = z.infer<typeof UpdateMemberRoleSchema>;

// ---------- Invitations ----------
//
// An admin invites an email; the API returns a token the dashboard turns
// into a /invite/<token> link. Only a signed-in user with that email can
// accept it. No email provider yet, so the admin shares the link.

export const CreateInvitationSchema = z
	.object({
		email: z.string().trim().toLowerCase().email(),
		role: MembershipRole.default("member"),
	})
	.openapi("CreateInvitation");
export type CreateInvitation = z.infer<typeof CreateInvitationSchema>;

export const InvitationSchema = z
	.object({
		id: Cuid,
		organizationId: Cuid,
		email: z.string(),
		role: MembershipRole,
		token: z.string(),
		createdAt: IsoDate,
		expiresAt: IsoDate,
		invitedBy: z.object({ name: z.string(), email: z.string() }).nullable(),
	})
	.openapi("Invitation");
export type Invitation = z.infer<typeof InvitationSchema>;

export const InvitationStatus = z
	.enum(["pending", "accepted", "revoked", "expired"])
	.openapi("InvitationStatus");
export type InvitationStatus = z.infer<typeof InvitationStatus>;

// What the invite page shows before accepting.
export const InvitationPreviewSchema = z
	.object({
		organization: z.object({ name: z.string(), slug: z.string() }),
		email: z.string(),
		role: MembershipRole,
		invitedByName: z.string().nullable(),
		status: InvitationStatus,
		// Whether the signed-in user's email is the invited one.
		emailMatches: z.boolean(),
		alreadyMember: z.boolean(),
	})
	.openapi("InvitationPreview");
export type InvitationPreview = z.infer<typeof InvitationPreviewSchema>;

// ---------- Account deletion ----------

const WorkspaceRefSchema = z.object({ id: Cuid, name: z.string(), slug: z.string() });

// What deleting your account would do. `blocking` are shared workspaces
// where you're the only owner: hand ownership over (or delete the
// workspace) first.
export const AccountDeletionPreviewSchema = z
	.object({
		deleteWorkspaces: z.array(WorkspaceRefSchema),
		leaveWorkspaces: z.array(WorkspaceRefSchema),
		blocking: z.array(WorkspaceRefSchema),
	})
	.openapi("AccountDeletionPreview");
export type AccountDeletionPreview = z.infer<typeof AccountDeletionPreviewSchema>;

// ---------- Composed views ----------

export const OrganizationWithMembersSchema = OrganizationSchema.extend({
	memberships: z.array(MembershipWithUserSchema),
}).openapi("OrganizationWithMembers");
export type OrganizationWithMembers = z.infer<typeof OrganizationWithMembersSchema>;
