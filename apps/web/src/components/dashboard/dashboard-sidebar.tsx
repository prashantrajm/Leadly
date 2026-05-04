import { Link, useParams, useRouterState } from "@tanstack/react-router";
import {
	BarChart3,
	BookOpen,
	Bot,
	ChevronsUpDown,
	Code,
	Inbox,
	LayoutDashboard,
	LogOut,
	Play,
	Settings,
	Tags,
	Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarSeparator,
} from "@/components/ui/sidebar";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { authClient, useSession } from "@/lib/auth-client";

export function DashboardSidebar() {
	const { currentOrg, orgs, switchOrg } = useCurrentOrg();
	const { data: session } = useSession();
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	// agentId may or may not be in scope depending on which subroute we're on.
	const params = useParams({ strict: false }) as { agentId?: string };
	const agentId = params.agentId;

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
									<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-accent-blue text-accent-blue-foreground">
										<span className="text-sm font-semibold">
											{currentOrg?.name.charAt(0).toUpperCase() ?? "L"}
										</span>
									</div>
									<div className="grid flex-1 text-left text-sm leading-tight">
										<span className="truncate font-semibold">
											{currentOrg?.name ?? "Leadly"}
										</span>
										<span className="truncate text-xs text-muted-foreground">
											{orgs.length} org{orgs.length === 1 ? "" : "s"}
										</span>
									</div>
									<ChevronsUpDown className="ml-auto size-4" />
								</SidebarMenuButton>
							</DropdownMenuTrigger>
							<DropdownMenuContent
								className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
								align="start"
								sideOffset={4}
							>
								<DropdownMenuLabel className="text-xs text-muted-foreground">
									Organizations
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
							</DropdownMenuContent>
						</DropdownMenu>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupContent>
						<SidebarMenu>
							<NavLink to="/dashboard" pathname={pathname} icon={LayoutDashboard}>
								Overview
							</NavLink>
							<NavLink
								to="/dashboard/agents"
								pathname={pathname}
								icon={Bot}
								matchPrefix
							>
								Agents
							</NavLink>
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				{agentId && (
					<>
						<SidebarSeparator />
						<SidebarGroup>
							<SidebarGroupLabel>Current agent</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									<NavLink
										to={`/dashboard/agents/${agentId}/inbox`}
										pathname={pathname}
										icon={Inbox}
										matchPrefix
									>
										Inbox
									</NavLink>
									<NavLink
										to={`/dashboard/agents/${agentId}/knowledge`}
										pathname={pathname}
										icon={BookOpen}
										matchPrefix
									>
										Knowledge
									</NavLink>
									<NavLink
										to={`/dashboard/agents/${agentId}/leads`}
										pathname={pathname}
										icon={Tags}
										matchPrefix
									>
										Leads
									</NavLink>
									<NavLink
										to={`/dashboard/agents/${agentId}/visitors`}
										pathname={pathname}
										icon={Users}
										matchPrefix
									>
										Visitors
									</NavLink>
									<NavLink
										to={`/dashboard/agents/${agentId}/analytics`}
										pathname={pathname}
										icon={BarChart3}
										matchPrefix
									>
										Analytics
									</NavLink>
									<NavLink
										to={`/dashboard/agents/${agentId}/playground`}
										pathname={pathname}
										icon={Play}
										matchPrefix
									>
										Playground
									</NavLink>
									<NavLink
										to={`/dashboard/agents/${agentId}/install`}
										pathname={pathname}
										icon={Code}
										matchPrefix
									>
										Install
									</NavLink>
									<NavLink
										to={`/dashboard/agents/${agentId}/settings`}
										pathname={pathname}
										icon={Settings}
										matchPrefix
									>
										Settings
									</NavLink>
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					</>
				)}
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
									<Link to="/dashboard/settings/profile">Profile</Link>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<Link to="/dashboard/settings">Org settings</Link>
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
	children,
}: {
	to: string;
	pathname: string;
	icon: React.ComponentType<{ className?: string }>;
	matchPrefix?: boolean;
	children: React.ReactNode;
}) {
	const isActive = matchPrefix
		? pathname === to || pathname.startsWith(`${to}/`)
		: pathname === to;
	return (
		<SidebarMenuItem>
			<SidebarMenuButton asChild isActive={isActive}>
				<Link to={to}>
					<Icon className="size-4" />
					<span>{children}</span>
				</Link>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}
