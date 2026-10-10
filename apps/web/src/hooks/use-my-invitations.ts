import type { MyInvitation, Organization } from "@leadly/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { api } from "@/lib/api";

export const myInvitationsKey = ["my-invitations"] as const;

// Pending invitations to the signed-in user's (verified) email, with
// accept / decline. Shared by the workspace switcher, the in-app banner and
// first-workspace setup so they always agree.
export function useMyInvitations() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const query = useQuery({
		queryKey: myInvitationsKey,
		queryFn: () => api.me.invitations(),
		staleTime: 60_000,
		// Cheap call; catches invites sent while the dashboard is open.
		refetchInterval: 5 * 60_000,
	});

	const accept = useMutation({
		mutationFn: (inv: MyInvitation) => api.invitations.accept(inv.token),
		onSuccess: (org) => {
			queryClient.setQueryData<Organization[]>(["orgs"], (orgs) =>
				orgs?.some((o) => o.id === org.id) ? orgs : [...(orgs ?? []), org],
			);
			queryClient.invalidateQueries({ queryKey: ["orgs"] });
			queryClient.invalidateQueries({ queryKey: myInvitationsKey });
			navigate({ to: "/$orgSlug", params: { orgSlug: org.slug } });
		},
		onError: () =>
			queryClient.invalidateQueries({ queryKey: myInvitationsKey }),
	});

	const decline = useMutation({
		mutationFn: (inv: MyInvitation) => api.invitations.decline(inv.token),
		onSettled: () =>
			queryClient.invalidateQueries({ queryKey: myInvitationsKey }),
	});

	// Which invite a button belongs to, for per-row spinners.
	const busyToken =
		(accept.isPending && accept.variables?.token) ||
		(decline.isPending && decline.variables?.token) ||
		null;

	return {
		invitations: query.data ?? [],
		accept,
		decline,
		busyToken,
	};
}

export function describeInvitation(inv: MyInvitation): string {
	const role = inv.role === "admin" ? "an admin" : `a ${inv.role}`;
	return `${inv.invitedByName ?? "A teammate"} invited you as ${role}`;
}
