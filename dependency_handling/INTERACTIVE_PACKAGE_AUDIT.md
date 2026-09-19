# Interactive Package Audit

Complete procedure for reviewing a new package or dependency upgrade, including transitive dependencies, release-age exceptions, and newly enabled scripts. It covers evidence collection through the admission decision.

Use this with [Dependency Overrides](DEPENDENCY_OVERRIDES.md). Read its operating rules and applicable exception policies before starting; that file defines the quarantine and the independent controls for versions, release age, script execution, and accepted advisories.

The examples use npm registry artifacts and pnpm workspaces. For another ecosystem, preserve the review gates and substitute its native resolver, lockfile, artifact verification, and advisory tools. No particular framework, project layout, package version, or CI provider is assumed.

The objective is a reproducible dependency change with explicit evidence and minimal exceptions. Code review, release quarantine, provenance checks, vulnerability scans, and tests provide different evidence; none proves that a package cannot be malicious.

## 1. Establish the baseline and authorization

Read the repository instructions, manifests, lockfiles, package-manager configuration, install hooks, patches, and CI commands before invoking project tooling. Inspect only relevant configuration fields; never dump authentication files, full environment variables, or token-bearing registry URLs into evidence.

Record:

- Repository revision and existing changes; dependency-change scope and any standing authorization already supplied by the user.
- Trusted runtime/package-manager versions, manifest pins, lockfile format, registry and scope mappings, and supported OS/CPU/libc targets.
- Effective quarantine, existing exclusions, script permissions, advisory filters, integrity settings, resolver hooks, and global/environment overrides. Verify what the pinned tool actually honors in local and CI execution.
- Exact project commands for lint, typecheck, tests, builds, and relevant runtime smoke tests. Do not invent scripts or execute them before the execution gate below.
- A baseline full-graph advisory report, its UTC timestamp, command, exit code, and coverage. Include production, development, optional, and workspace dependencies; a production-only scan is supplementary.

