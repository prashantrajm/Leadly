// Pure helpers from invitations.ts — no database.
import { describe, expect, it } from "bun:test";
import { emailMatches, newInviteToken, statusOf } from "./invitations";

const future = new Date(Date.now() + 60_000);
const past = new Date(Date.now() - 60_000);

describe("statusOf", () => {
	it("is pending until used, revoked or expired", () => {
		expect(
			statusOf({ acceptedAt: null, revokedAt: null, expiresAt: future }),
		).toBe("pending");
		expect(
			statusOf({ acceptedAt: new Date(), revokedAt: null, expiresAt: future }),
		).toBe("accepted");
		expect(
			statusOf({ acceptedAt: null, revokedAt: null, expiresAt: past }),
		).toBe("expired");
	});

	it("reports a declined invitation as declined", () => {
		expect(
			statusOf({ acceptedAt: null, revokedAt: null, declinedAt: new Date(), expiresAt: future }),
		).toBe("declined");
	});

	it("treats revoked as final, even if also accepted or expired", () => {
		expect(
			statusOf({
				acceptedAt: new Date(),
				revokedAt: new Date(),
				expiresAt: past,
			}),
		).toBe("revoked");
	});
});

describe("emailMatches", () => {
	it("ignores case and surrounding whitespace", () => {
		expect(emailMatches(" Raj@Example.com ", "raj@example.com")).toBe(true);
	});

	it("rejects a different address", () => {
		expect(emailMatches("raj@example.com", "raj@example.co")).toBe(false);
	});
});

describe("newInviteToken", () => {
	it("is URL-safe and unique", () => {
		const a = newInviteToken();
		const b = newInviteToken();
		expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(a).not.toBe(b);
	});
});
