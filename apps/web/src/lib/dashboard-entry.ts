import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { orgsQueryOptions, pickDefaultOrg } from "@/hooks/use-current-org";
import { getCachedSession } from "@/lib/auth-client";

// /dashboard is the app's front door: sign-in lands here, as do the
// marketing header's "Dashboard" link and old /dashboard/… bookmarks from
// before the app moved to /<orgSlug>/…. It sends you to the same page in
// your last-used workspace. With no workspace yet (first sign-in) it
// resolves instead, and /dashboard renders workspace setup.
export async function enterDashboard({
	queryClient,
	rest,
	searchStr,
	pathname,
}: {
	queryClient: QueryClient;
	rest: string;
	searchStr: string;
	pathname: string;
}): Promise<void> {
	const session = await getCachedSession();
	if (!session.data?.user) {
		throw redirect({ to: "/auth", search: { redirect: pathname } });
	}
	const org = pickDefaultOrg(
		await queryClient.ensureQueryData(orgsQueryOptions),
	);
	if (!org) {
		if (rest) throw redirect({ to: "/dashboard", replace: true });
		return;
	}
	const path = rest ? `/${org.slug}/${rest}` : `/${org.slug}`;
	throw redirect({ href: `${path}${searchStr}`, replace: true });
}

// Where to go after signing in: the page the dashboard guard bounced you
// from, else /dashboard (your workspace, or workspace setup on a first
// sign-in). Same-origin paths only, so ?redirect= can't send people to
// another site ("//evil.com", "https://…").
export function postAuthPath(redirectTo: unknown): string {
	return typeof redirectTo === "string" &&
		redirectTo.startsWith("/") &&
		!redirectTo.startsWith("//") &&
		!redirectTo.startsWith("/\\") &&
		!redirectTo.startsWith("/auth")
		? redirectTo
		: "/dashboard";
}
