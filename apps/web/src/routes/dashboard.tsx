import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
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
		const session = await authClient.getSession();
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
					<Breadcrumbs />
				</header>
				<main className="flex-1 px-4 py-6 md:px-6 md:py-8">
					<Outlet />
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}

function Breadcrumbs() {
	// Lightweight, derives from the URL. A real breadcrumb component can come
	// later when nesting goes deeper. For P1 we just render the last segment.
	if (typeof window === "undefined") return null;
	const segments = window.location.pathname.split("/").filter(Boolean);
	const last = segments[segments.length - 1] ?? "Dashboard";
	const label =
		last.length > 24 ? `${last.slice(0, 24)}…` : last.replace(/-/g, " ");
	return (
		<span className="text-sm font-medium capitalize text-muted-foreground">
			{label === "dashboard" ? "Overview" : label}
		</span>
	);
}
