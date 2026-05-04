// Resolve which API key the agent loop should use on a given turn.
//
// Precedence:
//   1. Agent-level override → that specific OrgLlmCredential
//   2. Org-level default for provider=openrouter
//   3. The platform's env-supplied OPENROUTER_API_KEY (the "hosted" key
//      that customers without BYOK use)
//
// v1 only routes through OpenRouter (project_ai_stack.md memory), so the
// `provider` field on credentials is informational at runtime — we only
// pick `openrouter`-typed rows for actual use. The schema still stores
// other providers so a future direct-provider mode is a UI flip, not a
// migration.

import { decryptForOrg } from "../lib/crypto";
import { getPrisma } from "../lib/prisma";
import type { Bindings } from "../types";

export type ResolvedCredential = {
	apiKey: string;
	source: "agent_override" | "org_default" | "platform";
	credentialId: string | null;
};

export async function resolveCredentialForAgent(
	env: Bindings,
	agentId: string,
	organizationId: string,
): Promise<ResolvedCredential> {
	const prisma = getPrisma(env.DATABASE_URL);

	// 1. Per-agent override.
	const override = await prisma.agentLlmOverride.findUnique({
		where: { agentId },
	});
	if (override) {
		const cred = await prisma.orgLlmCredential.findUnique({
			where: { id: override.credentialId },
		});
		if (cred && cred.provider === "openrouter") {
			const apiKey = await decryptForOrg(env, organizationId, {
				ciphertext: cred.ciphertext,
				iv: cred.iv,
				tag: cred.tag,
			});
			return { apiKey, source: "agent_override", credentialId: cred.id };
		}
		// Override exists but points at a non-openrouter credential — fall
		// through to the org default rather than silently using platform.
		// Log so the customer sees that their agent isn't using their key.
		console.warn(
			`[byok] agent ${agentId} override points at non-openrouter credential; falling back to org default`,
		);
	}

	// 2. Org default for openrouter.
	const orgDefault = await prisma.orgLlmCredential.findFirst({
		where: { organizationId, provider: "openrouter", isDefault: true },
	});
	if (orgDefault) {
		const apiKey = await decryptForOrg(env, organizationId, {
			ciphertext: orgDefault.ciphertext,
			iv: orgDefault.iv,
			tag: orgDefault.tag,
		});
		return { apiKey, source: "org_default", credentialId: orgDefault.id };
	}

	// 3. Platform fallback. The env key powers the hosted free tier.
	if (!env.OPENROUTER_API_KEY) {
		throw new Error(
			"No OpenRouter credential resolvable: no agent override, no org default, no platform key",
		);
	}
	return {
		apiKey: env.OPENROUTER_API_KEY,
		source: "platform",
		credentialId: null,
	};
}
