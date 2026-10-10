import { createFileRoute, redirect } from "@tanstack/react-router";

// The inbox moved to the org-wide /dashboard/inbox page; keep old per-agent
// links working by landing on it pre-filtered to this agent.
export const Route = createFileRoute("/dashboard/agents/$agentId/inbox/")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/dashboard/inbox",
			search: { agent: params.agentId },
			replace: true,
		});
	},
});
