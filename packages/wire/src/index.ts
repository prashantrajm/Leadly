// WebSocket envelope types and parsers land in Phase 7. This stub just proves
// the package resolves across the workspace.

import { z } from "zod";

export const PingFrame = z.object({
	type: z.literal("ping"),
});
export type PingFrame = z.infer<typeof PingFrame>;

export const PongFrame = z.object({
	type: z.literal("pong"),
});
export type PongFrame = z.infer<typeof PongFrame>;
