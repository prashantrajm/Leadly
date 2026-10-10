import { createFileRoute, redirect } from "@tanstack/react-router";

// Leads moved to the org-wide /<org>/leads page; keep old per-agent
// links working by landing on it pre-filtered to this agent.
export const Route = createFileRoute("/$orgSlug/agents/$agentId/leads")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/$orgSlug/leads",
			params: { orgSlug: params.orgSlug },
			search: { agent: params.agentId },
			replace: true,
		});
	},
});
