import type { LeadField } from "@leadly/schemas";

// Lead field helpers: building definitions in agent settings, and showing
// and editing captured values (leads list, lead drawer, inbox).

export const LEAD_FIELD_TYPE_LABEL: Record<LeadField["type"], string> = {
	text: "Text",
	number: "Number",
	yes_no: "Yes / no",
	choice: "Choice",
};

// Storage key from a label: "Budget (USD)" → "budget_usd". Must match the
// schema's /^[a-z][a-z0-9_]{0,39}$/, and be unique among `taken`.
export function fieldKey(label: string, taken: Iterable<string>): string {
	let base = label
		.normalize("NFKD")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.slice(0, 36);
	if (!base) return "";
	if (!/^[a-z]/.test(base)) base = `f_${base}`.slice(0, 36);
	const used = new Set(taken);
	let key = base;
	for (let n = 2; used.has(key); n++) key = `${base}_${n}`;
	return key;
}

// Tidy a field list before saving: trimmed text, options only on choice
// fields, no empty hint.
export function cleanLeadFields(fields: LeadField[]): LeadField[] {
	return fields.map((f) => {
		const hint = f.hint?.trim();
		const options =
			f.type === "choice"
				? (f.options ?? []).map((o) => o.trim()).filter(Boolean)
				: undefined;
		return {
			key: f.key,
			label: f.label.trim(),
			type: f.type,
			mode: f.mode,
			...(hint ? { hint } : {}),
			...(options ? { options } : {}),
		};
	});
}

// Add a template's fields to a list, skipping keys that are already there.
export function addTemplate(
	fields: LeadField[],
	template: LeadField[],
	max: number,
): LeadField[] {
	const keys = new Set(fields.map((f) => f.key));
	const next = [...fields];
	for (const f of template) {
		if (next.length >= max) break;
		if (!keys.has(f.key)) next.push(f);
	}
	return next;
}

// Lead.customFields is free-form JSON; values are normally strings.
export function displayValue(value: unknown): string {
	if (value === null || value === undefined) return "";
	return typeof value === "string" ? value : JSON.stringify(value);
}

// Captured values for display: configured fields first, in their order
// and with their labels, then anything stored under a key no field has
// any more (a removed field, older data) under the raw key.
export function labeledValues(
	fields: LeadField[],
	values: Record<string, unknown>,
): Array<{ key: string; label: string; value: string }> {
	const present = (v: unknown) => v !== null && v !== undefined && v !== "";
	const out: Array<{ key: string; label: string; value: string }> = [];
	const known = new Set<string>();
	for (const f of fields) {
		known.add(f.key);
		if (present(values[f.key])) {
			out.push({
				key: f.key,
				label: f.label,
				value: displayValue(values[f.key]),
			});
		}
	}
	for (const [key, v] of Object.entries(values)) {
		if (!known.has(key) && present(v))
			out.push({ key, label: key, value: displayValue(v) });
	}
	return out;
}

// Edited values → a customFields merge patch: only changed keys, with
// null for a cleared value.
export function customFieldsPatch(
	current: Record<string, unknown>,
	edits: Record<string, string>,
): Record<string, string | null> {
	const patch: Record<string, string | null> = {};
	for (const [key, raw] of Object.entries(edits)) {
		const value = raw.trim();
		if (value === displayValue(current[key])) continue;
		patch[key] = value || null;
	}
	return patch;
}

// Initial edit state: the lead's string values for the given fields.
export function fieldValues(
	fields: LeadField[],
	customFields: Record<string, unknown>,
): Record<string, string> {
	const out: Record<string, string> = {};
	for (const f of fields) {
		out[f.key] = displayValue(customFields[f.key]);
	}
	return out;
}
