import { createFileRoute, redirect } from "@tanstack/react-router";

// Analytics moved to the org-wide /dashboard/analytics page; keep old per-agent
// links working by landing on it pre-filtered to this agent.
export const Route = createFileRoute("/dashboard/agents/$agentId/analytics")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/dashboard/analytics",
			search: { agent: params.agentId },
			replace: true,
		});
	},
});
