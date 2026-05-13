# Translation System Patterns (Paraglide i18n)

Patterns for managing translations with tree-shakable, type-safe aliases.

## Source of Truth
- Messages live in `frontend/messages/*.json` with identical keys across locales.
- Prefer flat, snake_case keys to maximise generated type-safe helpers.
- Generated artifacts live in `frontend/src/paraglide/` (via Vite plugin and compile step).

## Generated Alias Files
Generate tree-shakable alias files from the source messages. Import only the narrow subtree you need, then call leaves as functions:

```ts
// Good
import { t as ONBOARDING_T } from "@/i18n/aliases/onboarding/steps/accept_terms";
ONBOARDING_T.title();

// Bad
t('create_account');           // string key, no type safety
m[key]                          // dynamic key — defeats tree-shaking
```

## Regeneration
Run the compiler after editing message files:
```bash
pnpm exec paraglide-js compile
```

If typings seem stale, re-run the compile step — the Vite plugin also compiles on build.

## Do / Don't
- ✅ Do: `const label = m.create_account()`
- ❌ Don't: `t('create_account')` or `m[key]` with dynamic keys
- ✅ Do: regenerate aliases when messages change
