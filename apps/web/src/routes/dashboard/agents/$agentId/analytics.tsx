import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Inbox, MessageSquare, TrendingUp, UserPlus } from "lucide-react";
import { useState } from "react";
import {
	CartesianGrid,
	Line,
	LineChart,
	XAxis,
	YAxis,
} from "recharts";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, LeadlyApiError } from "@/lib/api";

type WindowDays = 7 | 14 | 30;

export const Route = createFileRoute("/dashboard/agents/$agentId/analytics")({
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
	const { agentId } = Route.useParams();
	const [windowDays, setWindowDays] = useState<WindowDays>(7);

	const summary = useQuery({
		queryKey: ["analytics-summary", agentId, windowDays],
		queryFn: () => api.analytics.summary(agentId, { windowDays }),
	});

	const timeseries = useQuery({
		queryKey: ["analytics-timeseries", agentId, windowDays],
		queryFn: () => api.analytics.timeseries(agentId, { windowDays }),
	});

	return (
		<div className="mx-auto max-w-6xl">
			<header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Trends across this agent's conversations.
					</p>
				</div>
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
			</header>

			<section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<Kpi
					label="Conversations"
					value={summary.data?.conversations}
					icon={MessageSquare}
					loading={summary.isLoading}
				/>
				<Kpi
					label="Leads"
					value={summary.data?.leadsCaptured}
					icon={UserPlus}
					accent
					loading={summary.isLoading}
				/>
				<Kpi
					label="Handoffs"
					value={summary.data?.handoffs}
					icon={Inbox}
					loading={summary.isLoading}
				/>
				<Kpi
					label="Avg turns"
					value={
						summary.data
							? Number(summary.data.avgTurnsPerConv.toFixed(1))
							: undefined
					}
					icon={TrendingUp}
					loading={summary.isLoading}
				/>
			</section>

			<Card className="mt-6">
				<CardHeader>
					<CardTitle className="text-base">Daily volume</CardTitle>
					<CardDescription>
						Conversations, leads, and handoffs over the last {windowDays}{" "}
						days.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{timeseries.isLoading ? (
						<Skeleton className="h-[260px] w-full rounded-md" />
					) : timeseries.isError ? (
						<div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
							{timeseries.error instanceof LeadlyApiError
								? `API ${timeseries.error.status}: ${timeseries.error.message}`
								: "Could not load timeseries."}
						</div>
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
				</CardContent>
			</Card>

			<Card className="mt-6">
				<CardHeader>
					<CardTitle className="text-base">Top cited articles</CardTitle>
					<CardDescription>
						Which KB articles the agent leans on most. Empty if retrieval
						hasn't fired yet.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{summary.isLoading ? (
						<Skeleton className="h-32 w-full rounded-md" />
					) : !summary.data || summary.data.topCitedArticles.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No citations yet in this window.
						</p>
					) : (
						<ul className="space-y-2">
							{summary.data.topCitedArticles.map((a, i) => (
								<li
									key={a.articleId}
									className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
								>
									<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent-blue/10 font-mono text-[11px] font-semibold text-accent-blue">
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
				</CardContent>
			</Card>
		</div>
	);
}

function Kpi({
	label,
	value,
	icon: Icon,
	accent,
	loading,
}: {
	label: string;
	value: number | undefined;
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
			</CardContent>
		</Card>
	);
}
