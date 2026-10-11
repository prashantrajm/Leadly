import { LeadFieldSchema } from "@leadly/schemas";
import { describe, expect, it } from "vitest";
import { LEAD_FIELD_TEMPLATES } from "./lead-field-templates";
import {
	addTemplate,
	cleanLeadFields,
	customFieldsPatch,
	fieldKey,
	fieldValues,
	labeledValues,
} from "./lead-fields";

describe("fieldKey", () => {
	it("snake-cases the label", () => {
		expect(fieldKey("Budget (USD)", [])).toBe("budget_usd");
		expect(fieldKey("  Move-in date ", [])).toBe("move_in_date");
	});

	it("starts with a letter", () => {
		expect(fieldKey("2nd phone", [])).toBe("f_2nd_phone");
	});

	it("is unique among taken keys", () => {
		expect(fieldKey("Budget", ["budget", "budget_2"])).toBe("budget_3");
	});

	it("is empty for a label with no letters or digits", () => {
		expect(fieldKey("???", [])).toBe("");
	});
});

describe("cleanLeadFields", () => {
	it("drops options off non-choice fields and blank hints", () => {
		expect(
			cleanLeadFields([
				{
					key: "budget",
					label: " Budget ",
					hint: "  ",
					type: "text",
					options: ["a", "b"],
					mode: "ask",
				},
			]),
		).toEqual([{ key: "budget", label: "Budget", type: "text", mode: "ask" }]);
	});

	it("trims choice options and removes blanks", () => {
		expect(
			cleanLeadFields([
				{
					key: "plan",
					label: "Plan",
					type: "choice",
					options: [" Pro ", "", "Starter"],
					mode: "listen",
				},
			])[0].options,
		).toEqual(["Pro", "Starter"]);
	});
});

describe("templates", () => {
	it("are all valid fields", () => {
		for (const t of LEAD_FIELD_TEMPLATES) {
			for (const f of t.fields)
				expect(LeadFieldSchema.safeParse(f).success).toBe(true);
		}
	});

	it("skip keys already present and respect the cap", () => {
		const software = LEAD_FIELD_TEMPLATES[0].fields;
		const merged = addTemplate([software[0]], software, 3);
		expect(merged.map((f) => f.key)).toEqual([
			"project",
			"timeline",
			"team_size",
		]);
	});
});

describe("labeledValues", () => {
	it("orders by field, then shows leftovers under their raw key", () => {
		expect(
			labeledValues(
				[
					{ key: "budget", label: "Budget", type: "text", mode: "ask" },
					{ key: "timeline", label: "Timeline", type: "text", mode: "ask" },
				],
				{ legacy: "x", timeline: "Q1", budget: "5k", empty: "" },
			),
		).toEqual([
			{ key: "budget", label: "Budget", value: "5k" },
			{ key: "timeline", label: "Timeline", value: "Q1" },
			{ key: "legacy", label: "legacy", value: "x" },
		]);
	});
});

describe("editing values", () => {
	const budget = {
		key: "budget",
		label: "Budget",
		type: "text",
		mode: "ask",
	} as const;

	it("starts from the lead's values as strings", () => {
		expect(fieldValues([budget], { budget: 500 })).toEqual({ budget: "500" });
		expect(fieldValues([budget], {})).toEqual({ budget: "" });
	});

	it("sends only changed keys, null for cleared ones", () => {
		expect(
			customFieldsPatch(
				{ budget: "5k", legacy: "x", timeline: "Q1" },
				{ budget: " 8k ", timeline: "  ", legacy: "x" },
			),
		).toEqual({ budget: "8k", timeline: null });
	});
});
