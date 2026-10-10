import { zodResolver } from "@hookform/resolvers/zod";
import { CreateAgentSchema, type CreateAgent } from "@leadly/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowRight,
	Bot,
	Loader2,
	MoreHorizontal,
	Plus,
	Trash2,
} from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrg, useOrgPath } from "@/hooks/use-current-org";
import { api, LeadlyApiError } from "@/lib/api";
import type { Agent } from "@leadly/api-client";

export const Route = createFileRoute("/$orgSlug/agents/")({
	// ?new=true opens the create dialog — the sidebar's "New agent" links here.
	validateSearch: (search: Record<string, unknown>): { new?: boolean } =>
		search.new === true || search.new === "true" ? { new: true } : {},
	component: AgentsList,
});

function AgentsList() {
	const { currentOrg, isLoading: orgLoading } = useCurrentOrg();

	if (orgLoading) {
		return (
			<div className="mx-auto max-w-6xl">
				<Header />
				<Skeleton className="mt-6 h-32 w-full rounded-xl" />
			</div>
		);
	}

	if (!currentOrg) {
		return (
			<div className="mx-auto max-w-6xl">
				<Header />
				<p className="mt-6 text-sm text-muted-foreground">No organization.</p>
			</div>
		);
	}

	return <AgentsListBody orgId={currentOrg.id} />;
}

function Header({ children }: { children?: React.ReactNode }) {
	return (
		<div className="mb-5 flex min-h-9 items-center justify-end">
			{children}
		</div>
	);
}

function AgentsListBody({ orgId }: { orgId: string }) {
	const q = useQuery({
		queryKey: ["agents", orgId],
		queryFn: () => api.agents.list(orgId),
	});

	return (
		<div className="mx-auto max-w-6xl">
			<Header>
				<CreateAgentDialog orgId={orgId} openFromSearch />
			</Header>

			{q.isLoading ? (
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{[0, 1, 2].map((i) => (
						<Skeleton key={i} className="h-36 rounded-xl" />
					))}
				</div>
			) : q.isError ? (
				<ErrorBanner err={q.error} />
			) : !q.data || q.data.length === 0 ? (
				<EmptyState orgId={orgId} />
			) : (
				<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					{q.data.map((a) => (
						<AgentCard key={a.id} agent={a} orgId={orgId} />
					))}
				</div>
			)}
		</div>
	);
}

function EmptyState({ orgId }: { orgId: string }) {
	return (
		<div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
			<div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-accent-blue/10 text-accent-blue">
				<Bot className="size-6" />
			</div>
			<h2 className="text-lg font-semibold tracking-tight">
				Create your first agent.
			</h2>
			<p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
				An agent has its own greeting, persona, and knowledge base. You can
				make as many as you want — one per site, one per language, whatever
				fits.
			</p>
			<div className="mt-6">
				<CreateAgentDialog orgId={orgId} />
			</div>
		</div>
	);
}

function AgentCard({ agent, orgId }: { agent: Agent; orgId: string }) {
	const orgPath = useOrgPath();
	const queryClient = useQueryClient();
	const [confirmOpen, setConfirmOpen] = useState(false);

	const deleteMutation = useMutation({
		mutationFn: () => api.agents.delete(agent.id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["agents", orgId] });
			setConfirmOpen(false);
		},
	});

	return (
		<Card className="group relative overflow-hidden transition-colors hover:border-accent-blue/30">
			<CardContent className="p-5">
				<div className="flex items-start justify-between gap-3">
					<Link
						to={orgPath(`/agents/${agent.id}`) as string}
						className="min-w-0 flex-1"
					>
						<div className="flex items-center gap-2">
							<span
								className="size-2.5 shrink-0 rounded-full"
								style={{ backgroundColor: agent.accentColor }}
							/>
							<h3 className="truncate text-base font-semibold tracking-tight">
								{agent.name}
							</h3>
						</div>
						<div className="mt-1 truncate font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
							{agent.slug}
						</div>
					</Link>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon-sm"
								className="text-muted-foreground hover:text-foreground"
							>
								<MoreHorizontal className="size-4" />
								<span className="sr-only">Agent actions</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-44">
							<DropdownMenuItem asChild>
								<Link
									to={orgPath(`/agents/${agent.id}/settings`) as string}
								>
									Settings
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem
								className="text-destructive focus:text-destructive"
								onSelect={(e) => {
									e.preventDefault();
									setConfirmOpen(true);
								}}
							>
								<Trash2 className="mr-2 size-4" />
								Delete agent
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<p className="mt-4 line-clamp-2 text-sm text-muted-foreground">
					{agent.greeting}
				</p>

				<div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
					<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
						<span className="font-mono">{agent.defaultModel}</span>
					</div>
					<Link
						to={orgPath(`/agents/${agent.id}`) as string}
						className="inline-flex items-center gap-1 text-xs font-medium text-accent-blue transition-all hover:translate-x-0.5"
					>
						Open
						<ArrowRight className="size-3.5" />
					</Link>
				</div>
			</CardContent>

			<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete {agent.name}?</AlertDialogTitle>
						<AlertDialogDescription>
							This deletes the agent, every conversation, every captured lead,
							and every knowledge-base article. The action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleteMutation.isPending}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={(e) => {
								e.preventDefault();
								deleteMutation.mutate();
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
		</Card>
	);
}

function CreateAgentDialog({
	orgId,
	openFromSearch = false,
}: {
	orgId: string;
	openFromSearch?: boolean;
}) {
	const orgPath = useOrgPath();
	const search = Route.useSearch();
	const navigate = useNavigate();
	const [open, setOpenState] = useState(false);
	const queryClient = useQueryClient();

	// Effect rather than initial state so the sidebar link also works while
	// this page is already open.
	useEffect(() => {
		if (openFromSearch && search.new) setOpenState(true);
	}, [openFromSearch, search.new]);

	function setOpen(next: boolean) {
		setOpenState(next);
		// Drop ?new so a refresh doesn't reopen the dialog.
		if (!next && search.new) {
			navigate({ to: orgPath("/agents"), search: {}, replace: true });
		}
	}

	const form = useForm<CreateAgent>({
		resolver: zodResolver(CreateAgentSchema),
		defaultValues: { name: "" },
	});

	const mutation = useMutation({
		mutationFn: (body: CreateAgent) => api.agents.create(orgId, body),
		onSuccess: (agent) => {
			queryClient.invalidateQueries({ queryKey: ["agents", orgId] });
			form.reset();
			setOpenState(false);
			// Land on the new agent so its setup steps are one click away.
			navigate({ to: orgPath(`/agents/${agent.id}`) });
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
				}
			}}
		>
			<DialogTrigger asChild>
				<Button className="bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90">
					<Plus className="mr-1 size-4" />
					New agent
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create an agent</DialogTitle>
					<DialogDescription>
						You can change everything else later — model, persona, greeting,
						colour. Pick a name to start.
					</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form
						onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
						className="space-y-4"
					>
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Name</FormLabel>
									<FormControl>
										<Input placeholder="Acme Support" autoFocus {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						{mutation.isError && <ErrorBanner err={mutation.error} />}
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
								Create agent
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
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
		<div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
			{message}
		</div>
	);
}
