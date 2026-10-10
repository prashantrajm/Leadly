import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRightIcon,
	BotIcon,
	CheckIcon,
	InboxIcon,
	MessageIcon,
	TrendingUpIcon,
	UserPlusIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	List,
	ListItem,
	ListItemContent,
	ListItemMeta,
	ListItemTitle,
} from "@/components/ui/list";
import { Page, PageContent } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCurrentOrg, useOrgPath } from "@/hooks/use-current-org";
import { api } from "@/lib/api";
import { Kpi } from "@/components/dashboard/kpi";
import { StatGroup } from "@/components/ui/stat";

export const Route = createFileRoute("/$orgSlug/")({
	component: DashboardOverview,
});

function DashboardOverview() {
	const { currentOrg, isLoading: orgLoading } = useCurrentOrg();

	if (orgLoading) {
		return (
			<Page>
				<PageContent>
					<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
						{[0, 1, 2, 3].map((i) => (
							<Skeleton key={i} className="h-20 rounded-lg" />
						))}
					</div>
				</PageContent>
			</Page>
		);
	}

	if (!currentOrg) {
		return (
			<Page>
				<PageContent>
					<EmptyState />
				</PageContent>
			</Page>
		);
	}

	return <DashboardOverviewBody orgId={currentOrg.id} />;
}

