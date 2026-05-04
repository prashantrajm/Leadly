import { z } from "@hono/zod-openapi";
import { Cuid, IsoDate } from "./common.ts";

export const VisitorSchema = z
	.object({
		id: Cuid,
		organizationId: Cuid,
		agentId: Cuid,
		externalId: z.string(),
		firstSeenAt: IsoDate,
		lastSeenAt: IsoDate,
		userAgent: z.string().nullable(),
		ipHash: z.string().nullable(),
		leadId: Cuid.nullable(),
	})
	.openapi("Visitor");
export type Visitor = z.infer<typeof VisitorSchema>;

// What the widget POSTs on first load to upsert its identity. The browser
// keeps externalId in localStorage so the same Visitor row is reused across
// page reloads.
export const VisitorHelloSchema = z
	.object({
		externalId: z.string().min(1).max(64),
		userAgent: z.string().max(500).optional(),
	})
	.openapi("VisitorHello");
export type VisitorHello = z.infer<typeof VisitorHelloSchema>;
