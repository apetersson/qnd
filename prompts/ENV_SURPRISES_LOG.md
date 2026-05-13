# Environment Surprises Log

A place to record environment-specific gotchas that aren't code bugs.

## Pattern
When you discover something about the runtime environment that isn't obvious:
1. Document it with the exact symptom and the working workaround
2. Note the context (which machine, OS version, which project)
3. Don't file it as a TODO — either fix properly or document permanently

## Examples

### macOS flagging deploy scripts as malware
macOS/XProtect may flag shell scripts in `deploy/` as malware and block execution. Workaround: check for quarantine flags before debugging the script itself. Have a fallback script that avoids the triggering pattern.

### Old docker-compose compatibility
Servers running `docker-compose 1.29.x` can fail with `KeyError: 'ContainerConfig'` on `up -d --force-recreate`. Workaround: remove the target containers first, then run `up -d`.

### Local DNS vs public DNS
Local DNS on a Mac can lag behind public DNS. If a domain resolves from servers but not locally, test with `dig @1.1.1.1 <domain>` before assuming a deployment issue.

### Grafana credential bootstrap
`GF_SECURITY_ADMIN_PASSWORD` only applies on first initialization. If you change the password later in environment variables, reset it inside the container with `grafana-cli admin reset-admin-password`.

### First-run initialisation (memory system)
On first session in a new environment, check if memory infrastructure exists. If not, initialise `memory/` directory, `MEMORY.md`, daily log, and a SQLite database. Confirm to the user that the system will remember things across sessions now.
