import { z } from "@hono/zod-openapi";
import { Cuid, IsoDate } from "./common.ts";

export const DailyStatSchema = z
	.object({
		id: Cuid,
		organizationId: Cuid,
		agentId: Cuid,
		date: z.iso.date(),
		conversations: z.number().int().nonnegative(),
		leadsCaptured: z.number().int().nonnegative(),
		handoffs: z.number().int().nonnegative(),
		avgTurnsPerConv: z.number(),
		topCitedArticleIds: z.array(Cuid),
		createdAt: IsoDate,
	})
	.openapi("DailyStat");
export type DailyStat = z.infer<typeof DailyStatSchema>;

export const AnalyticsSummarySchema = z
	.object({
		windowDays: z.number().int().positive(),
		conversations: z.number().int().nonnegative(),
		leadsCaptured: z.number().int().nonnegative(),
		handoffs: z.number().int().nonnegative(),
		avgTurnsPerConv: z.number(),
		topCitedArticles: z.array(
			z.object({
				articleId: Cuid,
				title: z.string(),
				citations: z.number().int().nonnegative(),
			}),
		),
	})
	.openapi("AnalyticsSummary");
export type AnalyticsSummary = z.infer<typeof AnalyticsSummarySchema>;

export const AnalyticsTimeseriesSchema = z
	.object({
		points: z.array(
			z.object({
				date: z.iso.date(),
				conversations: z.number().int().nonnegative(),
				leadsCaptured: z.number().int().nonnegative(),
				handoffs: z.number().int().nonnegative(),
			}),
		),
	})
	.openapi("AnalyticsTimeseries");
export type AnalyticsTimeseries = z.infer<typeof AnalyticsTimeseriesSchema>;