For pnpm, read the version-matched [configuration reference](https://pnpm.io/settings). Setting names and locations differ between major versions; neither an old `package.json` block nor an `.npmrc` setting is proof that the current tool enforces it. Use an already trusted toolchain. Do not bootstrap an unknown audit utility through `npx` or `pnpm dlx` during review.

Run a raw advisory scan with ignores and severity filters disabled using the supported configuration for that tool version. If necessary, use an isolated copy with only the audit filters removed and the same lockfile; retain both the raw report and the normal CI-gate result. Do not change the real project's exceptions merely to capture a report. A successful exit with ignored findings is not zero vulnerabilities.

For pnpm, this captures the result without swallowing the scanner's exit code. Run it from the selected workspace root after checking its tooling and configuring the raw scan described above:

```bash
set -euo pipefail
umask 077
audit_scan_dir=$(mktemp -d "${TMPDIR:-/tmp}/dependency-scan.XXXXXX")
if pnpm audit --json > "$audit_scan_dir/report.json" 2> "$audit_scan_dir/stderr.txt"; then
  audit_scan_exit=0
else
  audit_scan_exit=$?
fi
printf '%s\n' "$audit_scan_exit" > "$audit_scan_dir/exit-code.txt"
```

This snippet only preserves evidence; it is not a CI gate. Parse and validate the complete report and the saved scanner status before deciding success. Run the project's normal filtered gate separately.

For each nonzero exit, distinguish actual advisories from registry/authentication/network errors, malformed output, or unsupported commands. Do not use `|| true`, `--ignore-registry-errors`, a pipeline's final exit code, or an empty response to turn a failed scan into success. A broken endpoint requires a supported, verified scanner; do not claim coverage from an incomplete fallback. Confirm the project's approved advisory service before sending private dependency names outside its registry boundary.

## 2. Build the candidate and dependency inventory

For every proposed direct change, record the currently locked version, candidate exact version, affected workspaces, owning direct dependency, complete transitive paths, motivation, and alternatives tried. Look up current releases and advisories from the registry and upstream sources at review time; do not copy old versions or GHSA/CVE identifiers from another project.

Prepare the smallest candidate manifest/configuration change in the disposable environment. Resolve without lifecycle scripts, with the real quarantine intact and only trusted resolver hooks. A resolution failure caused by age is evidence to record, not permission to bypass it. Review the blocked release first. If a temporary exception is needed to discover the remaining graph, it may be used only in this disposable, script-disabled resolution after that release's review; it does not admit the graph to the project.

Compare baseline and candidate lockfiles. Inventory every added, removed, changed, or newly reachable artifact, including peers, optional dependencies, platform-specific binaries, aliases, registry/source changes, Git revisions, and patch files. Repeat until resolution introduces no unreviewed candidates. A direct package review does not cover its new transitive packages automatically.

Use the appropriate review depth:

| Candidate | Minimum manual review |
| --- | --- |
| Package new to the project, including a new transitive dependency | Package identity and purpose, full shipped file inventory, execution entrypoints and reachable code, scripts, dependency graph, and relevant platform artifacts |
| Upgrade with a recorded trusted baseline | Exact old-to-new published-artifact diff, changed code and surrounding behavior, metadata, dependency and platform changes |
| Upgrade without a trustworthy baseline | New-package review; the fact that a version is already installed does not establish trust |
| Any under-age release or newly enabled install/build script | The applicable review above plus an explicit exception/script decision; never approve from release notes alone |

An unchanged dependency with recorded evidence may reuse that evidence when its bytes, source, execution conditions, and relevant dependency context are unchanged. Record why reuse applies. A previously unused entrypoint or newly enabled platform path needs review even if its package version did not change.

## 3. Obtain the exact published artifacts without executing them

### Prepare a review environment

Use a disposable environment with a trusted, patched toolchain and archive viewer. A temporary directory or Git worktree alone is not a security sandbox. For untrusted code execution later, require an isolated VM or appropriately restricted container: unprivileged user, no host home or writable project mounts, no Docker socket or SSH agent, no production credentials, and resource limits. Restrict download egress to approved registries/artifact hosts; disable other network access for execution unless a specific test requires it.

Use a separate package cache/store and clean, reviewed configuration. Project/global resolver hooks, plugins, tool auto-downloads, and runtime preload variables can execute code independently of lifecycle scripts. `--ignore-scripts` does not make an arbitrary tool invocation safe. For private downloads, use approved read-only credentials only during retrieval, then remove them before running candidate code; do not store them in the audit record.

### Capture metadata and identity

Resolve tags/ranges to exact versions once. The following Bash recipe uses placeholders intentionally and must run in the prepared review environment. It retrieves public npm metadata; adapt registry authentication and scope routing explicitly for private packages. Stop and classify each command failure before continuing.

```bash
set -euo pipefail
umask 077
audit_package='REPLACE_WITH_PACKAGE_NAME'
audit_version='REPLACE_WITH_EXACT_VERSION'
audit_registry='https://registry.npmjs.org'

if [[ "$audit_package" == REPLACE_* || "$audit_version" == REPLACE_* ]]; then
  printf '%s\n' 'Set the exact package name and version before continuing.' >&2
  exit 2
fi
if [[ ! "$audit_package" =~ ^(@[a-z0-9][a-z0-9._-]*/)?[a-z0-9][a-z0-9._-]*$ ||
      ! "$audit_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$ ]]; then
  printf '%s\n' 'Use a standard registry package name and an exact Semver version.' >&2
  exit 2
fi

audit_dir=$(mktemp -d "${TMPDIR:-/tmp}/dependency-audit.XXXXXX")
mkdir "$audit_dir/downloads" "$audit_dir/cache"
cd "$audit_dir"

npm view "${audit_package}@${audit_version}" --json \
  --registry "$audit_registry" --cache "$audit_dir/cache" --prefer-online \
  > candidate-metadata.json
```

Inspect the saved JSON as data before the next command. Confirm that the returned name and version exactly match the candidate, the version exists, and the package/scope is the intended one. An npm alias must identify both the alias and actual underlying package.

Record the registry, exact version's publication time in UTC, `dist.tarball`, `dist.integrity`, repository and release commit/tag, available signatures/attestations, and evidence of publisher/repository continuity. Investigate unexpected ownership changes, typosquatting, a newly introduced registry, or a mismatch between a familiar name and its repository. Download counts and a familiar maintainer name are not sufficient identity evidence.

Use the timestamp for this version, not a repository tag date or the package's general `modified` field. Compute `eligible_at_utc = published_at_utc + quarantine_minutes`. Missing, contradictory, or future publication timestamps must be resolved before treating the release as mature. See [npm metadata queries](https://docs.npmjs.com/cli/v11/commands/npm-view/) for version and time-field selection.

Validate tarball and redirect destinations as HTTPS on approved hosts, without embedded credentials; enforce this in the download environment. Do not blindly follow an artifact URL to a local service or a different host with registry credentials attached.

### Download and verify bytes

After metadata/host checks, download the exact registry version into the same review directory:

```bash
set -euo pipefail
npm pack "${audit_package}@${audit_version}" --ignore-scripts --json \
  --registry "$audit_registry" --cache "$audit_dir/cache" --prefer-online \
  --pack-destination "$audit_dir/downloads" > candidate-pack.json
```

This is a registry-artifact download, not permission to pack a local checkout or Git dependency. Use only the reviewed exact registry spec. Verify the filename, name, and version reported by `candidate-pack.json`; reject path traversal or a path outside `downloads`. The behavior of `--ignore-scripts` and `--pack-destination` is documented in [npm pack](https://docs.npmjs.com/cli/v11/commands/npm-pack/).

Independently compute the downloaded file's integrity and compare it with the metadata saved before the download. For a single SHA-512 SRI value, use this Bash check after replacing both placeholders from the saved evidence:

```bash
set -euo pipefail
audit_tarball='REPLACE_WITH_VALIDATED_ABSOLUTE_TARBALL_PATH'
audit_expected_sri='REPLACE_WITH_SAVED_SHA512_SRI'

if [[ ! -f "$audit_tarball" || "$audit_expected_sri" != sha512-* ]]; then
  printf '%s\n' 'Missing artifact or SHA-512 integrity evidence.' >&2
  exit 2
fi
audit_actual_sri="sha512-$(openssl dgst -sha512 -binary "$audit_tarball" | openssl base64 -A)"
if [[ "$audit_actual_sri" != "$audit_expected_sri" ]]; then
  printf '%s\n' 'Artifact integrity mismatch: stop review of this candidate.' >&2
  exit 1
fi
printf '%s\n' "$audit_actual_sri" > candidate-verified-integrity.txt
```

Keep the strict Bash options active so hashing errors also stop the check. For another SRI algorithm or multiple SRI tokens, use a trusted standards-compliant verifier; do not remove the integrity requirement or silently downgrade algorithms. A missing supported digest leaves verification incomplete. A match establishes byte identity with the recorded metadata, not publisher trust.

Keep the verified artifact and metadata snapshot immutable for the review. If bytes or identity-critical metadata change under the same version, stop and investigate; never refresh checksums merely to clear the error. An unrelated new release changing the registry's overall version list does not itself invalidate unchanged candidate evidence. For an upgrade, repeat retrieval/verification for the exact baseline artifact and confirm it agrees with the old lockfile or retained baseline evidence.

For Git, URL, local, or patched dependencies, use a separate retrieval procedure: record the full immutable commit and/or content digest, inspect source/submodule/patch inputs, and review any preparation/build step before executing it. Hash and review the resulting consumer artifact as well. A moving branch/tag, mutable download URL without integrity, or live local directory is not an immutable review identity. Do not invent registry publication times or scanner coverage for these sources; record the applicable project policy and gaps.

### Inspect the artifact and provenance

Inventory the archive before extracting. Use a sandboxed extractor that rejects absolute paths, `..` traversal, Windows drive/UNC paths, escaping symlinks/hardlinks, duplicate or colliding normalized paths, special files, and unsafe permissions, and enforces file-count/uncompressed-size limits. Extract only into a new private directory. If the available tool cannot enforce these checks, inspect members without filesystem extraction or keep this step incomplete. Do not blindly run `tar -xzf` against an untrusted archive.

Verify the artifact's own manifest name/version against the metadata. Review the bytes shipped to consumers: compiled JS, bundles, native/Wasm binaries, embedded archives, and bundled dependencies, not only the upstream source tree. Compare shipped code to the claimed release commit and explain generated-file differences. A source-only fix is insufficient if the published runtime artifact does not contain it.

Verify available registry signatures and provenance with trusted tooling that supports the actual lockfile/registry. For example, [npm audit signatures](https://docs.npmjs.com/cli/v11/commands/npm-audit/#audit-signatures) verifies supported signatures and provenance for downloaded packages in an npm-compatible tree. Do not generate a different dependency tree and claim it verifies the pnpm candidate. Use a pnpm-compatible verifier when appropriate and record exactly which attestations it verifies or skips.

Check attestation identity against the expected repository, commit, workflow, and artifact digest. A valid signature does not establish benign code. Missing provenance is different from invalid provenance: record absence and alternate identity evidence, applying the project's requirements; an invalid signature, digest mismatch, or contradictory identity blocks admission until resolved.

## 4. Perform the manual code audit interactively

Here, **interactive** means a reviewer examines evidence, follows suspicious paths, records findings, and makes a candidate-specific decision. Merely running `pnpm audit --interactive` does not satisfy this procedure.

At the start, state the package, old/new versions, reason, age status, and planned review scope. Continue investigation without asking permission for each file, metadata query, or diff. Work under existing authorization for disposable verification; request a decision only when a concrete exception or change exceeds that authorization.

For upgrades, compare the verified old and new artifacts with a trusted diff viewer. `npm diff --diff='PACKAGE@OLD_EXACT' --diff='PACKAGE@NEW_EXACT'` is a useful supplementary registry comparison, but it may fetch again; the verified retained artifacts remain the basis of the decision. Do not use tags, whitespace-hiding options, file filters, or truncated output for the only review. See [npm diff](https://docs.npmjs.com/cli/v11/commands/npm-diff/).

For a new package, there is no old-to-new shortcut: review its shipped execution surface and dependencies. Read every changed executable file for upgrades, all new executable files, and surrounding callers/callees where behavior depends on them. Classify every shipped file as reviewed, unchanged with valid baseline evidence, or non-executable with a stated reason. Treat declarative files consumed by tools as potentially executable. If generated/minified/native content cannot be adequately inspected, obtain verifiable source/build correspondence or record the unresolved gap; do not mark it reviewed based on a changelog or keyword search.

Use this checklist, recording a finding or an evidence-backed `not applicable` for every row:

| Review area | Required examination |
| --- | --- |
| Lifecycle and tool execution | `preinstall`, `install`, `postinstall`, `prepare`, implicit native builds, CLI `bin` entries, invoked helpers, and subprocess commands; explain every new execution capability |
| Entrypoints and packaging | `main`, `module`, `exports`, conditional/browser entrypoints, dynamic imports, import-time side effects, changed file modes, bundled/minified output, maps, native/Wasm payloads, and files absent from source |
| Secrets, files, and network | Environment/credential access, home-directory traversal, shell configuration or persistence changes, filesystem writes, telemetry/exfiltration, destination changes, redirects, and platform/time/CI-dependent behavior |
| Obfuscation and indirection | Encoded strings/payloads, `eval`/dynamic function creation, computed imports, concealed subprocesses, downloaded executables, and unexpected generated or binary changes; follow behavior rather than relying on token matches |
| Dependencies | New/changed direct, transitive, bundled, peer, optional, and platform packages; aliases, Git/URL dependencies, registries, trust changes, and manifest-versus-lockfile discrepancies |
| Security fix and regression risk | Actual patched code and relevant test cases; path handling, parsers, input validation, regex/CPU/memory bounds, deserialization, authentication, cryptography, and error handling as applicable |
| Compatibility and maintenance | Runtime/engine support, API and module-format changes, types, peer requirements, license changes under project policy, release continuity, and supported platforms |

Trace each unexpected change to its behavior and explain why it is needed. Review a downloaded binary and the download/verification logic separately; approving an install script does not automatically approve the bytes it retrieves. Each required external payload needs a reviewed immutable identity and integrity check before execution.

Record findings with artifact-relative file/line or symbol, old/new behavior, consequence, evidence, and disposition. Follow suspicious code until resolved. If the review is too large, split the investigation or use already authorized independent review; report unreviewed scope. Never replace missing coverage with an invented approval or a claim that another reviewer checked it.

Before running candidate code, publish a concise candidate assessment: exact version/integrity, reviewed scope, unresolved issues, expected script/network/file behavior, and the isolated verification plan. If unresolved behavior prevents safe testing, stop this candidate and offer waiting, a smaller alternative, or a separately scoped investigation. Continue independent candidates where possible.

## 5. Verify the candidate in isolation

Proceed only after the static review supports the proposed isolated execution and the work is within the user's existing authorization. Enforce the environment described above. Dependency code can execute during import, typechecking, bundling, tests, or CLI startup even when lifecycle scripts are disabled.

1. Recheck artifact hashes and the complete candidate graph against the review records. Bind each exception to those exact artifacts. Install the candidate lockfile with lifecycle scripts disabled first.
2. Verify signatures/provenance against this graph where supported. Mark skipped registries or unsupported artifact types explicitly.
3. Enable only the lifecycle/build scripts shown necessary by the review, using the narrowest supported package/version permission. Review any fetched payload before executing it. Remove retrieval credentials and restrict network access before running candidate code. Do not enable all scripts to get a build through.
4. Run the recorded lint, typecheck, unit/integration tests, and relevant builds using project-native commands. Disable implicit dependency re-resolution or make it fail on mismatch; any new resolution returns to the inventory/review gate.
5. Exercise the actual affected runtime paths. Browser polyfills, wallet/authentication code, SSR/browser exports, uploads, database connectors, queues, and native packages can pass compilation while breaking in use. Select the applicable checks and platforms; use synthetic data and disposable services.
6. Re-run the full raw advisory scan and the normal CI gate. Compare against baseline findings, approved exceptions, and expected patched versions. Retain all reports and exit statuses.
7. Perform a clean frozen-lockfile install under the final intended policy and required script permissions, followed by the relevant smoke tests. Confirm the final lockfile digest matches the tested/reviewed graph and no tools silently changed it.

For pnpm, `pnpm install --lockfile-only --ignore-scripts` prepares resolution and `pnpm install --frozen-lockfile --ignore-scripts` installs the locked graph without lifecycle scripts. Use them only in the prepared environment with reviewed hooks/configuration; the latter alone cannot verify a package whose required native build was skipped. See [pnpm install](https://pnpm.io/cli/install).

Record known baseline test failures separately from new failures. Do not call a candidate fully verified with required checks skipped or broken. A compatibility failure can justify keeping the current dependency temporarily, but it does not excuse concealing its vulnerabilities.

## 6. Decide and apply the smallest justified change

Present the evidence before requesting any new authority. Include the candidate version/integrity, reviewed files and dependency changes, findings, verification results, exact proposed configuration diff, expiry/removal conditions, remaining risk, and recommendation.

Use one of these explicit outcomes per candidate:

- **Admit:** identity/artifact review, dependency coverage, required verification, and authorization are complete; apply the reviewed change.
- **Wait:** retain the existing dependency or avoid adding it until the exact eligibility time or an upstream fix; disclose any existing advisory left unresolved.
- **Reject:** choose an alternative or abandon this candidate because of identified behavior or compatibility failures.
- **Incomplete:** specify missing evidence or environment capability and the next action. Neither silence nor elapsed time converts this into approval.

Technical review and user authority are separate. A user request to upgrade dependencies authorizes ordinary investigation and verification, not automatically accepting a newly discovered vulnerability or changing a stricter project rule. Conversely, an explicit existing authorization for a defined exception need not be requested again. Record its scope and apply it only to the reviewed candidate. Ask at most one focused decision question for each outstanding decision; batch independent candidates only when their individual evidence is clear.

Move the tested manifest, lockfile, policy, and documentation changes into the target project without overwriting unrelated work. If integration, a rebase, or another edit changes the dependency graph, artifact identity, relevant application behavior, or policy, return to the affected review/verification steps. A changed version, registry, Git commit, patch, payload, or integrity requires a new candidate decision.

Apply the companion's policies for [version overrides](DEPENDENCY_OVERRIDES.md#version-overrides), [release-age exceptions](DEPENDENCY_OVERRIDES.md#release-age-exceptions), [build permissions](DEPENDENCY_OVERRIDES.md#build-permissions), and [accepted advisories](DEPENDENCY_OVERRIDES.md#accepted-unresolved-advisories). Each remains a separate decision; completing this audit does not itself authorize an exception.

## Evidence record

Create one record per package/version decision. Use stable repository-relative links or the project's restricted artifact store; private tarballs and internal paths must not be published accidentally. Retain sanitized metadata, verified hashes, file inventories/diffs, review notes, raw scan results, command exit codes, and verification results. Logs containing secrets must be handled privately and sanitized before sharing.

```text
Candidate ID:
Decision: proposed | reviewing | isolated-verification | admit | wait | reject | incomplete
Reviewer and review time (UTC):
Repository revision / baseline lockfile digest / pre-existing changes:
Package manager, runtime, configuration sources, registry, target platforms:
Requested change, motivation, owning direct dependency, full dependency paths:
Old exact version + source + integrity (or new-to-project):
Candidate exact version + source + integrity:
Publication time / quarantine minutes / eligibility time (UTC):
Artifact identity / signatures / provenance / skipped or missing evidence:
Candidate graph + final lockfile digest / new-transitive review records:
Shipped file inventory / reviewed diff and code paths / justified exclusions:
Checklist findings, evidence links, severity, and disposition:
Commands + execution environment + timestamps + exit codes + report links:
Baseline failures / candidate failures / required checks not run:
Full raw audit counts / accepted findings / remaining unaccepted findings:
Exact proposed manifest, lockfile, and configuration diff:
Override selector + removal condition (or none):
Age exception + exact selector + enforced expiry (or none):
Script permission + reviewed helpers/payload identities (or none):
Advisory exception + exposure + mitigation + enforced deadline (or none):
Decision authority: existing instruction/policy or explicit decision and time:
Decision rationale / remaining limitations:
Owner / follow-up trigger / rollback procedure:
```

## Completion and adversarial self-check

Before handing off, verify all of these statements against the evidence:

- The actual installed artifacts and final graph match the reviewed identities; source tags and package names alone were not substituted for byte verification.
- Every new executable surface and newly resolved dependency has a review disposition; no shortened diff, optional platform, alias, payload, or generated file silently escaped the scope.
- Scanner failures, skipped signatures, missing timestamps, and incomplete reviews are visible and cannot pass the gate as success.
- All proposed exceptions are independently justified, authorized, narrow, recorded, and mechanically bounded where required. No global config or blanket permission was changed to conceal a failure.
- Required tests ran against the final graph in the stated environment; a disabled native build or successful compilation alone was not reported as runtime verification.
- Raw and filtered audit results agree with the documented risk state; expired exceptions and newly affected paths fail CI.
- The final diff preserves unrelated work, and rollback returns to the recorded baseline without silently discarding user changes or hiding the baseline's known advisories.

Challenge the procedure with concrete counterexamples: a tarball changes under the same version; the source tag is clean but shipped JS differs; a postinstall helper downloads new bytes; a new optional native package appears only in CI; the registry returns an error with an empty report; an excluded package resolves a newer release; an accepted advisory reaches a second path; an exception reaches its deadline; or another edit changes the lockfile after testing. Each must invalidate the affected approval or produce an explicit incomplete/failing result.

Finish with the actual changes, evidence links, remaining overrides/exceptions, unresolved findings, and next removal triggers. Do not claim an audit was run merely because this template was copied into a project.

Update the project's live [dependency record](DEPENDENCY_OVERRIDES.md#project-record) with links to the completed candidate evidence.
