import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArticleEditor } from "@/components/dashboard/article-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { api, LeadlyApiError } from "@/lib/api";

export const Route = createFileRoute(
	"/dashboard/agents/$agentId/knowledge/$articleId",
)({
	component: EditArticlePage,
});

function EditArticlePage() {
	const { agentId, articleId } = Route.useParams();

	const q = useQuery({
		queryKey: ["kb-article", agentId, articleId],
		queryFn: () => api.kb.get(agentId, articleId),
	});

	if (q.isLoading) {
		return (
			<div className="mx-auto max-w-5xl">
				<Skeleton className="h-10 w-40 rounded-md" />
				<Skeleton className="mt-6 h-12 w-full rounded-md" />
				<Skeleton className="mt-4 h-[460px] w-full rounded-md" />
			</div>
		);
	}

	if (q.isError) {
		const err = q.error;
		const message =
			err instanceof LeadlyApiError
				? err.status === 404
					? "Article not found."
					: `API ${err.status}: ${err.message}`
				: "Could not load article.";
		return (
			<div className="mx-auto max-w-5xl">
				<div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
					{message}
				</div>
			</div>
		);
	}

	const article = q.data;
	if (!article) return null;

	return (
		<ArticleEditor
			mode={{
				kind: "edit",
				agentId,
				articleId,
				initial: {
					title: article.title,
					contentMarkdown: article.contentMarkdown,
				},
			}}
		/>
	);
}
