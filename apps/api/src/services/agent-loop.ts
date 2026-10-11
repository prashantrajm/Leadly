// Agent loop primitives. Pure functions that the Durable Object (Phase 7)
// composes into the per-turn execution path:
//
//   1.  receive user message
//   2.  embed + retrieve top-k chunks
//   3.  assembleSystemPrompt({ agent, retrievedChunks, identityState })
//   4.  runTurn({ model, system, history, tools, onToken, onToolCall })
//   5.  persist agent turn (DO concern, not ours)
//
// This module deliberately knows nothing about the DO, the WS, or Postgres
// writes. That isolation is what lets us test the prompt assembly with
// snapshot tests and runTurn with the AI SDK's MockLanguageModelV3.

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
	type LanguageModel,
	type ToolSet,
} from "ai";
import { flushLangSmithTraces, streamText } from "../lib/langsmith";
import type { RetrievedChunk } from "../lib/retrieval";
import {
	FALLBACK_HANDOFF,
	type LeadCaptureConfig,
	leadCapturePrompt,
} from "./lead-capture";
import { NATURAL_MESSAGING_PROMPT } from "./natural-messaging";

// ---------- types ----------

export type AgentRow = LeadCaptureConfig & {
	id: string;
	name: string;
	greeting: string;
	systemPromptOverlay: string | null;
	fallbackMessage: string;
	defaultModel: string;
	identityPolicy: "optional" | "required_before_chat" | "identified_only";
	naturalMessaging: boolean;
};

export type IdentityState = {
	// What we know about the visitor right now. The agent's prompt nudges
	// for whichever fields are still null when policy demands it.
	hasEmail: boolean;
	hasPhone: boolean;
	hasName: boolean;
	// Lead field keys already on file for this conversation or its lead.
	capturedFields?: string[];
};

export type ConversationMessage =
	| { role: "user"; content: string }
	| { role: "assistant"; content: string };

// ---------- history ----------

// Turn rows → model history. Natural messaging stores one agent row per
// bubble; consecutive ones fold back into a single assistant message,
// joined by the same blank line the model used to separate them.
export function buildHistory(
	turns: Array<{ role: string; text: string }>,
): ConversationMessage[] {
	const history: ConversationMessage[] = [];
	for (const t of turns) {
		if (t.role !== "user" && t.role !== "agent") continue;
		const role = t.role === "user" ? "user" : "assistant";
		const last = history[history.length - 1];
		if (role === "assistant" && last?.role === "assistant") {
			last.content = `${last.content}\n\n${t.text}`;
			continue;
		}
		history.push({ role, content: t.text });
	}
	return history;
}

// ---------- system prompt ----------

export type AssembleArgs = {
	agent: AgentRow;
	retrievedChunks: RetrievedChunk[];
	identity: IdentityState;
};

export function assembleSystemPrompt({
	agent,
	retrievedChunks,
	identity,
}: AssembleArgs): string {
	const sections: string[] = [];

	// Base persona — tight, deterministic, no placeholders the LLM can drift on.
	sections.push(
		`You are the support agent for "${agent.name}".\n` +
			`Be concise, direct, and helpful. Match the visitor's tone but stay professional.\n` +
			`Greeting on first turn: "${agent.greeting}".`,
	);

	if (agent.naturalMessaging) sections.push(NATURAL_MESSAGING_PROMPT);

	// Customer overlay — appended verbatim so the customer can override or
	// extend the base persona. Empty / null is fine.
	if (agent.systemPromptOverlay && agent.systemPromptOverlay.trim().length > 0) {
		sections.push(`Custom instructions:\n${agent.systemPromptOverlay.trim()}`);
	}

	// Identity capture — only included when policy demands it AND something
	// is still missing. Keeps the prompt out of the way for anonymous chats.
	const idCapture = identityCaptureBlock(agent.identityPolicy, identity);
	if (idCapture) sections.push(idCapture);

	const leadCapture = leadCapturePrompt(agent, {
		...identity,
		capturedFields: identity.capturedFields ?? [],
	});
	if (leadCapture) sections.push(leadCapture);

	// Retrieved context. Empty array is meaningful: the agent should fall back
	// to fallbackMessage rather than hallucinating.
	sections.push(
		retrievedBlock(
			retrievedChunks,
			agent.fallbackMessage,
			agent.leadCaptureEnabled,
		),
	);

	// Tool-use guidance. Without this the model might describe an action in
	// prose instead of calling the tool.
	sections.push(
		`When you have enough information to identify the visitor, call ` +
			`\`capture_contact\`. When the visitor tells you something about ` +
			`their needs (what they're building, team size, budget, timeline), ` +
			`call \`save_lead_details\`. When the visitor explicitly asks for a ` +
			`human or you can't help, call \`request_handoff\` with a short reason.`,
	);

	return sections.join("\n\n");
}

