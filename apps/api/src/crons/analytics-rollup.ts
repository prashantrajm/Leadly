// Daily per-agent DailyStat rollup. Runs at 00:05 UTC for the day that
// just ended (the previous UTC day, in [00:00:00, 23:59:59.999]).
//
// We aggregate from raw Conversation + Turn rows rather than incrementing
// counters live, because:
//   • Late-arriving rows (paused conversations that ended after the
//     cron ran) are corrected on the next day's rollup if we re-run for
//     yesterday — see the upsert below.
//   • Counts stay correct even if a conversation moves between mode/
//     status states multiple times during the day.
//
// The cron handler in index.ts schedules ALL OF the previous-day rollup
// per agent in parallel, but we keep this function shaped per-agent so
// it's easy to run on demand for a single agent (Phase 14's smoke test
// or an admin support tool).

import { getPrisma } from "../lib/prisma";
import type { Bindings } from "../types";

export type RollupResult = {
	agentId: string;
	date: string; // YYYY-MM-DD UTC
	conversations: number;
	leadsCaptured: number;
	handoffs: number;
	avgTurnsPerConv: number;
	topCitedArticleIds: string[];
};

// "Yesterday in UTC" — the [start, end) bounds we aggregate over.
export function previousUtcDayBounds(now: Date = new Date()) {
	const end = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
	);
	const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
	return { start, end };
}

export async function rollupYesterdayForAgent(
	env: Bindings,
	agentId: string,
	now: Date = new Date(),
): Promise<RollupResult> {
	const prisma = getPrisma(env.DATABASE_URL);
	const { start, end } = previousUtcDayBounds(now);
	const dateOnly = start.toISOString().slice(0, 10);

	const agent = await prisma.agent.findUnique({
		where: { id: agentId },
		select: { organizationId: true },
	});
	if (!agent) throw new Error(`Agent ${agentId} not found`);

	// 1. Conversations that started in the window. We anchor on startedAt
	//    rather than endedAt because design §7.1 needs "conversations
	//    started today" as the primary inbox count.
	const conversations = await prisma.conversation.findMany({
		where: {
			agentId,
			startedAt: { gte: start, lt: end },
		},
		select: {
			id: true,
			leadId: true,
			turns: { select: { role: true, toolName: true } },
		},
	});

	const conversationCount = conversations.length;
	let totalTurns = 0;
	let leadsCaptured = 0;
	let handoffs = 0;
	const seenLeads = new Set<string>();

	for (const c of conversations) {
		totalTurns += c.turns.length;
		// "Lead captured" = conversation has a leadId AND we haven't already
		// counted that lead today. Two conversations linking to the same
		// lead in the same day = 1 capture.
		if (c.leadId && !seenLeads.has(c.leadId)) {
			seenLeads.add(c.leadId);
			leadsCaptured += 1;
		}
		// "Handoff" = at least one turn invoked request_handoff.
		const hadHandoff = c.turns.some(
			(t) => t.role === "tool" && t.toolName === "request_handoff",
		);
		if (hadHandoff) handoffs += 1;
	}

	const avgTurnsPerConv =
		conversationCount > 0 ? totalTurns / conversationCount : 0;

	// 2. Top KB articles cited. We can't yet — KbChunk references aren't
	//    persisted on Turn (Phase 6 left this for v1.5). For now, return
	//    [] and let the dashboard render "—" until citation tracking lands.
	const topCitedArticleIds: string[] = [];

	const result: RollupResult = {
		agentId,
		date: dateOnly,
		conversations: conversationCount,
		leadsCaptured,
		handoffs,
		avgTurnsPerConv,
		topCitedArticleIds,
	};

	// 3. Upsert. Re-running the cron for the same (agentId, date) overwrites
	//    cleanly — the @@unique constraint in domain.prisma is what makes
	//    the upsert path clean.
	await prisma.dailyStat.upsert({
		where: { agentId_date: { agentId, date: start } },
		create: {
			organizationId: agent.organizationId,
			agentId,
			date: start,
			conversations: conversationCount,
			leadsCaptured,
			handoffs,
			avgTurnsPerConv,
			topCitedArticleIds: topCitedArticleIds,
		},
		update: {
			conversations: conversationCount,
			leadsCaptured,
			handoffs,
			avgTurnsPerConv,
			topCitedArticleIds: topCitedArticleIds,
		},
	});

	return result;
}

// Roll up every agent that exists. Returns one entry per agent so the
// scheduled handler can log totals for monitoring.
export async function rollupYesterdayAllAgents(
	env: Bindings,
	now: Date = new Date(),
): Promise<RollupResult[]> {
	const prisma = getPrisma(env.DATABASE_URL);
	const agents = await prisma.agent.findMany({ select: { id: true } });
	// Sequential rather than parallel — the dev DB can handle parallel but
	// production Accelerate has a connection ceiling. Fewer simultaneous
	// transactions = less competition with live traffic at 00:05 UTC.
	const out: RollupResult[] = [];
	for (const a of agents) {
		try {
			out.push(await rollupYesterdayForAgent(env, a.id, now));
		} catch (err) {
			console.error(`[rollup] agent ${a.id} failed`, err);
		}
	}
	return out;
}
