// URL-safe slug for organisation/agent slugs and KB article paths.
// Lowercase, ASCII-only, dashes between word groups, no leading/trailing dashes.
// NFKD-decompose first so accented Latin characters (é → e + ́) lose only the
// combining mark, preserving the base ASCII letter. Non-Latin scripts are
// dropped wholesale — Leadly slugs are handles, not labels, so a Cyrillic or
// CJK input produces an empty slug and the caller should fall back to id.

export function slugify(input: string): string {
	const normalized = input
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase();

	return normalized
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64);
}
