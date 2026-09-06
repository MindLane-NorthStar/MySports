You are working in the MySports repo (C:\Users\jlull\Joe's Projects\Apps - Personal\MySports), branch main, HEAD febed52. This prompt BUILDS Milestone 4 part 0 — the event-history foundations, per the design memo Cowork filed tonight (`claude/milestone4-part0-design-memo.md` in the project; its substance is inlined below, and where this prompt is more specific, this prompt wins). Joe's governing decisions (2026-09-01): the history archives ONE final end-of-day rendering per sport per viewing day, immutable; scores/links are app-layer overlays; box-score links are ESPN for cfb/nfl/nba (our game ids ARE ESPN ids) and league-native for nhl/mlb; raw URLs are never displayed. The reason this runs tonight: history cannot be backfilled — MLB games go final every night. Cowork has left ONE new untracked file in your tree: `db/migrations/0007_final_scores.sql` (read it first — it also grants `mysports_writer` insert on `generated_grids` and sequence usage). Design choice already made and recorded in the migration header: scores are LOADER-WRITTEN provider facts, NOT reconciled observations — the reconciler never touches these columns; do not wire them into resolver/reconcile. Never print any value from `.env`. If an acceptance check fails, stop, report, and wait.

## 0. Preconditions
1. `git status --short` shows exactly `?? db/migrations/0007_final_scores.sql` plus the always-untracked `assets/` dirs (a leftover `db_nba_*.json` under artifacts/ is fine — artifacts are untracked). Paste it.
2. `python -m unittest tests.test_reconcile` — `Ran 19 tests` … `OK`.
3. Read `db/migrations/0007_final_scores.sql` fully.

## 1. Apply migration 0007
1. Backup first: `python scripts/backup_table.py games` — paste the row count.
2. `python scripts/apply_migration.py db/migrations/0007_final_scores.sql --dry-run` — paste the verification select (expect games ~268, with_scores 0, with_status 0).
3. Apply live. Paste. Update `db/README.md`'s ledger with the 0007 entry (columns added + the generated_grids/sequence grants + the loader-written-facts design choice).

## 2. Adapter status/score emission
Every adapter adds three keys to each game dict: `status` (one of scheduled | in_progress | final | postponed | cancelled), `homeScore`, `awayScore` (ints; null when the provider reports none). Map from what the provider ACTUALLY sends — verify against the raw snapshots in `artifacts/raw/` and live calls, don't trust this table blindly, and report any mapping this prompt gets wrong:
- `espn.py` (nfl/nba): `status.type.state` pre → scheduled, in → in_progress, post + completed → final; `status.type.name` containing POSTPONED/CANCELED → postponed/cancelled; scores from competitors.
- `cfbd.py`: `completed` true + points → final with scores; else scheduled.
- `nhl.py`: `gameState` FUT/PRE → scheduled, LIVE/CRIT → in_progress, FINAL/OFF → final; scores from homeTeam/awayTeam.
- `mlb.py`: abstract state Preview → scheduled, Live → in_progress, Final → final; detailed state containing Postponed/Cancelled overrides.
**Fail-honest rule: an unrecognized state maps to null status with one console warning line — NEVER guessed to final.** Shared mapping helper in `adapters/common.py` is fine if it stays simple.

## 3. Loader
1. The games upsert writes the five new columns, null-safe: incoming null NEVER erases a stored score/status (`coalesce(excluded.x, games.x)` shape or equivalent); `completed_at = coalesce(games.completed_at, now())` only when the incoming status is final; `boxscore_url` computed once at that same first-final moment (never overwritten):
   - cfb → `https://www.espn.com/college-football/boxscore/_/gameId/{id}`
   - nfl → `https://www.espn.com/nfl/boxscore/_/gameId/{id minus 'nfl-'}`
   - nba → `https://www.espn.com/nba/boxscore/_/gameId/{id minus 'nba-'}`
   - nhl → `https://www.nhl.com/gamecenter/{id minus 'nhl-'}`
   - mlb → `https://www.mlb.com/gameday/{id minus 'mlb-'}`
2. Prompt-9 cosmetic fix: the mysports-db skip path returns a ZEROED counters dict (same keys as a normal load) instead of `{}`, so a direct load prints `TOTAL: games 0 · …` explicitly.

## 4. Renderer determinism + sidecar
1. `scripts/render_day.py` builds SVG gradient/clip ids from Python `id(g)` (memory addresses — different every process) at these sites: lines ~675 (`scap`), ~691–692 (`stg`), ~767 (`cap`), ~801–803 (`tg`), ~912 (`fd`). Replace `id(g)` with the game's own fixture id sanitized to `[A-Za-z0-9_-]` (e.g. `cap{gkey}_{cap_i}`). Grep for any other `id(` used in an SVG id and fix those too. Visuals must not change.
2. `render_day.py` additionally writes a sidecar `grid_{date}.meta.json` next to each SVG (`encoding=`, ASCII): `{"sport", "date", "season", "week", "gamesOnGrid", "gamesTbd", "gamesOmitted", "generatorVersion"}` — truthful counts from the run, generator version = the `v1.6`-style tag it prints.
3. Add a contract §12 entry `v1.6.1` in `docs/rendering-contract.md`: deterministic ids (render hash now stable), sidecar meta files; archived grid BYTES change once, visuals identical.

## 5. `scripts/register_grids.py` (new)
CLI: `python scripts/register_grids.py artifacts/rendering [--workflow claude-code]`. Scans `{dir}/{sport}/grid_*.svg` (and the legacy flat `{dir}/grid_*.svg` as cfb), plus matching `.png`/`@2x.png`. For each SVG: `render_hash` = sha256 of the SVG bytes; sport/date parsed from the path; counts/season/week from the sidecar when present (nulls when absent — legacy grids); `svg_asset_url`/`png_asset_url`/`png2x_asset_url` built with the SAME `grids/{sport}/{name}` key scheme `scripts/sync_assets.py --push-grids` uses, prefixed by the public assets base (read how sync_assets/render_day resolve `ASSET_BASE_URL` and reuse that; if no base is configured, store the bare key and note it). Insert into `generated_grids` via `pipeline.db.DB` with `on conflict (sport, game_date, render_hash) do nothing` — idempotent by construction; `generator_version` from the sidecar or `'unknown'`. Console: one line per file `registered|already` + a TOTAL. Windows-portable, ASCII, `encoding=` everywhere, never print the DSN.

## 6. Workflows
1. `render_all.yml`: replace the trailing Milestone-2/4 placeholder comment with a real step after the R2 push: `python scripts/register_grids.py artifacts/rendering --workflow actions`.
2. `schedule_refresh.yml`: finals pass — each pro sport's step also fetches YESTERDAY's viewing day (one extra `--date` call before today's), and cfb re-fetches the newest loaded week on Sunday and Monday runs (mirror the existing cfb step's week logic; keep it simple). Loads then pick the finals up automatically.
3. All YAML parses.

## 7. Live acceptance
1. `python -m adapters.mlb --date 2026-08-31` — a fully completed day. The fixture's games carry `status: "final"` with integer scores. Paste 3 game lines.
2. `python -m pipeline.load --all --workflow claude-code` then verify via psycopg: for mlb viewing_day 2026-08-31 games — `home_score`, `away_score`, `result_status='final'`, `completed_at` not null, `boxscore_url` like `https://www.mlb.com/gameday/%`. Paste 3 rows. Then HTTP-check ONE of those URLs (GET, follow redirects, read nothing but the status code) — expect 200.
3. `python -m adapters.mlb --date 2026-09-01` (tonight, mixed) — paste the status distribution; nothing unrecognized guessed to final.
4. Null-safety: reload the same 2026-08-31 fixture — scores/status/completed_at/boxscore_url unchanged (paste one row before/after); a game whose incoming status is null keeps its stored final.
5. Upcoming-date sanity: `python -m adapters.nhl --date 2026-10-01` and one nfl fetch — status `scheduled`, scores null end-to-end.
6. Determinism: render mlb 2026-09-04 twice (copy the first SVG aside) — `fc /b` byte-identical. Sidecar meta files exist with truthful counts.
7. `python scripts/register_grids.py artifacts/rendering --workflow claude-code` — paste the console; then run it AGAIN — second run registers 0 (all `already`). Verify via psycopg: `select sport, game_date, left(render_hash,12), games_on_grid, generator_version from generated_grids order by id` — paste.
8. Direct-load skip line check: `python -m pipeline.load --fixture artifacts/validation/db_nba_2026_2026-10-28_fixture.json` (the file is on disk from prompt 9) — TOTAL now prints `games 0 · broadcasts 0 · …` explicitly.
9. `python -m unittest tests.test_reconcile` — still 19 OK. `python -m pipeline.reconcile --workflow claude-code` — `reconciled 0 game(s)` (scores must not wake the reconciler).

## 8. Commit and push
1. Stage exactly: `git add db/migrations/0007_final_scores.sql db/README.md adapters/common.py adapters/cfbd.py adapters/espn.py adapters/nhl.py adapters/nba.py adapters/mlb.py pipeline/load.py scripts/render_day.py scripts/register_grids.py docs/rendering-contract.md .github/workflows/render_all.yml .github/workflows/schedule_refresh.yml` (drop any adapter you truly didn't touch).
2. Secret gate: `git diff --cached | findstr /R "CFBD_API_KEY=[A-Za-z0-9] SUPABASE_DB_URL=postgresql://mysports_writer.ztnppejmdwmhqstqsfks:[A-Za-z0-9] R2_SECRET_ACCESS_KEY=[A-Za-z0-9]"` prints nothing; nothing under `assets/`, `artifacts/`, or `.env` staged.
3. Commit message (fill the bracketed count):

```
Milestone 4 part 0: event-history foundations - final scores, deterministic renders, grid archive registry

- db 0007: games gains home_score/away_score/result_status/boxscore_url/completed_at (nullable, checked);
  scores are loader-written provider facts, deliberately NOT reconciled observations (one objective source
  per sport); generated_grids insert + sequence grants for mysports_writer
- adapters emit status/homeScore/awayScore (provider-mapped; unrecognized states -> null + warning, never
  guessed final); loader writes null-safe, sets completed_at once, computes boxscore_url at first final
  (ESPN for cfb/nfl/nba, nhl.com/gamecenter + mlb.com/gameday for nhl/mlb - Joe 2026-09-01)
- render_day: SVG ids from game ids, not id() - renders byte-deterministic across processes (contract v1.6.1);
  sidecar grid_{date}.meta.json per render
- scripts/register_grids.py: sha256 render_hash, idempotent generated_grids upsert; render_all registers after
  the R2 push; schedule_refresh gains the finals pass (yesterday per pro sport; cfb week refetch Sun/Mon)
- load.py: mysports-db skip prints explicit zeroed TOTAL
Acceptance: MLB 2026-08-31 [n] finals with scores + verified gameday link (HTTP 200); null-safe reload proven;
double-render byte-identical; register_grids idempotent; reconcile untouched by scores (0 games)
```

4. `git push origin main`; `git rev-parse HEAD` == `git rev-parse origin/main`. Report both.

## 9. Report
Paste: git status, backup count, dry-run + live migration output, the acceptance consoles (7.1–7.9), the secret gate, commit hash, rev-parse pair. One line per judgment call, and name any provider status value you observed that this prompt's mapping table missed.
