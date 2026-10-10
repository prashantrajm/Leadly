import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateAgentSchema, type UpdateAgent } from "@leadly/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentOrg, useOrgPath } from "@/hooks/use-current-org";
import { api, LeadlyApiError } from "@/lib/api";
import type { Agent } from "@leadly/api-client";

export const Route = createFileRoute("/$orgSlug/agents/$agentId/settings")({
	component: AgentSettingsPage,
});

function AgentSettingsPage() {
	const { agentId } = Route.useParams();

	const q = useQuery({
		queryKey: ["agent", agentId],
		queryFn: () => api.agents.get(agentId),
	});

	if (q.isLoading) {
		return (
			<div className="mx-auto max-w-3xl">
				<Skeleton className="h-10 w-48 rounded-md" />
				<Skeleton className="mt-6 h-96 rounded-xl" />
			</div>
		);
	}

	if (q.isError || !q.data) {
		const err = q.error;
		return (
			<div className="mx-auto max-w-3xl">
				<div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
					{err instanceof LeadlyApiError
						? `API ${err.status}: ${err.message}`
						: "Could not load agent."}
				</div>
			</div>
		);
	}

	return <AgentSettingsBody agent={q.data} agentId={agentId} />;
}

function AgentSettingsBody({
	agent,
	agentId,
}: {
	agent: Agent;
	agentId: string;
}) {
	return (
		<div className="mx-auto max-w-3xl">
			<header className="mb-8">
				<h1 className="text-2xl font-semibold tracking-tight">
					{agent.name} settings
				</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Tune what your agent says, how it sounds, and which model it runs
					on.
				</p>
			</header>

			<Tabs defaultValue="general">
				<TabsList>
					<TabsTrigger value="general">General</TabsTrigger>
					<TabsTrigger value="persona">Persona</TabsTrigger>
					<TabsTrigger value="model">Model</TabsTrigger>
					<TabsTrigger value="identity">Identity</TabsTrigger>
				</TabsList>

				<TabsContent value="general" className="mt-6">
					<GeneralTab agent={agent} agentId={agentId} />
				</TabsContent>

				<TabsContent value="persona" className="mt-6">
					<PersonaTab agent={agent} agentId={agentId} />
				</TabsContent>

				<TabsContent value="model" className="mt-6">
					<ModelTab agent={agent} agentId={agentId} />
				</TabsContent>

				<TabsContent value="identity" className="mt-6">
					<IdentityTab agent={agent} agentId={agentId} />
				</TabsContent>
			</Tabs>
		</div>
	);
}

