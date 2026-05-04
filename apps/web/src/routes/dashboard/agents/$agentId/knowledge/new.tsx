import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/agents/$agentId/knowledge/new")({
	component: NewStub,
});

function NewStub() {
	return (
		<div className="mx-auto max-w-3xl">
			<header className="mb-8">
				<h1 className="text-2xl font-semibold tracking-tight">New</h1>
				<p className="mt-1 text-sm text-muted-foreground">Lands in the next commit.</p>
			</header>
		</div>
	);
}
