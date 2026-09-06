Resume from the secret-gate stop. Cowork changed two files since your last run: `.env.example` (placeholder `PASSWORD` → `<PASSWORD>`, so the gate no longer matches it) and `.gitattributes` (adds `*.yml`, `*.yaml`, `*.sql`), plus a one-line change-log entry in `docs/deployment-contract.md`. Sections 1–3 of the previous prompt are done (boto3 installed, Windows certification passed, 492 assets pushed) — do not repeat them. Do not modify the code; if a step fails, stop and report.

## 1. Confirm state
1. `git status --short` must show exactly: `M .gitattributes`, `M data/row_order.json`, `M docs/rendering-contract.md`, `M scripts/render_day.py`, `?? .env.example`, `?? .github/`, `?? adapters/nba.py`, `?? db/`, `?? docs/deployment-contract.md`, `?? requirements.txt`, `?? scripts/sync_assets.py`, plus the always-untracked `assets/logos/`, `assets/network-logos/`. Paste it.
2. `findstr /N "PASSWORD" .env.example` — expect two lines, both containing `<PASSWORD>` with the angle brackets. Paste them.

## 2. Commit and push
1. Stage exactly: `git add .gitattributes .env.example .github adapters/nba.py data/row_order.json db docs/deployment-contract.md docs/rendering-contract.md requirements.txt scripts/render_day.py scripts/sync_assets.py`
2. Secret gate (unchanged): `git diff --cached | findstr /R "CFBD_API_KEY=[A-Za-z0-9] SUPABASE_DB_URL=postgresql://mysports_writer.ztnppejmdwmhqstqsfks:[A-Za-z0-9] R2_SECRET_ACCESS_KEY=[A-Za-z0-9]"` must print nothing. If anything prints, `git reset` and stop.
3. Confirm nothing under `assets/`, `artifacts/`, or `.env` is staged.
4. Commit with this message exactly:

```
Phase 4: deployment contract v1.0, Milestone 1 DDL (dry-run), NBA adapter, renderer v1.6, GitHub Actions

- docs/deployment-contract.md: D1-D10 — mysports schema in the BudgetBuddy Supabase project, R2 buckets
  mysports-assets (public) + mysports-data (private), GitHub Actions, env-var contract, backups, rollback
- db/migrations/0001 (applied 2026-09-01), 0002-0005 (dry-run passed, rolled back; apply pending approval):
  20 enums, 27 tables, RLS anon-read, seed rows (market, viewer profile, render policies, sources)
- adapters/nba.py: ESPN scoreboard source (live-verified) + league-file source (--from-file; shape unverified);
  Cavs local row; nba-{TRICODE} ids; row_order gains nba
- scripts/render_day.py v1.6: Around the League strip (contract 11.8), per-sport output folders,
  ASSET_BASE_URL fallback; CFB Week 1 render still byte-identical to v1.4
- scripts/sync_assets.py: check/push/pull + push-grids + push-data(--keep); requirements.txt; .env.example
- .github/workflows: schedule_refresh (MWF 11:00 UTC), render_all (daily in season), bootstrap_season, backup_schema
- docs/rendering-contract.md: v1.6 change-log entry; .gitattributes: yml/yaml/sql pinned to LF
Assets: 492 files pushed to R2 mysports-assets (logos, network marks, fonts) — the bucket is now the source of truth
```

5. `git push origin main`; then `git rev-parse HEAD` and `git rev-parse origin/main` — both must match. Report both.

## 3. Report
Paste the git status, the findstr lines, the secret-gate result (empty), the commit hash, and the two rev-parse hashes.
