import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/agents/")({
	component: AgentsList,
});

function AgentsList() {
	return (
		<div className="mx-auto max-w-6xl">
			<header className="mb-8">
				<h1 className="text-2xl font-semibold tracking-tight">Agents</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Manage every agent in this organization.
				</p>
			</header>
			<p className="text-sm text-muted-foreground">Lands in the next commit.</p>
		</div>
	);
}
