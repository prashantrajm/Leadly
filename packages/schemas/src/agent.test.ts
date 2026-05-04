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
