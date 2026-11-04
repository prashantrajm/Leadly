# Leadly v1 — Backend Architecture & Route Plan

This document is the build spec for Leadly v1. It conforms to every committed decision in `docs/v1-design.md`. No new infra is introduced. Names, paths and route strings below are the canonical ones — implementers should not invent variants.

---

## 1. Bun workspaces / monorepo packages layout

### 1.1 Decision

Create exactly four packages under `packages/`. Each pulls weight; nothing else does in v1.

| Package | Purpose | Consumers |
|---|---|---|
| `@leadly/schemas` | The single source of truth for Zod schemas. Powers `@hono/zod-openapi` route definitions in the API and runtime validation in `apps/web` (forms, query parsers) and `apps/widget`. Types used at the type level are derived via `z.infer`, not maintained separately. | `apps/api`, `apps/web`, `apps/widget`, `apps/native` |
| `@leadly/wire` | WebSocket envelope discriminated unions and frame schemas (visitor ↔ DO ↔ dashboard observer). Pure types + Zod parsers for inbound frames so the DO can validate without trusting the wire. | `apps/api` (DO + inbox routes), `apps/widget`, `apps/web` (inbox live view) |
| `@leadly/api-client` | Typed client for the dashboard. Hono RPC client (`hc<typeof apiApp>`) re-exported with auth wiring and a small `useApi()` hook for TanStack Query. | `apps/web`, `apps/native` |
| `@leadly/config` | Shared `tsconfig.base.json` and `biome.base.json`. Exists only to remove the duplicate strict/bundler settings already drifting across `apps/api/tsconfig.json` and `apps/web/tsconfig.json`. | every `apps/*` and every `packages/*` |

### 1.2 Why one `packages/schemas` (not API-only with type re-exports)

The dashboard calls the API; the widget never does (it uses the WS protocol). The dashboard already needs runtime validation for forms (`react-hook-form` + `@hookform/resolvers/zod` is in `apps/web/package.json`). If schemas live only in the API and we re-export `z.infer` types, we end up with one of two failure modes:

1. The dashboard re-defines its own Zod schemas for the same shapes (drift).
2. The dashboard imports from `apps/api`, which couples a frontend build to the Workers entry — the Cloudflare runtime types in `apps/api/tsconfig.json` are not what the browser/Vite build wants.

A neutral `@leadly/schemas` solves both. It depends only on `zod` and `@hono/zod-openapi` (peer-dep on `zod`). The API imports it for `createRoute(...)` definitions; the dashboard imports it for `zodResolver(CreateAgentSchema)`. One source of truth.

`@leadly/wire` is split out so the widget never has to pull in the REST schemas (the widget is size-sensitive — design §7.2 calls for ~5KB loader).

### 1.3 Why Hono RPC client over OpenAPI-generated

Hono is already chosen and `@hono/zod-openapi` is already wired. `hc<typeof apiApp>` gives end-to-end type safety (path params, query, body, response) by *importing* the API's exported app type — no codegen step, no drift. OpenAPI codegen is a second build step that only earns its keep if non-TS clients exist; in v1 they don't. The OpenAPI doc still gets emitted at `/doc` (already wired in `apps/api/src/index.ts`) for human reference and future external clients.

### 1.4 No build step for packages

Bun workspaces resolve `workspace:*` to source. `wrangler dev`/`wrangler deploy` use esbuild internally and follow `package.json#exports` to TS sources. Rules:

- Every package's `package.json` ships only `"exports": { ".": "./src/index.ts" }` (and named subpaths where useful, e.g. `@leadly/schemas/agent`).
- No `"main"`, no `"types"`, no `"build"` script. TS source is the published artifact inside the monorepo.
- A root `bun typecheck` script runs `tsc -b` across packages (project references, see §1.6) for type validation only — `--noEmit`.
- The API is bundled by wrangler/esbuild on `wrangler deploy`. Workspace TS imports are bundled inline. Verified pattern: this is how every Hono+Workers monorepo runs today; `nodejs_compat` is already on (`wrangler.jsonc:14`) and Bun's workspace resolution and esbuild's TS support are both fine with raw `.ts`.
- The web app (Vite) and widget (Vite) consume packages the same way. Vite resolves workspace `.ts` directly.
- Expo (`apps/native`) needs `transformer.unstable_allowRequireContext` and `resolver.unstable_enablePackageExports` in `metro.config.js` to consume `exports` maps. State this as a one-time Metro config change.

### 1.5 Resulting top-level tree

```
Leadly/
  apps/
    api/                       # Cloudflare Worker (Hono)
    web/                       # Vite + React 19 dashboard
    widget/                    # NEW — Vite, iframe doc + loader
    native/                    # Expo (out of v1 scope, kept)
  packages/
    schemas/                   # @leadly/schemas
      package.json
      src/
        index.ts
        common.ts              # DateField, Pagination, Error, Cursor
        org.ts
        agent.ts
        kb.ts
        tool.ts
        visitor.ts
        lead.ts
        conversation.ts
        analytics.ts
        widget.ts
        byok.ts
    wire/                      # @leadly/wire
      package.json
      src/
        index.ts
        envelopes.ts           # WireFrame discriminated union
        client-frames.ts       # frames widget sends
        server-frames.ts       # frames DO sends
        observer-frames.ts     # frames dashboard observer sends/receives
    api-client/                # @leadly/api-client
      package.json
      src/
        index.ts               # hc<typeof apiApp>() factory
        hooks.ts               # tiny TanStack Query helpers
    config/                    # @leadly/config
      tsconfig.base.json
      biome.base.json
      package.json
  docs/
  package.json                 # already configures workspaces apps/*, packages/*
  tsconfig.json                # root, references packages/* and apps/*
  biome.json
```

### 1.6 Root `tsconfig.json` and `paths`

Root `tsconfig.json` becomes a solution file with `references` to each `packages/*` and `apps/*`. Path aliases — `@leadly/schemas` etc. — resolve via Bun's workspace resolution; **no `paths` aliases needed** (and they would fight with `wrangler`'s esbuild). Each app's `tsconfig.json` extends `@leadly/config/tsconfig.base.json` and keeps its own `compilerOptions` for env-specific bits (Cloudflare types for `apps/api`, DOM types for `apps/web`, `hono/jsx` for the API).

### 1.7 `@leadly/api-client` shape

```ts
// packages/api-client/src/index.ts
import { hc } from "hono/client";
import type { ApiAppType } from "../../../apps/api/src/index";  // type-only import
export const createLeadlyClient = (baseUrl: string, getToken: () => string | null) =>
  hc<ApiAppType>(baseUrl, {
    headers: () => {
      const t = getToken();
      return t ? { Authorization: `Bearer ${t}` } : {};
    },
  });
export type LeadlyClient = ReturnType<typeof createLeadlyClient>;
```

The API's `apps/api/src/index.ts` must `export type ApiAppType = typeof app;` — this is the only contract the client depends on and it has zero runtime cost (the import is `import type`, erased by the bundler).

---

## 2. Domain data model (Prisma schema)

### 2.1 Schema file split

Use Prisma's `prismaSchemaFolder` preview feature, which is GA-stable on recent Prisma releases. `prisma.config.ts` already points `schema: 'prisma'` (a folder, not a file) — confirm by adding `previewFeatures = ["prismaSchemaFolder"]` in the generator block. Files:

```
apps/api/prisma/
  schema.prisma          # generator + datasource + enums shared across files
  auth.prisma            # User / Session / Account / Verification (Better Auth)
  domain.prisma          # everything else (org, agent, kb, conversation, …)
  byok.prisma            # OrgLlmCredential / AgentLlmOverride
  migrations/
    <timestamp>_init/
      migration.sql      # includes pgvector extension + HNSW index raw SQL
```

