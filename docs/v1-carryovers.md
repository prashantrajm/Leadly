# v1 carryovers

Things that work well enough to ship v1 but should be revisited before scale or
GA. Each entry has the **what**, the **why it's deferred**, and the **fix
shape** so future-you (or future-someone-else) can pick it up without re-doing
the analysis.

When you fix one, delete the entry. This file shrinks over time.

---

## 1. Inbox transcript uses REST polling, not WebSocket observer

**Status as of v1 launch:** the dashboard inbox at
`/dashboard/agents/$agentId/inbox/$conversationId` polls
`GET /api/conversations/:id` every 4 seconds via TanStack Query's
`refetchInterval`. The list view at `/inbox/` polls every 10 seconds. The
take-over and human-message flows go through the existing REST routes
(`POST /:id/take-over`, `POST /:id/human-message`).

**What was supposed to happen:** the dashboard connects to the same
`ConversationDO` WebSocket as the widget, with `?role=observer` and a
short-lived JWT, and receives the same `agent_token`, `agent_turn_end`,
`tool_call`, `mode_change` frames the visitor sees. Live token-by-token
streaming, no polling, every dashboard tab in sync.

**Why deferred:** the API side is half-built. The protocol exists in
`packages/wire` (`ObserverHelloFrame`, `ObserverTakeOverFrame`,
`ObserverReleaseFrame`, `ObserverHumanMsgFrame`), and `ConversationDO`
already accepts `role=observer` upgrades and routes the inbound frames. But
the **observer token isn't real yet** — the take-over route mints
`stub-${conversationId}` instead of a signed JWT. See
`apps/api/src/routes/conversations.ts` around line 179:

```ts
// Observer token minting belongs to Phase 10 (widget/observer JWT
// signing). For Phase 8 we just return a deterministic placeholder…
return c.json({ observerToken: `stub-${id}` }, 200);
```

The DO accepts the stub in dev because it doesn't verify it; in production
this would be a security hole. So the dashboard never actually got wired to
the WS — REST polling was the safe stand-in.

**Fix shape (backend, ~half a day):**

1. Add a real signing path for observer tokens. The widget-token signer in
   `apps/api/src/lib/widget-token.ts` is the right template — same
   `BETTER_AUTH_SECRET`, same JWT shape, just bound to
   `(conversationId, userId, organizationId)` instead of
   `(visitorId, agentId)`.
2. Update `POST /api/conversations/:id/take-over` and add a sibling
   `POST /api/conversations/:id/observe` (read-only — no take-over) so the
   dashboard can subscribe without flipping `mode = paused`.
3. Verify the observer token in `ConversationDO.fetch()` — replace the
   `attachment.role === "observer"` accept-everything branch with a real
   `verifyObserverToken()` call that mirrors `verifyWidgetToken`.

**Fix shape (frontend, ~1–2 hours):**

1. Generalise `apps/web/src/hooks/use-playground-conversation.ts` into
   `useConversationStream({ conversationId, role })`. Most of the body
   already handles `agent_token` / `agent_turn_end` correctly.
2. In `routes/dashboard/agents/$agentId/inbox/$conversationId.tsx`, replace
   the `useQuery({ refetchInterval: 4_000 })` with the new hook. Initial
   transcript still loads via REST (so refresh works), but new turns arrive
   via WS.
3. Take-over and Release stop being REST-only — send the
   `observer_take_over` / `observer_release` frames over the open socket
   instead. The REST routes can stay as a fallback for tabs that haven't
   opened a WS yet.
4. The list view (`inbox/index.tsx`) can keep its 10s background poll —
   knowing about *every* conversation in real time isn't worth a long-lived
   socket per tab.

**Why it's safe to defer:** REST polling at 4 seconds is fine for human
operators reading transcripts. The visible cost is "the agent's reply
appears whole instead of streaming" — a UX regression, not a correctness
bug. The widget itself still streams properly because that path uses real
visitor JWTs; only the dashboard is degraded.

**Triggers for prioritising:** first paying customer with a multi-operator
team, or any contract that mentions live takeover SLA.

---

## 2. Vite build chunk size warning (>500 KB)

**Status:** `bun run --filter=web build` succeeds but Rollup warns:

```
(!) Some chunks are larger than 500 kB after minification.
dist/assets/index-XXXXX.js   516.28 kB │ gzip: 163.48 kB
```

This is the main app entry. The 516 KB / 163 KB gzipped is the whole
TanStack Router + Query + react-hook-form + recharts + react-markdown +
shadcn surface bundled into one chunk.

**Why deferred:** initial-load performance isn't a launch blocker for a
B2B dashboard whose users sign in once and stay. The 163 KB gzip is fine
for first paint on broadband.

**Fix shape (~1–2 hours):**

1. **TanStack Router file-based code-splitting is already on** (`autoCodeSplitting: true` in `vite.config.ts`). It only splits *route components*, not heavy shared libs. Confirm by checking that each route file produces its own chunk (mostly does, see `dist/assets/dashboard-XXXX.js` etc.).
2. **Add `manualChunks` for the heavy shared deps** in `vite.config.ts`:
   ```ts
   build: {
     rollupOptions: {
       output: {
         manualChunks: {
           "react-vendor": ["react", "react-dom"],
           "tanstack": [
             "@tanstack/react-router",
             "@tanstack/react-query",
           ],
           "charts": ["recharts"],
           "markdown": ["react-markdown", "remark-gfm"],
           "forms": ["react-hook-form", "@hookform/resolvers", "zod"],
         },
       },
     },
   }
   ```
   That alone should knock the main chunk under 200 KB.
3. **Lazy-load recharts and react-markdown.** They're only used by
   `analytics.tsx` and the article editor — both deep enough in the tree
   that `React.lazy` + a small Suspense boundary is fine.
4. Optional: **bump the warning ceiling** with `chunkSizeWarningLimit: 750`
   to reflect what's actually acceptable for this app.

**Why it's safe to defer:** the warning is informational, not a build
failure. Users on the dashboard pay the load cost once.

**Triggers for prioritising:** Lighthouse / Vercel Analytics scores
flagged in a sales motion, or marketing wanting a faster
landing-page-to-dashboard handoff.

---

## 3. (Reserved) — add new entries above this line

Format for new entries:

````markdown
## N. Short title

**Status:** what's actually shipped today

**What was supposed to happen:** the ideal end state

**Why deferred:** the real reason — capacity, dependency, risk

**Fix shape (where, ~estimate):** concrete steps, file paths, function
names

**Why it's safe to defer:** what doesn't break by waiting

**Triggers for prioritising:** the signal that says "do it now"
````

Keep entries to about a screen each. If something gets longer, it
probably deserves an ADR in `docs/adr/` instead.
