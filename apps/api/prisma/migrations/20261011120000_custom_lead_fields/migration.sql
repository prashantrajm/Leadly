-- Business-defined lead fields replace the plain qualifying-question list.
-- Each existing question becomes an "ask" text field, keyed question_1…n
-- in its original order, so no configuration is lost.

-- AlterTable
ALTER TABLE "agent" RENAME COLUMN "leadCaptureFields" TO "contactFields";

ALTER TABLE "agent" ADD COLUMN     "leadFields" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "captureNotableDetails" BOOLEAN NOT NULL DEFAULT true;

UPDATE "agent" AS a
SET "leadFields" = q.fields
FROM (
  SELECT "id",
         jsonb_agg(
           jsonb_build_object(
             'key', 'question_' || ord,
             'label', left(question, 60),
             'hint', question,
             'type', 'text',
             'mode', 'ask'
           ) ORDER BY ord
         ) AS fields
  FROM "agent", unnest("qualifyingQuestions") WITH ORDINALITY AS t(question, ord)
  GROUP BY "id"
) AS q
WHERE a."id" = q."id";

ALTER TABLE "agent" DROP COLUMN "qualifyingQuestions";

-- AlterTable
ALTER TABLE "lead" ADD COLUMN     "keyFacts" JSONB NOT NULL DEFAULT '[]';


-- Every migration re-asserts the HNSW index Prisma can't express (see
-- CLAUDE.md). Create-if-missing only, so nothing is rebuilt.
CREATE INDEX IF NOT EXISTS "kb_chunk_embedding_hnsw_idx" ON "kb_chunk"
  USING hnsw ("embedding" vector_cosine_ops);
