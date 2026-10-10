import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	BookIcon,
	ChartIcon,
	ChevronRightIcon,
	CodeIcon,
	type IconComponent,
	InboxIcon,
	PlayIcon,
	SettingsIcon,
	UserPlusIcon,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
	List,
	ListItem,
	ListItemContent,
	ListItemDescription,
	ListItemTitle,
} from "@/components/ui/list";
import {
	Page,
	PageActions,
	PageContent,
	PageSection,
	PageSectionContent,
	PageSectionDescription,
	PageSectionHeader,
	PageSectionTitle,
	PageToolbar,
} from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { api, LeadlyApiError } from "@/lib/api";
import { useOrgPath } from "@/hooks/use-current-org";
import { Kpi } from "@/components/dashboard/kpi";
import { StatGroup } from "@/components/ui/stat";

export const Route = createFileRoute("/$orgSlug/agents/$agentId/")({
	component: AgentOverview,
});

function AgentOverview() {
	const orgPath = useOrgPath();
	const { agentId } = Route.useParams();

	const agentQuery = useQuery({
		queryKey: ["agent", agentId],
		queryFn: () => api.agents.get(agentId),
	});

	const summaryQuery = useQuery({
		queryKey: ["analytics-summary", agentId, 7],
		queryFn: () => api.analytics.summary(agentId, { windowDays: 7 }),
	});

	if (agentQuery.isLoading) {
		return (
			<Page>
				<PageContent width="narrow" className="flex flex-col gap-4">
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-20 w-full" />
				</PageContent>
			</Page>
		);
	}

	if (agentQuery.isError) {
		const err = agentQuery.error;
		const message =
			err instanceof LeadlyApiError
				? err.status === 404
					? "Agent not found."
					: `API ${err.status}: ${err.message}`
				: "Could not load agent.";
		return (
			<Page>
				<PageContent>
					<p className="text-sm text-destructive">{message}</p>
				</PageContent>
			</Page>
		);
	}

	const agent = agentQuery.data;
	if (!agent) return null;

	const s = summaryQuery.data;

	return (
		<Page>
			<PageToolbar>
				<span
					aria-hidden
					className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sheen text-xs font-semibold text-white shadow-solid"
					style={{ backgroundColor: agent.accentColor }}
				>
					{agent.name.charAt(0).toUpperCase()}
				</span>
				<span className="truncate text-sm font-medium">{agent.name}</span>
				<span className="truncate font-mono text-xs text-muted-foreground max-sm:hidden">
					{agent.defaultProvider} · {agent.defaultModel}
				</span>
				<PageActions>
					<Button asChild variant="ghost" size="sm">
						<Link to={orgPath(`/agents/${agentId}/settings`) as string}>
							<SettingsIcon />
							Settings
						</Link>
					</Button>
					<Button asChild variant="outline" size="sm">
						<Link to={orgPath(`/agents/${agentId}/playground`) as string}>
							<PlayIcon />
							Playground
						</Link>
					</Button>
				</PageActions>
			</PageToolbar>

			<PageContent width="narrow">
				<PageSection>
					<PageSectionHeader>
						<PageSectionTitle>Last 7 days</PageSectionTitle>
						<PageSectionDescription>
							Activity across every conversation this agent handled.
						</PageSectionDescription>
					</PageSectionHeader>
					<PageSectionContent>
						<StatGroup variant="inline">
							<Kpi
								label="Conversations"
								value={s?.conversations}
								loading={summaryQuery.isLoading}
							/>
							<Kpi
								label="Leads"
								value={s?.leadsCaptured}
								loading={summaryQuery.isLoading}
							/>
							<Kpi
								label="Handoffs"
								value={s?.handoffs}
								loading={summaryQuery.isLoading}
							/>
						</StatGroup>
					</PageSectionContent>
				</PageSection>

				<PageSection>
					<PageSectionHeader>
						<PageSectionTitle>Jump to</PageSectionTitle>
						<PageSectionDescription>
							Everything that belongs to this agent.
						</PageSectionDescription>
					</PageSectionHeader>
					<PageSectionContent>
						<List variant="inset">
							<QuickLink
								title="Inbox"
								description="Live conversations + transcripts"
								icon={InboxIcon}
								to={orgPath("/inbox")}
								search={{ agent: agentId }}
							/>
							<QuickLink
								title="Knowledge"
								description="Articles your agent answers from"
								icon={BookIcon}
								to={orgPath(`/agents/${agentId}/knowledge`)}
							/>
							<QuickLink
								title="Playground"
								description="Try it without installing"
								icon={PlayIcon}
								to={orgPath(`/agents/${agentId}/playground`)}
							/>
							<QuickLink
								title="Install"
								description="Drop the script on your site"
								icon={CodeIcon}
								to={orgPath(`/agents/${agentId}/install`)}
							/>
							<QuickLink
								title="Leads"
								description="Captured contacts"
								icon={UserPlusIcon}
								to={orgPath("/leads")}
								search={{ agent: agentId }}
							/>
							<QuickLink
								title="Analytics"
								description="Trends over time"
								icon={ChartIcon}
								to={orgPath("/analytics")}
								search={{ agent: agentId }}
							/>
						</List>
					</PageSectionContent>
				</PageSection>

				<PageSection>
					<PageSectionHeader>
						<PageSectionTitle>Greeting</PageSectionTitle>
						<PageSectionDescription>
							What visitors see first when they open the widget.
						</PageSectionDescription>
					</PageSectionHeader>
					<PageSectionContent>
						<div className="w-fit max-w-full rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2.5 text-sm leading-relaxed">
							{agent.greeting}
						</div>
					</PageSectionContent>
				</PageSection>
			</PageContent>
		</Page>
	);
}

function QuickLink({
	title,
	description,
	icon: Icon,
	to,
	search,
}: {
	title: string;
	description: string;
	icon: IconComponent;
	to: string;
	// Org-wide pages (inbox, leads, analytics) take the agent as a filter.
	search?: { agent: string };
}) {
	return (
		<ListItem asChild className="min-h-11 py-2">
			<Link to={to as string} search={search}>
				<Icon className="size-4 shrink-0 text-muted-foreground" />
				<ListItemContent className="flex-row items-baseline gap-2">
					<ListItemTitle className="shrink-0">{title}</ListItemTitle>
					<ListItemDescription>{description}</ListItemDescription>
				</ListItemContent>
				<ChevronRightIcon className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/list-item:opacity-100" />
			</Link>
		</ListItem>
	);
}
