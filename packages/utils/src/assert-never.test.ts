import { describe, expect, it } from "bun:test";
import { assertNever } from "./assert-never.ts";

describe("assertNever", () => {
	it("throws with the unreachable value embedded in the message", () => {
		// Cast to never — this represents a case the compiler thought was impossible.
		const stray = "unexpected" as never;
		expect(() => assertNever(stray)).toThrow(/unexpected/);
	});

	it("uses the supplied prefix message", () => {
		const stray = 42 as never;
		expect(() => assertNever(stray, "bad enum")).toThrow(/bad enum: 42/);
	});

	it("exhaustive switch compiles", () => {
		type Channel = "chat" | "voice";
		function describe(c: Channel): string {
			switch (c) {
				case "chat":
					return "chat";
				case "voice":
					return "voice";
				default:
					return assertNever(c);
			}
		}
		expect(describe("chat")).toBe("chat");
		expect(describe("voice")).toBe("voice");
	});
});
