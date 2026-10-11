import { z } from "@hono/zod-openapi";
import { Cuid, IsoDate } from "./common.ts";
import { AgentIdentityPolicy, LlmProvider } from "./enums.ts";

// Contact fields the agent asks for when lead capture is on.
export const ContactField = z
	.enum(["name", "email", "phone"])
	.openapi("ContactField");
export type ContactField = z.infer<typeof ContactField>;

// Business-defined lead fields ("Budget", "Move-in date", "Team size"…).
// Values are stored as strings keyed by `key` in Conversation.leadDetails
// and Lead.customFields; `type` shapes the prompt and the dashboard input.
export const LeadFieldType = z
	.enum(["text", "number", "yes_no", "choice"])
	.openapi("LeadFieldType");
export type LeadFieldType = z.infer<typeof LeadFieldType>;

// ask: the agent asks for it during the chat. listen: captured only if the
// visitor brings it up.
export const LeadFieldMode = z.enum(["ask", "listen"]).openapi("LeadFieldMode");
export type LeadFieldMode = z.infer<typeof LeadFieldMode>;

export const MAX_LEAD_FIELDS = 15;

export const LeadFieldSchema = z
	.object({
		// Stable storage key. Set once when the field is created, so renaming
		// the label keeps existing answers attached.
		key: z
			.string()
			.regex(/^[a-z][a-z0-9_]{0,39}$/, "Lowercase letters, digits and _"),
		label: z.string().trim().min(1).max(60),
		// Extra guidance for the AI, e.g. "Monthly budget in USD".
		hint: z.string().trim().max(200).optional(),
		type: LeadFieldType,
		options: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
		mode: LeadFieldMode,
	})
	.refine((f) => f.type !== "choice" || (f.options?.length ?? 0) >= 2, {
		message: "A choice field needs at least two options",
		path: ["options"],
	})
	.openapi("LeadField");
export type LeadField = z.infer<typeof LeadFieldSchema>;

const LeadFieldList = z
	.array(LeadFieldSchema)
	.max(MAX_LEAD_FIELDS)
	.refine((fields) => new Set(fields.map((f) => f.key)).size === fields.length, {
		message: "Field keys must be unique",
	});

// Something worth knowing that no configured field covers, picked out by
// the post-chat analysis ("Needs Hindi support", "Contract ends in Dec").
export const KeyFactSchema = z
	.object({
		label: z.string().trim().min(1).max(60),
		value: z.string().trim().min(1).max(300),
	})
	.openapi("KeyFact");
export type KeyFact = z.infer<typeof KeyFactSchema>;

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
		naturalMessaging: z.boolean(),
		leadCaptureEnabled: z.boolean(),
		contactFields: z.array(ContactField),
		leadFields: z.array(LeadFieldSchema),
		captureNotableDetails: z.boolean(),
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
		naturalMessaging: z.boolean().optional(),
		leadCaptureEnabled: z.boolean().optional(),
		contactFields: z.array(ContactField).max(3).optional(),
		leadFields: LeadFieldList.optional(),
		captureNotableDetails: z.boolean().optional(),
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
