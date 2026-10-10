import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircleIcon,
	PlayIcon,
	RefreshIcon,
	SaveIcon,
	SendIcon,
	SpinnerIcon,
} from "@/components/icons";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Page, PageContent } from "@/components/ui/page";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
	usePlaygroundConversation,
	type PlaygroundTurn,
} from "@/hooks/use-playground-conversation";
import { api, LeadlyApiError } from "@/lib/api";
import type { Agent } from "@leadly/api-client";

export const Route = createFileRoute("/$orgSlug/agents/$agentId/playground")({
	component: PlaygroundPage,
});

function PlaygroundPage() {
	const { agentId } = Route.useParams();

	const agentQuery = useQuery({
		queryKey: ["agent", agentId],
		queryFn: () => api.agents.get(agentId),
	});

	if (agentQuery.isLoading) {
		return (
			<Page>
				<PageContent className="flex flex-col gap-4">
					<Skeleton className="h-6 w-48" />
					<Skeleton className="h-16 w-2/3 rounded-2xl" />
				</PageContent>
			</Page>
		);
	}

	if (agentQuery.isError || !agentQuery.data) {
		return (
			<Page>
				<PageContent>
					<p className="text-sm text-destructive">
						{agentQuery.error instanceof LeadlyApiError
							? `API ${agentQuery.error.status}: ${agentQuery.error.message}`
							: "Could not load agent."}
					</p>
				</PageContent>
			</Page>
		);
	}

	return <PlaygroundBody agent={agentQuery.data} agentId={agentId} />;
}

function PlaygroundBody({
	agent,
	agentId,
}: {
	agent: Agent;
	agentId: string;
}) {
	const conv = usePlaygroundConversation(agentId);

	// Split view like the inbox: chat fills the panel, tuning sits beside it
	// behind a hairline (below it on narrow screens).
	return (
		<Page>
			<PageContent width="flush" className="lg:flex-row">
				<ChatPanel agent={agent} conv={conv} />
				<TuningPanel agent={agent} agentId={agentId} />
			</PageContent>
		</Page>
	);
}

