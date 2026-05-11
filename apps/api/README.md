# Leadly API

Hono on Cloudflare Workers. Durable Objects for live conversation state. Postgres + pgvector via Prisma Accelerate. AI SDK v6 + OpenRouter for everything LLM.

## Develop

```bash
bun install
bun run dev          # wrangler dev on :8787
bun run typecheck    # tsc --noEmit
bun run test         # bun test against the dev DB
bun run build        # wrangler deploy --dry-run
```

`bun run dev` reads secrets from `.dev.vars` (copy from `.dev.vars.example`).

## Bindings

Declared in `wrangler.jsonc`. The shape lives in `src/types.ts` (`Bindings`).

| Binding | What |
|---|---|
| `DATABASE_URL` | Prisma Accelerate URL with pgvector enabled |
| `BETTER_AUTH_SECRET` | Better Auth signing key (also signs widget tokens) |
| `OPENROUTER_API_KEY` | Platform / fallback LLM key |
| `SECRETS_ENCRYPTION_KEY` | 32-byte base64 root for BYOK envelope encryption |
| `MEDIA_BUCKET` | R2 bucket for KB uploads |
| `WIDGET_CACHE` | KV for widget-config caching + per-visitor rate limits |
| `KB_REEMBED` | Workflow — re-chunks + re-embeds an article |
| `CONVERSATION_SUMMARIZE` | Workflow — runs after `end_conversation` |
| `CONVERSATION` | Durable Object — one per conversationId |

## Database

Prisma multi-file schema under `prisma/`:

- `schema.prisma` — generator + datasource + every shared enum
- `auth.prisma` — Better Auth tables (User / Session / Account / Verification)
- `domain.prisma` — Org / Membership / Agent / KbArticle / KbChunk / Visitor / Lead / Conversation / Turn / DailyStat
- `byok.prisma` — OrgLlmCredential / AgentLlmOverride

```bash
bun run migrate         # prisma migrate dev (creates a new migration)
bun run generate        # prisma generate
bun run studio          # prisma studio
```

`scripts/verify-db.ts` asserts the vector extension, the HNSW index, the partial-unique lead-dedup indexes, and that all 17 expected tables are present.

> ⚠️ **HNSW index drops on every new Prisma migration.** Prisma's drift detection can't see the raw-SQL `CREATE INDEX … USING hnsw` from the init migration. After `prisma migrate dev`, edit the generated `migration.sql` to make the `DROP INDEX` idempotent and append a `CREATE INDEX IF NOT EXISTS … USING hnsw (embedding vector_cosine_ops)` at the bottom. Track `prisma/prisma#18442` for native vector index support.

## Routes

All routes return JSON (or 101 for the WS upgrade). Auth is Better Auth session-cookie unless the row says otherwise.

### Public

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | liveness |
| GET | `/doc` | OpenAPI 3.0 |
| POST/GET | `/api/auth/*` | Better Auth (Google OAuth + email/password) |
| GET | `/api/widget/config?agentId=…` | KV-cached 60s |
| POST | `/api/widget/visitor?agentId=…` | upsert Visitor → returns widget token |
| POST | `/api/widget/conversation` | Bearer widget token → creates Conversation |
| GET | `/api/conversations/:id/ws?token=…` | WS upgrade (visitor or `?role=observer`) |

### Authed (Better Auth session)

```
Org
  GET    /api/orgs                                       list caller's orgs
  POST   /api/orgs                                       create
  GET    /api/orgs/:orgId                                get with members        [member]
  PATCH  /api/orgs/:orgId                                update name/slug         [admin]
  POST   /api/orgs/:orgId/members                        invite by email          [admin]
  DELETE /api/orgs/:orgId/members/:userId                remove                   [admin]

Agent
  GET    /api/orgs/:orgId/agents                         list                     [member]
  POST   /api/orgs/:orgId/agents                         create                   [member]
  GET    /api/agents/:agentId                            get                      [agent-access]
  PATCH  /api/agents/:agentId                            update                   [agent-access]
  DELETE /api/agents/:agentId                            delete                   [agent-access]

KB
  GET    /api/agents/:agentId/kb/articles                list (no body)           [agent-access]
  GET    /api/agents/:agentId/kb/articles/:id            full article             [agent-access]
  POST   /api/agents/:agentId/kb/articles                create from JSON         [agent-access]
  POST   /api/agents/:agentId/kb/articles/upload         create from .md/.txt     [agent-access]
  PATCH  /api/agents/:agentId/kb/articles/:id            update                   [agent-access]
  DELETE /api/agents/:agentId/kb/articles/:id            delete                   [agent-access]

Visitors
  GET    /api/agents/:agentId/visitors                   list                     [agent-access]
  GET    /api/visitors/:id                               detail                   [org-member]

Leads
  GET    /api/agents/:agentId/leads (?search=…)          list                     [agent-access]
  GET    /api/leads/:id                                  detail                   [org-member]
  PATCH  /api/leads/:id                                  update                   [org-member]
  DELETE /api/leads/:id                                  delete                   [org-member]

Conversations (inbox)
  GET    /api/agents/:agentId/conversations              cursor-paginated list    [agent-access]
  GET    /api/conversations/:id                          detail with turns        [org-member]
  POST   /api/conversations/:id/take-over                pause + observerToken    [org-member]
  POST   /api/conversations/:id/release                  un-pause                 [org-member]
  POST   /api/conversations/:id/human-message            operator reply           [org-member]

Analytics
  GET    /api/agents/:agentId/analytics/summary          windowDays 1..90         [agent-access]
  GET    /api/agents/:agentId/analytics/timeseries       windowDays 1..90         [agent-access]

BYOK
  GET    /api/orgs/:orgId/credentials                    list (masked only)       [member]
  POST   /api/orgs/:orgId/credentials                    store new                [admin]
  DELETE /api/orgs/:orgId/credentials/:id                delete                   [admin]
  POST   /api/agents/:agentId/credential-override        set per-agent            [agent-access]
  DELETE /api/agents/:agentId/credential-override        clear                    [agent-access]
```

