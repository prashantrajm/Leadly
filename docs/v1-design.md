# Leady — v1 Design Document

> Output of the `/grill-me` session. Every decision below is paired with the **purpose** it serves and the **alternatives rejected**, so future-you can re-open any branch with full context. Decisions marked **(deferred)** are explicitly out of v1 scope but the architecture is shaped to absorb them without rewrite.

---

## 1. Product

### 1.1 Wedge

**Decision:** Inbound AI support, channel-agnostic. End-user picks chat or voice from the same widget; both hit the same agent, KB, and tool-call infrastructure. Open-source, SMB-targeted.

**Purpose:** One agent, two transports. The agent's behaviour (system prompt + KB retrieval + tool calls + transcript) is identical regardless of channel. This positions Leady as "OSS AI support that works on the channel the visitor wants," not as another single-channel chatbot.

**Rejected:**
- Outbound voice as the wedge (better-funded competition: Bland, Vapi, Air).
- Unified-inbox (Chatwoot positioning) — the differentiator there is the thread, not the AI.
- Developer-API primitive (Vapi/Bland clone) — too narrow for an OSS platform play; doesn't give self-hosters something to *run*.

### 1.2 Inbound origin (v1)

**Decision:** Website widget only. Single `<script>` install. Visitor clicks the bubble and chats (voice deferred — see §6.4).

**Purpose:** WebRTC voice-in-browser is the simplest voice path; no Twilio, no PSTN, no SIP. For v1 the call CTA itself is deferred but the architecture below assumes it lights up later.

**Rejected:** PSTN phone numbers (telephony stack is a multi-week detour); omnichannel WhatsApp/IG/email (each channel is its own auth + webhook + rate-limit puzzle); SDK-only (no surface for non-technical SMBs).

### 1.3 Customer

**Decision:** SMB-first (solo operators, 1–20 employees). API-first internals, opinionated UX on top.

**Purpose:** SMBs decide fast and don't require SSO/SCIM to say yes. Building the dashboard as a thin layer over a clean public API means OSS self-hosters get the same surface, and small-team mid-market (10–20 employees) can be reached later by adding org/role features without a rewrite.

**Rejected:** Pure-developer (C, dev primitive) — too narrow for revenue. Mid-market-first (B) — 6 months of SSO/RBAC scaffolding before anything ships.

---

## 2. Domain Model

### 2.1 Tenancy

**Decision:**
```
Organization (1) ─< User      (many)
Organization (1) ─< Agent     (many)
Agent        (1) ─< KbArticle (many)
KbArticle    (1) ─< KbChunk   (many)        // chunks own the embedding
Agent        (1) ─< Tool      (many)        // scope = system | customer
Agent        (1) ─< Visitor   (many)
Agent        (1) ─< Lead      (many)
Visitor      (0..1) ─ Lead                  // upgraded when identified
Agent        (1) ─< Conversation (many)
Conversation (1) ─< Turn      (many)
```

**Org → Agent (one Agent per website/brand).** An agency or anyone with two brands runs two agents under one org.

**Purpose:** Multi-user orgs are baked in from day one even though v1 only ever shows one user. Retrofitting `organizationId` onto every table later is a migration that kills momentum. One-Agent-per-website is the natural unit for KB scoping, billing, and analytics.

**Rejected:** One-agent-per-org (forces a migration as soon as a customer asks for a second one). Many-agents-per-website routed by intent (premature; can be layered on later as agent variants).

### 2.2 Conversation model

**Decision:** Single `Conversation` table with `channel` enum (`chat` | `voice`). Single `Turn` table with voice-specific columns (`audioUrl`, `durationMs`, `asrConfidence`) **nullable**. v1 only emits `channel = 'chat'`.

```
Conversation
  id, agentId, visitorId, leadId?, channel,
  mode ('auto' | 'paused'),
  status, startedAt, endedAt,
  summary?, sentiment?, tags? (jsonb)

Turn
  id, conversationId, role ('user' | 'agent' | 'human' | 'tool' | 'system'),
  text,
  audioUrl?, durationMs?, asrConfidence?,        -- voice only, null in v1
  toolName?, toolArgs? (jsonb), toolResult? (jsonb),
  llmProvider?, model?, latencyMs?, tokensIn?, tokensOut?,
  createdAt
```

