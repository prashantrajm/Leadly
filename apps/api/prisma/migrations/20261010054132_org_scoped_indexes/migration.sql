-- DropIndex (idempotent — Prisma's drift detection drops the HNSW index
-- on every new migration; we recreate it at the end).
DROP INDEX IF EXISTS "kb_chunk_embedding_hnsw_idx";

-- Org-scoped dashboard lists (inbox, leads, visitors, analytics) filter by
-- organizationId across every agent, so they need their own indexes.

-- CreateIndex
CREATE INDEX "conversation_organizationId_startedAt_idx" ON "conversation"("organizationId", "startedAt");

-- CreateIndex
CREATE INDEX "conversation_organizationId_status_mode_idx" ON "conversation"("organizationId", "status", "mode");

-- CreateIndex
CREATE INDEX "lead_organizationId_createdAt_idx" ON "lead"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "visitor_organizationId_lastSeenAt_idx" ON "visitor"("organizationId", "lastSeenAt");

-- Recreate the HNSW index that the schema's embedding column relies on
-- but Prisma can't express in its schema language.
CREATE INDEX IF NOT EXISTS "kb_chunk_embedding_hnsw_idx" ON "kb_chunk"
  USING hnsw ("embedding" vector_cosine_ops);
