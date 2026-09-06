You are working in the MySports repo (C:\Users\jlull\Joe's Projects\Apps - Personal\MySports), branch main, HEAD 0d67eb4. Cowork wrote the Milestone 1 loader (`pipeline/`) and validated its generated SQL against the live schema in a rolled-back transaction. Your job: the first LIVE load into the `mysports` schema from this machine (it holds SUPABASE_DB_URL in .env), the Windows certification, then commit and push. Do not modify the code unless a step fails; if one does, stop, report, and wait. Never print any value from `.env`.

## 0. Preconditions
1. `python --version`.
2. `git status --short` must show exactly: `M .env.example`, `M .github/workflows/bootstrap_season.yml`, `M .github/workflows/schedule_refresh.yml`, `M adapters/nhl.py`, `M db/README.md`, `M docs/deployment-contract.md`, `M requirements.txt`, `?? pipeline/`, plus the always-untracked `assets/logos/`, `assets/network-logos/`. Paste it.
3. Delete `artifacts\_phase4_stage_7.zip`.
4. `pip install "psycopg[binary]"` — report the version.
5. Confirm `.env` has a non-empty `SUPABASE_DB_URL` (presence only).

## 1. Live bootstrap (reference data)
`python -m pipeline.bootstrap` — paste every console line. Expected: `networks_services: 44`, `viewer_services: 40`, `conferences: 77; teams: 778`, `team_territories: 3`, `rivalries: 48`, `committed`. (mlb teams file absent is expected.)

## 2. Live fixture load
`python -m pipeline.load --all --workflow claude-code` — paste every line. Expected TOTAL: `games 250 · broadcasts 180 · odds 29 · records 0 · observations 430 · teams_stubbed 500 · venues 194 · run_id N · committed` (small differences are fine if a fixture file changed; a traceback is not).

## 3. Verify (read-only, through psycopg; prints counts only)
Run this exactly:
```
python -c "import os,psycopg;from adapters.common import find_repo_root,load_dotenv;load_dotenv(find_repo_root()/'.env');c=psycopg.connect(os.environ['SUPABASE_DB_URL']);cur=c.cursor();cur.execute(\"set search_path=mysports\");[print(t,cur.execute(f'select count(*) from {t}').fetchone()[0]) for t in ('teams','conferences','venues','networks_services','viewer_services','rivalries','team_territories','games','game_broadcasts','game_odds','source_snapshots','source_observations','refresh_runs')];cur.execute(\"select id,primary_network_id,canonical_state from games where id in ('nhl-2026020011','nba-401909882','nfl-401872922')\");print(cur.fetchall());cur.execute(\"select workflow,status,games_checked from refresh_runs order by run_id desc limit 1\");print(cur.fetchone())"
```
Paste the output. Expected: teams 778 or a little more (the loader stubs any fixture team missing from the teams files — report the number), games 250, game_broadcasts 180, game_odds 29, source_snapshots 7, source_observations 430, refresh_runs 1; the three games show `cbj-local` / `cavs-local` / `cbs` as primary networks with state `fully_assigned`; the last run is `claude-code succeeded 250`.

## 4. Idempotency check
Run `python -m pipeline.load --all --workflow claude-code` a second time and paste the TOTAL line; then re-run the step-3 command and confirm games (250), game_broadcasts (180), game_odds (29) and teams are unchanged while source_snapshots is 14, source_observations 860, refresh_runs 2. (Observations and snapshots are evidence and accumulate by design; facts are upserted.)

## 5. Windows certification
`python -m adapters.nhl --date 2026-10-01` then `python scripts/render_day.py --sport nhl --date 2026-10-01` — paste the last lines; expected `v1.6 [nhl]: 3 on grid · 0 TBA · 5 omitted`. Open `artifacts/validation/nhl_2026_2026-10-01_fixture.json` and confirm the BUF @ CBJ local row's `label` now reads `Blue Jackets local TV - carrier TBA` (nickname fix).
Report: no traceback, no UnicodeEncodeError, no strftime error across every command.

## 6. Commit and push
1. Stage exactly: `git add .env.example .github/workflows/bootstrap_season.yml .github/workflows/schedule_refresh.yml adapters/nhl.py db/README.md docs/deployment-contract.md pipeline requirements.txt`
2. Secret gate: `git diff --cached | findstr /R "CFBD_API_KEY=[A-Za-z0-9] SUPABASE_DB_URL=postgresql://mysports_writer.ztnppejmdwmhqstqsfks:[A-Za-z0-9] R2_SECRET_ACCESS_KEY=[A-Za-z0-9]"` must print nothing. If anything prints, `git reset` and stop.
3. Confirm nothing under `assets/`, `artifacts/`, or `.env` is staged.
4. Commit with this message exactly:

```
Milestone 1: pipeline loader (bootstrap + fixture load) — first live load into mysports.*

- pipeline/db.py: psycopg connection via SUPABASE_DB_URL, upserts, --emit-sql dry-run mode
- pipeline/bootstrap.py: networks_services (+ simulcast rules, aliases), viewer_services, conferences,
  teams (778 across cfb/nfl/nhl/nba), team_territories, rivalries — idempotent
- pipeline/load.py: fixtures -> games, game_broadcasts, game_odds, team_records, venues, team stubs;
  source_snapshots + source_observations per fact; refresh_runs (spec 16); nothing deleted (spec 15.2)
- db/README.md: 0002-0005 applied 2026-09-01 (29 tables); adapters/nhl.py: nickname/location on teams,
  local-row label uses the nickname; requirements: psycopg[binary]
- workflows: schedule_refresh and bootstrap_season now call the loader
- contract v1.0.2 + .env.example: pooler host comes from Dashboard -> Connect (aws-0 answered 'tenant not found')
First live load: 250 games, 180 broadcasts, 29 odds, 430 observations from 7 fixtures
```

5. `git push origin main`; `git rev-parse HEAD` and `git rev-parse origin/main` must match. Report both.

## 7. Report
Paste the git status, the bootstrap and load console output, the verification output (both runs), the certification lines, the secret-gate result, the commit hash, and the two rev-parse hashes.
