// pgvector retrieval. Single agent-scoped raw SQL query that returns the top-k
// nearest chunks for a query embedding, joined to the parent article so the
// agent can cite "From: Returns Policy" without a second fetch.
//
// The HNSW index on kb_chunk.embedding (cosine_ops) makes this O(log N) — the
// `embedding <=> $vec` operator picks up the index automatically.

import { getPrisma } from "./prisma";
import { EMBEDDING_DIM, makeEmbeddingsClient } from "./embeddings";

export type RetrievedChunk = {
	chunkId: string;
	articleId: string;
	articleTitle: string;
	text: string;
	distance: number; // cosine distance, 0 (identical) → 2 (opposite)
};

const DEFAULT_K = 5;

export async function retrieveTopK(
	databaseUrl: string,
	agentId: string,
	queryEmbedding: number[],
	k: number = DEFAULT_K,
): Promise<RetrievedChunk[]> {
	if (queryEmbedding.length !== EMBEDDING_DIM) {
		throw new Error(
			`retrieveTopK: query embedding dim ${queryEmbedding.length} != ${EMBEDDING_DIM}`,
		);
	}

	const prisma = getPrisma(databaseUrl);
	// pgvector's textual literal form keeps us out of Prisma parameter-binding
	// edge cases where number[] gets serialized as a Postgres array, not a
	// vector. Same approach as the workflow's chunk insert.
	const literal = `[${queryEmbedding.join(",")}]`;

	type Row = {
		chunkId: string;
		articleId: string;
		articleTitle: string;
		text: string;
		distance: number;
	};

	const rows = await prisma.$queryRaw<Row[]>`
		SELECT
			c."id"        AS "chunkId",
			a."id"        AS "articleId",
			a."title"     AS "articleTitle",
			c."text"      AS "text",
			(c."embedding" <=> ${literal}::vector) AS "distance"
		FROM "kb_chunk" c
		JOIN "kb_article" a ON a."id" = c."articleId"
		WHERE c."agentId" = ${agentId}
		ORDER BY c."embedding" <=> ${literal}::vector
		LIMIT ${k}
	`;

	// Postgres returns numeric distances as JS numbers via Prisma; defensively
	// coerce in case Prisma 7 ever decides to surface a Decimal here.
	return rows.map((r) => ({
		chunkId: r.chunkId,
		articleId: r.articleId,
		articleTitle: r.articleTitle,
		text: r.text,
		distance: Number(r.distance),
	}));
}

// Convenience helper — embed the user's last message verbatim and run top-k
// in one call. The agent loop uses this on every turn (design §3.2 keeps the
// retrieval query as the literal user message; LLM-rewrite is v1.5).
export async function retrieveForQuery(
	env: { DATABASE_URL: string; OPENROUTER_API_KEY: string },
	agentId: string,
	query: string,
	k: number = DEFAULT_K,
): Promise<RetrievedChunk[]> {
	const client = makeEmbeddingsClient({
		OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
	});
	const vec = await client.embedOne(query);
	return retrieveTopK(env.DATABASE_URL, agentId, vec, k);
}
