// System-tool executors against the real dev DB. These tests assert the
// durable side-effects each tool produces — the DO's WS broadcasts and
// workflow triggers (Phase 7+) are tested separately because they don't
// belong to the executor.

import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { LeadField } from "@leadly/schemas";
import { getPrisma } from "../lib/prisma";
import {
	CaptureContactInput,
	executeCaptureContact,
	executeEndConversation,
	executeRequestHandoff,
	executeSaveLeadDetails,
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
		data: {
			organizationId: orgId,
			name: `Agent ${tag}`,
			slug: `a-${tag}`,
			leadFields,
		},
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

const leadFields: LeadField[] = [
	{ key: "project", label: "Project", type: "text", mode: "ask" },
	{ key: "budget", label: "Budget", type: "text", mode: "listen" },
	{
		key: "timeline",
		label: "Timeline",
		type: "choice",
		options: ["This month", "Next month", "Later"],
		mode: "listen",
	},
];

const ctx = () => ({
	leadFields,
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

// ---------- save_lead_details ----------

describe("executeSaveLeadDetails", () => {
	// Own visitor + conversation so the lead linking above doesn't leak in.
	const fresh = async () => {
		const visitor = await prisma.visitor.create({
			data: {
				organizationId: orgId,
				agentId,
				externalId: `ext-${tag}-${Math.random().toString(36).slice(2, 8)}`,
			},
		});
		const conv = await prisma.conversation.create({
			data: { organizationId: orgId, agentId, visitorId: visitor.id },
		});
		return { ...ctx(), visitorId: visitor.id, conversationId: conv.id };
	};

	it("keeps answers on the conversation, then carries them onto the lead", async () => {
		const c = await fresh();
		await executeSaveLeadDetails(c, {
			details: { project: "A booking app for salons" },
		});
		// Labels work as keys too.
		await executeSaveLeadDetails(c, { details: { Budget: "$500/mo" } });

		const conv = await prisma.conversation.findUnique({
			where: { id: c.conversationId },
		});
		expect(conv?.leadDetails).toEqual({
			project: "A booking app for salons",
			budget: "$500/mo",
		});

		const captured = await executeCaptureContact(c, {
			phone: `+1555${Date.now().toString().slice(-7)}`,
		});
		const lead = await prisma.lead.findUnique({
			where: { id: captured.leadId as string },
		});
		expect(lead?.customFields).toEqual({
			project: "A booking app for salons",
			budget: "$500/mo",
		});
	});

	it("rejects keys that match no field", async () => {
		const c = await fresh();
		const result = await executeSaveLeadDetails(c, {
			details: { favourite_colour: "blue" },
		});
		expect(result.ok).toBe(false);
		expect(result.ignored).toEqual(["favourite_colour"]);
	});

	it("updates an identified lead directly", async () => {
		const c = await fresh();
		const captured = await executeCaptureContact(c, {
			email: `${tag}-details@test.local`,
		});
		await executeSaveLeadDetails(c, { details: { timeline: "next month" } });
		const lead = await prisma.lead.findUnique({
			where: { id: captured.leadId as string },
		});
		expect(lead?.customFields).toEqual({ timeline: "Next month" });
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

	it("stores the analysis and copies intent, score and need onto the lead", async () => {
		await executeSetConversationSummary(ctx(), {
			summary: "Visitor wants a quote for a salon booking app.",
			intent: "buying",
			leadScore: 85,
			qualityScore: 4,
			resolved: true,
			need: "Booking app for salons",
			unansweredQuestions: ["Do you support SMS reminders?"],
		});
		const c = await prisma.conversation.findUnique({
			where: { id: conversationId },
		});
		expect(c?.intent).toBe("buying");
		expect(c?.leadScore).toBe(85);
		expect(c?.qualityScore).toBe(4);
		expect(c?.resolved).toBe(true);
		expect(c?.insights).toEqual({
			need: "Booking app for salons",
			unansweredQuestions: ["Do you support SMS reminders?"],
			objections: [],
			nextStep: null,
			keyFacts: [],
		});
		expect(c?.leadId).not.toBeNull();
		const lead = await prisma.lead.findUnique({ where: { id: c?.leadId as string } });
		expect(lead?.intent).toBe("buying");
		expect(lead?.score).toBe(85);
		expect(lead?.need).toBe("Booking app for salons");
	});

	it("fills missing lead fields and records key facts without overwriting", async () => {
		const c = await prisma.conversation.findUnique({
			where: { id: conversationId },
			select: { leadId: true },
		});
		await prisma.lead.update({
			where: { id: c?.leadId as string },
			data: { customFields: { budget: "Edited by a teammate" } },
		});
		await executeSetConversationSummary(ctx(), {
			summary: "Salon owner, launching soon.",
			fields: [
				{ key: "budget", value: "$300" },
				{ key: "timeline", value: "this month" },
				{ key: "unknown", value: "dropped" },
			],
			keyFacts: [{ label: "Language", value: "Needs Hindi support" }],
		});
		const conv = await prisma.conversation.findUnique({
			where: { id: conversationId },
		});
		expect(conv?.leadDetails).toEqual({ budget: "$300", timeline: "This month" });
		expect((conv?.insights as { keyFacts: unknown }).keyFacts).toEqual([
			{ label: "Language", value: "Needs Hindi support" },
		]);
		const lead = await prisma.lead.findUnique({ where: { id: c?.leadId as string } });
		expect(lead?.customFields).toEqual({
			budget: "Edited by a teammate",
			timeline: "This month",
		});
		expect(lead?.keyFacts).toEqual([
			{ label: "Language", value: "Needs Hindi support" },
		]);
	});

	it("accepts a summary without sentiment or tags", async () => {
		const result = await executeSetConversationSummary(ctx(), {
			summary: "Brief exchange.",
		});
		expect(result.ok).toBe(true);
		// A thinner summary doesn't wipe the lead's earlier analysis.
		const c = await prisma.conversation.findUnique({
			where: { id: conversationId },
			include: { lead: true },
		});
		expect((c as unknown as { lead: { intent: string | null } }).lead.intent).toBe(
			"buying",
		);
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
