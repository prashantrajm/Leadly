import { useQueries, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	Bot,
	Check,
	Inbox,
	MessageSquare,
	TrendingUp,
	UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { api } from "@/lib/api";

export const Route = createFileRoute("/dashboard/")({
	component: DashboardOverview,
});

function DashboardOverview() {
	const { currentOrg, isLoading: orgLoading } = useCurrentOrg();

	if (orgLoading) {
		return (
			<div className="mx-auto max-w-6xl">
				<HeaderShell />
				<div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					{[0, 1, 2, 3].map((i) => (
						<Skeleton key={i} className="h-28 rounded-xl" />
					))}
				</div>
			</div>
		);
	}

	if (!currentOrg) {
		return (
			<div className="mx-auto max-w-6xl">
				<HeaderShell />
				<EmptyState />
			</div>
		);
	}

	return <DashboardOverviewBody orgId={currentOrg.id} />;
}

function HeaderShell({ orgName }: { orgName?: string }) {
	return (
		<header className="mb-8">
			<h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
			<p className="mt-1 text-sm text-muted-foreground">
				{orgName
					? `What ${orgName} agents have been doing.`
					: "What your agents have been doing."}
			</p>
		</header>
	);
}

function EmptyState() {
	return (
		<div className="rounded-2xl border border-border bg-card p-10 text-center">
			<h2 className="text-lg font-semibold tracking-tight">
				Welcome to Leadly.
			</h2>
			<p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
				No organization yet. Sign out and back in to bootstrap one — the
				account hook creates a personal org on first sign-up.
			</p>
		</div>
	);
}

function DashboardOverviewBody({ orgId }: { orgId: string }) {
	const { currentOrg } = useCurrentOrg();

	const agentsQuery = useQuery({
		queryKey: ["agents", orgId],
		queryFn: () => api.agents.list(orgId),
	});

	const agents = agentsQuery.data ?? [];

	// One analytics query per agent, summed client-side. Cheap because the
	// summary endpoint is fast and we cache aggressively.
	const summaryResults = useQueries({
		queries: agents.map((a) => ({
			queryKey: ["analytics-summary", a.id, 7],
			queryFn: () => api.analytics.summary(a.id, { windowDays: 7 }),
			staleTime: 60_000,
		})),
	});

	const summariesLoading = summaryResults.some((r) => r.isLoading);
	const summaries = summaryResults
		.map((r) => r.data)
		.filter((s): s is NonNullable<typeof s> => Boolean(s));

	const totals = summaries.reduce(
		(acc, s) => ({
			conversations: acc.conversations + s.conversations,
			leadsCaptured: acc.leadsCaptured + s.leadsCaptured,
			handoffs: acc.handoffs + s.handoffs,
			turnsSum: acc.turnsSum + s.avgTurnsPerConv * s.conversations,
		}),
		{ conversations: 0, leadsCaptured: 0, handoffs: 0, turnsSum: 0 },
	);
	const avgTurns =
		totals.conversations > 0 ? totals.turnsSum / totals.conversations : 0;

	return (
		<div className="mx-auto max-w-6xl">
			<HeaderShell orgName={currentOrg?.name} />

			{/* KPIs */}
			<section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<Kpi
					label="Conversations"
					value={totals.conversations}
					sub="last 7 days"
					icon={MessageSquare}
					loading={summariesLoading || agentsQuery.isLoading}
				/>
				<Kpi
					label="Leads captured"
					value={totals.leadsCaptured}
					sub="last 7 days"
					icon={UserPlus}
					accent
					loading={summariesLoading || agentsQuery.isLoading}
				/>
				<Kpi
					label="Handoffs"
					value={totals.handoffs}
					sub="last 7 days"
					icon={Inbox}
					loading={summariesLoading || agentsQuery.isLoading}
				/>
				<Kpi
					label="Avg turns / conv"
					value={Number(avgTurns.toFixed(1))}
					sub="last 7 days"
					icon={TrendingUp}
					loading={summariesLoading || agentsQuery.isLoading}
				/>
			</section>

			{/* Setup checklist + agents */}
			<div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
				<SetupChecklist agents={agents} />
				<AgentsSummaryCard agents={agents} />
			</div>
		</div>
	);
}

function Kpi({
	label,
	value,
	sub,
	icon: Icon,
	accent,
	loading,
}: {
	label: string;
	value: number;
	sub: string;
	icon: React.ComponentType<{ className?: string }>;
	accent?: boolean;
	loading?: boolean;
}) {
	return (
		<Card>
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<CardDescription className="text-xs font-medium uppercase tracking-wider">
						{label}
					</CardDescription>
					<Icon
						className={`size-4 ${accent ? "text-accent-blue" : "text-muted-foreground"}`}
					/>
				</div>
			</CardHeader>
			<CardContent>
				{loading ? (
					<Skeleton className="h-8 w-16" />
				) : (
					<div className="text-3xl font-semibold tracking-tight">
						{value.toLocaleString()}
					</div>
				)}
				<div className="mt-1 text-xs text-muted-foreground">{sub}</div>
			</CardContent>
		</Card>
	);
}

function SetupChecklist({
	agents,
}: {
	agents: Array<{ id: string; name: string }>;
}) {
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
			cta: hasAgent ? null : { label: "Create agent", to: "/dashboard/agents" },
		},
		{
			title: "Write a few KB articles",
			done: hasKb,
			cta:
				hasAgent && !hasKb && firstAgent
					? {
							label: "Open knowledge base",
							to: `/dashboard/agents/${firstAgent.id}/knowledge`,
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
							to: `/dashboard/agents/${firstAgent.id}/install`,
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
							to: `/dashboard/agents/${firstAgent.id}/inbox`,
						}
					: null,
			disabled: !hasAgent,
		},
	];

	const completed = steps.filter((s) => s.done).length;

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="text-base">Get set up</CardTitle>
						<CardDescription>
							{completed === steps.length
								? "All set. Your agent is live."
								: `${completed} of ${steps.length} steps done.`}
						</CardDescription>
					</div>
					<div className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
						{Math.round((completed / steps.length) * 100)}%
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<ul className="space-y-3">
					{steps.map((step, i) => (
						<li
							key={step.title}
							className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
								step.done
									? "border-accent-blue/20 bg-accent-blue/5"
									: step.disabled
										? "border-border bg-card opacity-60"
										: "border-border bg-card"
							}`}
						>
							<div
								className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
									step.done
										? "bg-accent-blue text-accent-blue-foreground"
										: "border border-border bg-background text-muted-foreground"
								}`}
							>
								{step.done ? (
									<Check className="size-3.5" />
								) : (
									<span className="text-xs">{i + 1}</span>
								)}
							</div>
							<span
								className={`flex-1 text-sm ${step.done ? "text-foreground" : "text-foreground"}`}
							>
								{step.title}
							</span>
							{step.cta && (
								<Button
									asChild
									size="sm"
									variant="ghost"
									className="text-accent-blue hover:bg-accent-blue/10 hover:text-accent-blue"
								>
									<Link to={step.cta.to}>
										{step.cta.label}
										<ArrowRight className="ml-1 size-3.5" />
									</Link>
								</Button>
							)}
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	);
}

