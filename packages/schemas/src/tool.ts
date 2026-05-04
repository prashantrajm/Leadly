import { z } from "@hono/zod-openapi";
import { Cuid, IsoDate } from "./common.ts";
import { ToolScope } from "./enums.ts";

export const ToolSchema = z
	.object({
		id: Cuid,
		organizationId: Cuid,
		agentId: Cuid,
		name: z.string(),
		scope: ToolScope,
		description: z.string(),
		// JSON Schema describing the tool's args. Stored as Json in Postgres,
		// passed through to the LLM provider's tool-call format.
		inputSchema: z.unknown(),
		enabled: z.boolean(),
		createdAt: IsoDate,
		updatedAt: IsoDate,
	})
	.openapi("Tool");
export type Tool = z.infer<typeof ToolSchema>;

// In v1 only system tools exist (capture_contact, request_handoff,
// set_conversation_summary, end_conversation). The dashboard Tools tab is
// read-only against this list.

export const SystemToolName = z
	.enum([
		"capture_contact",
		"request_handoff",
		"set_conversation_summary",
		"end_conversation",
	])
	.openapi("SystemToolName");
export type SystemToolName = z.infer<typeof SystemToolName>;
