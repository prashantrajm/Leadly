import { createFileRoute, redirect } from "@tanstack/react-router";

// Visitors moved to the org-wide /<org>/visitors page; keep old per-agent
// links working by landing on it pre-filtered to this agent.
export const Route = createFileRoute("/$orgSlug/agents/$agentId/visitors")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/$orgSlug/visitors",
			params: { orgSlug: params.orgSlug },
			search: { agent: params.agentId },
			replace: true,
		});
	},
});
