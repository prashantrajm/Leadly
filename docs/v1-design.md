# Leadly — v1 Design Document

> Output of the `/grill-me` session. Every decision below is paired with the **purpose** it serves and the **alternatives rejected**, so future-you can re-open any branch with full context. Decisions marked **(deferred)** are explicitly out of v1 scope but the architecture is shaped to absorb them without rewrite.

---

## 1. Product

### 1.1 Wedge

**Decision:** Inbound AI support, channel-agnostic. End-user picks chat or voice from the same widget; both hit the same agent, KB, and tool-call infrastructure. Open-source, SMB-targeted.

**Purpose:** One agent, two transports. The agent's behaviour (system prompt + KB retrieval + tool calls + transcript) is identical regardless of channel. This positions Leadly as "OSS AI support that works on the channel the visitor wants," not as another single-channel chatbot.

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
2. `Leadly.identify({email, name, ...})` already called by host site? → upgrade Visitor → Lead.
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
| `request_handoff(reason, urgency)` | Sets `Conversation.mode = 'paused'`, raises in-dashboard real-time event. (No email in v1 — see §6.5.) |
| `set_conversation_summary(summary, sentiment, tags[])` | Populates inbox card. Called deterministically by the actor post-`end_conversation`, not by the model. Tool exists so the schema is consistent. |
| `end_conversation(resolution)` | Closes the WS, evicts the actor, fires summarization. |

**Purpose:** Without tools, the agent is read-only against the KB and can't drive structured outcomes (capture leads, escalate, summarize). With customer-defined tools, you ship a 3-month integration platform. Four built-in tools are the minimum that makes the agent a *product*, not a chatbot demo.

---

## 5. Runtime & Infrastructure

### 5.1 Cloudflare-only — committed

**Decision:** Leadly runs on **Cloudflare**, end-to-end. Workers, Durable Objects, R2, KV, Workflows, and Cron Triggers, with **Prisma Accelerate** in front of Postgres for connection pooling. Self-hosters use Cloudflare too — there is no second runtime, no portability layer, no abstraction over Cloudflare primitives.

**Why we committed instead of staying portable:**

1. **The economics are absurd.** Cloudflare's free tier covers 100k Worker requests/day, 1M Durable Object invocations/month, 10 GB R2, 100k KV reads/day, 1k DO storage requests/day. Workers Paid is **$5/month** and effectively removes those caps for SMB-scale usage. A portable VPS-deployed equivalent (server + managed Postgres + S3-compatible blob + Redis for pub/sub) is realistically $40–100/month at the same load. Five dollars beats forty.
2. **DO Hibernation makes idle WebSockets free.** A `Conversation` DO with an open WebSocket but no traffic costs nothing — no compute, no memory billing while hibernating. For a chat product where most conversations have long quiet stretches between turns, this is the correct economic model. No VPS does this.
3. **Workers + DO + R2 is one bill, one auth, one config.** Operational simplicity is real; portability that we'd have to maintain on every release is real overhead.
4. **The v1.5 voice work depends on long-lived stateful WebSockets.** DOs with Hibernation are *built for* this exact pattern. Replicating it on a VPS means picking a stateful actor framework or rolling our own.
5. **Self-host on Cloudflare is a clean install path.** "Create a Cloudflare account, install wrangler, set env vars, `wrangler deploy`" is no harder than "install Docker, configure Postgres, configure MinIO, set up reverse proxy, configure TLS." The friction we feared earlier was overstated; the tooling story is good.

**Trade-off we accept:** Self-hosters who want to avoid Cloudflare cannot run Leadly. We've decided that's fine — the OSS audience that *does* want to run it can use Cloudflare's free tier at zero cost up to meaningful scale, and the audience that won't touch Cloudflare isn't large enough to design for.

**What this restores from earlier turns of the design process:** every Cloudflare primitive we previously walked away from. The relevant code in `apps/api/` was never actually migrated off Cloudflare — `runtime = "cloudflare"` is still in the Prisma schema, `wrangler.jsonc` exists, the R2 binding is wired in `src/index.ts`. The earlier reversal was on paper only; this section just realigns the doc with the code.

### 5.2 Runtime

