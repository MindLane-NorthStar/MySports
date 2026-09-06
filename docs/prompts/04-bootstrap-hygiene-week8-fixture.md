You are working in the MySports repo (C:\Users\jlull\Joe's Projects\Apps - Personal\MySports), branch main, HEAD 5dd1d56. The first GitHub Actions run of `bootstrap_season` succeeded end to end (secrets, CFBD, R2, Supabase pooler, loader all proven). Cowork then wrote one hygiene stage (`artifacts/_phase4_stage_8.zip`, already unpacked): the NHL adapter now lists all 32 teams in any window through `club-schedule-season/{local team}/now` (the runner had written an empty NHL teams file in the offseason), `--all-logos` on the nhl/nba adapters, the loader's misleading `teams_stubbed` counter renamed `team_refs`, and the Actions bumped to `checkout@v5` / `setup-python@v6` (Node 24). Your job: regenerate the last old-format CFB fixture (Week 8), re-run the loader, certify the changed adapters on Windows, then commit and push. Do not modify the code unless a step fails; if one does, stop, report, and wait. Never print any value from `.env`.

## 0. Preconditions
1. `python --version`.
2. `git status --short` must show exactly: `M .github/workflows/backup_schema.yml`, `M .github/workflows/bootstrap_season.yml`, `M .github/workflows/render_all.yml`, `M .github/workflows/schedule_refresh.yml`, `M adapters/README.md`, `M adapters/nba.py`, `M adapters/nhl.py`, `M pipeline/load.py`, plus the always-untracked `assets/logos/`, `assets/network-logos/`. Paste it.
3. Delete `artifacts\_phase4_stage_8.zip`.

## 1. Regenerate the Week 8 CFB fixture (retires the last old-format fixture)
1. `python -m adapters.cfbd --week 8` — paste every console line. Expected: `CFBD_API_KEY: loaded (value intentionally hidden)`, a `fixture: N FBS-involving games -> cfbd_2026_week8_fixture.json` line (N is whatever CFBD returns; report it).
2. `findstr /C:"\"CBSSN\"" /C:"\"CW\"" /C:"\"USA Net\"" artifacts\validation\cfbd_2026_week8_fixture.json` must print nothing (outlet names now come through the alias table as `CBS Sports Network`, `The CW`, `USA Network`).
3. `findstr /C:"\"sport\"" artifacts\validation\cfbd_2026_week8_fixture.json | find /c /v ""` — expect at least 1 (the new fixture format carries `sport`).

## 2. Reload and verify no alias networks come back
1. `python -m pipeline.load --all --workflow claude-code` — paste the TOTAL line. Expected shape: `games … · broadcasts … · odds … · records 0 · observations … · team_refs … · venues … · run_id 5 · committed` (note the renamed counter; a traceback is a stop).
2. Run exactly:
```
python -c "import os,psycopg;from adapters.common import find_repo_root,load_dotenv;load_dotenv(find_repo_root()/'.env');c=psycopg.connect(os.environ['SUPABASE_DB_URL']);cur=c.cursor();cur.execute(\"set search_path=mysports\");[print(t,cur.execute(f'select count(*) from {t}').fetchone()[0]) for t in ('teams','conferences','networks_services','games','game_broadcasts','game_odds','refresh_runs')];cur.execute(\"select id from networks_services where id in ('cbssn','cw','the-cw-network','usa-net')\");print('alias networks:',cur.fetchall());cur.execute(\"select workflow,status,games_checked from refresh_runs order by run_id desc limit 1\");print(cur.fetchone())"
```
Expected: teams 778, conferences 77, networks_services 44, `alias networks: []`, games 237 or a little more if Week 8 changed, last run `claude-code succeeded N`.

## 3. Windows certification of the changed adapters
1. `python -m adapters.nhl --date 2026-09-01 --all-logos` — expect `nhl teams: 32 -> artifacts/validation/nhl_2026_teams.json`, the postal-lookup line, `fixture: 0 games (2026-09-01, … 2026-09-07)`, and `logos: {'ok': 0, 'cached': 32, 'error': 0, 'no-url': 0}`. No `warn: club-schedule-season` line.
2. `python -m adapters.nhl --date 2026-10-01` then `python scripts/render_day.py --sport nhl --date 2026-10-01` — expect `v1.6 [nhl]: 3 on grid · 0 TBA · 5 omitted` (unchanged from Milestone 1).
3. `python -m adapters.nba --date 2026-09-01 --all-logos` — expect `nba teams: 30`, `fixture: 0 games`, and logos `ok 6 · cached 24` (six teams were not in the October 28 slate) or `cached 30` if they were already present.
4. `python -m adapters.nba --date 2026-10-28` then `python scripts/render_day.py --sport nba --date 2026-10-28` — paste the last line; expect the same counts as the Milestone 1 render of that date.
Report: no traceback, no UnicodeEncodeError, no strftime error across every command.

## 4. Commit and push
1. Stage exactly: `git add .github/workflows/backup_schema.yml .github/workflows/bootstrap_season.yml .github/workflows/render_all.yml .github/workflows/schedule_refresh.yml adapters/README.md adapters/nba.py adapters/nhl.py pipeline/load.py`
2. Secret gate: `git diff --cached | findstr /R "CFBD_API_KEY=[A-Za-z0-9] SUPABASE_DB_URL=postgresql://mysports_writer.ztnppejmdwmhqstqsfks:[A-Za-z0-9] R2_SECRET_ACCESS_KEY=[A-Za-z0-9]"` must print nothing. If anything prints, `git reset` and stop.
3. Confirm nothing under `assets/`, `artifacts/`, or `.env` is staged.
4. Commit with this message exactly:

```
Phase 4 hygiene after the first bootstrap_season run: NHL offseason team directory, --all-logos, loader counter, Actions on Node 24

- adapters/nhl.py: all 32 teams from club-schedule-season/{local team}/now in any window (the runner had
  written an empty teams file in the offseason: conferences 73, teams 746, territories 2); --all-logos
- adapters/nba.py: --all-logos; adapters/README.md: nba row + flag
- pipeline/load.py: teams_stubbed -> team_refs (it counts FK-safety upserts, not new rows)
- workflows: bootstrap_season passes --all-logos to nhl/nba; checkout@v5 + setup-python@v6 (Node 20 deprecation)
- Week 8 CFB fixture regenerated with adapters.cfbd (last old-format fixture retired); loader re-run, no alias networks
```

5. `git push origin main`; `git rev-parse HEAD` and `git rev-parse origin/main` must match. Report both.

## 5. Report
Paste the git status, the Week 8 adapter output, the two findstr results, the TOTAL line, the verification output, the certification lines, the secret-gate result, the commit hash, and the two rev-parse hashes.
