# CLAUDE.md — orientation map

You're working on **Leadly**, an open-source AI inbound-support platform. This file is the "you are here" map. Read it first; then read what it points at.

---

## What Leadly is, in one paragraph

A visitor on a customer's website clicks a chat bubble. A small iframe loads, opens a WebSocket, and starts a conversation with an AI agent. The agent's behaviour is defined per-customer (greeting, persona, KB articles, identity capture policy). Every turn: embed user message → pgvector top-k from the agent's KB → assemble system prompt → stream tokens via OpenRouter → broadcast frames back over the WS. Tools (capture_contact, request_handoff, end_conversation) flip durable state and signal observers. The dashboard owner can take over any live conversation; the visitor sees the operator as the same agent. v1 is chat-only — voice is v2.

## Hard architectural commits

- **Cloudflare end-to-end.** Workers + Durable Objects + Workflows + R2 + KV. No portability layer; self-hosters use Cloudflare too.
- **Single LLM provider: OpenRouter** via `@openrouter/ai-sdk-provider` + AI SDK v6. No `@ai-sdk/openai`, no MCP. Embeddings + chat both go through OpenRouter.
- **One Durable Object per `Conversation`**, addressed by `conversationId`. WebSocket Hibernation. The DO owns the live history buffer; finalized turns persist to Postgres at boundaries.
- **Postgres + pgvector via Prisma Accelerate.** 1536-dim embeddings, HNSW index, top-k=5 cosine retrieval. The HNSW index lives in raw migration SQL because Prisma can't express it; **every new Prisma migration must re-add the index** (drift detection drops it).
- **Zod schemas in `packages/schemas` are the API contract.** Every Hono route validates with one; the typed client and dashboard forms reuse the exact same schemas. Types come from `z.infer`.

These choices are documented in detail in `docs/v1-design.md`. **Don't second-guess them in code without an explicit user decision.**

## Repo at a glance

```
apps/api/             Cloudflare Worker — the backend
  src/
    index.ts          worker entrypoint (fetch + scheduled)
    types.ts          AppEnv (Bindings + Variables)
    durable/          ConversationDO — live chat orchestrator
    routes/           Hono routers (one file per resource)
    services/         pure-ish business logic (agent loop, system tools, …)
    workflows/        Cloudflare Workflows (kb-reembed, conversation-summarize)
    crons/            Scheduled-handler bodies (idle-reaper, analytics-rollup)
    middleware/       authMiddleware, requireOrgMember, …
    lib/              prisma, embeddings, retrieval, crypto, widget-token, …
  prisma/             Multi-file schema (auth + domain + byok)
  scripts/            verify-db.ts, ws-smoke.ts, e2e-smoke.ts

apps/web/             Dashboard — Vite + React + TanStack Router/Query

packages/schemas/     Zod schemas — single source of truth
packages/wire/        WS envelope (3 discriminated unions + parsers)
packages/api-client/  createLeadlyClient(opts) — typed fetch wrapper
packages/utils/       slugify, assertNever
packages/config/      Shared tsconfig + biome bases

docs/
  v1-design.md          Why everything is the way it is
  v1-backend-plan.md    How the backend was built (build spec)
```

## Where to look first when…

