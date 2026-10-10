import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getCachedSession } from "@/lib/auth-client";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { PageTitle } from "@/components/dashboard/page-title";
import { ModeToggle } from "@/components/mode-toggle";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/dashboard")({
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
				<main className="flex-1 px-4 py-6 md:px-6 md:py-8">
					<Outlet />
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
