import type { Agent } from "@leadly/api-client";
import type { MyInvitation } from "@leadly/schemas";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useRouterState } from "@tanstack/react-router";
import {
	BarChart3,
	BookOpen,
	ChevronRight,
	ChevronsUpDown,
	Code,
	Inbox,
	LayoutDashboard,
	LifeBuoy,
	Loader2,
	LogOut,
	Play,
	Plus,
	Settings,
	Tags,
	Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { CreateWorkspaceDialog } from "@/components/dashboard/create-workspace-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupAction,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuAction,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSkeleton,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useCurrentOrg, useOrgPath } from "@/hooks/use-current-org";
import {
	describeInvitation,
	useMyInvitations,
} from "@/hooks/use-my-invitations";
import { useOrgAgents } from "@/hooks/use-org-agents";
import { api } from "@/lib/api";
import { authClient, useSession } from "@/lib/auth-client";

export function DashboardSidebar() {
	const orgPath = useOrgPath();
	const { currentOrg, orgs, switchOrg } = useCurrentOrg();
	const { data: session } = useSession();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	// agentId may or may not be in scope depending on which subroute we're on.
	const params = useParams({ strict: false }) as { agentId?: string };
	const agentId = params.agentId;
	const { agents, isLoading: agentsLoading } = useOrgAgents();
	const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
	const { invitations, accept, decline, busyToken } = useMyInvitations();

	// Conversations paused for a human (handoff requested or taken over).
	// Polled so the badge is useful from any page, not just the inbox.
	const countsQuery = useQuery({
		queryKey: ["inbox-counts", currentOrg?.id],
		queryFn: () => api.conversations.counts(currentOrg?.id as string),
		enabled: Boolean(currentOrg),
		refetchInterval: 15_000,
	});
	const waitingOnHuman = countsQuery.data?.waitingOnHuman ?? 0;

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton
									size="lg"
									className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
								>
									<div className="relative flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-accent-blue text-accent-blue-foreground">
										<span className="text-sm font-semibold">
											{currentOrg?.name.charAt(0).toUpperCase() ?? "L"}
										</span>
										{invitations.length > 0 && (
											<span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-destructive ring-2 ring-sidebar">
												<span className="sr-only">
													{invitations.length} pending invitation
													{invitations.length === 1 ? "" : "s"}
												</span>
											</span>
										)}
									</div>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-semibold">
											{currentOrg?.name ?? "Leadly"}
										</span>
										{invitations.length > 0 ? (
											<span className="truncate text-xs font-medium text-accent-blue">
												{invitations.length} invitation
												{invitations.length === 1 ? "" : "s"}
											</span>
										) : (
											<span className="truncate text-xs text-muted-foreground">
												{orgs.length} workspace{orgs.length === 1 ? "" : "s"}
											</span>
										)}
									</div>
									<ChevronsUpDown className="ml-auto size-4" />
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
								align="start"
								sideOffset={4}
							>
								{invitations.length > 0 && (
									<>
										<DropdownMenuLabel className="text-xs text-muted-foreground">
											Invitations
										</DropdownMenuLabel>
										{invitations.map((inv) => (
											<SwitcherInvitation
												key={inv.token}
												invitation={inv}
												busy={busyToken === inv.token}
												onAccept={() => accept.mutate(inv)}
												onDecline={() => decline.mutate(inv)}
											/>
										))}
										<DropdownMenuSeparator />
									</>
								)}
								<DropdownMenuLabel className="text-xs text-muted-foreground">
									Workspaces
								</DropdownMenuLabel>
								{orgs.map((o) => (
									<DropdownMenuItem
										key={o.id}
										onClick={() => switchOrg(o.id)}
										className="gap-2"
									>
										<div className="flex size-6 items-center justify-center rounded-md border border-border bg-card">
											<span className="text-xs font-semibold">
												{o.name.charAt(0).toUpperCase()}
											</span>
										</div>
										{o.name}
										{o.id === currentOrg?.id && (
											<span className="ml-auto text-xs text-accent-blue">
												current
											</span>
										)}
									</DropdownMenuItem>
								))}
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={() => setCreateWorkspaceOpen(true)}
									className="gap-2"
								>
									<div className="flex size-6 items-center justify-center rounded-md border border-dashed border-border">
										<Plus className="size-3.5" />
									</div>
									New workspace
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
						<CreateWorkspaceDialog
							open={createWorkspaceOpen}
							onOpenChange={setCreateWorkspaceOpen}
						/>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							<NavLink
								to={orgPath()}
								pathname={pathname}
								icon={LayoutDashboard}
							>
								Overview
							</NavLink>
							<NavLink
								to={orgPath("/inbox")}
								pathname={pathname}
								icon={Inbox}
								matchPrefix
								badge={waitingOnHuman}
							>
								Inbox
							</NavLink>
							<NavLink to={orgPath("/leads")} pathname={pathname} icon={Tags}>
								Leads
							</NavLink>
							<NavLink
								to={orgPath("/visitors")}
								pathname={pathname}
								icon={Users}
							>
								Visitors
							</NavLink>
							<NavLink
								to={orgPath("/analytics")}
								pathname={pathname}
								icon={BarChart3}
							>
								Analytics
							</NavLink>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupLabel asChild>
						<Link to={orgPath("/agents")}>Agents</Link>
					</SidebarGroupLabel>
					<SidebarGroupAction asChild title="New agent">
						<Link to={orgPath("/agents")} search={{ new: true }}>
							<Plus />
							<span className="sr-only">New agent</span>
						</Link>
					</SidebarGroupAction>
					<SidebarGroupContent>
						<SidebarMenu>
							{agentsLoading ? (
								<SidebarMenuSkeleton showIcon />
							) : agents.length === 0 ? (
								<SidebarMenuItem>
									<SidebarMenuButton asChild tooltip="Create your first agent">
										<Link to={orgPath("/agents")} search={{ new: true }}>
											<Plus className="size-4" />
											<span>Create your first agent</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							) : (
								agents.map((agent) => (
									<AgentNavItem
										key={agent.id}
										agent={agent}
										pathname={pathname}
										// A lone agent is always expanded; otherwise expand
										// the one you're working in.
										defaultOpen={agents.length === 1 || agent.id === agentId}
									/>
								))
							)}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup className="mt-auto">
					<SidebarGroupContent>
						<SidebarMenu>
							<NavLink
								to={orgPath("/settings")}
								pathname={pathname}
								icon={Settings}
								matchPrefix
							>
								Settings
							</NavLink>
							<NavLink to="/docs" pathname={pathname} icon={LifeBuoy}>
								Docs &amp; help
							</NavLink>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<SidebarMenuButton size="lg">
									<Avatar className="size-7">
										<AvatarImage
											src={session?.user?.image ?? undefined}
											alt={session?.user?.name ?? ""}
										/>
										<AvatarFallback>
											{session?.user?.name?.charAt(0) ?? "?"}
										</AvatarFallback>
									</Avatar>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-medium">
											{session?.user?.name ?? "—"}
										</span>
										<span className="truncate text-xs text-muted-foreground">
											{session?.user?.email ?? ""}
										</span>
									</div>
									<ChevronsUpDown className="ml-auto size-4" />
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
								align="end"
								side="top"
							>
								<DropdownMenuLabel className="font-normal">
									<div className="flex flex-col">
										<span className="text-sm font-medium">
											{session?.user?.name}
										</span>
										<span className="text-xs text-muted-foreground">
											{session?.user?.email}
										</span>
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem asChild>
									<Link to={orgPath("/settings/profile")}>Profile</Link>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<Link to={orgPath("/settings")}>Org settings</Link>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={async () => {
										await authClient.signOut();
										window.location.href = "/";
									}}
								>
									<LogOut className="mr-2 size-4" />
									Sign out
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}

function NavLink({
	to,
	pathname,
	icon: Icon,
	matchPrefix,
	badge,
	children,
}: {
	to: string;
	pathname: string;
	icon: React.ComponentType<{ className?: string }>;
	matchPrefix?: boolean;
	badge?: number;
	children: string;
}) {
	const isActive = matchPrefix
		? pathname === to || pathname.startsWith(`${to}/`)
		: pathname === to;
	return (
		<SidebarMenuItem>
			<SidebarMenuButton asChild isActive={isActive} tooltip={children}>
				<Link to={to}>
					<Icon className="size-4" />
					<span>{children}</span>
				</Link>
			</SidebarMenuButton>
			{badge ? (
				<SidebarMenuBadge className="bg-accent-blue text-accent-blue-foreground">
					{badge}
				</SidebarMenuBadge>
			) : null}
		</SidebarMenuItem>
	);
}

// The setup pages that belong to one agent. Inbox, leads, visitors and
// analytics live at the top level with an agent filter instead.
const AGENT_PAGES = [
	{ segment: "knowledge", label: "Knowledge", icon: BookOpen },
	{ segment: "playground", label: "Playground", icon: Play },
	{ segment: "install", label: "Install", icon: Code },
	{ segment: "settings", label: "Settings", icon: Settings },
] as const;

function AgentNavItem({
	agent,
	pathname,
	defaultOpen,
}: {
	agent: Agent;
	pathname: string;
	defaultOpen: boolean;
}) {
	const orgPath = useOrgPath();
	const base = orgPath(`/agents/${agent.id}`);
	const [open, setOpen] = useState(defaultOpen);

	// Navigating into an agent (e.g. from the Agents page) expands it.
	useEffect(() => {
		if (defaultOpen) setOpen(true);
	}, [defaultOpen]);

	return (
		<Collapsible asChild open={open} onOpenChange={setOpen}>
			<SidebarMenuItem>
				<SidebarMenuButton
					asChild
					isActive={pathname === base}
					tooltip={agent.name}
				>
					<Link to={base}>
						<span
							className="flex size-4 shrink-0 items-center justify-center rounded text-[10px] font-semibold text-white"
							style={{ backgroundColor: agent.accentColor }}
						>
							{agent.name.charAt(0).toUpperCase()}
						</span>
						<span>{agent.name}</span>
					</Link>
				</SidebarMenuButton>
				<CollapsibleTrigger asChild>
					<SidebarMenuAction className="data-[state=open]:rotate-90">
						<ChevronRight />
						<span className="sr-only">Toggle {agent.name}</span>
					</SidebarMenuAction>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<SidebarMenuSub>
						{AGENT_PAGES.map(({ segment, label, icon: Icon }) => {
							const to = `${base}/${segment}`;
							return (
								<SidebarMenuSubItem key={segment}>
									<SidebarMenuSubButton
										asChild
										isActive={pathname === to || pathname.startsWith(`${to}/`)}
									>
										<Link to={to}>
											<Icon />
											<span>{label}</span>
										</Link>
									</SidebarMenuSubButton>
								</SidebarMenuSubItem>
							);
						})}
					</SidebarMenuSub>
				</CollapsibleContent>
			</SidebarMenuItem>
		</Collapsible>
	);
}

// An invitation inside the workspace switcher. Not a menu item: it has its
// own Accept / Decline buttons, and clicking the row shouldn't do anything.
function SwitcherInvitation({
	invitation,
	busy,
	onAccept,
	onDecline,
}: {
	invitation: MyInvitation;
	busy: boolean;
	onAccept: () => void;
	onDecline: () => void;
}) {
	return (
		<div className="flex items-start gap-2 px-2 py-1.5">
			<div className="flex size-6 shrink-0 items-center justify-center rounded-md border border-dashed border-accent-blue/60 text-accent-blue">
				<span className="text-xs font-semibold">
					{invitation.organization.name.charAt(0).toUpperCase()}
				</span>
			</div>
			<div className="min-w-0 flex-1">
				<div className="truncate text-sm font-medium">
					{invitation.organization.name}
				</div>
				<div className="truncate text-xs text-muted-foreground">
					{describeInvitation(invitation)}
				</div>
				<div className="mt-1.5 flex gap-1.5">
					<Button
						size="sm"
						className="h-7 bg-accent-blue px-2.5 text-xs text-accent-blue-foreground hover:bg-accent-blue/90"
						disabled={busy}
						onClick={onAccept}
					>
						{busy ? <Loader2 className="size-3 animate-spin" /> : "Accept"}
					</Button>
					<Button
						size="sm"
						variant="ghost"
						className="h-7 px-2.5 text-xs"
						disabled={busy}
						onClick={onDecline}
					>
						Decline
					</Button>
				</div>
			</div>
		</div>
	);
}
