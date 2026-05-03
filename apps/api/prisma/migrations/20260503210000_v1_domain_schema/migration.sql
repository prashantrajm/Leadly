-- pgvector for KB embeddings (§3.2)
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop leftover marketplace template tables. Leadly v1 has no marketplace
-- domain; these were artifacts from the starter project this repo forked from.
DROP TABLE IF EXISTS "review" CASCADE;
DROP TABLE IF EXISTS "deal" CASCADE;
DROP TABLE IF EXISTS "business_hours" CASCADE;
DROP TABLE IF EXISTS "business" CASCADE;
DROP TABLE IF EXISTS "category" CASCADE;
DROP TABLE IF EXISTS "pincode" CASCADE;
DROP TABLE IF EXISTS "area" CASCADE;
DROP TABLE IF EXISTS "city" CASCADE;

-- Tenancy ────────────────────────────────────────────────────────────────────

CREATE TABLE "organization" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "slug"      TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

CREATE TABLE "membership" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "role"           TEXT NOT NULL DEFAULT 'member',
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "membership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "membership_organizationId_userId_key" ON "membership"("organizationId", "userId");
CREATE INDEX "membership_userId_idx" ON "membership"("userId");

CREATE TABLE "org_api_key" (
    "id"             TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider"       TEXT NOT NULL,
    "ciphertext"     BYTEA NOT NULL,
    "iv"             BYTEA NOT NULL,
    "authTag"        BYTEA NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "org_api_key_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "org_api_key_organizationId_provider_key" ON "org_api_key"("organizationId", "provider");

-- Agent ──────────────────────────────────────────────────────────────────────

CREATE TABLE "agent" (
    "id"                  TEXT NOT NULL,
    "organizationId"      TEXT NOT NULL,
    "name"                TEXT NOT NULL,
    "slug"                TEXT NOT NULL,
    "greeting"            TEXT NOT NULL DEFAULT 'Hi! How can I help?',
    "accentColor"         TEXT NOT NULL DEFAULT '#000000',
    "identityPolicy"      TEXT NOT NULL DEFAULT 'optional',
    "llmProvider"         TEXT NOT NULL DEFAULT 'openai',
    "llmModel"            TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "systemPromptOverlay" TEXT,
    "maxTurns"            INTEGER NOT NULL DEFAULT 50,
    "fallbackMessage"     TEXT NOT NULL DEFAULT 'I don''t have that information yet.',
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "agent_organizationId_slug_key" ON "agent"("organizationId", "slug");
CREATE INDEX "agent_organizationId_idx" ON "agent"("organizationId");

CREATE TABLE "agent_api_key" (
    "id"         TEXT NOT NULL,
    "agentId"    TEXT NOT NULL,
    "provider"   TEXT NOT NULL,
    "ciphertext" BYTEA NOT NULL,
    "iv"         BYTEA NOT NULL,
    "authTag"    BYTEA NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agent_api_key_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "agent_api_key_agentId_key" ON "agent_api_key"("agentId");

-- Knowledge base ─────────────────────────────────────────────────────────────

CREATE TABLE "kb_article" (
    "id"              TEXT NOT NULL,
    "agentId"         TEXT NOT NULL,
    "title"           TEXT NOT NULL,
    "contentMarkdown" TEXT NOT NULL,
    "source"          TEXT NOT NULL DEFAULT 'manual',
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "kb_article_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "kb_article_agentId_idx" ON "kb_article"("agentId");

CREATE TABLE "kb_chunk" (
    "id"        TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "agentId"   TEXT NOT NULL,
    "ord"       INTEGER NOT NULL,
    "text"      TEXT NOT NULL,
    "embedding" vector(1536),
    "tokens"    INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kb_chunk_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "kb_chunk_agentId_idx" ON "kb_chunk"("agentId");
CREATE INDEX "kb_chunk_articleId_idx" ON "kb_chunk"("articleId");
-- HNSW index for cosine similarity (§3.3 latency budget assumes ~10ms top-k).
CREATE INDEX "kb_chunk_embedding_hnsw" ON "kb_chunk" USING hnsw ("embedding" vector_cosine_ops);

-- Tools ──────────────────────────────────────────────────────────────────────

CREATE TABLE "tool" (
    "id"          TEXT NOT NULL,
    "agentId"     TEXT NOT NULL,
    "scope"       TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "enabled"     BOOLEAN NOT NULL DEFAULT true,
    "transport"   TEXT,
    "config"      JSONB,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tool_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tool_agentId_name_key" ON "tool"("agentId", "name");
CREATE INDEX "tool_agentId_idx" ON "tool"("agentId");

-- Identity ───────────────────────────────────────────────────────────────────

CREATE TABLE "visitor" (
    "id"          TEXT NOT NULL,
    "agentId"     TEXT NOT NULL,
    "externalId"  TEXT,
    "leadId"      TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata"    JSONB,
    CONSTRAINT "visitor_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "visitor_agentId_idx" ON "visitor"("agentId");
CREATE INDEX "visitor_leadId_idx" ON "visitor"("leadId");
CREATE INDEX "visitor_externalId_idx" ON "visitor"("externalId");

CREATE TABLE "lead" (
    "id"           TEXT NOT NULL,
    "agentId"      TEXT NOT NULL,
    "email"        TEXT,
    "phone"        TEXT,
    "name"         TEXT,
    "customFields" JSONB,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lead_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "lead_agentId_email_key" ON "lead"("agentId", "email");
CREATE UNIQUE INDEX "lead_agentId_phone_key" ON "lead"("agentId", "phone");
CREATE INDEX "lead_agentId_idx" ON "lead"("agentId");

-- Conversation ───────────────────────────────────────────────────────────────

CREATE TABLE "conversation" (
    "id"        TEXT NOT NULL,
    "agentId"   TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "leadId"    TEXT,
    "channel"   TEXT NOT NULL DEFAULT 'chat',
    "mode"      TEXT NOT NULL DEFAULT 'auto',
    "status"    TEXT NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt"   TIMESTAMP(3),
    "summary"   TEXT,
    "sentiment" TEXT,
    "tags"      JSONB,
    CONSTRAINT "conversation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "conversation_agentId_idx" ON "conversation"("agentId");
CREATE INDEX "conversation_visitorId_idx" ON "conversation"("visitorId");
CREATE INDEX "conversation_leadId_idx" ON "conversation"("leadId");
CREATE INDEX "conversation_status_idx" ON "conversation"("status");

CREATE TABLE "turn" (
    "id"             TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role"           TEXT NOT NULL,
    "text"           TEXT NOT NULL,
    "audioUrl"       TEXT,
    "durationMs"     INTEGER,
    "asrConfidence"  DOUBLE PRECISION,
    "toolName"       TEXT,
    "toolArgs"       JSONB,
    "toolResult"     JSONB,
    "llmProvider"    TEXT,
    "model"          TEXT,
    "latencyMs"      INTEGER,
    "tokensIn"       INTEGER,
    "tokensOut"      INTEGER,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "turn_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "turn_conversationId_idx" ON "turn"("conversationId");

-- Foreign keys ───────────────────────────────────────────────────────────────

ALTER TABLE "membership" ADD CONSTRAINT "membership_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "membership" ADD CONSTRAINT "membership_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "org_api_key" ADD CONSTRAINT "org_api_key_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent" ADD CONSTRAINT "agent_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_api_key" ADD CONSTRAINT "agent_api_key_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kb_article" ADD CONSTRAINT "kb_article_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "kb_chunk" ADD CONSTRAINT "kb_chunk_articleId_fkey"
    FOREIGN KEY ("articleId") REFERENCES "kb_article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kb_chunk" ADD CONSTRAINT "kb_chunk_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tool" ADD CONSTRAINT "tool_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "visitor" ADD CONSTRAINT "visitor_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visitor" ADD CONSTRAINT "visitor_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "lead" ADD CONSTRAINT "lead_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conversation" ADD CONSTRAINT "conversation_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_visitorId_fkey"
    FOREIGN KEY ("visitorId") REFERENCES "visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "turn" ADD CONSTRAINT "turn_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
