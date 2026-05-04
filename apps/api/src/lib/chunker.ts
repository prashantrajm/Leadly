// Pure-function markdown chunker for the KB pipeline.
//
// Strategy (per design §3.1):
//   1. Split the source on H2 (`##`) boundaries — H2 is how customers
//      structure long policy / FAQ docs; the agent cites by section.
//   2. If a section exceeds the token target, fall back to splitting that
//      section on blank-line paragraph boundaries.
//   3. Never split inside a fenced code block (``` … ``` or ~~~ … ~~~).
//
// Tokens are estimated, not exact. We use ~4 chars/token, which over-counts
// for code-heavy text and under-counts for very prose-heavy text but is the
// standard "good enough" heuristic for English markdown. The DB stores the
// estimate; retrieval doesn't depend on it being precise.

const TARGET_TOKENS = 500;
const HARD_MAX_TOKENS = 1200; // never emit a chunk above this
const CHARS_PER_TOKEN = 4;

export type Chunk = { ord: number; text: string; tokens: number };

export function splitMarkdown(input: string): Chunk[] {
	const sections = splitOnH2(input);
	const out: Chunk[] = [];
	let ord = 0;

	for (const section of sections) {
		const tokens = estimateTokens(section);
		if (tokens <= HARD_MAX_TOKENS) {
			const trimmed = section.trim();
			if (trimmed.length === 0) continue;
			out.push({ ord: ord++, text: trimmed, tokens });
			continue;
		}
		// Section is too big — split on blank-line paragraph boundaries.
		for (const para of splitOnBlankLines(section)) {
			const trimmed = para.trim();
			if (trimmed.length === 0) continue;
			out.push({
				ord: ord++,
				text: trimmed,
				tokens: estimateTokens(trimmed),
			});
		}
	}

	return out.length === 0 ? maybeWholeFallback(input, ord) : out;
}

// ---------- splitting helpers ----------

// Splits on H2 boundaries while respecting fenced code blocks. The result is
// an array where the first element may be the pre-H2 preamble (often empty).
// H2 lines are kept with their following section.
function splitOnH2(input: string): string[] {
	const lines = input.split(/\r?\n/);
	const sections: string[] = [];
	let buf: string[] = [];
	let inFence = false;
	let fenceMarker: string | null = null;

	for (const line of lines) {
		const trimmed = line.trimStart();

		// Track fenced code blocks so we don't split heading-looking
		// lines inside them.
		const fenceMatch = trimmed.match(/^(```+|~~~+)/);
		if (fenceMatch) {
			if (!inFence) {
				inFence = true;
				fenceMarker = fenceMatch[1];
			} else if (fenceMarker && trimmed.startsWith(fenceMarker)) {
				inFence = false;
				fenceMarker = null;
			}
		}

		const isH2 = !inFence && /^##\s+/.test(trimmed);
		if (isH2 && buf.length > 0) {
			sections.push(buf.join("\n"));
			buf = [];
		}
		buf.push(line);
	}
	if (buf.length > 0) sections.push(buf.join("\n"));
	return sections;
}

// Paragraph splitter for over-large sections. Same fence-awareness rule —
// blank lines inside a code block don't separate paragraphs.
function splitOnBlankLines(input: string): string[] {
	const lines = input.split(/\r?\n/);
	const paragraphs: string[] = [];
	let buf: string[] = [];
	let inFence = false;
	let fenceMarker: string | null = null;

	for (const line of lines) {
		const trimmed = line.trimStart();
		const fenceMatch = trimmed.match(/^(```+|~~~+)/);
		if (fenceMatch) {
			if (!inFence) {
				inFence = true;
				fenceMarker = fenceMatch[1];
			} else if (fenceMarker && trimmed.startsWith(fenceMarker)) {
				inFence = false;
				fenceMarker = null;
			}
		}

		const isBlank = !inFence && line.trim().length === 0;
		if (isBlank) {
			if (buf.length > 0) {
				paragraphs.push(buf.join("\n"));
				buf = [];
			}
		} else {
			buf.push(line);
		}
	}
	if (buf.length > 0) paragraphs.push(buf.join("\n"));

	// Glue tiny paragraphs into TARGET_TOKENS-sized batches so we don't
	// emit one chunk per sentence.
	return packParagraphs(paragraphs);
}

function packParagraphs(paragraphs: string[]): string[] {
	const packed: string[] = [];
	let bucket: string[] = [];
	let bucketTokens = 0;

	for (const p of paragraphs) {
		const t = estimateTokens(p);
		if (bucketTokens + t > TARGET_TOKENS && bucket.length > 0) {
			packed.push(bucket.join("\n\n"));
			bucket = [];
			bucketTokens = 0;
		}
		bucket.push(p);
		bucketTokens += t;
	}
	if (bucket.length > 0) packed.push(bucket.join("\n\n"));
	return packed;
}

// Fallback for inputs that produce no chunks (whitespace-only, single empty
// section, etc). We return one chunk containing the original text trimmed,
// so the article isn't completely invisible to retrieval.
function maybeWholeFallback(input: string, ord: number): Chunk[] {
	const trimmed = input.trim();
	if (trimmed.length === 0) return [];
	return [{ ord, text: trimmed, tokens: estimateTokens(trimmed) }];
}

// Token estimator. Cheap, deterministic, doesn't import a tokenizer (we don't
// want a 5MB BPE table on a Worker bundle). Adequate for chunk sizing.
export function estimateTokens(s: string): number {
	return Math.max(1, Math.ceil(s.length / CHARS_PER_TOKEN));
}
