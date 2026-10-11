// Lead field writes. Merges run as a single JSONB `||` in Postgres, so
// parallel tool calls in one step (or a tool call racing the post-chat
// workflow) can't drop each other's values the way read-modify-write would.
//
//   overwrite — incoming values win (the visitor just told us)
//   fill      — existing values win (post-chat extraction fills gaps only,
//               never overriding a live capture or a teammate's edit)

import type { ExtendedPrismaClient } from "../../lib/prisma";

export type MergeMode = "overwrite" | "fill";

// Plain parameters only: nested Prisma.sql fragments aren't expanded through
// the Accelerate client and would be bound as JSON values instead.
export async function mergeConversationDetails(
	prisma: ExtendedPrismaClient,
	conversationId: string,
	values: Record<string, string>,
	mode: MergeMode,
): Promise<{ leadId: string | null }> {
	const incoming = JSON.stringify(values);
	const fill = mode === "fill";
	const rows = await prisma.$queryRaw<Array<{ leadId: string | null }>>`
		UPDATE "conversation"
		SET "leadDetails" = CASE WHEN ${fill}::boolean
			THEN ${incoming}::jsonb || COALESCE("leadDetails", '{}'::jsonb)
			ELSE COALESCE("leadDetails", '{}'::jsonb) || ${incoming}::jsonb
		END
		WHERE "id" = ${conversationId}
		RETURNING "leadId"
	`;
	return { leadId: rows[0]?.leadId ?? null };
}

export async function mergeLeadFields(
	prisma: ExtendedPrismaClient,
	leadId: string,
	values: Record<string, string>,
	mode: MergeMode,
): Promise<void> {
	if (Object.keys(values).length === 0) return;
	const incoming = JSON.stringify(values);
	const fill = mode === "fill";
	await prisma.$executeRaw`
		UPDATE "lead"
		SET "customFields" = CASE WHEN ${fill}::boolean
			THEN ${incoming}::jsonb || "customFields"
			ELSE "customFields" || ${incoming}::jsonb
		END,
		"updatedAt" = now()
		WHERE "id" = ${leadId}
	`;
}

// Capture-time write for both stores: the conversation, then its lead if
// the visitor is already identified.
export async function saveLeadValues(
	prisma: ExtendedPrismaClient,
	conversationId: string,
	values: Record<string, string>,
	mode: MergeMode,
): Promise<void> {
	if (Object.keys(values).length === 0) return;
	const { leadId } = await mergeConversationDetails(
		prisma,
		conversationId,
		values,
		mode,
	);
	if (leadId) await mergeLeadFields(prisma, leadId, values, mode);
}

// Run after linking the conversation to its lead: anything captured before
// the visitor was identified moves onto the lead. A save racing this either
// sees the link and writes the lead itself, or lands before it and is
// copied here.
export async function copyConversationDetailsToLead(
	prisma: ExtendedPrismaClient,
	conversationId: string,
	leadId: string,
): Promise<void> {
	await prisma.$executeRaw`
		UPDATE "lead"
		SET "customFields" = "customFields" || COALESCE(
		      (SELECT "leadDetails" FROM "conversation" WHERE "id" = ${conversationId}),
		      '{}'::jsonb
		    ),
		    "updatedAt" = now()
		WHERE "id" = ${leadId}
	`;
}

// Dashboard edits as a merge patch: set keys are merged in, null removes a
// key, everything else is left alone, including values captured meanwhile.
export async function patchLeadCustomFields(
	prisma: ExtendedPrismaClient,
	leadId: string,
	patch: Record<string, unknown>,
): Promise<void> {
	const set: Record<string, unknown> = {};
	const remove: string[] = [];
	for (const [key, value] of Object.entries(patch)) {
		if (value === null) remove.push(key);
		else set[key] = value;
	}
	await prisma.$executeRaw`
		UPDATE "lead"
		SET "customFields" = ("customFields" || ${JSON.stringify(set)}::jsonb) - ${remove}::text[],
		    "updatedAt" = now()
		WHERE "id" = ${leadId}
	`;
}
