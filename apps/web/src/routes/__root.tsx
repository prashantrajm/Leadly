import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	Outlet,
	useRouterState,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import Footer from "@/components/footer";
import { Header } from "@/components/Header";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";

interface MyRouterContext {
	queryClient: QueryClient;
}

// Routes that render without the marketing header/footer: auth, the legacy
// /dashboard redirects, and the whole app under /<orgSlug>.
const BARE_ROUTE_PREFIXES = ["/auth", "/dashboard", "/$orgSlug"];

function RootLayout() {
	const bare = useRouterState({
		select: (s) =>
			s.matches.some((m) =>
				BARE_ROUTE_PREFIXES.some(
					(p) => m.routeId === p || m.routeId.startsWith(`${p}/`),
				),
			),
	});

	return (
		<>
			{!bare && <Header />}
			<Outlet />
			{!bare && <Footer />}
			<TanStackDevtools
				config={{
					position: "bottom-right",
				}}
				plugins={[
					{
						name: "Tanstack Router",
						render: <TanStackRouterDevtoolsPanel />,
					},
					TanStackQueryDevtools,
				]}
			/>
		</>
	);
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	component: RootLayout,
});
