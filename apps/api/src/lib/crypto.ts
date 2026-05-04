// AES-256-GCM envelope encryption for BYOK provider keys.
//
// Threat model: an attacker who exfiltrates a Postgres dump should not be
// able to read any plaintext keys without ALSO compromising the worker's
// SECRETS_ENCRYPTION_KEY env (a wrangler secret). So:
//
//   1. The root key (SECRETS_ENCRYPTION_KEY) is the single secret. It's
//      32 bytes after base64-decoding; we derive everything from it.
//   2. Each org gets a distinct KEK (key-encryption-key) via HKDF-SHA256
//      with the org id as salt. So one org's leaked key (or KEK derivation)
//      reveals nothing about another's.
//   3. AES-256-GCM encrypts the actual plaintext. Random 12-byte IV per
//      encrypt; stored alongside ciphertext + auth tag. GCM authenticates
//      the ciphertext, so any tamper attempt fails decryption with a
//      visible exception rather than producing garbage.
//
// We never store the plaintext, never log it, and the API only returns
// `maskedSuffix` (last 4 chars) so the dashboard can render "sk-…AbCd".

const KEY_BITS = 256;
const IV_BYTES = 12;

export type EncryptedBlob = {
	ciphertext: string; // base64
	iv: string; // base64 (12 bytes)
	tag: string; // base64 (16 bytes — GCM auth tag)
};

export type CryptoEnv = { SECRETS_ENCRYPTION_KEY: string };

// ---------- public API ----------

export async function encryptForOrg(
	env: CryptoEnv,
	organizationId: string,
	plaintext: string,
): Promise<EncryptedBlob> {
	const kek = await deriveOrgKek(env, organizationId);
	const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
	const data = new TextEncoder().encode(plaintext);

	// WebCrypto AES-GCM concatenates ciphertext + tag in the output buffer;
	// the tag is the trailing 16 bytes. We split them so the schema can
	// store them in distinct columns (clearer in pg, easier to rotate
	// individual fields if a bug ever requires it).
	const out = new Uint8Array(
		await crypto.subtle.encrypt({ name: "AES-GCM", iv }, kek, data),
	);
	const tagStart = out.length - 16;
	const ciphertext = out.slice(0, tagStart);
	const tag = out.slice(tagStart);

	return {
		ciphertext: b64encode(ciphertext),
		iv: b64encode(iv),
		tag: b64encode(tag),
	};
}

export async function decryptForOrg(
	env: CryptoEnv,
	organizationId: string,
	blob: EncryptedBlob,
): Promise<string> {
	const kek = await deriveOrgKek(env, organizationId);
	const iv = b64decode(blob.iv);
	const ciphertext = b64decode(blob.ciphertext);
	const tag = b64decode(blob.tag);

	// Re-concatenate ciphertext || tag for WebCrypto's verifier.
	const combined = new Uint8Array(ciphertext.length + tag.length);
	combined.set(ciphertext, 0);
	combined.set(tag, ciphertext.length);

	const plain = await crypto.subtle.decrypt(
		{ name: "AES-GCM", iv },
		kek,
		combined,
	);
	return new TextDecoder().decode(plain);
}

// Last 4 chars of the original key, for dashboard display ("sk-…XYZ").
// Always returned by the public API instead of the plaintext.
export function maskedSuffixOf(plaintext: string): string {
	const trimmed = plaintext.trim();
	if (trimmed.length <= 4) return trimmed;
	return trimmed.slice(-4);
}

// ---------- internals ----------

async function deriveOrgKek(
	env: CryptoEnv,
	organizationId: string,
): Promise<CryptoKey> {
	const root = decodeRootKey(env.SECRETS_ENCRYPTION_KEY);
	const baseKey = await crypto.subtle.importKey(
		"raw",
		root,
		{ name: "HKDF" },
		false,
		["deriveKey"],
	);
	return crypto.subtle.deriveKey(
		{
			name: "HKDF",
			hash: "SHA-256",
			// Salt = org id bytes. HKDF docs are clear that salt and info can
			// be public — the per-org separation here is what we need.
			salt: new TextEncoder().encode(organizationId),
			info: new TextEncoder().encode("leadly:byok:v1"),
		},
		baseKey,
		{ name: "AES-GCM", length: KEY_BITS },
		false,
		["encrypt", "decrypt"],
	);
}

// Root key must be 32 raw bytes encoded as base64. Generate with:
//   openssl rand -base64 32
//
// We don't accept arbitrary passphrases — derivation strength would depend
// on the operator's discipline, and a brute-forceable root undoes
// everything else here. The error message points at the right mitigation.
function decodeRootKey(s: string): ArrayBuffer {
	if (!s || s.length === 0) {
		throw new Error(
			"SECRETS_ENCRYPTION_KEY not set — generate one with `openssl rand -base64 32`",
		);
	}
	const trimmed = s.trim().replace(/-/g, "+").replace(/_/g, "/");
	let bytes: Uint8Array;
	try {
		bytes = b64decode(trimmed);
	} catch {
		throw new Error(
			"SECRETS_ENCRYPTION_KEY must be base64 — generate one with `openssl rand -base64 32`",
		);
	}
	if (bytes.length !== 32) {
		throw new Error(
			`SECRETS_ENCRYPTION_KEY decoded to ${bytes.length} bytes; expected 32. ` +
				"Regenerate with `openssl rand -base64 32`.",
		);
	}
	return bytes.buffer as ArrayBuffer;
}

function b64encode(bytes: Uint8Array): string {
	let bin = "";
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin);
}

function b64decode(s: string): Uint8Array {
	const bin = atob(s);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return bytes;
}
