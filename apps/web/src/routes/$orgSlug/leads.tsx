import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import {
	DownloadIcon,
	MailIcon,
	PhoneIcon,
	SearchIcon,
	SpinnerIcon,
	TagsIcon,
	TrashIcon,
} from "@/components/icons";
import { useEffect, useId, useState } from "react";
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
import {
	INTENT_LABEL,
	IntentBadge,
	ScoreBadge,
} from "@/components/dashboard/lead-insights";
import {
	KeyFactsList,
	LeadValueInputs,
	LeadValuesList,
} from "@/components/dashboard/lead-values";
import { NoAgentsState } from "@/components/dashboard/no-agents-state";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Page,
	PageActions,
	PageContent,
	PageToolbar,
} from "@/components/ui/page";
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
import {
	customFieldsPatch,
	displayValue,
	fieldValues,
} from "@/lib/lead-fields";
import type { Lead } from "@leadly/api-client";
import type { LeadField } from "@leadly/schemas";

// Lead field columns that fit in the table; the CSV has all of them.
const MAX_FIELD_COLUMNS = 3;
// Stable fallback so the drawer's reset effect doesn't re-run every render.
const NO_FIELDS: LeadField[] = [];

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
	// Lead fields of the agents in view, one column per key (agents that
	// share a key, e.g. "budget" from the same template, share a column).
	const columnFields: LeadField[] = [];
	for (const a of agents) {
		if (agentId && a.id !== agentId) continue;
		for (const f of a.leadFields) {
			if (!columnFields.some((c) => c.key === f.key)) columnFields.push(f);
		}
	}
	const tableFields = columnFields.slice(0, MAX_FIELD_COLUMNS);
	const cell = (lead: Lead, key: string) => displayValue(lead.customFields[key]);

	function exportCsv() {
		if (!q.data || q.data.length === 0) return;
		const rows = [
			[
				"Name",
				"Email",
				"Phone",
				"Intent",
				"Score",
				"Need",
				...columnFields.map((f) => f.label),
				"Notable details",
				"Agent",
				"Created",
			],
			...q.data.map((l) => [
				l.name ?? "",
				l.email ?? "",
				l.phone ?? "",
				l.intent ? INTENT_LABEL[l.intent] : "",
				l.score ?? "",
				l.need ?? "",
				...columnFields.map((f) => cell(l, f.key)),
				l.keyFacts.map((k) => `${k.label}: ${k.value}`).join("; "),
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
		<Page>
			<PageToolbar>
				<div className="relative">
					<SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search name, email, phone…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="h-8 w-64 pl-8"
					/>
				</div>
				<AgentFilter
					agents={agents}
					value={agentId}
					onChange={(agent) => navigate({ search: { agent } })}
				/>
				<PageActions>
					<Button
						variant="outline"
						size="sm"
						onClick={exportCsv}
						disabled={!q.data || q.data.length === 0}
					>
						<DownloadIcon />
						Export CSV
					</Button>
				</PageActions>
			</PageToolbar>

			{agentsLoading || q.isLoading ? (
				<PageContent className="flex flex-col gap-2">
					{[0, 1, 2, 3, 4].map((i) => (
						<Skeleton key={i} className="h-10 rounded-lg" />
					))}
				</PageContent>
			) : q.isError ? (
				<PageContent>
					<p className="text-sm text-destructive">
						{q.error instanceof LeadlyApiError
							? `API ${q.error.status}: ${q.error.message}`
							: "Could not load leads."}
					</p>
				</PageContent>
			) : agents.length === 0 ? (
				<PageContent>
					<NoAgentsState what="Leads" />
				</PageContent>
			) : !q.data || q.data.length === 0 ? (
				<PageContent>
					<EmptyState search={search} />
				</PageContent>
			) : (
				<PageContent width="flush">
					<Table flush>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Email</TableHead>
								<TableHead>Phone</TableHead>
								<TableHead>Intent</TableHead>
								<TableHead>Score</TableHead>
								<TableHead className="hidden lg:table-cell">Need</TableHead>
								{tableFields.map((f) => (
									<TableHead key={f.key} className="hidden xl:table-cell">
										{f.label}
									</TableHead>
								))}
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
												<MailIcon className="size-3.5 text-muted-foreground" />
												{lead.email}
											</span>
										) : (
											<span className="text-muted-foreground">—</span>
										)}
									</TableCell>
									<TableCell>
										{lead.phone ? (
											<span className="inline-flex items-center gap-1.5 text-sm">
												<PhoneIcon className="size-3.5 text-muted-foreground" />
												{lead.phone}
											</span>
										) : (
											<span className="text-muted-foreground">—</span>
										)}
									</TableCell>
									<TableCell>
										<IntentBadge intent={lead.intent} />
									</TableCell>
									<TableCell>
										<ScoreBadge score={lead.score} />
									</TableCell>
									<TableCell className="hidden max-w-[260px] truncate text-sm text-muted-foreground lg:table-cell">
										{lead.need ?? "—"}
									</TableCell>
									{tableFields.map((f) => (
										<TableCell
											key={f.key}
											className="hidden max-w-[180px] truncate text-sm xl:table-cell"
										>
											{cell(lead, f.key) || (
												<span className="text-muted-foreground">—</span>
											)}
										</TableCell>
									))}
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
				</PageContent>
			)}

			<LeadDrawer
				lead={selectedLead}
				fields={
					selectedLead
						? (agentsById.get(selectedLead.agentId)?.leadFields ?? NO_FIELDS)
						: NO_FIELDS
				}
				onClose={() => setSelectedLead(null)}
			/>
		</Page>
	);
}

