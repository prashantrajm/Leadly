import type { Agent, ConversationListItem } from "@leadly/api-client";
import {
	createFileRoute,
	Link,
	Outlet,
	useParams,
} from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { AgentFilter } from "@/components/dashboard/agent-filter";
import { NoAgentsState } from "@/components/dashboard/no-agents-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
	List,
	ListItem,
	ListItemContent,
	ListItemDescription,
	ListItemMeta,
	ListItemTitle,
} from "@/components/ui/list";
import { Page, PageContent, PageToolbar } from "@/components/ui/page";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrgPath } from "@/hooks/use-current-org";
import {
	type InboxSearch,
	useInboxConversations,
	validateInboxSearch,
	visitorLabel,
} from "@/hooks/use-inbox-conversations";
import { useOrgAgents } from "@/hooks/use-org-agents";
import { LeadlyApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

// Inbox is a split view: the conversation list on the left, the open
// conversation (or a placeholder) on the right. On narrow screens only one
// pane shows at a time.
export const Route = createFileRoute("/$orgSlug/inbox")({
	validateSearch: validateInboxSearch,
	component: InboxLayout,
});

function InboxLayout() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const { conversationId } = useParams({ strict: false }) as {
		conversationId?: string;
	};
	const { agents, isLoading: agentsLoading } = useOrgAgents();

	if (!agentsLoading && agents.length === 0) {
		return (
			<Page>
				<PageContent>
					<NoAgentsState what="Conversations" />
				</PageContent>
			</Page>
		);
	}

	const setSearch = (patch: Partial<InboxSearch>) =>
		navigate({ search: (prev) => ({ ...prev, ...patch }) });

	return (
		<Page>
			<PageContent width="flush" className="md:flex-row">
				<section
					aria-label="Conversations"
					className={cn(
						"flex min-h-0 flex-col md:w-[22rem] md:shrink-0 md:border-r md:border-border/60 lg:w-[24rem]",
						conversationId && "max-md:hidden",
					)}
				>
					<PageToolbar>
						<Tabs
							value={search.status ?? "all"}
							onValueChange={(v) =>
								setSearch({
									status: v === "all" ? undefined : (v as InboxSearch["status"]),
								})
							}
						>
							<TabsList>
								<TabsTrigger value="all">All</TabsTrigger>
								<TabsTrigger value="active">Active</TabsTrigger>
								<TabsTrigger value="ended">Ended</TabsTrigger>
							</TabsList>
						</Tabs>
						<Tabs
							value={search.mode ?? "all"}
							onValueChange={(v) =>
								setSearch({
									mode: v === "all" ? undefined : (v as InboxSearch["mode"]),
								})
							}
						>
							<TabsList>
								<TabsTrigger value="all">Any</TabsTrigger>
								<TabsTrigger value="paused">Live</TabsTrigger>
							</TabsList>
						</Tabs>
						<div className="ml-auto">
							<AgentFilter
								agents={agents}
								value={search.agent}
								onChange={(agent) => setSearch({ agent })}
							/>
						</div>
					</PageToolbar>
					<div className="min-h-0 flex-1 overflow-y-auto">
						<ConversationList
							search={search}
							agents={agents}
							activeId={conversationId}
							agentsLoading={agentsLoading}
						/>
					</div>
				</section>
				<section
					aria-label="Conversation"
					className={cn(
						"flex min-h-0 min-w-0 flex-1 flex-col max-md:h-[calc(100svh-3.5rem)]",
						!conversationId && "max-md:hidden",
					)}
				>
					<Outlet />
				</section>
			</PageContent>
		</Page>
	);
}

function ConversationList({
	search,
	agents,
	activeId,
	agentsLoading,
}: {
	search: InboxSearch;
	agents: Agent[];
	activeId?: string;
	agentsLoading: boolean;
}) {
	const q = useInboxConversations(search);
	const agentsById = new Map(agents.map((a) => [a.id, a]));
	// Name the agent on each row only when rows can come from several agents.
	const showAgent = !search.agent && agents.length > 1;

	if (agentsLoading || q.isLoading) {
		return (
			<div className="flex flex-col gap-1 p-2">
				{[0, 1, 2, 3, 4].map((i) => (
					<Skeleton key={i} className="h-14 rounded-lg" />
				))}
			</div>
		);
	}
	if (q.isError) {
		return (
			<p className="px-4 py-6 text-sm text-destructive md:px-6">
				{q.error instanceof LeadlyApiError
					? `API ${q.error.status}: ${q.error.message}`
					: "Could not load conversations."}
			</p>
		);
	}
	if (!q.data || q.data.items.length === 0) {
		return (
			<p className="px-4 py-6 text-sm text-muted-foreground md:px-6">
				No conversations{search.status || search.mode ? " match these filters" : " yet"}.
			</p>
		);
	}

	return (
		<List>
			{q.data.items.map((c) => (
				<ConversationRow
					key={c.id}
					conversation={c}
					agent={showAgent ? agentsById.get(c.agentId) : undefined}
					active={c.id === activeId}
				/>
			))}
		</List>
	);
}

function ConversationRow({
	conversation: c,
	agent,
	active,
}: {
	conversation: ConversationListItem;
	agent?: Agent;
	active: boolean;
}) {
	const orgPath = useOrgPath();
	const label = visitorLabel(c);
	const live = c.mode === "paused";
	const ended = c.status === "ended";

	return (
		<ListItem asChild active={active} className="items-start">
			<Link
				to={orgPath(`/inbox/${c.id}`) as string}
				search={(prev: InboxSearch) => prev}
			>
				<div
					className={cn(
						"mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium",
						live
							? "bg-accent-blue bg-sheen text-accent-blue-foreground shadow-solid"
							: "bg-card text-muted-foreground shadow-raised",
					)}
				>
					{label.charAt(0).toUpperCase()}
				</div>
				<ListItemContent>
					<ListItemTitle className={cn(ended && "text-muted-foreground")}>
						<span className="truncate">{label}</span>
						{live && (
							<span
								role="img"
								aria-label="Live"
								className="size-1.5 shrink-0 animate-pulse rounded-full bg-accent-blue"
							/>
						)}
					</ListItemTitle>
					<ListItemDescription>
						{agent && (
							<span className="inline-flex min-w-0 items-center gap-1.5">
								<span
									className="size-2 shrink-0 rounded-full"
									style={{ backgroundColor: agent.accentColor }}
								/>
								<span className="truncate">{agent.name}</span>
							</span>
						)}
						<span className="shrink-0">
							{c.turnCount} turn{c.turnCount === 1 ? "" : "s"}
							{ended && " · ended"}
						</span>
					</ListItemDescription>
				</ListItemContent>
				<ListItemMeta>
					{formatDistanceToNow(new Date(c.lastActivityAt), {
						addSuffix: false,
					})}
				</ListItemMeta>
			</Link>
		</ListItem>
	);
}