Single `generator` block lives in `schema.prisma`:

```prisma
generator client {
  provider        = "prisma-client-js"
  runtime         = "cloudflare"
  output          = "../src/generated/client"
  moduleFormat    = "esm"
  previewFeatures = ["prismaSchemaFolder"]
}
datasource db { provider = "postgresql" }
```

### 2.2 Enums (in `schema.prisma`)

```prisma
enum MembershipRole         { owner admin member }
enum AgentIdentityPolicy    { optional required_before_chat identified_only }
enum KbArticleSource        { manual upload }              // notion gdrive web_crawl reserved for v2
enum ToolScope              { system customer }
enum ConversationChannel    { chat voice }                 // v1 only emits chat
enum ConversationMode       { auto paused }
enum ConversationStatus     { active ended abandoned }
enum TurnRole               { user agent human tool system }
enum LlmProvider            { openai anthropic google mistral groq openrouter other }
```

### 2.3 `auth.prisma` — surgical edits to existing file

Drop the `role` field on `User` (template leftover; per-org `Membership.role` replaces it). Keep `isOnboarded` (used by the 4-step wizard in §7.1 of the design doc).

```prisma
model User {
  id            String    @id
  name          String
  email         String
  emailVerified Boolean   @default(false)
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  isOnboarded   Boolean   @default(false)
  sessions      Session[]
  accounts      Account[]
  memberships   Membership[]
  @@unique([email])
  @@map("user")
}
// Session, Account, Verification — unchanged
```

### 2.4 `domain.prisma` — full domain model

```prisma
model Organization {
  id             String        @id @default(cuid())
  name           String
  slug           String        @unique
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt
  memberships    Membership[]
  agents         Agent[]
  llmCredentials OrgLlmCredential[]
  @@map("organization")
}

model Membership {
  id             String        @id @default(cuid())
  organizationId String
  userId         String
  role           MembershipRole @default(member)
  createdAt      DateTime      @default(now())
  organization   Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user           User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([organizationId, userId])
  @@index([userId])
  @@map("membership")
}

model Agent {
  id                  String                 @id @default(cuid())
  organizationId      String
  name                String
  slug                String
  greeting            String                 @default("Hi! How can I help?")
  accentColor         String                 @default("#0F172A")
  identityPolicy      AgentIdentityPolicy    @default(optional)
  defaultProvider     LlmProvider            @default(openai)
  defaultModel        String                 @default("gpt-4o-mini")
  systemPromptOverlay String?                // appended to base persona
  fallbackMessage     String                 @default("I don't have that information yet.")
  maxTurns            Int                    @default(50)
  createdAt           DateTime               @default(now())
  updatedAt           DateTime               @updatedAt
  organization        Organization           @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  kbArticles          KbArticle[]
  kbChunks            KbChunk[]
  tools               Tool[]
  visitors            Visitor[]
  leads               Lead[]
  conversations       Conversation[]
  llmOverride         AgentLlmOverride?
  @@unique([organizationId, slug])
  @@index([organizationId])
  @@map("agent")
}

model KbArticle {
  id              String          @id @default(cuid())
  organizationId  String                                       // §2.1 — every table carries orgId
  agentId         String
  title           String
  contentMarkdown String
  source          KbArticleSource @default(manual)
  uploadKey       String?                                       // R2 object key when source=upload
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
  agent           Agent           @relation(fields: [agentId], references: [id], onDelete: Cascade)
  chunks          KbChunk[]
  @@index([agentId])
  @@index([organizationId])
  @@map("kb_article")
}

model KbChunk {
  id              String                       @id @default(cuid())
  organizationId  String
  agentId         String
  articleId       String
  ord             Int
  text            String
  tokens          Int
  embedding       Unsupported("vector(1536)")
  createdAt       DateTime                     @default(now())
  article         KbArticle                    @relation(fields: [articleId], references: [id], onDelete: Cascade)
  agent           Agent                        @relation(fields: [agentId], references: [id], onDelete: Cascade)
  @@index([agentId])                                            // pgvector HNSW added via raw SQL — see 2.7
  @@index([articleId])
  @@map("kb_chunk")
}

model Tool {
  id             String     @id @default(cuid())
  organizationId String
  agentId        String
  name           String                                          // capture_contact, request_handoff, ...
  scope          ToolScope  @default(system)
  description    String
  inputSchema    Json                                            // JSON Schema for arguments
  enabled        Boolean    @default(true)
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  agent          Agent      @relation(fields: [agentId], references: [id], onDelete: Cascade)
  @@unique([agentId, name])
  @@map("tool")
}

model Visitor {
  id              String          @id @default(cuid())
  organizationId  String
  agentId         String
  // Stable browser identity: signed cookie value persisted to localStorage by widget
  externalId      String                                        // visitor's own id from widget
  leadId          String?
  firstSeenAt     DateTime        @default(now())
  lastSeenAt      DateTime        @default(now())
  ipHash          String?
  userAgent       String?
  agent           Agent           @relation(fields: [agentId], references: [id], onDelete: Cascade)
  lead            Lead?           @relation(fields: [leadId], references: [id], onDelete: SetNull)
  conversations   Conversation[]
  @@unique([agentId, externalId])
  @@index([leadId])
  @@map("visitor")
}

model Lead {
  id             String         @id @default(cuid())
  organizationId String
  agentId        String
  name           String?
  email          String?
  phone          String?
  customFields   Json           @default("{}")
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  agent          Agent          @relation(fields: [agentId], references: [id], onDelete: Cascade)
  visitors       Visitor[]
  conversations  Conversation[]
  // Partial-unique on (agentId, email) and (agentId, phone) — see §2.6
  @@index([agentId])
  @@index([organizationId])
  @@map("lead")
}

model Conversation {
  id             String              @id @default(cuid())
  organizationId String
  agentId        String
  visitorId      String
  leadId         String?
  channel        ConversationChannel @default(chat)
  mode           ConversationMode    @default(auto)
  status         ConversationStatus  @default(active)
  startedAt      DateTime            @default(now())
  endedAt        DateTime?
  summary        String?
  sentiment      String?                                          // 'positive' | 'neutral' | 'negative' | etc.
  tags           Json?                                            // string[]
  agent          Agent               @relation(fields: [agentId], references: [id], onDelete: Cascade)
  visitor        Visitor             @relation(fields: [visitorId], references: [id], onDelete: Cascade)
  lead           Lead?               @relation(fields: [leadId], references: [id], onDelete: SetNull)
  turns          Turn[]
  @@index([agentId, createdAt(sort: Desc)])                       // inbox listing
  @@index([organizationId, status])
  @@index([leadId])
  @@map("conversation")
  // Note: Prisma can't express `createdAt` index since field is named `startedAt`; use startedAt
}

model Turn {
  id             String     @id @default(cuid())
  organizationId String
  conversationId String
  role           TurnRole
  text           String
  // Voice-only — null in v1
  audioUrl       String?
  durationMs     Int?
  asrConfidence  Float?
  // Tool-call-only
  toolName       String?
  toolArgs       Json?
  toolResult     Json?
  // LLM telemetry (agent turns)
  llmProvider    LlmProvider?
  model          String?
  latencyMs      Int?
  tokensIn       Int?
  tokensOut      Int?
  createdAt      DateTime   @default(now())
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  @@index([conversationId, createdAt])
  @@map("turn")
}
```

### 2.5 `byok.prisma` — encrypted credentials

