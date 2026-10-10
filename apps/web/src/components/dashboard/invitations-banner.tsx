import { Loader2, Mail, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useMyInvitations } from "@/hooks/use-my-invitations";
import { apiErrorMessage } from "@/lib/api";

const DISMISSED_KEY = "leadly:dismissed-invitations";

function readDismissed(): string[] {
	try {
		return JSON.parse(
			sessionStorage.getItem(DISMISSED_KEY) ?? "[]",
		) as string[];
	} catch {
		return [];
	}
}

function writeDismissed(tokens: string[]) {
	try {
		sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(tokens));
	} catch {}
}

// Strip under the top bar: the first pending invitation with Accept /
// Decline. Dismissing hides it for this browser session only — the
// invitations stay in the workspace switcher.
export function InvitationsBanner() {
	const { invitations, accept, decline, busyToken } = useMyInvitations();
	const [dismissed, setDismissed] = useState(readDismissed);

	const visible = invitations.filter((i) => !dismissed.includes(i.token));
	const inv = visible[0];
	if (!inv) return null;

	const busy = busyToken === inv.token;
	const more = visible.length - 1;
	const error = accept.error ?? decline.error;

	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-accent-blue/20 bg-accent-blue/5 px-4 py-2.5 text-sm md:px-6">
			<Mail className="size-4 shrink-0 text-accent-blue" />
			<p className="min-w-0 flex-1">
				<span className="font-medium">{inv.invitedByName ?? "A teammate"}</span>{" "}
				invited you to join{" "}
				<span className="font-medium">{inv.organization.name}</span> as{" "}
				{inv.role === "admin" ? "an admin" : `a ${inv.role}`}.
				{more > 0 && (
					<span className="text-muted-foreground">
						{" "}
						{more} more in the workspace menu.
					</span>
				)}
				{(accept.isError || decline.isError) && (
					<span className="block text-destructive">
						{apiErrorMessage(error)}
					</span>
				)}
			</p>
			<div className="flex items-center gap-1.5">
				<Button
					size="sm"
					variant="ghost"
					disabled={busy}
					onClick={() => decline.mutate(inv)}
				>
					Decline
				</Button>
				<Button
					size="sm"
					disabled={busy}
					onClick={() => accept.mutate(inv)}
					className="bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90"
				>
					{busy && accept.isPending && (
						<Loader2 className="mr-1.5 size-3.5 animate-spin" />
					)}
					Accept
				</Button>
				<Button
					size="icon-sm"
					variant="ghost"
					className="text-muted-foreground"
					onClick={() => {
						const next = [...dismissed, ...visible.map((i) => i.token)];
						setDismissed(next);
						writeDismissed(next);
					}}
				>
					<X className="size-4" />
					<span className="sr-only">Hide for now</span>
				</Button>
			</div>
		</div>
	);
}
