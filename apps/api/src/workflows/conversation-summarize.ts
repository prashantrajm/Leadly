// ConversationSummarizeWorkflow — fired after a conversation ends or is
// abandoned. Per design §4.2 the model never calls set_conversation_summary
// itself; this workflow runs it deterministically:
//
//   1. load the conversation, its agent's lead config and turns
//   2. generateObject with the request from services/conversation-analysis
//   3. persist through executeSetConversationSummary

import { WorkflowEntrypoint, type WorkflowStep } from "cloudflare:workers";
import type { WorkflowEvent } from "cloudflare:workers";
import type { LeadField } from "@leadly/schemas";
import {
	configureLangSmith,
	flushLangSmithTraces,
	generateObject,
} from "../lib/langsmith";
import { getPrisma } from "../lib/prisma";
import { makeOpenRouterModel } from "../services/agent-loop";
import { resolveCredentialForAgent } from "../services/credential-resolver";
import { asStringRecord } from "../lib/json";
import { buildAnalysisRequest } from "../services/conversation-analysis";
import { parseLeadFields, planExtraction } from "../services/lead-capture";
import {
	executeSetConversationSummary,
	SetConversationSummaryInput,
} from "../services/system-tools";
import type { Bindings } from "../types";

export type ConversationSummarizeParams = { conversationId: string };

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
		configureLangSmith(this.env);

		// Step 1 — load conversation + agent + turns. Turns are bounded by
		// design (per-agent maxTurns default 50) so a single SELECT is fine.
		type Loaded = {
			id: string;
			agentId: string;
			organizationId: string;
			visitorId: string;
			leadDetails: Record<string, string>;
			agent: {
				defaultModel: string;
				leadCaptureEnabled: boolean;
				leadFields: LeadField[];
				captureNotableDetails: boolean;
			};
			turns: Array<{ role: string; text: string; createdAt: Date }>;
		};
		const conv = (await step.do("load-conversation", async () => {
			const row = await prisma.conversation.findUnique({
				where: { id: conversationId },
				include: {
					agent: {
						select: {
							defaultModel: true,
							leadCaptureEnabled: true,
							leadFields: true,
							captureNotableDetails: true,
						},
					},
					turns: {
						orderBy: { createdAt: "asc" },
						select: { role: true, text: true, createdAt: true },
					},
				},
			});
			if (!row) throw new Error(`Conversation ${conversationId} not found`);
			// Json columns are parsed here so the step result is serializable.
			const loaded = row as unknown as Omit<Loaded, "leadDetails" | "agent"> & {
				leadDetails: unknown;
				agent: Omit<Loaded["agent"], "leadFields"> & { leadFields: unknown };
			};
			return {
				...loaded,
				leadDetails: asStringRecord(loaded.leadDetails),
				agent: {
					...loaded.agent,
					leadFields: parseLeadFields(loaded.agent.leadFields),
				},
			} satisfies Loaded;
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
			// Use the same credential the conversation's agent would use for
			// chat — keeps usage consistent in the customer's OpenRouter
			// dashboard and respects per-agent BYOK overrides.
			const resolved = await resolveCredentialForAgent(
				this.env,
				conv.agentId,
				conv.organizationId,
			);
			const model = makeOpenRouterModel(
				resolved.apiKey,
				conv.agent.defaultModel,
			);

			const request = buildAnalysisRequest(
				conv.turns,
				planExtraction(conv.agent, conv.leadDetails),
			);
			const { object } = await generateObject({ model, ...request }).finally(
				() => flushLangSmithTraces(),
			);
			// The per-agent schema narrows the base one, so this only restores
			// the static type.
			return SetConversationSummaryInput.parse(object);
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
					leadFields: conv.agent.leadFields,
					prisma,
				},
				summary,
			);
		});

		return { conversationId, summarized: true };
	}
}
