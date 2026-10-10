import { createFileRoute, redirect } from "@tanstack/react-router";

// Visitors moved to the org-wide /dashboard/visitors page; keep old per-agent
// links working by landing on it pre-filtered to this agent.
export const Route = createFileRoute("/dashboard/agents/$agentId/visitors")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/dashboard/visitors",
			search: { agent: params.agentId },
			replace: true,
		});
	},
});
