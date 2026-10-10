import {
	createFileRoute,
	Link,
	Navigate,
	Outlet,
	redirect,
} from "@tanstack/react-router";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { InvitationsBanner } from "@/components/dashboard/invitations-banner";
import { PageTitle } from "@/components/dashboard/page-title";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { pickDefaultOrg, useCurrentOrg } from "@/hooks/use-current-org";
import { getCachedSession } from "@/lib/auth-client";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/$orgSlug")({
	beforeLoad: async ({ location }) => {
		// Better Auth is the source of truth — call it in beforeLoad so the
		// guard runs on every dashboard route, including refresh and direct
		// navigation. If unauthenticated, bounce to /auth and remember where
		// we were headed.
		const session = await getCachedSession();
		if (!session.data?.user) {
			throw redirect({
				to: "/auth",
				search: { redirect: location.pathname },
			});
		}
	},
	component: DashboardLayout,
});

function DashboardLayout() {
	const { orgs, currentOrg, isLoading } = useCurrentOrg();

	// Any unknown top-level path lands here, as does a slug for an org the
	// user isn't a member of (or one that was renamed).
	if (!isLoading && !currentOrg) {
		// No workspace at all yet: /dashboard runs first-workspace setup.
		if (orgs.length === 0) return <Navigate to="/dashboard" replace />;
		return <WorkspaceNotFound fallbackSlug={pickDefaultOrg(orgs)?.slug} />;
	}

	return (
		<SidebarProvider>
			<DashboardSidebar />
			<SidebarInset>
				<header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border/60 bg-background/80 px-4 backdrop-blur">
					<SidebarTrigger className="-ml-1" />
					<div className="h-4 w-px bg-border/60" />
					<PageTitle />
					<div className="ml-auto">
						<ModeToggle />
					</div>
				</header>
				<InvitationsBanner />
				<main className="flex-1 px-4 py-6 md:px-6 md:py-8">
					<Outlet />
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}

function WorkspaceNotFound({ fallbackSlug }: { fallbackSlug?: string }) {
	return (
		<main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
			<h1 className="text-2xl font-semibold tracking-tight">
				Workspace not found
			</h1>
			<p className="mt-2 max-w-md text-sm text-muted-foreground">
				This page doesn't exist, or it belongs to a workspace you're not a
				member of. If the workspace URL was changed, use the new one.
			</p>
			<Button
				asChild
				className="mt-6 bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90"
			>
				{fallbackSlug ? (
					<Link to="/$orgSlug" params={{ orgSlug: fallbackSlug }}>
						Go to your workspace
					</Link>
				) : (
					<Link to="/">Go home</Link>
				)}
			</Button>
		</main>
	);
}