**Purpose:** The agent's view of a conversation is identical regardless of channel — system prompt, user turn, tool call, agent turn. Inbox/search/analytics/transcript export all work uniformly. Mid-conversation channel switch (chat → voice) is one record, not two stitched together.

**Rejected:** Separate `ChatThread` and `VoiceCall` tables (every query becomes a UNION). Polymorphic JSONB messages (loses type safety and indexability for sparse-but-known voice fields).

**Convention:** Only **finalized** ASR results are persisted. Partials are ephemeral (live UI only).

### 2.3 Identity

**Decision:** `Visitor` (browser-scoped, anonymous-capable) is always created on widget load. `Lead` (a person with contact info) is created when identification succeeds. `Visitor.leadId` becomes non-null on upgrade.

**Identification order on widget load → bubble click:**
1. Cookie / localStorage lookup → linked Lead? → done.
2. `Leady.identify({email, name, ...})` already called by host site? → upgrade Visitor → Lead.
3. Otherwise, on conversation start, the **agent itself asks** for name/email naturally as part of the system prompt.

**Refusal handling:** opportunistic re-ask. Agent asks once; if the visitor refuses or types garbage, the conversation proceeds anonymous, and the agent is instructed to re-ask later when natural ("…and what email should I send the quote to?").

**Email validation:** format-validate only at capture. No MX check, no verification email.

**Lead dedup:** unique on `(agentId, email)` when email present, else `(agentId, phone)`.

**Per-agent identity policy:** `optional` (default) | `required_before_chat` | `identified_only`.

**Purpose:** Most widget conversations start anonymous (a marketing-site question). Forcing a pre-chat HTML form would defeat the entire reason inbound widgets win over contact forms. Asking inside the chat keeps the flow conversational and works identically for voice in v2. Visitor and Lead are different things; conflating them produces the classic "same person looks like 4 leads" problem.

**Rejected:** Identified-only (B) blocks marketing-site visitors. Pre-chat HTML form (the original instinct) is just a contact form with extra steps. Hardcoded first-turn identity gate (deterministic but uglier UX than prompt-driven).

---

## 3. Knowledge Base & Retrieval

### 3.1 Ingestion (v1)

**Decision:** Manual only. Many titled Markdown articles per agent. Customer can upload `.md` / `.txt` files. CRUD anytime from the dashboard.

**Schema (write side):**
- `KbArticle (id, agentId, title, contentMarkdown, source ['manual'|'upload'|...future], updatedAt)`
- `KbChunk (id, articleId, agentId, ord, text, embedding vector(1536), tokens)`

On article create/update: split on `##` headings, target ~500 tokens per chunk, embed each, replace article's chunks atomically.

**Purpose:** "Many articles" is how customers actually think (update the Returns Policy article, delete the old Pricing one). A single Markdown blob would force scrolling through one big doc; it also doesn't give retrieval a natural article-citation anchor. Upload covers the realistic case where the customer already has a 40-page policy in a `.md` or `.txt` file and would otherwise paste section by section.

**Rejected:** One big Markdown blob per agent (β-vs-α trade-off, picked β). Auto-crawl (premature for v1; needs sitemap + Defuddle + scheduling — defer). Connectors to Notion/Drive/etc. (each is its own auth flow; defer).

**Architectural slot for the future:** `KbArticle.source` is an enum so that v2 connectors (`notion`, `gdrive`, `web_crawl`, …) drop in without a migration.

### 3.2 Retrieval

**Decision:** **pgvector**, top-k=5, cosine similarity, on a single Postgres database. Embeddings via OpenAI `text-embedding-3-small` (1536 dim).

```sql
SELECT chunk.id, chunk.text, article.id AS article_id, article.title
FROM kb_chunk chunk
JOIN kb_article article ON article.id = chunk.article_id
WHERE chunk.agent_id = $1
ORDER BY chunk.embedding <=> $queryEmbedding
LIMIT 5;
```

The retrieval **query** is the user's last message embedded verbatim. No multi-turn rewrite, no LLM-rephrase pre-step in v1.

