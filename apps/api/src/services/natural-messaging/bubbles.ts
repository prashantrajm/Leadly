// The hard rule behind the natural-messaging prompt. BubbleSplitter cuts
// the token stream at blank lines as it arrives, so each bubble streams in
// on its own; splitLongBubble breaks a bubble that still came out as a
// paragraph into chunks of at most two sentences.

export type BubbleEvent = { kind: "text"; delta: string } | { kind: "break" };

export const MAX_BUBBLE_CHARS = 220;

const BREAK = /\n[ \t]*\n\s*/;

export class BubbleSplitter {
	private pending = "";
	// True until the current bubble has received non-whitespace text, so
	// leading newlines never open an empty bubble.
	private atBubbleStart = true;

	push(delta: string): BubbleEvent[] {
		this.pending += delta;
		const events: BubbleEvent[] = [];

		for (;;) {
			const match = BREAK.exec(this.pending);
			if (!match) break;
			// A break at the very end may still be growing ("\n\n" + more
			// whitespace); wait for real text before committing to it.
			if (match.index + match[0].length === this.pending.length) break;
			this.emitText(this.pending.slice(0, match.index), events);
			if (!this.atBubbleStart) {
				events.push({ kind: "break" });
				this.atBubbleStart = true;
			}
			this.pending = this.pending.slice(match.index + match[0].length);
		}

		// Hold back a trailing newline run — it might be the first half of a
		// blank-line break. Everything before it is safe to stream.
		const tail = /\n[ \t\n]*$/.exec(this.pending);
		const safeEnd = tail ? tail.index : this.pending.length;
		this.emitText(this.pending.slice(0, safeEnd), events);
		this.pending = this.pending.slice(safeEnd);
		return events;
	}

	finish(): BubbleEvent[] {
		const events: BubbleEvent[] = [];
		this.emitText(this.pending.trimEnd(), events);
		this.pending = "";
		return events;
	}

	private emitText(text: string, events: BubbleEvent[]): void {
		const out = this.atBubbleStart ? text.replace(/^\s+/, "") : text;
		if (out.length === 0) return;
		this.atBubbleStart = false;
		events.push({ kind: "text", delta: out });
	}
}

// Break an over-long bubble into chunks of at most two sentences and
// MAX_BUBBLE_CHARS. A single sentence longer than the cap stays whole —
// cutting mid-sentence reads worse than a long bubble.
export function splitLongBubble(
	text: string,
	maxChars = MAX_BUBBLE_CHARS,
): string[] {
	const trimmed = text.trim();
	if (trimmed.length <= maxChars) return trimmed ? [trimmed] : [];
	// Lists and code keep their shape; splitting them by sentence mangles them.
	if (/^\s*([-*•]|\d+\.)\s/m.test(trimmed) || trimmed.includes("```")) {
		return [trimmed];
	}

	const sentences = trimmed.match(/[^.!?]+(?:[.!?]+["')\]]*|$)\s*/g) ?? [
		trimmed,
	];
	const chunks: string[] = [];
	let current = "";
	let count = 0;
	for (const raw of sentences) {
		const sentence = raw.trim();
		if (!sentence) continue;
		const candidate = current ? `${current} ${sentence}` : sentence;
		if (current && (count >= 2 || candidate.length > maxChars)) {
			chunks.push(current);
			current = sentence;
			count = 1;
		} else {
			current = candidate;
			count += 1;
		}
	}
	if (current) chunks.push(current);
	return chunks;
}
