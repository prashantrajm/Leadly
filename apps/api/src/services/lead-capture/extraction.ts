// The post-chat side of lead capture: what the summarize workflow asks the
// model to extract (lead field values the chat answered but the agent
// didn't save live, and notable key facts), and the output shape for it.

import type { LeadField } from "@leadly/schemas";
import { z } from "zod";

export const MAX_EXTRACTED_KEY_FACTS = 5;

export const ExtractedFieldsInput = z
	.array(
		z.object({ key: z.string().min(1).max(200), value: z.string().max(1000) }),
	)
	.max(15);

export const ExtractedKeyFactsInput = z
	.array(
		z.object({
			label: z.string().trim().min(1).max(60),
			value: z.string().trim().min(1).max(300),
		}),
	)
	.max(MAX_EXTRACTED_KEY_FACTS);

export type ExtractionPlan = {
	// Fields still empty after the chat; the output schema narrows keys to these.
	fields: LeadField[];
	keyFacts: boolean;
};

export function planExtraction(
	agent: {
		leadCaptureEnabled: boolean;
		leadFields: LeadField[];
		captureNotableDetails: boolean;
	},
	captured: Record<string, string>,
): ExtractionPlan {
	if (!agent.leadCaptureEnabled) return { fields: [], keyFacts: false };
	return {
		fields: agent.leadFields.filter((f) => captured[f.key] === undefined),
		keyFacts: agent.captureNotableDetails,
	};
}

// Extends the base summary schema with this plan's extraction fields.
export function extractionSchema<T extends z.ZodRawShape>(
	base: z.ZodObject<T>,
	plan: ExtractionPlan,
) {
	const keys = plan.fields.map((f) => f.key);
	const [first, ...rest] = keys;
	return base.extend({
		...(first && {
			fields: z
				.array(
					z.object({
						key: z.enum([first, ...rest]),
						value: z.string().max(1000),
					}),
				)
				.max(keys.length)
				.optional(),
		}),
		...(plan.keyFacts && { keyFacts: ExtractedKeyFactsInput.optional() }),
	});
}

export function extractionInstructions(plan: ExtractionPlan): string {
	const lines: string[] = [];
	if (plan.fields.length > 0) {
		lines.push(
			"- fields: values for these lead fields, only where the visitor clearly stated them (key: meaning):",
			...plan.fields.map(
				(f) =>
					`    ${f.key}: ${f.label}${f.hint ? ` (${f.hint})` : ""}` +
					(f.type === "choice" && f.options
						? ` [one of: ${f.options.join(", ")}]`
						: ""),
			),
		);
	}
	if (plan.keyFacts) {
		lines.push(
			`- keyFacts: up to ${MAX_EXTRACTED_KEY_FACTS} other details the sales team would want before following up ` +
				"(budget, deadline, team size, decision-maker, current tool, special requirements…), as a short label and value. " +
				"Skip contact info and anything already covered above. Empty if nothing stands out.",
		);
	}
	if (lines.length > 0) {
		lines.push(
			"For fields and keyFacts, only use what the visitor actually said. Never guess or infer.",
		);
	}
	return lines.join("\n");
}
