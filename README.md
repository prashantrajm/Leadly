# Leadly

Open-source AI support platform — embeddable chat (and later voice) widget with knowledge base, retrieval, lead capture, and a live human-takeover inbox.

See [`docs/v1-design.md`](./docs/v1-design.md) for the full v1 design.

## Structure

```
leadly/
├── apps/
│   ├── web/      # React dashboard (Vite + TanStack Router)
│   ├── api/      # Hono backend
│   └── native/   # Expo mobile app
├── packages/     # Shared packages (future)
├── docs/         # Design docs
└── package.json  # Root workspace
```

## Prerequisites

- [Bun](https://bun.sh)

## Getting Started

```bash
bun install
```

### Develop

```bash
# All apps
bun dev

# Web only
bun dev:web

# API only
bun dev:api
```

### Build

```bash
bun build
bun build:web
bun build:api
```

### Test / Lint / Format

```bash
bun test
bun lint
bun format
bun check
```

## Apps

### Web (`apps/web`)
React 19, Vite, TanStack Router, TanStack Query, Tailwind v4, Radix UI, Biome.

### API (`apps/api`)
Hono, TypeScript. Runtime is migrating to Bun on a VPS (see `docs/v1-design.md` §5).

### Native (`apps/native`)
Expo Router. Not in v1 scope.

## Workspace commands

```bash
bun run --filter='*' <command>
bun run --filter=web <command>
```

## License

Apache-2.0.
