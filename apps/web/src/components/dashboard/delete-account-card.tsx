import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { SpinnerIcon, TrashIcon } from "@/components/icons";
import { useId, useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	PageSection,
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
import { api, apiErrorMessage } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

// Profile → Delete account. The confirm dialog spells out which workspaces
// go with the account (ones where you're the only member) and which you just
// leave. If you're the only owner of a shared workspace, deletion is blocked
// until you hand ownership over or delete that workspace.
export function DeleteAccountCard({ email }: { email: string }) {
	const confirmId = useId();
	const [open, setOpen] = useState(false);
	const [typed, setTyped] = useState("");

	const preview = useQuery({
		queryKey: ["account-deletion-preview"],
		queryFn: () => api.me.deletionPreview(),
		enabled: open,
		staleTime: 0,
	});

	const mutation = useMutation({
		mutationFn: () => api.me.delete(),
		onSuccess: async () => {
			// The account is gone server-side; clear the (cookie-cached)
			// session client-side too, then leave the app.
			await authClient.signOut().catch(() => {});
			window.location.href = "/";
		},
	});

	const plan = preview.data;
	const blocked = (plan?.blocking.length ?? 0) > 0;
	const confirmed = typed.trim().toLowerCase() === email.toLowerCase();

	return (
		<PageSection variant="grouped">
			<PageSectionHeader>
				<PageSectionTitle>Danger zone</PageSectionTitle>
			</PageSectionHeader>
			<SettingsCard>
				<SettingsRow>
					<SettingsRowLabel>
						<SettingsRowTitle>Delete account</SettingsRowTitle>
						<SettingsRowDescription>
							Permanently delete your account. Workspaces where you're the only
							member are deleted with it. This can't be undone.
						</SettingsRowDescription>
					</SettingsRowLabel>
					<SettingsRowControl>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setOpen(true)}
							className="text-destructive hover:bg-destructive/10 hover:text-destructive"
						>
							<TrashIcon />
							Delete account
						</Button>
					</SettingsRowControl>
				</SettingsRow>
			</SettingsCard>

			<AlertDialog
				open={open}
				onOpenChange={(o) => {
					setOpen(o);
					if (!o) {
						setTyped("");
						mutation.reset();
					}
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete your account?</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div className="space-y-3 text-sm text-muted-foreground">
								{preview.isLoading || !plan ? (
									<p className="flex items-center gap-2">
										<SpinnerIcon className="size-3.5 animate-spin" />
										Checking your workspaces…
									</p>
								) : blocked ? (
									<>
										<p>
											You're the only owner of these shared workspaces. Make
											another member an owner (Settings → Members) or delete the
											workspace first:
										</p>
										<WorkspaceList items={plan.blocking} linkToSettings />
									</>
								) : (
									<>
										{plan.deleteWorkspaces.length > 0 && (
											<>
												<p>
													These workspaces will be deleted with everything in
													them:
												</p>
												<WorkspaceList items={plan.deleteWorkspaces} />
											</>
										)}
										{plan.leaveWorkspaces.length > 0 && (
											<>
												<p>You'll be removed from:</p>
												<WorkspaceList items={plan.leaveWorkspaces} />
											</>
										)}
										<p>
											Type{" "}
											<span className="font-medium text-foreground">
												{email}
											</span>{" "}
											to confirm.
										</p>
									</>
								)}
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					{plan && !blocked && (
						<div>
							<Label htmlFor={confirmId} className="sr-only">
								Your email
							</Label>
							<Input
								id={confirmId}
								value={typed}
								onChange={(e) => setTyped(e.target.value)}
								autoComplete="off"
							/>
						</div>
					)}
					{(mutation.isError || preview.isError) && (
						<p className="text-sm text-destructive">
							{apiErrorMessage(mutation.error ?? preview.error)}
						</p>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={mutation.isPending}>
							Cancel
						</AlertDialogCancel>
						{!blocked && (
							<AlertDialogAction
								onClick={(e) => {
									e.preventDefault();
									mutation.mutate();
								}}
								disabled={!plan || !confirmed || mutation.isPending}
								className="bg-destructive text-white hover:bg-destructive/90"
							>
								{mutation.isPending && (
									<SpinnerIcon className="mr-2 size-4 animate-spin" />
								)}
								Delete account
							</AlertDialogAction>
						)}
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</PageSection>
	);
}

function WorkspaceList({
	items,
	linkToSettings = false,
}: {
	items: Array<{ id: string; name: string; slug: string }>;
	linkToSettings?: boolean;
}) {
	return (
		<ul className="list-disc space-y-1 pl-5">
			{items.map((w) => (
				<li key={w.id}>
					{linkToSettings ? (
						<Link
							to="/$orgSlug/settings"
							params={{ orgSlug: w.slug }}
							className="font-medium text-foreground hover:underline"
						>
							{w.name}
						</Link>
					) : (
						<span className="font-medium text-foreground">{w.name}</span>
					)}
				</li>
			))}
		</ul>
	);
}
