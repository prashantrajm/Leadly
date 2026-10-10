import type { Organization } from "@leadly/api-client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { api } from "@/lib/api";

const LS_KEY = "leadly:current-org-id";

export const orgsQueryOptions = {
	queryKey: ["orgs"],
	queryFn: () => api.orgs.list(),
	staleTime: 30_000,
};

// The org a bare /dashboard link should open: the last one used in this
// browser, else the first. Storage can throw (private mode, blocked site
// data), in which case we just fall back to the first org.
export function pickDefaultOrg(orgs: Organization[]): Organization | null {
	let storedId: string | null = null;
	try {
		storedId = localStorage.getItem(LS_KEY);
	} catch {}
	return orgs.find((o) => o.id === storedId) ?? orgs[0] ?? null;
}

function rememberOrg(orgId: string) {
	try {
		localStorage.setItem(LS_KEY, orgId);
	} catch {}
}

// Inside the app (/<orgSlug>/…) the URL decides the current org, so links
// and tabs are unambiguous. Outside it, fall back to the last-used org.
// currentOrg is null when the slug matches none of the user's orgs.
export function useCurrentOrg() {
	const orgsQuery = useQuery(orgsQueryOptions);
	const { orgSlug } = useParams({ strict: false }) as { orgSlug?: string };
	const navigate = useNavigate();

	const orgs = orgsQuery.data ?? [];
	const currentOrg = orgSlug
		? (orgs.find((o) => o.slug === orgSlug) ?? null)
		: pickDefaultOrg(orgs);

	const currentOrgId = currentOrg?.id;
	useEffect(() => {
		if (currentOrgId) rememberOrg(currentOrgId);
	}, [currentOrgId]);

	function switchOrg(orgId: string) {
		const org = orgs.find((o) => o.id === orgId);
		if (!org) return;
		rememberOrg(org.id);
		navigate({ to: "/$orgSlug", params: { orgSlug: org.slug } });
	}

	return {
		orgs,
		currentOrg,
		switchOrg,
		isLoading: orgsQuery.isLoading,
		isError: orgsQuery.isError,
		error: orgsQuery.error,
	};
}

// Builds app links under the current org: orgPath("/inbox") → "/acme/inbox".
export function useOrgPath() {
	const { orgSlug } = useParams({ strict: false }) as { orgSlug?: string };
	const { currentOrg } = useCurrentOrg();
	const slug = orgSlug ?? currentOrg?.slug ?? "";
	return (path = "") => `/${slug}${path}`;
}
