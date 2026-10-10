import { zodResolver } from "@hookform/resolvers/zod";
import {
	CreateLlmCredentialSchema,
	UpdateOrganizationSchema,
	type CreateLlmCredential,
	type Organization,
	type UpdateOrganization,
} from "@leadly/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import {
	EyeIcon,
	EyeOffIcon,
	KeyIcon,
	PlusIcon,
	SaveIcon,
	SpinnerIcon,
	TrashIcon,
} from "@/components/icons";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
	Page,
	PageContent,
	PageSection,
	PageSectionActions,
	PageSectionDescription,
	PageSectionHeader,
	PageSectionTitle,
	PageToolbar,
} from "@/components/ui/page";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	SettingsCard,
	SettingsCardFooter,
	SettingsRow,
	SettingsRowControl,
	SettingsRowDescription,
	SettingsRowLabel,
	SettingsRowTitle,
} from "@/components/ui/settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DeleteWorkspaceCard } from "@/components/dashboard/delete-workspace-card";
import { MembersSettings } from "@/components/dashboard/members-settings";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { api, LeadlyApiError } from "@/lib/api";
import { useSession } from "@/lib/auth-client";

export const Route = createFileRoute("/$orgSlug/settings/")({
	component: OrgSettings,
});

function OrgSettings() {
	const { currentOrg, isLoading } = useCurrentOrg();

	if (isLoading) {
		return (
			<Page>
				<PageContent width="narrow">
					<Skeleton className="h-72 rounded-xl" />
				</PageContent>
			</Page>
		);
	}

	if (!currentOrg) {
		return (
			<Page>
				<PageContent width="narrow">
					<p className="text-sm text-muted-foreground">No organization.</p>
				</PageContent>
			</Page>
		);
	}

	return (
		<Page>
			<Tabs defaultValue="general" className="flex-1 gap-0">
				<PageToolbar>
					<TabsList>
						<TabsTrigger value="general">General</TabsTrigger>
						<TabsTrigger value="members">Members</TabsTrigger>
						<TabsTrigger value="api-keys">API keys</TabsTrigger>
					</TabsList>
				</PageToolbar>

				<PageContent width="narrow">
					<TabsContent value="general">
						<GeneralTab orgId={currentOrg.id} />
						<OwnerDangerZone org={currentOrg} />
					</TabsContent>
					<TabsContent value="members">
						<MembersSettings orgId={currentOrg.id} />
					</TabsContent>
					<TabsContent value="api-keys">
						<ApiKeysTab orgId={currentOrg.id} />
					</TabsContent>
				</PageContent>
			</Tabs>
		</Page>
	);
}

// Only owners can delete the workspace (the API enforces it too).
function OwnerDangerZone({ org }: { org: Organization }) {
	const { data: session } = useSession();
	const q = useQuery({
		queryKey: ["org", org.id],
		queryFn: () => api.orgs.get(org.id),
	});
	const isOwner =
		q.data?.memberships.find((m) => m.userId === session?.user?.id)?.role ===
		"owner";
	return isOwner ? <DeleteWorkspaceCard org={org} /> : null;
}

// ---------------------------------------------------------------------------
// General — name + slug
// ---------------------------------------------------------------------------

