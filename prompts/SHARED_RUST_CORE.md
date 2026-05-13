# Shared Rust Core Pattern (Cross-Platform)

Put deterministic business logic in a shared Rust core, then expose it to each platform.

## Architecture
```
crates/domain-core/
  src/lib.rs           # Public API
  src/domain_core.udl  # UniFFI interface definition (consumed by Android + iOS)
packages/core-wasm/    # WASM bridge for TypeScript
```

## Update Checklist
When changing a Rust export, update ALL of:

1. `crates/domain-core/src/lib.rs` — implementation
2. `crates/domain-core/src/domain_core.udl` — interface definition
3. Android wrapper types + tests
4. iOS wrapper types + tests
5. WASM/TypeScript bridge (if the API backend or packages use the same logic)

## Generated Bindings
- Do not hand-edit generated bindings (UniFFI output, XCFrameworks, etc.).
- Android generates bindings during Gradle builds.
- iOS generates Swift/header files via a build script.
- The build tools are in the repo — don't run them manually unless documented.

## Why
- Shared validation, calculations, parsing, and rules behave identically on every platform.
- One test suite for shared logic (Rust).
- Platform-specific wrappers are thin and testable in isolation.

## Applies to
- Cross-platform mobile apps (Android + iOS)
- API backends that share logic with clients
- Any system where deterministic behavior must be identical across runtimes
