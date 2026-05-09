// Analytics endpoints for the dashboard. These intentionally read from live
// Conversation/Turn/Lead rows so today's activity appears immediately. The
// DailyStat rollup remains useful for future heavier analytics, but dashboard
// v1 should not wait for the midnight cron to show non-zero counts.

import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
	AnalyticsSummarySchema,
	AnalyticsTimeseriesSchema,
	ErrorSchema,
} from "@leadly/schemas";
import { getPrisma } from "../lib/prisma";
import { requireAgentAccess } from "../middleware/org";
import type { AppEnv } from "../types";

export const analyticsApp = new OpenAPIHono<AppEnv>();

// "Days ago" → an aligned UTC start-of-day boundary.
function daysAgoUtc(days: number, now: Date = new Date()): Date {
	const today = new Date(
		Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
	);
	return new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
}

function utcDayStart(date: Date): Date {
	return new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
	);
}

function addUtcDays(date: Date, days: number): Date {
	return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

// ---------- summary ----------

const summaryRoute = createRoute({
	method: "get",
	path: "/summary",
	tags: ["Analytics"],
	request: {
		params: z.object({ agentId: z.string() }),
		query: z.object({
			windowDays: z.coerce.number().int().min(1).max(90).default(30),
		}),
	},
	middleware: [requireAgentAccess] as const,
	responses: {
		200: {
			content: { "application/json": { schema: AnalyticsSummarySchema } },
			description: "Aggregated summary over the requested window",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
	},
});

analyticsApp.openapi(summaryRoute, async (c) => {
	const { agentId } = c.req.valid("param");
	const { windowDays } = c.req.valid("query");
	const prisma = getPrisma(c.env.DATABASE_URL);

	const since = daysAgoUtc(windowDays);
	const [conversations, leadsCaptured, handoffRows, turnCount] =
		await Promise.all([
			prisma.conversation.count({
				where: { agentId, startedAt: { gte: since } },
			}),
			prisma.lead.count({
				where: { agentId, createdAt: { gte: since } },
			}),
			prisma.turn.findMany({
				where: {
					role: "tool",
					toolName: "request_handoff",
					createdAt: { gte: since },
					conversation: { agentId },
				},
				distinct: ["conversationId"],
				select: { conversationId: true },
			}),
			prisma.turn.count({
				where: {
					createdAt: { gte: since },
					conversation: { agentId, startedAt: { gte: since } },
				},
			}),
		]);
	const handoffs = handoffRows.length;
	const avgTurnsPerConv =
		conversations > 0 ? turnCount / conversations : 0;

	return c.json(
		{
			windowDays,
			conversations,
			leadsCaptured,
			handoffs,
			avgTurnsPerConv,
			topCitedArticles: [],
		},
		200,
	);
});

// ---------- timeseries ----------

const timeseriesRoute = createRoute({
	method: "get",
	path: "/timeseries",
	tags: ["Analytics"],
	request: {
		params: z.object({ agentId: z.string() }),
		query: z.object({
			windowDays: z.coerce.number().int().min(1).max(90).default(30),
		}),
	},
	middleware: [requireAgentAccess] as const,
	responses: {
		200: {
			content: { "application/json": { schema: AnalyticsTimeseriesSchema } },
			description: "Per-day points over the requested window",
		},
		401: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Unauthorized",
		},
		403: {
			content: { "application/json": { schema: ErrorSchema } },
			description: "Forbidden",
		},
	},
});

analyticsApp.openapi(timeseriesRoute, async (c) => {
	const { agentId } = c.req.valid("param");
	const { windowDays } = c.req.valid("query");
	const prisma = getPrisma(c.env.DATABASE_URL);

	const since = daysAgoUtc(windowDays);
	const today = utcDayStart(new Date());
	const until = addUtcDays(today, 1);
	const [conversations, leads, handoffTurns] = await Promise.all([
		prisma.conversation.findMany({
			where: { agentId, startedAt: { gte: since, lt: until } },
			select: { id: true, startedAt: true },
		}),
		prisma.lead.findMany({
			where: { agentId, createdAt: { gte: since, lt: until } },
			select: { id: true, createdAt: true },
		}),
		prisma.turn.findMany({
			where: {
				role: "tool",
				toolName: "request_handoff",
				createdAt: { gte: since, lt: until },
				conversation: { agentId },
			},
			distinct: ["conversationId"],
			select: { conversationId: true, createdAt: true },
		}),
	]);

	// Backfill missing days with zeros so the chart has a continuous x-axis
	// even on a fresh agent that hasn't been live for the full window.
	const points: Array<{
		date: string;
		conversations: number;
		leadsCaptured: number;
		handoffs: number;
	}> = [];
	const byDate = new Map<
		string,
		{ conversations: number; leadsCaptured: number; handoffs: number }
	>();
	for (let d = 0; d < windowDays; d++) {
		const day = daysAgoUtc(windowDays - 1 - d);
		byDate.set(day.toISOString().slice(0, 10), {
			conversations: 0,
			leadsCaptured: 0,
			handoffs: 0,
		});
	}
	for (const conv of conversations) {
		const key = conv.startedAt.toISOString().slice(0, 10);
		const point = byDate.get(key);
		if (point) point.conversations += 1;
	}
	for (const lead of leads) {
		const key = lead.createdAt.toISOString().slice(0, 10);
		const point = byDate.get(key);
		if (point) point.leadsCaptured += 1;
	}
	for (const handoff of handoffTurns) {
		const key = handoff.createdAt.toISOString().slice(0, 10);
		const point = byDate.get(key);
		if (point) point.handoffs += 1;
	}

	for (let d = 0; d < windowDays; d++) {
		const day = daysAgoUtc(windowDays - 1 - d);
		const key = day.toISOString().slice(0, 10);
		const point = byDate.get(key);
		points.push({
			date: key,
			conversations: point?.conversations ?? 0,
			leadsCaptured: point?.leadsCaptured ?? 0,
			handoffs: point?.handoffs ?? 0,
		});
	}

	return c.json({ points }, 200);
});
