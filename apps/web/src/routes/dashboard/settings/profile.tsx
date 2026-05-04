import { createFileRoute } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient, useSession } from "@/lib/auth-client";

export const Route = createFileRoute("/dashboard/settings/profile")({
	component: ProfilePage,
});

function ProfilePage() {
	const { data: session, isPending } = useSession();

	return (
		<div className="mx-auto max-w-3xl">
			<header className="mb-8">
				<h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Your account, on this device.
				</p>
			</header>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Account</CardTitle>
					<CardDescription>
						Profile editing lands later — for now this is read-only. You can
						change your name through your social sign-in provider.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{isPending ? (
						<div className="flex items-center gap-4">
							<Skeleton className="size-12 rounded-full" />
							<div className="flex-1 space-y-2">
								<Skeleton className="h-4 w-40" />
								<Skeleton className="h-3 w-56" />
							</div>
						</div>
					) : session?.user ? (
						<div className="flex items-center gap-4">
							<Avatar className="size-12">
								<AvatarImage
									src={session.user.image ?? undefined}
									alt={session.user.name ?? ""}
								/>
								<AvatarFallback>
									{session.user.name?.charAt(0) ?? "?"}
								</AvatarFallback>
							</Avatar>
							<div className="min-w-0 flex-1">
								<div className="truncate text-base font-semibold tracking-tight">
									{session.user.name}
								</div>
								<div className="truncate text-sm text-muted-foreground">
									{session.user.email}
								</div>
							</div>
						</div>
					) : (
						<p className="text-sm text-muted-foreground">No session.</p>
					)}
				</CardContent>
			</Card>

			<Card className="mt-6 border-destructive/30">
				<CardHeader>
					<CardTitle className="text-base">Sign out</CardTitle>
					<CardDescription>
						Ends this session. You'll need to sign in again to access the
						dashboard.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button
						variant="outline"
						onClick={async () => {
							await authClient.signOut();
							window.location.href = "/";
						}}
						className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
					>
						<LogOut className="mr-2 size-4" />
						Sign out
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