function ChatPanel({
	agent,
	conv,
}: {
	agent: Agent;
	conv: ReturnType<typeof usePlaygroundConversation>;
}) {
	const [input, setInput] = useState("");
	const scrollRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = scrollRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [conv.turns, conv.typing]);

	function handleSend() {
		if (!input.trim()) return;
		conv.sendMessage(input);
		setInput("");
	}

	const idle = conv.status === "idle" || conv.status === "closed";
	const live = conv.status === "open";

	return (
		<section
			aria-label="Chat"
			className="flex min-h-0 min-w-0 flex-1 flex-col max-lg:h-[calc(100svh-3.5rem)]"
		>
			{/* Top bar — visitor sees something like this */}
			<div className="flex h-12 shrink-0 items-center gap-3 border-b border-border/60 px-4 md:px-6">
				<div
					className="flex size-7 items-center justify-center rounded-full text-xs font-semibold text-white"
					style={{ backgroundColor: agent.accentColor }}
				>
					{agent.name.charAt(0).toUpperCase()}
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<span className="truncate text-sm font-medium">{agent.name}</span>
						<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
							<StatusDot status={conv.status} />
							<StatusLabel status={conv.status} />
						</span>
					</div>
				</div>
				{!idle && (
					<Button variant="ghost" size="sm" onClick={() => conv.close()}>
						<RefreshIcon />
						Reset
					</Button>
				)}
			</div>

			{/* Transcript */}
			<div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
				{conv.error && (
					<div className="mx-auto mb-3 flex max-w-2xl items-start gap-2 text-sm text-destructive">
						<AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
						<span>{conv.error}</span>
					</div>
				)}

				{conv.turns.length === 0 && !conv.error && (
					<div className="flex h-full flex-col items-center justify-center text-center">
						{idle ? (
							<>
								<div
									className="mb-4 flex size-12 items-center justify-center rounded-full text-white"
									style={{ backgroundColor: agent.accentColor }}
								>
									<PlayIcon className="size-5" />
								</div>
								<h3 className="text-base font-semibold tracking-tight">
									Ready when you are.
								</h3>
								<p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-foreground">
									Start a conversation to see how the agent answers — same
									flow as a real visitor.
								</p>
								<Button variant="accent" onClick={() => conv.open()} className="mt-5">
									Start conversation
								</Button>
							</>
						) : conv.status === "connecting" ? (
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<SpinnerIcon className="size-4 animate-spin" />
								Connecting…
							</div>
						) : live ? (
							<div className="flex flex-col items-center text-center">
								<p className="text-sm leading-relaxed text-foreground">
									{agent.greeting}
								</p>
								<p className="mt-3 text-xs text-muted-foreground">
									Type below to begin.
								</p>
							</div>
						) : null}
					</div>
				)}

				<div className="mx-auto flex max-w-2xl flex-col gap-3">
					{conv.turns.map((t) => (
						<TurnBubble key={t.id} turn={t} accent={agent.accentColor} />
					))}
					{conv.typing && (
						<div className="flex justify-start">
							<div className="rounded-2xl rounded-bl-sm bg-secondary px-3 py-2.5">
								<TypingDots />
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Composer */}
			<div className="border-t border-border/60 px-4 py-3 md:px-6">
				<div className="flex items-end gap-2">
					<Textarea
						placeholder={
							idle
								? "Click Start conversation to begin"
								: "Type a message…"
						}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								handleSend();
							}
						}}
						disabled={!live}
						rows={1}
						className="min-h-[40px] resize-none"
					/>
					<Button
						variant="accent"
						onClick={handleSend}
						disabled={!live || !input.trim()}
						size="icon"
					>
						<SendIcon className="size-4" />
						<span className="sr-only">Send</span>
					</Button>
				</div>
				<p className="mt-1.5 text-[11px] text-muted-foreground">
					Enter to send · Shift+Enter for newline
				</p>
			</div>
		</section>
	);
}

function TurnBubble({
	turn,
	accent,
}: {
	turn: PlaygroundTurn;
	accent: string;
}) {
	if (turn.role === "user") {
		return (
			<div className="flex justify-end">
				<div
					className="max-w-[78%] rounded-2xl rounded-br-sm px-3.5 py-2.5 text-sm text-white"
					style={{ backgroundColor: accent }}
				>
					{turn.text}
				</div>
			</div>
		);
	}
	return (
		<div className="flex justify-start">
			<div className="max-w-[78%] rounded-2xl rounded-bl-sm bg-secondary px-3.5 py-2.5 text-sm text-secondary-foreground">
				{turn.text || (
					<span className="text-muted-foreground">…</span>
				)}
			</div>
		</div>
	);
}

function TypingDots() {
	return (
		<div className="flex items-center gap-1">
			<span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:0ms]" />
			<span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:120ms]" />
			<span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:240ms]" />
		</div>
	);
}

function StatusDot({ status }: { status: string }) {
	const cls =
		status === "open"
			? "bg-accent-blue"
			: status === "connecting"
				? "bg-warning"
				: status === "error"
					? "bg-destructive"
					: "bg-muted-foreground/40";
	return <span className={`size-1.5 rounded-full ${cls}`} />;
}

function StatusLabel({ status }: { status: string }) {
	switch (status) {
		case "open":
			return <span>Live</span>;
		case "connecting":
			return <span>Connecting…</span>;
		case "error":
			return <span className="text-destructive">Error</span>;
		case "closed":
			return <span>Closed</span>;
		default:
			return <span>Idle</span>;
	}
}

// ---------------------------------------------------------------------------
// Tuning panel — quick edits that take effect on the next conversation.
// ---------------------------------------------------------------------------

