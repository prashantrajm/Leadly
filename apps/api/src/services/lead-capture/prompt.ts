// The live-chat side of lead capture: the system-prompt section that tells
// the agent what is still missing and how to collect it.

import type { ContactField, LeadField } from "@leadly/schemas";

export type LeadCaptureConfig = {
	leadCaptureEnabled: boolean;
	contactFields: ContactField[];
	leadFields: LeadField[];
};

export type LeadCaptureState = {
	hasName: boolean;
	hasEmail: boolean;
	hasPhone: boolean;
	// Lead field keys already on file for this conversation or its lead.
	capturedFields: string[];
};

const CONTACT_LABEL: Record<ContactField, string> = {
	name: "name",
	email: "email",
	phone: "phone number",
};

// Appended to the knowledge-base fallback so a gap becomes a hand-off to
// the team instead of a dead end.
export const FALLBACK_HANDOFF =
	"Then offer to take their details so the team can follow up.";

// "  - Budget [budget]: monthly, in USD; a number". The bracketed key is
// what save_lead_details expects.
export function describeField(f: LeadField): string {
	const notes: string[] = [];
	if (f.hint) notes.push(f.hint);
	if (f.type === "number") notes.push("a number");
	if (f.type === "yes_no") notes.push("yes or no");
	if (f.type === "choice" && f.options)
		notes.push(`one of: ${f.options.join(", ")}`);
	return `  - ${f.label} [${f.key}]${notes.length ? `: ${notes.join("; ")}` : ""}`;
}

export function leadCapturePrompt(
	config: LeadCaptureConfig,
	state: LeadCaptureState,
): string | null {
	if (!config.leadCaptureEnabled) return null;

	const have = {
		name: state.hasName,
		email: state.hasEmail,
		phone: state.hasPhone,
	};
	const missingContact = config.contactFields.filter((f) => !have[f]);
	const captured = new Set(state.capturedFields);
	const open = config.leadFields.filter((f) => !captured.has(f.key));
	const toAsk = open.filter((f) => f.mode === "ask");
	const toListen = open.filter((f) => f.mode === "listen");
	if (missingContact.length === 0 && open.length === 0) return null;

	const lines = [
		"Lead capture is on: this visitor may become a customer, and the team wants to follow up.",
	];
	if (missingContact.length > 0 || toAsk.length > 0) {
		lines.push(
			"- Help first. Once you've answered their first question, start collecting the details below.",
			'- Ask for one thing per reply, woven into the conversation, with a short reason ("so the team can send you a quote").',
			"- Never tell the visitor to email, call, or contact the company themselves. Offer to take their details and have the team reach out.",
			"- If they decline, drop it and keep helping. Don't ask for the same thing twice.",
		);
	}
	if (missingContact.length > 0) {
		lines.push(
			`Still needed: ${missingContact.map((f) => CONTACT_LABEL[f]).join(", ")}. ` +
				"Call `capture_contact` as soon as you have an email or phone number.",
		);
	}
	if (toAsk.length > 0) {
		lines.push(
			`Find out, in this order:\n${toAsk.map(describeField).join("\n")}`,
		);
	}
	if (toListen.length > 0) {
		lines.push(
			`Don't ask about these, but note them if the visitor mentions them:\n${toListen
				.map(describeField)
				.join("\n")}`,
		);
	}
	if (open.length > 0) {
		lines.push(
			"When you learn any of these, call `save_lead_details` with the key in brackets and the visitor's answer, in their words. Only record what they actually said.",
		);
	}
	return lines.join("\n");
}
