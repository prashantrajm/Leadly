import { describe, expect, it } from "bun:test";
import { type BubbleEvent, BubbleSplitter, splitLongBubble } from "./bubbles";

// Feed deltas through a splitter and collapse the events into bubbles.
function bubbles(deltas: string[]): string[] {
	const splitter = new BubbleSplitter();
	const events: BubbleEvent[] = [];
	for (const d of deltas) events.push(...splitter.push(d));
	events.push(...splitter.finish());
	const out = [""];
	for (const e of events) {
		if (e.kind === "break") out.push("");
		else out[out.length - 1] += e.delta;
	}
	return out.filter((b) => b.length > 0);
}

describe("BubbleSplitter", () => {
	it("keeps a single message as one bubble", () => {
		expect(bubbles(["Hi there!", " How can I help?"])).toEqual([
			"Hi there! How can I help?",
		]);
	});

	it("splits on blank lines", () => {
		expect(bubbles(["Sure thing.\n\nWhat are you building?"])).toEqual([
			"Sure thing.",
			"What are you building?",
		]);
	});

	it("handles a break split across token boundaries", () => {
		expect(bubbles(["Got it.\n", "\n", "Next one."])).toEqual([
			"Got it.",
			"Next one.",
		]);
		expect(bubbles(["Got it.", "\n", " \n  ", "Next one."])).toEqual([
			"Got it.",
			"Next one.",
		]);
	});

	it("keeps single newlines inside a bubble", () => {
		expect(bubbles(["Steps:\n- one\n- two"])).toEqual(["Steps:\n- one\n- two"]);
	});

	it("ignores leading, trailing and repeated blank lines", () => {
		expect(bubbles(["\n\nHello.\n\n\n\nBye.\n\n"])).toEqual(["Hello.", "Bye."]);
	});

	it("streams text before a pending newline immediately", () => {
		const splitter = new BubbleSplitter();
		expect(splitter.push("Hello\n")).toEqual([
			{ kind: "text", delta: "Hello" },
		]);
		expect(splitter.push("world")).toEqual([
			{ kind: "text", delta: "\nworld" },
		]);
	});
});

describe("splitLongBubble", () => {
	it("leaves short text alone", () => {
		expect(splitLongBubble("Short and sweet.")).toEqual(["Short and sweet."]);
	});

	it("splits a paragraph into chunks of at most two sentences", () => {
		const text =
			"We integrate with Stripe. Setup takes five minutes. You paste one script tag. Then the widget appears on every page.";
		const chunks = splitLongBubble(text, 60);
		expect(chunks.length).toBeGreaterThan(1);
		for (const c of chunks) {
			expect(c.match(/[.!?]/g)?.length ?? 0).toBeLessThanOrEqual(2);
		}
		expect(chunks.join(" ")).toBe(text);
	});

	it("keeps lists intact", () => {
		const list = `Here you go:\n- ${"a".repeat(150)}\n- ${"b".repeat(150)}`;
		expect(splitLongBubble(list)).toEqual([list]);
	});

	it("keeps one very long sentence whole", () => {
		const long = `${"word ".repeat(80).trim()}.`;
		expect(splitLongBubble(long)).toEqual([long]);
	});
});
