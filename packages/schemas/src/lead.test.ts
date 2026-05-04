import { describe, expect, it } from "bun:test";
import { CaptureLeadSchema, LeadSchema } from "./lead.ts";

describe("CaptureLeadSchema", () => {
	it("accepts email-only", () => {
		const result = CaptureLeadSchema.parse({ email: "a@b.co" });
		expect(result.email).toBe("a@b.co");
	});

	it("accepts phone-only", () => {
		const result = CaptureLeadSchema.parse({ phone: "+1-555-1234" });
		expect(result.phone).toBe("+1-555-1234");
	});

	it("rejects empty input — neither email nor phone", () => {
		expect(() => CaptureLeadSchema.parse({})).toThrow(
			/email or phone is required/,
		);
	});

	it("rejects when only name supplied", () => {
		expect(() => CaptureLeadSchema.parse({ name: "Anon" })).toThrow();
	});

	it("accepts customFields as opaque record", () => {
		const result = CaptureLeadSchema.parse({
			email: "a@b.co",
			customFields: { plan: "pro", seats: 5, vip: true },
		});
		expect(result.customFields).toEqual({ plan: "pro", seats: 5, vip: true });
	});

	it("rejects malformed email", () => {
		expect(() => CaptureLeadSchema.parse({ email: "not-an-email" })).toThrow();
	});
});

describe("LeadSchema", () => {
	it("round-trips a fully populated lead", () => {
		const lead = {
			id: "clx1",
			organizationId: "clx2",
			agentId: "clx3",
			email: "user@example.com",
			phone: "+15551234567",
			name: "Test User",
			customFields: { source: "widget" },
			createdAt: "2026-05-04T15:00:00.000Z",
			updatedAt: "2026-05-04T15:00:00.000Z",
		};
		expect(LeadSchema.parse(lead)).toEqual(lead);
	});

	it("accepts null email/phone/name (anonymous lead)", () => {
		const lead = {
			id: "clx1",
			organizationId: "clx2",
			agentId: "clx3",
			email: null,
			phone: null,
			name: null,
			customFields: {},
			createdAt: "2026-05-04T15:00:00.000Z",
			updatedAt: "2026-05-04T15:00:00.000Z",
		};
		expect(LeadSchema.parse(lead)).toEqual(lead);
	});
});
