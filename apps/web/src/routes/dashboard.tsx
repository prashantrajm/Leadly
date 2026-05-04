// Representative dashboard page that proves the Phase 13 wiring end-to-end:
//
//   • TanStack Query reads via the typed @leadly/api-client (no axios)
//   • react-hook-form + zodResolver against the same CreateAgentSchema
//     the API uses for validation — no duplicated rules
//   • TanStack Query mutation invalidates the list on success
//
// The full dashboard migration is a v1.5 chore; this file is the
// pattern other pages copy.

import { zodResolver } from "@hookform/resolvers/zod";
import { CreateAgentSchema, type CreateAgent } from "@leadly/schemas";
import { createFileRoute } from "@tanstack/react-router";
import {
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { api, LeadlyApiError } from "@/lib/api";

export const Route = createFileRoute("/dashboard")({
	component: DashboardPage,
});

function DashboardPage() {
	// Pick the caller's first org. The Phase 3 hook auto-creates a personal
	// Organization on first sign-up, so a logged-in user always has at
	// least one. Multi-org switching is a v1.5 concern.
	const orgsQuery = useQuery({
		queryKey: ["orgs"],
		queryFn: () => api.orgs.list(),
	});

	const orgId = orgsQuery.data?.[0]?.id ?? null;

	return (
		<div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
			<header>
				<h1 className="text-2xl font-semibold">Dashboard</h1>
				<p className="text-sm text-muted-foreground">
					Phase 13 sample — typed API client + zodResolver form.
				</p>
			</header>

			{orgsQuery.isLoading ? (
				<Loading label="Loading orgs…" />
			) : orgsQuery.isError ? (
				<ErrorBanner err={orgsQuery.error} />
			) : !orgId ? (
				<p>No organization yet — sign up to create one.</p>
			) : (
				<>
					<section className="flex flex-col gap-3">
						<h2 className="text-lg font-medium">Agents</h2>
						<AgentList orgId={orgId} />
					</section>
					<section className="flex flex-col gap-3 border-t pt-4">
						<h2 className="text-lg font-medium">Create agent</h2>
						<CreateAgentForm orgId={orgId} />
					</section>
				</>
			)}
		</div>
	);
}

function AgentList({ orgId }: { orgId: string }) {
	const q = useQuery({
		queryKey: ["agents", orgId],
		queryFn: () => api.agents.list(orgId),
	});

	if (q.isLoading) return <Loading label="Loading agents…" />;
	if (q.isError) return <ErrorBanner err={q.error} />;
	if (!q.data || q.data.length === 0) {
		return <p className="text-sm text-muted-foreground">No agents yet.</p>;
	}

	return (
		<ul className="flex flex-col gap-2">
			{q.data.map((a) => (
				<li
					key={a.id}
					className="flex items-center justify-between rounded-md border p-3"
				>
					<div>
						<div className="font-medium">{a.name}</div>
						<div className="text-xs text-muted-foreground">
							{a.slug} · {a.defaultModel}
						</div>
					</div>
					<div
						className="h-4 w-4 rounded-full border"
						style={{ backgroundColor: a.accentColor }}
						aria-label={`Accent ${a.accentColor}`}
					/>
				</li>
			))}
		</ul>
	);
}

function CreateAgentForm({ orgId }: { orgId: string }) {
	const queryClient = useQueryClient();

	const form = useForm<CreateAgent>({
		resolver: zodResolver(CreateAgentSchema),
		defaultValues: { name: "" },
	});

	const mutation = useMutation({
		mutationFn: (body: CreateAgent) => api.agents.create(orgId, body),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["agents", orgId] });
			form.reset();
		},
	});

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
				className="flex flex-col gap-3"
			>
				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Name</FormLabel>
							<FormControl>
								<Input placeholder="Acme Support" {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button type="submit" disabled={mutation.isPending}>
					{mutation.isPending ? (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							Creating…
						</>
					) : (
						"Create agent"
					)}
				</Button>
				{mutation.isError ? (
					<ErrorBanner err={mutation.error} />
				) : null}
			</form>
		</Form>
	);
}

function Loading({ label }: { label: string }) {
	return (
		<div className="flex items-center gap-2 text-sm text-muted-foreground">
			<Loader2 className="h-4 w-4 animate-spin" />
			{label}
		</div>
	);
}

function ErrorBanner({ err }: { err: unknown }) {
	const message =
		err instanceof LeadlyApiError
			? `API ${err.status}: ${err.bodyText.slice(0, 200) || err.message}`
			: err instanceof Error
				? err.message
				: "Unknown error";
	return (
		<div className="rounded-md border border-red-500/50 bg-red-500/5 p-3 text-sm text-red-700">
			{message}
		</div>
	);
}
