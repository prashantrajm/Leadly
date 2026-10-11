// Turns one streamed agent reply into wire frames and the Turn rows to
// persist. Standard replies are a single bubble; natural messaging gives
// each bubble its own turnId, which widgets already render as separate
// messages, so the protocol needs no new frame.

import type { ServerFrame } from "@leadly/wire";
import { BubbleSplitter, splitLongBubble } from "./bubbles";

export type ReplyBubble = { turnId: string; text: string };

export type ReplyStreamOptions = {
	natural: boolean;
	newId: () => string;
	emit: (frame: ServerFrame) => void;
};

export class ReplyStream {
	private readonly firstTurnId: string;
	private bubble: ReplyBubble;
	private readonly closed: ReplyBubble[] = [];
	private readonly splitter: BubbleSplitter | null;

	constructor(private readonly opts: ReplyStreamOptions) {
		this.firstTurnId = opts.newId();
		this.bubble = { turnId: this.firstTurnId, text: "" };
		this.splitter = opts.natural ? new BubbleSplitter() : null;
	}

	// The bubble being written; tool frames attach to it.
	get turnId(): string {
		return this.bubble.turnId;
	}

	push(delta: string): void {
		if (!this.splitter) {
			this.appendText(delta);
			return;
		}
		this.apply(this.splitter.push(delta));
	}

	// Closes the reply and returns the bubbles to persist, in order. Always
	// at least one, so a tool-call-only reply still leaves an agent row.
	finish(finishReason: string): ReplyBubble[] {
		if (!this.splitter) {
			this.opts.emit({
				type: "agent_turn_end",
				turnId: this.bubble.turnId,
				text: this.bubble.text,
				finishReason,
			});
			return [this.bubble];
		}
		this.apply(this.splitter.finish());
		this.closeBubble(finishReason);
		return this.closed.length > 0
			? this.closed
			: [{ turnId: this.firstTurnId, text: "" }];
	}

	private apply(events: ReturnType<BubbleSplitter["push"]>): void {
		for (const event of events) {
			if (event.kind === "text") {
				this.appendText(event.delta);
				continue;
			}
			// More text follows a break, so show "typing…" until it arrives.
			this.closeBubble("stop");
			this.bubble = { turnId: this.opts.newId(), text: "" };
			this.opts.emit({ type: "typing", on: true });
		}
	}

	private appendText(delta: string): void {
		this.bubble.text += delta;
		this.opts.emit({ type: "agent_token", turnId: this.bubble.turnId, delta });
	}

	// Over-long bubbles are split as soon as they close, so the pieces land
	// before the next bubble starts streaming.
	private closeBubble(finishReason: string): void {
		const pieces = splitLongBubble(this.bubble.text);
		for (const [i, text] of pieces.entries()) {
			const piece = {
				turnId: i === 0 ? this.bubble.turnId : this.opts.newId(),
				text,
			};
			this.closed.push(piece);
			this.opts.emit({
				type: "agent_turn_end",
				turnId: piece.turnId,
				text: piece.text,
				finishReason,
			});
		}
	}
}
