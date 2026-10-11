// Lead field writes. Merges run as a single JSONB `||` in Postgres, so
// parallel tool calls in one step (or a tool call racing the post-chat
// workflow) can't drop each other's values the way read-modify-write would.
//
//   overwrite — incoming values win (the visitor just told us)
//   fill      — existing values win (post-chat extraction fills gaps only,
//               never overriding a live capture or a teammate's edit)

import { Prisma } from "../../generated/client/client";
import type { ExtendedPrismaClient } from "../../lib/prisma";

export type MergeMode = "overwrite" | "fill";

function mergeExpr(
	column: Prisma.Sql,
	values: Record<string, string>,
	mode: MergeMode,
) {
	const incoming = Prisma.sql`${JSON.stringify(values)}::jsonb`;
	const current = Prisma.sql`COALESCE(${column}, '{}'::jsonb)`;
	return mode === "overwrite"
		? Prisma.sql`${current} || ${incoming}`
		: Prisma.sql`${incoming} || ${current}`;
}

// Returns the conversation's leadId so callers can keep the lead in sync.
export async function mergeConversationDetails(
	prisma: ExtendedPrismaClient,
	conversationId: string,
	values: Record<string, string>,
	mode: MergeMode,
): Promise<{ leadId: string | null }> {
	const column = Prisma.raw(`"leadDetails"`);
	const rows = await prisma.$queryRaw<Array<{ leadId: string | null }>>`
		UPDATE "conversation"
		SET "leadDetails" = ${mergeExpr(column, values, mode)}
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
	const column = Prisma.raw(`"customFields"`);
	await prisma.$executeRaw`
		UPDATE "lead"
		SET "customFields" = ${mergeExpr(column, values, mode)},
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
