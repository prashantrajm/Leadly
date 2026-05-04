import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/settings/profile")({
	component: ProfileStub,
});

function ProfileStub() {
	return (
		<div className="mx-auto max-w-3xl">
			<header className="mb-8">
				<h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Profile content lands later in P1.
				</p>
			</header>
		</div>
	);
}
