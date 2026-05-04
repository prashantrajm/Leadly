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

export async function reapIdleConversations(env: Bindings, now: Date = new Date()) {
	const prisma = getPrisma(env.DATABASE_URL);
	const cutoff = new Date(now.getTime() - IDLE_AGE_MS);

	// updateMany returns just a count — fine for the cron, no need to know
	// which specific rows we touched.
	const result = await prisma.conversation.updateMany({
		where: {
			status: "active",
			mode: "auto",
			lastActivityAt: { lt: cutoff },
			// Exclude empty conversations — these are typically widget-loaded
			// pages where the visitor never clicked the bubble. They time out
			// to abandoned via a different policy or get cleaned by the
			// daily rollup; not the reaper's job.
			turns: { some: {} },
		},
		data: { status: "abandoned", endedAt: now },
	});

	return { reaped: result.count };
}
