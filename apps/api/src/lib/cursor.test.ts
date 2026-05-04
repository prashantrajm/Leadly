import { describe, expect, it } from "bun:test";
import { decodeCursor, encodeCursor } from "./cursor";

describe("cursor", () => {
	it("round-trips", () => {
		const c = { createdAt: "2026-05-04T15:00:00.000Z", id: "clx1" };
		expect(decodeCursor(encodeCursor(c))).toEqual(c);
	});

	it("output is URL-safe (no +, /, or = padding)", () => {
		const enc = encodeCursor({ createdAt: "2026-05-04T15:00:00.000Z", id: "x" });
		expect(enc).not.toContain("+");
		expect(enc).not.toContain("/");
		expect(enc).not.toContain("=");
	});

	it("rejects malformed cursor", () => {
		expect(() => decodeCursor("not-a-valid-cursor")).toThrow();
	});

	it("rejects a cursor missing required fields", () => {
		const bad = encodeCursor({ createdAt: "x" } as unknown as {
			createdAt: string;
			id: string;
		});
		expect(() => decodeCursor(bad)).toThrow();
	});

	it("survives identical createdAt by stable id break", () => {
		const a = { createdAt: "2026-05-04T15:00:00.000Z", id: "a" };
		const b = { createdAt: "2026-05-04T15:00:00.000Z", id: "b" };
		expect(encodeCursor(a)).not.toEqual(encodeCursor(b));
	});
});
