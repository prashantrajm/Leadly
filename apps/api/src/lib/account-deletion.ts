import type { AccountDeletionPreview } from "@leadly/schemas";
import type { getPrisma } from "./prisma";

type Prisma = ReturnType<typeof getPrisma>;

export type MembershipFacts = {
	role: "owner" | "admin" | "member";
	organization: { id: string; name: string; slug: string };
	memberCount: number;
	ownerCount: number;
};

// What deleting a user does to each workspace they're in:
//   • only member            → the workspace is deleted with the account
//   • only owner, not alone  → blocks: hand over ownership or delete it first
//   • otherwise              → they just leave (membership cascades away)
export function planAccountDeletion(
	memberships: MembershipFacts[],
): AccountDeletionPreview {
	const plan: AccountDeletionPreview = {
		deleteWorkspaces: [],
		leaveWorkspaces: [],
		blocking: [],
	};
	for (const m of memberships) {
		const ref = m.organization;
		if (m.memberCount <= 1) plan.deleteWorkspaces.push(ref);
		else if (m.role === "owner" && m.ownerCount <= 1) plan.blocking.push(ref);
		else plan.leaveWorkspaces.push(ref);
	}
	return plan;
}

export async function loadMembershipFacts(
	prisma: Prisma,
	userId: string,
): Promise<MembershipFacts[]> {
	// Accelerate drops relation/aggregate result types (CLAUDE.md, "Things
	// that bite" #1) — cast through unknown to the selected shapes.
	const memberships = (await prisma.membership.findMany({
		where: { userId },
		select: {
			role: true,
			organization: { select: { id: true, name: true, slug: true } },
		},
	})) as unknown as Array<Pick<MembershipFacts, "role" | "organization">>;
	const orgIds = memberships.map((m) => m.organization.id);
	const counts = (await prisma.membership.groupBy({
		by: ["organizationId", "role"],
		where: { organizationId: { in: orgIds } },
		_count: { _all: true },
	})) as unknown as Array<{
		organizationId: string;
		role: MembershipFacts["role"];
		_count: { _all: number };
	}>;
	return memberships.map((m) => {
		const rows = counts.filter((c) => c.organizationId === m.organization.id);
		return {
			role: m.role,
			organization: m.organization,
			memberCount: rows.reduce((n, r) => n + r._count._all, 0),
			ownerCount: rows
				.filter((r) => r.role === "owner")
				.reduce((n, r) => n + r._count._all, 0),
		};
	});
}