```prisma
model OrgLlmCredential {
  id             String      @id @default(cuid())
  organizationId String      @unique                              // one default per org
  provider       LlmProvider
  // AES-256-GCM ciphertext of the API key. Encryption helpers in lib/crypto.ts (§9).
  ciphertext     Bytes
  iv             Bytes
  authTag        Bytes
  // Wrap KEK id; KEK is wrapped by env SECRETS_ENCRYPTION_KEY.
  kekVersion     Int         @default(1)
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  @@map("org_llm_credential")
}

model AgentLlmOverride {
  id        String      @id @default(cuid())
  agentId   String      @unique
  provider  LlmProvider
  ciphertext Bytes
  iv        Bytes
  authTag   Bytes
  kekVersion Int        @default(1)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  agent     Agent       @relation(fields: [agentId], references: [id], onDelete: Cascade)
  @@map("agent_llm_override")
}
```

API responses for these resources never include the ciphertext fields. The Zod response schemas (§3) only expose `provider`, `createdAt`, `updatedAt`, and a boolean `hasKey`.

### 2.6 Lead dedup

Prisma can't express partial-unique constraints declaratively. Approach:

1. Do NOT declare `@@unique([agentId, email])` or `@@unique([agentId, phone])` in Prisma — those are full-table unique and would forbid multiple null emails (Postgres allows multiple NULLs in a unique index, but Prisma's planner is brittle when the column is nullable and UNIQUE).
2. Add raw SQL in the init migration:

   ```sql
   CREATE UNIQUE INDEX lead_agent_email_unique
     ON lead (agent_id, email) WHERE email IS NOT NULL;
   CREATE UNIQUE INDEX lead_agent_phone_unique
     ON lead (agent_id, phone) WHERE phone IS NOT NULL;
   ```
3. The `capture_contact` tool's service code (`services/lead-service.ts`) does an upsert in two steps inside a transaction: (a) lookup by `(agentId, email)` if email present, else `(agentId, phone)`; (b) insert if missing, update otherwise. The DB indexes are the safety net, not the dedup mechanism.

### 2.7 Index strategy + pgvector

In the init migration's raw-SQL section:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
-- HNSW for cosine distance, recommended params for 1536-dim embeddings.
CREATE INDEX kb_chunk_embedding_hnsw
  ON kb_chunk USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
-- Filter helper for retrieval queries that always include WHERE agent_id = ?
CREATE INDEX kb_chunk_agent_id_idx ON kb_chunk (agent_id);
```

Other indexes already declared via Prisma `@@index`:

- `Conversation`: `(agentId, startedAt DESC)` — inbox newest-first; `(organizationId, status)` — counts.
- `Turn`: `(conversationId, createdAt)` — transcript scroll.
- `Visitor`: `(agentId, externalId)` unique — widget lookup.
- `Lead`: btree on `(agentId)` and `(organizationId)`.
- `KbArticle` and `KbChunk`: btree on `agentId` and `articleId`.

---

## 3. Zod / OpenAPI schemas

### 3.1 Location & split

Drop `apps/api/src/schemas/index.ts` entirely (it is the template's directory-of-businesses model). All schemas live in `packages/schemas/src/<domain>.ts`. Per-domain split, not one mega-file. Each file exports:

- `Foo` — full DB-shape entity schema.
- `FooWithRelations` — extended for endpoints that include joins.
- `CreateFoo` — request body for POST.
- `UpdateFoo` — request body for PATCH (`.partial()` of `CreateFoo` plus any update-only fields).
- `FooQuery` — query-string filters/cursor (where applicable).

### 3.2 Wire date convention

Pick one: **ISO 8601 strings on the wire, always**. The `DateField` union approach in the current `schemas/index.ts` (`z.union([z.string(), z.date()])`) was an accommodation for Prisma's `Date` objects landing in JSON. The correct fix is to serialize at the boundary. Approach:

- Hono response handlers always return JSON via `c.json(...)`. JSON.stringify serializes `Date` to ISO string by default.
- Zod schemas declare `z.string().datetime()` for every date field on responses and inputs.
- A single helper `lib/serialize.ts` exports `serializeEntity<T>(t: T): T` (a type-level identity that runtime-coerces nested Dates) for any place where the auto JSON.stringify path doesn't apply (e.g. injecting data into a Workflow). Trivial recursion.

### 3.3 Common building blocks (`packages/schemas/src/common.ts`)

```ts
export const IsoDate = z.string().datetime();
export const Cuid = z.string().min(20).max(40);
export const Cursor = z.string().optional();
export const PaginationQuery = z.object({
  cursor: Cursor,
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export const OffsetPaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export const ErrorBody = z.object({
  error: z.string(),
  message: z.string().optional(),
  details: z.unknown().optional(),
}).openapi("Error");
export const Ok = z.object({ ok: z.literal(true) }).openapi("Ok");
```

### 3.4 Per-domain schema names (canonical)

Listing only the shapes; field lists follow the Prisma model 1:1 unless noted.

- `org.ts`: `Organization`, `OrganizationWithCounts`, `CreateOrganization`, `UpdateOrganization`, `Membership`, `MembershipWithUser`, `InviteMember`, `UpdateMembership`.
- `agent.ts`: `Agent`, `AgentWithCounts`, `CreateAgent`, `UpdateAgent`, `AgentSettings` (subset for the Persona/Settings page), `AgentLlmConfig`.
- `kb.ts`: `KbArticle`, `KbArticleWithChunkCount`, `CreateKbArticle`, `UpdateKbArticle`, `KbUploadInit` (request: `filename`, `contentType`), `KbUploadInitResponse` (presigned PUT URL + key + articleId), `KbUploadComplete`, `KbReembedStatus`.
- `tool.ts`: `Tool`, `ToolList`, `UpdateTool` (only `enabled` in v1).
- `visitor.ts`: `Visitor`, `VisitorWithLead`, `VisitorQuery`.
- `lead.ts`: `Lead`, `LeadWithCounts`, `LeadDetail` (lead + recent conversations), `CreateLead`, `UpdateLead`, `LeadQuery`.
- `conversation.ts`: `Conversation`, `ConversationListItem`, `ConversationDetail` (with turns), `Turn`, `ConversationQuery`, `TakeoverRequest`, `ReleaseRequest`, `EndConversationRequest`.
- `analytics.ts`: `AnalyticsCounts`, `AnalyticsTimeseriesQuery`, `AnalyticsTimeseries`, `TopArticles`.
- `widget.ts`: `WidgetConfig` (returned by public endpoint — agent name, greeting, accentColor, identityPolicy, public agent id), `WidgetIdentify` (optional name/email/phone/customFields), `WidgetConversationCreate`, `WidgetConversationCreateResponse` (returns conversationId + signed `widgetToken`).
- `byok.ts`: `OrgLlmCredentialSafe` (`provider`, `hasKey`, `createdAt`), `SetOrgLlmCredential` (`provider`, `apiKey`), `AgentLlmOverrideSafe`, `SetAgentLlmOverride`.

### 3.5 OpenAPI registration

Each schema appended with `.openapi("PascalName")`. The route definitions in `apps/api/src/routes/*.ts` import from `@leadly/schemas` and pass them straight into `createRoute({...})`. The OpenAPI document at `/doc` (already wired in `apps/api/src/index.ts`) auto-collects them via `@hono/zod-openapi`.

---

## 4. REST routes

### 4.1 Conventions

- All non-auth, non-widget routes are mounted under `/api`. Better Auth keeps `/api/auth/*` (already wired in `apps/api/src/index.ts:35`).
- Auth tiers (column "AUTH" below):
  - **public**: no auth.
  - **session**: Better Auth session cookie required.
  - **org-member**: session + Membership in the path's org (resolved from path or body).
  - **org-admin**: session + Membership.role ∈ {`owner`,`admin`}.
  - **agent-access**: session + Membership in agent's org (orgId derived from `agentId` in path).
  - **widget-token**: short-lived signed token issued by `POST /api/widget/conversations` and required for `/api/conversations/:id/ws` from a visitor.
- Request/response columns reference Zod schema names from `@leadly/schemas`.
- "List" endpoints with potentially long results (conversations, turns, leads) use **cursor pagination**. Short admin lists (orgs, agents, members, tools, articles) use **offset pagination**.

### 4.2 Auth (Better Auth)

| METHOD | PATH | AUTH | Notes |
|---|---|---|---|
| GET/POST | `/api/auth/*` | public | Better Auth handler, already mounted. No change. |

### 4.3 Onboarding

Folded into resource routes — there is no `/api/onboarding/*`. The 4-step wizard (§7.1) is just:

1. `POST /api/organizations` (creates the user's first org if `User.isOnboarded === false`).
2. `POST /api/organizations/:orgId/agents` (the first agent).
3. `POST /api/agents/:agentId/kb/articles` or skip.
4. `GET /api/agents/:agentId/install` (returns the script snippet).

A trailing `POST /api/me/complete-onboarding` flips `User.isOnboarded = true`.

| METHOD | PATH | AUTH | Req | Res |
|---|---|---|---|---|
| GET | `/api/me` | session | — | `Me` (user + memberships + isOnboarded) |
| POST | `/api/me/complete-onboarding` | session | — | `Ok` |

### 4.4 Organizations & memberships

| METHOD | PATH | AUTH | Req | Res |
|---|---|---|---|---|
| POST | `/api/organizations` | session | `CreateOrganization` | `Organization` |
| GET | `/api/organizations` | session | — | `Organization[]` (orgs the user is a member of) |
| GET | `/api/organizations/:orgId` | org-member | — | `OrganizationWithCounts` |
| PATCH | `/api/organizations/:orgId` | org-admin | `UpdateOrganization` | `Organization` |
| DELETE | `/api/organizations/:orgId` | org-admin (owner only) | — | `Ok` |
| GET | `/api/organizations/:orgId/members` | org-member | offset paginated | `MembershipWithUser[]` |
| POST | `/api/organizations/:orgId/members` | org-admin | `InviteMember` | `MembershipWithUser` (v1: direct add by email of an existing user; invite-by-email flow deferred — design §6.5) |
| PATCH | `/api/organizations/:orgId/members/:userId` | org-admin | `UpdateMembership` | `MembershipWithUser` |
| DELETE | `/api/organizations/:orgId/members/:userId` | org-admin | — | `Ok` |

### 4.5 Agents

| METHOD | PATH | AUTH | Req | Res |
|---|---|---|---|---|
| GET | `/api/organizations/:orgId/agents` | org-member | — | `AgentWithCounts[]` |
| POST | `/api/organizations/:orgId/agents` | org-admin | `CreateAgent` | `Agent` |
| GET | `/api/agents/:agentId` | agent-access | — | `Agent` |
| PATCH | `/api/agents/:agentId` | agent-access (admin) | `UpdateAgent` | `Agent` |
| DELETE | `/api/agents/:agentId` | agent-access (admin) | — | `Ok` |
| GET | `/api/agents/:agentId/install` | agent-access | — | `{ scriptTag: string, agentPublicId: string }` |

### 4.6 Knowledge base

| METHOD | PATH | AUTH | Req | Res |
|---|---|---|---|---|
| GET | `/api/agents/:agentId/kb/articles` | agent-access | offset paginated | `KbArticleWithChunkCount[]` |
| POST | `/api/agents/:agentId/kb/articles` | agent-access | `CreateKbArticle` | `KbArticle` (triggers `KbReembedWorkflow`) |
| GET | `/api/agents/:agentId/kb/articles/:articleId` | agent-access | — | `KbArticleWithChunkCount` |
| PATCH | `/api/agents/:agentId/kb/articles/:articleId` | agent-access | `UpdateKbArticle` | `KbArticle` (triggers re-embed) |
| DELETE | `/api/agents/:agentId/kb/articles/:articleId` | agent-access | — | `Ok` |
| POST | `/api/agents/:agentId/kb/articles/:articleId/reembed` | agent-access | — | `KbReembedStatus` |
| POST | `/api/agents/:agentId/kb/uploads` | agent-access | `KbUploadInit` | `KbUploadInitResponse` (presigned PUT URL + R2 key + provisional articleId) |
| POST | `/api/agents/:agentId/kb/uploads/:articleId/complete` | agent-access | `KbUploadComplete` | `KbArticle` (registers the upload, kicks off `KbReembedWorkflow`) |

### 4.7 Tools

v1 is read-only — system tools auto-seeded per agent at agent-create time.

| METHOD | PATH | AUTH | Req | Res |
|---|---|---|---|---|
| GET | `/api/agents/:agentId/tools` | agent-access | — | `Tool[]` |
| PATCH | `/api/agents/:agentId/tools/:toolId` | agent-access | `UpdateTool` (only `enabled`) | `Tool` |

### 4.8 Visitors

| METHOD | PATH | AUTH | Req | Res |
|---|---|---|---|---|
| GET | `/api/agents/:agentId/visitors` | agent-access | cursor paginated | `VisitorWithLead[]` |
| GET | `/api/agents/:agentId/visitors/:visitorId` | agent-access | — | `VisitorWithLead` |

### 4.9 Leads

| METHOD | PATH | AUTH | Req | Res |
|---|---|---|---|---|
| GET | `/api/agents/:agentId/leads` | agent-access | cursor paginated, `LeadQuery` filters | `Lead[]` |
| GET | `/api/leads/:leadId` | agent-access (derived) | — | `LeadDetail` |
| PATCH | `/api/leads/:leadId` | agent-access | `UpdateLead` | `Lead` |
| DELETE | `/api/leads/:leadId` | agent-access | — | `Ok` |

### 4.10 Conversations / inbox

| METHOD | PATH | AUTH | Req | Res |
|---|---|---|---|---|
| GET | `/api/agents/:agentId/conversations` | agent-access | cursor paginated, `ConversationQuery` (status, hasHandoff, search) | `ConversationListItem[]` |
| GET | `/api/conversations/:conversationId` | agent-access | — | `ConversationDetail` (with turns) |
| GET | `/api/conversations/:conversationId/turns` | agent-access | cursor paginated | `Turn[]` |
| POST | `/api/conversations/:conversationId/takeover` | agent-access | `TakeoverRequest` (optional reason) | `Conversation` (mode=paused) — also fans event into DO |
| POST | `/api/conversations/:conversationId/release` | agent-access | — | `Conversation` (mode=auto) |
| POST | `/api/conversations/:conversationId/messages` | agent-access | `{ text: string }` | `Turn` (role=human; appended via DO) |
| POST | `/api/conversations/:conversationId/end` | agent-access | `EndConversationRequest` | `Conversation` (status=ended) |
| GET | `/api/conversations/:conversationId/ws` | widget-token OR agent-access | WS Upgrade | (see §5) |

### 4.11 Analytics

| METHOD | PATH | AUTH | Req | Res |
|---|---|---|---|---|
| GET | `/api/agents/:agentId/analytics/counts` | agent-access | `?from=&to=` ISO range | `AnalyticsCounts` |
| GET | `/api/agents/:agentId/analytics/timeseries` | agent-access | `AnalyticsTimeseriesQuery` (`?from=&to=&metric=`) | `AnalyticsTimeseries` |
| GET | `/api/agents/:agentId/analytics/top-articles` | agent-access | `?from=&to=&limit=` | `TopArticles` |

The daily Cron (`crons/analytics-rollup.ts`, §6) maintains a `daily_agent_metrics` table read by these endpoints. v1 doesn't expose that table directly.

### 4.12 Widget public endpoints

| METHOD | PATH | AUTH | Req | Res |
|---|---|---|---|---|
| GET | `/api/widget/config` | public | `?agentPublicId=` | `WidgetConfig` (KV-cached, 60s TTL) |
| POST | `/api/widget/visitors` | public | `?agentPublicId=`, body: `{externalId?: string}` | `{ visitorId, signedVisitorCookie }` (HMAC-signed cookie body) |
| POST | `/api/widget/visitors/:visitorId/identify` | widget-token | `WidgetIdentify` | `Lead` |
| POST | `/api/widget/conversations` | widget-token | `WidgetConversationCreate` (visitorId) | `WidgetConversationCreateResponse` (`conversationId`, `widgetToken` for WS) |

The `widgetToken` is a short-lived (1 h) HMAC-signed JWT-like token containing `{conversationId, visitorId, agentId, exp}`, signed with `WIDGET_TOKEN_SECRET` (env). It's the only credential the WS upgrade trusts on the visitor side.

### 4.13 BYOK

| METHOD | PATH | AUTH | Req | Res |
|---|---|---|---|---|
| GET | `/api/organizations/:orgId/llm-credential` | org-admin | — | `OrgLlmCredentialSafe \| null` |
| PUT | `/api/organizations/:orgId/llm-credential` | org-admin | `SetOrgLlmCredential` | `OrgLlmCredentialSafe` |
| DELETE | `/api/organizations/:orgId/llm-credential` | org-admin | — | `Ok` |
| GET | `/api/agents/:agentId/llm-credential` | agent-access (admin) | — | `AgentLlmOverrideSafe \| null` |
| PUT | `/api/agents/:agentId/llm-credential` | agent-access (admin) | `SetAgentLlmOverride` | `AgentLlmOverrideSafe` |
| DELETE | `/api/agents/:agentId/llm-credential` | agent-access (admin) | — | `Ok` |

Plaintext API keys are never returned. Read endpoints expose `{provider, hasKey: true, createdAt, updatedAt}`.

### 4.14 Uploads

The current `apps/api/src/routes/uploads.ts` is generic. v1 keeps it for any internal R2 file (org logos eventually) but the KB-specific path lives under `/api/agents/:agentId/kb/uploads` (§4.6) — that's the only upload UI the dashboard needs in v1. Recommend leaving `uploadsApp` for now and routing KB through the dedicated endpoint, then deleting `routes/uploads.ts` in a follow-up cleanup commit once nothing references it.

### 4.15 Health & docs

| METHOD | PATH | AUTH | Notes |
|---|---|---|---|
| GET | `/health` | public | already wired |
| GET | `/doc` | public | OpenAPI doc, already wired |
| GET | `/api/health` | public | already wired in `routes/index.ts` |

### 4.16 Pagination contract

Cursor pagination (`Conversations`, `Leads`, `Turns`, `Visitors`):

- Request: `?cursor=<opaque>&limit=<n>`.
- Response envelope: `{ items: T[], nextCursor: string | null }`.
- Cursor format: base64url of `{id, createdAtIso}` from the last item.
- Index: every cursor query includes `WHERE (createdAt, id) < (cursorCreatedAt, cursorId) ORDER BY createdAt DESC, id DESC` so the inbox's `(agentId, createdAt DESC)` index is the access path.

Offset pagination (`Organizations`, `Members`, `Agents`, `Articles`, `Tools`):

- Request: `?page=&limit=`.
- Response envelope: `{ items, page, limit, total }`.

---

## 5. WebSocket protocol (DO-terminated)

### 5.1 Path

`/api/conversations/:conversationId/ws`. Picked over `/ws/conversation/:id` because:

1. The path lives under `/api`, so the existing CORS rule and routing tree apply uniformly.
2. The conversation is the resource; `/conversations/:id/ws` reads as a sub-resource of it. REST-route-shaped; matches the `/api/conversations/:conversationId/turns` sibling.

### 5.2 Roles

Two roles connect to the same WS endpoint and are distinguished by the auth credential:

- **visitor** — supplies `?token=<widgetToken>`. Receives full agent stream; sends user messages.
- **observer** — supplies a Better Auth session cookie + `agent-access` check. Read-only by default, can also push `takeover`/`release`/`human_msg` envelopes (which the DO mirrors back to the visitor through the visitor's WS).

The DO maintains a `Map<role, Set<WebSocket>>` in memory (rebuilt from `state.getWebSockets()` on rehydrate; the role is stashed on the WS via `state.acceptWebSocket(ws, [role, conversationId])` tags so it survives hibernation).

### 5.3 Routing visitor request → DO

```ts
// apps/api/src/routes/conversations.ts (sketch)
conversationsApp.get("/:conversationId/ws", async (c) => {
  if (c.req.header("Upgrade") !== "websocket") return c.text("expected ws", 426);
  const { conversationId } = c.req.param();
  // resolve credential to role + authz
  const role = await resolveWsRole(c, conversationId);   // throws on bad token
  const id = c.env.CONVERSATION_DO.idFromName(conversationId);
  const stub = c.env.CONVERSATION_DO.get(id);
  // forward the upgrade — DO handles WebSocketPair
  return stub.fetch(c.req.raw, { headers: { "X-Leadly-Role": role } });
});
```

DO is bound by name, not by ID, so `idFromName(conversationId)` produces a stable mapping. Cloudflare pins the DO instance to a region near the first caller (design §5.3).

### 5.4 Wire envelope (`@leadly/wire`)

Single discriminated union, all frames JSON-encoded:

```ts
// envelopes.ts
export type WireFrame =
  // client → server (visitor)
  | { type: "user_msg"; payload: { text: string; clientMsgId: string } }
  | { type: "typing"; payload: { isTyping: boolean } }
  | { type: "ping"; payload: { t: number } }
  // client → server (observer / dashboard)
  | { type: "human_msg"; payload: { text: string; clientMsgId: string } }
  | { type: "mode_change"; payload: { mode: "auto" | "paused"; reason?: string } }
  | { type: "end_conversation"; payload: { resolution?: string } }
  // server → client
  | { type: "agent_token"; payload: { turnId: string; delta: string } }
  | { type: "agent_turn_end"; payload: { turnId: string; text: string } }
  | { type: "tool_call"; payload: { turnId: string; toolName: string; args: unknown } }
  | { type: "tool_result"; payload: { turnId: string; toolName: string; result: unknown } }
  | { type: "human_turn"; payload: { turnId: string; text: string } }
  | { type: "handoff_state"; payload: { state: "requested" | "active" | "released" } }
  | { type: "mode_change_ack"; payload: { mode: "auto" | "paused" } }
  | { type: "identity_capture_state"; payload: { needs: ("name"|"email"|"phone")[] } }
  | { type: "error"; payload: { code: string; message: string } }
  | { type: "pong"; payload: { t: number } };
```

Inbound frames go through `ClientFrameSchema.safeParse(JSON.parse(raw))` in the DO; on failure the DO closes with code 1008.

---

## 6. Background work

### 6.1 Workflows

Workflow classes live in `apps/api/src/workflows/`. Each is a `WorkflowEntrypoint` from `cloudflare:workers`.

#### 6.1.1 `KbReembedWorkflow` — `apps/api/src/workflows/kb-reembed.ts`

Trigger: `POST/PATCH /api/agents/:agentId/kb/articles` and `POST /api/agents/:agentId/kb/uploads/:articleId/complete` (handlers call `env.KB_REEMBED_WORKFLOW.create({ params: { articleId } })`).

Steps:

1. `loadArticle` — fetch `KbArticle` by id; throw with retry-disabled if missing.
2. `splitChunks` — split `contentMarkdown` on `##` headings, target ~500 tokens per chunk (use a tiny tokenizer; `gpt-tokenizer` works on Workers). Output: `{ord, text, tokens}[]`.
3. `embedBatch` — call OpenAI `embeddings.create({ model: "text-embedding-3-small", input: chunks.map(c => c.text) })`. Step is retryable; OpenAI hiccups recover automatically.
4. `replaceChunks` — single SQL transaction (`prisma.$transaction`): `DELETE FROM kb_chunk WHERE article_id = ?` then bulk insert via raw `$executeRawUnsafe` to write the `vector(1536)` column directly (`Unsupported` Prisma fields can't be set with the typed client; raw SQL is the documented path).

#### 6.1.2 `ConversationSummarizeWorkflow` — `apps/api/src/workflows/conversation-summarize.ts`

Trigger: DO calls `env.CONVERSATION_SUMMARIZE_WORKFLOW.create({ params: { conversationId } })` either when the agent runs `end_conversation` or when the 30-min idle alarm fires.

Steps:

1. `loadTurns` — fetch all turns ordered ASC.
2. `summarizeLlm` — AI SDK `generateText` with the agent's default provider/model. Output schema enforced via tool schemas (or `generateObject` if simpler) — `{ summary: string, sentiment: 'positive'|'neutral'|'negative', tags: string[] }`.
3. `persist` — `prisma.conversation.update` writing `summary`, `sentiment`, `tags`, `endedAt`, `status='ended'`.

### 6.2 Cron Triggers

Files in `apps/api/src/crons/`, each exporting a default `(event: ScheduledEvent, env: Env)` handler. Single dispatch in `apps/api/src/index.ts` reads `event.cron` and routes:

#### 6.2.1 `idle-reaper.ts` — `*/5 * * * *`

Backstop for missed DO alarms. Find conversations with `status='active'` and no turn in 30+ minutes; for each, get the DO stub and `stub.fetch(...)` an internal `/__reap` endpoint that triggers the same end+summarize path. Bounded batch (e.g. 200/run).

#### 6.2.2 `analytics-rollup.ts` — `0 0 * * *`

Aggregate yesterday into a `daily_agent_metrics` table (separate Prisma model in `domain.prisma`):

```prisma
model DailyAgentMetric {
  id              String   @id @default(cuid())
  organizationId  String
  agentId         String
  date            DateTime @db.Date
  conversations   Int      @default(0)
  leadsCaptured   Int      @default(0)
  handoffs        Int      @default(0)
  avgTurns        Float    @default(0)
  topArticles     Json     @default("[]")
  createdAt       DateTime @default(now())
  @@unique([agentId, date])
  @@index([organizationId, date])
  @@map("daily_agent_metric")
}
```

The rollup is `SELECT ... GROUP BY agent_id` against `Conversation` and `Turn` for the previous UTC day, upsert per `(agentId, date)`. Idempotent on re-run.

### 6.3 `wrangler.jsonc` additions

Append to the existing file (do not replace, fields not shown stay):

```jsonc
{
  // ...existing...
  "kv_namespaces": [
    { "binding": "WIDGET_CONFIG_KV", "id": "<filled-after-wrangler-kv-namespace-create>" },
    { "binding": "RATE_LIMIT_KV",   "id": "<filled-after-wrangler-kv-namespace-create>" }
  ],
  "durable_objects": {
    "bindings": [
      { "name": "CONVERSATION_DO", "class_name": "ConversationDO" }
    ]
  },
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["ConversationDO"] }
  ],
  "workflows": [
    { "name": "kb-reembed",              "binding": "KB_REEMBED_WORKFLOW",            "class_name": "KbReembedWorkflow" },
    { "name": "conversation-summarize",  "binding": "CONVERSATION_SUMMARIZE_WORKFLOW","class_name": "ConversationSummarizeWorkflow" }
  ],
  "triggers": {
    "crons": [
      "*/5 * * * *",
      "0 0 * * *"
    ]
  }
}
```

The Worker's `default export` keeps `fetch`; we add `scheduled` for crons. The DO class and Workflow classes are exported from `apps/api/src/index.ts`.

---

## 7. Durable Object class

### 7.1 File: `apps/api/src/durable/conversation.ts`

Skeleton (final implementation expands tool calls and AI SDK plumbing):

```ts
export class ConversationDO implements DurableObject {
  constructor(private state: DurableObjectState, private env: Env) {}

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/__reap") return this.reap();

    if (req.headers.get("Upgrade") !== "websocket") return new Response("expected ws", { status: 426 });
    const role = req.headers.get("X-Leadly-Role") as "visitor" | "observer";
    const conversationId = url.pathname.split("/").pop()!;

    const pair = new WebSocketPair();
    this.state.acceptWebSocket(pair[1], [role, conversationId]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const tags = this.state.getTags(ws);
    const role = tags[0] as "visitor" | "observer";
    const parsed = ClientFrameSchema.safeParse(JSON.parse(typeof raw === "string" ? raw : new TextDecoder().decode(raw)));
    if (!parsed.success) { ws.close(1008, "bad frame"); return; }
    const frame = parsed.data;
    switch (frame.type) {
      case "user_msg":         return this.handleUserMessage(frame.payload.text);
      case "human_msg":        if (role === "observer") return this.handleHumanMessage(frame.payload.text);
      case "mode_change":      if (role === "observer") return this.handleModeChange(frame.payload.mode);
      case "end_conversation": return this.handleEndConversation(frame.payload.resolution);
      case "ping":             return ws.send(JSON.stringify({ type: "pong", payload: { t: Date.now() } }));
      // ...
    }
  }

  async webSocketClose(ws: WebSocket) {
    // schedule 5-min reconnect grace alarm if no other visitor sockets remain
    await this.maybeScheduleIdleAlarm();
  }
  async webSocketError(ws: WebSocket, err: unknown) { /* log */ }

  async alarm() {
    // 30-min hard cap or 5-min reconnect grace expired → end + summarize
    await this.handleEndConversation("idle_timeout");
  }

  // --- private ---
  private async handleUserMessage(text: string) {
    // Per design §4.1:
    // 1. persist user Turn
    // 2. identity-policy gate
    // 3. embed user msg (OpenAI)
    // 4. pgvector top-k=5 retrieval
    // 5. assemble system prompt
    // 6. AI SDK streamText with tools
    // 7. stream tokens → broadcast to all visitor + observer sockets
    // 8. on tool_call → execute → inject result → resume
    // 9. on stream end → persist agent Turn
    // 10. set/extend idle alarm
  }
  // ...
}
```

### 7.2 DO storage layout

Storage is for state that must survive hibernation but is too hot for Postgres. Postgres is still the source of truth for `Turn` rows.

| Key | Value | Purpose |
|---|---|---|
| `meta` | `{conversationId, agentId, organizationId, mode, status}` | Loaded once on rehydrate, kept in memory. |
| `idleAlarmAt` | `number` (epoch ms) | Tracked alongside `state.setAlarm` so reconnect logic can read it. |
| `identity` | `{ needs: ('name'|'email'|'phone')[], asks: number }` | Identity-capture state across turns. |
| `liveBuffer` | `Turn[]` (recent) | Last ~50 turns kept in memory; rebuilt from Postgres on first message after hibernation if missing. |
| `inFlight` | `{ turnId: string, abortAt: number } \| null` | Detect interrupted streams on rehydrate. |

Hibernation eviction: `state.setHibernatableWebSocketEventTimeout(0)` (or default) so the runtime can hibernate as soon as the WS is idle. On rehydrate, in-memory `Map<role, Set<WebSocket>>` is rebuilt from `state.getWebSockets()` and their tags.

### 7.3 Per-turn flow alignment with design §4.1

Each step in the design's 11-step list maps to a private method on the DO:

```
handleUserMessage(text) {
  await this.persistUserTurn(text);                 // (1)(2)
  const policyResult = await this.identityGate();   // (3)
  const emb = await embedQuery(text, this.env);     // (4)
  const chunks = await retrieve(emb, this.agentId); // (5)
  const messages = this.assembleMessages(chunks, policyResult); // (6)
  const stream = await streamText({ system, messages, tools: this.systemTools(), model: this.resolveModel() }); // (7)
  for await (const evt of stream) this.broadcastFrame(evt);     // (8)(9)
  await this.persistAgentTurn(stream.finishedResult);           // (10)
  await this.bumpIdleAlarm();                                   // (11)
}
```

### 7.4 DO binding

Already in `wrangler.jsonc` under `durable_objects.bindings` (§6.3). Worker entry exports `ConversationDO`:

```ts
// apps/api/src/index.ts (additions)
export { ConversationDO } from "./durable/conversation";
export { KbReembedWorkflow } from "./workflows/kb-reembed";
export { ConversationSummarizeWorkflow } from "./workflows/conversation-summarize";
```

---

## 8. Auth + authorization model

### 8.1 Better Auth config (`apps/api/src/lib/auth.ts`) — surgical edits

Drop the `role` `additionalFields` block (template leftover). Keep `isOnboarded`. The post-edit `user.additionalFields` is:

```ts
user: {
  additionalFields: {
    isOnboarded: { type: "boolean", required: false, defaultValue: false, input: false },
  },
},
```

Authorization is no longer a global `User.role`; it's per-org `Membership.role`.

### 8.2 Middleware additions (`apps/api/src/middleware/`)

| File | Export | Behavior |
|---|---|---|
| `auth.ts` | `authMiddleware` | (existing — keep). Replace the `AuthUser.role` field with `memberships?: {organizationId, role}[]` if pre-loaded; otherwise leave `AuthUser` minimal and let `org.ts` look up. |
| `org.ts` | `requireOrgMember` | Reads `:orgId` from path, looks up `Membership` by `(orgId, userId)`. Caches lookup per-request via `c.set("membership", m)`. |
| `org.ts` | `requireOrgAdmin` | Same as above but asserts `role ∈ {owner, admin}`. |
| `org.ts` | `requireAgentAccess(level: "member"|"admin")` | Reads `:agentId`, derives `organizationId` via `prisma.agent.findUnique({ where:{id}, select:{organizationId:true}})`, then defers to `requireOrgMember`/`requireOrgAdmin`. Caches the agent → orgId lookup in KV (`AGENT_ORG_KV` reuses `RATE_LIMIT_KV` namespace with a key prefix) for 5 minutes to avoid a DB roundtrip on every authenticated agent route. |
| `widget.ts` | `widgetTokenMiddleware` | Reads `?token=` (or `Authorization: Bearer`), verifies HMAC against `WIDGET_TOKEN_SECRET`, sets `c.set("widget", { conversationId, visitorId, agentId })`. |
| `rate-limit.ts` | `visitorRateLimit` | Token-bucket per (agentId, visitorIp) using `RATE_LIMIT_KV`. 30 msg/min default per design §5.6. Applied to `/api/widget/*` POST routes. |

Drop `requireRole`, `requireBusinessOwner`, `requireAdmin` from `middleware/auth.ts` — they reference the deleted global role.

### 8.3 Route group → required middleware matrix

| Route group | Middleware chain |
|---|---|
| `/api/auth/*` | (none — Better Auth handler) |
| `/api/me*` | `authMiddleware` |
| `/api/organizations` (POST, GET-list) | `authMiddleware` |
| `/api/organizations/:orgId*` (read) | `authMiddleware` → `requireOrgMember` |
| `/api/organizations/:orgId*` (write) | `authMiddleware` → `requireOrgAdmin` |
| `/api/organizations/:orgId/agents` (POST) | `authMiddleware` → `requireOrgAdmin` |
| `/api/agents/:agentId*` (read) | `authMiddleware` → `requireAgentAccess("member")` |
| `/api/agents/:agentId*` (write) | `authMiddleware` → `requireAgentAccess("admin")` |
| `/api/conversations/:conversationId*` (REST) | `authMiddleware` → `requireConversationAccess` (small wrapper that resolves agentId then defers to `requireAgentAccess`) |
| `/api/conversations/:conversationId/ws` | dual: visitor (`widgetTokenMiddleware`) OR session+`requireConversationAccess` — handled in the route handler itself, not via a single middleware |
| `/api/leads/:leadId*` | `authMiddleware` → `requireAgentAccess` (agentId derived from lead) |
| `/api/widget/config` | (public) |
| `/api/widget/visitors` | (public) → `visitorRateLimit` |
| `/api/widget/visitors/:id/identify`, `/api/widget/conversations` | `widgetTokenMiddleware` (the `widgetToken` issued at create time) |

---

## 9. Directory layout for `apps/api/src`

```
apps/api/src/
  index.ts                      # Hono app, exports app type, exports DO + workflows, scheduled handler
  durable/
    conversation.ts             # ConversationDO (§7)
  workflows/
    kb-reembed.ts               # KbReembedWorkflow (§6.1.1)
    conversation-summarize.ts   # ConversationSummarizeWorkflow (§6.1.2)
  crons/
    idle-reaper.ts              # */5 * * * *
    analytics-rollup.ts         # 0 0 * * *
    index.ts                    # cron event dispatcher (matches event.cron string → handler)
  routes/
    index.ts                    # mounts all sub-apps under /api
    me.ts
    organizations.ts            # org + members
    agents.ts                   # agents + tools (kept together — small)
    kb.ts
    leads.ts
    visitors.ts
    conversations.ts            # REST + WS upgrade
    analytics.ts
    widget.ts                   # public endpoints + visitor token issuance
    byok.ts
  middleware/
    auth.ts                     # session check
    org.ts                      # requireOrgMember, requireOrgAdmin, requireAgentAccess
    widget.ts                   # widgetTokenMiddleware
    rate-limit.ts               # visitorRateLimit
  lib/
    prisma.ts                   # (existing)
    auth.ts                     # Better Auth config (existing, edited per §8)
    ai.ts                       # AI SDK provider resolver: org/agent BYOK → returns `language model`
    embeddings.ts               # OpenAI embeddings call (used by DO + workflow)
    retrieval.ts                # pgvector top-k SQL (raw $queryRaw)
    crypto.ts                   # AES-256-GCM helpers (encryptForOrg/decryptForOrg) using SECRETS_ENCRYPTION_KEY
    widget-token.ts             # HMAC sign/verify for widget tokens
    cursor.ts                   # encode/decode cursor pagination
  services/
    agent-loop.ts               # the per-turn function the DO calls (steps 1-11)
    kb-service.ts               # split-on-##, chunking, replace-chunks transaction
    lead-service.ts             # capture_contact upsert (atomic, partial-unique-aware)
    conversation-service.ts     # takeover/release/end + DO RPC call
    tool-registry.ts            # system tool definitions, JSON Schemas, executors
  schemas/                      # DELETED — schemas live in @leadly/schemas
  generated/client/             # Prisma output (existing)
```

### 9.1 Why keep a `services/` layer

The DO's `webSocketMessage` and the REST handlers both need to do `lead-service.captureContact(...)`. Without `services/`, the logic ends up duplicated between `routes/leads.ts` (REST PATCH) and `tool-registry.ts` (the `capture_contact` executor). With one canonical service per domain concept, the DO and HTTP routes share an implementation. Same for `agent-loop.ts` — the DO is mostly orchestration (sockets, alarms, hibernation); pulling the per-turn pipeline into a service makes it testable without a `DurableObjectState`.

---

## 10. Build / deploy / dev commands

### 10.1 Dev

- `bun dev:api` — already runs `wrangler dev` on `apps/api`. Live TS for the worker; workspace packages (`@leadly/*`) are pulled directly from source by esbuild.
- `bun dev:web` — Vite dev server on port 3000. Same workspace package resolution.
- `bun dev` — runs both filtered (`bun run --filter='*' dev`).
- New: `bun typecheck` (root) — runs `tsc -b` across the project references graph (packages first, then apps). Used in CI and pre-push.

### 10.2 Cloudflare typegen

Already wired: `bun run --filter=api cf-typegen` produces `CloudflareBindings`. After adding KV/DO/Workflow/Cron bindings (§6.3) re-run this; the resulting interface populates the `Env` type used in `index.ts` and the DO/Workflow classes.

### 10.3 Migration flow

- Dev: `bun run --filter=api migrate:dev` — already wired with `dotenv -e .dev.vars`. The init migration's auto-generated SQL is hand-edited to add the pgvector extension creation, the HNSW index, and the partial-unique lead indexes (§2.6, §2.7).
- Prod: `prisma migrate deploy` from CI against the managed Postgres (Neon / Supabase / Railway). The `DATABASE_URL` in CI must be the *direct* Postgres URL, not the Accelerate URL — Accelerate doesn't run migrations. Runtime uses the Accelerate URL (set as `wrangler secret put DATABASE_URL`).
- Manual one-time step on first deploy: enable pgvector. The init migration runs `CREATE EXTENSION IF NOT EXISTS vector;` so this is automatic on Neon/Supabase/Railway (all support it). Document the prerequisite in the README.

### 10.4 Workspace consumption from web/native

Each app's `package.json` adds:

```json
"dependencies": {
  "@leadly/schemas": "workspace:*",
  "@leadly/wire": "workspace:*",
  "@leadly/api-client": "workspace:*"
}
```

Bun resolves `workspace:*` to the local package's `src/index.ts` via the `exports` map. Vite (web/widget) and Metro (native) both honor this with no extra config beyond Metro's `unstable_enablePackageExports = true`.

### 10.5 Wrangler bundle behavior with workspace TS

Wrangler delegates to esbuild. esbuild follows `package.json#exports` and bundles `.ts` directly. No build step is needed for any `@leadly/*` package as long as:

- `packages/*/package.json` has `"type": "module"`.
- `packages/*/package.json#exports` points at `./src/index.ts`.
- No package depends on Node-only built-ins that aren't covered by `nodejs_compat`.

This is the same pattern the existing `apps/api` already uses (it imports `prisma` from a local generated path). No bundling surprises expected.

### 10.6 Secrets to set before first prod deploy

```
wrangler secret put DATABASE_URL                # Accelerate connection string
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put OPENAI_API_KEY              # default for embeddings + system-prompt LLM when no BYOK
wrangler secret put SECRETS_ENCRYPTION_KEY      # 32-byte base64 — wraps per-org KEKs
wrangler secret put WIDGET_TOKEN_SECRET         # HMAC for widget tokens
```

KV namespace ids and R2 bucket names go into `wrangler.jsonc` (not secrets — public bindings).

---

## 11. Open questions / explicit non-decisions

These are intentionally not resolved here — call them before building.

1. **Member invite flow.** §4.4 v1 supports adding existing-user members by email. Email-invite-with-acceptance is gated on the email-provider decision (design §6.5 defers email entirely). Pick now: ship "add existing user only" in v1, or pre-decide an email provider so invites land sooner.

2. **WS auth token format.** §4.12 specifies HMAC-signed JWT-shaped tokens. Open: claims set (just `{conversationId, visitorId, agentId, exp}`?), TTL (1 h proposed), and rotation on `WIDGET_TOKEN_SECRET` change.

3. **Cursor encoding.** §4.16 picks `(createdAt, id)` cursor encoded as base64url JSON. Alternative: hashids/opaque server-signed cursors. Trivial difference; pick one.

4. **Visitor IP source-of-truth on Workers.** Rate limiting needs an IP. Workers gives `cf-connecting-ip` reliably; widget iframe is on a different host (`widget.leadly.example`) so the upstream visitor IP is the iframe → widget connection. Fine for v1, but call it out so nobody assumes the host site's IP is captured.

5. **Daily rollup time zone.** `0 0 * * *` is UTC. Customer-facing analytics labels need a TZ. v1: hardcode UTC and label as such, or store rollups per-org-TZ. Pick UTC for v1 unless overridden.

6. **Per-agent rate-limit numbers.** Design §5.6 says "30 messages/min default" — apply per `(agentId, visitorIp)`. Org-level overrides not specified. Pick: org-overridable in v1 vs hardcoded.

7. **Widget signed cookie semantics.** §4.12 issues a signed visitor cookie. Open: cookie domain (host site can't set on `widget.leadly.example`; needs to be issued by widget origin), expiry (1 year proposed), and rotation strategy.

8. **OpenAPI doc generation strategy.** `/doc` already serves the spec from `@hono/zod-openapi`. Open: do we publish a static `openapi.json` artifact alongside builds for non-TS clients? Out of v1 unless asked for.

9. **AI SDK provider keys at agent-loop time.** `lib/ai.ts` resolves the model from `AgentLlmOverride` → `OrgLlmCredential` → env `OPENAI_API_KEY`. Open: cache the decrypted key in the DO instance memory (lifetime = until hibernate) vs. decrypt-per-turn. Per-turn is safer; cache-in-DO is faster. Pick before building the loop.

10. **`KbChunk` deletion-vs-tombstone on article update.** §2.6 / §6.1.1 says "atomic delete + insert in a tx". Open: do we want a brief read-skew window where retrieval returns 0 results during the tx? Postgres's MVCC makes this near-zero in practice; document or accept.

11. **Tool registration on agent create.** When `POST /api/organizations/:orgId/agents` runs, do we seed the four system tool rows (capture_contact, request_handoff, set_conversation_summary, end_conversation) into the `Tool` table for that agent, or treat system tools as code-only and have the `Tool` table only host customer tools (v2)? Recommend seeding so the dashboard's tools list works uniformly; confirm.

12. **Widget origin for self-host.** `widget.leadly.example` is the SaaS origin. Self-hosters point the loader at their own widget app. Decide where the loader reads its API URL from — `data-api-url` attribute on the `<script>` tag is the simplest; document that as the contract.

---

### Critical Files for Implementation

- apps/api/src/index.ts
- apps/api/src/durable/conversation.ts
- apps/api/prisma/domain.prisma
- apps/api/wrangler.jsonc
- packages/schemas/src/index.ts
