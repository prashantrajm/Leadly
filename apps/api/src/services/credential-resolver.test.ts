// Resolver tests against the real DB. We exercise all three precedence
// branches (agent override → org default → platform fallback).

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { encryptForOrg } from "../lib/crypto";
import { getPrisma } from "../lib/prisma";
import type { Bindings } from "../types";
import { resolveCredentialForAgent } from "./credential-resolver";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");
const DB: string = DATABASE_URL;
const prisma = getPrisma(DB);
const TEST_ROOT = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

function makeEnv(extras: Partial<Bindings> = {}): Bindings {
	return {
		DATABASE_URL: DB,
		BETTER_AUTH_SECRET: "x",
		OPENROUTER_API_KEY: "platform-key",
		SECRETS_ENCRYPTION_KEY: TEST_ROOT,
		// biome-ignore lint/suspicious/noExplicitAny: bindings the resolver doesn't touch
		MEDIA_BUCKET: {} as any,
		// biome-ignore lint/suspicious/noExplicitAny: bindings the resolver doesn't touch
		WIDGET_CACHE: {} as any,
		// biome-ignore lint/suspicious/noExplicitAny: bindings the resolver doesn't touch
		KB_REEMBED: {} as any,
		// biome-ignore lint/suspicious/noExplicitAny: bindings the resolver doesn't touch
		CONVERSATION_SUMMARIZE: {} as any,
		// biome-ignore lint/suspicious/noExplicitAny: bindings the resolver doesn't touch
		CONVERSATION: {} as any,
		...extras,
	};
}

const tag = `cr${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let orgId: string;
let agentId: string;

beforeAll(async () => {
	const userId = `${tag}-u`;
	await prisma.user.create({
		data: {
			id: userId,
			name: userId,
			email: `${userId}@test.local`,
			emailVerified: true,
		},
	});
	const org = await prisma.organization.create({
		data: {
			name: `Org ${tag}`,
			slug: `org-${tag}`,
			memberships: { create: { userId, role: "owner" } },
		},
	});
	orgId = org.id;
	const agent = await prisma.agent.create({
		data: { organizationId: orgId, name: `Agent ${tag}`, slug: `a-${tag}` },
	});
	agentId = agent.id;
});

afterAll(async () => {
	await prisma.organization
		.deleteMany({ where: { slug: { startsWith: `org-${tag}` } } })
		.catch(() => {});
	await prisma.user
		.deleteMany({ where: { id: { startsWith: tag } } })
		.catch(() => {});
});

describe("resolveCredentialForAgent", () => {
	it("falls back to platform when no overrides + no defaults", async () => {
		const r = await resolveCredentialForAgent(makeEnv(), agentId, orgId);
		expect(r.source).toBe("platform");
		expect(r.apiKey).toBe("platform-key");
		expect(r.credentialId).toBeNull();
	});

	it("uses the org-level openrouter default when set", async () => {
		const blob = await encryptForOrg(
			{ SECRETS_ENCRYPTION_KEY: TEST_ROOT },
			orgId,
			"sk-or-org-default",
		);
		const cred = await prisma.orgLlmCredential.create({
			data: {
				organizationId: orgId,
				provider: "openrouter",
				label: "default",
				ciphertext: blob.ciphertext,
				iv: blob.iv,
				tag: blob.tag,
				maskedSuffix: "ault",
				isDefault: true,
			},
		});

		const r = await resolveCredentialForAgent(makeEnv(), agentId, orgId);
		expect(r.source).toBe("org_default");
		expect(r.apiKey).toBe("sk-or-org-default");
		expect(r.credentialId).toBe(cred.id);

		// Cleanup so other tests start from a clean state.
		await prisma.orgLlmCredential.delete({ where: { id: cred.id } });
	});

	it("agent override beats org default", async () => {
		const orgBlob = await encryptForOrg(
			{ SECRETS_ENCRYPTION_KEY: TEST_ROOT },
			orgId,
			"sk-or-org-default-2",
		);
		const orgDefault = await prisma.orgLlmCredential.create({
			data: {
				organizationId: orgId,
				provider: "openrouter",
				label: "default",
				ciphertext: orgBlob.ciphertext,
				iv: orgBlob.iv,
				tag: orgBlob.tag,
				maskedSuffix: "lt-2",
				isDefault: true,
			},
		});

		const overrideBlob = await encryptForOrg(
			{ SECRETS_ENCRYPTION_KEY: TEST_ROOT },
			orgId,
			"sk-or-AGENT-override",
		);
		const overrideCred = await prisma.orgLlmCredential.create({
			data: {
				organizationId: orgId,
				provider: "openrouter",
				label: "override",
				ciphertext: overrideBlob.ciphertext,
				iv: overrideBlob.iv,
				tag: overrideBlob.tag,
				maskedSuffix: "ride",
			},
		});
		await prisma.agentLlmOverride.create({
			data: { agentId, credentialId: overrideCred.id },
		});

		const r = await resolveCredentialForAgent(makeEnv(), agentId, orgId);
		expect(r.source).toBe("agent_override");
		expect(r.apiKey).toBe("sk-or-AGENT-override");
		expect(r.credentialId).toBe(overrideCred.id);

		// Cleanup.
		await prisma.agentLlmOverride.delete({ where: { agentId } });
		await prisma.orgLlmCredential.delete({ where: { id: overrideCred.id } });
		await prisma.orgLlmCredential.delete({ where: { id: orgDefault.id } });
	});

	it("falls through to org default if agent override points at non-openrouter cred", async () => {
		const otherBlob = await encryptForOrg(
			{ SECRETS_ENCRYPTION_KEY: TEST_ROOT },
			orgId,
			"sk-anthropic-direct",
		);
		const otherCred = await prisma.orgLlmCredential.create({
			data: {
				organizationId: orgId,
				provider: "anthropic", // NOT openrouter — must be skipped
				label: "anthropic",
				ciphertext: otherBlob.ciphertext,
				iv: otherBlob.iv,
				tag: otherBlob.tag,
				maskedSuffix: "rect",
			},
		});
		await prisma.agentLlmOverride.create({
			data: { agentId, credentialId: otherCred.id },
		});

		const r = await resolveCredentialForAgent(makeEnv(), agentId, orgId);
		expect(r.source).toBe("platform");
		expect(r.apiKey).toBe("platform-key");

		await prisma.agentLlmOverride.delete({ where: { agentId } });
		await prisma.orgLlmCredential.delete({ where: { id: otherCred.id } });
	});

	it("throws when no override, no default, and no platform key", async () => {
		await expect(
			resolveCredentialForAgent(
				makeEnv({ OPENROUTER_API_KEY: "" }),
				agentId,
				orgId,
			),
		).rejects.toThrow(/No OpenRouter credential/);
	});
});
