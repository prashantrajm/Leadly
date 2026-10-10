import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import {
	BookIcon,
	FileTextIcon,
	PlusIcon,
	UploadIcon,
} from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	List,
	ListItem,
	ListItemContent,
	ListItemDescription,
	ListItemMeta,
	ListItemTitle,
} from "@/components/ui/list";
import {
	Page,
	PageActions,
	PageContent,
	PageToolbar,
} from "@/components/ui/page";
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
		<Page>
			<PageToolbar>
				<span className="text-[13px] text-muted-foreground">
					{q.data
						? `${q.data.length} article${q.data.length === 1 ? "" : "s"}`
						: "Articles"}
				</span>
				<PageActions>
					<Button asChild variant="outline" size="sm">
						<Link to={orgPath(`/agents/${agentId}/knowledge/upload`) as string}>
							<UploadIcon />
							Upload
						</Link>
					</Button>
					<Button variant="accent" asChild size="sm">
						<Link to={orgPath(`/agents/${agentId}/knowledge/new`) as string}>
							<PlusIcon />
							New article
						</Link>
					</Button>
				</PageActions>
			</PageToolbar>

			<PageContent width="flush">
				{q.isLoading ? (
					<div className="flex flex-col gap-1 p-2">
						{[0, 1, 2].map((i) => (
							<Skeleton key={i} className="h-12 rounded-lg" />
						))}
					</div>
				) : q.isError ? (
					<ErrorBanner err={q.error} />
				) : !q.data || q.data.length === 0 ? (
					<EmptyState agentId={agentId} />
				) : (
					<List>
						{q.data.map((article) => (
							<ArticleRow key={article.id} agentId={agentId} article={article} />
						))}
					</List>
				)}
			</PageContent>
		</Page>
	);
}

function EmptyState({ agentId }: { agentId: string }) {
	const orgPath = useOrgPath();
	return (
		<Empty>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<BookIcon />
				</EmptyMedia>
				<EmptyTitle>Write your first article</EmptyTitle>
				<EmptyDescription>
					Articles are written in Markdown. Headings drive retrieval, so write
					them like questions a visitor would ask: "How do refunds work?", "Do
					you ship to Canada?"
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent className="flex-row justify-center">
				<Button asChild variant="outline" size="sm">
					<Link to={orgPath(`/agents/${agentId}/knowledge/upload`) as string}>
						<UploadIcon />
						Upload .md file
					</Link>
				</Button>
				<Button variant="accent" asChild size="sm">
					<Link to={orgPath(`/agents/${agentId}/knowledge/new`) as string}>
						<PlusIcon />
						New article
					</Link>
				</Button>
			</EmptyContent>
		</Empty>
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
		<ListItem asChild>
			<Link to={orgPath(`/agents/${agentId}/knowledge/${article.id}`) as string}>
				<FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
				<ListItemContent>
					<ListItemTitle>
						<span className="truncate">{article.title}</span>
						{article.source === "upload" && (
							<Badge variant="secondary">Upload</Badge>
						)}
					</ListItemTitle>
				</ListItemContent>
				<ListItemMeta>
					<ListItemDescription>
						{article.chunkCount} chunk{article.chunkCount === 1 ? "" : "s"}
					</ListItemDescription>
					<span>
						{formatDistanceToNow(new Date(article.updatedAt), {
							addSuffix: true,
						})}
					</span>
				</ListItemMeta>
			</Link>
		</ListItem>
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
		<p className="px-4 py-6 text-sm text-destructive md:px-6">{message}</p>
	);
}
