import { z } from "@hono/zod-openapi";
import { Cuid, IsoDate } from "./common.ts";
import { LlmProvider } from "./enums.ts";

// Wire shape for BYOK credentials. The plaintext API key never appears in any
// response — `maskedSuffix` (last 4 chars) is what the dashboard renders.
// Encrypted blob fields stay server-side.

export const OrgLlmCredentialPublicSchema = z
	.object({
		id: Cuid,
		organizationId: Cuid,
		provider: LlmProvider,
		label: z.string(),
		maskedSuffix: z.string(),
		isDefault: z.boolean(),
		createdAt: IsoDate,
		updatedAt: IsoDate,
	})
	.openapi("OrgLlmCredentialPublic");
export type OrgLlmCredentialPublic = z.infer<typeof OrgLlmCredentialPublicSchema>;

export const CreateLlmCredentialSchema = z
	.object({
		provider: LlmProvider,
		label: z.string().min(1).max(80),
		// Plaintext only present on this single inbound request — encrypted on
		// the way to the database, never logged, never echoed back.
		apiKey: z.string().min(8).max(500),
		isDefault: z.boolean().optional(),
	})
	.openapi("CreateLlmCredential");
export type CreateLlmCredential = z.infer<typeof CreateLlmCredentialSchema>;

export const SetAgentCredentialOverrideSchema = z
	.object({
		credentialId: Cuid,
	})
	.openapi("SetAgentCredentialOverride");
export type SetAgentCredentialOverride = z.infer<typeof SetAgentCredentialOverrideSchema>;
