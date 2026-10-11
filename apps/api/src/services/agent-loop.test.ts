// Pure unit tests for the agent loop. assembleSystemPrompt has no IO at all;
// runTurn is exercised against AI SDK v6's MockLanguageModelV3 + the
// simulateReadableStream test helper.

import { describe, expect, it } from "bun:test";
import {
	MockLanguageModelV3,
	simulateReadableStream,
} from "ai/test";
import {
	type AgentRow,
	type IdentityState,
	assembleSystemPrompt,
	buildHistory,
	runTurn,
} from "./agent-loop";

const baseAgent: AgentRow = {
	id: "agent-1",
	name: "Acme Support",
	greeting: "Hi! How can I help?",
	systemPromptOverlay: null,
	fallbackMessage: "I don't have that information yet.",
	defaultModel: "openai/gpt-4o-mini",
	identityPolicy: "optional",
	naturalMessaging: false,
	leadCaptureEnabled: false,
	contactFields: ["name", "email", "phone"],
	leadFields: [],
};

const noIdentity: IdentityState = {
	hasEmail: false,
	hasPhone: false,
	hasName: false,
};

describe("assembleSystemPrompt", () => {
	it("includes the agent name and greeting", () => {
		const prompt = assembleSystemPrompt({
			agent: baseAgent,
			retrievedChunks: [],
			identity: noIdentity,
		});
		expect(prompt).toContain("Acme Support");
		expect(prompt).toContain("Hi! How can I help?");
	});

	it("appends the customer overlay when set", () => {
		const prompt = assembleSystemPrompt({
			agent: { ...baseAgent, systemPromptOverlay: "Always answer in haiku." },
			retrievedChunks: [],
			identity: noIdentity,
		});
		expect(prompt).toContain("Always answer in haiku.");
	});

	it("omits the overlay block when overlay is null or whitespace", () => {
		const a = assembleSystemPrompt({
			agent: baseAgent,
			retrievedChunks: [],
			identity: noIdentity,
		});
		const b = assembleSystemPrompt({
			agent: { ...baseAgent, systemPromptOverlay: "   " },
			retrievedChunks: [],
			identity: noIdentity,
		});
		expect(a).not.toContain("Custom instructions:");
		expect(b).not.toContain("Custom instructions:");
	});

	it("does NOT include the identity capture block when policy is 'optional'", () => {
		const prompt = assembleSystemPrompt({
			agent: baseAgent,
			retrievedChunks: [],
			identity: noIdentity,
		});
		expect(prompt).not.toMatch(/must provide/);
	});

	it("includes the identity capture block when required_before_chat AND fields missing", () => {
		const prompt = assembleSystemPrompt({
			agent: { ...baseAgent, identityPolicy: "required_before_chat" },
			retrievedChunks: [],
			identity: noIdentity,
		});
		expect(prompt).toMatch(/must provide/);
		expect(prompt).toContain("email");
		expect(prompt).toContain("name");
	});

	it("drops the identity block once email + name are captured", () => {
		const prompt = assembleSystemPrompt({
			agent: { ...baseAgent, identityPolicy: "required_before_chat" },
			retrievedChunks: [],
			identity: { hasEmail: true, hasPhone: false, hasName: true },
		});
		expect(prompt).not.toMatch(/must provide/);
	});

	it("surfaces the fallback message when no chunks were retrieved", () => {
		const prompt = assembleSystemPrompt({
			agent: baseAgent,
			retrievedChunks: [],
			identity: noIdentity,
		});
		expect(prompt).toContain("(none retrieved for this query)");
		expect(prompt).toContain(baseAgent.fallbackMessage);
	});

	it("formats retrieved chunks with article-citation hints", () => {
		const prompt = assembleSystemPrompt({
			agent: baseAgent,
			retrievedChunks: [
				{
					chunkId: "c1",
					articleId: "a1",
					articleTitle: "Returns Policy",
					text: "Returns within 30 days.",
					distance: 0.1,
				},
				{
					chunkId: "c2",
					articleId: "a2",
					articleTitle: "Pricing",
					text: "Free tier covers 100 conversations/month.",
					distance: 0.3,
				},
			],
			identity: noIdentity,
		});
		expect(prompt).toContain("From: Returns Policy");
		expect(prompt).toContain("Returns within 30 days.");
		expect(prompt).toContain("From: Pricing");
		expect(prompt).toContain("Free tier covers");
	});

	it("snapshot — same inputs produce the same prompt", () => {
		const a = assembleSystemPrompt({
			agent: baseAgent,
			retrievedChunks: [],
			identity: noIdentity,
		});
		const b = assembleSystemPrompt({
			agent: baseAgent,
			retrievedChunks: [],
			identity: noIdentity,
		});
		expect(a).toBe(b);
	});
});

