import type {
	Invitation,
	MembershipRole,
	OrganizationWithMembers,
} from "@leadly/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Check, Copy, Loader2, Mail, Plus, UserMinus, X } from "lucide-react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api, apiErrorMessage } from "@/lib/api";
import { useSession } from "@/lib/auth-client";

export function inviteLink(token: string) {
	return `${window.location.origin}/invite/${token}`;
}

// Settings → Members: who's in the workspace, their roles, and pending
// invitations. Admins invite and remove; owners also change roles.
export function MembersSettings({ orgId }: { orgId: string }) {
	const { data: session } = useSession();
	const orgQuery = useQuery({
		queryKey: ["org", orgId],
		queryFn: () => api.orgs.get(orgId),
	});
	const myRole = orgQuery.data?.memberships.find(
		(m) => m.userId === session?.user?.id,
	)?.role;
	const isOwner = myRole === "owner";
	const isAdmin = isOwner || myRole === "admin";

	const [inviteOpen, setInviteOpen] = useState(false);

	return (
		<div className="space-y-6">
			<section className="space-y-3">
				<div className="flex items-center justify-between gap-3">
					<h2 className="text-base font-semibold tracking-tight">Members</h2>
					{isAdmin && (
						<Button
							onClick={() => setInviteOpen(true)}
							className="bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90"
						>
							<Plus className="mr-1 size-4" />
							Invite member
						</Button>
					)}
				</div>
				{orgQuery.isLoading ? (
					<Skeleton className="h-40 rounded-xl" />
				) : orgQuery.isError || !orgQuery.data ? (
					<ErrorText err={orgQuery.error} />
				) : (
					<MemberList
						org={orgQuery.data}
						myUserId={session?.user?.id}
						isOwner={isOwner}
						isAdmin={isAdmin}
					/>
				)}
			</section>

			{isAdmin && <PendingInvitations orgId={orgId} />}

			{isAdmin && (
				<InviteDialog
					orgId={orgId}
					canInviteOwner={isOwner}
					open={inviteOpen}
					onOpenChange={setInviteOpen}
				/>
			)}
		</div>
	);
}

