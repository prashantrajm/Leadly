import { describe, expect, it } from "bun:test";
import {
	AgentSchema,
	CreateAgentSchema,
	UpdateAgentSchema,
} from "./agent.ts";

const validAgent = {
	id: "clx1",
	organizationId: "clx2",
	name: "Acme Support",
	slug: "acme-support",
	greeting: "Hi! How can I help?",
	accentColor: "#0F172A",
	identityPolicy: "optional" as const,
	defaultProvider: "openai" as const,
	defaultModel: "gpt-4o-mini",
	systemPromptOverlay: null,
	fallbackMessage: "I don't have that info yet.",
	maxTurns: 50,
	naturalMessaging: false,
	leadCaptureEnabled: false,
	contactFields: ["name", "email", "phone"] as Array<"name" | "email" | "phone">,
	leadFields: [
		{ key: "budget", label: "Budget", type: "text" as const, mode: "ask" as const },
	],
	captureNotableDetails: true,
	createdAt: "2026-05-04T15:00:00.000Z",
	updatedAt: "2026-05-04T15:00:00.000Z",
};

describe("AgentSchema", () => {
	it("round-trips a valid agent", () => {
		expect(AgentSchema.parse(validAgent)).toEqual(validAgent);
	});

	it("rejects unknown identityPolicy", () => {
		const bad = { ...validAgent, identityPolicy: "always" };
		expect(() => AgentSchema.parse(bad)).toThrow();
	});

	it("rejects bad ISO date", () => {
		const bad = { ...validAgent, createdAt: "yesterday" };
		expect(() => AgentSchema.parse(bad)).toThrow();
	});
});

describe("CreateAgentSchema", () => {
	it("accepts minimum input — name only", () => {
		const result = CreateAgentSchema.parse({ name: "My Agent" });
		expect(result.name).toBe("My Agent");
	});

	it("rejects too-short name", () => {
		expect(() => CreateAgentSchema.parse({ name: "x" })).toThrow();
	});

	it("rejects too-long name", () => {
		expect(() => CreateAgentSchema.parse({ name: "x".repeat(81) })).toThrow();
	});

	it("rejects bad hex colour", () => {
		expect(() =>
			CreateAgentSchema.parse({ name: "ok", accentColor: "blue" }),
		).toThrow();
	});

	it("accepts 3-digit hex", () => {
		const result = CreateAgentSchema.parse({ name: "ok", accentColor: "#fff" });
		expect(result.accentColor).toBe("#fff");
	});

	it("rejects maxTurns above limit", () => {
		expect(() =>
			CreateAgentSchema.parse({ name: "ok", maxTurns: 1000 }),
		).toThrow();
	});
});

describe("lead fields", () => {
	const budget = { key: "budget", label: "Budget", type: "text", mode: "ask" };

	it("accepts a field list", () => {
		const result = CreateAgentSchema.parse({
			name: "ok",
			leadFields: [
				budget,
				{
					key: "plan",
					label: "Plan",
					type: "choice",
					options: ["Starter", "Pro"],
					mode: "listen",
				},
			],
		});
		expect(result.leadFields).toHaveLength(2);
	});

	it("rejects duplicate keys", () => {
		expect(() =>
			CreateAgentSchema.parse({ name: "ok", leadFields: [budget, budget] }),
		).toThrow();
	});

	it("rejects a key that isn't snake_case", () => {
		expect(() =>
			CreateAgentSchema.parse({
				name: "ok",
				leadFields: [{ ...budget, key: "Budget USD" }],
			}),
		).toThrow();
	});

	it("requires options on a choice field", () => {
		expect(() =>
			CreateAgentSchema.parse({
				name: "ok",
				leadFields: [{ ...budget, type: "choice", options: ["Only one"] }],
			}),
		).toThrow();
	});
});

describe("UpdateAgentSchema", () => {
	it("accepts an empty patch", () => {
		expect(UpdateAgentSchema.parse({})).toEqual({});
	});

	it("rejects an invalid slug", () => {
		expect(() => UpdateAgentSchema.parse({ slug: "Bad Slug" })).toThrow();
	});

	it("accepts a valid slug", () => {
		const result = UpdateAgentSchema.parse({ slug: "acme-2026" });
		expect(result.slug).toBe("acme-2026");
	});
});
