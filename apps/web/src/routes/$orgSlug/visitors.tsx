import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { TagIcon, UserCircleIcon, UsersIcon } from "@/components/icons";
import {
	AgentFilter,
	validateAgentSearch,
} from "@/components/dashboard/agent-filter";
import { NoAgentsState } from "@/components/dashboard/no-agents-state";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Page, PageContent, PageToolbar } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useOrgAgents } from "@/hooks/use-org-agents";
import { api, LeadlyApiError } from "@/lib/api";

export const Route = createFileRoute("/$orgSlug/visitors")({
	validateSearch: validateAgentSearch,
	component: VisitorsPage,
});

function VisitorsPage() {
	const { agent: agentId } = Route.useSearch();
	const navigate = Route.useNavigate();
	const { orgId, agents, isLoading: agentsLoading } = useOrgAgents();

	const q = useQuery({
		queryKey: ["visitors", orgId, agentId],
		queryFn: () =>
			api.visitors.listForOrg(orgId as string, { agentId, limit: 100 }),
		enabled: Boolean(orgId),
	});
	const agentsById = new Map(agents.map((a) => [a.id, a]));
	const showAgent = !agentId && agents.length > 1;

	return (
		<Page>
			{agents.length > 1 && (
				<PageToolbar>
					<AgentFilter
						agents={agents}
						value={agentId}
						onChange={(agent) => navigate({ search: { agent } })}
					/>
				</PageToolbar>
			)}

			{agentsLoading || q.isLoading ? (
				<PageContent className="flex flex-col gap-2">
					{[0, 1, 2, 3, 4].map((i) => (
						<Skeleton key={i} className="h-10 rounded-lg" />
					))}
				</PageContent>
			) : q.isError ? (
				<PageContent>
					<p className="text-sm text-destructive">
						{q.error instanceof LeadlyApiError
							? `API ${q.error.status}: ${q.error.message}`
							: "Could not load visitors."}
					</p>
				</PageContent>
			) : agents.length === 0 ? (
				<PageContent>
					<NoAgentsState what="Visitors" />
				</PageContent>
			) : !q.data || q.data.length === 0 ? (
				<PageContent>
					<EmptyState />
				</PageContent>
			) : (
				<PageContent width="flush">
					<Table flush>
						<TableHeader>
							<TableRow>
								<TableHead>Visitor</TableHead>
								{showAgent && <TableHead>Agent</TableHead>}
								<TableHead>First seen</TableHead>
								<TableHead>Last seen</TableHead>
								<TableHead>User agent</TableHead>
								<TableHead className="text-right">Lead</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{q.data.map((v) => (
								<TableRow key={v.id}>
									<TableCell>
										<div className="flex items-center gap-2">
											<div className="flex size-7 items-center justify-center rounded-full bg-muted">
												<UserCircleIcon className="size-3.5 text-muted-foreground" />
											</div>
											<div className="min-w-0">
												<div className="truncate font-mono text-xs">
													{v.externalId.slice(0, 18)}
													{v.externalId.length > 18 ? "…" : ""}
												</div>
											</div>
										</div>
									</TableCell>
									{showAgent && (
										<TableCell className="text-sm text-muted-foreground">
											{agentsById.get(v.agentId)?.name ?? "—"}
										</TableCell>
									)}
									<TableCell className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
										{format(new Date(v.firstSeenAt), "MMM d")}
									</TableCell>
									<TableCell className="font-mono text-[11px] text-muted-foreground">
										{formatDistanceToNow(new Date(v.lastSeenAt), {
											addSuffix: true,
										})}
									</TableCell>
									<TableCell className="max-w-[280px] truncate text-xs text-muted-foreground">
										{v.userAgent ?? (
											<span className="text-muted-foreground/60">—</span>
										)}
									</TableCell>
									<TableCell className="text-right">
										{v.leadId ? (
											<span className="inline-flex items-center gap-1 rounded-full bg-accent-blue/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-accent-blue">
												<TagIcon className="size-3" />
												Captured
											</span>
										) : (
											<span className="text-xs text-muted-foreground">
												—
											</span>
										)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</PageContent>
			)}
		</Page>
	);
}

function EmptyState() {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<UsersIcon />
				</EmptyMedia>
				<EmptyTitle>No visitors yet</EmptyTitle>
				<EmptyDescription>
					When someone opens the widget on your site, they show up here —
					whether they sent a message or not.
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}
