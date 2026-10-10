import type { ConversationWithTurns } from "@leadly/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format, formatDistanceToNow } from "date-fns";
import {
	ArrowLeft,
	CircleStop,
	Hand,
	HandMetal,
	Loader2,
	Mail,
	Send,
	UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, LeadlyApiError } from "@/lib/api";
import { useOrgPath } from "@/hooks/use-current-org";

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
			<div className="mx-auto max-w-6xl">
				<Skeleton className="h-10 w-40 rounded-md" />
				<Skeleton className="mt-6 h-[600px] rounded-xl" />
			</div>
		);
	}

	if (q.isError || !q.data) {
		return (
			<div className="mx-auto max-w-6xl">
				<div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
					{q.error instanceof LeadlyApiError
						? q.error.status === 404
							? "Conversation not found."
							: `API ${q.error.status}: ${q.error.message}`
						: "Could not load conversation."}
				</div>
			</div>
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
	const orgPath = useOrgPath();
	return (
		<div className="mx-auto max-w-6xl">
			<div className="mb-6">
				<Button asChild variant="ghost" size="sm" className="-ml-2">
					<Link to={orgPath("/inbox")}>
						<ArrowLeft className="mr-1 size-4" />
						Inbox
					</Link>
				</Button>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
				<TranscriptPane
					conversation={conversation}
					conversationId={conversationId}
				/>
				<ContextPane conversation={conversation} />
			</div>
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
	const queryClient = useQueryClient();
	const live = conversation.mode === "paused";
	const ended = conversation.status === "ended";

	const takeoverMutation = useMutation({
		mutationFn: () => api.conversations.takeOver(conversationId),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["conversation", conversationId],
			});
			queryClient.invalidateQueries({ queryKey: ["inbox-counts"] });
		},
	});

	const releaseMutation = useMutation({
		mutationFn: () => api.conversations.release(conversationId),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["conversation", conversationId],
			});
			queryClient.invalidateQueries({ queryKey: ["inbox-counts"] });
		},
	});

	const endMutation = useMutation({
		mutationFn: () => api.conversations.end(conversationId),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["conversation", conversationId],
			});
			queryClient.invalidateQueries({ queryKey: ["inbox-counts"] });
		},
	});

	const scrollRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const el = scrollRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	});

	return (
		<Card className="flex h-[680px] flex-col overflow-hidden">
			<div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
				<div className="flex items-center gap-2">
					{live ? (
						<span className="inline-flex items-center gap-1.5 rounded-full bg-accent-blue/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-accent-blue">
							<span className="size-1.5 animate-pulse rounded-full bg-accent-blue" />
							You're live
						</span>
					) : ended ? (
						<span className="rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
							Ended
						</span>
					) : (
						<span className="rounded-full border border-border bg-card px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
							Auto
						</span>
					)}
					<span className="text-xs text-muted-foreground">
						{conversation.turns.length} turn
						{conversation.turns.length === 1 ? "" : "s"}
					</span>
				</div>
				{!ended && (
					<div className="flex items-center gap-2">
						<Button
							size="sm"
							variant="outline"
							onClick={() => endMutation.mutate()}
							disabled={endMutation.isPending}
						>
							{endMutation.isPending ? (
								<Loader2 className="mr-1 size-3.5 animate-spin" />
							) : (
								<CircleStop className="mr-1 size-3.5" />
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
									<Loader2 className="mr-1 size-3.5 animate-spin" />
								) : (
									<HandMetal className="mr-1 size-3.5" />
								)}
								Release
							</Button>
						) : (
							<Button
								size="sm"
								onClick={() => takeoverMutation.mutate()}
								disabled={takeoverMutation.isPending}
								className="bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90"
							>
								{takeoverMutation.isPending ? (
									<Loader2 className="mr-1 size-3.5 animate-spin" />
								) : (
									<Hand className="mr-1 size-3.5" />
								)}
								Take over
							</Button>
						)}
					</div>
				)}
			</div>

			<div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6">
				{conversation.turns.length === 0 ? (
					<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
						No messages yet.
					</div>
				) : (
					<div className="space-y-3">
						{conversation.turns.map((t) => (
							<TurnBubble key={t.id} turn={t} />
						))}
					</div>
				)}
			</div>

			{!ended && live && <HumanComposer conversationId={conversationId} />}
			{!ended && !live && (
				<div className="border-t border-border/60 px-5 py-3 text-xs text-muted-foreground">
					Click <span className="font-medium text-foreground">Take over</span>{" "}
					to reply as a human. The visitor sees no difference.
				</div>
			)}
		</Card>
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
		<div className="border-t border-border/60 p-3">
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
					onClick={send}
					disabled={!text.trim() || mutation.isPending}
					size="icon"
					className="bg-accent-blue text-accent-blue-foreground hover:bg-accent-blue/90"
				>
					{mutation.isPending ? (
						<Loader2 className="size-4 animate-spin" />
					) : (
						<Send className="size-4" />
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

function ContextPane({
	conversation,
}: {
	conversation: ConversationWithTurns;
}) {
	const c = conversation;
	return (
		<div className="space-y-4">
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-sm">Visitor</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3 text-sm">
					<div className="flex items-center gap-3">
						<div className="flex size-9 items-center justify-center rounded-full border border-border bg-secondary/40">
							<UserRound className="size-4 text-muted-foreground" />
						</div>
						<div className="min-w-0 flex-1">
							<div className="truncate text-sm font-medium">
								{c.visitorId.slice(0, 8)}…
							</div>
							<div className="font-mono text-[11px] text-muted-foreground">
								visitor id
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{c.leadId && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm">Lead captured</CardTitle>
						<CardDescription>
							The agent captured contact info during this conversation.
						</CardDescription>
					</CardHeader>
					<CardContent className="text-sm">
						<div className="flex items-center gap-2 text-muted-foreground">
							<Mail className="size-4" />
							<span className="font-mono text-xs">
								{c.leadId.slice(0, 12)}…
							</span>
						</div>
					</CardContent>
				</Card>
			)}

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-sm">Conversation</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2 text-xs text-muted-foreground">
					<KV label="Channel" value={c.channel} mono />
					<KV label="Mode" value={c.mode} mono />
					<KV label="Status" value={c.status} mono />
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
				</CardContent>
			</Card>

			{c.summary && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-sm">Summary</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">{c.summary}</p>
					</CardContent>
				</Card>
			)}
		</div>
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
		<div className="flex items-center justify-between gap-3">
			<span className="text-muted-foreground">{label}</span>
			<span
				className={`text-foreground ${mono ? "font-mono text-[11px]" : ""}`}
			>
				{value}
			</span>
		</div>
	);
}
