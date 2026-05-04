import { describe, expect, it } from "bun:test";
import { slugify } from "./slugify.ts";

describe("slugify", () => {
	it("lowercases and replaces spaces with dashes", () => {
		expect(slugify("Hello World")).toBe("hello-world");
	});

	it("collapses runs of non-ASCII / punctuation into single dashes", () => {
		expect(slugify("foo  ---  bar!!!")).toBe("foo-bar");
	});

	it("strips leading and trailing dashes", () => {
		expect(slugify("---foo---")).toBe("foo");
	});

	it("strips combining diacritics, leaving the base ASCII letter", () => {
		// NFKD decomposes é into e + ́; the combining mark is stripped.
		expect(slugify("café")).toBe("cafe");
		expect(slugify("naïve")).toBe("naive");
		expect(slugify("Zürich")).toBe("zurich");
	});

	it("returns empty string for input with no slug-able chars", () => {
		expect(slugify("!!!")).toBe("");
		expect(slugify("")).toBe("");
	});

	it("caps length at 64 chars", () => {
		const long = "a".repeat(200);
		expect(slugify(long).length).toBe(64);
	});

	it("preserves digits", () => {
		expect(slugify("Acme Corp 2026")).toBe("acme-corp-2026");
	});
});