function AgentsSummaryCard({
	agents,
}: {
	agents: Array<{ id: string; name: string; slug: string; accentColor: string }>;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Agents</CardTitle>
				<CardDescription>
					{agents.length === 0
						? "No agents yet."
						: `${agents.length} agent${agents.length === 1 ? "" : "s"} in this org.`}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{agents.length === 0 ? (
					<Button
						asChild
						className="w-full bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90"
					>
						<Link to="/dashboard/agents">
							<Bot className="mr-2 size-4" />
							Create your first agent
						</Link>
					</Button>
				) : (
					<ul className="space-y-1.5">
						{agents.slice(0, 5).map((a) => (
							<li key={a.id}>
								<Link
									to={`/dashboard/agents/${a.id}` as string}
									className="group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:border-accent-blue/30"
								>
									<span
										className="size-2.5 shrink-0 rounded-full"
										style={{ backgroundColor: a.accentColor }}
									/>
									<span className="flex-1 truncate text-sm font-medium">
										{a.name}
									</span>
									<ArrowRight className="size-3.5 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-accent-blue" />
								</Link>
							</li>
						))}
						{agents.length > 5 && (
							<li>
								<Button
									asChild
									size="sm"
									variant="ghost"
									className="w-full justify-start text-muted-foreground"
								>
									<Link to="/dashboard/agents">
										See all {agents.length} agents
									</Link>
								</Button>
							</li>
						)}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}
