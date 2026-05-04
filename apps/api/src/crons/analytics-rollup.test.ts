import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { getPrisma } from "../lib/prisma";
import type { Bindings } from "../types";
import {
	previousUtcDayBounds,
	rollupYesterdayForAgent,
} from "./analytics-rollup";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");
const prisma = getPrisma(DATABASE_URL);
const DB: string = DATABASE_URL;

function makeEnv(): Bindings {
	return {
		DATABASE_URL: DB,
		BETTER_AUTH_SECRET: "x",
		OPENROUTER_API_KEY: "x",
		SECRETS_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
		// biome-ignore lint/suspicious/noExplicitAny: bindings the rollup doesn't touch
		MEDIA_BUCKET: {} as any,
		// biome-ignore lint/suspicious/noExplicitAny: bindings the rollup doesn't touch
		WIDGET_CACHE: {} as any,
		// biome-ignore lint/suspicious/noExplicitAny: bindings the rollup doesn't touch
		KB_REEMBED: {} as any,
		// biome-ignore lint/suspicious/noExplicitAny: bindings the rollup doesn't touch
		CONVERSATION_SUMMARIZE: {} as any,
		// biome-ignore lint/suspicious/noExplicitAny: bindings the rollup doesn't touch
		CONVERSATION: {} as any,
	};
}

