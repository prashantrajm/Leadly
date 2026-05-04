-- DropIndex (idempotent — Prisma's drift detection drops the HNSW index
-- on every new migration; we recreate it at the end).
DROP INDEX IF EXISTS "kb_chunk_embedding_hnsw_idx";

-- AlterTable
ALTER TABLE "agent" ALTER COLUMN "defaultModel" SET DEFAULT 'tencent/hy3-preview:free';

-- Recreate the HNSW index that the schema's embedding column relies on
-- but Prisma can't express in its schema language.
CREATE INDEX IF NOT EXISTS "kb_chunk_embedding_hnsw_idx" ON "kb_chunk"
  USING hnsw ("embedding" vector_cosine_ops);
