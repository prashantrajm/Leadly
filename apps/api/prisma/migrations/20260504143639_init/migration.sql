
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('owner', 'admin', 'member');

-- CreateEnum
CREATE TYPE "AgentIdentityPolicy" AS ENUM ('optional', 'required_before_chat', 'identified_only');

-- CreateEnum
CREATE TYPE "KbArticleSource" AS ENUM ('manual', 'upload');

-- CreateEnum
CREATE TYPE "ToolScope" AS ENUM ('system', 'customer');

-- CreateEnum
CREATE TYPE "ConversationChannel" AS ENUM ('chat', 'voice');

-- CreateEnum
CREATE TYPE "ConversationMode" AS ENUM ('auto', 'paused');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('active', 'ended', 'abandoned');

-- CreateEnum
CREATE TYPE "TurnRole" AS ENUM ('user', 'agent', 'human', 'tool', 'system');

-- CreateEnum
CREATE TYPE "LlmProvider" AS ENUM ('openai', 'anthropic', 'google', 'mistral', 'groq', 'openrouter', 'other');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isOnboarded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_llm_credential" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "LlmProvider" NOT NULL,
    "label" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "maskedSuffix" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_llm_credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_llm_override" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_llm_override_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "membership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "greeting" TEXT NOT NULL DEFAULT 'Hi! How can I help?',
    "accentColor" TEXT NOT NULL DEFAULT '#0F172A',
    "identityPolicy" "AgentIdentityPolicy" NOT NULL DEFAULT 'optional',
    "defaultProvider" "LlmProvider" NOT NULL DEFAULT 'openai',
    "defaultModel" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "systemPromptOverlay" TEXT,
    "fallbackMessage" TEXT NOT NULL DEFAULT 'I don''t have that information yet.',
    "maxTurns" INTEGER NOT NULL DEFAULT 50,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_article" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentMarkdown" TEXT NOT NULL,
    "source" "KbArticleSource" NOT NULL DEFAULT 'manual',
    "uploadKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kb_article_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kb_chunk" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "ord" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kb_chunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "ToolScope" NOT NULL DEFAULT 'system',
    "description" TEXT NOT NULL,
    "inputSchema" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "leadId" TEXT,

    CONSTRAINT "visitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT,
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "leadId" TEXT,
    "channel" "ConversationChannel" NOT NULL DEFAULT 'chat',
    "mode" "ConversationMode" NOT NULL DEFAULT 'auto',
    "status" "ConversationStatus" NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "summary" TEXT,
    "sentiment" TEXT,
    "tags" JSONB,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turn" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "TurnRole" NOT NULL,
    "text" TEXT NOT NULL,
    "audioUrl" TEXT,
    "durationMs" INTEGER,
    "asrConfidence" DOUBLE PRECISION,
    "toolName" TEXT,
    "toolArgs" JSONB,
    "toolResult" JSONB,
    "llmProvider" TEXT,
    "model" TEXT,
    "latencyMs" INTEGER,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_stat" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "conversations" INTEGER NOT NULL DEFAULT 0,
    "leadsCaptured" INTEGER NOT NULL DEFAULT 0,
    "handoffs" INTEGER NOT NULL DEFAULT 0,
    "avgTurnsPerConv" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "topCitedArticleIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_stat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "org_llm_credential_organizationId_idx" ON "org_llm_credential"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_llm_override_agentId_key" ON "agent_llm_override"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

-- CreateIndex
CREATE INDEX "membership_userId_idx" ON "membership"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "membership_organizationId_userId_key" ON "membership"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "agent_organizationId_idx" ON "agent"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_organizationId_slug_key" ON "agent"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "kb_article_agentId_idx" ON "kb_article"("agentId");

-- CreateIndex
CREATE INDEX "kb_article_organizationId_idx" ON "kb_article"("organizationId");

-- CreateIndex
CREATE INDEX "kb_chunk_agentId_idx" ON "kb_chunk"("agentId");

-- CreateIndex
CREATE INDEX "kb_chunk_articleId_idx" ON "kb_chunk"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "tool_agentId_name_key" ON "tool"("agentId", "name");

-- CreateIndex
CREATE INDEX "visitor_agentId_idx" ON "visitor"("agentId");

-- CreateIndex
CREATE INDEX "visitor_leadId_idx" ON "visitor"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "visitor_agentId_externalId_key" ON "visitor"("agentId", "externalId");

-- CreateIndex
CREATE INDEX "lead_agentId_idx" ON "lead"("agentId");

-- CreateIndex
CREATE INDEX "conversation_agentId_startedAt_idx" ON "conversation"("agentId", "startedAt");

-- CreateIndex
CREATE INDEX "conversation_agentId_status_idx" ON "conversation"("agentId", "status");

-- CreateIndex
CREATE INDEX "conversation_visitorId_idx" ON "conversation"("visitorId");

-- CreateIndex
CREATE INDEX "conversation_leadId_idx" ON "conversation"("leadId");

-- CreateIndex
CREATE INDEX "turn_conversationId_createdAt_idx" ON "turn"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "daily_stat_organizationId_date_idx" ON "daily_stat"("organizationId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_stat_agentId_date_key" ON "daily_stat"("agentId", "date");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_llm_credential" ADD CONSTRAINT "org_llm_credential_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_llm_override" ADD CONSTRAINT "agent_llm_override_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_llm_override" ADD CONSTRAINT "agent_llm_override_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "org_llm_credential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membership" ADD CONSTRAINT "membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent" ADD CONSTRAINT "agent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_article" ADD CONSTRAINT "kb_article_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_chunk" ADD CONSTRAINT "kb_chunk_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "kb_article"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_chunk" ADD CONSTRAINT "kb_chunk_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool" ADD CONSTRAINT "tool_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor" ADD CONSTRAINT "visitor_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor" ADD CONSTRAINT "visitor_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead" ADD CONSTRAINT "lead_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turn" ADD CONSTRAINT "turn_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Manual additions: pgvector HNSW + partial unique lead-dedup indexes.
-- Prisma's schema language can't express either, so they live here instead.
-- ---------------------------------------------------------------------------

-- HNSW index for cosine-distance retrieval (top-k=5 in Phase 6).
-- m / ef_construction at defaults — tune after first 10k chunks if recall/p95 demands.
CREATE INDEX "kb_chunk_embedding_hnsw_idx" ON "kb_chunk"
  USING hnsw ("embedding" vector_cosine_ops);

-- Lead dedup: unique (agent, email) only when email is set, and the same for phone.
-- Two leads at the same agent with both fields null are allowed (ghost visitors).
CREATE UNIQUE INDEX "lead_agent_email_unique"
  ON "lead" ("agentId", "email")
  WHERE "email" IS NOT NULL;

CREATE UNIQUE INDEX "lead_agent_phone_unique"
  ON "lead" ("agentId", "phone")
  WHERE "phone" IS NOT NULL;
