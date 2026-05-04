import { describe, expect, it } from "bun:test";
import { z } from "@hono/zod-openapi";
import { IsoDate, PaginationQuery, paginatedResponse } from "./common.ts";

describe("IsoDate", () => {
	it("accepts a Z-suffixed ISO string", () => {
		expect(IsoDate.parse("2026-05-04T15:00:00.000Z")).toBe(
			"2026-05-04T15:00:00.000Z",
		);
	});

	it("rejects a date-only string", () => {
		expect(() => IsoDate.parse("2026-05-04")).toThrow();
	});

	it("rejects nonsense", () => {
		expect(() => IsoDate.parse("yesterday")).toThrow();
	});
});

describe("PaginationQuery", () => {
	it("coerces numeric strings to numbers", () => {
		const result = PaginationQuery.parse({ limit: "30" });
		expect(result.limit).toBe(30);
	});

	it("applies the default limit", () => {
		const result = PaginationQuery.parse({});
		expect(result.limit).toBe(20);
	});

	it("rejects limit above max", () => {
		expect(() => PaginationQuery.parse({ limit: "500" })).toThrow();
	});

	it("rejects limit below 1", () => {
		expect(() => PaginationQuery.parse({ limit: "0" })).toThrow();
	});
});

describe("paginatedResponse", () => {
	it("wraps a schema with items + nextCursor", () => {
		const Page = paginatedResponse(z.object({ id: z.string() }));
		const result = Page.parse({
			items: [{ id: "a" }, { id: "b" }],
			nextCursor: "eyJ4Ijoxfg==",
		});
		expect(result.items).toHaveLength(2);
		expect(result.nextCursor).toBe("eyJ4Ijoxfg==");
	});

	it("accepts null nextCursor (last page)", () => {
		const Page = paginatedResponse(z.object({ id: z.string() }));
		const result = Page.parse({ items: [], nextCursor: null });
		expect(result.nextCursor).toBeNull();
	});
});
