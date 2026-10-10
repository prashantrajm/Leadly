import { createFileRoute } from "@tanstack/react-router";
import { DeleteAccountCard } from "@/components/dashboard/delete-account-card";
import { LogOutIcon } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Page,
	PageContent,
	PageSection,
	PageSectionDescription,
	PageSectionHeader,
	PageSectionTitle,
} from "@/components/ui/page";
import {
	SettingsCard,
	SettingsRow,
	SettingsRowControl,
	SettingsRowDescription,
	SettingsRowLabel,
	SettingsRowTitle,
} from "@/components/ui/settings";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient, useSession } from "@/lib/auth-client";

export const Route = createFileRoute("/$orgSlug/settings/profile")({
	component: ProfilePage,
});

function ProfilePage() {
	const { data: session, isPending } = useSession();
	const user = session?.user;

	return (
		<Page>
			<PageContent width="narrow">
				<PageSection variant="grouped">
					<PageSectionHeader>
						<PageSectionTitle>Account</PageSectionTitle>
						<PageSectionDescription>
							Profile editing lands later — for now this is read-only. You can
							change your name through your social sign-in provider.
						</PageSectionDescription>
					</PageSectionHeader>
					{isPending ? (
						<Skeleton className="h-48 rounded-xl" />
					) : user ? (
						<SettingsCard>
							<SettingsRow className="flex-row items-center">
								<SettingsRowLabel>
									<SettingsRowTitle>Profile picture</SettingsRowTitle>
									<SettingsRowDescription>
										From your sign-in provider.
									</SettingsRowDescription>
								</SettingsRowLabel>
								<Avatar className="size-10">
									<AvatarImage
										src={user.image ?? undefined}
										alt={user.name ?? ""}
									/>
									<AvatarFallback>{user.name?.charAt(0) ?? "?"}</AvatarFallback>
								</Avatar>
							</SettingsRow>
							<SettingsRow>
								<SettingsRowLabel>
									<SettingsRowTitle>Name</SettingsRowTitle>
								</SettingsRowLabel>
								<SettingsRowControl className="min-w-0 text-sm text-muted-foreground">
									<span className="truncate">{user.name}</span>
								</SettingsRowControl>
							</SettingsRow>
							<SettingsRow>
								<SettingsRowLabel>
									<SettingsRowTitle>Email</SettingsRowTitle>
								</SettingsRowLabel>
								<SettingsRowControl className="min-w-0 text-sm text-muted-foreground">
									<span className="truncate">{user.email}</span>
								</SettingsRowControl>
							</SettingsRow>
						</SettingsCard>
					) : (
						<p className="text-sm text-muted-foreground">No session.</p>
					)}
				</PageSection>

				<PageSection variant="grouped">
					<PageSectionHeader>
						<PageSectionTitle>Session</PageSectionTitle>
					</PageSectionHeader>
					<SettingsCard>
						<SettingsRow>
							<SettingsRowLabel>
								<SettingsRowTitle>Sign out</SettingsRowTitle>
								<SettingsRowDescription>
									Ends this session. You'll need to sign in again to access the
									dashboard.
								</SettingsRowDescription>
							</SettingsRowLabel>
							<SettingsRowControl>
								<Button
									variant="outline"
									size="sm"
									onClick={async () => {
										await authClient.signOut();
										window.location.href = "/";
									}}
								>
									<LogOutIcon />
									Sign out
								</Button>
							</SettingsRowControl>
						</SettingsRow>
					</SettingsCard>
				</PageSection>

				{user && <DeleteAccountCard email={user.email} />}
			</PageContent>
		</Page>
	);
}
