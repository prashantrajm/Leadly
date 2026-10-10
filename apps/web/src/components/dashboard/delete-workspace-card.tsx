import type { Organization } from "@leadly/schemas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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

// Owner-only "Danger zone" on Settings → General. Deleting is permanent and
// takes every agent, conversation, lead and uploaded file with it, so the
// owner types the workspace name to confirm.
export function DeleteWorkspaceCard({ org }: { org: Organization }) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const confirmId = useId();
	const [open, setOpen] = useState(false);
	const [typed, setTyped] = useState("");

	const mutation = useMutation({
		mutationFn: () => api.orgs.delete(org.id),
		onSuccess: () => {
			queryClient.setQueryData<Organization[]>(["orgs"], (orgs) =>
				orgs?.filter((o) => o.id !== org.id),
			);
			queryClient.invalidateQueries({ queryKey: ["orgs"] });
			// /dashboard picks another workspace, or starts setup if none left.
			navigate({ to: "/dashboard", replace: true });
		},
	});

	return (
		<PageSection variant="grouped">
			<PageSectionHeader>
				<PageSectionTitle>Danger zone</PageSectionTitle>
			</PageSectionHeader>
			<SettingsCard>
				<SettingsRow>
					<SettingsRowLabel>
						<SettingsRowTitle>Delete workspace</SettingsRowTitle>
						<SettingsRowDescription>
							Delete this workspace and everything in it: agents, knowledge base,
							conversations, leads, visitors and API keys. Installed widgets stop
							working. This can't be undone.
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
							Delete workspace
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
						<AlertDialogTitle>Delete {org.name}?</AlertDialogTitle>
						<AlertDialogDescription>
							This permanently deletes the workspace for every member. Type{" "}
							<span className="font-medium text-foreground">{org.name}</span> to
							confirm.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div className="space-y-1.5">
						<Label htmlFor={confirmId} className="sr-only">
							Workspace name
						</Label>
						<Input
							id={confirmId}
							value={typed}
							onChange={(e) => setTyped(e.target.value)}
							autoComplete="off"
						/>
					</div>
					{mutation.isError && (
						<p className="text-sm text-destructive">
							{apiErrorMessage(mutation.error)}
						</p>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={mutation.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={(e) => {
								e.preventDefault();
								mutation.mutate();
							}}
							disabled={typed.trim() !== org.name || mutation.isPending}
							className="bg-destructive text-white hover:bg-destructive/90"
						>
							{mutation.isPending && (
								<SpinnerIcon className="mr-2 size-4 animate-spin" />
							)}
							Delete workspace
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</PageSection>
	);
}
