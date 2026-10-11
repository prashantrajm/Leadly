import type { ConversationWithTurns } from "@leadly/api-client";
import type { LeadField } from "@leadly/schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
	ArrowLeftIcon,
	BotIcon,
	HandIcon,
	SendIcon,
	SpinnerIcon,
	StopIcon,
} from "@/components/icons";
import { IntentBadge, ScoreBadge } from "@/components/dashboard/lead-insights";
import {
	KeyFactsList,
	LeadValuesEditor,
	LeadValuesList,
} from "@/components/dashboard/lead-values";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useOrgPath } from "@/hooks/use-current-org";
import { useOrgAgents } from "@/hooks/use-org-agents";
import {
	type InboxSearch,
	useInboxConversations,
	visitorLabel,
} from "@/hooks/use-inbox-conversations";
import { api, LeadlyApiError } from "@/lib/api";

// Right-hand pane of the inbox: transcript, reply composer and details.
export const Route = createFileRoute("/$orgSlug/inbox/$conversationId")({
	component: ConversationDetail,
});

function ConversationDetail() {
	const { conversationId } = Route.useParams();

	const q = useQuery({
		queryKey: ["conversation", conversationId],
		queryFn: () => api.conversations.get(conversationId),
		// Poll while open so new visitor turns and streamed agent replies
		// appear without the user clicking refresh. Stops when off-page.
		refetchInterval: 4_000,
	});

	if (q.isLoading) {
		return (
			<div className="flex flex-col gap-4 p-4 md:p-6">
				<Skeleton className="h-6 w-40" />
				<Skeleton className="h-16 w-2/3 rounded-2xl" />
				<Skeleton className="ml-auto h-16 w-2/3 rounded-2xl" />
			</div>
		);
	}

	if (q.isError || !q.data) {
		return (
			<p className="p-4 text-sm text-destructive md:p-6">
				{q.error instanceof LeadlyApiError
					? q.error.status === 404
						? "Conversation not found."
						: `API ${q.error.status}: ${q.error.message}`
					: "Could not load conversation."}
			</p>
		);
	}

	return (
		<ConversationView conversation={q.data} conversationId={conversationId} />
	);
}

function ConversationView({
	conversation,
	conversationId,
}: {
	conversation: ConversationWithTurns;
	conversationId: string;
}) {
	const search = Route.useSearch() as InboxSearch;
	const orgPath = useOrgPath();
	// The list row (same query as the list pane, so usually cached) knows the
	// visitor's name; the detail payload only has ids.
	const listItem = useInboxConversations(search).data?.items.find(
		(c) => c.id === conversationId,
	);
	const title = listItem
		? visitorLabel(listItem)
		: `Visitor ${conversation.visitorId.slice(0, 8)}`;
	const live = conversation.mode === "paused";
	const ended = conversation.status === "ended";

	return (
		<>
			<header className="flex h-12 shrink-0 items-center gap-2 border-b border-border/60 px-4 md:px-6">
				<Button
					asChild
					variant="ghost"
					size="icon-sm"
					className="-ml-2 md:hidden"
				>
					<Link to={orgPath("/inbox") as string} search={search}>
						<ArrowLeftIcon />
						<span className="sr-only">Back to inbox</span>
					</Link>
				</Button>
				<h2 className="truncate text-sm font-medium">{title}</h2>
				{live ? (
					<Badge className="gap-1.5 bg-accent-blue/10 text-accent-blue">
						<span className="size-1.5 animate-pulse rounded-full bg-accent-blue" />
						You're live
					</Badge>
				) : (
					<Badge variant="outline">{ended ? "Ended" : "Auto"}</Badge>
				)}
				{!ended && (
					<ConversationActions
						conversationId={conversationId}
						live={live}
					/>
				)}
			</header>
			<div className="flex min-h-0 flex-1">
				<TranscriptPane conversation={conversation} conversationId={conversationId} />
				<DetailsPane conversation={conversation} />
			</div>
		</>
	);
}

function ConversationActions({
	conversationId,
	live,
}: {
	conversationId: string;
	live: boolean;
}) {
	const queryClient = useQueryClient();
	const invalidate = () => {
		queryClient.invalidateQueries({
			queryKey: ["conversation", conversationId],
		});
		queryClient.invalidateQueries({ queryKey: ["inbox-counts"] });
	};

	const takeoverMutation = useMutation({
		mutationFn: () => api.conversations.takeOver(conversationId),
		onSuccess: invalidate,
	});
	const releaseMutation = useMutation({
		mutationFn: () => api.conversations.release(conversationId),
		onSuccess: invalidate,
	});
	const endMutation = useMutation({
		mutationFn: () => api.conversations.end(conversationId),
		onSuccess: invalidate,
	});

	return (
		<div className="ml-auto flex items-center gap-1.5">
			<Button
				size="sm"
				variant="outline"
				onClick={() => endMutation.mutate()}
				disabled={endMutation.isPending}
			>
				{endMutation.isPending ? (
					<SpinnerIcon className="animate-spin" />
				) : (
					<StopIcon />
				)}
				End
			</Button>
			{live ? (
				<Button
					size="sm"
					variant="outline"
					onClick={() => releaseMutation.mutate()}
					disabled={releaseMutation.isPending}
				>
					{releaseMutation.isPending ? (
						<SpinnerIcon className="animate-spin" />
					) : (
						<BotIcon />
					)}
					Release
				</Button>
			) : (
				<Button
					variant="accent"
					size="sm"
					onClick={() => takeoverMutation.mutate()}
					disabled={takeoverMutation.isPending}
				>
					{takeoverMutation.isPending ? (
						<SpinnerIcon className="animate-spin" />
					) : (
						<HandIcon />
					)}
					Take over
				</Button>
			)}
		</div>
	);
}

