-- Natural messaging + lead capture settings on the agent, live qualifying
-- answers and post-chat analysis on the conversation, latest analysis on
-- the lead. All additive with defaults; existing rows need no backfill.

-- AlterTable
ALTER TABLE "agent" ADD COLUMN     "naturalMessaging" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leadCaptureEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leadCaptureFields" TEXT[] DEFAULT ARRAY['name', 'email', 'phone']::TEXT[],
ADD COLUMN     "qualifyingQuestions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "lead" ADD COLUMN     "intent" TEXT,
ADD COLUMN     "score" INTEGER,
ADD COLUMN     "need" TEXT;

-- AlterTable
ALTER TABLE "conversation" ADD COLUMN     "leadDetails" JSONB,
ADD COLUMN     "intent" TEXT,
ADD COLUMN     "leadScore" INTEGER,
ADD COLUMN     "qualityScore" INTEGER,
ADD COLUMN     "resolved" BOOLEAN,
ADD COLUMN     "insights" JSONB;


-- Every migration re-asserts the HNSW index Prisma can't express (see
-- CLAUDE.md). Create-if-missing only, so nothing is rebuilt.
CREATE INDEX IF NOT EXISTS "kb_chunk_embedding_hnsw_idx" ON "kb_chunk"
  USING hnsw ("embedding" vector_cosine_ops);
