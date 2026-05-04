import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/")({
	component: DashboardOverview,
});

function DashboardOverview() {
	return (
		<div className="mx-auto max-w-6xl">
			<header className="mb-8">
				<h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					What your agents have been doing.
				</p>
			</header>
			<p className="text-sm text-muted-foreground">
				Overview content lands in the next commit.
			</p>
		</div>
	);
}