| Task | Start here |
|---|---|
| Adding a new REST route | `apps/api/src/routes/<resource>.ts` — copy a sibling, mount in `routes/index.ts` |
| Changing the WS protocol | `packages/wire/src/index.ts` — update discriminated union + parser, then DO + widget |
| Adding a tool the agent can call | `apps/api/src/services/system-tools.ts` (registry) + wire in `durable/conversation.ts` |
| Changing the schema | `apps/api/prisma/domain.prisma` → `bun run --filter=api migrate` → **re-add HNSW index** |
| Adding a Zod schema | `packages/schemas/src/<area>.ts` — mirror the route, type via `z.infer` |
| Tweaking the live conversation logic | `apps/api/src/durable/conversation.ts` — `runUserTurn` is the per-turn flow |
| Lead capture (lead fields, key facts) | `apps/api/src/services/lead-capture/` — `prompt.ts` (live), `extraction.ts` (post-chat), `store.ts` (atomic JSONB writes) |
| Natural messaging (multi-bubble replies) | `apps/api/src/services/natural-messaging/` — `ReplyStream` maps a streamed reply to frames + Turn rows |
| Adding a workflow | `apps/api/src/workflows/<name>.ts`, export from `src/index.ts`, register in `wrangler.jsonc` |
| Adding a cron | `apps/api/src/crons/<name>.ts`, dispatch in `src/index.ts` `scheduled()`, add to `triggers.crons` |
| Touching auth | `apps/api/src/lib/auth.ts` (Better Auth config). Sign-in lands on `/dashboard` (`apps/web/src/lib/dashboard-entry.ts`), which opens the last-used workspace or, for a user with none, the create-workspace dialog |
| Adding a dashboard page | `apps/web/src/routes/$orgSlug/` — the app lives at `/<orgSlug>/…`; build links with `useOrgPath()` (`apps/web/src/hooks/use-current-org.ts`) |
| Members, invites, deleting workspaces/accounts | API: `routes/invitations.ts`, `routes/me.ts`, `lib/org-deletion.ts` (R2/KV cleanup lives here); web: `components/dashboard/members-settings.tsx`, `routes/invite.$token.tsx` |
| Adding a marketing (top-level) page | `apps/web/src/routes/<page>.tsx` **and** add the path to `RESERVED_ORG_SLUGS` in `packages/schemas/src/org.ts` (a web test fails otherwise) |

## Tests, in one place

- **Unit tests** live next to the code (`*.test.ts`). ~270 across the workspace as of v1.
- **Bun's test runner** for everything (no Jest, no Vitest at the API layer; web keeps Vitest).
- **Run all:** `bun test`. Per-package: `bun run --filter=api test`.
- **DB tests** hit the real dev Prisma DB. They scope fixtures with a `tag` prefix and clean up via the org's cascade delete.
- **Live smokes** in `apps/api/scripts/`. Need a running `wrangler dev`. They exit non-zero on failure.

## Things that bite

1. **Prisma 7 + `@prisma/extension-accelerate` drops relation types** when `where` is present (`prisma/prisma#28703`). Workaround: cast through `unknown as` to a hand-declared shape. Search for `MembershipWithUser` for the pattern.
2. **HNSW vector index** doesn't survive Prisma's drift detection. Every new migration must re-add it (idempotent DROP IF EXISTS + CREATE IF NOT EXISTS).
3. **Browsers can't set headers on WebSocket Upgrade.** Widget tokens ride in the `?token=…` query string instead of `Authorization`. The token's payload binds (visitorId, agentId), so URL log leakage has minimal blast radius.
4. **OpenRouter `FinishReason` is `{ unified, raw }`**, not a string, in AI SDK v6's `LanguageModelV3` interface. Mock test data needs the object shape.
5. **`generateObject` against free-tier models** can be flaky. The `ConversationSummarize` workflow uses it; if a customer's free model can't produce structured output, summary stays null until the next end_conversation.
6. **Workspace URLs share the root with marketing pages.** The app is `/<orgSlug>/…` and static routes win, so a slug equal to a top-level page would be unreachable. `RESERVED_ORG_SLUGS` blocks those on rename and suffixes them on create. Old `/dashboard/…` links redirect to the last-used workspace.

## Build phase notes (delete when launched)

- v1.0.0.x is **pre-launch**. Dev DB resets are pre-approved (`prisma migrate reset`); see `.agents/` for the personal execution plan.
- Default chat model during build: `tencent/hy3-preview:free` (free OpenRouter tier). Production picks should be set per-agent or via org BYOK.
- Phase 7 + Phase 10 + Phase 13 all ran a live OpenRouter round-trip through `scripts/ws-smoke.ts` — that's the canonical "does the whole thing work" gate.

## When making changes, keep these invariants

- **The WS protocol is stable.** Add new frame types; don't rename. Pinned widget tabs depend on it.
- **BYOK plaintext never leaves the encryption boundary.** Routes return `maskedSuffix` only; `decryptForOrg` is the single read path.
- **Every non-auth table carries `organizationId`** so multi-tenant filtering stays trivial. Don't relax that for "convenience."
- **Tool execute() functions stay pure-ish** — they mutate DB rows and return JSON. WS broadcasts and workflow triggers are the DO's job, not the executor's.
