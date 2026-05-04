import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { getPrisma } from "../lib/prisma";
import type { Bindings } from "../types";
import { reapIdleConversations } from "./idle-reaper";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");
const prisma = getPrisma(DATABASE_URL);
const DB: string = DATABASE_URL;

function makeEnv(): Bindings {
	return {
		DATABASE_URL: DB,
		BETTER_AUTH_SECRET: "x",
		OPENROUTER_API_KEY: "x",
		SECRETS_ENCRYPTION_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
		// biome-ignore lint/suspicious/noExplicitAny: bindings the reaper doesn't touch
		MEDIA_BUCKET: {} as any,
		// biome-ignore lint/suspicious/noExplicitAny: bindings the reaper doesn't touch
		WIDGET_CACHE: {} as any,
		// biome-ignore lint/suspicious/noExplicitAny: bindings the reaper doesn't touch
		KB_REEMBED: {} as any,
		// biome-ignore lint/suspicious/noExplicitAny: bindings the reaper doesn't touch
		CONVERSATION_SUMMARIZE: {} as any,
		// biome-ignore lint/suspicious/noExplicitAny: bindings the reaper doesn't touch
		CONVERSATION: {} as any,
	};
}

const tag = `idl${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let orgId: string;
let agentId: string;
let visitorId: string;

beforeAll(async () => {
	const userId = `${tag}-u`;
	await prisma.user.create({
		data: { id: userId, name: userId, email: `${userId}@test.local`, emailVerified: true },
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
	const visitor = await prisma.visitor.create({
		data: { organizationId: orgId, agentId, externalId: `ext-${tag}` },
	});
	visitorId = visitor.id;
});

afterAll(async () => {
	await prisma.organization
		.deleteMany({ where: { slug: { startsWith: `org-${tag}` } } })
		.catch(() => {});
	await prisma.user
		.deleteMany({ where: { id: { startsWith: tag } } })
		.catch(() => {});
});

describe("reapIdleConversations", () => {
	it("flips status=abandoned on stale active+auto+turn-having conversations", async () => {
		const stale = await prisma.conversation.create({
			data: {
				organizationId: orgId,
				agentId,
				visitorId,
				status: "active",
				mode: "auto",
				lastActivityAt: new Date(Date.now() - 60 * 60 * 1000), // 1h ago
			},
		});
		await prisma.turn.create({
			data: { conversationId: stale.id, role: "user", text: "hi" },
		});

		const result = await reapIdleConversations(makeEnv());
		expect(result.reaped).toBeGreaterThanOrEqual(1);

		const after = await prisma.conversation.findUnique({
			where: { id: stale.id },
		});
		expect(after?.status).toBe("abandoned");
		expect(after?.endedAt).toBeInstanceOf(Date);
	});

	it("leaves fresh active conversations alone", async () => {
		const fresh = await prisma.conversation.create({
			data: {
				organizationId: orgId,
				agentId,
				visitorId,
				status: "active",
				mode: "auto",
				lastActivityAt: new Date(),
			},
		});
		await prisma.turn.create({
			data: { conversationId: fresh.id, role: "user", text: "hi" },
		});

		await reapIdleConversations(makeEnv());

		const after = await prisma.conversation.findUnique({
			where: { id: fresh.id },
		});
		expect(after?.status).toBe("active");
	});

	it("doesn't touch paused conversations (a human is in there)", async () => {
		const paused = await prisma.conversation.create({
			data: {
				organizationId: orgId,
				agentId,
				visitorId,
				status: "active",
				mode: "paused",
				lastActivityAt: new Date(Date.now() - 60 * 60 * 1000),
			},
		});
		await prisma.turn.create({
			data: { conversationId: paused.id, role: "user", text: "hi" },
		});

		await reapIdleConversations(makeEnv());

		const after = await prisma.conversation.findUnique({
			where: { id: paused.id },
		});
		expect(after?.status).toBe("active");
	});

	it("doesn't touch already-ended conversations", async () => {
		const ended = await prisma.conversation.create({
			data: {
				organizationId: orgId,
				agentId,
				visitorId,
				status: "ended",
				mode: "auto",
				lastActivityAt: new Date(Date.now() - 60 * 60 * 1000),
				endedAt: new Date(Date.now() - 30 * 60 * 1000),
			},
		});
		await prisma.turn.create({
			data: { conversationId: ended.id, role: "user", text: "hi" },
		});

		await reapIdleConversations(makeEnv());

		const after = await prisma.conversation.findUnique({
			where: { id: ended.id },
		});
		expect(after?.status).toBe("ended");
	});

	it("ignores empty conversations (no turns)", async () => {
		const empty = await prisma.conversation.create({
			data: {
				organizationId: orgId,
				agentId,
				visitorId,
				status: "active",
				mode: "auto",
				lastActivityAt: new Date(Date.now() - 60 * 60 * 1000),
			},
		});

		await reapIdleConversations(makeEnv());

		const after = await prisma.conversation.findUnique({
			where: { id: empty.id },
		});
		expect(after?.status).toBe("active");
	});
});