**Decision:** **Hono on Cloudflare Workers.** Already wired in `apps/api/` with `@hono/zod-openapi` for typed routes.

**Compatibility flags:** `nodejs_compat` (already set in `wrangler.jsonc`) for libraries that need a small Node API surface (Better Auth, Prisma client glue).

**Local dev:** `wrangler dev` (already wired as `bun dev:api`).

**Deploy:** `wrangler deploy` (already wired as `bun build:api`).

**Rejected:** Bun on a VPS (loses DO Hibernation, costs more, fights the rest of the Cloudflare stack). Workers + a separate long-lived service (two deploys, no longer Cloudflare-native).

### 5.3 Stateful primitive — Durable Objects

**Decision:** One **Durable Object per `Conversation`**, addressed by `conversationId`. Uses the **WebSocket Hibernation API** so idle conversations cost nothing. DO storage holds the live history buffer; finalized turns are flushed to Postgres at turn boundaries.

```ts
// Sketch — actual class lives in apps/api/src/durable/conversation.ts
export class ConversationDO implements DurableObject {
  constructor(
    private state: DurableObjectState,
    private env: Env,
  ) {
    this.state.setHibernatableWebSocketEventTimeout(/* ms */);
  }

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      this.state.acceptWebSocket(pair[1]); // hibernation-friendly
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    // ...
  }

  async webSocketMessage(ws: WebSocket, msg: ArrayBuffer | string) {
    // user turn → embed → retrieve → AI SDK streamText → tool calls →
    // stream tokens back over ws → persist finalized Turn rows
  }

  async webSocketClose() { /* mark conversation as disconnected, set alarm */ }
  async alarm() { /* fire end_conversation + summarization on idle timeout */ }
}
```

**Idle / timeout mechanics:**
- **5-min reconnect grace** on `webSocketClose` — set a DO alarm 5 min out; reconnect cancels it.
- **30-min hard idle cap** — second alarm fires `end_conversation` + summarization regardless.
- **Hibernation** evicts the DO from memory between events; rehydrates on the next message. Cost during the wait: zero.

**Per-conversation cost:** one DO instance per active conversation. Cloudflare's DO pricing is per-request and per-stored-byte, not per-instance, so an org with 10k concurrent conversations doesn't get billed for instance-count.

**Geographic placement:** DOs are pinned to a region near their first caller. For SMB customers serving regional traffic this is fine. Multi-region replication is a v2+ concern.

