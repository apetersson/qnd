# Verify Before Claiming Done

Mandatory verification gate before asserting that something works.

## Pattern
```bash
pnpm typecheck    # 0 errors mandatory
pnpm lint         # 0 errors mandatory
pnpm test         # all tests passing
```

**Evidence before assertions.** Do not claim something works without running these gates.

## Environment-Specific Commands
When working in a new project, identify the correct commands and document them at the top of the project's AGENTS.md:

```bash
# Examples from real projects
pnpm typecheck        # tsgo --noEmit
pnpm lint             # ESLint 9
pnpm format           # Prettier
pnpm test --run       # Vitest
pnpm build            # Production build
```

## Lint Discipline
- If lint is strict (fails on unused values or formatting), run with `--fix` or adjust dependencies promptly.
- Do not bypass lint checks — they catch real issues.
