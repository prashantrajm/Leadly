import { describe, expect, it } from "vitest";
import { postAuthPath } from "./dashboard-entry";

describe("postAuthPath", () => {
	it.each([
		["/acme/inbox", "/acme/inbox"],
		["/dashboard/leads?agent=a1", "/dashboard/leads?agent=a1"],
		[undefined, "/dashboard"],
		["", "/dashboard"],
		["acme/inbox", "/dashboard"],
		["//evil.com", "/dashboard"],
		["/\\evil.com", "/dashboard"],
		["https://evil.com", "/dashboard"],
		["/auth", "/dashboard"],
		[42, "/dashboard"],
	])("%j → %s", (input, expected) => {
		expect(postAuthPath(input)).toBe(expected);
	});
});
