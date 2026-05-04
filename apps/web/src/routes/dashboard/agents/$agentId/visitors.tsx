import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/agents/$agentId/visitors")({
	component: VisitorsStub,
});

function VisitorsStub() {
	return (
		<div className="mx-auto max-w-6xl">
			<header className="mb-8">
				<h1 className="text-2xl font-semibold tracking-tight">Visitors</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					This page lands in a later phase.
				</p>
			</header>
		</div>
	);
}
