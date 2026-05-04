// Real domain schemas land in Phase 2 (alongside the prisma-zod-generator
// output and hand-written Create*/Update* contract schemas). For Phase 1 we
// just prove the package imports across the workspace.

import { z } from "@hono/zod-openapi";

export const HealthSchema = z
	.object({
		status: z.literal("ok"),
		timestamp: z.string(),
	})
	.openapi("Health");

export type Health = z.infer<typeof HealthSchema>;
