import { createFileRoute, redirect } from "@tanstack/react-router";

// Analytics moved to the org-wide /<org>/analytics page; keep old per-agent
// links working by landing on it pre-filtered to this agent.
export const Route = createFileRoute("/$orgSlug/agents/$agentId/analytics")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/$orgSlug/analytics",
			params: { orgSlug: params.orgSlug },
			search: { agent: params.agentId },
			replace: true,
		});
	},
});
