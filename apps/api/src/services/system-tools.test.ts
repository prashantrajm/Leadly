// System-tool executors against the real dev DB. These tests assert the
// durable side-effects each tool produces — the DO's WS broadcasts and
// workflow triggers (Phase 7+) are tested separately because they don't
// belong to the executor.

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { getPrisma } from "../lib/prisma";
import {
	CaptureContactInput,
	executeCaptureContact,
	executeEndConversation,
	executeRequestHandoff,
	executeSetConversationSummary,
} from "./system-tools";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL not set");
const prisma = getPrisma(DATABASE_URL);

const tag = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let userId: string;
let orgId: string;
let agentId: string;
let visitorId: string;
let conversationId: string;

beforeAll(async () => {
	userId = `${tag}-u`;
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

	const visitor = await prisma.visitor.create({
		data: {
			organizationId: orgId,
			agentId,
			externalId: `ext-${tag}`,
		},
	});
	visitorId = visitor.id;

	const conv = await prisma.conversation.create({
		data: {
			organizationId: orgId,
			agentId,
			visitorId,
		},
	});
	conversationId = conv.id;
});

afterAll(async () => {
	await prisma.organization
		.deleteMany({ where: { slug: { startsWith: `org-${tag}` } } })
		.catch(() => {});
	await prisma.user
		.deleteMany({ where: { id: { startsWith: tag } } })
		.catch(() => {});
});

const ctx = () => ({
	conversationId,
	agentId,
	organizationId: orgId,
	visitorId,
	prisma,
});

// ---------- input schema ----------

describe("CaptureContactInput", () => {
	it("requires at least one of email or phone", () => {
		expect(() => CaptureContactInput.parse({})).toThrow();
		expect(() => CaptureContactInput.parse({ name: "Alice" })).toThrow();
	});

	it("accepts email only", () => {
		expect(CaptureContactInput.parse({ email: "a@b.co" }).email).toBe(
			"a@b.co",
		);
	});

	it("accepts phone only", () => {
		expect(CaptureContactInput.parse({ phone: "+15551234567" }).phone).toBe(
			"+15551234567",
		);
	});
});

// ---------- capture_contact ----------

describe("executeCaptureContact", () => {
	it("creates a new lead and links visitor + conversation on first call", async () => {
		const email = `${tag}-first@test.local`;
		const result = await executeCaptureContact(ctx(), {
			email,
			name: "Alice",
		});
		expect(result.ok).toBe(true);
		expect(result.created).toBe(true);
		const leadId = result.leadId as string;

		const v = await prisma.visitor.findUnique({ where: { id: visitorId } });
		expect(v?.leadId).toBe(leadId);
		const c = await prisma.conversation.findUnique({
			where: { id: conversationId },
		});
		expect(c?.leadId).toBe(leadId);
	});

	it("updates the existing lead on a second call with the same email (dedup)", async () => {
		const email = `${tag}-dedup@test.local`;
		const a = await executeCaptureContact(ctx(), { email });
		const b = await executeCaptureContact(ctx(), { email, name: "Bob" });
		expect(a.leadId).toBe(b.leadId);
		expect(a.created).toBe(true);
		expect(b.created).toBe(false);

		const lead = await prisma.lead.findUnique({
			where: { id: a.leadId as string },
		});
		expect(lead?.name).toBe("Bob");
	});
});

// ---------- request_handoff ----------

describe("executeRequestHandoff", () => {
	it("flips conversation.mode to paused", async () => {
		const result = await executeRequestHandoff(ctx(), {
			reason: "Visitor asked for a human",
			urgency: "normal",
		});
		expect(result.ok).toBe(true);
		const c = await prisma.conversation.findUnique({
			where: { id: conversationId },
		});
		expect(c?.mode).toBe("paused");
	});
});

// ---------- set_conversation_summary ----------

describe("executeSetConversationSummary", () => {
	it("writes summary, sentiment, and tags", async () => {
		const result = await executeSetConversationSummary(ctx(), {
			summary: "Visitor asked about pricing; satisfied with answer.",
			sentiment: "positive",
			tags: ["pricing", "self-served"],
		});
		expect(result.ok).toBe(true);
		const c = await prisma.conversation.findUnique({
			where: { id: conversationId },
		});
		expect(c?.summary).toContain("pricing");
		expect(c?.sentiment).toBe("positive");
		expect(c?.tags).toEqual(["pricing", "self-served"]);
	});

	it("accepts a summary without sentiment or tags", async () => {
		const result = await executeSetConversationSummary(ctx(), {
			summary: "Brief exchange.",
		});
		expect(result.ok).toBe(true);
	});
});

// ---------- end_conversation ----------

describe("executeEndConversation", () => {
	it("flips status to ended and stamps endedAt", async () => {
		const result = await executeEndConversation(ctx(), {
			resolution: "resolved",
		});
		expect(result.ok).toBe(true);
		const c = await prisma.conversation.findUnique({
			where: { id: conversationId },
		});
		expect(c?.status).toBe("ended");
		expect(c?.endedAt).toBeInstanceOf(Date);
	});
});