## WebSocket protocol

Defined in [`packages/wire`](../../packages/wire/src/index.ts). Three discriminated unions, one per direction:

- **`ClientFrame`** (visitor → server): `widget_hello` · `user_msg` · `ping`
- **`ServerFrame`** (server → all): `agent_token` · `agent_turn_end` · `tool_call` · `tool_result` · `typing` · `mode_change` · `human_msg` · `error` · `pong`
- **`ObserverFrame`** (dashboard → server): `observer_hello` · `observer_take_over` · `observer_release` · `observer_human_msg` · `ping`

Inbound frames go through `parseInbound(raw, role)` before the DO trusts them. Bad JSON or unknown types produce a server `error` frame with `code: invalid_frame`.

## Cron

Declared in `wrangler.jsonc` `triggers.crons`. Dispatched in `src/index.ts` `scheduled()`.

| Cron | What |
|---|---|
| `*/5 * * * *` | `reapIdleConversations` — flips stuck active+auto Conversations to `abandoned` |
| `5 0 * * *` | `rollupYesterdayAllAgents` — writes one `DailyStat` per agent for the previous UTC day |

Wrangler dev doesn't fire crons automatically. Manual:

```bash
curl "http://localhost:8787/__scheduled?cron=*/5 * * * *"
```

## End-to-end smokes

```bash
# 1. wrangler dev in another terminal
bun run dev

# 2. WebSocket round-trip through OpenRouter
bunx dotenv -e .dev.vars -- bun scripts/ws-smoke.ts

# 3. REST surface (no LLM calls)
bunx dotenv -e .dev.vars -- bun scripts/e2e-smoke.ts
```

## Tests

`bun run test` against the dev DB. ~200 api tests; each route group has its own `*.test.ts`. Tests create per-test fixtures with a `tag` prefix and clean up via cascade delete on the org row.

## Auth

Better Auth, Google OAuth + email/password. Custom `databaseHooks.user.create.after` auto-creates a personal Organization + owner Membership on first sign-up so a fresh dashboard always has at least one org to work with.

### Auth performance on Cloudflare Workers

Dashboard routes can call `GET /api/auth/get-session` often during navigation because TanStack Router guards, route preloading, and session UI all need to know whether the user is signed in. Repeated `get-session` logs are normal during active dashboard use.

Best practices:

- Use Better Auth's documented `session.cookieCache` for session caching. It stores short-lived signed session data in a cookie so most `getSession` / `useSession` calls do not hit Postgres.
- Keep the cache short. Leadly uses `maxAge: 5 * 60`; use `60` seconds instead if immediate cross-device revocation matters more than fewer DB reads.
- Do not add custom module-level caches for the Better Auth instance or Prisma client inside the Worker unless the runtime behavior has been proven safe. Cloudflare can cancel continuations from promises that resolve after their request context has ended, which shows up as cross-request promise warnings and can lead to hung requests.
- Frontend de-duping is fine for navigation bursts. `apps/web/src/lib/auth-client.ts` shares one pending dashboard guard `getSession()` call and keeps a short browser-side result cache.

## Design references

- [`docs/v1-design.md`](../../docs/v1-design.md) — product / architecture
- [`docs/v1-backend-plan.md`](../../docs/v1-backend-plan.md) — build spec
- [`CLAUDE.md`](../../CLAUDE.md) — AI orientation
