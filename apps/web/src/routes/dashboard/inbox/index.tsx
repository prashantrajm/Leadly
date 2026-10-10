import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Inbox as InboxIcon, MessageSquare } from "lucide-react";
import { useState } from "react";
import {
	AgentFilter,
	validateAgentSearch,
} from "@/components/dashboard/agent-filter";
import { NoAgentsState } from "@/components/dashboard/no-agents-state";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tabs,
	TabsList,
	TabsTrigger,
} from "@/components/ui/tabs";
import { useOrgAgents } from "@/hooks/use-org-agents";
import { api, LeadlyApiError } from "@/lib/api";
import type { Agent, ConversationListItem } from "@leadly/api-client";

type StatusFilter = "all" | "active" | "ended";
type ModeFilter = "all" | "auto" | "paused";

export const Route = createFileRoute("/dashboard/inbox/")({
	validateSearch: validateAgentSearch,
	component: InboxList,
});

function InboxList() {
	const { agent: agentId } = Route.useSearch();
	const navigate = Route.useNavigate();
	const { orgId, agents, isLoading: agentsLoading } = useOrgAgents();
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [modeFilter, setModeFilter] = useState<ModeFilter>("all");

	const q = useQuery({
		queryKey: ["conversations", orgId, agentId, statusFilter, modeFilter],
		queryFn: () =>
			api.conversations.listForOrg(orgId as string, {
				agentId,
				limit: 50,
				status: statusFilter === "all" ? undefined : statusFilter,
				mode: modeFilter === "all" ? undefined : modeFilter,
			}),
		enabled: Boolean(orgId),
		// Inbox is "live-ish" — re-fetch in the background while open so new
		// conversations appear without a manual refresh.
		refetchInterval: 10_000,
	});

	const agentsById = new Map(agents.map((a) => [a.id, a]));

	return (
		<div className="mx-auto max-w-6xl">
			<header className="mb-8">
				<h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Every conversation across your agents. Refreshes every 10 seconds.
				</p>
			</header>

			<div className="mb-5 flex flex-wrap items-center gap-3">
				<AgentFilter
					agents={agents}
					value={agentId}
					onChange={(agent) => navigate({ search: { agent } })}
				/>
				<Tabs
					value={statusFilter}
					onValueChange={(v) => setStatusFilter(v as StatusFilter)}
				>
					<TabsList>
						<TabsTrigger value="all">All</TabsTrigger>
						<TabsTrigger value="active">Active</TabsTrigger>
						<TabsTrigger value="ended">Ended</TabsTrigger>
					</TabsList>
				</Tabs>
				<Tabs
					value={modeFilter}
					onValueChange={(v) => setModeFilter(v as ModeFilter)}
				>
					<TabsList>
						<TabsTrigger value="all">Any mode</TabsTrigger>
						<TabsTrigger value="auto">Auto</TabsTrigger>
						<TabsTrigger value="paused">Live</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>

			{agentsLoading || q.isLoading ? (
				<div className="space-y-3">
					{[0, 1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-20 rounded-xl" />
					))}
				</div>
			) : q.isError ? (
				<div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
					{q.error instanceof LeadlyApiError
						? `API ${q.error.status}: ${q.error.message}`
						: "Could not load conversations."}
				</div>
			) : agents.length === 0 ? (
				<NoAgentsState what="Conversations" />
			) : !q.data || q.data.items.length === 0 ? (
				<EmptyState installAgentId={agentId ?? agents[0].id} />
			) : (
				<div className="space-y-3">
					{q.data.items.map((c) => (
						<ConversationRow
							key={c.id}
							conversation={c}
							// Name the agent on each row only when rows can come
							// from more than one agent.
							agent={!agentId && agents.length > 1 ? agentsById.get(c.agentId) : undefined}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function EmptyState({ installAgentId }: { installAgentId: string }) {
	return (
		<Card>
			<CardContent className="flex flex-col items-center py-14 text-center">
				<div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-accent-blue/10 text-accent-blue">
					<InboxIcon className="size-6" />
				</div>
				<h2 className="text-lg font-semibold tracking-tight">
					No conversations yet.
				</h2>
				<p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
					Once your widget is live, every visitor chat shows up here. Drop
					the script on your site, or try a round-trip in the playground.
				</p>
				<div className="mt-6 flex items-center gap-2">
					<Link
						to={`/dashboard/agents/${installAgentId}/install` as string}
						className="text-sm font-medium text-accent-blue hover:underline"
					>
						Install widget →
					</Link>
				</div>
			</CardContent>
		</Card>
	);
}

function ConversationRow({
	conversation,
	agent,
}: {
	conversation: ConversationListItem;
	agent?: Agent;
}) {
	const c = conversation;
	const visitorLabel = c.lead?.name ?? c.lead?.email ?? c.visitor.externalId;
	const live = c.mode === "paused";
	const ended = c.status === "ended";

	return (
		<Link
			to={`/dashboard/inbox/${c.id}` as string}
			className="group block"
		>
			<Card className="transition-colors hover:border-accent-blue/30">
				<CardContent className="flex items-center gap-4 p-4">
					<div
						className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
							live
								? "bg-accent-blue text-accent-blue-foreground"
								: "border border-border bg-secondary/40 text-foreground"
						}`}
					>
						{visitorLabel.charAt(0).toUpperCase()}
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<h3 className="truncate text-sm font-semibold tracking-tight">
								{visitorLabel}
							</h3>
							{live && (
								<span className="inline-flex items-center gap-1 rounded-full bg-accent-blue/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-accent-blue">
									<span className="size-1 animate-pulse rounded-full bg-accent-blue" />
									Live
								</span>
							)}
							{ended && (
								<span className="rounded-full border border-border bg-card px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
									Ended
								</span>
							)}
						</div>
						<div className="mt-1 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
							{agent && (
								<>
									<span className="inline-flex items-center gap-1.5 normal-case tracking-normal">
										<span
											className="size-2 rounded-full"
											style={{ backgroundColor: agent.accentColor }}
										/>
										{agent.name}
									</span>
									<span className="size-1 rounded-full bg-muted-foreground/40" />
								</>
							)}
							<span className="inline-flex items-center gap-1">
								<MessageSquare className="size-3" />
								{c.turnCount} turn{c.turnCount === 1 ? "" : "s"}
							</span>
							<span className="size-1 rounded-full bg-muted-foreground/40" />
							<span>
								{formatDistanceToNow(new Date(c.lastActivityAt), {
									addSuffix: true,
								})}
							</span>
						</div>
					</div>
					<ArrowRight className="size-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-accent-blue" />
				</CardContent>
			</Card>
		</Link>
	);
}
