import { zodResolver } from "@hookform/resolvers/zod";
import { CreateAgentSchema, type CreateAgent } from "@leadly/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	BotIcon,
	MoreHorizontalIcon,
	PlusIcon,
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
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
	List,
	ListItem,
	ListItemContent,
	ListItemDescription,
	ListItemMeta,
	ListItemTitle,
} from "@/components/ui/list";
import {
	Page,
	PageActions,
	PageContent,
	PageToolbar,
} from "@/components/ui/page";
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
			<Page>
				<PageContent width="flush">
					<ListSkeleton />
				</PageContent>
			</Page>
		);
	}

	if (!currentOrg) {
		return (
			<Page>
				<PageContent>
					<p className="text-sm text-muted-foreground">No organization.</p>
				</PageContent>
			</Page>
		);
	}

	return <AgentsListBody orgId={currentOrg.id} />;
}

function ListSkeleton() {
	return (
		<div className="flex flex-col gap-1 p-2">
			{[0, 1, 2].map((i) => (
				<Skeleton key={i} className="h-14 rounded-lg" />
			))}
		</div>
	);
}

function AgentsListBody({ orgId }: { orgId: string }) {
	const q = useQuery({
		queryKey: ["agents", orgId],
		queryFn: () => api.agents.list(orgId),
	});

	const count = q.data?.length ?? 0;

	return (
		<Page>
			<PageToolbar>
				<span className="text-sm text-muted-foreground">
					{q.data ? `${count} agent${count === 1 ? "" : "s"}` : null}
				</span>
				<PageActions>
					<CreateAgentDialog orgId={orgId} openFromSearch />
				</PageActions>
			</PageToolbar>

			{q.isLoading ? (
				<PageContent width="flush">
					<ListSkeleton />
				</PageContent>
			) : q.isError ? (
				<PageContent>
					<ErrorText err={q.error} />
				</PageContent>
			) : !q.data || q.data.length === 0 ? (
				<PageContent>
					<EmptyState />
				</PageContent>
			) : (
				<PageContent width="flush">
					<List>
						{q.data.map((a) => (
							<AgentRow key={a.id} agent={a} orgId={orgId} />
						))}
					</List>
				</PageContent>
			)}
		</Page>
	);
}

// The toolbar's "New agent" button is the action; the empty state just
// explains what an agent is.
function EmptyState() {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<BotIcon />
				</EmptyMedia>
				<EmptyTitle>Create your first agent</EmptyTitle>
				<EmptyDescription>
					An agent has its own greeting, persona, and knowledge base. You can
					make as many as you want — one per site, one per language, whatever
					fits.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<p className="text-xs text-muted-foreground">
					Use <span className="font-medium text-foreground">New agent</span>{" "}
					above to start.
				</p>
			</EmptyContent>
		</Empty>
	);
}

function AgentRow({ agent, orgId }: { agent: Agent; orgId: string }) {
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
		<ListItem className="pr-2 md:pr-4">
			<span
				className="size-2.5 shrink-0 rounded-full"
				style={{ backgroundColor: agent.accentColor }}
			/>
			<Link
				to={orgPath(`/agents/${agent.id}`) as string}
				className="flex min-w-0 flex-1 items-center gap-3 outline-none"
			>
				<ListItemContent>
					<ListItemTitle>
						<span className="truncate">{agent.name}</span>
						<span className="shrink-0 font-mono text-xs font-normal text-muted-foreground">
							{agent.slug}
						</span>
					</ListItemTitle>
					<ListItemDescription>
						<span className="truncate">{agent.greeting}</span>
					</ListItemDescription>
				</ListItemContent>
				<ListItemMeta className="max-sm:hidden">
					<span className="font-mono">{agent.defaultModel}</span>
				</ListItemMeta>
			</Link>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button
						variant="ghost"
						size="icon-sm"
						className="shrink-0 text-muted-foreground hover:text-foreground"
					>
						<MoreHorizontalIcon className="size-4" />
						<span className="sr-only">Agent actions</span>
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-44">
					<DropdownMenuItem asChild>
						<Link to={orgPath(`/agents/${agent.id}/settings`) as string}>
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
						<TrashIcon className="mr-2 size-4" />
						Delete agent
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

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
								<SpinnerIcon className="mr-2 size-4 animate-spin" />
							)}
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</ListItem>
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
				<Button variant="accent" size="sm">
					<PlusIcon />
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
						{mutation.isError && <ErrorText err={mutation.error} />}
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
								Create agent
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}

function ErrorText({ err }: { err: unknown }) {
	const message =
		err instanceof LeadlyApiError
			? `API ${err.status}: ${err.bodyText.slice(0, 200) || err.message}`
			: err instanceof Error
				? err.message
				: "Unknown error";
	return (
		<p className="text-sm text-destructive">{message}</p>
	);
}
