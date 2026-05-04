// Analytics endpoints for the dashboard. Both read straight from
// DailyStat — that table is what the rollup cron writes, so the endpoints
// here are "give me what we already aggregated" rather than re-running
// any expensive query at request time.

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
	const stats = await prisma.dailyStat.findMany({
		where: { agentId, date: { gte: since } },
	});

	let conversations = 0;
	let leadsCaptured = 0;
	let handoffs = 0;
	let totalTurnsApprox = 0;
	const articleCitations = new Map<string, number>();

	for (const s of stats) {
		conversations += s.conversations;
		leadsCaptured += s.leadsCaptured;
		handoffs += s.handoffs;
		totalTurnsApprox += s.avgTurnsPerConv * s.conversations;
		for (const id of (s.topCitedArticleIds as string[]) ?? []) {
			articleCitations.set(id, (articleCitations.get(id) ?? 0) + 1);
		}
	}

	const avgTurnsPerConv =
		conversations > 0 ? totalTurnsApprox / conversations : 0;

	// Resolve article titles for the top 5 most-cited.
	const sorted = [...articleCitations.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5);
	const articleIds = sorted.map(([id]) => id);
	const articles = articleIds.length
		? await prisma.kbArticle.findMany({
				where: { id: { in: articleIds } },
				select: { id: true, title: true },
			})
		: [];
	const titleById = new Map(articles.map((a) => [a.id, a.title]));

	return c.json(
		{
			windowDays,
			conversations,
			leadsCaptured,
			handoffs,
			avgTurnsPerConv,
			topCitedArticles: sorted.map(([id, citations]) => ({
				articleId: id,
				title: titleById.get(id) ?? "(deleted)",
				citations,
			})),
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
	const stats = await prisma.dailyStat.findMany({
		where: { agentId, date: { gte: since } },
		orderBy: { date: "asc" },
	});

	// Backfill missing days with zeros so the chart has a continuous x-axis
	// even on a fresh agent that hasn't been live for the full window.
	const points: Array<{
		date: string;
		conversations: number;
		leadsCaptured: number;
		handoffs: number;
	}> = [];
	const byDate = new Map<string, (typeof stats)[number]>();
	for (const s of stats) byDate.set(s.date.toISOString().slice(0, 10), s);

	for (let d = 0; d < windowDays; d++) {
		const day = daysAgoUtc(windowDays - 1 - d);
		const key = day.toISOString().slice(0, 10);
		const s = byDate.get(key);
		points.push({
			date: key,
			conversations: s?.conversations ?? 0,
			leadsCaptured: s?.leadsCaptured ?? 0,
			handoffs: s?.handoffs ?? 0,
		});
	}

	return c.json({ points }, 200);
});
