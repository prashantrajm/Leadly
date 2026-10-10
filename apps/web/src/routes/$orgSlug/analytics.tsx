import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import {
	InboxIcon,
	MessageIcon,
	TrendingUpIcon,
	UserPlusIcon,
} from "@/components/icons";
import { useState } from "react";
import {
	CartesianGrid,
	Line,
	LineChart,
	XAxis,
	YAxis,
} from "recharts";
import {
	AgentFilter,
	validateAgentSearch,
} from "@/components/dashboard/agent-filter";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@/components/ui/chart";
import {
	Page,
	PageActions,
	PageContent,
	PageSection,
	PageSectionDescription,
	PageSectionHeader,
	PageSectionTitle,
	PageToolbar,
} from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrgAgents } from "@/hooks/use-org-agents";
import { api, LeadlyApiError } from "@/lib/api";
import { Kpi } from "@/components/dashboard/kpi";
import { StatGroup } from "@/components/ui/stat";

type WindowDays = 7 | 14 | 30;

export const Route = createFileRoute("/$orgSlug/analytics")({
	validateSearch: validateAgentSearch,
	component: AnalyticsPage,
});

const chartConfig: ChartConfig = {
	conversations: {
		label: "Conversations",
		color: "var(--color-foreground)",
	},
	leadsCaptured: {
		label: "Leads",
		color: "var(--accent-blue)",
	},
	handoffs: {
		label: "Handoffs",
		color: "var(--color-muted-foreground)",
	},
};

function AnalyticsPage() {
	const { agent: agentId } = Route.useSearch();
	const navigate = Route.useNavigate();
	const { orgId, agents } = useOrgAgents();
	const [windowDays, setWindowDays] = useState<WindowDays>(7);

	const summary = useQuery({
		queryKey: ["org-analytics-summary", orgId, agentId, windowDays],
		queryFn: () =>
			api.analytics.orgSummary(orgId as string, { agentId, windowDays }),
		enabled: Boolean(orgId),
	});

	const timeseries = useQuery({
		queryKey: ["org-analytics-timeseries", orgId, agentId, windowDays],
		queryFn: () =>
			api.analytics.orgTimeseries(orgId as string, { agentId, windowDays }),
		enabled: Boolean(orgId),
	});

	return (
		<Page>
			<PageToolbar>
				<Tabs
					value={String(windowDays)}
					onValueChange={(v) => setWindowDays(Number(v) as WindowDays)}
				>
					<TabsList>
						<TabsTrigger value="7">7 days</TabsTrigger>
						<TabsTrigger value="14">14 days</TabsTrigger>
						<TabsTrigger value="30">30 days</TabsTrigger>
					</TabsList>
				</Tabs>
				<PageActions>
					<AgentFilter
						agents={agents}
						value={agentId}
						onChange={(agent) => navigate({ search: { agent } })}
					/>
				</PageActions>
			</PageToolbar>

			<StatGroup>
				<Kpi
					label="Conversations"
					value={summary.data?.conversations}
					icon={MessageIcon}
					loading={summary.isLoading}
				/>
				<Kpi
					label="Leads"
					value={summary.data?.leadsCaptured}
					icon={UserPlusIcon}
					accent
					loading={summary.isLoading}
				/>
				<Kpi
					label="Handoffs"
					value={summary.data?.handoffs}
					icon={InboxIcon}
					loading={summary.isLoading}
				/>
				<Kpi
					label="Avg turns"
					value={
						summary.data
							? Number(summary.data.avgTurnsPerConv.toFixed(1))
							: undefined
					}
					icon={TrendingUpIcon}
					loading={summary.isLoading}
				/>
			</StatGroup>

			<PageContent>
				<PageSection className="md:grid-cols-1">
					<PageSectionHeader>
						<PageSectionTitle>Daily volume</PageSectionTitle>
						<PageSectionDescription>
							Conversations, leads, and handoffs over the last {windowDays}{" "}
							days.
						</PageSectionDescription>
					</PageSectionHeader>
					{timeseries.isLoading ? (
						<Skeleton className="h-[260px] w-full rounded-md" />
					) : timeseries.isError ? (
						<p className="text-sm text-destructive">
							{timeseries.error instanceof LeadlyApiError
								? `API ${timeseries.error.status}: ${timeseries.error.message}`
								: "Could not load timeseries."}
						</p>
					) : (
						<ChartContainer
							config={chartConfig}
							className="h-[260px] w-full"
						>
							<LineChart
								data={(timeseries.data?.points ?? []).map((p) => ({
									...p,
									label: format(new Date(p.date), "MMM d"),
								}))}
								margin={{ top: 8, right: 16, bottom: 0, left: -16 }}
							>
								<CartesianGrid
									strokeDasharray="3 3"
									className="stroke-border/50"
								/>
								<XAxis
									dataKey="label"
									tickLine={false}
									axisLine={false}
									tick={{ fontSize: 11 }}
									className="fill-muted-foreground"
								/>
								<YAxis
									tickLine={false}
									axisLine={false}
									tick={{ fontSize: 11 }}
									className="fill-muted-foreground"
									width={40}
								/>
								<ChartTooltip content={<ChartTooltipContent />} />
								<Line
									type="monotone"
									dataKey="conversations"
									stroke="var(--color-foreground)"
									strokeWidth={2}
									dot={false}
								/>
								<Line
									type="monotone"
									dataKey="leadsCaptured"
									stroke="var(--accent-blue)"
									strokeWidth={2}
									dot={false}
								/>
								<Line
									type="monotone"
									dataKey="handoffs"
									stroke="var(--color-muted-foreground)"
									strokeWidth={1.5}
									dot={false}
									strokeDasharray="4 4"
								/>
							</LineChart>
						</ChartContainer>
					)}
				</PageSection>

				<PageSection className="md:grid-cols-1">
					<PageSectionHeader>
						<PageSectionTitle>Top cited articles</PageSectionTitle>
						<PageSectionDescription>
							Which KB articles the agent leans on most. Empty if retrieval
							hasn't fired yet.
						</PageSectionDescription>
					</PageSectionHeader>
					{summary.isLoading ? (
						<Skeleton className="h-32 w-full rounded-md" />
					) : !summary.data || summary.data.topCitedArticles.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No citations yet in this window.
						</p>
					) : (
						<ul className="divide-y divide-border/60">
							{summary.data.topCitedArticles.map((a, i) => (
								<li
									key={a.articleId}
									className="flex items-center gap-3 py-2.5"
								>
									<span className="w-5 shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
										{i + 1}
									</span>
									<span className="min-w-0 flex-1 truncate text-sm font-medium">
										{a.title}
									</span>
									<span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
										{a.citations} cite
										{a.citations === 1 ? "" : "s"}
									</span>
								</li>
							))}
						</ul>
					)}
				</PageSection>
			</PageContent>
		</Page>
	);
}

