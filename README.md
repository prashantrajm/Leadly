# Leadly

Open-source AI inbound support — embeddable chat widget with a knowledge-base-backed agent, lead capture, and a live human-takeover inbox. Apache-2.0.

> v1 backend is built and live-tested end-to-end. See [`docs/v1-design.md`](./docs/v1-design.md) for the product/architecture decisions and [`docs/v1-backend-plan.md`](./docs/v1-backend-plan.md) for the build spec.

## Repo map

```
leadly/
├── apps/
│   ├── api/              Cloudflare Worker — Hono + Durable Objects + Prisma
│   ├── web/              Dashboard — Vite + React 19 + TanStack Router/Query
│   └── native/           Expo (out of v1 scope, kept)
├── packages/
│   ├── schemas/          Zod schemas — single source of truth for API contracts
│   ├── wire/             WebSocket envelope (visitor ↔ DO ↔ observer)
│   ├── api-client/       Typed client (createLeadlyClient) wrapping fetch
│   ├── utils/            slugify, assertNever
│   └── config/           Shared tsconfig + biome bases
├── docs/                 Design + architecture
└── CLAUDE.md             AI orientation map (read this first)
```

## Stack

| Layer | Choice |
|---|---|
| Runtime | Cloudflare Workers + Hono (`@hono/zod-openapi`) |
| Stateful | Durable Object per `Conversation` (WebSocket Hibernation) |
| DB | Postgres + pgvector via Prisma Accelerate |
| Cache / rate-limit | Workers KV |
| Async | Cloudflare Workflows (KB re-embed, conversation summarize) |
| Cron | wrangler `triggers.crons` (idle reaper, daily analytics) |
| Blob | R2 (KB uploads) |
| Auth | Better Auth + Google OAuth |
| LLM | Vercel AI SDK v6 — single provider: OpenRouter |
| Embeddings | OpenRouter `openai/text-embedding-3-small` (1536-dim) |

## Prerequisites

- [Bun](https://bun.sh) (workspace package manager + test runner)
- A Postgres instance with pgvector enabled (Prisma Accelerate URL)
- An [OpenRouter](https://openrouter.ai/keys) API key

## Quick start

```bash
bun install

# 1. apps/api/.dev.vars — copy from .dev.vars.example, fill secrets
#    DATABASE_URL, BETTER_AUTH_SECRET, OPENROUTER_API_KEY,
#    SECRETS_ENCRYPTION_KEY (generate with `openssl rand -base64 32`)
#    Deployed Worker plaintext vars stay in Cloudflare dashboard; wrangler keeps them via keep_vars.

# 2. Apply the schema
bun run --filter=api migrate

# 3. Run the dev server
bun dev:api      # wrangler dev on :8787
bun dev:web      # Vite on :3000
```

## Workspace scripts

```bash
bun test         # All package tests (Bun's test runner + vitest for web)
bun typecheck    # tsc --noEmit across every workspace
bun lint         # Biome lint
bun build        # All apps
bun build:api    # Wrangler dry-run for the worker
```

Per-package: `bun run --filter=api test`, `bun run --filter=@leadly/schemas typecheck`, etc.

## End-to-end smokes

Two `wrangler dev`-driven scripts under `apps/api/scripts/`:

```bash
# Boots an org/agent, opens a WebSocket via the widget handshake, sends
# a user message, and asserts the agent streams tokens back via OpenRouter.
cd apps/api && bun run dev    # in one terminal
bunx dotenv -e .dev.vars -- bun scripts/ws-smoke.ts    # in another

# Walks every major REST surface (orgs/agents/kb/conversations) end-to-
# end against the running worker. Doesn't make any LLM calls — fast.
bunx dotenv -e .dev.vars -- bun scripts/e2e-smoke.ts
```

Both exit non-zero on failure with a clear message of what didn't match.

## Where things live

| Looking for… | Open |
|---|---|
| Why the design is what it is | [`docs/v1-design.md`](./docs/v1-design.md) |
| How the backend was built | [`docs/v1-backend-plan.md`](./docs/v1-backend-plan.md) |
| Architecture summary for AI | [`CLAUDE.md`](./CLAUDE.md) |
| Route table & WebSocket frames | [`apps/api/README.md`](./apps/api/README.md) |
| Schema → types pattern | [`packages/schemas/src/`](./packages/schemas/src/) |
| Live conversation core | [`apps/api/src/durable/conversation.ts`](./apps/api/src/durable/conversation.ts) |

## License

Apache-2.0.
