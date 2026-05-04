import { describe, expect, it } from "bun:test";
import { estimateTokens, splitMarkdown } from "./chunker";

describe("splitMarkdown", () => {
	it("returns one chunk for a short article with no headings", () => {
		const md = "Just a few lines.\nNo headings here.";
		const chunks = splitMarkdown(md);
		expect(chunks).toHaveLength(1);
		expect(chunks[0].ord).toBe(0);
		expect(chunks[0].text).toContain("Just a few lines");
		expect(chunks[0].tokens).toBeGreaterThan(0);
	});

	it("splits on H2 boundaries", () => {
		const md = [
			"# Top",
			"intro paragraph",
			"",
			"## First",
			"first content",
			"",
			"## Second",
			"second content",
		].join("\n");
		const chunks = splitMarkdown(md);
		expect(chunks).toHaveLength(3);
		expect(chunks[0].text).toContain("intro paragraph");
		expect(chunks[1].text).toContain("First");
		expect(chunks[1].text).toContain("first content");
		expect(chunks[2].text).toContain("Second");
		expect(chunks[2].text).toContain("second content");
		// ord must be monotonic
		expect(chunks.map((c) => c.ord)).toEqual([0, 1, 2]);
	});

	it("does NOT split on ## inside a fenced code block", () => {
		const md = [
			"## Outer Heading",
			"Real heading content",
			"",
			"```bash",
			"## not a heading",
			"echo hi",
			"```",
			"",
			"More content under outer.",
		].join("\n");
		const chunks = splitMarkdown(md);
		expect(chunks).toHaveLength(1);
		expect(chunks[0].text).toContain("## not a heading");
		expect(chunks[0].text).toContain("echo hi");
	});

	it("respects ~~~-style fences too", () => {
		const md = [
			"## A",
			"~~~",
			"## also not a heading",
			"~~~",
			"after fence",
		].join("\n");
		const chunks = splitMarkdown(md);
		expect(chunks).toHaveLength(1);
		expect(chunks[0].text).toContain("## also not a heading");
	});

	it("splits an over-large section on paragraph boundaries", () => {
		// Build a section big enough to exceed HARD_MAX_TOKENS (1200 tokens
		// = ~4800 chars). Use clearly separated paragraphs.
		const para = "x".repeat(800); // ~200 tokens each
		const md =
			"## Big section\n\n" +
			[para, para, para, para, para, para, para].join("\n\n");
		const chunks = splitMarkdown(md);
		expect(chunks.length).toBeGreaterThan(1);
		// Each chunk should fit roughly within the target — we allow some
		// slack for the packer (last paragraph put us over the line).
		for (const c of chunks) {
			expect(c.tokens).toBeLessThanOrEqual(1500);
		}
	});

	it("blank lines INSIDE a code block don't break paragraphs", () => {
		// Build a section big enough to trigger paragraph fallback, with
		// a code block that has blank lines inside it.
		const code = "```js\nfn(a)\n\nfn(b)\n\nfn(c)\n```";
		const big = "## Section\n\n" + "x".repeat(8000) + "\n\n" + code + "\n\nafter";
		const chunks = splitMarkdown(big);
		// The fenced block must end up entirely inside one chunk.
		const withCode = chunks.find((c) => c.text.includes("```js"));
		expect(withCode).toBeDefined();
		expect(withCode?.text).toContain("fn(a)");
		expect(withCode?.text).toContain("fn(b)");
		expect(withCode?.text).toContain("fn(c)");
	});

	it("returns no chunks for a whitespace-only input", () => {
		expect(splitMarkdown("   \n\n\t\n")).toEqual([]);
	});

	it("returns one chunk for an input that's only an empty H2 heading", () => {
		const chunks = splitMarkdown("## \n");
		expect(chunks).toHaveLength(1);
	});

	it("ord is sequential across both H2 splitting and paragraph fallback", () => {
		const big = "x".repeat(6000); // forces paragraph fallback
		const md = [
			"## A",
			"short A",
			"",
			"## B (big)",
			big,
			"",
			big,
			"",
			"## C",
			"short C",
		].join("\n");
		const chunks = splitMarkdown(md);
		expect(chunks.length).toBeGreaterThan(3);
		expect(chunks.map((c) => c.ord)).toEqual(
			Array.from({ length: chunks.length }, (_, i) => i),
		);
	});
});

describe("estimateTokens", () => {
	it("returns at least 1 for any non-empty string", () => {
		expect(estimateTokens("a")).toBe(1);
	});

	it("scales linearly with length (~4 chars/token)", () => {
		expect(estimateTokens("x".repeat(400))).toBe(100);
	});
});
