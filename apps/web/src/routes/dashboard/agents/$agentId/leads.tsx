import { createFileRoute, redirect } from "@tanstack/react-router";

// Leads moved to the org-wide /dashboard/leads page; keep old per-agent
// links working by landing on it pre-filtered to this agent.
export const Route = createFileRoute("/dashboard/agents/$agentId/leads")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/dashboard/leads",
			search: { agent: params.agentId },
			replace: true,
		});
	},
});
