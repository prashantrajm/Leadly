-- DropIndex (idempotent — Prisma's drift detection drops this even though
-- it lives in the init migration's raw-SQL section).
DROP INDEX IF EXISTS "kb_chunk_embedding_hnsw_idx";

-- AlterTable
ALTER TABLE "agent" ALTER COLUMN "defaultProvider" SET DEFAULT 'openrouter',
ALTER COLUMN "defaultModel" SET DEFAULT 'openai/gpt-4o-mini';

-- Re-create the HNSW index that the schema's embedding column relies on but
-- Prisma's drift detection keeps dropping (it can't see the raw-SQL index in
-- schema.prisma, so it treats it as drift). Until Prisma supports vector
-- indexes natively, this CREATE has to live in every migration.
CREATE INDEX IF NOT EXISTS "kb_chunk_embedding_hnsw_idx" ON "kb_chunk"
  USING hnsw ("embedding" vector_cosine_ops);
