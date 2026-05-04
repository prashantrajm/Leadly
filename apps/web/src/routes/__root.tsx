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

const BARE_ROUTES = ["/auth", "/dashboard"];

function RootLayout() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const bare = BARE_ROUTES.some(
		(p) => pathname === p || pathname.startsWith(`${p}/`),
	);

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