function GeneralTab({ orgId }: { orgId: string }) {
	const queryClient = useQueryClient();
	const { orgSlug } = Route.useParams();
	const navigate = useNavigate();
	const q = useQuery({
		queryKey: ["org", orgId],
		queryFn: () => api.orgs.get(orgId),
	});

	const form = useForm<UpdateOrganization>({
		resolver: zodResolver(UpdateOrganizationSchema),
		defaultValues: { name: "", slug: "" },
	});

	useEffect(() => {
		if (q.data) form.reset({ name: q.data.name, slug: q.data.slug });
	}, [q.data, form]);

	const mutation = useMutation({
		mutationFn: (body: UpdateOrganization) => api.orgs.update(orgId, body),
		onSuccess: (updated) => {
			// The slug is the workspace URL. Patch the cached org list first so
			// the layout recognises the new slug, then move to it.
			queryClient.setQueryData<Organization[]>(["orgs"], (orgs) =>
				orgs?.map((o) => (o.id === updated.id ? updated : o)),
			);
			queryClient.invalidateQueries({ queryKey: ["org", orgId] });
			queryClient.invalidateQueries({ queryKey: ["orgs"] });
			form.reset(form.getValues());
			if (updated.slug !== orgSlug) {
				navigate({
					to: "/$orgSlug/settings",
					params: { orgSlug: updated.slug },
					replace: true,
				});
			}
		},
	});

	if (q.isLoading) return <Skeleton className="h-72 rounded-xl" />;
	if (q.isError || !q.data) return <ErrorRow err={q.error} />;

	return (
		<PageSection variant="grouped">
			<PageSectionHeader>
				<PageSectionTitle>General</PageSectionTitle>
				<PageSectionDescription>
					How the workspace appears in the dashboard.
				</PageSectionDescription>
			</PageSectionHeader>
			<Form {...form}>
				<form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
					<SettingsCard>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem asChild>
									<SettingsRow>
										<SettingsRowLabel>
											<SettingsRowTitle asChild>
												<FormLabel>Name</FormLabel>
											</SettingsRowTitle>
											<SettingsRowDescription>
												Shown in the sidebar and on invitations.
											</SettingsRowDescription>
										</SettingsRowLabel>
										<SettingsRowControl>
											<FormControl>
												<Input
													placeholder="Acme, Inc."
													{...field}
													value={field.value ?? ""}
												/>
											</FormControl>
											<FormMessage />
										</SettingsRowControl>
									</SettingsRow>
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="slug"
							render={({ field }) => (
								<FormItem asChild>
									<SettingsRow>
										<SettingsRowLabel>
											<SettingsRowTitle asChild>
												<FormLabel>Workspace URL</FormLabel>
											</SettingsRowTitle>
											<SettingsRowDescription asChild>
												<FormDescription>
													Your dashboard lives at /{field.value || "…"}.
													Lowercase letters, numbers, and dashes. Changing it
													breaks links to the old URL.
												</FormDescription>
											</SettingsRowDescription>
										</SettingsRowLabel>
										<SettingsRowControl>
											<FormControl>
												<Input
													className="font-mono"
													placeholder="acme"
													{...field}
													value={field.value ?? ""}
												/>
											</FormControl>
											<FormMessage />
										</SettingsRowControl>
									</SettingsRow>
								</FormItem>
							)}
						/>
						<SettingsCardFooter>
							{mutation.isError && (
								<div className="mr-auto">
									<ErrorRow err={mutation.error} />
								</div>
							)}
							<Button
								variant="accent"
								type="submit"
								size="sm"
								disabled={!form.formState.isDirty || mutation.isPending}
							>
								{mutation.isPending ? (
									<SpinnerIcon className="animate-spin" />
								) : (
									<SaveIcon />
								)}
								Save changes
							</Button>
						</SettingsCardFooter>
					</SettingsCard>
				</form>
			</Form>
		</PageSection>
	);
}

// ---------------------------------------------------------------------------
// API keys (BYOK)
// ---------------------------------------------------------------------------

