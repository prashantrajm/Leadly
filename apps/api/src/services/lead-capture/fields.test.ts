import { describe, expect, it } from "bun:test";
import type { LeadField } from "@leadly/schemas";
import {
	mergeKeyFacts,
	normalizeFieldValue,
	normalizeLeadDetails,
	parseKeyFacts,
	parseLeadFields,
} from "./fields";

const budget: LeadField = {
	key: "budget",
	label: "Budget",
	type: "number",
	mode: "ask",
};
const plan: LeadField = {
	key: "plan",
	label: "Plan",
	type: "choice",
	options: ["Starter", "Pro"],
	mode: "listen",
};
const hasSite: LeadField = {
	key: "has_site",
	label: "Has a website",
	type: "yes_no",
	mode: "listen",
};

describe("parseLeadFields", () => {
	it("keeps valid entries and drops malformed ones", () => {
		expect(
			parseLeadFields([budget, { key: "Bad Key", label: "x" }, null]),
		).toEqual([budget]);
	});

	it("returns [] for non-arrays", () => {
		expect(parseLeadFields(null)).toEqual([]);
		expect(parseLeadFields({})).toEqual([]);
	});
});

describe("normalizeFieldValue", () => {
	it("maps yes/no answers", () => {
		expect(normalizeFieldValue(hasSite, "yeah, a Shopify one")).toBe("Yes");
		expect(normalizeFieldValue(hasSite, "No")).toBe("No");
		expect(normalizeFieldValue(hasSite, "kind of")).toBe("kind of");
	});

	it("snaps a choice to its option's spelling", () => {
		expect(normalizeFieldValue(plan, "pro")).toBe("Pro");
		expect(normalizeFieldValue(plan, "Enterprise")).toBe("Enterprise");
	});

	it("trims and collapses whitespace, null when empty", () => {
		expect(normalizeFieldValue(budget, "  5000   USD ")).toBe("5000 USD");
		expect(normalizeFieldValue(budget, "   ")).toBeNull();
	});
});

describe("normalizeLeadDetails", () => {
	it("accepts keys or labels and reports unknown keys", () => {
		expect(
			normalizeLeadDetails([budget, plan], {
				budget: "2000",
				PLAN: "starter",
				favourite_colour: "blue",
			}),
		).toEqual({
			values: { budget: "2000", plan: "Starter" },
			ignored: ["favourite_colour"],
		});
	});
});

describe("key facts", () => {
	it("parses and drops malformed entries", () => {
		expect(
			parseKeyFacts([{ label: "Budget", value: "5k" }, { label: "" }]),
		).toEqual([{ label: "Budget", value: "5k" }]);
	});

	it("merges by label, newest wins", () => {
		expect(
			mergeKeyFacts(
				[
					{ label: "Budget", value: "5k" },
					{ label: "Timeline", value: "Q1" },
				],
				[{ label: "budget", value: "8k" }],
			),
		).toEqual([
			{ label: "Timeline", value: "Q1" },
			{ label: "budget", value: "8k" },
		]);
	});

	it("keeps the newest when over the cap", () => {
		const facts = [1, 2, 3].map((n) => ({ label: `F${n}`, value: "x" }));
		expect(mergeKeyFacts(facts, [], 2).map((f) => f.label)).toEqual([
			"F2",
			"F3",
		]);
	});
});
