// Short-lived signed token for widget visitors. The widget calls
// /api/widget/visitor on first load to upsert a Visitor row and get a
// token; that token then authenticates the WS connect + any other
// visitor-scoped action. We don't use full JWT because we control both
// sides — a 2-segment "payload.sig" format keeps the bytes minimal
// (visitors carry it in localStorage and on every WS reconnect).
//
// Payload binds:
//   • v   — visitor id (Cuid from prisma)
//   • a   — agent id (the visitor's home agent; cross-agent reuse rejected)
//   • exp — unix-seconds expiry (24h from issue)
//
// Sign with HMAC-SHA256 using BETTER_AUTH_SECRET. Reusing the existing
// secret keeps deployment simple — there's exactly one secret to rotate.
// If we later need per-token revocation we can add a `kid` field and a
// KV-backed denylist; not needed for v1.

const TOKEN_TTL_SECONDS = 24 * 60 * 60;

export type WidgetTokenPayload = {
	v: string; // visitorId
	a: string; // agentId
	exp: number;
};

export async function signWidgetToken(
	secret: string,
	payload: { visitorId: string; agentId: string },
	now: () => number = Date.now,
): Promise<string> {
	const body: WidgetTokenPayload = {
		v: payload.visitorId,
		a: payload.agentId,
		exp: Math.floor(now() / 1000) + TOKEN_TTL_SECONDS,
	};
	const encoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify(body)));
	const sig = await hmacSha256(secret, encoded);
	return `${encoded}.${sig}`;
}

export type VerifyResult =
	| { ok: true; payload: WidgetTokenPayload }
	| { ok: false; reason: "malformed" | "bad_signature" | "expired" };

export async function verifyWidgetToken(
	secret: string,
	token: string,
	now: () => number = Date.now,
): Promise<VerifyResult> {
	const parts = token.split(".");
	if (parts.length !== 2) return { ok: false, reason: "malformed" };
	const [encoded, sig] = parts;

	const expected = await hmacSha256(secret, encoded);
	if (!constantTimeEqual(sig, expected)) {
		return { ok: false, reason: "bad_signature" };
	}

	let payload: WidgetTokenPayload;
	try {
		const decoded = new TextDecoder().decode(base64UrlDecode(encoded));
		payload = JSON.parse(decoded) as WidgetTokenPayload;
	} catch {
		return { ok: false, reason: "malformed" };
	}
	if (
		typeof payload.v !== "string" ||
		typeof payload.a !== "string" ||
		typeof payload.exp !== "number"
	) {
		return { ok: false, reason: "malformed" };
	}

	if (Math.floor(now() / 1000) >= payload.exp) {
		return { ok: false, reason: "expired" };
	}
	return { ok: true, payload };
}

// ---------- helpers ----------

async function hmacSha256(secret: string, data: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(data),
	);
	return base64UrlEncode(new Uint8Array(sig));
}

function base64UrlEncode(bytes: Uint8Array): string {
	let bin = "";
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function base64UrlDecode(s: string): Uint8Array {
	const padded = s
		.replace(/-/g, "+")
		.replace(/_/g, "/")
		.padEnd(s.length + ((4 - (s.length % 4)) % 4), "=");
	const bin = atob(padded);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return bytes;
}

// String-comparison short-circuit is fine for HMAC outputs of fixed length —
// timing differences between prefixes give attackers nothing actionable here
// (the secret is uniform, the hash isn't structured). We still do a length
// check + per-char xor to be defensive about future format changes.
function constantTimeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}
