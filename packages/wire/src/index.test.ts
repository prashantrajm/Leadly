// Round-trip every frame through its parser. The DO and the widget both
// trust @leadly/wire to validate inbound frames, so a regression here would
// cascade — these tests are the contract.

import { describe, expect, it } from "bun:test";
import {
	parseClientFrame,
	parseInbound,
	parseObserverFrame,
	parseServerFrame,
} from "./index";

describe("ClientFrame", () => {
	it("parses widget_hello", () => {
		const f = parseClientFrame({ type: "widget_hello", visitorToken: "tok" });
		expect(f.type).toBe("widget_hello");
	});

	it("parses user_msg with text", () => {
		const f = parseClientFrame({ type: "user_msg", text: "hi" });
		expect(f).toEqual({ type: "user_msg", text: "hi" });
	});

	it("parses ping", () => {
		expect(parseClientFrame({ type: "ping" })).toEqual({ type: "ping" });
	});

	it("parses end_chat", () => {
		expect(parseClientFrame({ type: "end_chat" })).toEqual({
			type: "end_chat",
		});
	});

	it("rejects unknown type", () => {
		expect(() => parseClientFrame({ type: "explode" })).toThrow();
	});

	it("rejects user_msg with empty text", () => {
		expect(() => parseClientFrame({ type: "user_msg", text: "" })).toThrow();
	});

	it("rejects user_msg over 4000 chars", () => {
		expect(() =>
			parseClientFrame({ type: "user_msg", text: "x".repeat(4001) }),
		).toThrow();
	});

	it("rejects widget_hello with no token", () => {
		expect(() =>
			parseClientFrame({ type: "widget_hello", visitorToken: "" }),
		).toThrow();
	});
});

describe("ServerFrame", () => {
	it("parses agent_token", () => {
		const f = parseServerFrame({
			type: "agent_token",
			turnId: "t1",
			delta: "Hi",
		});
		expect(f.type).toBe("agent_token");
	});

	it("parses agent_turn_end", () => {
		const f = parseServerFrame({
			type: "agent_turn_end",
			turnId: "t1",
			text: "Hi there",
			finishReason: "stop",
		});
		expect(f.type).toBe("agent_turn_end");
	});

	it("parses tool_call with arbitrary args", () => {
		const f = parseServerFrame({
			type: "tool_call",
			turnId: "t1",
			toolCallId: "tc1",
			name: "capture_contact",
			args: { email: "a@b.co" },
		});
		expect(f.type).toBe("tool_call");
	});

	it("parses tool_result", () => {
		const f = parseServerFrame({
			type: "tool_result",
			turnId: "t1",
			toolCallId: "tc1",
			name: "capture_contact",
			result: { ok: true, leadId: "l1" },
		});
		expect(f.type).toBe("tool_result");
	});

	it("parses typing on/off", () => {
		expect(parseServerFrame({ type: "typing", on: true }).type).toBe("typing");
		expect(parseServerFrame({ type: "typing", on: false }).type).toBe("typing");
	});

	it("parses mode_change", () => {
		expect(
			parseServerFrame({ type: "mode_change", mode: "auto" }).type,
		).toBe("mode_change");
		expect(
			parseServerFrame({ type: "mode_change", mode: "paused" }).type,
		).toBe("mode_change");
	});

	it("rejects mode_change with bogus mode", () => {
		expect(() =>
			parseServerFrame({ type: "mode_change", mode: "frozen" }),
		).toThrow();
	});

	it("parses error frame with each known code", () => {
		for (const code of [
			"unauthenticated",
			"forbidden",
			"rate_limited",
			"internal",
			"invalid_frame",
		] as const) {
			const f = parseServerFrame({ type: "error", code, message: "x" });
			expect(f.type).toBe("error");
		}
	});

	it("rejects error frame with unknown code", () => {
		expect(() =>
			parseServerFrame({ type: "error", code: "boom", message: "x" }),
		).toThrow();
	});

	it("parses pong", () => {
		expect(parseServerFrame({ type: "pong" }).type).toBe("pong");
	});

	it("parses human_msg", () => {
		const f = parseServerFrame({
			type: "human_msg",
			turnId: "t1",
			text: "hi from a human",
		});
		expect(f.type).toBe("human_msg");
	});

	it("parses conversation_ended", () => {
		const f = parseServerFrame({
			type: "conversation_ended",
			resolution: "resolved",
			endedBy: "operator",
			note: "done",
		});
		expect(f.type).toBe("conversation_ended");
	});
});

describe("ObserverFrame", () => {
	it("parses observer_hello", () => {
		const f = parseObserverFrame({ type: "observer_hello", observerToken: "t" });
		expect(f.type).toBe("observer_hello");
	});

	it("parses observer_take_over / observer_release", () => {
		expect(parseObserverFrame({ type: "observer_take_over" }).type).toBe(
			"observer_take_over",
		);
		expect(parseObserverFrame({ type: "observer_release" }).type).toBe(
			"observer_release",
		);
	});

	it("parses observer_human_msg", () => {
		const f = parseObserverFrame({
			type: "observer_human_msg",
			text: "hi from operator",
		});
		expect(f.type).toBe("observer_human_msg");
	});

	it("parses observer_end_conversation", () => {
		const f = parseObserverFrame({
			type: "observer_end_conversation",
			note: "done",
		});
		expect(f.type).toBe("observer_end_conversation");
	});

	it("parses ping (shared with client)", () => {
		expect(parseObserverFrame({ type: "ping" }).type).toBe("ping");
	});

	it("rejects unknown observer type", () => {
		expect(() => parseObserverFrame({ type: "user_msg", text: "hi" })).toThrow();
	});
});

describe("parseInbound", () => {
	it("routes 'client' to ClientFrame", () => {
		const f = parseInbound(
			JSON.stringify({ type: "user_msg", text: "hi" }),
			"client",
		);
		expect(f.type).toBe("user_msg");
	});

	it("routes 'observer' to ObserverFrame", () => {
		const f = parseInbound(
			JSON.stringify({ type: "observer_take_over" }),
			"observer",
		);
		expect(f.type).toBe("observer_take_over");
	});

	it("rejects malformed JSON", () => {
		expect(() => parseInbound("{not json}", "client")).toThrow();
	});

	it("rejects a server-only frame coming from the client side", () => {
		expect(() =>
			parseInbound(
				JSON.stringify({ type: "agent_token", turnId: "t", delta: "x" }),
				"client",
			),
		).toThrow();
	});
});