function identityCaptureBlock(
	policy: AgentRow["identityPolicy"],
	id: IdentityState,
): string | null {
	if (policy === "optional") return null;

	const missing: string[] = [];
	if (!id.hasEmail) missing.push("email");
	if (!id.hasName) missing.push("name");
	// We treat phone as a substitute for email — only ask if neither is set.
	if (!id.hasEmail && !id.hasPhone) {
		// already covered by 'email' above; nothing extra to add here.
	}
	if (missing.length === 0) return null;

	if (policy === "required_before_chat") {
		return (
			`The visitor must provide ${missing.join(" and ")} before you help with anything else. ` +
			`Ask once, naturally; if they refuse twice, end the conversation politely.`
		);
	}

	// identified_only — already gated upstream; this branch is defensive.
	return `Do not respond substantively until the visitor provides ${missing.join(" and ")}.`;
}

function retrievedBlock(
	chunks: RetrievedChunk[],
	fallback: string,
	leadCaptureEnabled: boolean,
): string {
	const afterFallback = leadCaptureEnabled ? ` ${FALLBACK_HANDOFF}` : "";
	if (chunks.length === 0) {
		return (
			`Knowledge base context: (none retrieved for this query). ` +
			`If the visitor asks something the KB doesn't cover, reply: "${fallback}"` +
			afterFallback
		);
	}
	const body = chunks
		.map(
			(c, i) =>
				`[${i + 1}] From: ${c.articleTitle}\n${c.text.trim()}`,
		)
		.join("\n\n---\n\n");
	return (
		`Knowledge base context (cite by article title when relevant):\n\n${body}\n\n` +
			`If the visitor asks something not covered above, say: "${fallback}"` +
			afterFallback
	);
}

// ---------- runTurn ----------

export type RunTurnArgs = {
	model: LanguageModel;
	system: string;
	history: ConversationMessage[];
	userMessage: string;
	tools?: ToolSet;
	maxTurns?: number;
	onToken?: (delta: string) => void;
	abortSignal?: AbortSignal;
};

export type RunTurnResult = {
	text: string;
	finishReason: string;
	tokensIn?: number;
	tokensOut?: number;
};

// Run a single agent turn against a LanguageModel. The caller supplies the
// model — production wiring uses OpenRouter (see makeOpenRouterModel below);
// tests use MockLanguageModelV3.
//
// Tool execution lives outside this function: the AI SDK invokes registered
// tools as part of streamText, but the *post-execution side-effects* (like
// flipping conversation.mode = paused on request_handoff) belong to the DO.
// Tools registered here just need to return a JSON-serializable result.
export async function runTurn(args: RunTurnArgs): Promise<RunTurnResult> {
	const messages = [
		...args.history.map((m) => ({ role: m.role, content: m.content })),
		{ role: "user" as const, content: args.userMessage },
	];

	const result = streamText({
		model: args.model,
		system: args.system,
		messages,
		tools: args.tools,
		abortSignal: args.abortSignal,
	});

	let text = "";
	try {
		for await (const delta of result.textStream) {
			text += delta;
			args.onToken?.(delta);
		}

		const usage = await result.usage;
		const finishReason = await result.finishReason;

		return {
			text,
			finishReason,
			tokensIn: usage?.inputTokens,
			tokensOut: usage?.outputTokens,
		};
	} finally {
		await flushLangSmithTraces();
	}
}

// ---------- model factory ----------

// Production helper that gives the DO a LanguageModel bound to OpenRouter
// using the agent's chosen model id. Tests skip this and pass a mock model
// directly to runTurn, so this fn is a one-liner for clarity.
export function makeOpenRouterModel(
	apiKey: string,
	modelId: string,
): LanguageModel {
	const provider = createOpenRouter({ apiKey });
	return provider(modelId);
}