function EmptyState({ search }: { search: string }) {
	return (
		<Empty>
			<EmptyHeader>
				<EmptyMedia variant="icon">
					{search ? <SearchIcon /> : <TagsIcon />}
				</EmptyMedia>
				<EmptyTitle>
					{search ? "No leads match your search" : "No leads yet"}
				</EmptyTitle>
				<EmptyDescription>
					{search
						? "Try a shorter query, or clear the search to see everyone."
						: "When the agent captures contact info during a conversation, it lands here."}
				</EmptyDescription>
			</EmptyHeader>
		</Empty>
	);
}

function LeadDrawer({
	lead,
	fields,
	onClose,
}: {
	lead: Lead | null;
	fields: LeadField[];
	onClose: () => void;
}) {
	const queryClient = useQueryClient();
	const [name, setName] = useState(lead?.name ?? "");
	const [email, setEmail] = useState(lead?.email ?? "");
	const [phone, setPhone] = useState(lead?.phone ?? "");
	const [values, setValues] = useState<Record<string, string>>({});
	const [keyFacts, setKeyFacts] = useState(lead?.keyFacts ?? []);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const formId = useId();

	// Reset local state whenever the selected lead changes.
	useEffect(() => {
		setName(lead?.name ?? "");
		setEmail(lead?.email ?? "");
		setPhone(lead?.phone ?? "");
		setValues(lead ? fieldValues(fields, lead.customFields) : {});
		setKeyFacts(lead?.keyFacts ?? []);
	}, [lead, fields]);

	// Values stored under keys no field has any more (a removed field).
	const fieldKeys = new Set(fields.map((f) => f.key));
	const otherValues = Object.fromEntries(
		Object.entries(lead?.customFields ?? {}).filter(([k]) => !fieldKeys.has(k)),
	);

	const saveMutation = useMutation({
		mutationFn: () =>
			lead
				? api.leads.update(lead.id, {
						name: name || null,
						email: email || null,
						phone: phone || null,
						customFields: customFieldsPatch(lead.customFields, values),
						keyFacts,
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
						Edit what the agent captured.
					</SheetDescription>
				</SheetHeader>

				{lead && (
					<div className="mt-6 space-y-5 px-4">
						<div className="space-y-1.5">
							<Label htmlFor={`${formId}-name`}>Name</Label>
							<Input
								id={`${formId}-name`}
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="—"
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor={`${formId}-email`}>Email</Label>
							<Input
								id={`${formId}-email`}
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								placeholder="—"
							/>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor={`${formId}-phone`}>Phone</Label>
							<Input
								id={`${formId}-phone`}
								value={phone}
								onChange={(e) => setPhone(e.target.value)}
								placeholder="—"
							/>
						</div>
						{(lead.intent || lead.score !== null || lead.need) && (
							<div className="space-y-2.5 rounded-lg bg-muted p-3 text-[13px]">
								<div className="flex items-center justify-between gap-3">
									<span className="text-muted-foreground">Intent</span>
									<IntentBadge intent={lead.intent} />
								</div>
								<div className="flex items-center justify-between gap-3">
									<span className="text-muted-foreground">Score</span>
									<ScoreBadge score={lead.score} />
								</div>
								{lead.need && (
									<div>
										<div className="text-muted-foreground">Need</div>
										<div className="mt-0.5 text-foreground">{lead.need}</div>
									</div>
								)}
							</div>
						)}
						<LeadValueInputs
							fields={fields}
							values={values}
							onChange={(key, value) =>
								setValues((prev) => ({ ...prev, [key]: value }))
							}
						/>
						<LeadValuesList fields={NO_FIELDS} details={otherValues} />
						{keyFacts.length > 0 && (
							<div className="space-y-2">
								<div className="text-sm font-medium">Notable details</div>
								<KeyFactsList
									facts={keyFacts}
									onRemove={(i) =>
										setKeyFacts((prev) => prev.filter((_, j) => j !== i))
									}
								/>
							</div>
						)}
						<div className="rounded-lg bg-muted p-3 text-xs">
							<div className="font-mono uppercase tracking-[0.15em] text-muted-foreground">
								Captured
							</div>
							<div className="mt-1 text-foreground">
								{format(new Date(lead.createdAt), "PPp")}
							</div>
						</div>

						{(saveMutation.isError || deleteMutation.isError) && (
							<p className="text-sm text-destructive">
								{(() => {
									const err = saveMutation.error ?? deleteMutation.error;
									if (err instanceof LeadlyApiError)
										return `API ${err.status}: ${err.message}`;
									if (err instanceof Error) return err.message;
									return "Action failed.";
								})()}
							</p>
						)}
					</div>
				)}

				<SheetFooter className="flex-row justify-between gap-2">
					<Button
						variant="outline"
						onClick={() => setConfirmDelete(true)}
						className="text-destructive hover:bg-destructive/10 hover:text-destructive"
					>
						<TrashIcon className="mr-1 size-4" />
						Delete
					</Button>
					<Button
						variant="accent"
						onClick={() => saveMutation.mutate()}
						disabled={saveMutation.isPending}
					>
						{saveMutation.isPending && (
							<SpinnerIcon className="mr-2 size-4 animate-spin" />
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
								<SpinnerIcon className="mr-2 size-4 animate-spin" />
							)}
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Sheet>
	);
}
