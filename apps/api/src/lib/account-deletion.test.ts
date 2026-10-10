// Pure unit test — no database.
import { describe, expect, it } from "bun:test";
import { type MembershipFacts, planAccountDeletion } from "./account-deletion";

function m(
	slug: string,
	role: MembershipFacts["role"],
	memberCount: number,
	ownerCount: number,
): MembershipFacts {
	return {
		role,
		organization: { id: `id-${slug}`, name: slug, slug },
		memberCount,
		ownerCount,
	};
}

describe("planAccountDeletion", () => {
	it("deletes workspaces where the user is the only member", () => {
		const plan = planAccountDeletion([m("solo", "owner", 1, 1)]);
		expect(plan.deleteWorkspaces.map((w) => w.slug)).toEqual(["solo"]);
		expect(plan.blocking).toEqual([]);
	});

	it("blocks on shared workspaces where the user is the only owner", () => {
		const plan = planAccountDeletion([m("team", "owner", 3, 1)]);
		expect(plan.blocking.map((w) => w.slug)).toEqual(["team"]);
	});

	it("just leaves shared workspaces with another owner, or as admin/member", () => {
		const plan = planAccountDeletion([
			m("co-owned", "owner", 3, 2),
			m("as-admin", "admin", 2, 1),
			m("as-member", "member", 5, 1),
		]);
		expect(plan.leaveWorkspaces.map((w) => w.slug)).toEqual([
			"co-owned",
			"as-admin",
			"as-member",
		]);
		expect(plan.deleteWorkspaces).toEqual([]);
		expect(plan.blocking).toEqual([]);
	});
});
