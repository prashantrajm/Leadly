import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { Tag, UserRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { api, LeadlyApiError } from "@/lib/api";

export const Route = createFileRoute("/dashboard/agents/$agentId/visitors")({
	component: VisitorsPage,
});

function VisitorsPage() {
	const { agentId } = Route.useParams();

	const q = useQuery({
		queryKey: ["visitors", agentId],
		queryFn: () => api.visitors.list(agentId, { limit: 100 }),
	});

	return (
		<div className="mx-auto max-w-6xl">
			<header className="mb-8">
				<h1 className="text-2xl font-semibold tracking-tight">Visitors</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Every browser that opened the widget. Useful for debugging "did
					this person actually reach the agent?"
				</p>
			</header>

			{q.isLoading ? (
				<Skeleton className="h-80 rounded-xl" />
			) : q.isError ? (
				<div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
					{q.error instanceof LeadlyApiError
						? `API ${q.error.status}: ${q.error.message}`
						: "Could not load visitors."}
				</div>
			) : !q.data || q.data.length === 0 ? (
				<EmptyState />
			) : (
				<Card>
					<CardContent className="p-0">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Visitor</TableHead>
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
												<div className="flex size-7 items-center justify-center rounded-full border border-border bg-secondary/40">
													<UserRound className="size-3.5 text-muted-foreground" />
												</div>
												<div className="min-w-0">
													<div className="truncate font-mono text-xs">
														{v.externalId.slice(0, 18)}
														{v.externalId.length > 18 ? "…" : ""}
													</div>
												</div>
											</div>
										</TableCell>
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
													<Tag className="size-3" />
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
					</CardContent>
				</Card>
			)}
		</div>
	);
}

function EmptyState() {
	return (
		<Card>
			<CardContent className="py-14 text-center">
				<h2 className="text-lg font-semibold tracking-tight">
					No visitors yet.
				</h2>
				<p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
					When someone opens the widget on your site, they show up here —
					whether they sent a message or not.
				</p>
			</CardContent>
		</Card>
	);
}
