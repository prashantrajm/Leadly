// Embeddings for KB chunking + retrieval queries. Goes through OpenRouter
// (the single LLM provider in v1) using the @openrouter/ai-sdk-provider's
// textEmbeddingModel and AI SDK v6's embedMany / embed.
//
// Output dimension is 1536, matching the kb_chunk.embedding column declared
// in domain.prisma and the HNSW index built on it. Changing the model
// requires a column-shape change + reindex.

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { embed, embedMany } from "ai";

// OpenRouter routes "openai/text-embedding-3-small" to the underlying
// OpenAI embedding endpoint. 1536-dim output; ~$0.02 per million tokens.
// We pin the id here rather than read it from env so the column dimension
// and the model output dimension can never drift apart at runtime.
export const EMBEDDING_MODEL_ID = "openai/text-embedding-3-small";
export const EMBEDDING_DIM = 1536;

export type EmbeddingsClient = {
	embedOne: (text: string) => Promise<number[]>;
	embedBatch: (texts: string[]) => Promise<number[][]>;
};

export function makeEmbeddingsClient(env: {
	OPENROUTER_API_KEY: string;
}): EmbeddingsClient {
	const provider = createOpenRouter({ apiKey: env.OPENROUTER_API_KEY });
	const model = provider.textEmbeddingModel(EMBEDDING_MODEL_ID);

	return {
		embedOne: async (text) => {
			const { embedding } = await embed({ model, value: text });
			assertDim(embedding);
			return embedding;
		},
		embedBatch: async (texts) => {
			if (texts.length === 0) return [];
			const { embeddings } = await embedMany({ model, values: texts });
			for (const e of embeddings) assertDim(e);
			return embeddings;
		},
	};
}

function assertDim(v: number[]) {
	if (v.length !== EMBEDDING_DIM) {
		throw new Error(
			`Embedding dimension mismatch: got ${v.length}, expected ${EMBEDDING_DIM}. ` +
				`Check EMBEDDING_MODEL_ID matches the kb_chunk.embedding column shape.`,
		);
	}
}
