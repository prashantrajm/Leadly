# Leady — Web (Dashboard)

The Leady customer dashboard. React 19 + Vite + TanStack Router + Tailwind v4 + shadcn/ui.

## Develop

```bash
bun install
bun dev   # vite on port 3000
```

## Build

```bash
bun build       # vite build && tsc
bun preview
```

## Lint / Format / Test

```bash
bun lint
bun format
bun check
bun test
```

## Routes

File-based routing under `src/routes/`. The generated route tree is `src/routeTree.gen.ts` (do not edit by hand).

## Notes

- Auth client is in `src/lib/auth-client.ts` (Better Auth).
- API base URL via `VITE_API_URL` (`.env.example`).
- Components follow shadcn conventions; add new ones with `bunx shadcn@latest add <name>`.
