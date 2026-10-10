import { createFileRoute } from "@tanstack/react-router";
import { enterDashboard } from "@/lib/dashboard-entry";

export const Route = createFileRoute("/dashboard/$")({
	beforeLoad: ({ context, location, params }) =>
		enterDashboard({
			queryClient: context.queryClient,
			rest: params._splat ?? "",
			searchStr: location.searchStr,
			pathname: location.pathname,
		}),
});