const tag = `roll${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let orgId: string;
let agentId: string;
let visitorId: string;

beforeAll(async () => {
	const userId = `${tag}-u`;
	await prisma.user.create({
		data: { id: userId, name: userId, email: `${userId}@test.local`, emailVerified: true },
	});
	const org = await prisma.organization.create({
		data: {
			name: `Org ${tag}`,
			slug: `org-${tag}`,
			memberships: { create: { userId, role: "owner" } },
		},
	});
	orgId = org.id;
	const agent = await prisma.agent.create({
		data: { organizationId: orgId, name: `Agent ${tag}`, slug: `a-${tag}` },
	});
	agentId = agent.id;
	const visitor = await prisma.visitor.create({
		data: { organizationId: orgId, agentId, externalId: `ext-${tag}` },
	});
	visitorId = visitor.id;
});

afterAll(async () => {
	await prisma.organization
		.deleteMany({ where: { slug: { startsWith: `org-${tag}` } } })
		.catch(() => {});
	await prisma.user
		.deleteMany({ where: { id: { startsWith: tag } } })
		.catch(() => {});
});

describe("previousUtcDayBounds", () => {
	it("returns the [yesterday-00:00 UTC, today-00:00 UTC) range", () => {
		// Tuesday 2026-05-05 14:00 UTC → window covers 2026-05-04T00:00..2026-05-05T00:00.
		const now = new Date("2026-05-05T14:00:00Z");
		const { start, end } = previousUtcDayBounds(now);
		expect(start.toISOString()).toBe("2026-05-04T00:00:00.000Z");
		expect(end.toISOString()).toBe("2026-05-05T00:00:00.000Z");
	});

	it("doesn't fold across timezone — UTC midnight only", () => {
		// Late local night in PT is still the same UTC day if it's 04:00 UTC.
		const now = new Date("2026-05-05T04:00:00Z");
		const { start, end } = previousUtcDayBounds(now);
		expect(start.toISOString()).toBe("2026-05-04T00:00:00.000Z");
		expect(end.toISOString()).toBe("2026-05-05T00:00:00.000Z");
	});
});

describe("rollupYesterdayForAgent", () => {
	it("counts only conversations that started yesterday in UTC", async () => {
		const now = new Date("2026-05-05T12:00:00Z");
		const yesterday = new Date("2026-05-04T15:00:00Z");
		const dayBefore = new Date("2026-05-03T15:00:00Z");
		const today = new Date("2026-05-05T01:00:00Z");

		const bucket: Array<{ id: string; turns: number; leadId?: string }> = [];

		async function seedConv(startedAt: Date, turns: number, withLead: boolean) {
			let leadId: string | undefined;
			if (withLead) {
				const lead = await prisma.lead.create({
					data: {
						organizationId: orgId,
						agentId,
						email: `lead-${tag}-${bucket.length}@test.local`,
					},
				});
				leadId = lead.id;
			}
			const conv = await prisma.conversation.create({
				data: {
					organizationId: orgId,
					agentId,
					visitorId,
					startedAt,
					lastActivityAt: startedAt,
					...(leadId ? { leadId } : {}),
				},
			});
			for (let i = 0; i < turns; i++) {
				await prisma.turn.create({
					data: {
						conversationId: conv.id,
						role: "user",
						text: `t${i}`,
					},
				});
			}
			bucket.push({ id: conv.id, turns, leadId });
		}

		await seedConv(yesterday, 4, true);
		await seedConv(yesterday, 2, false);
		await seedConv(dayBefore, 10, true); // older — must not count
		await seedConv(today, 5, false); // future — must not count

		const r = await rollupYesterdayForAgent(makeEnv(), agentId, now);

		expect(r.date).toBe("2026-05-04");
		expect(r.conversations).toBe(2);
		expect(r.leadsCaptured).toBe(1);
		expect(r.handoffs).toBe(0);
		expect(r.avgTurnsPerConv).toBe(3); // (4 + 2) / 2

		// And the row was upserted.
		const stored = await prisma.dailyStat.findUnique({
			where: {
				agentId_date: {
					agentId,
					date: new Date("2026-05-04T00:00:00Z"),
				},
			},
		});
		expect(stored?.conversations).toBe(2);
		expect(stored?.avgTurnsPerConv).toBe(3);

		// Cleanup the seeded conversations + the leftover turns that
		// didn't cascade away yet.
		await prisma.conversation
			.deleteMany({ where: { id: { in: bucket.map((b) => b.id) } } })
			.catch(() => {});
	});

	it("counts handoffs by request_handoff tool turns", async () => {
		const now = new Date("2026-05-06T12:00:00Z");
		const yesterday = new Date("2026-05-05T15:00:00Z");

		const conv = await prisma.conversation.create({
			data: {
				organizationId: orgId,
				agentId,
				visitorId,
				startedAt: yesterday,
				lastActivityAt: yesterday,
			},
		});
		await prisma.turn.create({
			data: { conversationId: conv.id, role: "user", text: "help" },
		});
		await prisma.turn.create({
			data: {
				conversationId: conv.id,
				role: "tool",
				toolName: "request_handoff",
				text: "{}",
			},
		});

		const r = await rollupYesterdayForAgent(makeEnv(), agentId, now);
		expect(r.handoffs).toBe(1);

		await prisma.conversation.delete({ where: { id: conv.id } }).catch(() => {});
	});

	it("dedupes leads — two conversations on the same lead = 1 lead capture", async () => {
		const now = new Date("2026-05-07T12:00:00Z");
		const yesterday = new Date("2026-05-06T15:00:00Z");

		const lead = await prisma.lead.create({
			data: {
				organizationId: orgId,
				agentId,
				email: `dedup-${tag}@test.local`,
			},
		});

		const a = await prisma.conversation.create({
			data: {
				organizationId: orgId,
				agentId,
				visitorId,
				startedAt: yesterday,
				lastActivityAt: yesterday,
				leadId: lead.id,
			},
		});
		const b = await prisma.conversation.create({
			data: {
				organizationId: orgId,
				agentId,
				visitorId,
				startedAt: new Date(yesterday.getTime() + 60_000),
				lastActivityAt: yesterday,
				leadId: lead.id,
			},
		});
		await prisma.turn.create({
			data: { conversationId: a.id, role: "user", text: "x" },
		});
		await prisma.turn.create({
			data: { conversationId: b.id, role: "user", text: "y" },
		});

		const r = await rollupYesterdayForAgent(makeEnv(), agentId, now);
		expect(r.conversations).toBe(2);
		expect(r.leadsCaptured).toBe(1);

		await prisma.conversation
			.deleteMany({ where: { id: { in: [a.id, b.id] } } })
			.catch(() => {});
		await prisma.lead.delete({ where: { id: lead.id } }).catch(() => {});
	});

	it("upsert overwrites a previous rollup for the same (agentId, date)", async () => {
		const now = new Date("2026-05-08T12:00:00Z");
		const yesterday = new Date("2026-05-07T15:00:00Z");

		const conv = await prisma.conversation.create({
			data: {
				organizationId: orgId,
				agentId,
				visitorId,
				startedAt: yesterday,
				lastActivityAt: yesterday,
			},
		});
		await prisma.turn.create({
			data: { conversationId: conv.id, role: "user", text: "x" },
		});

		const first = await rollupYesterdayForAgent(makeEnv(), agentId, now);
		expect(first.conversations).toBe(1);

		// Add a second conversation, re-run.
		const conv2 = await prisma.conversation.create({
			data: {
				organizationId: orgId,
				agentId,
				visitorId,
				startedAt: yesterday,
				lastActivityAt: yesterday,
			},
		});
		await prisma.turn.create({
			data: { conversationId: conv2.id, role: "user", text: "y" },
		});

		const second = await rollupYesterdayForAgent(makeEnv(), agentId, now);
		expect(second.conversations).toBe(2);

		const stored = await prisma.dailyStat.findUnique({
			where: {
				agentId_date: {
					agentId,
					date: new Date("2026-05-07T00:00:00Z"),
				},
			},
		});
		expect(stored?.conversations).toBe(2);

		await prisma.conversation
			.deleteMany({ where: { id: { in: [conv.id, conv2.id] } } })
			.catch(() => {});
	});
});