function EmptyState() {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyTitle>Welcome to Leadly</EmptyTitle>
				<EmptyDescription>
					You don't have a workspace yet.{" "}
					<Link to="/dashboard">Create one</Link> to get started.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

function DashboardOverviewBody({ orgId }: { orgId: string }) {
	const agentsQuery = useQuery({
		queryKey: ["agents", orgId],
		queryFn: () => api.agents.list(orgId),
	});

	const agents = agentsQuery.data ?? [];

	const summaryQuery = useQuery({
		queryKey: ["org-analytics-summary", orgId, undefined, 7],
		queryFn: () => api.analytics.orgSummary(orgId, { windowDays: 7 }),
		staleTime: 60_000,
	});

	const summariesLoading = summaryQuery.isLoading;
	const totals = {
		conversations: summaryQuery.data?.conversations ?? 0,
		leadsCaptured: summaryQuery.data?.leadsCaptured ?? 0,
		handoffs: summaryQuery.data?.handoffs ?? 0,
	};
	const avgTurns = summaryQuery.data?.avgTurnsPerConv ?? 0;

	return (
		<Page>
			{/* KPIs: one flat strip, hairlines between cells */}
			<StatGroup>
				<Kpi
					label="Conversations"
					value={totals.conversations}
					sub="last 7 days"
					icon={MessageIcon}
					loading={summariesLoading || agentsQuery.isLoading}
				/>
				<Kpi
					label="Leads captured"
					value={totals.leadsCaptured}
					sub="last 7 days"
					icon={UserPlusIcon}
					accent
					loading={summariesLoading || agentsQuery.isLoading}
				/>
				<Kpi
					label="Handoffs"
					value={totals.handoffs}
					sub="last 7 days"
					icon={InboxIcon}
					loading={summariesLoading || agentsQuery.isLoading}
				/>
				<Kpi
					label="Avg turns / conv"
					value={Number(avgTurns.toFixed(1))}
					sub="last 7 days"
					icon={TrendingUpIcon}
					loading={summariesLoading || agentsQuery.isLoading}
				/>
			</StatGroup>

			{/* Setup checklist + agents, side by side on wide screens. Same
			    4-column grid as the stat strip, and the divider is the left
			    column's right border, like the stat cells', so it lines up to
			    the pixel. */}
			<div className="flex flex-1 flex-col lg:grid lg:grid-cols-4">
				<SetupChecklist agents={agents} />
				<AgentsSummary agents={agents} />
			</div>
		</Page>
	);
}

function SetupChecklist({
	agents,
}: {
	agents: Array<{ id: string; name: string }>;
}) {
	const orgPath = useOrgPath();
	const firstAgent = agents[0];

	const kbQuery = useQuery({
		queryKey: ["kb", firstAgent?.id ?? "_none_"],
		queryFn: () =>
			firstAgent ? api.kb.list(firstAgent.id) : Promise.resolve([]),
		enabled: Boolean(firstAgent),
	});

	const conversationsQuery = useQuery({
		queryKey: ["conversations-any", firstAgent?.id ?? "_none_"],
		queryFn: () =>
			firstAgent
				? api.conversations.list(firstAgent.id, { limit: 1 })
				: Promise.resolve({ items: [], nextCursor: null }),
		enabled: Boolean(firstAgent),
	});

	const hasAgent = agents.length > 0;
	const hasKb = (kbQuery.data?.length ?? 0) > 0;
	const hasConversation = (conversationsQuery.data?.items.length ?? 0) > 0;

	const steps = [
		{
			title: "Create your first agent",
			done: hasAgent,
			cta: hasAgent ? null : { label: "Create agent", to: orgPath("/agents") },
		},
		{
			title: "Write a few KB articles",
			done: hasKb,
			cta:
				hasAgent && !hasKb && firstAgent
					? {
							label: "Open knowledge base",
							to: orgPath(`/agents/${firstAgent.id}/knowledge`),
						}
					: null,
			disabled: !hasAgent,
		},
		{
			title: "Install the widget",
			done: hasConversation, // proxy: a conversation means the widget is live
			cta:
				hasAgent && firstAgent
					? {
							label: "Get install snippet",
							to: orgPath(`/agents/${firstAgent.id}/install`),
						}
					: null,
			disabled: !hasAgent,
		},
		{
			title: "Receive your first conversation",
			done: hasConversation,
			cta:
				hasAgent && firstAgent
					? {
							label: "Open inbox",
							to: orgPath("/inbox"),
						}
					: null,
			disabled: !hasAgent,
		},
	];

	const completed = steps.filter((s) => s.done).length;

	return (
		<section aria-label="Get set up" className="flex min-w-0 flex-1 flex-col border-border/60 lg:col-span-3 lg:border-r">
			<ColumnHeader
				title="Get set up"
				description={
					completed === steps.length
						? "All set. Your agent is live."
						: `${completed} of ${steps.length} steps done.`
				}
				meta={`${Math.round((completed / steps.length) * 100)}%`}
			/>
			<List>
				{steps.map((step, i) => (
					<ListItem
						key={step.title}
						className={cn(step.disabled && !step.done && "opacity-60")}
					>
						<div
							className={cn(
								"flex size-6 shrink-0 items-center justify-center rounded-full",
								step.done
									? "bg-accent-blue text-accent-blue-foreground"
									: "bg-muted text-muted-foreground",
							)}
						>
							{step.done ? (
								<CheckIcon className="size-3.5" />
							) : (
								<span className="text-xs tabular-nums">{i + 1}</span>
							)}
						</div>
						<ListItemContent>
							<ListItemTitle
								className={cn(
									"font-normal",
									step.done && "text-muted-foreground line-through decoration-muted-foreground/40",
								)}
							>
								{step.title}
							</ListItemTitle>
						</ListItemContent>
						{step.cta && (
							<ListItemMeta>
								<Button asChild size="sm" variant="ghost">
									<Link to={step.cta.to}>
										{step.cta.label}
										<ArrowRightIcon />
									</Link>
								</Button>
							</ListItemMeta>
						)}
					</ListItem>
				))}
			</List>
		</section>
	);
}

// Heading row at the top of an overview column.
function ColumnHeader({
	title,
	description,
	meta,
}: {
	title: string;
	description: string;
	meta?: string;
}) {
	return (
		<div className="flex items-start justify-between gap-4 px-4 pt-6 pb-2 md:px-6">
			<div className="flex flex-col gap-1">
				<h2 className="text-sm font-medium">{title}</h2>
				<p className="text-[13px] text-muted-foreground">{description}</p>
			</div>
			{meta && (
				<span className="text-xs text-muted-foreground tabular-nums">
					{meta}
				</span>
			)}
		</div>
	);
}

function AgentsSummary({
	agents,
}: {
	agents: Array<{ id: string; name: string; slug: string; accentColor: string }>;
}) {
	const orgPath = useOrgPath();
	return (
		<section
			aria-label="Agents"
			className="flex min-w-0 flex-col border-border/60 max-lg:border-t"
		>
			<ColumnHeader
				title="Agents"
				description={
					agents.length === 0
						? "No agents yet."
						: `${agents.length} agent${agents.length === 1 ? "" : "s"} in this org.`
				}
			/>
			{agents.length === 0 ? (
				<div className="px-4 py-3 md:px-6">
					<Button variant="accent" asChild size="sm">
						<Link to={orgPath("/agents")}>
							<BotIcon />
							Create your first agent
						</Link>
					</Button>
				</div>
			) : (
				<List>
					{agents.slice(0, 5).map((a) => (
						<ListItem key={a.id} asChild className="min-h-10">
							<Link to={orgPath(`/agents/${a.id}`) as string}>
								<span
									className="size-2.5 shrink-0 rounded-full"
									style={{ backgroundColor: a.accentColor }}
								/>
								<ListItemContent>
									<ListItemTitle>
										<span className="truncate">{a.name}</span>
									</ListItemTitle>
								</ListItemContent>
								<ArrowRightIcon className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/list-item:opacity-100" />
							</Link>
						</ListItem>
					))}
					{agents.length > 5 && (
						<ListItem asChild className="min-h-10 text-muted-foreground">
							<Link to={orgPath("/agents")}>See all {agents.length} agents</Link>
						</ListItem>
					)}
				</List>
			)}
		</section>
	);
}
