import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/agents/$agentId/knowledge/$articleId")({
	component: ArticleEditorStub,
});

function ArticleEditorStub() {
	return (
		<div className="mx-auto max-w-3xl">
			<header className="mb-8">
				<h1 className="text-2xl font-semibold tracking-tight">Article</h1>
				<p className="mt-1 text-sm text-muted-foreground">Editor lands in the next commit.</p>
			</header>
		</div>
	);
}
