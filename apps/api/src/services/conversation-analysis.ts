// The post-chat analysis request: schema, system prompt and prompt for the
// ConversationSummarize workflow's generateObject call. The output feeds
// executeSetConversationSummary, so the base schema is that tool's input.

import {
	type ExtractionPlan,
	extractionInstructions,
	extractionSchema,
} from "./lead-capture";
import { SetConversationSummaryInput } from "./system-tools";

const ANALYSIS_SYSTEM =
	"You summarize and analyze support conversations for the team that owns the website. " +
	"Be concise. Return ONLY the structured fields.";

const ANALYSIS_FIELDS = [
	"- summary: one paragraph.",
	"- sentiment: the visitor's overall sentiment.",
	"- tags: up to 5 short topic tags (lowercase, hyphenated, no punctuation).",
	"- intent: what the visitor came for.",
	"- leadScore: 0-100, how likely the visitor is to become a paying customer (0 = no buying interest, 100 = ready to buy now).",
	"- qualityScore: 1-5, how well the agent handled the chat (accurate, helpful, on-tone; 1 = poor, 5 = excellent).",
	"- resolved: whether the visitor's question was answered.",
	"- need: one line on what the visitor wants (their product idea, use case or problem). Omit if unclear.",
	"- unansweredQuestions: questions the agent couldn't answer.",
	"- objections: concerns that held the visitor back (price, trust, missing feature…).",
	"- nextStep: the one follow-up the team should do. Omit if none.",
].join("\n");

export function formatTranscript(
	turns: Array<{ role: string; text: string }>,
): string {
	return turns.map((t) => `[${t.role.toUpperCase()}] ${t.text}`).join("\n\n");
}

export function buildAnalysisRequest(
	turns: Array<{ role: string; text: string }>,
	plan: ExtractionPlan,
) {
	const extraction = extractionInstructions(plan);
	return {
		schema: extractionSchema(
			SetConversationSummaryInput.omit({ fields: true, keyFacts: true }),
			plan,
		),
		system: ANALYSIS_SYSTEM,
		prompt:
			"Transcript ([USER] is the website visitor, [AGENT] the AI, [HUMAN] a teammate):\n\n" +
			`${formatTranscript(turns)}\n\nFill in:\n${ANALYSIS_FIELDS}` +
			(extraction ? `\n${extraction}` : ""),
	};
}
