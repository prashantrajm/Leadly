// Placeholder. Real schemas live in `packages/schemas` from Phase 2 onward.
// Kept here only because `routes/uploads.ts` still imports `ErrorSchema` until
// Phase 4 rebuilds uploads as part of KB.

import { z } from "@hono/zod-openapi";

export const ErrorSchema = z
	.object({
		error: z.string(),
		message: z.string().optional(),
	})
	.openapi("Error");
