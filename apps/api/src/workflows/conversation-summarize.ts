// ConversationSummarizeWorkflow — fired deterministically after a
// conversation is marked `ended`. Loads the full turn history, asks the
// LLM for a one-paragraph summary plus a sentiment label and a few tags,
// and persists via the same executor the agent's set_conversation_summary
// tool uses (services/system-tools.ts).
//
// Per design §4.2 we don't trust the model to invoke the summary tool
// itself — so we expose set_conversation_summary as a deterministic
// post-end call instead. That's what this workflow is.
//
// Steps:
//   1. load conversation + turns
//   2. generateObject({ schema: SummarySchema, prompt }) via OpenRouter
//   3. write summary/sentiment/tags atomically

import { WorkflowEntrypoint, type WorkflowStep } from "cloudflare:workers";
import type { WorkflowEvent } from "cloudflare:workers";
import { generateObject } from "ai";
import { z } from "zod";
import { getPrisma } from "../lib/prisma";
import { makeOpenRouterModel } from "../services/agent-loop";
import {
	executeSetConversationSummary,
	SetConversationSummaryInput,
} from "../services/system-tools";
import type { Bindings } from "../types";

export type ConversationSummarizeParams = { conversationId: string };

// We re-use the system-tool's input schema so the wire shape and the
// "what the model is allowed to emit" stay in lockstep.
const SummaryOutput = SetConversationSummaryInput;

export class ConversationSummarizeWorkflow extends WorkflowEntrypoint<
	Bindings,
	ConversationSummarizeParams
> {
	async run(
		event: WorkflowEvent<ConversationSummarizeParams>,
		step: WorkflowStep,
	) {
		const { conversationId } = event.payload;
		const prisma = getPrisma(this.env.DATABASE_URL);

		// Step 1 — load conversation + agent + turns. Turns are bounded by
		// design (per-agent maxTurns default 50) so a single SELECT is fine.
		type Loaded = {
			id: string;
			agentId: string;
			organizationId: string;
			visitorId: string;
			agent: { defaultModel: string };
			turns: Array<{ role: string; text: string; createdAt: Date }>;
		};
		const conv = (await step.do("load-conversation", async () => {
			const row = await prisma.conversation.findUnique({
				where: { id: conversationId },
				include: {
					agent: { select: { defaultModel: true } },
					turns: {
						orderBy: { createdAt: "asc" },
						select: { role: true, text: true, createdAt: true },
					},
				},
			});
			if (!row) throw new Error(`Conversation ${conversationId} not found`);
			return row as unknown as Loaded;
		})) as Loaded;

		if (conv.turns.length === 0) {
			// No turns means nothing to summarize — leave the row's summary
			// null so the inbox UI can render "(no messages)" deterministically.
			return { conversationId, skipped: true };
		}

		// Step 2 — ask the LLM. generateObject returns a typed value the
		// schema accepts; we don't have to parse / validate the response
		// ourselves because the AI SDK round-trips through the schema for us.
		const summary = await step.do("generate-summary", async () => {
			const transcript = conv.turns
				.map((t) => `[${t.role.toUpperCase()}] ${t.text}`)
				.join("\n\n");

			const model = makeOpenRouterModel(
				this.env.OPENROUTER_API_KEY,
				conv.agent.defaultModel,
			);

			const { object } = await generateObject({
				model,
				schema: SummaryOutput,
				system:
					"You summarize support conversations. Be concise. " +
					"Return ONLY the structured fields.",
				prompt:
					"Transcript:\n\n" +
					transcript +
					"\n\nWrite a one-paragraph summary, infer the visitor's overall " +
					"sentiment, and pick up to 5 short topic tags (lowercase, " +
					"hyphenated, no punctuation).",
			});

			// generateObject already validated against SummaryOutput, but the
			// summary length is enforced with .min(2).max(2000) so a model
			// returning whitespace would have already thrown above.
			return object;
		});

		// Step 3 — persist via the system tool's executor so the durable
		// write goes through one canonical path.
		await step.do("persist-summary", async () => {
			await executeSetConversationSummary(
				{
					conversationId,
					agentId: conv.agentId,
					organizationId: conv.organizationId,
					visitorId: conv.visitorId,
					prisma,
				},
				summary,
			);
		});

		return { conversationId, summarized: true };
	}
}

// Inputs schema is re-exported for unit tests if Phase 12 adds them.
void z;