function GeneralTab({ agent, agentId }: { agent: Agent; agentId: string }) {
	const queryClient = useQueryClient();

	const form = useForm<UpdateAgent>({
		resolver: zodResolver(UpdateAgentSchema),
		defaultValues: {
			name: agent.name,
			slug: agent.slug,
			greeting: agent.greeting,
			accentColor: agent.accentColor,
			fallbackMessage: agent.fallbackMessage,
		},
	});

	// Reset the form whenever the upstream agent changes (e.g. an external
	// invalidate refetched fresh data while editing).
	useEffect(() => {
		form.reset({
			name: agent.name,
			slug: agent.slug,
			greeting: agent.greeting,
			accentColor: agent.accentColor,
			fallbackMessage: agent.fallbackMessage,
		});
	}, [agent, form]);

	const mutation = useMutation({
		mutationFn: (body: UpdateAgent) => api.agents.update(agentId, body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
			queryClient.invalidateQueries({
				queryKey: ["agents", agent.organizationId],
			});
			form.reset(form.getValues());
		},
	});

	const accent = form.watch("accentColor") ?? agent.accentColor;
	const dirty = form.formState.isDirty;

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">General</CardTitle>
				<CardDescription>
					What visitors see, how the widget looks, and the agent's URL slug.
				</CardDescription>
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
											placeholder="Acme Support"
											{...field}
											value={field.value ?? ""}
										/>
									</FormControl>
									<FormDescription>
										Internal label for your inbox. Visitors don't see this.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="slug"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Slug</FormLabel>
									<FormControl>
										<Input
											placeholder="acme-support"
											className="font-mono"
											{...field}
											value={field.value ?? ""}
										/>
									</FormControl>
									<FormDescription>
										Lowercase letters, numbers, and dashes. Used in the widget
										URL — change carefully.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="greeting"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Greeting</FormLabel>
									<FormControl>
										<Textarea
											rows={3}
											placeholder="Hey! Ask me anything about Acme."
											{...field}
											value={field.value ?? ""}
										/>
									</FormControl>
									<FormDescription>
										First thing the agent says when a visitor opens the widget.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="fallbackMessage"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Fallback message</FormLabel>
									<FormControl>
										<Input
											placeholder="I'm not sure — let me get a teammate."
											{...field}
											value={field.value ?? ""}
										/>
									</FormControl>
									<FormDescription>
										What the agent says when retrieval comes up empty and no
										human is online.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="accentColor"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Accent color</FormLabel>
									<div className="flex items-center gap-3">
										<div
											className="size-10 shrink-0 rounded-md border border-border"
											style={{ backgroundColor: accent }}
											aria-label={`Preview of ${accent}`}
										/>
										<FormControl>
											<Input
												type="color"
												className="h-10 w-16 cursor-pointer p-1"
												{...field}
												value={field.value ?? "#000000"}
											/>
										</FormControl>
										<FormControl>
											<Input
												placeholder="#2A59DA"
												className="max-w-[140px] font-mono"
												{...field}
												value={field.value ?? ""}
											/>
										</FormControl>
									</div>
									<FormDescription>
										The colour visitors see on the widget bubble and outgoing
										message bubbles.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						{mutation.isError && (
							<div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
								{mutation.error instanceof LeadlyApiError
									? `API ${mutation.error.status}: ${mutation.error.bodyText.slice(0, 200) || mutation.error.message}`
									: mutation.error instanceof Error
										? mutation.error.message
										: "Save failed."}
							</div>
						)}

						<div className="flex justify-end border-t border-border/60 pt-5">
							<Button
								type="submit"
								disabled={!dirty || mutation.isPending}
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
// Persona — system prompt overlay + max turns
// ---------------------------------------------------------------------------

function PersonaTab({ agent, agentId }: { agent: Agent; agentId: string }) {
	const queryClient = useQueryClient();

	const form = useForm<UpdateAgent>({
		resolver: zodResolver(UpdateAgentSchema),
		defaultValues: {
			systemPromptOverlay: agent.systemPromptOverlay ?? "",
			maxTurns: agent.maxTurns,
		},
	});

	useEffect(() => {
		form.reset({
			systemPromptOverlay: agent.systemPromptOverlay ?? "",
			maxTurns: agent.maxTurns,
		});
	}, [agent, form]);

	const mutation = useMutation({
		mutationFn: (body: UpdateAgent) => api.agents.update(agentId, body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
			form.reset(form.getValues());
		},
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Persona</CardTitle>
				<CardDescription>
					What the agent sounds like and how long it'll keep talking.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
						className="space-y-5"
					>
						<FormField
							control={form.control}
							name="systemPromptOverlay"
							render={({ field }) => (
								<FormItem>
									<FormLabel>System prompt overlay</FormLabel>
									<FormControl>
										<Textarea
											rows={8}
											placeholder="Be terse. Cite the source article inline. Don't apologize. If you don't know, say 'I'm not sure — let me get a teammate.'"
											className="font-mono text-xs"
											{...field}
											value={field.value ?? ""}
										/>
									</FormControl>
									<FormDescription>
										Appended to the base system prompt on every turn. Empty
										falls back to the library default.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="maxTurns"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Max turns</FormLabel>
									<FormControl>
										<Input
											type="number"
											min={1}
											max={500}
											className="max-w-[140px]"
											{...field}
											value={field.value ?? ""}
											onChange={(e) =>
												field.onChange(
													e.target.value ? Number(e.target.value) : undefined,
												)
											}
										/>
									</FormControl>
									<FormDescription>
										Hard limit before the agent ends the conversation.
										Defaults around 40 — bump up for long support flows.
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						{mutation.isError && <ErrorRow err={mutation.error} />}

						<div className="flex justify-end border-t border-border/60 pt-5">
							<SaveButton
								pending={mutation.isPending}
								disabled={!form.formState.isDirty}
							/>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Model — provider + model + BYOK override
// ---------------------------------------------------------------------------

const PROVIDER_OPTIONS = [
	{ value: "openai", label: "OpenAI" },
	{ value: "anthropic", label: "Anthropic" },
	{ value: "google", label: "Google" },
	{ value: "mistral", label: "Mistral" },
	{ value: "groq", label: "Groq" },
	{ value: "openrouter", label: "OpenRouter" },
	{ value: "other", label: "Other" },
] as const;

function ModelTab({ agent, agentId }: { agent: Agent; agentId: string }) {
	const orgPath = useOrgPath();
	const queryClient = useQueryClient();
	const { currentOrg } = useCurrentOrg();
	const orgId = currentOrg?.id;

	const form = useForm<UpdateAgent>({
		resolver: zodResolver(UpdateAgentSchema),
		defaultValues: {
			defaultProvider: agent.defaultProvider,
			defaultModel: agent.defaultModel,
		},
	});

	useEffect(() => {
		form.reset({
			defaultProvider: agent.defaultProvider,
			defaultModel: agent.defaultModel,
		});
	}, [agent, form]);

	const mutation = useMutation({
		mutationFn: (body: UpdateAgent) => api.agents.update(agentId, body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
			form.reset(form.getValues());
		},
	});

	const credentialsQuery = useQuery({
		queryKey: ["byok", orgId],
		queryFn: () => (orgId ? api.byok.list(orgId) : Promise.resolve([])),
		enabled: Boolean(orgId),
	});

	const [selectedCredentialId, setSelectedCredentialId] = useState<string>("");

	const setOverrideMutation = useMutation({
		mutationFn: () =>
			api.byok.setAgentOverride(agentId, {
				credentialId: selectedCredentialId,
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
		},
	});

	const clearOverrideMutation = useMutation({
		mutationFn: () => api.byok.clearAgentOverride(agentId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
		},
	});

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Default model</CardTitle>
					<CardDescription>
						Provider + model id used for every turn unless overridden below.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
							className="space-y-5"
						>
							<FormField
								control={form.control}
								name="defaultProvider"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Provider</FormLabel>
										<Select
											value={field.value ?? agent.defaultProvider}
											onValueChange={field.onChange}
										>
											<FormControl>
												<SelectTrigger className="max-w-xs">
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
								name="defaultModel"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Model id</FormLabel>
										<FormControl>
											<Input
												className="font-mono"
												placeholder="tencent/hy3-preview:free"
												{...field}
												value={field.value ?? ""}
											/>
										</FormControl>
										<FormDescription>
											Provider-specific model id. For OpenRouter use the
											full id (org/model:variant).
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>

							{mutation.isError && <ErrorRow err={mutation.error} />}

							<div className="flex justify-end border-t border-border/60 pt-5">
								<SaveButton
									pending={mutation.isPending}
									disabled={!form.formState.isDirty}
								/>
							</div>
						</form>
					</Form>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">BYOK override</CardTitle>
					<CardDescription>
						Run this agent on a specific bring-your-own-key credential
						instead of the org default. Add credentials in{" "}
						<Link
							to={orgPath("/settings")}
							className="font-medium text-accent-blue underline-offset-4 hover:underline"
						>
							Org settings → API keys
						</Link>
						.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{credentialsQuery.isLoading ? (
						<Skeleton className="h-10 w-full max-w-sm rounded-md" />
					) : !credentialsQuery.data ||
					  credentialsQuery.data.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No credentials in this org yet.
						</p>
					) : (
						<>
							<div className="space-y-1.5">
								<Label className="text-xs">Use credential</Label>
								<Select
									value={selectedCredentialId}
									onValueChange={setSelectedCredentialId}
								>
									<SelectTrigger className="max-w-sm">
										<SelectValue placeholder="Pick a credential…" />
									</SelectTrigger>
									<SelectContent>
										{credentialsQuery.data.map((c) => (
											<SelectItem key={c.id} value={c.id}>
												{c.label} ·{" "}
												<span className="font-mono text-xs">
													{c.provider}
												</span>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{(setOverrideMutation.isError ||
								clearOverrideMutation.isError) && (
								<ErrorRow
									err={
										setOverrideMutation.error ?? clearOverrideMutation.error
									}
								/>
							)}

							<div className="flex flex-wrap gap-2">
								<Button
									onClick={() => setOverrideMutation.mutate()}
									disabled={
										!selectedCredentialId || setOverrideMutation.isPending
									}
									className="bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90"
								>
									{setOverrideMutation.isPending && (
										<Loader2 className="mr-2 size-4 animate-spin" />
									)}
									Set override
								</Button>
								<Button
									variant="outline"
									onClick={() => clearOverrideMutation.mutate()}
									disabled={clearOverrideMutation.isPending}
								>
									{clearOverrideMutation.isPending && (
										<Loader2 className="mr-2 size-4 animate-spin" />
									)}
									Clear override
								</Button>
							</div>
						</>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Identity — visitor identification policy
// ---------------------------------------------------------------------------

const IDENTITY_OPTIONS = [
	{
		value: "optional" as const,
		label: "Optional",
		description:
			"Anyone can chat. The agent will ask for contact info naturally if it needs to follow up.",
	},
	{
		value: "required_before_chat" as const,
		label: "Required before chat",
		description:
			"Visitor must enter name + email before the widget opens. Higher capture rate, more friction.",
	},
	{
		value: "identified_only" as const,
		label: "Identified only",
		description:
			"Widget only renders for users your site has already identified via the JS API. For logged-in apps.",
	},
];

function IdentityTab({ agent, agentId }: { agent: Agent; agentId: string }) {
	const queryClient = useQueryClient();

	const form = useForm<UpdateAgent>({
		resolver: zodResolver(UpdateAgentSchema),
		defaultValues: {
			identityPolicy: agent.identityPolicy,
		},
	});

	useEffect(() => {
		form.reset({ identityPolicy: agent.identityPolicy });
	}, [agent, form]);

	const mutation = useMutation({
		mutationFn: (body: UpdateAgent) => api.agents.update(agentId, body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
			form.reset(form.getValues());
		},
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Identity policy</CardTitle>
				<CardDescription>
					When the widget asks visitors to identify themselves.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
						className="space-y-5"
					>
						<FormField
							control={form.control}
							name="identityPolicy"
							render={({ field }) => (
								<FormItem>
									<FormControl>
										<RadioGroup
											value={field.value ?? agent.identityPolicy}
											onValueChange={field.onChange}
											className="space-y-2"
										>
											{IDENTITY_OPTIONS.map((opt) => (
												<label
													key={opt.value}
													htmlFor={`policy-${opt.value}`}
													className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-accent-blue/30"
												>
													<RadioGroupItem
														value={opt.value}
														id={`policy-${opt.value}`}
														className="mt-0.5"
													/>
													<div className="min-w-0 flex-1">
														<div className="text-sm font-medium tracking-tight">
															{opt.label}
														</div>
														<p className="mt-1 text-xs text-muted-foreground">
															{opt.description}
														</p>
													</div>
												</label>
											))}
										</RadioGroup>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						{mutation.isError && <ErrorRow err={mutation.error} />}

						<div className="flex justify-end border-t border-border/60 pt-5">
							<SaveButton
								pending={mutation.isPending}
								disabled={!form.formState.isDirty}
							/>
						</div>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function SaveButton({
	pending,
	disabled,
}: {
	pending: boolean;
	disabled?: boolean;
}) {
	return (
		<Button
			type="submit"
			disabled={disabled || pending}
			className="bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90"
		>
			{pending ? (
				<Loader2 className="mr-2 size-4 animate-spin" />
			) : (
				<Save className="mr-2 size-4" />
			)}
			Save changes
		</Button>
	);
}

function ErrorRow({ err }: { err: unknown }) {
	return (
		<div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
			{err instanceof LeadlyApiError
				? `API ${err.status}: ${err.bodyText.slice(0, 200) || err.message}`
				: err instanceof Error
					? err.message
					: "Save failed."}
		</div>
	);
}
