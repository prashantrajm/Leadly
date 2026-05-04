// KbReembedWorkflow — durable, multi-step re-embedding of one KB article.
// Triggered from the KB CRUD routes (create + update). Workflows give us
// automatic retries on transient errors (e.g. an OpenRouter blip during
// embedMany) without us having to wire in a queue + retry policy ourselves.
//
// Steps:
//   1. load article from Postgres
//   2. split markdown into chunks (pure function)
//   3. call OpenRouter embeddings for the batch
//   4. atomic replace: delete old chunks for this article, insert new ones
//
// The atomic replace happens in a transaction so the article is never in a
// half-rebuilt state where retrieval would return some stale chunks and some
// new ones for the same content.

import { WorkflowEntrypoint, type WorkflowStep } from "cloudflare:workers";
import type { WorkflowEvent } from "cloudflare:workers";
import { Prisma } from "../generated/client/client";
import { splitMarkdown } from "../lib/chunker";
import {
	EMBEDDING_DIM,
	makeEmbeddingsClient,
} from "../lib/embeddings";
import { getPrisma } from "../lib/prisma";
import type { Bindings } from "../types";

export type KbReembedParams = { articleId: string };

export class KbReembedWorkflow extends WorkflowEntrypoint<
	Bindings,
	KbReembedParams
> {
	async run(event: WorkflowEvent<KbReembedParams>, step: WorkflowStep) {
		const { articleId } = event.payload;
		const prisma = getPrisma(this.env.DATABASE_URL);

		// Step 1 — load the article. Cheap read; isolating it as a step
		// gives Workflow's UI a clear "article missing" failure surface.
		const article = await step.do("load-article", async () => {
			const row = await prisma.kbArticle.findUnique({
				where: { id: articleId },
				select: {
					id: true,
					organizationId: true,
					agentId: true,
					contentMarkdown: true,
				},
			});
			if (!row) {
				throw new Error(`KbArticle ${articleId} not found`);
			}
			return row;
		});

		// Step 2 — chunk. Pure function; no need to persist between attempts,
		// but wrapping in step.do gives us a checkpoint and a friendly UI row.
		const chunks = await step.do("split-markdown", async () => {
			return splitMarkdown(article.contentMarkdown);
		});

		if (chunks.length === 0) {
			// Empty article — wipe any stale chunks so retrieval reflects the
			// new (empty) state. No embedding call needed.
			await step.do("clear-chunks", async () => {
				await prisma.kbChunk.deleteMany({ where: { articleId } });
			});
			return { articleId, chunkCount: 0 };
		}

		// Step 3 — embed all chunks in one batch. OpenRouter's text-embedding-
		// 3-small handles up to ~2048 inputs per call; 50KB / 500-token chunks
		// = ~25 chunks max per article, comfortably within that limit.
		const embeddings = await step.do("embed", async () => {
			const client = makeEmbeddingsClient({
				OPENROUTER_API_KEY: this.env.OPENROUTER_API_KEY,
			});
			return client.embedBatch(chunks.map((c) => c.text));
		});

		if (embeddings.length !== chunks.length) {
			throw new Error(
				`Embedding count mismatch: got ${embeddings.length} vectors for ${chunks.length} chunks`,
			);
		}

		// Step 4 — atomic replace. Transaction guarantees the old + new sets
		// never coexist for retrieval. Vector inserts go through raw SQL
		// because Prisma's typed client can't bind a vector literal yet.
		const written = await step.do("replace-chunks", async () => {
			return prisma.$transaction(async (tx) => {
				await tx.kbChunk.deleteMany({ where: { articleId } });
				let inserted = 0;
				for (let i = 0; i < chunks.length; i++) {
					const c = chunks[i];
					const vec = embeddings[i];
					if (vec.length !== EMBEDDING_DIM) {
						throw new Error(
							`Vector ${i} dim ${vec.length} != ${EMBEDDING_DIM}`,
						);
					}
					// pgvector accepts the textual "[0.1,0.2,...]" form; we
					// build it ourselves rather than trusting Prisma to
					// stringify a number[].
					const literal = `[${vec.join(",")}]`;
					await tx.$executeRaw`
						INSERT INTO "kb_chunk"
							("id", "organizationId", "agentId", "articleId",
							 "ord", "text", "tokens", "embedding", "createdAt")
						VALUES (
							${cuid()},
							${article.organizationId},
							${article.agentId},
							${articleId},
							${c.ord},
							${c.text},
							${c.tokens},
							${literal}::vector,
							NOW()
						)
					`;
					inserted++;
				}
				return inserted;
			});
		});

		return { articleId, chunkCount: written };
	}
}

// Lightweight cuid-ish id (Workers don't ship Node's crypto.randomUUID by
// default; Web Crypto's getRandomValues is what we have). Same approach as
// routes/kb.ts; kept local so this file has no app-layer imports beyond
// embeddings + prisma.
function cuid(): string {
	const bytes = new Uint8Array(16);
	crypto.getRandomValues(bytes);
	let out = "";
	for (const b of bytes) out += b.toString(36).padStart(2, "0");
	return out.slice(0, 22);
}

// Re-export Prisma's namespace so the deleteMany/transaction calls type-check
// even when the @prisma/extension-accelerate types are stripped (#28703).
void Prisma;
