<div align="center">

# Leadly

**Open-source AI inbound support — embeddable chat widget with a knowledge-base-backed agent, lead capture, and a live human-takeover inbox.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Bun](https://img.shields.io/badge/Bun-workspace-000000?logo=bun&logoColor=white)](https://bun.sh)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)

[Features](#features) · [Quick start](#quick-start) · [Embed the widget](#embed-the-widget) · [Architecture](./docs/v1-design.md) · [Contributing](#contributing)

</div>

---

> **Status:** v1 (chat) is pre-launch. The backend is live-tested end to end, and the dashboard covers the full v1 surface. Voice is planned for v2. See [`docs/v1-design.md`](./docs/v1-design.md) for the product and architecture decisions and [`docs/v1-backend-plan.md`](./docs/v1-backend-plan.md) for the build spec.

## Features

**AI agent**
- Knowledge-base answers: articles and file uploads are embedded, and each turn retrieves the top 5 matches with pgvector.
- Per-agent persona, greeting, model choice and identity-capture policy.
- Natural messaging: replies stream as short chat bubbles instead of one long block.
- Agent tools: capture contact details, save lead fields, request a human handoff, end the conversation.

**Leads**
- Custom lead fields per agent, collected during the chat without re-asking returning visitors.
- Post-chat analysis for every finished or abandoned conversation: summary, intent, lead score and quality, extracted fields and key facts.
- Leads table with an edit drawer and CSV export.

**Inbox & dashboard**
- Live inbox with human takeover. The operator replies as the agent, and the AI resumes when they hand back.
- Playground to chat with an agent before installing it.
- Analytics (KPIs, time series, most-cited articles) and a visitors view.
- Light and dark themes.

**Teams & workspaces**
- Multiple workspaces per user, each at its own URL (`/<workspace>/…`).
- Invite teammates by link. Pending invitations also appear in the app for verified emails.
- Owner / admin / member roles. Owners can change roles, delete the workspace, or delete their account.
- Bring your own key (BYOK): workspace provider keys are encrypted at rest with AES-256-GCM and only ever shown masked.

**Platform**
- Drop-in widget: one `<script>` tag, with snippets for HTML, React/Next.js, Shopify and WordPress.
- Sign-in with email/password or Google (Better Auth).
- Optional LangSmith tracing of every AI SDK call.

## Repo map

```
leadly/
├── apps/
│   ├── api/              Cloudflare Worker — Hono + Durable Objects + Prisma
│   ├── web/              Dashboard + marketing site + widget loader — Vite + React 19 + TanStack Router/Query
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
| Async | Cloudflare Workflows (KB re-embed, conversation summarize + lead analysis) |
| Cron | wrangler `triggers.crons` (idle reaper, daily analytics) |
| Blob | R2 (KB uploads) |
| Auth | Better Auth: email/password + Google OAuth |
| LLM | Vercel AI SDK v6, with OpenRouter as the single provider |
| Embeddings | OpenRouter `openai/text-embedding-3-small` (1536-dim) |
| Tracing | LangSmith (optional) |
| Dashboard | Vite, React 19, TanStack Router/Query, shadcn/ui, Tailwind |

## Prerequisites

- [Bun](https://bun.sh) (workspace package manager + test runner)
- A Postgres instance with pgvector enabled (Prisma Accelerate URL)
- An [OpenRouter](https://openrouter.ai/keys) API key
- A [Cloudflare](https://dash.cloudflare.com) account (to deploy: Workers, Durable Objects, Workflows, KV, R2)

## Quick start

```bash
bun install

# 1. API secrets: copy apps/api/.dev.vars.example → apps/api/.dev.vars and fill in
#    Required: DATABASE_URL, BETTER_AUTH_SECRET, OPENROUTER_API_KEY,
#              SECRETS_ENCRYPTION_KEY (generate with `openssl rand -base64 32`)
#    Optional: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (Google sign-in),
#              LANGCHAIN_TRACING / LANGCHAIN_API_KEY (LangSmith tracing)

# 2. Dashboard env: copy apps/web/.env.example → apps/web/.env.local
#    VITE_API_URL (default http://localhost:8787/api), VITE_WIDGET_LOADER_URL

# 3. Apply the schema (runs against whatever DATABASE_URL points at)
bun run --filter=api migrate

# 4. Run the dev servers
bun dev:api      # wrangler dev on :8787
bun dev:web      # Vite on :3000
```

Open http://localhost:3000, sign up, and create your first workspace and agent.

### Deploying

Point `apps/api/wrangler.jsonc` at your own KV namespace ID and R2 bucket. Set the secrets with `npx wrangler secret put <NAME>`, then run `bun build:api`. Plaintext Worker vars set in the Cloudflare dashboard are kept across deploys (`keep_vars`).

## Embed the widget

Every agent has an **Install** page in the dashboard with a ready-made snippet. It looks like this:

```html
<script
  src="https://your-dashboard-host/loader.js"
  data-agent-id="<agent-id>"
  data-api-url="https://your-api-host"
  defer
></script>
```

The loader injects the chat bubble and an iframe. The iframe opens a WebSocket to the agent's conversation Durable Object.

## Workspace scripts

```bash
bun test         # All package tests (Bun's test runner + vitest for web)
bun typecheck    # tsc --noEmit across every workspace
bun lint         # Biome lint
bun build        # All apps
bun build:api    # Deploy the worker (wrangler deploy)
```

Per-package: `bun run --filter=api test`, `bun run --filter=@leadly/schemas typecheck`, etc.

> DB tests hit the database in `DATABASE_URL`. They scope fixtures with a tag prefix and clean up after themselves, but point them at a dev database, not production.

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
| Known v1 follow-ups | [`docs/v1-carryovers.md`](./docs/v1-carryovers.md) |
| Architecture summary for AI | [`CLAUDE.md`](./CLAUDE.md) |
| Route table & WebSocket frames | [`apps/api/README.md`](./apps/api/README.md) |
| Schema → types pattern | [`packages/schemas/src/`](./packages/schemas/src/) |
| Live conversation core | [`apps/api/src/durable/conversation.ts`](./apps/api/src/durable/conversation.ts) |
| Lead capture + post-chat analysis | [`apps/api/src/services/lead-capture/`](./apps/api/src/services/lead-capture/) |
| Multi-bubble replies | [`apps/api/src/services/natural-messaging/`](./apps/api/src/services/natural-messaging/) |
| Members, invites, deletion | [`apps/api/src/routes/invitations.ts`](./apps/api/src/routes/invitations.ts), [`apps/api/src/lib/org-deletion.ts`](./apps/api/src/lib/org-deletion.ts) |

## Contributing

Issues and pull requests are welcome! Start with [`CONTRIBUTING.md`](./CONTRIBUTING.md) for setup, conventions and the architectural invariants every PR has to keep. In short: read [`CLAUDE.md`](./CLAUDE.md), and run `bun typecheck`, `bun lint` and `bun test` before opening a PR.

Please follow the [Code of Conduct](./CODE_OF_CONDUCT.md). To report a vulnerability, see [`SECURITY.md`](./SECURITY.md). Don't open a public issue.

## License

[MIT](./LICENSE)
