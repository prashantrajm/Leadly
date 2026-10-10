import { createFileRoute, redirect } from "@tanstack/react-router";

// The inbox moved to the org-wide /<org>/inbox page; keep old per-agent
// links working by landing on it pre-filtered to this agent.
export const Route = createFileRoute("/$orgSlug/agents/$agentId/inbox/")({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/$orgSlug/inbox",
			params: { orgSlug: params.orgSlug },
			search: { agent: params.agentId },
			replace: true,
		});
	},
});
