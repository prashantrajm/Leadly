# Leadly — API

The Leadly backend. Hono + TypeScript. Currently scaffolded on Cloudflare Workers; migrating to Bun-on-VPS per `docs/v1-design.md` §5.

## Develop

```bash
bun install
bun dev   # wrangler dev on port 8787 (until the runtime migration)
```

## Deploy

```bash
bun deploy
```

## Database

Postgres + pgvector via Prisma. See `prisma/schema.prisma` and `prisma/auth.prisma`.

```bash
bun migrate         # prisma migrate dev
bun generate        # prisma generate
bun studio          # prisma studio
bun db:seed         # seed local DB
```

## Auth

Better Auth, Google OAuth provider. Routes mounted at `/api/auth/*`.
