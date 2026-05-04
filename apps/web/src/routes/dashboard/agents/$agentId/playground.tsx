import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/agents/$agentId/playground")({
	component: PlaygroundStub,
});

function PlaygroundStub() {
	return (
		<div className="mx-auto max-w-6xl">
			<header className="mb-8">
				<h1 className="text-2xl font-semibold tracking-tight">Playground</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					This page lands in a later phase.
				</p>
			</header>
		</div>
	);
}
