import { describe, expect, it } from "bun:test";
import type { LeadField } from "@leadly/schemas";
import { z } from "zod";
import {
	extractionInstructions,
	extractionSchema,
	planExtraction,
} from "./extraction";

const fields: LeadField[] = [
	{
		key: "budget",
		label: "Budget",
		hint: "monthly, USD",
		type: "text",
		mode: "ask",
	},
	{
		key: "plan",
		label: "Plan",
		type: "choice",
		options: ["Starter", "Pro"],
		mode: "listen",
	},
];
const agent = {
	leadCaptureEnabled: true,
	leadFields: fields,
	captureNotableDetails: true,
};
const base = z.object({ summary: z.string() });

describe("planExtraction", () => {
	it("skips fields the chat already captured", () => {
		const plan = planExtraction(agent, { budget: "$500" });
		expect(plan.fields.map((f) => f.key)).toEqual(["plan"]);
		expect(plan.keyFacts).toBe(true);
	});

	it("extracts nothing when lead capture is off", () => {
		expect(planExtraction({ ...agent, leadCaptureEnabled: false }, {})).toEqual(
			{
				fields: [],
				keyFacts: false,
			},
		);
	});
});

describe("extractionSchema", () => {
	it("limits field keys to the plan", () => {
		const schema = extractionSchema(base, planExtraction(agent, {}));
		expect(
			schema.safeParse({
				summary: "s",
				fields: [{ key: "plan", value: "Pro" }],
			}).success,
		).toBe(true);
		expect(
			schema.safeParse({
				summary: "s",
				fields: [{ key: "colour", value: "red" }],
			}).success,
		).toBe(false);
	});

	it("leaves the base schema alone for an empty plan", () => {
		const schema = extractionSchema(base, { fields: [], keyFacts: false });
		expect(Object.keys(schema.shape)).toEqual(["summary"]);
	});
});

describe("extractionInstructions", () => {
	it("describes fields and key facts, with the no-guessing rule", () => {
		const text = extractionInstructions(planExtraction(agent, {}));
		expect(text).toContain("budget: Budget (monthly, USD)");
		expect(text).toContain("plan: Plan [one of: Starter, Pro]");
		expect(text).toContain("keyFacts: up to 5");
		expect(text).toContain("Never guess or infer.");
	});

	it("is empty when there is nothing to extract", () => {
		expect(extractionInstructions({ fields: [], keyFacts: false })).toBe("");
	});
});
