import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArticleEditor } from "@/components/dashboard/article-editor";
import { Page, PageContent } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { api, LeadlyApiError } from "@/lib/api";

export const Route = createFileRoute(
	"/$orgSlug/agents/$agentId/knowledge/$articleId",
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
			<Page>
				<PageContent width="narrow">
					<Skeleton className="h-10 w-full rounded-md" />
					<Skeleton className="mt-4 h-[460px] w-full rounded-md" />
				</PageContent>
			</Page>
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
			<Page>
				<PageContent width="narrow">
					<p className="text-sm text-destructive">{message}</p>
				</PageContent>
			</Page>
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
