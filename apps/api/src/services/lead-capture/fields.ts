// Business-defined lead fields. Values are stored as strings keyed by
// LeadField.key, in Conversation.leadDetails (what one chat captured) and
// Lead.customFields (the lead's current values, editable by teammates).

import {
	type KeyFact,
	KeyFactSchema,
	type LeadField,
	LeadFieldSchema,
} from "@leadly/schemas";

export const MAX_LEAD_KEY_FACTS = 20;

// Json columns: keep the valid entries rather than failing on one bad one.
function parseList<T>(
	value: unknown,
	schema: {
		safeParse: (v: unknown) => { success: true; data: T } | { success: false };
	},
): T[] {
	if (!Array.isArray(value)) return [];
	const out: T[] = [];
	for (const item of value) {
		const parsed = schema.safeParse(item);
		if (parsed.success) out.push(parsed.data);
	}
	return out;
}

export function parseLeadFields(value: unknown): LeadField[] {
	return parseList(value, LeadFieldSchema);
}

export function parseKeyFacts(value: unknown): KeyFact[] {
	return parseList(value, KeyFactSchema);
}

const YES = /^(y|yes|yeah|yep|true|sure|correct|of course)\b/i;
const NO = /^(n|no|nope|nah|false)\b/i;

// A value that doesn't fit its type (an off-list choice, "around 5k" for a
// number) is kept as written: a messy answer beats a lost one.
export function normalizeFieldValue(
	field: LeadField,
	raw: string,
): string | null {
	const value = raw.trim().replace(/\s+/g, " ").slice(0, 1000);
	if (!value) return null;
	switch (field.type) {
		case "yes_no":
			if (YES.test(value)) return "Yes";
			if (NO.test(value)) return "No";
			return value;
		case "choice":
			return (
				field.options?.find((o) => o.toLowerCase() === value.toLowerCase()) ??
				value
			);
		case "number":
		case "text":
			return value;
	}
}

// Model output keyed by field key (or label) → stored values. Unknown keys
// are returned so the model can correct itself.
export function normalizeLeadDetails(
	fields: LeadField[],
	input: Record<string, string>,
): { values: Record<string, string>; ignored: string[] } {
	const lookup = new Map<string, LeadField>();
	for (const f of fields) {
		lookup.set(f.key, f);
		lookup.set(f.label.trim().toLowerCase(), f);
	}
	const values: Record<string, string> = {};
	const ignored: string[] = [];
	for (const [key, raw] of Object.entries(input)) {
		const field = lookup.get(key) ?? lookup.get(key.trim().toLowerCase());
		if (!field) {
			ignored.push(key);
			continue;
		}
		const value = normalizeFieldValue(field, raw);
		if (value !== null) values[field.key] = value;
	}
	return { values, ignored };
}

// Newer facts replace older ones with the same label; over the cap, the
// newest are kept.
export function mergeKeyFacts(
	existing: KeyFact[],
	incoming: KeyFact[],
	max = MAX_LEAD_KEY_FACTS,
): KeyFact[] {
	const merged = new Map<string, KeyFact>();
	for (const fact of [...existing, ...incoming]) {
		const id = fact.label.trim().toLowerCase();
		merged.delete(id);
		merged.set(id, fact);
	}
	return [...merged.values()].slice(-max);
}
