import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { Download, Loader2, Mail, Phone, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
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
import {
	AgentFilter,
	validateAgentSearch,
} from "@/components/dashboard/agent-filter";
import { NoAgentsState } from "@/components/dashboard/no-agents-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useOrgAgents } from "@/hooks/use-org-agents";
import { api, LeadlyApiError } from "@/lib/api";
import type { Lead } from "@leadly/api-client";

export const Route = createFileRoute("/$orgSlug/leads")({
	validateSearch: validateAgentSearch,
	component: LeadsPage,
});

function LeadsPage() {
	const { agent: agentId } = Route.useSearch();
	const navigate = Route.useNavigate();
	const { orgId, agents, isLoading: agentsLoading } = useOrgAgents();
	const [search, setSearch] = useState("");
	const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

	const q = useQuery({
		queryKey: ["leads", orgId, agentId, search],
		queryFn: () =>
			api.leads.listForOrg(orgId as string, {
				agentId,
				limit: 100,
				search: search.trim() || undefined,
			}),
		enabled: Boolean(orgId),
	});
	const agentsById = new Map(agents.map((a) => [a.id, a]));
	// Only worth a column when rows can come from more than one agent.
	const showAgent = !agentId && agents.length > 1;

	function exportCsv() {
		if (!q.data || q.data.length === 0) return;
		const rows = [
			["Name", "Email", "Phone", "Agent", "Created"],
			...q.data.map((l) => [
				l.name ?? "",
				l.email ?? "",
				l.phone ?? "",
				agentsById.get(l.agentId)?.name ?? "",
				new Date(l.createdAt).toISOString(),
			]),
		];
		const csv = rows
			.map((r) =>
				r
					.map((cell) => {
						const s = String(cell ?? "");
						return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
					})
					.join(","),
			)
			.join("\n");
		const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `leads-${agentId ?? "all"}-${new Date().toISOString().slice(0, 10)}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	return (
		<div className="mx-auto max-w-6xl">
			<div className="mb-5 flex flex-wrap items-center gap-2">
				<AgentFilter
					agents={agents}
					value={agentId}
					onChange={(agent) => navigate({ search: { agent } })}
				/>
				<div className="relative">
					<Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search name, email, phone…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-64 pl-8"
					/>
				</div>
				<Button
					variant="outline"
					onClick={exportCsv}
					disabled={!q.data || q.data.length === 0}
					className="ml-auto"
				>
					<Download className="mr-1 size-4" />
					Export CSV
				</Button>
			</div>

			{agentsLoading || q.isLoading ? (
				<Skeleton className="h-80 rounded-xl" />
			) : q.isError ? (
				<div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
					{q.error instanceof LeadlyApiError
						? `API ${q.error.status}: ${q.error.message}`
						: "Could not load leads."}
				</div>
			) : agents.length === 0 ? (
				<NoAgentsState what="Leads" />
			) : !q.data || q.data.length === 0 ? (
				<EmptyState search={search} />
			) : (
				<Card>
					<CardContent className="p-0">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Name</TableHead>
									<TableHead>Email</TableHead>
									<TableHead>Phone</TableHead>
									{showAgent && <TableHead>Agent</TableHead>}
									<TableHead className="text-right">Captured</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{q.data.map((lead) => (
									<TableRow
										key={lead.id}
										className="cursor-pointer"
										onClick={() => setSelectedLead(lead)}
									>
										<TableCell className="font-medium">
											{lead.name ?? (
												<span className="text-muted-foreground">—</span>
											)}
										</TableCell>
										<TableCell>
											{lead.email ? (
												<span className="inline-flex items-center gap-1.5 text-sm">
													<Mail className="size-3.5 text-muted-foreground" />
													{lead.email}
												</span>
											) : (
												<span className="text-muted-foreground">—</span>
											)}
										</TableCell>
										<TableCell>
											{lead.phone ? (
												<span className="inline-flex items-center gap-1.5 text-sm">
													<Phone className="size-3.5 text-muted-foreground" />
													{lead.phone}
												</span>
											) : (
												<span className="text-muted-foreground">—</span>
											)}
										</TableCell>
										{showAgent && (
											<TableCell className="text-sm text-muted-foreground">
												{agentsById.get(lead.agentId)?.name ?? "—"}
											</TableCell>
										)}
										<TableCell className="text-right font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
											{format(new Date(lead.createdAt), "MMM d")}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			)}

			<LeadDrawer lead={selectedLead} onClose={() => setSelectedLead(null)} />
		</div>
	);
}

function EmptyState({ search }: { search: string }) {
	return (
		<Card>
			<CardContent className="py-14 text-center">
				<h2 className="text-lg font-semibold tracking-tight">
					{search ? "No leads match your search." : "No leads yet."}
				</h2>
				<p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
					{search
						? "Try a shorter query, or clear the search to see everyone."
						: "When the agent captures contact info during a conversation, it lands here."}
				</p>
			</CardContent>
		</Card>
	);
}

function LeadDrawer({
	lead,
	onClose,
}: {
	lead: Lead | null;
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const [name, setName] = useState(lead?.name ?? "");
	const [email, setEmail] = useState(lead?.email ?? "");
	const [phone, setPhone] = useState(lead?.phone ?? "");
	const [confirmDelete, setConfirmDelete] = useState(false);

	// Reset local state whenever the selected lead changes.
	useEffect(() => {
		setName(lead?.name ?? "");
		setEmail(lead?.email ?? "");
		setPhone(lead?.phone ?? "");
	}, [lead]);

	const saveMutation = useMutation({
		mutationFn: () =>
			lead
				? api.leads.update(lead.id, {
						name: name || null,
						email: email || null,
						phone: phone || null,
					})
				: Promise.reject(new Error("No lead")),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["leads"] });
			onClose();
		},
	});

	const deleteMutation = useMutation({
		mutationFn: () =>
			lead ? api.leads.delete(lead.id) : Promise.reject(new Error("No lead")),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["leads"] });
			setConfirmDelete(false);
			onClose();
		},
	});

	const open = Boolean(lead);

	return (
		<Sheet
			open={open}
			onOpenChange={(o) => {
				if (!o) onClose();
			}}
		>
			<SheetContent className="w-full sm:max-w-md">
				<SheetHeader>
					<SheetTitle>Lead</SheetTitle>
					<SheetDescription>
						Edit the captured contact details. Saved changes invalidate the
						list.
					</SheetDescription>
				</SheetHeader>

				{lead && (
					<div className="mt-6 space-y-5 px-4">
						<div className="space-y-1.5">
							<Label htmlFor="lead-name">Name</Label>
							<Input
								id="lead-name"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="—"
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="lead-email">Email</Label>
							<Input
								id="lead-email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="—"
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="lead-phone">Phone</Label>
							<Input
								id="lead-phone"
								value={phone}
								onChange={(e) => setPhone(e.target.value)}
								placeholder="—"
							/>
						</div>
						<div className="rounded-md border border-border bg-secondary/20 p-3 text-xs">
							<div className="font-mono uppercase tracking-[0.15em] text-muted-foreground">
								Captured
							</div>
							<div className="mt-1 text-foreground">
								{format(new Date(lead.createdAt), "PPp")}
							</div>
						</div>

						{(saveMutation.isError || deleteMutation.isError) && (
							<div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
								{(() => {
									const err = saveMutation.error ?? deleteMutation.error;
									if (err instanceof LeadlyApiError)
										return `API ${err.status}: ${err.message}`;
									if (err instanceof Error) return err.message;
									return "Action failed.";
								})()}
							</div>
						)}
					</div>
				)}

				<SheetFooter className="flex-row justify-between gap-2">
					<Button
						variant="outline"
						onClick={() => setConfirmDelete(true)}
						className="text-destructive hover:bg-destructive/10 hover:text-destructive"
					>
						<Trash2 className="mr-1 size-4" />
						Delete
					</Button>
					<Button
						onClick={() => saveMutation.mutate()}
						disabled={saveMutation.isPending}
						className="bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90"
					>
						{saveMutation.isPending && (
							<Loader2 className="mr-2 size-4 animate-spin" />
						)}
						Save
					</Button>
				</SheetFooter>
			</SheetContent>

			<AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this lead?</AlertDialogTitle>
						<AlertDialogDescription>
							The contact details disappear permanently. The conversations
							that referenced this lead stay intact.
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
		</Sheet>
	);
}
