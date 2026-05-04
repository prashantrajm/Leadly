import { z } from "@hono/zod-openapi";
import { Cuid, IsoDate } from "./common.ts";
import { AgentIdentityPolicy, LlmProvider } from "./enums.ts";

export const AgentSchema = z
	.object({
		id: Cuid,
		organizationId: Cuid,
		name: z.string(),
		slug: z.string(),
		greeting: z.string(),
		accentColor: z.string(),
		identityPolicy: AgentIdentityPolicy,
		defaultProvider: LlmProvider,
		defaultModel: z.string(),
		systemPromptOverlay: z.string().nullable(),
		fallbackMessage: z.string(),
		maxTurns: z.number().int().positive(),
		createdAt: IsoDate,
		updatedAt: IsoDate,
	})
	.openapi("Agent");
export type Agent = z.infer<typeof AgentSchema>;

// Hex colour, 3 or 6 digits, with the leading #. Tight enough that bad input
// from the dashboard fails at the API boundary instead of producing a broken
// widget render.
const HexColor = z
	.string()
	.regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Must be a hex colour like #0F172A");

export const CreateAgentSchema = z
	.object({
		name: z.string().min(2).max(80),
		greeting: z.string().min(1).max(280).optional(),
		accentColor: HexColor.optional(),
		identityPolicy: AgentIdentityPolicy.optional(),
		defaultProvider: LlmProvider.optional(),
		defaultModel: z.string().min(1).max(120).optional(),
		systemPromptOverlay: z.string().max(8000).optional(),
		fallbackMessage: z.string().min(1).max(280).optional(),
		maxTurns: z.number().int().min(1).max(500).optional(),
	})
	.openapi("CreateAgent");
export type CreateAgent = z.infer<typeof CreateAgentSchema>;

export const UpdateAgentSchema = CreateAgentSchema.partial()
	.extend({
		// slug can only be edited explicitly — auto-derived from name on create.
		slug: z
			.string()
			.min(2)
			.max(64)
			.regex(/^[a-z0-9-]+$/)
			.optional(),
	})
	.openapi("UpdateAgent");
export type UpdateAgent = z.infer<typeof UpdateAgentSchema>;
