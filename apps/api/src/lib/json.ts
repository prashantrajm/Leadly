// Narrowing helpers for Prisma Json columns, which read back as unknown.

export function asRecord(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) return {};
	return value as Record<string, unknown>;
}

export function asStringRecord(value: unknown): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(asRecord(value))) {
		if (typeof v === "string") out[k] = v;
	}
	return out;
}
