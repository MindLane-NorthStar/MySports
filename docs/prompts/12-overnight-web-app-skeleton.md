You are working in the MySports repo (C:\Users\jlull\Joe's Projects\Apps - Personal\MySports), branch main, HEAD a8ac454. This is an OVERNIGHT UNATTENDED RUN — Joe is asleep and has authorized you to work without approvals or interaction. You have full autonomy within the rails below. Work through the six stages IN ORDER; each stage ends with its own commit and push, so progress survives whatever happens later. If a stage fails twice, SKIP IT, note the failure in the report, and move on — never block the night on one stage, and never ask a question (there is no one to answer). At the very end write `artifacts/overnight_report.md` (Joe reads it in the morning) and print it in full.

## Standing rails (every stage)
- Never print any value from `.env`. Secret gate before EVERY commit: `git diff --cached | findstr /R "CFBD_API_KEY=[A-Za-z0-9] SUPABASE_DB_URL=postgresql://mysports_writer.ztnppejmdwmhqstqsfks:[A-Za-z0-9] R2_SECRET_ACCESS_KEY=[A-Za-z0-9]"` must print nothing; nothing under `assets/`, `artifacts/`, `.env`, or any `node_modules/` staged.
- Database: reads are unrestricted; writes ONLY through the existing loader/reconciler/register flows and Stage 6's TEMP tables. No DDL on the `mysports` schema, no DELETE/UPDATE outside those flows, no migrations.
- No deploys, no new scheduled tasks or workflow triggers, no force-push, no history rewrites. `git push origin main` after each stage commit; verify `origin/main` == HEAD each time.
- Log every judgment call in the report, one line each. Windows Python rules apply (no `%-` strftime, `encoding=` on open(), ASCII console).
- Commit messages: prefix `Overnight stage N:` and describe honestly. If a stage produced nothing commit-worthy, no commit.

## Stage 1 — R2 asset sync (small; do first, it unblocks Thursday's automated MLB render)
Read `scripts/sync_assets.py` to see the push modes it offers. Push to R2 whatever it supports for: the 30 `assets/logos/mlb-*.png`, and `assets/network-logos/guardians-tv.png` + `assets/network-logos/mlb-network.png`. Verify: fetch two of the pushed objects from the public bucket URL (the r2.dev base used in `generated_grids` rows) with HTTP 200. Report before/after object counts if the script prints them. Commit only if any tracked file changed (likely nothing — assets are untracked; the stage still counts as done).

## Stage 2 — CFB logo prefetch for Saturday
Every cfb team id referenced by `games` in the database should have `assets/logos/{id}.png` locally. Query the distinct home/away team ids for `sport='cfb'` via psycopg (read-only), diff against the local files, and fetch the missing logos through the same ESPN join path the adapters already use (`adapters/espn.py` fetch/teams logic — reuse, don't reinvent). Then push them to R2 as in Stage 1. Report: how many were missing, fetched, failed. A handful of failures (FCS teams without ESPN art) is acceptable — list them.

## Stage 3 — Test-suite expansion (everything shipped since the 19 reconciler tests)
Current suite: `tests/test_reconcile.py` (19, all green — verify first). Add new test modules, stdlib unittest, NO live DB writes (reads allowed; write-path assertions go through `--emit-sql` output or pure functions):
1. `tests/test_scores.py` — the five boxscore URL templates (cfb/nfl/nba id-as-is or prefix-stripped; nhl/mlb league-native); adapter status mappers: run each adapter's mapping function over its saved raw snapshots in `artifacts/raw/` (and hand-built minimal dicts) asserting scheduled/in_progress/final/postponed/cancelled come out right and that an unrecognized state maps to null, never final; ESPN string-"0" scores on scheduled games must not emit integers.
2. `tests/test_load_guards.py` — `load_fixture` on a fixture whose `validation.source` is `mysports-db` returns the zeroed counter dict (build a tiny fixture inline in a temp dir); the `--all` glob excludes `db_*` files (create a temp validation dir and assert file selection).
3. `tests/test_register_grids.py` — render_hash is sha256 of bytes; the same file twice yields one insert intent (exercise whatever pure part of `scripts/register_grids.py` allows without a DB — refactor a small pure helper out of it if needed, behavior unchanged).
Target: at least 15 meaningful new tests, entire suite green. Commit.

## Stage 4 — Renderer v1.6.3: the `_fx_desc` date nit (from the v1.6.2 report)
`_fx_desc` in `scripts/render_day.py` builds its date prefix from `generatedAt[:10]` (raw UTC) while the time beside it now displays ET — the NBA line reads "fixture 2026-09-02 … data as of Sep 1, 2026 8:40 PM ET", two calendar days for one instant. Derive the prefix from the SAME ET datetime as the "data as of" display. Bump the generator tag to v1.6.3; contract §12 entry. Acceptance: re-render mlb 2026-09-04 (fixture-fed) and nba 2026-10-28 (DB-fed via render_feed); diff each new SVG against the prior one — the ONLY changed lines are the subtitle/footer text lines and version tag; render each twice, byte-identical. Run `python scripts/register_grids.py artifacts/rendering --workflow claude-code` — one new row per re-rendered day, second run registers 0. Commit.

## Stage 5 — Milestone 4 part 1: the production app skeleton (the big one — take your time)
Scaffold the real web app in a new top-level `web/` directory. Framework: Next.js (current LTS-ish version), TypeScript or JavaScript — your call, document it. NO deployment tonight; the deliverable is a committed, locally-building app with LIVE database reads.

Data access — anon (read-only) Supabase REST, these are publishable values and safe to commit in `web/.env.local.example` AND to use in a committed `web/lib/config.js` default:
- URL: `https://ztnppejmdwmhqstqsfks.supabase.co`
- anon key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0bnBwZWptZHdtaHFzdHFzZmtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDgzMDIsImV4cCI6MjA5MTMyNDMwMn0._CrGovWte9r1wNfW0jN01AFHa9p1GVe9BKAgZqK-POY`
- Schema: `mysports` (REST profile header `Accept-Profile: mysports`). RLS grants anon read on the content tables; `source_observations`/`refresh_runs` are intentionally unreadable — do not depend on them.
- Team/network logo images: public R2 base `https://pub-8373112ac08548d8af79fe58b7c2dcb9.r2.dev/` (`logos/{teamId}.png`, `network-logos/{slug}.png`, `grids/{sport}/grid_{date}.svg`).

Build three routes on the TWO-WEEK-CONCEPT MODEL (Joe's blessed design — season week = provider week label for cfb/nfl with the date span DERIVED from the games; ISO Monday–Sunday over viewing_day for nba/nhl/mlb and all-sports):
1. `/` **Today**: date picker + sport filter; lists that viewing day's games (time ET, away @ home with team colors as a card seam, network name, TBD/Final states with scores); when `generated_grids` has a row for (sport, day) show the newest archived grid SVG from R2 above the list.
2. `/weeks` **Weeks**: calendar-week (Mon–Sun, all sports) and season-week (NFL/CFB week labels, derived span shown) views as day-column listings — listings, never grids.
3. `/history` **History**: completed games (result_status = 'final') newest first with scores, search box (team/network), each card a full-card link to `boxscore_url` opening in a new tab — the raw URL never displayed.
Visual shell: minimal dark chrome using the grid palette (page `#1B1B1B` radial to `#0E0E0E`, panel `#31363D→#1E2126`, ink `#F2F2F0`, dim `#9AA0A8`, gold `#F0C850`) — structural only; Joe's approved prototype design gets applied in a later pass, so keep components clean and unstyled-simple rather than guessing at polish.
Engineering rails: server-side data fetching (no anon key needed client-side is fine either way — the key is publishable); `web/.gitignore` with node_modules/.next; no extra UI libraries; keep the dependency tree minimal.
Acceptance (all unattended-verifiable): `npm run build` completes with no errors; a `web/scripts/smoke.mjs` node script hits the REST endpoint and asserts (a) 12 mlb games on viewing_day 2026-08-31 all final with integer scores, (b) 16 nfl week-1 games, (c) at least one `generated_grids` row — run it and paste output; `npm run lint` if the scaffold includes it. Add a `web/README.md` (how to run, where the config lives, what's stubbed). Update the root `db/README.md` or a new `docs/app-skeleton.md` with the route/data contract. Commit (message: `Overnight stage 5 / Milestone 4 part 1: web app skeleton - live DB reads, two-week model, no deploy`).

## Stage 6 — Backup + recovery drill (deployment contract §6 debt)
1. `python scripts/backup_table.py` for: games, game_broadcasts, networks_services, teams, canonical_decisions, generated_grids, viewer_game_eligibility. Note row counts.
2. Recovery drill WITHOUT touching real tables: for `games` and `game_broadcasts`, via psycopg create a TEMP table (`create temp table drill_games (like games including all)` — temp tables are writer-safe and vanish at disconnect), COPY the CSV back in, assert the row count equals the live table's count, then disconnect. This proves the backups restore.
3. If `scripts/sync_assets.py` has a data-push mode, push the backup CSVs to the private `mysports-data` bucket (offsite copy). 
4. Document the drill (date, tables, counts, result) in `db/README.md`. Commit.

## Final report — `artifacts/overnight_report.md`
Per stage: DONE/SKIPPED/PARTIAL, key numbers (objects synced, logos fetched, tests added and total green count, diff-line proof, build output tail, smoke results, drill counts), every judgment call one line each, every commit hash, and a short "what Joe should look at first" section. Print the whole file as your final message.