**Rejected:** In-process `Map` on a long-lived server (can't run on Workers; loses Hibernation). Stateless re-hydrate from Postgres per turn (rehydrating per audio frame in v2 voice would blow the latency budget). Workers KV for session state (eventually-consistent — wrong tool; reads of a key right after a write can return stale data, causing split-brain on reconnects).

### 5.4 Database — Postgres + pgvector + Prisma Accelerate

**Decision:** A managed **Postgres** instance (Neon / Supabase / Railway — choice is the operator's, not Leadly's) with the **pgvector** extension. Workers reach Postgres through **Prisma Accelerate**, which handles connection pooling and edge-side query caching. This is the same pattern used in the existing `apps/api/` scaffold and on prior Cloudflare projects.

**Why Postgres + Accelerate instead of D1 or Vectorize:**
- **D1** is SQLite-on-edge. Wrong shape for our workload — no vector extension, weaker for transactional joins across the schema.
- **Vectorize** would split the KB across two stores (vectors in Vectorize, KB metadata in Postgres) and require dual-write logic. pgvector keeps retrieval as a single SQL join with `WHERE agentId = ?` — trivial isolation, trivial filtering.
- **Accelerate** solves the Workers-can't-pool-TCP problem the way Prisma's Cloudflare path is documented to. From the Worker's perspective, it's a single HTTP-backed client; from Postgres's perspective, it's a small number of pooled connections regardless of how many Worker invocations are in flight. Battle-tested on prior projects.

**Prisma:** `runtime = "cloudflare"` and `@prisma/extension-accelerate` are already wired in `apps/api/`. `lib/prisma.ts` builds the client with `withAccelerate()` from the env-supplied `DATABASE_URL` (the Accelerate connection string).

**Hyperdrive (rejected for v1):** Cloudflare's native answer to the same problem. Functionally equivalent here. We're sticking with Accelerate because it's already in the repo and proven on past projects — switching would cost engineering time for no v1-relevant benefit. Hyperdrive remains a deferred swap if Accelerate's pricing or behavior becomes a problem.

### 5.5 Blob storage — R2

**Decision:** **R2** with the native Workers binding (`env.MEDIA_BUCKET.put(...)`), not the S3 SDK. Already declared in `wrangler.jsonc` and used in `apps/api/src/index.ts`.

**Why the binding instead of the S3 SDK:** R2 charges $0 for egress out of Cloudflare's network and the binding bypasses HTTP signing entirely — direct calls from Worker to R2 inside Cloudflare's network. Faster, simpler, and free on the egress that would otherwise be the line item that hurts.

v1 uses R2 for KB file uploads (`.md`/`.txt`). v2 voice will store audio recordings here.

**Pre-signed URL flow** for the dashboard's KB upload UI: Worker generates a pre-signed PUT URL using the R2 binding's signing helper; the dashboard PUTs the file directly to R2; on completion the dashboard calls back to the API to register the article and kick off chunking + embedding (see §5.7).

### 5.6 Cache & ephemeral state — Workers KV

**Decision:** **Workers KV** for caches that tolerate eventual consistency. Specifically:
- **Widget config** — `GET /api/widget/config?agentId=…` is hit on every iframe load. Cached in KV with a short TTL (60s); invalidated on agent settings save.
- **Org → keyed-rate-limit counters** for inbound visitor abuse limiting (token bucket per visitor IP per agent, 30 messages/min default).

**Not for:** conversation state, lead data, anything that needs strong consistency. KV's eventual-consistency model would cause split-brain on reconnects and incorrect lead dedup. Those live in Postgres; live conversation state lives in the DO.

### 5.7 Background work — Workflows & Cron

**Decision:**
- **Cloudflare Workflows** for durable, multi-step async jobs that benefit from automatic retries and persistence:
  - **KB re-embedding** when an article is created or updated. Steps: load article → split on `##` headings → call OpenAI embeddings for each chunk → atomic replace of `KbChunk` rows. Workflows handle retries and partial failure.
  - **Post-`end_conversation` summarization** — fires a deterministic LLM summarization call, writes `Conversation.summary / sentiment / tags`. Step-based so a transient LLM error doesn't lose the summarization.
- **Cron Triggers** for periodic sweeps:
  - Idle-conversation reaper backstop (in case a DO alarm misfires).
  - Daily analytics rollup job for the dashboard's basic counts.
- **Queues** — not used in v1. Reserved for fan-out work that emerges later (e.g., webhooks to external systems when customer-defined tools land in v2).

**No setIntervals, no in-process workers, no Redis.** Cloudflare's primitives cover the surface.

### 5.8 BYOK credential storage

**Decision:** LLM provider keys are encrypted with **AES-256-GCM** using a per-org KEK and stored in **Postgres** alongside the org's other settings. The KEK itself is wrapped by an env-configured root key (`SECRETS_ENCRYPTION_KEY` set via `wrangler secret put`).

**Rejected:** Workers KV (eventual consistency on a credential is wrong). Cloudflare Secrets Store directly per-key (no per-org isolation; doesn't scale to thousands of orgs). External secret manager (overkill for SMBs).

### 5.9 LLM provider layer

**Decision:** **Vercel AI SDK** as the abstraction. Runtime-agnostic — works fine on Workers.

- **Tested + supported tier in v1:** OpenAI + Anthropic. Tool calls verified. Default model: `gpt-4o-mini`.
- **Best-effort tier:** every other AI SDK provider (Google, Mistral, Groq, OpenRouter, …). Exposed in the dashboard; documented as "works via AI SDK, may have provider-specific quirks."
- **Local models (Ollama / LM Studio):** dropped from v1 surface. The Cloudflare-only commitment means Workers can't reach a developer's local box, so this would only work for self-hosters running Workers + reachable local models — too narrow a slice to build UI for. Documented as "available via env override on self-host" only.

**BYOK granularity:** per-org default key with per-agent override. Per-org covers solo SMBs; per-agent override covers small agencies.

**BYOK + pricing:** see §7.2. BYOK doesn't change the platform fee; the customer just pays their LLM provider directly for tokens.

**Rejected:** A homegrown provider abstraction (AI SDK already does it well). Single-provider v1 (the abstraction is only honest with ≥2 implementations).

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

### 6.4 Multi-region scale-out

Not a v1 concern. Durable Objects are pinned to a region near their first caller; Cloudflare handles routing globally. If a customer demands data residency or active-active replication, that's a v2+ Enterprise-tier feature using DO-to-DO replication or Smart Placement.

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

- **Loader:** ~5KB vanilla JS. Injects a small DOM bubble. Lazy-loads the iframe on first bubble click. Exposes `window.Leadly = { identify, open, close, on, ... }`. Loader-iframe communication via `postMessage`.
- **Iframe doc:** hosted at `https://widget.leadly.example/embed?agentId=…`. Vite app in `apps/widget/` (third app in the monorepo alongside `apps/api/` and `apps/web/`). Built and deployed to a CDN/static host independently.
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
| Runtime | Cloudflare Workers + Hono |
| API typing | `@hono/zod-openapi` (already wired) |
| DB | Managed Postgres + pgvector |
| ORM | Prisma with `runtime = "cloudflare"` + `@prisma/extension-accelerate` |
| Stateful primitive | Durable Object per `Conversation` with WebSocket Hibernation |
| Cache | Workers KV (widget config, rate-limit counters) |
| Async / scheduled | Cloudflare Workflows + Cron Triggers |
| Blob storage | R2 with native Workers binding |
| Auth | Better Auth (already wired) |
| LLM abstraction | Vercel AI SDK |
| Embeddings | OpenAI `text-embedding-3-small` (1536 dim) |
| Default chat model | `gpt-4o-mini` |
| Wire protocol | WebSocket terminating in DO, custom JSON envelope |
| Web dashboard | Vite + React 19 + TanStack Router (already in `apps/web/`) |
| Widget app | Vite, new `apps/widget/`, deployed to Cloudflare Pages |
| Loader script | Vanilla JS, <5KB gzipped |
| Native | Expo (`apps/native/`, kept; not v1-scoped) |
| Deploy (hosted) | `wrangler deploy` to Cloudflare; managed Postgres of your choice |
| Deploy (self-host) | Same — Cloudflare account + managed Postgres |
| License | Apache-2.0 |

---

## 9. v1 Build Order (recommended)

A phased order that respects dependencies and produces a demo-able artifact at each milestone.

1. **Wire Postgres.** Provision managed Postgres with pgvector enabled. Set `DATABASE_URL` to a Prisma Accelerate connection string via `wrangler secret put DATABASE_URL`. The Prisma + Accelerate setup in `apps/api/` is already correctly wired.
2. **Domain schema.** Org, User, Agent, Visitor, Lead, Conversation, Turn, KbArticle, KbChunk, Tool. Migrate with `prisma migrate deploy` against the managed instance.
3. **Agent CRUD + dashboard skeleton.** TanStack Router shell, sign-up → org → agent flow, agents list, persona/settings page.
4. **KB editor + retrieval.** Article CRUD, `.md`/`.txt` upload via R2 pre-signed URL, chunk-on-write, embedding via OpenAI in a Workflow, pgvector index, retrieval query.
5. **`ConversationDO` + chat agent loop.** Durable Object class with WebSocket Hibernation, agent loop per §4.1, AI SDK `streamText`, system tools, custom JSON wire envelope.
6. **Widget app + loader.** `apps/widget/`, iframe doc, vanilla loader, `Leadly.identify()`, config endpoint cached in KV, install snippet in dashboard.
7. **Inbox (live, with human reply).** Dashboard subscribes to org-scoped DO events, transcript view, take-over/release, paused-mode handling, in-dashboard handoff bell.
8. **Leads + analytics.** Lead list, dedup, basic counts via daily Cron rollup, simple time series.
9. **BYOK + provider expansion.** Per-org/per-agent key storage encrypted with AES-256-GCM, AI SDK provider switch.
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