function TranscriptPane({
	conversation,
	conversationId,
}: {
	conversation: ConversationWithTurns;
	conversationId: string;
}) {
	const live = conversation.mode === "paused";
	const ended = conversation.status === "ended";

	const scrollRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const el = scrollRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	});

	return (
		<div className="flex min-w-0 flex-1 flex-col">
			<div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
				{conversation.turns.length === 0 ? (
					<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
						No messages yet.
					</div>
				) : (
					<div className="mx-auto flex max-w-2xl flex-col gap-3">
						{conversation.turns.map((t) => (
							<TurnBubble key={t.id} turn={t} />
						))}
					</div>
				)}
			</div>

			{!ended && live && <HumanComposer conversationId={conversationId} />}
			{!ended && !live && (
				<div className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground md:px-6">
					Click <span className="font-medium text-foreground">Take over</span>{" "}
					to reply as a human. The visitor sees no difference.
				</div>
			)}
		</div>
	);
}

function HumanComposer({ conversationId }: { conversationId: string }) {
	const queryClient = useQueryClient();
	const [text, setText] = useState("");

	const mutation = useMutation({
		mutationFn: (t: string) =>
			api.conversations.humanMessage(conversationId, { text: t }),
		onSuccess: () => {
			setText("");
			queryClient.invalidateQueries({
				queryKey: ["conversation", conversationId],
			});
		},
	});

	function send() {
		if (!text.trim() || mutation.isPending) return;
		mutation.mutate(text.trim());
	}

	return (
		<div className="border-t border-border/60 px-4 py-3 md:px-6">
			<div className="flex items-end gap-2">
				<Textarea
					placeholder="Type a reply… visitor sees this as the agent."
					value={text}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							send();
						}
					}}
					rows={1}
					className="min-h-[40px] resize-none"
				/>
				<Button
					variant="accent"
					onClick={send}
					disabled={!text.trim() || mutation.isPending}
					size="icon"
				>
					{mutation.isPending ? (
						<SpinnerIcon className="size-4 animate-spin" />
					) : (
						<SendIcon className="size-4" />
					)}
					<span className="sr-only">Send</span>
				</Button>
			</div>
			{mutation.isError && (
				<p className="mt-1 text-xs text-destructive">
					{mutation.error instanceof LeadlyApiError
						? `API ${mutation.error.status}: ${mutation.error.message}`
						: "Send failed."}
				</p>
			)}
		</div>
	);
}

function TurnBubble({
	turn,
}: {
	turn: ConversationWithTurns["turns"][number];
}) {
	if (turn.role === "user") {
		return (
			<div className="flex justify-start">
				<div className="max-w-[78%] rounded-2xl rounded-bl-sm bg-secondary px-3.5 py-2.5 text-sm text-secondary-foreground">
					{turn.text}
				</div>
			</div>
		);
	}
	if (turn.role === "tool" || turn.role === "system") {
		return (
			<div className="flex justify-center">
				<div className="rounded-full border border-border bg-card px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
					{turn.role === "tool" && turn.toolName
						? `tool · ${turn.toolName}`
						: turn.role}
				</div>
			</div>
		);
	}
	// agent or human — render as outgoing bubble
	const isHuman = turn.role === "human";
	return (
		<div className="flex justify-end">
			<div className="relative max-w-[78%] rounded-2xl rounded-br-sm bg-foreground px-3.5 py-2.5 text-sm text-background">
				{turn.text}
				{isHuman && (
					<span className="absolute -top-2 -right-2 rounded-full bg-accent-blue px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-accent-blue-foreground">
						you
					</span>
				)}
			</div>
		</div>
	);
}

