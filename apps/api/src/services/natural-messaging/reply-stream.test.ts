import { describe, expect, it } from "bun:test";
import type { ServerFrame } from "@leadly/wire";
import { ReplyStream } from "./reply-stream";

function setup(natural: boolean) {
	let n = 0;
	const frames: ServerFrame[] = [];
	const stream = new ReplyStream({
		natural,
		newId: () => `t${++n}`,
		emit: (f) => frames.push(f),
	});
	return { stream, frames };
}

const ends = (frames: ServerFrame[]) =>
	frames.flatMap((f) =>
		f.type === "agent_turn_end" ? [{ turnId: f.turnId, text: f.text }] : [],
	);

describe("ReplyStream", () => {
	it("keeps a standard reply in one bubble", () => {
		const { stream, frames } = setup(false);
		stream.push("Hello.\n\nWorld.");
		expect(stream.finish("stop")).toEqual([
			{ turnId: "t1", text: "Hello.\n\nWorld." },
		]);
		expect(ends(frames)).toEqual([{ turnId: "t1", text: "Hello.\n\nWorld." }]);
	});

	it("gives each natural bubble its own turn, in order", () => {
		const { stream, frames } = setup(true);
		stream.push("Sure.\n");
		expect(stream.turnId).toBe("t1");
		stream.push("\nWhat are you building?");
		expect(stream.turnId).toBe("t2");
		const bubbles = stream.finish("stop");
		expect(bubbles).toEqual([
			{ turnId: "t1", text: "Sure." },
			{ turnId: "t2", text: "What are you building?" },
		]);
		expect(ends(frames)).toEqual(bubbles);
		expect(frames).toContainEqual({ type: "typing", on: true });
	});

	it("splits an over-long bubble as soon as it closes", () => {
		const { stream, frames } = setup(true);
		const paragraph = `${"One sentence here. ".repeat(14).trim()}`;
		stream.push(`${paragraph}\n\nLast.`);
		const bubbles = stream.finish("stop");
		expect(bubbles.length).toBeGreaterThan(2);
		expect(bubbles.at(-1)?.text).toBe("Last.");
		expect(ends(frames).map((b) => b.turnId)).toEqual(
			bubbles.map((b) => b.turnId),
		);
	});

	it("persists one empty row for a tool-call-only reply", () => {
		const { stream } = setup(true);
		expect(stream.finish("tool-calls")).toEqual([{ turnId: "t1", text: "" }]);
	});
});