**Purpose:** Stuffing the full KB into context every turn was costed out: ~$0.96 per conversation vs. ~$0.05 with retrieval — a 20× difference, *plus* "lost in the middle" quality drops past ~30–50k tokens, *plus* voice TTFT explodes with input size. pgvector co-locates retrieval with the rest of the schema (one less moving piece, trivial per-agent isolation). OpenAI's embeddings API is pennies and a single network call (~50–150ms on the hot path).

**Rejected:** No retrieval / full-KB-in-context (the cost cliff above). Cloudflare Vectorize (locks self-hosters to Cloudflare; rejected categorically when we left Cloudflare). External vector DB (extra vendor, extra bill, extra dep). LLM query-rewrite (defer; v1.5 quality knob if retrieval feels off). Last-user+last-agent concat (sometimes hurts as much as helps).

**Citations are free:** every chunk has `articleId`, so the system prompt injects retrieved chunks alongside the parent article title, and the agent can cite "From: Returns Policy."

### 3.3 Hot-path latency budget (chat turn)

```
embed user msg          ~100ms   (OpenAI embeddings)
pgvector top-k=5        ~10ms    (with HNSW index on chunk.embedding)
prompt assembly         ~5ms
LLM streamText TTFT     200–600ms (provider-dependent)
─────────
visible token in browser within ~400–800ms of send
```

---

## 4. Agent Loop

### 4.1 Per-turn execution

```
1.  ws → ConversationActor.handleUserMessage(text)
2.  persist user Turn (Postgres)
3.  identity-policy check; enter capture mode if needed
4.  embed user msg
5.  pgvector retrieval (top-k=5, joined to parent article)
6.  assemble system prompt:
       [base persona]
     + [agent custom instructions overlay]
     + [identity-capture instructions if needed]
     + [retrieved chunks with article-citation hints]
     + [system tool schemas]
7.  AI SDK streamText({system, history=full, tools})
8.  stream tokens → custom-JSON WebSocket frames → widget
9.  on tool_call: pause stream → validate args → execute → inject result → resume
10. on stream end: persist agent Turn (text, tool calls, tool results, latency, tokens)
11. wait for next msg
```

### 4.2 Choices inside the loop

| Choice | v1 decision | Why |
|---|---|---|
| **History window** | Full history every turn | SMB conversations are short (median 5–15 turns); the cost is negligible at typical lengths. |
| **Context overflow** | FIFO drop oldest turns | Simple safety rail. No summarization, no fancy compaction in v1. |
| **Embedding** | Synchronous every turn | Simple, correct, cheap, debuggable. ~100ms is acceptable. |
| **Retrieval query** | User's last message, verbatim | LLM-rewrite is a v1.5 knob. |
| **Conversation summary** | Deterministic LLM call after `end_conversation` | Don't trust the model to remember to call `set_conversation_summary`. One extra call per conversation, populates inbox card reliably. |
| **Idle timeout** | 5-min reconnect grace on WS close + 30-min hard idle cap | Both fire `end_conversation` + summarization. |
| **Wire protocol** | Custom JSON envelope `{type, payload}` | Decouples widget from AI SDK + LLM provider. Same envelope absorbs voice frame types in v2. |
| **Max turns** | Per-agent setting, default 50 | Hard cap to bound runaway costs. |

### 4.3 System tools (v1)

The `Tool` table has a `scope` enum (`system` | `customer`). v1 only uses `system`. Customer-defined tools (HTTP/OpenAPI/MCP) deferred (see §6.1).

| Tool | Purpose |
|---|---|
| `capture_contact(name?, email?, phone?)` | Creates/updates Lead, links Visitor → Lead. Format-validates email. |
| `request_handoff(reason, urgency)` | Sets `Conversation.mode = 'paused'`, raises in-dashboard real-time event. (No email in v1 — see §5.4.) |
| `set_conversation_summary(summary, sentiment, tags[])` | Populates inbox card. Called deterministically by the actor post-`end_conversation`, not by the model. Tool exists so the schema is consistent. |
| `end_conversation(resolution)` | Closes the WS, evicts the actor, fires summarization. |

**Purpose:** Without tools, the agent is read-only against the KB and can't drive structured outcomes (capture leads, escalate, summarize). With customer-defined tools, you ship a 3-month integration platform. Four built-in tools are the minimum that makes the agent a *product*, not a chatbot demo.

