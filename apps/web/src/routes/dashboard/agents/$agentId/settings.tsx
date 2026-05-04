import { zodResolver } from "@hookform/resolvers/zod";
import { UpdateAgentSchema, type UpdateAgent } from "@leadly/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Save } from "lucide-react";
import { useEffect } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, LeadlyApiError } from "@/lib/api";
import type { Agent } from "@leadly/api-client";

export const Route = createFileRoute("/dashboard/agents/$agentId/settings")({
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
					<StubTab
						title="Persona"
						description="System prompt overlay, fallback message, max turns. Lands in a later phase."
					/>
				</TabsContent>

				<TabsContent value="model" className="mt-6">
					<StubTab
						title="Model"
						description="Provider, default model, BYOK override. Lands in a later phase."
					/>
				</TabsContent>

				<TabsContent value="identity" className="mt-6">
					<StubTab
						title="Identity"
						description="Anonymous / optional / required visitor identification policy. Lands in a later phase."
					/>
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

function StubTab({
	title,
	description,
}: {
	title: string;
	description: string;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
		</Card>
	);
}
