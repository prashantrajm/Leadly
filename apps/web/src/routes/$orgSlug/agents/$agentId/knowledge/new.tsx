import { createFileRoute } from "@tanstack/react-router";
import { ArticleEditor } from "@/components/dashboard/article-editor";

export const Route = createFileRoute(
	"/$orgSlug/agents/$agentId/knowledge/new",
)({
	component: NewArticlePage,
});

function NewArticlePage() {
	const { agentId } = Route.useParams();
	return <ArticleEditor mode={{ kind: "create", agentId }} />;
}