---

## 5. Runtime & Infrastructure

### 5.1 Why we ditched Cloudflare entirely (and when we changed our minds)

Originally locked: Cloudflare Workers + Hono + Durable Objects + R2 + Prisma-Accelerate. Mid-grilling, the stance reversed: **self-host on a VPS, no Cloudflare anywhere.**

**Reasons for the reversal:**
1. **OSS distribution story.** "git clone, docker compose up, point at a Postgres" is a clean self-host pitch. "Sign up for Cloudflare, configure Wrangler, provision Workers + DOs + R2 + Vectorize" is friction that kills OSS adoption.
2. **Vendor lock-in.** Durable Objects, R2 SDK bindings, Vectorize, Workers KV — every Cloudflare primitive we used would have been load-bearing. Self-hosters either replicate Cloudflare's stack or fork the project. Both are bad.
3. **Runtime constraints.** Workers' 30s CPU limit and lack of long-lived state forced Durable Objects for what is, on a normal server, just an in-process `Map`. The simpler topology was being avoided only because Workers couldn't host it.
4. **Production debugging.** A long-lived stateful Bun process with a debugger attached is a more familiar target than a DO with edge-distributed state.
5. **Cost and scale realism.** A $20 VPS handling hundreds of concurrent SMB conversations is fine. Edge distribution wasn't earning its keep.

**What we kept from the original Cloudflare-era plan because it was orthogonal:** Hono, Prisma, Postgres, Better Auth, AI SDK, the entire domain model. None of those care about runtime.

**What R2 *survives as*:** a possible **S3-compatible** target for the hosted instance. Our code talks `@aws-sdk/client-s3` against an env-configured endpoint. The hosted instance can point at R2's S3 API; nothing in our code knows it's R2. Self-hosters point at MinIO or whatever they prefer.

### 5.2 Runtime

**Decision:** **Hono on Bun.** Single binary, deployed to a VPS. Self-hosters use docker-compose.

**Purpose:** Hono is already in the codebase with `@hono/zod-openapi` for typed routes. Bun is already the package manager. Bun's native WebSocket is genuinely good and is exactly what we need for long-lived stateful conversation connections. Single binary + Postgres + S3-compatible blob store is a 3-line docker-compose.

**Migration from the Cloudflare scaffold:**
- Drop `runtime = "cloudflare"` from `prisma/schema.prisma`.
- Drop `@prisma/extension-accelerate`.
- Drop `wrangler.jsonc`, `.dev.vars` (replace with `.env`).
- Replace entry from `wrangler dev` to `bun --hot src/index.ts` using `Bun.serve` + Hono adapter.
- API routes themselves are unchanged.

**Rejected:** Hono on Node (slightly slower; Bun is fine for VPS deploy). Switching frameworks (Hono already works).

### 5.3 Stateful primitive (DO replacement)

**Decision:** In-process `Map<conversationId, ConversationActor>` on a single Bun process. Idle actors evict after N minutes; rehydrate from Postgres on reconnect.

```ts
class ConversationActor {
  ws: ServerWebSocket | null = null;
  history: Turn[] = [];
  pendingTurn: TurnBuilder | null = null;
  async handleUserMessage(text: string) { /* loop in §4.1 */ }
  async handleReconnect(ws: ServerWebSocket) { /* re-bind */ }
  async persist() { /* flush finalized turns */ }
  async hibernate() { /* serialize to Postgres, clear from Map */ }
}
const actors = new Map<string, ConversationActor>();
```

**Purpose:** A single VPS comfortably holds hundreds of concurrent SMB conversations as in-memory actors with the lowest possible latency (no network hop per audio frame in v2 voice). Multi-server scale-out is a layered addition (sticky-routing by `conversationId` via Redis pub/sub or LB stickiness), not a rewrite.

**Rejected:** Redis-from-day-one (premature for SMB scale; Redis as a hard dep hurts the OSS story). Stateless re-hydrate-per-turn (rehydrating per audio frame would kill voice latency in v2).

### 5.4 Blob storage

