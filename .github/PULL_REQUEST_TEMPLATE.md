## What & why

<!-- What does this PR change, and why? Link the issue it closes, e.g. "Closes #123". -->

## How it was tested

<!-- Commands you ran, manual steps, smoke tests. Screenshots or a recording for UI changes. -->

## Checklist

- [ ] `bun typecheck`, `bun lint` and `bun test` pass
- [ ] Tests added or updated for changed behaviour
- [ ] Prisma migration (if any) re-adds the HNSW vector index
- [ ] WebSocket protocol changes only **add** frame types (nothing renamed or removed)
- [ ] New tables/queries are scoped by `organizationId`
- [ ] Docs (`README.md` / `CLAUDE.md`) updated if behaviour or setup changed
