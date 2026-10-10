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
import { Eye, EyeOff, KeyRound, Loader2, Plus, Save, Trash2 } from "lucide-react";
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
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
			<div className="mx-auto max-w-3xl">
				<Skeleton className="h-10 w-48 rounded-md" />
				<Skeleton className="mt-6 h-72 rounded-xl" />
			</div>
		);
	}

	if (!currentOrg) {
		return (
			<div className="mx-auto max-w-3xl">
				<p className="text-sm text-muted-foreground">No organization.</p>
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-3xl">
			<Tabs defaultValue="general">
				<TabsList>
					<TabsTrigger value="general">General</TabsTrigger>
					<TabsTrigger value="members">Members</TabsTrigger>
					<TabsTrigger value="api-keys">API keys</TabsTrigger>
				</TabsList>

				<TabsContent value="general" className="mt-6 space-y-6">
					<GeneralTab orgId={currentOrg.id} />
					<OwnerDangerZone org={currentOrg} />
				</TabsContent>
				<TabsContent value="members" className="mt-6">
					<MembersSettings orgId={currentOrg.id} />
				</TabsContent>
				<TabsContent value="api-keys" className="mt-6">
					<ApiKeysTab orgId={currentOrg.id} />
				</TabsContent>
			</Tabs>
		</div>
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
		<Card>
			<CardHeader>
				<CardTitle className="text-base">General</CardTitle>
				<CardDescription>How the org appears in the dashboard.</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
						className="space-y-5"
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input
											placeholder="Acme, Inc."
											{...field}
											value={field.value ?? ""}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="slug"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Workspace URL</FormLabel>
									<FormControl>
										<Input
											className="font-mono"
											placeholder="acme"
											{...field}
											value={field.value ?? ""}
										/>
									</FormControl>
									<FormDescription>
										Your dashboard lives at /{field.value || "…"}. Lowercase
										letters, numbers, and dashes. Changing it breaks links to
										the old URL.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
						{mutation.isError && <ErrorRow err={mutation.error} />}
						<div className="flex justify-end border-t border-border/60 pt-5">
							<Button
								type="submit"
								disabled={!form.formState.isDirty || mutation.isPending}
								className="bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90"
							>
								{mutation.isPending ? (
									<Loader2 className="mr-2 size-4 animate-spin" />
								) : (
									<Save className="mr-2 size-4" />
								)}
								Save changes
							</Button>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
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
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-base font-semibold tracking-tight">
						API keys
					</h2>
					<p className="text-sm text-muted-foreground">
						Bring your own LLM credentials. Plaintext is encrypted at rest
						and never echoed back.
					</p>
				</div>
				<AddCredentialDialog orgId={orgId} />
			</div>

			{q.isLoading ? (
				<Skeleton className="h-40 rounded-xl" />
			) : q.isError ? (
				<ErrorRow err={q.error} />
			) : !q.data || q.data.length === 0 ? (
				<Card>
					<CardContent className="py-12 text-center">
						<div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-accent-blue/10 text-accent-blue">
							<KeyRound className="size-5" />
						</div>
						<h3 className="text-base font-semibold tracking-tight">
							No credentials yet.
						</h3>
						<p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground">
							Without a key, agents fall back to the platform default. Add
							a credential to use your own model billing.
						</p>
					</CardContent>
				</Card>
			) : (
				<Card>
					<CardContent className="p-0">
						<ul className="divide-y divide-border/60">
							{q.data.map((c) => (
								<li
									key={c.id}
									className="flex items-center gap-3 px-4 py-3"
								>
									<div className="flex size-9 items-center justify-center rounded-lg border border-border bg-secondary/40">
										<KeyRound className="size-4 text-muted-foreground" />
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<span className="truncate text-sm font-medium">
												{c.label}
											</span>
											{c.isDefault && (
												<span className="rounded-full bg-accent-blue/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-accent-blue">
													Default
												</span>
											)}
										</div>
										<div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
											<span className="font-mono">{c.provider}</span>
											<span className="size-1 rounded-full bg-muted-foreground/40" />
											<span className="font-mono">
												••••{c.maskedSuffix}
											</span>
											<span className="size-1 rounded-full bg-muted-foreground/40" />
											<span>{format(new Date(c.createdAt), "MMM d, y")}</span>
										</div>
									</div>
									<Button
										variant="ghost"
										size="icon-sm"
										onClick={() => setConfirmDelete(c.id)}
										className="text-muted-foreground hover:text-destructive"
									>
										<Trash2 className="size-4" />
										<span className="sr-only">Delete</span>
									</Button>
								</li>
							))}
						</ul>
					</CardContent>
				</Card>
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
								<Loader2 className="mr-2 size-4 animate-spin" />
							)}
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
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
				<Button className="bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90">
					<Plus className="mr-1 size-4" />
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
												<EyeOff className="size-4" />
											) : (
												<Eye className="size-4" />
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
							<Button
								type="submit"
								disabled={mutation.isPending}
								className="bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90"
							>
								{mutation.isPending && (
									<Loader2 className="mr-2 size-4 animate-spin" />
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
		<div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
			{err instanceof LeadlyApiError
				? `API ${err.status}: ${err.bodyText.slice(0, 200) || err.message}`
				: err instanceof Error
					? err.message
					: "Action failed."}
		</div>
	);
}
