import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const LS_KEY = "leadly:current-org-id";

export function useCurrentOrg() {
	const orgsQuery = useQuery({
		queryKey: ["orgs"],
		queryFn: () => api.orgs.list(),
		staleTime: 30_000,
	});

	const [storedId, setStoredId] = useState<string | null>(() => {
		if (typeof window === "undefined") return null;
		return localStorage.getItem(LS_KEY);
	});

	const orgs = orgsQuery.data ?? [];
	const currentOrg =
		orgs.find((o) => o.id === storedId) ?? orgs[0] ?? null;

	useEffect(() => {
		if (currentOrg && currentOrg.id !== storedId) {
			localStorage.setItem(LS_KEY, currentOrg.id);
			setStoredId(currentOrg.id);
		}
	}, [currentOrg, storedId]);

	function switchOrg(orgId: string) {
		localStorage.setItem(LS_KEY, orgId);
		setStoredId(orgId);
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