function ApiKeysTab({ orgId }: { orgId: string }) {
	const queryClient = useQueryClient();
	const q = useQuery({
		queryKey: ["byok", orgId],
		queryFn: () => api.byok.list(orgId),
	});

	const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
	const deleteMutation = useMutation({
		mutationFn: (id: string) => api.byok.delete(orgId, id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["byok", orgId] });
			setConfirmDelete(null);
		},
	});

	return (
		<PageSection variant="grouped">
			<PageSectionHeader>
				<PageSectionTitle>API keys</PageSectionTitle>
				<PageSectionDescription>
					Bring your own LLM credentials. Plaintext is encrypted at rest and
					never echoed back.
				</PageSectionDescription>
				<PageSectionActions>
					<AddCredentialDialog orgId={orgId} />
				</PageSectionActions>
			</PageSectionHeader>
			{q.isLoading ? (
				<Skeleton className="h-28 rounded-xl" />
			) : q.isError ? (
				<ErrorRow err={q.error} />
			) : !q.data || q.data.length === 0 ? (
				<SettingsCard>
					<Empty className="p-6 md:p-8">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<KeyIcon />
							</EmptyMedia>
							<EmptyTitle className="text-sm">No credentials yet</EmptyTitle>
							<EmptyDescription>
								Without a key, agents fall back to the platform default. Add a
								credential to use your own model billing.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				</SettingsCard>
			) : (
				<SettingsCard>
					{q.data.map((c) => (
						<SettingsRow key={c.id} className="flex-row items-center">
							<SettingsRowLabel>
								<SettingsRowTitle className="flex min-w-0 items-center gap-2">
									<span className="truncate">{c.label}</span>
									{c.isDefault && <Badge variant="outline">Default</Badge>}
								</SettingsRowTitle>
								<SettingsRowDescription className="font-mono text-xs">
									{c.provider} · ••••{c.maskedSuffix} ·{" "}
									{format(new Date(c.createdAt), "MMM d, y")}
								</SettingsRowDescription>
							</SettingsRowLabel>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={() => setConfirmDelete(c.id)}
								className="text-muted-foreground hover:text-destructive"
							>
								<TrashIcon className="size-4" />
								<span className="sr-only">Delete</span>
							</Button>
						</SettingsRow>
					))}
				</SettingsCard>
			)}

			<AlertDialog
				open={Boolean(confirmDelete)}
				onOpenChange={(o) => !o && setConfirmDelete(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this credential?</AlertDialogTitle>
						<AlertDialogDescription>
							Any agent overriding to this credential will fall back to the
							org default. The plaintext key is gone — you'll need to
							re-paste to add it back.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleteMutation.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={(e) => {
								e.preventDefault();
								if (confirmDelete) deleteMutation.mutate(confirmDelete);
							}}
							disabled={deleteMutation.isPending}
							className="bg-destructive text-white hover:bg-destructive/90"
						>
							{deleteMutation.isPending && (
								<SpinnerIcon className="mr-2 size-4 animate-spin" />
							)}
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</PageSection>
	);
}

const PROVIDER_OPTIONS = [
	{ value: "openai", label: "OpenAI" },
	{ value: "anthropic", label: "Anthropic" },
	{ value: "google", label: "Google" },
	{ value: "mistral", label: "Mistral" },
	{ value: "groq", label: "Groq" },
	{ value: "openrouter", label: "OpenRouter" },
	{ value: "other", label: "Other" },
] as const;

function AddCredentialDialog({ orgId }: { orgId: string }) {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [showKey, setShowKey] = useState(false);

	const form = useForm<CreateLlmCredential>({
		resolver: zodResolver(CreateLlmCredentialSchema),
		defaultValues: {
			provider: "openai",
			label: "",
			apiKey: "",
			isDefault: false,
		},
	});

	const mutation = useMutation({
		mutationFn: (body: CreateLlmCredential) => api.byok.create(orgId, body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["byok", orgId] });
			form.reset();
			setShowKey(false);
			setOpen(false);
		},
	});

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => {
				setOpen(o);
				if (!o) {
					form.reset();
					mutation.reset();
					setShowKey(false);
				}
			}}
		>
			<DialogTrigger asChild>
				<Button variant="accent" size="sm">
					<PlusIcon />
					Add credential
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add an LLM credential</DialogTitle>
					<DialogDescription>
						Plaintext is encrypted at rest. We never log it, and only the
						last four characters are shown after save.
					</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
						className="space-y-4"
					>
						<FormField
							control={form.control}
							name="label"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Label</FormLabel>
									<FormControl>
										<Input
											placeholder="Personal OpenAI"
											autoFocus
											{...field}
										/>
									</FormControl>
									<FormDescription>
										For your reference. Visible to org admins only.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="provider"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Provider</FormLabel>
									<Select
										value={field.value ?? "openai"}
										onValueChange={field.onChange}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{PROVIDER_OPTIONS.map((p) => (
												<SelectItem key={p.value} value={p.value}>
													{p.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="apiKey"
							render={({ field }) => (
								<FormItem>
									<FormLabel>API key</FormLabel>
									<div className="relative">
										<FormControl>
											<Input
												type={showKey ? "text" : "password"}
												className="pr-9 font-mono"
												placeholder="sk-… or sk-ant-…"
												{...field}
											/>
										</FormControl>
										<button
											type="button"
											onClick={() => setShowKey((s) => !s)}
											className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
										>
											{showKey ? (
												<EyeOffIcon className="size-4" />
											) : (
												<EyeIcon className="size-4" />
											)}
										</button>
									</div>
									<FormMessage />
								</FormItem>
							)}
						/>
						{mutation.isError && <ErrorRow err={mutation.error} />}
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setOpen(false)}
								disabled={mutation.isPending}
							>
								Cancel
							</Button>
							<Button variant="accent" type="submit" disabled={mutation.isPending}>
								{mutation.isPending && (
									<SpinnerIcon className="mr-2 size-4 animate-spin" />
								)}
								Save credential
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}

// ---------------------------------------------------------------------------

function ErrorRow({ err }: { err: unknown }) {
	return (
		<p className="text-sm text-destructive">
			{err instanceof LeadlyApiError
				? `API ${err.status}: ${err.bodyText.slice(0, 200) || err.message}`
				: err instanceof Error
					? err.message
					: "Action failed."}
		</p>
	);
}