describe("assembleSystemPrompt — natural messaging", () => {
	it("is absent by default", () => {
		const prompt = assembleSystemPrompt({
			agent: baseAgent,
			retrievedChunks: [],
			identity: noIdentity,
		});
		expect(prompt).not.toContain("Write like a person texting");
	});

	it("asks for short messages separated by blank lines when on", () => {
		const prompt = assembleSystemPrompt({
			agent: { ...baseAgent, naturalMessaging: true },
			retrievedChunks: [],
			identity: noIdentity,
		});
		expect(prompt).toContain("Write like a person texting");
		expect(prompt).toContain("Separate messages with a blank line");
	});
});

describe("assembleSystemPrompt — lead capture", () => {
	const capturing: AgentRow = {
		...baseAgent,
		leadCaptureEnabled: true,
		contactFields: ["name", "phone"],
		leadFields: [
			{
				key: "project",
				label: "Project",
				hint: "What they want to build",
				type: "text",
				mode: "ask",
			},
			{
				key: "timeline",
				label: "Timeline",
				type: "choice",
				options: ["This month", "Later"],
				mode: "ask",
			},
			{ key: "budget", label: "Budget", type: "number", mode: "listen" },
		],
	};

	it("is absent when disabled", () => {
		const prompt = assembleSystemPrompt({
			agent: { ...capturing, leadCaptureEnabled: false },
			retrievedChunks: [],
			identity: noIdentity,
		});
		expect(prompt).not.toContain("Lead capture is on");
		expect(prompt).not.toContain("offer to take their details");
	});

	it("lists missing contact and lead fields and forbids redirecting to email", () => {
		const prompt = assembleSystemPrompt({
			agent: capturing,
			retrievedChunks: [],
			identity: noIdentity,
		});
		expect(prompt).toContain("Lead capture is on");
		expect(prompt).toContain("Still needed: name, phone number.");
		expect(prompt).toContain("  - Project [project]: What they want to build");
		expect(prompt).toContain("  - Timeline [timeline]: one of: This month, Later");
		// Listen fields are noted, never asked for.
		expect(prompt).toContain("Don't ask about these");
		expect(prompt).toContain("  - Budget [budget]: a number");
		expect(prompt).toContain("Never tell the visitor to email, call, or contact the company");
		// A KB gap becomes a hand-off to the team rather than a dead end.
		expect(prompt).toContain("Then offer to take their details");
	});

	it("drops what's already known", () => {
		const prompt = assembleSystemPrompt({
			agent: capturing,
			retrievedChunks: [],
			identity: {
				hasEmail: false,
				hasPhone: true,
				hasName: true,
				capturedFields: ["project"],
			},
		});
		expect(prompt).not.toContain("Still needed");
		expect(prompt).not.toContain("[project]");
		expect(prompt).toContain("[timeline]");
	});

	it("only listens when nothing is left to ask", () => {
		const prompt = assembleSystemPrompt({
			agent: capturing,
			retrievedChunks: [],
			identity: {
				hasEmail: false,
				hasPhone: true,
				hasName: true,
				capturedFields: ["project", "timeline"],
			},
		});
		expect(prompt).toContain("[budget]");
		expect(prompt).not.toContain("Ask for one thing per reply");
	});

	it("goes quiet once everything is collected", () => {
		const prompt = assembleSystemPrompt({
			agent: capturing,
			retrievedChunks: [],
			identity: {
				hasEmail: false,
				hasPhone: true,
				hasName: true,
				capturedFields: capturing.leadFields.map((f) => f.key),
			},
		});
		expect(prompt).not.toContain("Lead capture is on");
	});
});

