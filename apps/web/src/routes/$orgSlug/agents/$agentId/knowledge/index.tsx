import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, BookOpen, FileText, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, LeadlyApiError } from "@/lib/api";
import { useOrgPath } from "@/hooks/use-current-org";

export const Route = createFileRoute("/$orgSlug/agents/$agentId/knowledge/")({
	component: KnowledgeList,
});

function KnowledgeList() {
	const orgPath = useOrgPath();
	const { agentId } = Route.useParams();

	const q = useQuery({
		queryKey: ["kb", agentId],
		queryFn: () => api.kb.list(agentId),
	});

	return (
		<div className="mx-auto max-w-5xl">
			<div className="mb-5 flex items-center justify-end gap-2">
				<Button asChild variant="outline">
					<Link to={orgPath(`/agents/${agentId}/knowledge/upload`) as string}>
						<Upload className="mr-1 size-4" />
						Upload
					</Link>
				</Button>
				<Button
					asChild
					className="bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90"
				>
					<Link to={orgPath(`/agents/${agentId}/knowledge/new`) as string}>
						<Plus className="mr-1 size-4" />
						New article
					</Link>
				</Button>
			</div>

			{q.isLoading ? (
				<div className="space-y-3">
					{[0, 1, 2].map((i) => (
						<Skeleton key={i} className="h-20 rounded-xl" />
					))}
				</div>
			) : q.isError ? (
				<ErrorBanner err={q.error} />
			) : !q.data || q.data.length === 0 ? (
				<EmptyState agentId={agentId} />
			) : (
				<div className="space-y-3">
					{q.data.map((article) => (
						<ArticleRow key={article.id} agentId={agentId} article={article} />
					))}
				</div>
			)}
		</div>
	);
}

function EmptyState({ agentId }: { agentId: string }) {
	const orgPath = useOrgPath();
	return (
		<Card>
			<CardContent className="flex flex-col items-center py-12 text-center">
				<div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-accent-blue/10 text-accent-blue">
					<BookOpen className="size-6" />
				</div>
				<h2 className="text-lg font-semibold tracking-tight">
					Write your first article.
				</h2>
				<p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
					Articles are written in Markdown. Headings drive retrieval, so write
					them like questions a visitor would ask: "How do refunds work?", "Do
					you ship to Canada?"
				</p>
				<div className="mt-6 flex flex-wrap items-center justify-center gap-2">
					<Button asChild variant="outline">
						<Link to={orgPath(`/agents/${agentId}/knowledge/upload`) as string}>
							<Upload className="mr-1 size-4" />
							Upload .md file
						</Link>
					</Button>
					<Button
						asChild
						className="bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90"
					>
						<Link to={orgPath(`/agents/${agentId}/knowledge/new`) as string}>
							<Plus className="mr-1 size-4" />
							New article
						</Link>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function ArticleRow({
	agentId,
	article,
}: {
	agentId: string;
	article: {
		id: string;
		title: string;
		updatedAt: string;
		chunkCount: number;
		source: string;
	};
}) {
	const orgPath = useOrgPath();
	return (
		<Link
			to={orgPath(`/agents/${agentId}/knowledge/${article.id}`) as string}
			className="group block"
		>
			<Card className="transition-colors hover:border-accent-blue/30">
				<CardContent className="flex items-center gap-4 p-4">
					<div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/40">
						<FileText className="size-4 text-muted-foreground" />
					</div>
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<h3 className="truncate text-sm font-semibold tracking-tight">
								{article.title}
							</h3>
							{article.source === "upload" && (
								<span className="rounded-full border border-border bg-card px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
									Upload
								</span>
							)}
						</div>
						<div className="mt-1 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
							<span>
								{formatDistanceToNow(new Date(article.updatedAt), {
									addSuffix: true,
								})}
							</span>
							<span className="size-1 rounded-full bg-muted-foreground/40" />
							<span>
								{article.chunkCount} chunk
								{article.chunkCount === 1 ? "" : "s"}
							</span>
						</div>
					</div>
					<ArrowRight className="size-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-accent-blue" />
				</CardContent>
			</Card>
		</Link>
	);
}

function ErrorBanner({ err }: { err: unknown }) {
	const message =
		err instanceof LeadlyApiError
			? `API ${err.status}: ${err.bodyText.slice(0, 200) || err.message}`
			: err instanceof Error
				? err.message
				: "Unknown error";
	return (
		<div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
			{message}
		</div>
	);
}
