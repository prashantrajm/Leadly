import { createFileRoute, redirect } from "@tanstack/react-router";

// Conversation detail moved to /dashboard/inbox/$conversationId.
export const Route = createFileRoute(
	"/dashboard/agents/$agentId/inbox/$conversationId",
)({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/dashboard/inbox/$conversationId",
			params: { conversationId: params.conversationId },
			replace: true,
		});
	},
});
