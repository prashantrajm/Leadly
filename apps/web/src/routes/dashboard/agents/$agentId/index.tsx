import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowRight,
	BarChart3,
	BookOpen,
	Code,
	Inbox,
	MessageSquare,
	Play,
	Settings,
	UserPlus,
} from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, LeadlyApiError } from "@/lib/api";

export const Route = createFileRoute("/dashboard/agents/$agentId/")({
	component: AgentOverview,
});

function AgentOverview() {
	const { agentId } = Route.useParams();

	const agentQuery = useQuery({
		queryKey: ["agent", agentId],
		queryFn: () => api.agents.get(agentId),
	});

	const summaryQuery = useQuery({
		queryKey: ["analytics-summary", agentId, 7],
		queryFn: () => api.analytics.summary(agentId, { windowDays: 7 }),
	});

	if (agentQuery.isLoading) {
		return (
			<div className="mx-auto max-w-6xl">
				<Skeleton className="h-20 w-full rounded-xl" />
				<Skeleton className="mt-6 h-32 w-full rounded-xl" />
			</div>
		);
	}

	if (agentQuery.isError) {
		const err = agentQuery.error;
		const message =
			err instanceof LeadlyApiError
				? err.status === 404
					? "Agent not found."
					: `API ${err.status}: ${err.message}`
				: "Could not load agent.";
		return (
			<div className="mx-auto max-w-6xl">
				<div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
					{message}
				</div>
			</div>
		);
	}

	const agent = agentQuery.data;
	if (!agent) return null;

	const s = summaryQuery.data;

	return (
		<div className="mx-auto max-w-6xl">
			{/* Header */}
			<header className="mb-8 flex flex-col gap-4 border-b border-border/60 pb-6 md:flex-row md:items-end md:justify-between">
				<div className="flex items-center gap-4">
					<div
						className="flex size-12 items-center justify-center rounded-xl text-lg font-semibold text-white shadow-sm"
						style={{ backgroundColor: agent.accentColor }}
					>
						{agent.name.charAt(0).toUpperCase()}
					</div>
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">
							{agent.name}
						</h1>
						<div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
							<span className="font-mono uppercase tracking-[0.15em]">
								{agent.slug}
							</span>
							<span className="size-1 rounded-full bg-muted-foreground/40" />
							<span>{agent.defaultProvider}</span>
							<span className="size-1 rounded-full bg-muted-foreground/40" />
							<span className="font-mono">{agent.defaultModel}</span>
						</div>
					</div>
				</div>
				<Link
					to={`/dashboard/agents/${agentId}/settings` as string}
					className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
				>
					<Settings className="size-4" />
					Settings
				</Link>
			</header>

			{/* KPIs */}
			<section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
				<MiniKpi
					label="Conversations"
					value={s?.conversations}
					sub="last 7 days"
					icon={MessageSquare}
					loading={summaryQuery.isLoading}
				/>
				<MiniKpi
					label="Leads"
					value={s?.leadsCaptured}
					sub="last 7 days"
					icon={UserPlus}
					accent
					loading={summaryQuery.isLoading}
				/>
				<MiniKpi
					label="Handoffs"
					value={s?.handoffs}
					sub="last 7 days"
					icon={Inbox}
					loading={summaryQuery.isLoading}
				/>
			</section>

			{/* Quick links */}
			<section className="mt-8">
				<h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
					Jump to
				</h2>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<QuickLink
						title="Inbox"
						description="Live conversations + transcripts"
						icon={Inbox}
						to={`/dashboard/agents/${agentId}/inbox`}
					/>
					<QuickLink
						title="Knowledge"
						description="Articles your agent answers from"
						icon={BookOpen}
						to={`/dashboard/agents/${agentId}/knowledge`}
					/>
					<QuickLink
						title="Playground"
						description="Try it without installing"
						icon={Play}
						to={`/dashboard/agents/${agentId}/playground`}
						accent
					/>
					<QuickLink
						title="Install"
						description="Drop the script on your site"
						icon={Code}
						to={`/dashboard/agents/${agentId}/install`}
					/>
					<QuickLink
						title="Leads"
						description="Captured contacts"
						icon={UserPlus}
						to={`/dashboard/agents/${agentId}/leads`}
					/>
					<QuickLink
						title="Analytics"
						description="Trends over time"
						icon={BarChart3}
						to={`/dashboard/agents/${agentId}/analytics`}
					/>
				</div>
			</section>

			{/* Greeting preview */}
			<section className="mt-10">
				<h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
					What visitors see first
				</h2>
				<div className="rounded-xl border border-border bg-card p-5">
					<p className="text-sm leading-relaxed text-foreground">
						{agent.greeting}
					</p>
				</div>
			</section>
		</div>
	);
}

function MiniKpi({
	label,
	value,
	sub,
	icon: Icon,
	accent,
	loading,
}: {
	label: string;
	value: number | undefined;
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
					<div className="text-2xl font-semibold tracking-tight">
						{(value ?? 0).toLocaleString()}
					</div>
				)}
				<div className="mt-1 text-xs text-muted-foreground">{sub}</div>
			</CardContent>
		</Card>
	);
}

function QuickLink({
	title,
	description,
	icon: Icon,
	to,
	accent,
}: {
	title: string;
	description: string;
	icon: React.ComponentType<{ className?: string }>;
	to: string;
	accent?: boolean;
}) {
	return (
		<Link
			to={to as string}
			className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-accent-blue/30"
		>
			<div
				className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
					accent
						? "bg-accent-blue text-accent-blue-foreground"
						: "border border-border bg-secondary/40 text-foreground"
				}`}
			>
				<Icon className="size-4" />
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-1 text-sm font-semibold tracking-tight">
					{title}
					<ArrowRight className="size-3.5 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-accent-blue" />
				</div>
				<p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
					{description}
				</p>
			</div>
		</Link>
	);
}