**Decision:** **S3-compatible**, accessed via `@aws-sdk/client-s3`. Endpoint configurable via env vars (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`).

Hosted instance: Cloudflare R2 (using its S3 API only — no Workers tie-in). Self-host: MinIO recipe in docker-compose.

v1 uses blob storage for KB file uploads (`.md`/`.txt`) only. Voice audio storage is wired but unused until v2.

### 5.5 LLM provider layer

**Decision:** **Vercel AI SDK** as the abstraction.

- **Tested + supported tier in v1:** OpenAI + Anthropic. Tool calls verified. Default model: `gpt-4o-mini`.
- **Best-effort tier:** every other AI SDK provider (Google, Mistral, Groq, OpenRouter, Ollama, …). Exposed in the UI; documented as "works via AI SDK, may have provider-specific quirks." Self-hosters pointing at Ollama/local is encouraged via env config.

**BYOK granularity:** per-org default key with per-agent override. Per-org covers solo SMBs (one key for everything); per-agent override covers small agencies running multiple clients.

**BYOK + pricing:** see §7.2. BYOK is *not* a hosted-customer cost-saver — they still pay seats + upfront. BYOK is a **marketing/positioning tool** for self-hosters and an OSS feature.

**Rejected:** A homegrown provider abstraction (AI SDK already does it well). Single-provider v1 (the abstraction is only honest with ≥2 implementations).

### 5.6 BYOK credential storage

**Decision:** Encrypted in Postgres with a per-org KEK, AES-256-GCM. Decrypted in the Bun process at LLM-call time. Same scheme for self-hosters (documented in OSS docs).

**Rejected:** Cloudflare Secrets / Workers KV (gone with the runtime). External secret manager (overkill for SMBs).

### 5.7 Background work

**v1 implied async jobs:**
1. Re-embedding on KB article save.
2. Conversation summarization on `end_conversation` / idle timeout.
3. Idle-actor eviction sweep.

**Decision:** v1 runs these as in-process workers (background promises + `setInterval` sweepers) on the same Bun process. No external queue.

**Purpose:** A single VPS process at SMB scale doesn't justify BullMQ + Redis. When usage demands it (concurrent KB re-indexing across thousands of articles, etc.), formalize into a queue then.

---

## 6. Deferred (architecture-shaped to absorb)

### 6.1 Customer-defined tools (v2)

**Architecture in v1:** `Tool.scope` enum already supports `customer`. v2 adds rows of that scope.

**Planned shape (when built):** Form-defined HTTP tools (name, description, method, URL template with `{{param}}`, headers, params with JSON Schema, response mapping). 2–3 template integrations (Shopify, Cal.com) implemented as wrappers over the same custom-HTTP tool primitive. MCP transport layered later as `Tool.transport = 'mcp'`.

**Rejected for v1:** Pre-built integration catalog only (covers ~30%, costs months); custom-HTTP-only with no templates (hostile to non-technical SMBs); MCP-first (most SMB backends don't run MCP servers yet).

### 6.2 Voice (v2)

**Architecture in v1:** `Conversation.channel` enum, voice-nullable columns on `Turn`, BlobStore wired, custom-JSON wire envelope absorbs voice frames. v1 simply never emits `channel = 'voice'`. The widget design includes the call CTA in the visual plan but doesn't render it in v1.

**Out of v1 scope:** WebRTC / SDP exchange / TURN, streaming ASR pipeline, streaming TTS, barge-in / VAD / endpointing, voice-specific error states, NAT traversal.

**Rejected for v1:** Shipping voice in parallel with chat (5-month timeline risk vs. 2-month chat-only; barge-in alone is a multi-week problem).

### 6.3 Auto-crawl & connectors (v2+)

`KbArticle.source` enum already supports the future shapes. v1 has only `manual` and `upload` rows.

### 6.4 Multi-server scale-out

The `ConversationActor` abstraction does not change. Sticky-routing by `conversationId` (LB stickiness or Redis pub/sub) is a layered addition.

### 6.5 Email & richer notifications

No email in v1 at all. Handoff notifications are **in-dashboard real-time only** — when the customer isn't logged into the dashboard, handoffs queue up and surface on next visit. **Trade-off accepted:** customers who don't keep the dashboard tab open during business hours may miss handoff requests. Email/Slack/push is a v1.5 feature.

---

## 7. Dashboard, Widget, Pricing, License

### 7.1 Dashboard sections (v1)

1. Onboarding (4-step wizard: name agent → persona/greeting → first KB article (skippable) → copy install snippet).
2. Agents list / Agent home.
3. Agent → Knowledge Base (Markdown CRUD + `.md`/`.txt` upload; re-embed on save).
4. Agent → Persona/Settings (see field list below).
5. Agent → Tools (read-only catalog of system tools; v2 customer tools stub).
6. Agent → Install (copy script tag, sandbox preview).
7. **Inbox — live, with human reply.** Real-time transcript view; "take over" pauses the LLM; "release" resumes it. Visitor never sees that a human took over (same avatar, same name, same typing animation). Audit log records human turns separately.
8. Leads (dedup'd list, contact info, custom fields, related conversations).
9. Analytics (basic counts: conversations, leads captured, handoffs, avg turns, top KB articles cited; basic time series).
10. Org Settings (members, BYOK API keys, billing).
11. Account / Profile.

**Per-agent settings v1 fields:** name, greeting message, accent color, identity policy, default LLM provider+model, custom system prompt overlay, max turns per conversation (default 50), fallback message when retrieval is empty.

**Purpose:** Cutting any of these 11 sections creates a UX hole big enough that demos fall apart. Live human reply is not "extra" — without it, the inbox is just a log file with a UI, and `request_handoff` has no resolution path.

### 7.2 Widget

**Decision:** Iframe-based, single `<script>` install.

- **Loader:** ~5KB vanilla JS. Injects a small DOM bubble. Lazy-loads the iframe on first bubble click. Exposes `window.Leady = { identify, open, close, on, ... }`. Loader-iframe communication via `postMessage`.
- **Iframe doc:** hosted at `https://widget.leady.example/embed?agentId=…`. Vite app in `apps/widget/` (third app in the monorepo alongside `apps/api/` and `apps/web/`). Built and deployed to a CDN/static host independently.
- **Config:** server-fetched on iframe load (`GET /api/widget/config?agentId=…`). Customer dashboard edits are live for the next visitor — no customer-side redeploy.
- **WebSocket:** iframe ↔ API, custom JSON envelope (`{type: 'token'|'tool_call'|'turn_end'|'typing'|'handoff_state'|...}`).

**Purpose:** Iframe gives total CSS isolation — your customers will install on Wordpress / Webflow / Shopify / bespoke CSS messes, and without an iframe wall you spend the rest of your life debugging "the chat button is purple on this customer's site." Lazy-loading the iframe means visitors who never click pay only the loader cost. Server-fetched config means the customer's dashboard is the source of truth, not a frozen `data-*` attribute.

**Rejected:** Direct DOM injection (CSS leaks both ways). Web Components / shadow DOM (still has CSS-piercing edge cases; harder to debug; the boring iframe choice wins for v1).

### 7.3 Hosted vs. self-host

**Decision:** **Identical feature set in v1.** No gating between hosted and self-host.

**Purpose:** Feature gating is a v2+ concern when there are paying customers. Pre-revenue gating is premature optimization that hurts the OSS adoption story.

### 7.4 Pricing (hosted)

**Decision:** Three levers, applied together:
1. **Upfront onboarding fee.**
2. **Monthly per-seat subscription.**
3. **Usage-based overage** above an included quota (conversations or messages — exact unit TBD when first 10 customers exist).

**BYOK:** customers who bring their own LLM keys still pay seats + upfront. Their LLM token cost is theirs. **BYOK is a marketing/positioning advantage for self-hosters and OSS users, not a hosted discount.**

**Rejected:** Per-conversation pricing alone (unpredictable for buyers). Free during beta only (works as an interim, but the doc captures the intended model). Tiered SaaS without usage component (caps growth revenue).

### 7.5 License

**Decision:** **Apache-2.0.**

**Purpose:** Permissive (true OSS — anyone can host a competing version). Includes an explicit patent grant, which matters in AI infra where patent trolls exist. The user said "MIT/Apache" — Apache-2.0 is the safer of the two under that umbrella.

**Rejected:** MIT (no patent grant). AGPL (forces hosted forks to share changes — viable but contradicts "no feature gating, identical hosted/self-host" because the moat would have to come from license terms). BSL/SSPL (source-available, not OSS — contradicts the "open source" positioning).

---

## 8. Stack Summary

| Layer | Choice |
|---|---|
| Runtime | Bun + Hono |
| API typing | `@hono/zod-openapi` (already wired) |
| DB | Postgres + pgvector |
| ORM | Prisma (without `runtime = "cloudflare"`, without Accelerate) |
| Auth | Better Auth (already wired) |
| LLM abstraction | Vercel AI SDK |
| Embeddings | OpenAI `text-embedding-3-small` (1536 dim) |
| Default chat model | `gpt-4o-mini` |
| Stateful primitive | In-process `Map<conversationId, ConversationActor>` |
| Wire protocol | WebSocket, custom JSON envelope |
| Blob storage | S3-compatible (`@aws-sdk/client-s3`); R2 (hosted) / MinIO (self-host) |
| Background work | In-process workers, `setInterval` sweepers |
| Web dashboard | Vite + React 19 + TanStack Router (already in `apps/web/`) |
| Widget app | Vite, new `apps/widget/`, CDN-deployed |
| Loader script | Vanilla JS, <5KB gzipped |
| Native | Expo (`apps/native/`, kept; not v1-scoped) |
| Deploy (hosted) | Single Bun container on a VPS, Postgres + S3 alongside |
| Deploy (self-host) | docker-compose: api + Postgres + MinIO |
| License | Apache-2.0 |

---

## 9. v1 Build Order (recommended)

A phased order that respects dependencies and produces a demo-able artifact at each milestone.

1. **Migrate runtime off Cloudflare.** Drop Wrangler/Workers/Accelerate; stand up Bun-Hono with the existing Better Auth + Prisma schema running.
2. **Domain schema.** Org, User, Agent, Visitor, Lead, Conversation, Turn, KbArticle, KbChunk, Tool. Migrations applied via `prisma migrate deploy` on container start.
3. **Agent CRUD + dashboard skeleton.** TanStack Router shell, sign-up → org → agent flow, agents list, persona/settings page.
4. **KB editor + retrieval.** Article CRUD, `.md`/`.txt` upload, chunk-on-write, embedding via OpenAI, pgvector index, retrieval query.
5. **ConversationActor + chat agent loop.** WebSocket route, in-process `Map`, agent loop per §4.1, AI SDK `streamText`, system tools, custom JSON wire envelope.
6. **Widget app + loader.** `apps/widget/`, iframe doc, vanilla loader, `Leady.identify()`, config endpoint, install snippet in dashboard.
7. **Inbox (live, with human reply).** Org-scoped WebSocket subscription, transcript view, take-over/release, paused-mode handling, in-dashboard handoff bell.
8. **Leads + analytics.** Lead list, dedup, basic counts, simple time series.
9. **BYOK + provider expansion.** Per-org/per-agent key storage, AES-256-GCM, AI SDK provider switch.
10. **Polish + onboarding wizard + sandbox preview.** Final pass before public release.

---

## 10. Open Questions Explicitly Deferred

These were raised, intentionally not resolved in v1, and listed here so they don't get lost:

- Email / Slack / push notification provider (v1.5 — surfaces when handoffs need to reach customers off-dashboard).
- Background jobs framework (BullMQ / Redis) — only when in-process workers stop being enough.
- Pricing units (conversations vs. messages) and exact tier numbers — set after first 10 customers.
- Multi-server topology (Redis pub/sub or LB sticky-routing for `conversationId`) — only when one VPS isn't enough.
- KB gap detection (surface unanswered visitor questions to customer) — highest-value v1.5 analytics feature.
- LLM-rewrite of retrieval queries — v1.5 quality knob if retrieval feels off.
- Auto-crawl, connectors (Notion, Drive, Confluence, Zendesk) — v2+.
- Customer-defined tools (HTTP, OpenAPI import, MCP transport) — v2.
- Voice (WebRTC, ASR, TTS, barge-in, NAT traversal) — v2.
- Mid-market features (RBAC beyond owner/member, SSO, audit log UI) — when first mid-market customer demands them.
