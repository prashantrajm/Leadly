import { OrgSlugSchema, type Organization } from "@leadly/schemas";
import { slugify } from "@leadly/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check, Loader2, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	describeInvitation,
	useMyInvitations,
} from "@/hooks/use-my-invitations";
import { api, apiErrorMessage, LeadlyApiError } from "@/lib/api";
import { authClient, useSession } from "@/lib/auth-client";

const CHECK_DEBOUNCE_MS = 300;

// Create a workspace: name + URL slug, with a live availability check on
// the slug so Save only enables for a URL that's actually free. With
// `firstWorkspace` it's the non-dismissible first-sign-in setup.
export function CreateWorkspaceDialog({
	open,
	onOpenChange,
	firstWorkspace = false,
}: {
	open: boolean;
	onOpenChange?: (open: boolean) => void;
	firstWorkspace?: boolean;
}) {
	const { data: session, isPending: sessionPending } = useSession();
	const userName = session?.user?.name?.trim() || "";
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const nameId = useId();
	const slugId = useId();

	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	// Until the user types in the URL field, it follows the name and silently
	// takes our suggestion when the derived slug is taken.
	const [slugTouched, setSlugTouched] = useState(false);
	const [prefilled, setPrefilled] = useState(false);

	// First workspace: suggest "<Name>'s workspace" at /<name> once the
	// session is known. Additional workspaces start blank.
	useEffect(() => {
		if (!firstWorkspace || prefilled || !open || sessionPending) return;
		setName(userName ? `${userName}'s workspace` : "My workspace");
		setSlug(slugify(userName) || "workspace");
		setPrefilled(true);
	}, [firstWorkspace, open, prefilled, sessionPending, userName]);

	function reset() {
		setName("");
		setSlug("");
		setSlugTouched(false);
		create.reset();
	}

	const debouncedSlug = useDebounced(slug, CHECK_DEBOUNCE_MS);
	const formatError = slug
		? OrgSlugSchema.safeParse(slug).error?.issues[0]?.message
		: undefined;

	const availability = useQuery({
		queryKey: ["org-slug-availability", debouncedSlug],
		queryFn: () => api.orgs.slugAvailability(debouncedSlug),
		enabled: open && debouncedSlug.length > 0 && !formatError,
		staleTime: 10_000,
	});
	const result =
		availability.data?.slug === slug ? availability.data : undefined;
	const checking = Boolean(slug) && !formatError && !result;

	// Our own suggestion was taken: swap in the free alternative.
	useEffect(() => {
		if (!slugTouched && result && !result.available && result.suggestion) {
			setSlug(result.suggestion);
		}
	}, [result, slugTouched]);

	const create = useMutation({
		mutationFn: () => api.orgs.create({ name: name.trim(), slug }),
		onSuccess: (org) => {
			queryClient.setQueryData<Organization[]>(["orgs"], (orgs) => [
				...(orgs ?? []),
				org,
			]);
			queryClient.invalidateQueries({ queryKey: ["orgs"] });
			onOpenChange?.(false);
			reset();
			navigate({ to: "/$orgSlug", params: { orgSlug: org.slug } });
		},
		onError: (err) => {
			// Someone took it between the check and Save — re-check so the
			// field shows "taken" and a fresh suggestion.
			if (err instanceof LeadlyApiError && err.status === 409) {
				queryClient.invalidateQueries({
					queryKey: ["org-slug-availability", slug],
				});
			}
		},
	});

	// First sign-in with pending invites (verified email): offer to join
	// those before creating a new workspace.
	const { invitations, accept: acceptInvite, busyToken } = useMyInvitations();
	const showInvites = firstWorkspace && invitations.length > 0;

	const nameValid = name.trim().length >= 2;
	const canSave = nameValid && result?.available === true && !create.isPending;

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (firstWorkspace) return;
				onOpenChange?.(next);
				if (!next) reset();
			}}
		>
			<DialogContent
				showCloseButton={!firstWorkspace}
				onEscapeKeyDown={(e) => firstWorkspace && e.preventDefault()}
				onInteractOutside={(e) => firstWorkspace && e.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle>
						{showInvites
							? "Join or create a workspace"
							: firstWorkspace
								? "Create your workspace"
								: "New workspace"}
					</DialogTitle>
					<DialogDescription>
						{showInvites
							? "You've been invited to a workspace. Join it, or create your own."
							: "A workspace holds your agents, inbox and leads. You can rename it later."}
					</DialogDescription>
				</DialogHeader>

				{showInvites && (
					<div className="space-y-4">
						<ul className="space-y-2">
							{invitations.map((inv) => (
								<li
									key={inv.token}
									className="flex items-center gap-3 rounded-lg border border-accent-blue/30 bg-accent-blue/5 p-3"
								>
									<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-blue text-sm font-semibold text-accent-blue-foreground">
										{inv.organization.name.charAt(0).toUpperCase()}
									</div>
									<div className="min-w-0 flex-1">
										<div className="truncate text-sm font-medium">
											{inv.organization.name}
										</div>
										<div className="truncate text-xs text-muted-foreground">
											{describeInvitation(inv)}
										</div>
									</div>
									<Button
										type="button"
										size="sm"
										disabled={busyToken === inv.token}
										onClick={() => acceptInvite.mutate(inv)}
										className="bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90"
									>
										{busyToken === inv.token && acceptInvite.isPending && (
											<Loader2 className="mr-1.5 size-3.5 animate-spin" />
										)}
										Join
									</Button>
								</li>
							))}
						</ul>
						{acceptInvite.isError && (
							<p className="text-sm text-destructive">
								{apiErrorMessage(acceptInvite.error)}
							</p>
						)}
						<div className="flex items-center gap-3 text-xs text-muted-foreground">
							<span className="h-px flex-1 bg-border" />
							or create your own workspace
							<span className="h-px flex-1 bg-border" />
						</div>
					</div>
				)}

				<form
					className="space-y-5"
					onSubmit={(e) => {
						e.preventDefault();
						if (canSave) create.mutate();
					}}
				>
					<div className="space-y-1.5">
						<Label htmlFor={nameId}>Workspace name</Label>
						<Input
							id={nameId}
							value={name}
							autoFocus
							maxLength={100}
							onChange={(e) => {
								setName(e.target.value);
								if (!slugTouched) setSlug(slugify(e.target.value));
							}}
						/>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor={slugId}>Workspace URL</Label>
						<InputGroup>
							<InputGroupAddon>
								<InputGroupText>{window.location.host}/</InputGroupText>
							</InputGroupAddon>
							<InputGroupInput
								id={slugId}
								className="font-mono"
								value={slug}
								maxLength={64}
								spellCheck={false}
								autoCapitalize="off"
								onChange={(e) => {
									setSlugTouched(true);
									setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
								}}
							/>
						</InputGroup>
						<SlugStatus
							slug={slug}
							formatError={formatError}
							checking={checking}
							result={result}
							onUseSuggestion={(s) => {
								setSlugTouched(true);
								setSlug(s);
							}}
						/>
					</div>

					{create.isError &&
						!(
							create.error instanceof LeadlyApiError &&
							create.error.status === 409
						) && (
							<p className="text-sm text-destructive">
								{create.error instanceof LeadlyApiError
									? `Could not create the workspace (API ${create.error.status}).`
									: "Could not create the workspace."}
							</p>
						)}

					<DialogFooter className="items-center sm:justify-between">
						{firstWorkspace ? (
							<button
								type="button"
								className="text-xs text-muted-foreground hover:text-foreground"
								onClick={async () => {
									await authClient.signOut();
									window.location.href = "/";
								}}
							>
								Not you? Sign out
							</button>
						) : (
							<span />
						)}
						<Button
							type="submit"
							disabled={!canSave}
							className="bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90"
						>
							{create.isPending && (
								<Loader2 className="mr-2 size-4 animate-spin" />
							)}
							Create workspace
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function SlugStatus({
	slug,
	formatError,
	checking,
	result,
	onUseSuggestion,
}: {
	slug: string;
	formatError?: string;
	checking: boolean;
	result?: {
		available: boolean;
		reason: string | null;
		suggestion: string | null;
	};
	onUseSuggestion: (slug: string) => void;
}) {
	const base = "flex min-h-5 items-center gap-1.5 text-xs";
	if (!slug) {
		return (
			<p className={`${base} text-muted-foreground`}>
				Pick a URL for your workspace.
			</p>
		);
	}
	if (formatError) {
		return <p className={`${base} text-destructive`}>{formatError}</p>;
	}
	if (checking) {
		return (
			<p className={`${base} text-muted-foreground`}>
				<Loader2 className="size-3 animate-spin" />
				Checking availability…
			</p>
		);
	}
	if (result?.available) {
		return (
			<p className={`${base} text-emerald-600 dark:text-emerald-400`}>
				<Check className="size-3.5" />
				Available
			</p>
		);
	}
	const message =
		result?.reason === "reserved"
			? "That URL is reserved."
			: result?.reason === "invalid"
				? "That URL isn't valid."
				: "That URL is taken.";
	return (
		<p className={`${base} text-destructive`}>
			<X className="size-3.5" />
			{message}
			{result?.suggestion && (
				<button
					type="button"
					className="font-medium text-accent-blue hover:underline"
					onClick={() => onUseSuggestion(result.suggestion as string)}
				>
					Use {result.suggestion}
				</button>
			)}
		</p>
	);
}

function useDebounced<T>(value: T, ms: number): T {
	const [debounced, setDebounced] = useState(value);
	useEffect(() => {
		const id = setTimeout(() => setDebounced(value), ms);
		return () => clearTimeout(id);
	}, [value, ms]);
	return debounced;
}
