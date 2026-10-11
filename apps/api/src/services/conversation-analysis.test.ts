import { describe, expect, it } from "bun:test";
import {
	buildAnalysisRequest,
	formatTranscript,
} from "./conversation-analysis";

const turns = [
	{ role: "user", text: "We need a booking bot." },
	{ role: "agent", text: "Happy to help!" },
];

describe("buildAnalysisRequest", () => {
	it("formats the transcript by role", () => {
		expect(formatTranscript(turns)).toBe(
			"[USER] We need a booking bot.\n\n[AGENT] Happy to help!",
		);
	});

	it("adds extraction only when the plan asks for it", () => {
		const plain = buildAnalysisRequest(turns, { fields: [], keyFacts: false });
		expect(plain.prompt).not.toContain("keyFacts");
		expect(Object.keys(plain.schema.shape)).not.toContain("keyFacts");

		const withFacts = buildAnalysisRequest(turns, {
			fields: [],
			keyFacts: true,
		});
		expect(withFacts.prompt).toContain("- keyFacts:");
		expect(Object.keys(withFacts.schema.shape)).toContain("keyFacts");
	});
});
