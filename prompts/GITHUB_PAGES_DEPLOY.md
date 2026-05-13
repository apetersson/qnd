# GitHub Pages from /docs on main

Serve a static site from the `docs/` directory on the `main` branch.

## Workflow
```sh
# 1. Build your static site
cd web
pnpm install
pnpm run typecheck && pnpm run lint && pnpm run build && pnpm run test

# 2. Sync built output to /docs at repo root
rm -f web/dist/.DS_Store docs/.DS_Store
rsync -a --delete --exclude '.DS_Store' web/dist/ docs/

# 3. Commit on main
git add docs
git commit -m "chore(web): deploy frontend to docs"
git push origin main
```

## GitHub Config
- In repo Settings → Pages, set source to "Deploy from a branch" → `main` → `/docs`.
- No `gh-pages` branch needed.

## Verification
```sh
gh api repos/<owner>/<repo>/pages --jq '{status,source,html_url}'
gh api repos/<owner>/<repo>/pages/builds/latest --jq '{status,commit,error}'
curl -fsSL 'https://<owner>.github.io/<repo>/?cachebust='$(date +%s) | grep -o 'assets/[^" ]*'
```
