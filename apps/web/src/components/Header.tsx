import { Link } from "@tanstack/react-router";
import { GithubIcon, MenuIcon } from "@/components/icons";
import React from "react";
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
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import { authClient, useSession } from "@/lib/auth-client";
import { ModeToggle } from "./mode-toggle";
import { Button } from "./ui/button";

type NavItem = { title: string; href: string };

const NAV: NavItem[] = [
	{ title: "Features", href: "/#features" },
	{ title: "Pricing", href: "/pricing" },
	{ title: "Docs", href: "/docs" },
	{ title: "Changelog", href: "/changelog" },
	{ title: "Blog", href: "/blog" },
];

export function Header() {
	const [isOpen, setIsOpen] = React.useState(false);
	const { data: session, isPending } = useSession();

	return (
		<header className="relative z-40 w-full border-b border-border/60 bg-background">
			<div className="container mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
				{/* Wordmark */}
				<Link
					to="/"
					className="flex items-center gap-2 text-base font-semibold tracking-tight transition-opacity hover:opacity-80"
					aria-label="Leadly home"
				>
					<span className="inline-block h-2 w-2 rounded-full bg-accent-blue" />
					Leadly
				</Link>

				{/* Desktop nav */}
				<nav className="hidden items-center gap-7 md:flex">
					{NAV.map((item) => (
						<Link
							key={item.title}
							to={item.href}
							className="text-sm text-muted-foreground transition-colors hover:text-foreground"
						>
							{item.title}
						</Link>
					))}
				</nav>

				{/* Right cluster */}
				<div className="hidden items-center gap-2 md:flex">
					<ModeToggle />
					<Button
						variant="ghost"
						size="icon"
						asChild
						className="h-8 w-8 text-muted-foreground hover:text-foreground"
					>
						<a
							href="https://github.com/prashantrajm/Leadly"
							target="_blank"
							rel="noopener noreferrer"
							aria-label="GitHub"
						>
							<GithubIcon className="h-4 w-4" />
						</a>
					</Button>

					{isPending ? (
						<div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
					) : session?.user ? (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="ghost"
									className="relative h-8 w-8 rounded-full p-0"
								>
									<Avatar className="h-8 w-8">
										<AvatarImage
											src={session.user?.image || ""}
											alt={session.user?.name || ""}
										/>
										<AvatarFallback>
											{session.user?.name?.charAt(0) || "?"}
										</AvatarFallback>
									</Avatar>
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent className="w-56" align="end" forceMount>
								<DropdownMenuLabel className="font-normal">
									<div className="flex flex-col space-y-1">
										<p className="text-sm font-medium leading-none">
											{session.user?.name}
										</p>
										<p className="text-xs leading-none text-muted-foreground">
											{session.user?.email}
										</p>
									</div>
								</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem asChild>
									<a href="/dashboard">Dashboard</a>
								</DropdownMenuItem>
								<DropdownMenuItem asChild>
									<a href="/settings">Settings</a>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									onClick={async () => {
										await authClient.signOut();
									}}
								>
									Log out
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					) : (
						<>
							<Button
								variant="ghost"
								size="sm"
								asChild
								className="text-muted-foreground hover:text-foreground"
							>
								<Link to="/auth">Sign in</Link>
							</Button>
							<Button
								variant="accent"
								size="sm"
								asChild
							>
								<Link to="/auth">Get started</Link>
							</Button>
						</>
					)}
				</div>

				{/* Mobile cluster */}
				<div className="flex items-center gap-2 md:hidden">
					<ModeToggle />
					{session?.user && (
						<Avatar className="h-8 w-8">
							<AvatarImage
								src={session.user?.image || ""}
								alt={session.user?.name || ""}
							/>
							<AvatarFallback>
								{session.user?.name?.charAt(0) || "?"}
							</AvatarFallback>
						</Avatar>
					)}
					<Sheet open={isOpen} onOpenChange={setIsOpen}>
						<SheetTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-9 w-9 text-muted-foreground hover:text-foreground"
								aria-label="Open menu"
							>
								<MenuIcon className="h-5 w-5" />
							</Button>
						</SheetTrigger>
						<SheetContent side="right" className="w-[300px] sm:w-[340px]">
							<SheetHeader>
								<SheetTitle className="text-left text-base font-semibold tracking-tight">
									Leadly
								</SheetTitle>
							</SheetHeader>
							<nav className="mt-6 flex flex-col">
								{NAV.map((item) => (
									<Link
										key={item.title}
										to={item.href}
										onClick={() => setIsOpen(false)}
										className="border-b border-border/40 py-3 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
									>
										{item.title}
									</Link>
								))}
								<a
									href="https://github.com/prashantrajm/Leadly"
									target="_blank"
									rel="noopener noreferrer"
									onClick={() => setIsOpen(false)}
									className="border-b border-border/40 py-3 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
								>
									GitHub
								</a>
							</nav>
							<div className="mt-6 flex flex-col gap-2">
								{session?.user ? (
									<Button
										variant="outline"
										onClick={async () => {
											await authClient.signOut();
											setIsOpen(false);
										}}
									>
										Log out
									</Button>
								) : (
									<>
										<Button variant="outline" asChild>
											<Link to="/auth" onClick={() => setIsOpen(false)}>
												Sign in
											</Link>
										</Button>
										<Button
											variant="accent"
											asChild
										>
											<Link to="/auth" onClick={() => setIsOpen(false)}>
												Get started
											</Link>
										</Button>
									</>
								)}
							</div>
						</SheetContent>
					</Sheet>
				</div>
			</div>
		</header>
	);
}
