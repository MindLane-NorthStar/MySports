You are working in the MySports repo (C:\Users\jlull\Joe's Projects\Apps - Personal\MySports), branch main, HEAD b69f4f8. Prompt 5 stopped at Section 4 on `could not determine data type of parameter $1` — your diagnosis was exactly right (reconcile.py line 190, bare `%s is not null` with no type context; the offline dry run interpolates literals so binding was never exercised). Cowork fixed it by splitting the statement so every placeholder gets column type context (no casts), and shipped one more stage (`artifacts/_phase4_stage_10.zip`, already unpacked) that also carries the Cavaliers-on-DAZN update (product decision 7: DAZN carries every Cavs game not nationally exclusive, RESN production, 15 OTA simulcasts on WUAB 43, Joe subscribes so DAZN models as available). Migration 0006 stays applied — do not re-apply it; Cowork recorded `mysports_0006_reconciliation` in the Supabase migration history. Your job: resume the Milestone 2 go-live where prompt 5 stopped, commit it, then regenerate the NBA fixtures live so the DAZN transition flows through the loader and reconciler, verify, and commit the Cavs change separately. Two commits, one push each. Do not modify the code unless a step fails; if one does, stop, report, and wait. Never print any value from `.env`.

## 0. Preconditions
1. `git status --short` must show exactly these modified: `.github/workflows/bootstrap_season.yml`, `.github/workflows/schedule_refresh.yml`, `MYSPORTS_BUILD_SPEC_v0.4.md`, `adapters/common.py`, `adapters/nba.py`, `data/access_profile.json`, `data/local_rights.json`, `data/row_order.json`, `db/README.md`, `docs/research/research-changelog.md`, `pipeline/bootstrap.py`, `pipeline/load.py`, `scripts/sync_assets.py`; and these untracked: `data/authority_rules.json`, `db/migrations/0006_reconciliation.sql`, `pipeline/reconcile.py`, `pipeline/resolver.py`, `scripts/apply_migration.py`, `scripts/backup_table.py`, `scripts/make_lockups.py`, `tests/`, plus the always-untracked `assets/brand/`, `assets/logos/`, `assets/network-logos/`. Paste it.
2. Delete `artifacts\_phase4_stage_10.zip`.
3. `python -m unittest tests.test_reconcile` — expect `Ran 19 tests` … `OK`.
4. `findstr /N /C:"is_primary = false" pipeline\reconcile.py` — expect exactly one hit (the fix). The old `(%s is not null and service_id = %s)` shape must be gone: `findstr /C:"is not null and service_id" pipeline\reconcile.py` prints nothing.

## 1. Resume Milestone 2 go-live — first live reconciliation (every game)
`python -m pipeline.reconcile --all --workflow claude-code` — paste the summary line and the `log:` line, then the first 40 lines of the log file. Expected (matches your offline run exactly): `reconciled 237 game(s) under authority_rules_v1`, `changes 28`, `kickoff_at:no_change 237`, `primary_network:accepted 28`, `primary_network:no_change 209`, `eligible 120`, `not_eligible 117`, no conflicts, `run_id 10` or thereabouts, `committed`.

## 2. Verify
```
python -c "import os,psycopg;from adapters.common import find_repo_root,load_dotenv;load_dotenv(find_repo_root()/'.env');c=psycopg.connect(os.environ['SUPABASE_DB_URL']);cur=c.cursor();cur.execute(\"set search_path=mysports\");[print(t,cur.execute(f'select count(*) from {t}').fetchone()[0]) for t in ('canonical_decisions','canonical_change_history','viewer_game_eligibility')];cur.execute(\"select canonical_state, count(*) from games group by 1 order by 1\");print('states',cur.fetchall());cur.execute(\"select rights_controller_type, count(*) from games group by 1 order by 1\");print('rights',cur.fetchall());cur.execute(\"select id,primary_network_id,network_certainty,network_status,canonical_state from games where id in ('nhl-2026020011','nba-401909882','nfl-401872922','401862696')\");print(cur.fetchall());cur.execute(\"select eligible, count(*) from viewer_game_eligibility group by 1\");print('eligibility',cur.fetchall());cur.execute(\"select workflow,status,games_checked,games_changed,conflicts_found from refresh_runs order by run_id desc limit 1\");print(cur.fetchone())"
```
Paste the output. Expected: canonical_decisions 474, change_history 28, eligibility 237; the four sample games: `cbj-local/tbd`, `cavs-local/tbd` (DAZN comes in Section 4), `cbs/definite`, `cbs-sports-network/definite`, all `fully_assigned`; rights: cfb `conference`/`independent_school`, pro `league`; eligibility true 120 / false 117; last run `claude-code succeeded 237 28 0`.

## 3. Idempotency, then commit Milestone 2
1. `python -m pipeline.reconcile --workflow claude-code` (default new-evidence mode) — expect `reconciled 0 game(s)`.
2. `python -m pipeline.reconcile --all --workflow claude-code` — expect zero `changes`, `kickoff_at:no_change 237`, `primary_network:no_change 237`; canonical_decisions then 948, change_history still 28.
3. Stage exactly: `git add .github/workflows/bootstrap_season.yml .github/workflows/schedule_refresh.yml data/authority_rules.json db/README.md db/migrations/0006_reconciliation.sql pipeline/load.py pipeline/reconcile.py pipeline/resolver.py scripts/apply_migration.py scripts/backup_table.py tests`
4. Secret gate: `git diff --cached | findstr /R "CFBD_API_KEY=[A-Za-z0-9] SUPABASE_DB_URL=postgresql://mysports_writer.ztnppejmdwmhqstqsfks:[A-Za-z0-9] R2_SECRET_ACCESS_KEY=[A-Za-z0-9]"` must print nothing. Confirm nothing under `assets/`, `artifacts/`, or `.env` is staged.
5. Commit with this message exactly:

```
Milestone 2: observation + reconciliation engine (spec 6.1, 7.10-7.11, 9, 10, 16)

- data/authority_rules.json (authority_rules_v1): per-field role order, rights context, staleness horizons, certainty precedence
- pipeline/resolver.py: pure spec-9.6 resolver (roles, rights-scope demotion, same-source supersession, staleness,
  newest-explicit-publication then definite-over-tentative, conflicts -> last-known-good or authority_conflict, no voting)
- pipeline/reconcile.py: sole writer of games.canonical_* / primary_network_id / canonical_state / rights_*, canonical_decisions
  (every evaluation), canonical_change_history (changes only), game_broadcasts.is_primary, viewer_game_eligibility (spec 10),
  refresh_runs; --all / --game / default new-evidence mode; --export/--input offline dry run. Fix after first live run:
  bare '%s is not null' has no type context for the server - statement split so every placeholder is typed by its column
- pipeline/load.py: evidence only (no canonical columns); repeated claims bump last_seen_at/seen_count, changed claims
  supersede (valid_to), withdrawn broadcast rows close and game_broadcasts.active flips; outlet claims belong to the feed,
  market judgments are local_carriage claims
- db/migrations/0006_reconciliation.sql (applied 2026-09-01, backed up first): last_seen_at/seen_count, sources.rights_scope,
  game_broadcasts.active, duplicate collapse 1914 -> 408 (seen_count preserves the count), supersession, re-attribution
- tests/test_reconcile.py: 19 spec-19 fixtures incl. Toledo at Michigan State, no-voting, conflicts, staleness, determinism
- workflows: reconcile after the loader (schedule_refresh: new evidence + unit tests; bootstrap_season: --all)
First live reconciliation: 237 games, 474 decisions, 28 canonical changes, 0 conflicts
```

6. `git push origin main`; `git rev-parse HEAD` and `git rev-parse origin/main` must match. Report both.

## 4. Cavaliers on DAZN — regenerate, load, reconcile (decision 7 flows through the engine)
1. `python -m adapters.nba --date 2026-10-25` then `python -m adapters.nba --date 2026-10-28` — paste the last lines of each. In the 10-28 fixture the WAS @ CLE game must carry `DAZN web local AVAILABLE` with label `Cavaliers on DAZN (RESN)` and no `CAVS LOCAL` row: `findstr /C:"CAVS LOCAL" artifacts\validation\nba_2026_2026-10-28_fixture.json` prints nothing; `findstr /C:"\"DAZN\"" artifacts\validation\nba_2026_2026-10-28_fixture.json | find /c /v ""` prints at least 1.
2. `python -m pipeline.load --all --workflow claude-code` — paste the TOTAL line. Expected: `observations 1` or `2` (the new DAZN claim), `observations_closed 1` (the withdrawn cavs-local claim), `broadcasts 181` processed, `committed`.
3. `python -m pipeline.reconcile --workflow claude-code` (default mode — only games with new evidence) — paste the summary and the log lines. Expected: a small game count (the touched NBA games), including `CHANGE nba-401909882 primary_network: cavs-local (tbd) -> dazn (definite)`.
4. Verify:
```
python -c "import os,psycopg;from adapters.common import find_repo_root,load_dotenv;load_dotenv(find_repo_root()/'.env');c=psycopg.connect(os.environ['SUPABASE_DB_URL']);cur=c.cursor();cur.execute(\"set search_path=mysports\");cur.execute(\"select primary_network_id,network_certainty,network_status,canonical_state from games where id='nba-401909882'\");print('game',cur.fetchone());cur.execute(\"select service_id,active,is_primary from game_broadcasts where game_id='nba-401909882' order by service_id\");print('broadcasts',cur.fetchall());cur.execute(\"select old_value,new_value,decision_reason from canonical_change_history where game_id='nba-401909882' and field_name='primary_network' order by id desc limit 1\");print('history',cur.fetchone());cur.execute(\"select eligible,eligible_via_service_ids,reason from viewer_game_eligibility where game_id='nba-401909882'\");print('eligibility',cur.fetchone());cur.execute(\"select id,canonical_name,type::text from networks_services where id in ('dazn','wuab-43')\");print('networks',cur.fetchall())"
```
Expected: game `('dazn', 'definite', 'assigned', 'fully_assigned')` (the winning DAZN row is the local feed, market local, so it is not stream_exclusive-flagged — report what you see if it differs); broadcasts show `cavs-local` with `active False, is_primary False` and `dazn` with `active True, is_primary True`; history `cavs-local -> dazn`; eligibility True via dazn; both networks present.
5. Windows certification: `python scripts/render_day.py --sport nba --date 2026-10-28` — expect `v1.6 [nba]: 3 on grid · 0 TBA · 9 omitted` and `findstr /C:"CARRIER TBA" artifacts\rendering\nba\grid_2026-10-28.svg` prints nothing. No traceback, no UnicodeEncodeError, no strftime error.
6. Push the new marks and brand sources to R2: `python scripts/sync_assets.py --push` — expect roughly `pushed 10 file(s)` (2 rail marks + 8 brand sources); paste the summary lines.

## 5. Commit the Cavs change
1. Stage exactly: `git add MYSPORTS_BUILD_SPEC_v0.4.md adapters/common.py adapters/nba.py data/access_profile.json data/local_rights.json data/row_order.json docs/research/research-changelog.md pipeline/bootstrap.py scripts/make_lockups.py scripts/sync_assets.py`
2. Secret gate again (same command) — must print nothing. Confirm nothing under `assets/`, `artifacts/`, or `.env` is staged.
3. Commit with this message exactly:

```
Cavaliers on DAZN (product decision 7): RESN production, WUAB 43 simulcasts, rail-tile lockups

- data/local_rights.json: nba.CLE CONFIRMED -> outlet DAZN, surface web, label "Cavaliers on DAZN (RESN)";
  simulcasts block for WUAB 43 (15 games/season, announced in-season, hand-entered by ET date + opponent)
- data/access_profile.json: DAZN and WUAB 43 available (Joe subscribes - Apple TV pattern, decision 4)
- data/row_order.json: nba - DAZN heads the streaming lanes, WUAB 43 joins the broadcast rail (no station keys:
  the Cleveland's 43 mark identifies the station, call-letters band suppressed); WOIO 19 -> WUAB 43 -> WBNX 55 rule
- adapters/nba.py: CONFIRMED-carrier local row + hand-entered simulcast rows in both sources; adapters/common.py +
  pipeline/bootstrap.py: WUAB/Cleveland's 43/DAZN aliases
- scripts/make_lockups.py: composes the rail marks (RESN | DAZN; Cleveland's 43 over equal-width RESN | DAZN) from
  assets/brand sources - layouts approved against true-size tile previews; sync_assets now syncs brand/
- spec 7.23 decision 7 registered; research changelog entry (team press release 2026-09-01)
Live transition proven through Milestone 2: canonical_change_history records cavs-local -> dazn
```

4. `git push origin main`; `git rev-parse HEAD` and `git rev-parse origin/main` must match. Report both hashes.

## 6. Report
Paste the git status, the reconcile summary + log excerpts (Sections 1 and 4.3), the two verification outputs, the idempotency lines, the render line, the sync_assets summary, both secret-gate results, both commit hashes, and the final rev-parse pair.