// Properties panel beside the transcript, Linear-issue style: hairline-
// divided groups of label/value rows rather than a stack of cards.
function DetailsPane({
	conversation: c,
}: {
	conversation: ConversationWithTurns;
}) {
	return (
		<aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-border/60 xl:block">
			<DetailsGroup title="Conversation">
				<KV label="Status" value={c.status} />
				<KV label="Mode" value={c.mode === "paused" ? "live" : c.mode} />
				<KV label="Channel" value={c.channel} />
				<KV label="Turns" value={String(c.turns.length)} />
				<KV
					label="Started"
					value={format(new Date(c.startedAt), "MMM d, h:mm a")}
				/>
				<KV
					label="Last activity"
					value={formatDistanceToNow(new Date(c.lastActivityAt), {
						addSuffix: true,
					})}
				/>
				{c.endedAt && (
					<KV
						label="Ended"
						value={format(new Date(c.endedAt), "MMM d, h:mm a")}
					/>
				)}
			</DetailsGroup>
			<DetailsGroup title="Visitor">
				<KV label="Visitor" value={`${c.visitorId.slice(0, 8)}…`} mono />
				<KV
					label="Lead"
					value={c.leadId ? `${c.leadId.slice(0, 8)}…` : "Not captured"}
					mono={Boolean(c.leadId)}
				/>
			</DetailsGroup>
			{(c.intent || c.leadScore !== null || c.qualityScore !== null) && (
				<DetailsGroup title="Analysis">
					<div className="flex items-center justify-between gap-3 text-[13px]">
						<span className="text-muted-foreground">Intent</span>
						<IntentBadge intent={c.intent} />
					</div>
					<div className="flex items-center justify-between gap-3 text-[13px]">
						<span className="text-muted-foreground">Lead score</span>
						<ScoreBadge score={c.leadScore} />
					</div>
					{c.qualityScore !== null && (
						<KV label="Chat quality" value={`${c.qualityScore} / 5`} />
					)}
					{c.resolved !== null && (
						<KV label="Resolved" value={c.resolved ? "Yes" : "No"} />
					)}
				</DetailsGroup>
			)}
			<LeadDetailsGroup conversation={c} />
			{c.summary && (
				<DetailsGroup title="Summary">
					<p className="text-[13px] leading-relaxed text-muted-foreground">
						{c.summary}
					</p>
				</DetailsGroup>
			)}
			{c.insights && <InsightsGroups insights={c.insights} />}
		</aside>
	);
}

const NO_FIELDS: LeadField[] = [];

// The agent's lead fields for this chat. Once the visitor is a lead the
// values are the lead's and editable here; before that, what this chat
// captured, read-only.
function LeadDetailsGroup({
	conversation: c,
}: {
	conversation: ConversationWithTurns;
}) {
	const { agents } = useOrgAgents();
	const fields =
		agents.find((a) => a.id === c.agentId)?.leadFields ?? NO_FIELDS;
	const leadQuery = useQuery({
		queryKey: ["lead", c.leadId],
		queryFn: () => api.leads.get(c.leadId as string),
		enabled: Boolean(c.leadId),
	});

	if (c.leadId) {
		if (!leadQuery.data || fields.length === 0) {
			return c.leadDetails ? (
				<DetailsGroup title="Lead details">
					<LeadValuesList fields={fields} details={c.leadDetails} />
				</DetailsGroup>
			) : null;
		}
		return (
			<DetailsGroup title="Lead details">
				<LeadValuesEditor lead={leadQuery.data} fields={fields} />
			</DetailsGroup>
		);
	}
	if (!c.leadDetails) return null;
	return (
		<DetailsGroup title="Lead details">
			<LeadValuesList fields={fields} details={c.leadDetails} />
		</DetailsGroup>
	);
}

function InsightsGroups({
	insights,
}: {
	insights: NonNullable<ConversationWithTurns["insights"]>;
}) {
	const lists = [
		{ title: "Unanswered questions", items: insights.unansweredQuestions ?? [] },
		{ title: "Objections", items: insights.objections ?? [] },
	];
	return (
		<>
			{insights.need && (
				<DetailsGroup title="Need">
					<p className="text-[13px] leading-relaxed text-foreground">
						{insights.need}
					</p>
				</DetailsGroup>
			)}
			{lists.map(
				(list) =>
					list.items.length > 0 && (
						<DetailsGroup key={list.title} title={list.title}>
							<ul className="list-disc space-y-1 pl-4 text-[13px] leading-relaxed text-muted-foreground">
								{list.items.map((item) => (
									<li key={item}>{item}</li>
								))}
							</ul>
						</DetailsGroup>
					),
			)}
			{insights.keyFacts && insights.keyFacts.length > 0 && (
				<DetailsGroup title="Notable details">
					<KeyFactsList facts={insights.keyFacts} />
				</DetailsGroup>
			)}
			{insights.nextStep && (
				<DetailsGroup title="Next step">
					<p className="text-[13px] leading-relaxed text-foreground">
						{insights.nextStep}
					</p>
				</DetailsGroup>
			)}
		</>
	);
}

function DetailsGroup({
	title,
	children,
}: {
	title: string;
	children: ReactNode;
}) {
	return (
		<section className="flex flex-col gap-2.5 border-b border-border/60 px-5 py-4 last:border-b-0">
			<h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
			{children}
		</section>
	);
}

function KV({
	label,
	value,
	mono,
}: {
	label: string;
	value: string;
	mono?: boolean;
}) {
	return (
		<div className="flex items-center justify-between gap-3 text-[13px]">
			<span className="text-muted-foreground">{label}</span>
			<span
				className={
					mono ? "font-mono text-xs text-foreground" : "capitalize text-foreground"
				}
			>
				{value}
			</span>
		</div>
	);
}