function MemberList({
	org,
	myUserId,
	isOwner,
	isAdmin,
}: {
	org: OrganizationWithMembers;
	myUserId?: string;
	isOwner: boolean;
	isAdmin: boolean;
}) {
	const queryClient = useQueryClient();
	const [confirmRemove, setConfirmRemove] = useState<{
		userId: string;
		name: string;
	} | null>(null);
	const ownerCount = org.memberships.filter((m) => m.role === "owner").length;

	const roleMutation = useMutation({
		mutationFn: (v: { userId: string; role: MembershipRole }) =>
			api.orgs.updateMemberRole(org.id, v.userId, { role: v.role }),
		onSettled: () =>
			queryClient.invalidateQueries({ queryKey: ["org", org.id] }),
	});
	const removeMutation = useMutation({
		mutationFn: (userId: string) => api.orgs.removeMember(org.id, userId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["org", org.id] });
			setConfirmRemove(null);
		},
	});

	return (
		<>
			<Card>
				<CardContent className="p-0">
					<ul className="divide-y divide-border/60">
						{org.memberships.map((m) => {
							const lastOwner = m.role === "owner" && ownerCount <= 1;
							// Admins can remove members/admins; owners can remove anyone
							// but the last owner. Nobody removes themselves here.
							const canRemove =
								m.userId !== myUserId &&
								(isOwner ? !lastOwner : isAdmin && m.role !== "owner");
							return (
								<li key={m.id} className="flex items-center gap-3 px-4 py-3">
									<Avatar className="size-9">
										<AvatarImage src={m.user.image ?? undefined} />
										<AvatarFallback>
											{m.user.name.charAt(0).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<div className="min-w-0 flex-1">
										<div className="truncate text-sm font-medium">
											{m.user.name}
											{m.userId === myUserId && (
												<span className="ml-1.5 text-xs font-normal text-muted-foreground">
													(you)
												</span>
											)}
										</div>
										<div className="truncate text-xs text-muted-foreground">
											{m.user.email}
										</div>
									</div>
									{isOwner && !lastOwner ? (
										<Select
											value={m.role}
											disabled={roleMutation.isPending}
											onValueChange={(role) =>
												roleMutation.mutate({
													userId: m.userId,
													role: role as MembershipRole,
												})
											}
										>
											<SelectTrigger size="sm" className="w-28">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="owner">Owner</SelectItem>
												<SelectItem value="admin">Admin</SelectItem>
												<SelectItem value="member">Member</SelectItem>
											</SelectContent>
										</Select>
									) : (
										<RoleBadge role={m.role} />
									)}
									{canRemove ? (
										<Button
											variant="ghost"
											size="icon-sm"
											onClick={() =>
												setConfirmRemove({
													userId: m.userId,
													name: m.user.name,
												})
											}
											className="text-muted-foreground hover:text-destructive"
										>
											<UserMinus className="size-4" />
											<span className="sr-only">Remove {m.user.name}</span>
										</Button>
									) : (
										<span className="size-8" />
									)}
								</li>
							);
						})}
					</ul>
				</CardContent>
			</Card>
			{roleMutation.isError && <ErrorText err={roleMutation.error} />}

			<AlertDialog
				open={Boolean(confirmRemove)}
				onOpenChange={(o) => !o && setConfirmRemove(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove {confirmRemove?.name}?</AlertDialogTitle>
						<AlertDialogDescription>
							They lose access to every agent in this workspace. You can invite
							them again later.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{removeMutation.isError && <ErrorText err={removeMutation.error} />}
					<AlertDialogFooter>
						<AlertDialogCancel disabled={removeMutation.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={(e) => {
								e.preventDefault();
								if (confirmRemove) removeMutation.mutate(confirmRemove.userId);
							}}
							disabled={removeMutation.isPending}
							className="bg-destructive text-white hover:bg-destructive/90"
						>
							{removeMutation.isPending && (
								<Loader2 className="mr-2 size-4 animate-spin" />
							)}
							Remove
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

function PendingInvitations({ orgId }: { orgId: string }) {
	const queryClient = useQueryClient();
	const q = useQuery({
		queryKey: ["invitations", orgId],
		queryFn: () => api.invitations.list(orgId),
	});
	const revoke = useMutation({
		mutationFn: (id: string) => api.invitations.revoke(orgId, id),
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: ["invitations", orgId] }),
	});

	if (q.isLoading || !q.data || q.data.length === 0) return null;

	return (
		<section className="space-y-3">
			<h2 className="text-base font-semibold tracking-tight">
				Pending invitations
			</h2>
			<Card>
				<CardContent className="p-0">
					<ul className="divide-y divide-border/60">
						{q.data.map((inv) => (
							<li key={inv.id} className="flex items-center gap-3 px-4 py-3">
								<div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border">
									<Mail className="size-4 text-muted-foreground" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="truncate text-sm font-medium">
										{inv.email}
									</div>
									<div className="truncate text-xs text-muted-foreground">
										Expires{" "}
										{formatDistanceToNow(new Date(inv.expiresAt), {
											addSuffix: true,
										})}
										{inv.invitedBy && ` · invited by ${inv.invitedBy.name}`}
									</div>
								</div>
								<RoleBadge role={inv.role} />
								<CopyButton text={inviteLink(inv.token)} label="Copy link" />
								<Button
									variant="ghost"
									size="icon-sm"
									disabled={revoke.isPending}
									onClick={() => revoke.mutate(inv.id)}
									className="text-muted-foreground hover:text-destructive"
								>
									<X className="size-4" />
									<span className="sr-only">
										Revoke invitation for {inv.email}
									</span>
								</Button>
							</li>
						))}
					</ul>
				</CardContent>
			</Card>
		</section>
	);
}

function InviteDialog({
	orgId,
	canInviteOwner,
	open,
	onOpenChange,
}: {
	orgId: string;
	canInviteOwner: boolean;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const emailId = useId();
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<MembershipRole>("member");
	const [created, setCreated] = useState<Invitation | null>(null);

	const mutation = useMutation({
		mutationFn: () => api.invitations.create(orgId, { email, role }),
		onSuccess: (inv) => {
			queryClient.invalidateQueries({ queryKey: ["invitations", orgId] });
			setCreated(inv);
		},
	});

	function close(next: boolean) {
		onOpenChange(next);
		if (!next) {
			setEmail("");
			setRole("member");
			setCreated(null);
			mutation.reset();
		}
	}

	return (
		<Dialog open={open} onOpenChange={close}>
			<DialogContent>
				{created ? (
					<>
						<DialogHeader>
							<DialogTitle>Share the invite link</DialogTitle>
							<DialogDescription>
								Send this link to {created.email}. They'll need to sign in (or
								sign up) with that email to join. It expires in 14 days.
							</DialogDescription>
						</DialogHeader>
						<div className="flex items-center gap-2">
							<Input
								readOnly
								value={inviteLink(created.token)}
								className="font-mono text-xs"
								onFocus={(e) => e.target.select()}
							/>
							<CopyButton
								text={inviteLink(created.token)}
								label="Copy"
								variant="outline"
							/>
						</div>
						<DialogFooter>
							<Button onClick={() => close(false)}>Done</Button>
						</DialogFooter>
					</>
				) : (
					<>
						<DialogHeader>
							<DialogTitle>Invite a teammate</DialogTitle>
							<DialogDescription>
								They'll get access to every agent in this workspace. You'll get
								a link to send them.
							</DialogDescription>
						</DialogHeader>
						<form
							onSubmit={(e) => {
								e.preventDefault();
								mutation.mutate();
							}}
							className="space-y-4"
						>
							<div className="space-y-1.5">
								<Label htmlFor={emailId}>Email</Label>
								<div className="relative">
									<Mail className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
									<Input
										id={emailId}
										type="email"
										placeholder="teammate@yourco.com"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										required
										className="pl-8"
										autoFocus
									/>
								</div>
							</div>
							<div className="space-y-1.5">
								<Label>Role</Label>
								<Select
									value={role}
									onValueChange={(v) => setRole(v as MembershipRole)}
								>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="member">Member</SelectItem>
										<SelectItem value="admin">
											Admin — can invite and manage members
										</SelectItem>
										{canInviteOwner && (
											<SelectItem value="owner">
												Owner — full control
											</SelectItem>
										)}
									</SelectContent>
								</Select>
							</div>
							{mutation.isError && <ErrorText err={mutation.error} />}
							<DialogFooter>
								<Button
									type="button"
									variant="outline"
									onClick={() => close(false)}
									disabled={mutation.isPending}
								>
									Cancel
								</Button>
								<Button
									type="submit"
									disabled={!email || mutation.isPending}
									className="bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90"
								>
									{mutation.isPending && (
										<Loader2 className="mr-2 size-4 animate-spin" />
									)}
									Create invite link
								</Button>
							</DialogFooter>
						</form>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}

function CopyButton({
	text,
	label,
	variant = "ghost",
}: {
	text: string;
	label: string;
	variant?: "ghost" | "outline";
}) {
	const [copied, setCopied] = useState(false);
	return (
		<Button
			type="button"
			variant={variant}
			size="sm"
			onClick={async () => {
				try {
					await navigator.clipboard.writeText(text);
					setCopied(true);
					setTimeout(() => setCopied(false), 1500);
				} catch {
					// Clipboard blocked (permissions / insecure context): the link
					// is still visible to copy by hand.
				}
			}}
		>
			{copied ? (
				<Check className="mr-1 size-3.5" />
			) : (
				<Copy className="mr-1 size-3.5" />
			)}
			{copied ? "Copied" : label}
		</Button>
	);
}

function RoleBadge({ role }: { role: MembershipRole }) {
	return (
		<span className="rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
			{role}
		</span>
	);
}

function ErrorText({ err }: { err: unknown }) {
	return <p className="text-sm text-destructive">{apiErrorMessage(err)}</p>;
}
