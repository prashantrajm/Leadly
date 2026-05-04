import { z } from "@hono/zod-openapi";

// One-to-one with the Prisma enums in apps/api/prisma/schema.prisma.
// Keep both lists in sync — there's no codegen between them.

export const MembershipRole = z.enum(["owner", "admin", "member"]).openapi("MembershipRole");
export type MembershipRole = z.infer<typeof MembershipRole>;

export const AgentIdentityPolicy = z
	.enum(["optional", "required_before_chat", "identified_only"])
	.openapi("AgentIdentityPolicy");
export type AgentIdentityPolicy = z.infer<typeof AgentIdentityPolicy>;

export const KbArticleSource = z.enum(["manual", "upload"]).openapi("KbArticleSource");
export type KbArticleSource = z.infer<typeof KbArticleSource>;

export const ToolScope = z.enum(["system", "customer"]).openapi("ToolScope");
export type ToolScope = z.infer<typeof ToolScope>;

export const ConversationChannel = z.enum(["chat", "voice"]).openapi("ConversationChannel");
export type ConversationChannel = z.infer<typeof ConversationChannel>;

export const ConversationMode = z.enum(["auto", "paused"]).openapi("ConversationMode");
export type ConversationMode = z.infer<typeof ConversationMode>;

export const ConversationStatus = z
	.enum(["active", "ended", "abandoned"])
	.openapi("ConversationStatus");
export type ConversationStatus = z.infer<typeof ConversationStatus>;

export const TurnRole = z
	.enum(["user", "agent", "human", "tool", "system"])
	.openapi("TurnRole");
export type TurnRole = z.infer<typeof TurnRole>;

export const LlmProvider = z
	.enum(["openai", "anthropic", "google", "mistral", "groq", "openrouter", "other"])
	.openapi("LlmProvider");
export type LlmProvider = z.infer<typeof LlmProvider>;
