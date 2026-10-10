-- Invitee can decline an invitation (distinct from an admin revoking it).

-- AlterTable
ALTER TABLE "invitation" ADD COLUMN     "declinedAt" TIMESTAMP(3);


-- Every migration re-asserts the HNSW index Prisma can't express (see
-- CLAUDE.md). Create-if-missing only, so nothing is rebuilt.
CREATE INDEX IF NOT EXISTS "kb_chunk_embedding_hnsw_idx" ON "kb_chunk"
  USING hnsw ("embedding" vector_cosine_ops);
