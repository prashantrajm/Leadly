import { describe, expect, it } from "bun:test";
import { signWidgetToken, verifyWidgetToken } from "./widget-token";

const SECRET = "test-secret-do-not-use-in-prod";

describe("widget token", () => {
	it("round-trips a freshly signed token", async () => {
		const tok = await signWidgetToken(SECRET, {
			visitorId: "v1",
			agentId: "a1",
		});
		const r = await verifyWidgetToken(SECRET, tok);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.payload.v).toBe("v1");
			expect(r.payload.a).toBe("a1");
		}
	});

	it("rejects a malformed token (no dot)", async () => {
		const r = await verifyWidgetToken(SECRET, "abcdef");
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.reason).toBe("malformed");
	});

	it("rejects a tampered payload", async () => {
		const tok = await signWidgetToken(SECRET, { visitorId: "v1", agentId: "a1" });
		const [, sig] = tok.split(".");
		// Forge a different payload for the same signature.
		const forged = `eyJ2IjoiZXZpbCIsImEiOiJhMSIsImV4cCI6OTk5OTk5OTk5OX0.${sig}`;
		const r = await verifyWidgetToken(SECRET, forged);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.reason).toBe("bad_signature");
	});

	it("rejects a token signed with a different secret", async () => {
		const tok = await signWidgetToken("other-secret", {
			visitorId: "v1",
			agentId: "a1",
		});
		const r = await verifyWidgetToken(SECRET, tok);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.reason).toBe("bad_signature");
	});

	it("rejects an expired token", async () => {
		// Issue at t=0 (Jan 1 1970), verify at "now" — expiry is 24h after issue.
		const issuedAtZero = await signWidgetToken(
			SECRET,
			{ visitorId: "v1", agentId: "a1" },
			() => 0,
		);
		const r = await verifyWidgetToken(SECRET, issuedAtZero);
		expect(r.ok).toBe(false);
		if (!r.ok) expect(r.reason).toBe("expired");
	});

	it("accepts tokens whose expiry is exactly at the wire (24h boundary)", async () => {
		// Issue at t=0, verify just under the 24h window.
		const issued = await signWidgetToken(
			SECRET,
			{ visitorId: "v1", agentId: "a1" },
			() => 0,
		);
		// 23h59m later in milliseconds.
		const r = await verifyWidgetToken(
			SECRET,
			issued,
			() => (24 * 60 * 60 - 60) * 1000,
		);
		expect(r.ok).toBe(true);
	});
});
