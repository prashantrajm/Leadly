import { describe, expect, it } from "bun:test";
import {
	CreateOrganizationSchema,
	isReservedOrgSlug,
	UpdateOrganizationSchema,
} from "./org.ts";

describe("UpdateOrganizationSchema slug", () => {
	it("accepts an ordinary slug", () => {
		expect(UpdateOrganizationSchema.safeParse({ slug: "acme-inc" }).success).toBe(true);
	});

	it("rejects a slug that collides with a top-level page", () => {
		for (const slug of ["pricing", "docs", "dashboard", "auth"]) {
			expect(UpdateOrganizationSchema.safeParse({ slug }).success).toBe(false);
		}
	});

	it("still allows a reserved word as a prefix", () => {
		expect(isReservedOrgSlug("pricing-team")).toBe(false);
		expect(UpdateOrganizationSchema.safeParse({ slug: "pricing-team" }).success).toBe(true);
	});
});

describe("CreateOrganizationSchema", () => {
	it("accepts a name without a slug", () => {
		expect(CreateOrganizationSchema.safeParse({ name: "Acme" }).success).toBe(true);
	});

	it("rejects malformed and reserved slugs", () => {
		for (const slug of ["Acme", "-acme", "acme-", "a--b", "a", "docs"]) {
			expect(CreateOrganizationSchema.safeParse({ name: "Acme", slug }).success).toBe(false);
		}
	});
});