describe("buildHistory", () => {
	it("folds consecutive agent bubbles into one assistant message", () => {
		expect(
			buildHistory([
				{ role: "user", text: "hi" },
				{ role: "agent", text: "Hey!" },
				{ role: "agent", text: "What are you building?" },
				{ role: "tool", text: "{}" },
				{ role: "user", text: "A CRM" },
			]),
		).toEqual([
			{ role: "user", content: "hi" },
			{ role: "assistant", content: "Hey!\n\nWhat are you building?" },
			{ role: "user", content: "A CRM" },
		]);
	});
});

describe("runTurn", () => {
	function makeStreamingModel(parts: string[]): MockLanguageModelV3 {
		// LanguageModelV3 usage shape — input/output tokens are objects with
		// total/noCache/cacheRead/cacheWrite breakdown. AI SDK rolls those up
		// into LanguageModelUsage with flat inputTokens/outputTokens for the
		// app-level callback.
		// LanguageModelV3 usage shape — input/output tokens are objects with
		// distinct breakdowns. AI SDK's stream rolls those up into the flat
		// inputTokens/outputTokens we read in runTurn.
		const usage = {
			inputTokens: {
				total: 10 as number | undefined,
				noCache: 10 as number | undefined,
				cacheRead: 0 as number | undefined,
				cacheWrite: 0 as number | undefined,
			},
			outputTokens: {
				total: 5 as number | undefined,
				text: 5 as number | undefined,
				reasoning: 0 as number | undefined,
			},
		};
		// Use the bundled provider type for the stream-part shape. We'd import
		// LanguageModelV3StreamPart from @ai-sdk/provider directly but that
		// isn't a workspace dep — `ai` ships these types transitively.
		const chunks = [
			{ type: "stream-start", warnings: [] },
			{ type: "text-start", id: "1" },
			...parts.map((delta) => ({ type: "text-delta", id: "1", delta })),
			{ type: "text-end", id: "1" },
			{
				type: "finish",
				// LanguageModelV3FinishReason is an object, not a string —
				// `unified` is the cross-provider canonical reason and `raw`
				// is what the provider actually emitted.
				finishReason: { unified: "stop" as const, raw: "stop" },
				usage,
			},
		];
		return new MockLanguageModelV3({
			doStream: async () => ({
				// biome-ignore lint/suspicious/noExplicitAny: provider stream-part union not surfaced from `ai`
				stream: simulateReadableStream({ chunks: chunks as any }),
			}),
		});
	}

	it("streams tokens and assembles the full text", async () => {
		const model = makeStreamingModel(["Hello", " there", "!"]);
		const tokens: string[] = [];
		const result = await runTurn({
			model,
			system: "be helpful",
			history: [],
			userMessage: "hi",
			onToken: (d) => tokens.push(d),
		});
		expect(tokens).toEqual(["Hello", " there", "!"]);
		expect(result.text).toBe("Hello there!");
		expect(result.finishReason).toBe("stop");
		expect(result.tokensIn).toBe(10);
		expect(result.tokensOut).toBe(5);
	});

	it("passes prior history + the new user message in order", async () => {
		const model = makeStreamingModel(["ok"]);
		await runTurn({
			model,
			system: "sys",
			history: [
				{ role: "user", content: "first" },
				{ role: "assistant", content: "second" },
			],
			userMessage: "third",
		});
		expect(model.doStreamCalls).toHaveLength(1);
		const call = model.doStreamCalls[0];
		// streamText converts our messages + system into LanguageModelV3 prompt
		// shape. Last entry must be the user message we just supplied.
		const last = call.prompt[call.prompt.length - 1];
		expect(last.role).toBe("user");
	});
});
