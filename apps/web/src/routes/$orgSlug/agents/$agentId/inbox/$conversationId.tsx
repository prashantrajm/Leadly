import { createFileRoute, redirect } from "@tanstack/react-router";

// Conversation detail moved to /<org>/inbox/$conversationId.
export const Route = createFileRoute(
	"/$orgSlug/agents/$agentId/inbox/$conversationId",
)({
	beforeLoad: ({ params }) => {
		throw redirect({
			to: "/$orgSlug/inbox/$conversationId",
			params: {
				orgSlug: params.orgSlug,
				conversationId: params.conversationId,
			},
			replace: true,
		});
	},
});
