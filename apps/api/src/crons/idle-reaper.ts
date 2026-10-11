// Sweeps Conversation rows that look stuck.
//
// The ConversationDO sets a 30-min idle alarm and flips status=abandoned
// itself when the alarm fires. This cron is the safety net for the cases
// where the alarm doesn't (DO eviction races, alarm misfire, a Worker
// release that drops the alarm clock). Without it, an agent's inbox
// would slowly fill with active-but-silent conversations forever.
//
// We're conservative: only end conversations that are
//   • status = active
//   • mode = auto (paused = a human took over; never reap those)
//   • lastActivityAt > IDLE_AGE_MS ago
//   • have at least one turn (sanity — empty conversations were never
//     real and a different cleanup path can handle those if needed)
//
// Runs every 5 min via wrangler.jsonc cron trigger.

import { getPrisma } from "../lib/prisma";
import type { Bindings } from "../types";

const IDLE_AGE_MS = 30 * 60 * 1000; // 30 min — matches the DO's hard cap
// Workflows' createBatch takes at most 100 instances.
const BATCH_SIZE = 100;
const MAX_BATCHES = 10;

export async function reapIdleConversations(env: Bindings, now: Date = new Date()) {
	const prisma = getPrisma(env.DATABASE_URL);
	const cutoff = new Date(now.getTime() - IDLE_AGE_MS);

	const where = {
		status: "active" as const,
		mode: "auto" as const,
		lastActivityAt: { lt: cutoff },
		// Exclude empty conversations — these are typically widget-loaded
		// pages where the visitor never clicked the bubble. They time out
		// to abandoned via a different policy or get cleaned by the
		// daily rollup; not the reaper's job.
		turns: { some: {} },
	};

	// Batched so a backlog can't blow the cron's time budget; leftovers are
	// picked up on the next run.
	let reaped = 0;
	for (let batch = 0; batch < MAX_BATCHES; batch++) {
		const stale = await prisma.conversation.findMany({
			where,
			select: { id: true },
			orderBy: { lastActivityAt: "asc" },
			take: BATCH_SIZE,
		});
		if (stale.length === 0) break;
		const ids = stale.map((c) => c.id);

		// The re-applied filter skips rows that turned active again since the
		// read; the follow-up read finds exactly what this run ended.
		await prisma.conversation.updateMany({
			where: { ...where, id: { in: ids } },
			data: { status: "abandoned", endedAt: now },
		});
		const ended = await prisma.conversation.findMany({
			where: { id: { in: ids }, status: "abandoned", endedAt: now },
			select: { id: true },
		});
		reaped += ended.length;

		// Most visitors leave rather than end the chat, so reaped chats get
		// the same post-chat analysis as ended ones.
		if (ended.length > 0) {
			await env.CONVERSATION_SUMMARIZE.createBatch(
				ended.map((c) => ({ params: { conversationId: c.id } })),
			).catch((err: unknown) =>
				console.error("[idle-reaper] failed to schedule summarize", err),
			);
		}
		if (stale.length < BATCH_SIZE) break;
	}
	return { reaped };
}
