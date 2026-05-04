import { describe, expect, it } from "bun:test";
import {
	decryptForOrg,
	encryptForOrg,
	maskedSuffixOf,
} from "./crypto";

// Two test root keys, each exactly 32 bytes after base64-decoding. NOT for
// production — they're committed to git and well-known by definition.
// Generate real ones with `openssl rand -base64 32`.
const ROOT = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
const ROOT_OTHER = "c2Vjb25kLXRlc3Qtcm9vdC0zMi1ieXRlcyEhIWRhdGE=";

describe("encryptForOrg / decryptForOrg", () => {
	it("round-trips plaintext for the same org", async () => {
		const env = { SECRETS_ENCRYPTION_KEY: ROOT };
		const blob = await encryptForOrg(env, "org-a", "sk-or-1234567890");
		const back = await decryptForOrg(env, "org-a", blob);
		expect(back).toBe("sk-or-1234567890");
	});

	it("produces different ciphertext on each call (random IV)", async () => {
		const env = { SECRETS_ENCRYPTION_KEY: ROOT };
		const a = await encryptForOrg(env, "org-a", "same-plaintext");
		const b = await encryptForOrg(env, "org-a", "same-plaintext");
		expect(a.ciphertext).not.toBe(b.ciphertext);
		expect(a.iv).not.toBe(b.iv);
	});

	it("isolates orgs — org A's blob can't be decrypted with org B's KEK", async () => {
		const env = { SECRETS_ENCRYPTION_KEY: ROOT };
		const blob = await encryptForOrg(env, "org-a", "secret");
		await expect(decryptForOrg(env, "org-b", blob)).rejects.toThrow();
	});

	it("rejects tampered ciphertext (GCM auth tag)", async () => {
		const env = { SECRETS_ENCRYPTION_KEY: ROOT };
		const blob = await encryptForOrg(env, "org-a", "secret");
		const tampered = {
			...blob,
			// Flip a byte in the ciphertext. base64 chars: any swap will fail
			// auth verification. Use the second char to dodge padding edge cases.
			ciphertext: blob.ciphertext.slice(0, 1) +
				(blob.ciphertext[1] === "A" ? "B" : "A") +
				blob.ciphertext.slice(2),
		};
		await expect(decryptForOrg(env, "org-a", tampered)).rejects.toThrow();
	});

	it("rejects tampered tag", async () => {
		const env = { SECRETS_ENCRYPTION_KEY: ROOT };
		const blob = await encryptForOrg(env, "org-a", "secret");
		const tampered = {
			...blob,
			tag:
				blob.tag.slice(0, 1) +
				(blob.tag[1] === "A" ? "B" : "A") +
				blob.tag.slice(2),
		};
		await expect(decryptForOrg(env, "org-a", tampered)).rejects.toThrow();
	});

	it("rejects ciphertext encrypted with a different root key", async () => {
		const blobUnderA = await encryptForOrg(
			{ SECRETS_ENCRYPTION_KEY: ROOT },
			"org-x",
			"secret",
		);
		await expect(
			decryptForOrg({ SECRETS_ENCRYPTION_KEY: ROOT_OTHER }, "org-x", blobUnderA),
		).rejects.toThrow();
	});

	it("throws on missing root key", async () => {
		await expect(
			encryptForOrg({ SECRETS_ENCRYPTION_KEY: "" }, "org-a", "x"),
		).rejects.toThrow(/SECRETS_ENCRYPTION_KEY/);
	});

	it("throws on wrong-length root key", async () => {
		// 16 bytes encoded base64 = "MTIzNDU2Nzg5YWJjZGVmZw=="
		await expect(
			encryptForOrg(
				{ SECRETS_ENCRYPTION_KEY: "MTIzNDU2Nzg5YWJjZGVmZw==" },
				"org-a",
				"x",
			),
		).rejects.toThrow(/32/);
	});
});

describe("maskedSuffixOf", () => {
	it("returns the last 4 chars of a long key", () => {
		expect(maskedSuffixOf("sk-or-1234567890wxyz")).toBe("wxyz");
	});

	it("returns the whole string if shorter than 4 chars", () => {
		expect(maskedSuffixOf("ab")).toBe("ab");
	});

	it("trims leading/trailing whitespace before masking", () => {
		expect(maskedSuffixOf("   sk-or-1234   ")).toBe("1234");
	});
});
