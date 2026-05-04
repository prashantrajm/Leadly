// Opaque cursor for stable cursor-based pagination on time-ordered lists.
// Encodes (createdAt, id) so paging is correct even when many rows share
// the exact same createdAt (id breaks the tie). The cursor itself is
// base64'd JSON so clients treat it as opaque — we keep the freedom to
// extend the shape without bumping a public format.

export type Cursor = { createdAt: string; id: string };

export function encodeCursor(c: Cursor): string {
	return base64UrlEncode(JSON.stringify(c));
}

export function decodeCursor(raw: string): Cursor {
	const json = base64UrlDecode(raw);
	const parsed = JSON.parse(json) as Cursor;
	if (
		typeof parsed.createdAt !== "string" ||
		typeof parsed.id !== "string"
	) {
		throw new Error("Invalid cursor payload");
	}
	return parsed;
}

// Tiny base64url helpers — Workers ships atob/btoa but they only handle
// standard base64. URL-safe characters keep the cursor friendly to query
// strings without encodeURIComponent overhead.
function base64UrlEncode(s: string): string {
	const b64 = btoa(s);
	return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): string {
	const padded = s
		.replace(/-/g, "+")
		.replace(/_/g, "/")
		.padEnd(s.length + ((4 - (s.length % 4)) % 4), "=");
	return atob(padded);
}
