import type { ConversationListItem } from "@leadly/api-client";
import { useQuery } from "@tanstack/react-query";
import {
	type AgentSearch,
	validateAgentSearch,
} from "@/components/dashboard/agent-filter";
import { useOrgAgents } from "@/hooks/use-org-agents";
import { api } from "@/lib/api";

// Inbox filters live in the URL so the list pane and the detail pane read
// the same state, and a filtered inbox can be linked or reloaded.
export type InboxSearch = AgentSearch & {
	status?: "active" | "ended";
	mode?: "auto" | "paused";
};

export function validateInboxSearch(
	search: Record<string, unknown>,
): InboxSearch {
	return {
		...validateAgentSearch(search),
		...(search.status === "active" || search.status === "ended"
			? { status: search.status }
			: {}),
		...(search.mode === "auto" || search.mode === "paused"
			? { mode: search.mode }
			: {}),
	};
}

export function useInboxConversations({ agent, status, mode }: InboxSearch) {
	const { orgId } = useOrgAgents();
	return useQuery({
		queryKey: ["conversations", orgId, agent, status ?? "all", mode ?? "all"],
		queryFn: () =>
			api.conversations.listForOrg(orgId as string, {
				agentId: agent,
				limit: 50,
				status,
				mode,
			}),
		enabled: Boolean(orgId),
		// Inbox is "live-ish" — re-fetch in the background while open so new
		// conversations appear without a manual refresh.
		refetchInterval: 10_000,
	});
}

// Who the visitor is, as far as the inbox knows.
export function visitorLabel(c: ConversationListItem) {
	return c.lead?.name ?? c.lead?.email ?? c.visitor.externalId;
}
