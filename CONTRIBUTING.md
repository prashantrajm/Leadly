# Contributing to Leadly

Thanks for your interest in Leadly! Bug reports, fixes, docs and features are all welcome. This guide covers how to get set up and what we look for in a pull request.

By participating you agree to follow our [Code of Conduct](./CODE_OF_CONDUCT.md). Security issues should **not** go through public issues; see [SECURITY.md](./SECURITY.md).

## Ways to contribute

- **Report a bug:** open an issue using the bug report template. Include steps to reproduce.
- **Suggest a feature:** open a feature request first, so we can agree on the approach before you write code. This matters most for anything that touches the architecture (see below).
- **Fix something:** issues labelled `good first issue` or `help wanted` are a good place to start. Comment on the issue so others know you're on it.
- **Improve docs:** typo fixes and clarifications can go straight to a PR.

## Before you start: read `CLAUDE.md`

[`CLAUDE.md`](./CLAUDE.md) is the architecture map for humans and AI assistants alike. It lists where things live, the hard architectural commitments, and the "things that bite". The design rationale is in [`docs/v1-design.md`](./docs/v1-design.md).

Some decisions are deliberate and **won't be changed in a drive-by PR**. Open an issue to discuss them first:

- Cloudflare end to end (Workers, Durable Objects, Workflows, R2, KV), with no portability layer.
- OpenRouter as the single LLM provider, via `@openrouter/ai-sdk-provider` and AI SDK v6.
- One Durable Object per conversation.
- Postgres + pgvector via Prisma Accelerate.
- Zod schemas in `packages/schemas` as the API contract.

## Development setup

Prerequisites: [Bun](https://bun.sh), a Postgres database with pgvector (Prisma Accelerate URL), and an [OpenRouter](https://openrouter.ai/keys) API key. Free-tier models are fine for development.

```bash
git clone https://github.com/<you>/Leadly.git
cd Leadly
bun install

cp apps/api/.dev.vars.example apps/api/.dev.vars    # fill in secrets
cp apps/web/.env.example apps/web/.env.local

bun run --filter=api migrate
bun dev:api      # :8787
bun dev:web      # :3000
```

> ⚠️ Use your **own development database**. DB tests and migrations run against whatever `DATABASE_URL` points at. Never point them at a production database.

## Making changes

### Branches

Branch off `main` with a descriptive prefix:

- `feat/<short-name>`: new functionality
- `fix/<short-name>`: bug fixes
- `docs/<short-name>`, `chore/<short-name>`: docs, tooling, cleanup

### Commits

Write commit subjects as a short imperative sentence that says what the change does, for example:

```
Add workspace invites, role changes, and workspace/account deletion
Fix lead field merges binding SQL fragments as JSON
```

Use the body to explain *why*, plus anything a reviewer wouldn't get from the diff. Keep unrelated changes in separate commits.

### Code style

- TypeScript everywhere, strict mode.
- [Biome](https://biomejs.dev) for lint and formatting: `bun lint`, `bun format`, `bun check`.
- Derive types from Zod schemas with `z.infer`. Don't hand-write duplicate types.

### Tests

- Unit tests live next to the code as `*.test.ts`. The API uses Bun's test runner; the web app uses Vitest.
- Add or update tests for behaviour you change. Bug fixes should come with a test that would have caught the bug.
- DB tests scope their fixtures with a `tag` prefix and clean up via the org's cascade delete. Follow the same pattern.

Before pushing:

```bash
bun typecheck
bun lint
bun test
```

If your change touches the live chat path, also run the smoke test against `wrangler dev` (see [README → End-to-end smokes](./README.md#end-to-end-smokes)).

## Invariants to keep

PRs that break these will be asked to change:

1. **The WebSocket protocol is stable.** Add new frame types in `packages/wire`; don't rename or remove existing ones, because embedded widgets depend on them.
2. **Every non-auth table carries `organizationId`**, and every query is scoped by it.
3. **BYOK plaintext never leaves the encryption boundary.** Routes return `maskedSuffix` only, and `decryptForOrg` is the single read path.
4. **Tool `execute()` functions stay pure-ish.** They mutate DB rows and return JSON. WebSocket broadcasts and workflow triggers belong in the Durable Object.
5. **Every route validates with a Zod schema** from `packages/schemas`.

## Common change recipes

| Change | What to remember |
|---|---|
| Prisma schema | Edit `apps/api/prisma/*.prisma`, run `bun run --filter=api migrate`, then **re-add the HNSW index** in the generated migration (idempotent `DROP INDEX IF EXISTS` + `CREATE INDEX IF NOT EXISTS ... USING hnsw ("embedding" vector_cosine_ops)`). Prisma's drift detection drops it otherwise. |
| New REST route | Copy a sibling in `apps/api/src/routes/`, add the schema in `packages/schemas`, mount it in `routes/index.ts`. |
| New agent tool | Register it in `apps/api/src/services/system-tools.ts` and wire it in `apps/api/src/durable/conversation.ts`. |
| New top-level marketing page | Add the route **and** add its path to `RESERVED_ORG_SLUGS` in `packages/schemas/src/org.ts`. A web test fails otherwise. |
| New workflow or cron | See the table in `CLAUDE.md`. Both need registering in `wrangler.jsonc`. |

## Pull requests

1. Keep PRs focused. One feature or fix per PR is much easier to review.
2. Fill in the PR template: what changed, why, and how you tested it.
3. Include screenshots or a short recording for dashboard or widget UI changes.
4. Make sure `bun typecheck`, `bun lint` and `bun test` pass.
5. Be patient and responsive. A maintainer will review as soon as possible, and may ask for changes.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
