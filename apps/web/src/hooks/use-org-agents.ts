import { useQuery } from "@tanstack/react-query";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { api } from "@/lib/api";

// Agents for the current org. Shares the ["agents", orgId] cache key with
// the Agents page, so creating or deleting an agent there refreshes the
// sidebar and every agent filter without extra invalidation.
export function useOrgAgents() {
	const { currentOrg, isLoading: orgLoading } = useCurrentOrg();
	const orgId = currentOrg?.id ?? null;

	const agentsQuery = useQuery({
		queryKey: ["agents", orgId],
		queryFn: () => api.agents.list(orgId as string),
		enabled: Boolean(orgId),
	});

	return {
		orgId,
		agents: agentsQuery.data ?? [],
		isLoading: orgLoading || agentsQuery.isLoading,
	};
}