function TuningPanel({ agent, agentId }: { agent: Agent; agentId: string }) {
	const queryClient = useQueryClient();

	const [greeting, setGreeting] = useState(agent.greeting);
	const [systemPromptOverlay, setSystemPromptOverlay] = useState(
		agent.systemPromptOverlay ?? "",
	);
	const [defaultModel, setDefaultModel] = useState(agent.defaultModel);

	useEffect(() => {
		setGreeting(agent.greeting);
		setSystemPromptOverlay(agent.systemPromptOverlay ?? "");
		setDefaultModel(agent.defaultModel);
	}, [agent.greeting, agent.systemPromptOverlay, agent.defaultModel]);

	const dirty =
		greeting !== agent.greeting ||
		(systemPromptOverlay || "") !== (agent.systemPromptOverlay ?? "") ||
		defaultModel !== agent.defaultModel;

	const mutation = useMutation({
		mutationFn: () =>
			api.agents.update(agentId, {
				greeting,
				systemPromptOverlay: systemPromptOverlay || undefined,
				defaultModel,
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
		},
	});

	return (
		<aside
			aria-label="Tune live"
			className="flex shrink-0 flex-col border-border/60 max-lg:border-t lg:w-80 lg:overflow-y-auto lg:border-l"
		>
			<section className="flex flex-col gap-4 border-b border-border/60 px-5 py-5">
				<div className="flex flex-col gap-1">
					<h2 className="text-sm font-medium">Tune live</h2>
					<p className="text-xs text-muted-foreground">
						Edits save to this agent and apply on the next conversation.
						Reset the chat to test.
					</p>
				</div>

				<div className="space-y-1.5">
					<Label className="text-xs">Greeting</Label>
					<Textarea
						rows={3}
						value={greeting}
						onChange={(e) => setGreeting(e.target.value)}
						className="text-sm"
					/>
				</div>

				<div className="space-y-1.5">
					<Label className="text-xs">System prompt overlay</Label>
					<Textarea
						rows={4}
						placeholder="Be terse. Cite sources inline. Don't apologize."
						value={systemPromptOverlay}
						onChange={(e) => setSystemPromptOverlay(e.target.value)}
						className="font-mono text-xs"
					/>
					<p className="text-[11px] text-muted-foreground">
						Appended to the base system prompt. Empty = library default.
					</p>
				</div>

				<div className="space-y-1.5">
					<Label className="text-xs">Model</Label>
					<Input
						value={defaultModel}
						onChange={(e) => setDefaultModel(e.target.value)}
						className="font-mono text-xs"
						placeholder="tencent/hy3-preview:free"
					/>
					<p className="text-[11px] text-muted-foreground">
						OpenRouter model id. Free tier defaults to{" "}
						<code className="rounded bg-muted px-1 py-0.5 font-mono">
							tencent/hy3-preview:free
						</code>
						.
					</p>
				</div>

				<Button
					variant="accent"
					disabled={!dirty || mutation.isPending}
					onClick={() => mutation.mutate()}
					size="sm"
					className="w-full"
				>
					{mutation.isPending ? (
						<SpinnerIcon className="animate-spin" />
					) : (
						<SaveIcon />
					)}
					Save changes
				</Button>

				{mutation.isError && (
					<p className="text-xs text-destructive">
						{mutation.error instanceof LeadlyApiError
							? `API ${mutation.error.status}: ${mutation.error.message}`
							: "Save failed."}
					</p>
				)}
			</section>

			<section className="flex flex-col gap-2 px-5 py-5 text-xs text-muted-foreground">
				<h2 className="text-xs font-medium text-muted-foreground">Tips</h2>
				<p>
					The playground hits the same retrieval pipeline as the real
					widget — KB articles, embeddings, agent loop, all of it.
				</p>
				<p>
					Conversations created here show up in your inbox like any other.
				</p>
			</section>
		</aside>
	);
}
