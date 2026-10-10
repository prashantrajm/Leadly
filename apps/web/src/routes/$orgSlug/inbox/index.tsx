import { createFileRoute, Link } from "@tanstack/react-router";
import { InboxIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { useOrgPath } from "@/hooks/use-current-org";
import { useInboxConversations } from "@/hooks/use-inbox-conversations";
import { useOrgAgents } from "@/hooks/use-org-agents";

// Right-hand pane of the inbox when no conversation is open.
export const Route = createFileRoute("/$orgSlug/inbox/")({
	component: InboxPlaceholder,
});

function InboxPlaceholder() {
	const search = Route.useSearch();
	const orgPath = useOrgPath();
	const { agents } = useOrgAgents();
	const q = useInboxConversations(search);
	const filtered = Boolean(search.status || search.mode);

	if (q.isLoading || !q.data) return null;

	if (q.data.items.length === 0 && !filtered) {
		const installAgentId = search.agent ?? agents[0]?.id;
		return (
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<InboxIcon />
					</EmptyMedia>
					<EmptyTitle>No conversations yet</EmptyTitle>
					<EmptyDescription>
						Once your widget is live, every visitor chat shows up here. Drop
						the script on your site, or try a round-trip in the playground.
					</EmptyDescription>
				</EmptyHeader>
				{installAgentId && (
					<EmptyContent>
						<Button asChild variant="outline" size="sm">
							<Link to={orgPath(`/agents/${installAgentId}/install`) as string}>
								Install widget
							</Link>
						</Button>
					</EmptyContent>
				)}
			</Empty>
		);
	}

	const count = q.data.items.length;
	return (
		<Empty>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<InboxIcon />
				</EmptyMedia>
				<EmptyDescription>
					{count} conversation{count === 1 ? "" : "s"}. Pick one to read the
					transcript or reply.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}
