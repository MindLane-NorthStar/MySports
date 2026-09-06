You are working in the MySports repo (C:\Users\jlull\Joe's Projects\Apps - Personal\MySports), branch main, HEAD b69f4f8. Cowork wrote Milestone 2 (reconciliation engine: `data/authority_rules.json`, `pipeline/resolver.py`, `pipeline/reconcile.py`, a rewritten evidence path in `pipeline/load.py`, `tests/test_reconcile.py`, migration `db/migrations/0006_reconciliation.sql`, two helper scripts, two workflow edits) and dry-ran both the migration and a 10-game reconciliation against the live schema in rolled-back transactions (`artifacts/_phase4_stage_9.zip`, already unpacked). Joe has approved applying 0006. Your job, in order: run the unit tests on Windows, back up the tables 0006 rewrites, apply 0006, run the loader (now evidence-only) and the first live reconciliation, verify, prove idempotency, commit, push. Do not modify the code unless a step fails; if one does, stop, report, and wait. Never print any value from `.env`.

## 0. Preconditions
1. `python --version`.
2. `git status --short` must show exactly: `M .github/workflows/bootstrap_season.yml`, `M .github/workflows/schedule_refresh.yml`, `M db/README.md`, `M pipeline/load.py`, `?? data/authority_rules.json`, `?? db/migrations/0006_reconciliation.sql`, `?? pipeline/reconcile.py`, `?? pipeline/resolver.py`, `?? scripts/apply_migration.py`, `?? scripts/backup_table.py`, `?? tests/`, plus the always-untracked `assets/logos/`, `assets/network-logos/`. Paste it.
3. Delete `artifacts\_phase4_stage_9.zip`.
4. `python -m unittest tests.test_reconcile -v` — paste the last three lines. Expected `Ran 19 tests` … `OK`. Any failure is a stop.

## 1. Backup (deployment contract §6 — 0006 rewrites source_observations)
`python scripts\backup_table.py source_observations game_broadcasts games` — paste the three lines. Expected `source_observations: 1914 rows`, `game_broadcasts: 161 rows`, `games: 237 rows`, each `-> artifacts/backups/<table>_<stamp>.csv`. (`artifacts/` is untracked; the CSVs stay local.)

## 2. Apply migration 0006
1. `python scripts\apply_migration.py db\migrations\0006_reconciliation.sql --dry-run` — expect `0006_reconciliation.sql: executed and ROLLED BACK (dry run)`.
2. `python scripts\apply_migration.py db\migrations\0006_reconciliation.sql` — expect `0006_reconciliation.sql: applied and committed`.
3. Verify (read-only, counts only):
```
python -c "import os,psycopg;from adapters.common import find_repo_root,load_dotenv;load_dotenv(find_repo_root()/'.env');c=psycopg.connect(os.environ['SUPABASE_DB_URL']);cur=c.cursor();cur.execute(\"set search_path=mysports\");cur.execute(\"select count(*), count(*) filter (where valid_to is null), sum(seen_count) from source_observations\");print('observations total/open/seen_sum',cur.fetchone());cur.execute(\"select count(*) from source_observations where field_name='broadcast' and valid_to is not null\");print('closed broadcast claims',cur.fetchone()[0]);cur.execute(\"select count(*) from game_broadcasts where not active\");print('inactive broadcast rows',cur.fetchone()[0]);cur.execute(\"select count(*) from information_schema.columns where table_schema='mysports' and ((table_name='source_observations' and column_name in ('last_seen_at','seen_count')) or (table_name='sources' and column_name='rights_scope') or (table_name='game_broadcasts' and column_name='active'))\");print('new columns',cur.fetchone()[0])"
```
Expected: `observations total/open/seen_sum (408, 398, 1914)`, `closed broadcast claims 10`, `inactive broadcast rows 0`, `new columns 4`. If the first tuple differs, stop and report (it means data changed since Cowork's dry run — not necessarily wrong, but I want to see it).

## 3. Loader regression (evidence only now)
`python -m pipeline.load --all --workflow claude-code` — paste every line. Expected: the per-fixture lines show `observations` near 0 and `observations_seen` in the hundreds (every repeated claim is a bump, not a row); a handful of new rows are the `local_carriage` claims the NFL fixtures now emit for Cleveland's market judgments; `observations_closed 0`; `run_id 8 · committed`. A traceback is a stop.

## 4. First live reconciliation (every game)
`python -m pipeline.reconcile --all --workflow claude-code` — paste the summary line and the `log:` line, then paste the first 40 lines of the log file it names (`artifacts/reconcile/reconcile_<stamp>.md`). Expected: `reconciled 237 game(s) under authority_rules_v1`, `kickoff_at:no_change 237`, `conflicts` absent (zero), `primary_network:accepted` for a few dozen games (the ones Milestone 1 left without a primary because the outlet was not receivable, e.g. CBS Sports Network / MW+ / unverified regional CBS, plus the two local-TBA rows whose certainty moves from definite to tbd), the rest `primary_network:no_change`; `eligible` + `not_eligible` = 237.

## 5. Verify
```
python -c "import os,psycopg;from adapters.common import find_repo_root,load_dotenv;load_dotenv(find_repo_root()/'.env');c=psycopg.connect(os.environ['SUPABASE_DB_URL']);cur=c.cursor();cur.execute(\"set search_path=mysports\");[print(t,cur.execute(f'select count(*) from {t}').fetchone()[0]) for t in ('canonical_decisions','canonical_change_history','viewer_game_eligibility')];cur.execute(\"select canonical_state, count(*) from games group by 1 order by 1\");print('states',cur.fetchall());cur.execute(\"select rights_controller_type, count(*) from games group by 1 order by 1\");print('rights',cur.fetchall());cur.execute(\"select count(*) from games where primary_network_id is null\");print('no primary',cur.fetchone()[0]);cur.execute(\"select id,primary_network_id,network_certainty,network_status,canonical_state from games where id in ('nhl-2026020011','nba-401909882','nfl-401872922','401862696')\");print(cur.fetchall());cur.execute(\"select eligible, count(*) from viewer_game_eligibility group by 1\");print('eligibility',cur.fetchall());cur.execute(\"select workflow,status,games_checked,games_changed,conflicts_found from refresh_runs order by run_id desc limit 1\");print(cur.fetchone())"
```
Paste the output. Expected: canonical_decisions 474 (2 per game), change_history = the `changes` count from step 4, eligibility 237; the four sample games read `cbj-local/tbd/assigned`, `cavs-local/tbd/assigned`, `cbs/definite/assigned`, `cbs-sports-network/definite/assigned`, all `fully_assigned`; rights: cfb games `conference` (plus `independent_school` for any Notre Dame/UConn home game), pro games `league`; last run `claude-code succeeded 237 <changes> 0`.

## 6. Idempotency (Milestone 2 acceptance: repeatable results)
1. `python -m pipeline.reconcile --workflow claude-code` (default mode = games with evidence newer than their last decision) — expect `reconciled 0 game(s)`.
2. `python -m pipeline.reconcile --all --workflow claude-code` — expect `changes` absent (zero), `kickoff_at:no_change 237`, `primary_network:no_change 237`; then re-run the step-5 command and confirm canonical_decisions 948, change_history unchanged, eligibility 237.

## 7. Commit and push
1. Stage exactly: `git add .github/workflows/bootstrap_season.yml .github/workflows/schedule_refresh.yml data/authority_rules.json db/README.md db/migrations/0006_reconciliation.sql pipeline/load.py pipeline/reconcile.py pipeline/resolver.py scripts/apply_migration.py scripts/backup_table.py tests`
2. Secret gate: `git diff --cached | findstr /R "CFBD_API_KEY=[A-Za-z0-9] SUPABASE_DB_URL=postgresql://mysports_writer.ztnppejmdwmhqstqsfks:[A-Za-z0-9] R2_SECRET_ACCESS_KEY=[A-Za-z0-9]"` must print nothing. If anything prints, `git reset` and stop.
3. Confirm nothing under `assets/`, `artifacts/`, or `.env` is staged.
4. Commit with this message exactly:

```
Milestone 2: observation + reconciliation engine (spec 6.1, 7.10-7.11, 9, 10, 16)

- data/authority_rules.json (authority_rules_v1): per-field role order, rights context, staleness horizons, certainty precedence
- pipeline/resolver.py: pure spec-9.6 resolver (roles, rights-scope demotion, same-source supersession, staleness,
  newest-explicit-publication then definite-over-tentative, conflicts -> last-known-good or authority_conflict, no voting)
- pipeline/reconcile.py: sole writer of games.canonical_* / primary_network_id / canonical_state / rights_*, canonical_decisions
  (every evaluation), canonical_change_history (changes only), game_broadcasts.is_primary, viewer_game_eligibility (spec 10),
  refresh_runs games_changed/conflicts_found; --all / --game / default new-evidence mode; --export/--input offline dry run
- pipeline/load.py: evidence only (no canonical columns); repeated claims bump last_seen_at/seen_count, changed claims
  supersede (valid_to), withdrawn broadcast rows close and game_broadcasts.active flips; outlet claims belong to the feed,
  market judgments are local_carriage claims (506sports / data/local_rights)
- db/migrations/0006_reconciliation.sql (applied): last_seen_at/seen_count, sources.rights_scope, game_broadcasts.active,
  duplicate collapse 1914 -> 408 (seen_count preserves the count), same-source supersession, re-attribution
- tests/test_reconcile.py: 19 spec-19 fixtures incl. Toledo at Michigan State (FS1 over ESPNU), no-voting, conflicts,
  staleness, unknown->known, determinism; scripts/backup_table.py, scripts/apply_migration.py
- workflows: reconcile after the loader (schedule_refresh: new evidence; bootstrap_season: --all); unit tests in refresh
First live reconciliation: 237 games, 474 decisions, 0 conflicts
```

5. `git push origin main`; `git rev-parse HEAD` and `git rev-parse origin/main` must match. Report both.

## 8. Report
Paste the git status, the test result, the backup lines, the migration lines and verification tuple, the loader output, the reconcile summary + first 40 log lines, the step-5 output (both times), the idempotency lines, the secret-gate result, the commit hash, and the two rev-parse hashes.
