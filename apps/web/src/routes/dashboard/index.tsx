import { createFileRoute } from "@tanstack/react-router";
import { CreateWorkspaceDialog } from "@/components/dashboard/create-workspace-dialog";
import { enterDashboard } from "@/lib/dashboard-entry";

export const Route = createFileRoute("/dashboard/")({
	beforeLoad: ({ context, location }) =>
		enterDashboard({
			queryClient: context.queryClient,
			rest: "",
			searchStr: location.searchStr,
			pathname: location.pathname,
		}),
	// Only reached when the user has no workspace yet.
	component: FirstWorkspace,
});

function FirstWorkspace() {
	return (
		<main className="min-h-screen bg-background">
			<CreateWorkspaceDialog open firstWorkspace />
		</main>
	);
}
