import { useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useOrgAgents } from "@/hooks/use-org-agents";

// Top-level app pages, keyed by the first segment after /<orgSlug>.
const SECTION_TITLES: Record<string, string> = {
	"": "Overview",
	inbox: "Inbox",
	leads: "Leads",
	visitors: "Visitors",
	analytics: "Analytics",
	agents: "Agents",
	settings: "Settings",
};

// Pages that belong to one agent, keyed by the segment after the agent id.
const AGENT_PAGE_TITLES: Record<string, string> = {
	knowledge: "Knowledge",
	playground: "Playground",
	install: "Install",
	settings: "Settings",
};

// Title for the dashboard top bar, derived from the current route. The
// sidebar pages don't repeat it in their own content.
export function PageTitle() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const { agents } = useOrgAgents();
	const crumbs = titleFor(
		pathname,
		(id) => agents.find((a) => a.id === id)?.name,
	);

	return (
		<h1 className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
			{crumbs.map((crumb, i) => (
				<span key={crumb} className="flex min-w-0 items-center gap-1.5">
					{i > 0 && (
						<ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
					)}
					<span
						className={
							i === crumbs.length - 1
								? "truncate text-foreground"
								: "truncate text-muted-foreground"
						}
					>
						{crumb}
					</span>
				</span>
			))}
		</h1>
	);
}

export function titleFor(
	pathname: string,
	agentName: (agentId: string) => string | undefined,
): string[] {
	// "/<orgSlug>/agents/abc/knowledge/new" → section, id, page, sub
	const [, section = "", id, page, sub] = pathname.split("/").filter(Boolean);

	if (section === "inbox" && id) return ["Inbox", "Conversation"];
	if (section === "settings" && id === "profile")
		return ["Settings", "Profile"];

	if (section === "agents" && id) {
		const name = agentName(id) ?? "Agent";
		if (!page) return [name];
		const pageTitle = AGENT_PAGE_TITLES[page] ?? page;
		if (page === "knowledge" && sub) {
			const subTitle =
				sub === "new" ? "New article" : sub === "upload" ? "Upload" : "Article";
			return [name, pageTitle, subTitle];
		}
		return [name, pageTitle];
	}

	return [SECTION_TITLES[section] ?? section];
}
