You are working in the MySports repo (C:\Users\jlull\Joe's Projects\Apps - Personal\MySports), branch main, HEAD 8708817. Milestones 1–2 are live: the `mysports` schema holds 237 reconciled games with active broadcasts, odds, and eligibility, and `bootstrap_season` verified zero drift between your machine and the Actions runner. This prompt BEGINS MILESTONE 3, part 1: the renderer reads the DATABASE instead of the adapter fixture files (spec §18 Milestone 3 note). Unlike prior prompts, you are BUILDING new code here, not just certifying — the acceptance gate is that a DB-fed render must match the fixture-fed render of the same day, so you cannot silently get it wrong. The multi-sport day layout (§11.9) is explicitly OUT of scope — design pending with Joe. Cowork shipped `artifacts/_phase4_stage_11.zip` (already unpacked): one modified file, `pipeline/reconcile.py`, whose CHANGED_WHERE no longer includes `last_seen_at` (a repeat sighting bumps it on every load but cannot change a decision — including it made default mode evaluate all 237 games after every load); it commits with your work. Never print any value from `.env`. If an acceptance check fails, stop, report, and wait — do not loosen the check.

## 0. Preconditions
1. `git status --short` must show exactly `M pipeline/reconcile.py` plus the always-untracked `assets/brand/`, `assets/logos/`, `assets/network-logos/`. Paste it. Delete `artifacts\_phase4_stage_11.zip`.
2. `python -m unittest tests.test_reconcile` — expect `Ran 19 tests` … `OK`.
3. Certify the CHANGED_WHERE fix live: `python -m pipeline.load --all --workflow claude-code` (bumps only — expect `observations 0 · observations_closed 0` in the TOTAL), then `python -m pipeline.reconcile --workflow claude-code` — expect **`reconciled 0 game(s)`**. That line is the proof; before the fix it evaluated 237.

## 1. Build `pipeline/render_feed.py` — a viewing day from mysports.* in the adapter fixture shape
New module, same conventions as the rest of `pipeline/` (connect through `pipeline.db.DB`, never print the DSN, `encoding=` on every open(), no `%-` strftime, ASCII console). CLI:

```
python -m pipeline.render_feed --sport nhl --date 2026-10-01          # pro: one viewing day
python -m pipeline.render_feed --sport cfb --week 1 --year 2026       # cfb: one week
```

Writes `artifacts/validation/db_{sport}_{year}_{date}_fixture.json` (cfb: `db_cfbd_{year}_week{N}_fixture.json`) in the EXACT fixture structure the adapters emit — `{"validation": {...}, "games": [...]}` per the schema documented in `adapters/common.py` and visible in any `artifacts/validation/*_fixture.json`. Copy an existing fixture's key set; the renderer is the referee. Mapping, table by table:

- **games**: rows where `sport = S` and (`viewing_day = date` | cfb: `week = N and season = year`). `id` (strip nothing — fixture ids already match), `season`, `week`, `startDate` = `canonical_kickoff_at_utc` as ISO-8601 UTC (`...Z` or `+00:00` — match what `adapters.common.parse_iso` accepts), `startTimeET` via `adapters.common.et_display`, `startTimeTBD` = (`kickoff_certainty = 'tbd'`), `neutralSite` = `neutral_site`, `venue` = joined `venues.name` (null-safe).
- **home/away**: join `teams` twice. `id` = team id, `team` = `short_name`, `teamFull` = `canonical_name`, `location` = `location`, `abbreviation` = `abbreviation`, `conference` = joined `conferences.name` for cfb else null, `classification` = sport.
- **media**: `game_broadcasts` where `active`. `outlet` = joined `networks_services.canonical_name`, `mediaType` = `'web'` if `delivery_surface = 'STREAMING'` else `'tv'`, `market` = `'local'` if `feed_side in ('HOME','AWAY')` else (`'regional'` if `market_id is not null` else `'national'`), `access` = access_status mapped back to adapter vocabulary: available→AVAILABLE, unavailable→UNAVAILABLE, unknown→UNKNOWN, conditional→CONDITIONAL/VERIFY, out_of_market→OUT_OF_MARKET, unverified→UNVERIFIED, `carriageCertainty` = `carriage_certainty`, `label` = `label`, `isStartTimeTBD` = the game's TBD flag, `startTime` = the game's startDate, `source` = `'mysports-db'`.
- **odds**: newest `game_odds` row per game → `{"provider", "spread", "overUnder": total, "moneylineHome", "moneylineAway", "fetchedAt"}`; omit when none.
- **records**: newest `team_records` per team/season → `{"home": "W-L", "away": "W-L"}`; omit when none (the table is empty today — preseason).
- **validation envelope**: mirror an adapter fixture's keys; `source = "mysports-db"`, plus `sport`, `year`/`season`, `dayFilter`/`week`, `generatedAt` (UTC now), and for pro sports the `window`/`localTeams` keys the renderer reads (copy from a real fixture; if a key is only cosmetic in the footer, keep it truthful: this data came from the database).
- Console: one line per run — `db feed: {n} games -> {path}` plus per-day counts like the adapters print. Ordering: sort games by (startDate, id) and media rows by (market, outlet) so output is deterministic run to run.

## 2. Acceptance — DB render must match fixture render (this is the Milestone 3 gate)
For each of these four, render BOTH ways and compare the `v1.6 [...]` count line; all four must match exactly:

| Case | Fixture render (already known good) | DB render |
|---|---|---|
| NHL Oct 1 | `python scripts/render_day.py --sport nhl --date 2026-10-01` → `3 on grid · 0 TBA · 5 omitted` | same + `--fixture artifacts/validation/db_nhl_2026_2026-10-01_fixture.json` |
| NBA Oct 28 | `--sport nba --date 2026-10-28` → `3 on grid · 0 TBA · 9 omitted` | same + `--fixture artifacts/validation/db_nba_2026_2026-10-28_fixture.json` |
| NFL Sept 13 | `--sport nfl --date 2026-09-13` → `2 on grid · 0 TBA · 11 omitted` | same + `--fixture .../db_nfl_2026_2026-09-13_fixture.json` |
| CFB Week 1 Sept 5 | `--week 1 --date 2026-09-05` (default enrichment) → paste its counts | same + `--fixture .../db_cfbd_2026_week1_fixture.json` (same enrichment default) |

Also spot-check the DB-fed NBA SVG: `findstr /C:"CARRIER TBA" ...` prints nothing, and the WAS @ CLE card sits on the DAZN row (the count line matching plus no CARRIER TBA is sufficient evidence; note anything odd). If any case diverges, print both count lines, diff the two fixture JSONs for that day (game ids and media rows), report, and STOP — the mapping is wrong, not the gate.

## 3. Wire it into `render_all.yml` (the runner stops depending on fixture files)
Replace the "Render every in-season sport that has a fixture for the day" step body: for each sport in nhl nba nfl, run `python -m pipeline.render_feed --sport $S --date $D` and, **only if it reports 1+ games**, `python scripts/render_day.py --sport $S --date $D --png --export --fixture artifacts/validation/db_${S}_..._fixture.json`; CFB keeps its Saturday branch but feeds from `python -m pipeline.render_feed --sport cfb --week $W` (compute W as `select max(week) from games where sport='cfb' and season=...` via the feed module — add `--latest-week` or print the chosen week; your call, keep it simple). Add `SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}` to the workflow's env (it now reads the database). Delete the `download-artifact` step — the DB is the source now. Validate the YAML parses (`python -c "import yaml,glob; ..."` — pyyaml is available or pip install it).

## 4. Idempotency + full-suite certification
1. Run `python -m pipeline.render_feed --sport nba --date 2026-10-28` twice; the two output files must be byte-identical (`fc /b` the two — write the second to a temp name via `--out` if you added one, or copy the first aside before re-running).
2. `python -m unittest tests.test_reconcile` again — still 19 OK. No traceback, no UnicodeEncodeError, no strftime error anywhere in this run.

## 5. Commit and push
1. Stage exactly: `git add pipeline/reconcile.py pipeline/render_feed.py .github/workflows/render_all.yml`
2. Secret gate: `git diff --cached | findstr /R "CFBD_API_KEY=[A-Za-z0-9] SUPABASE_DB_URL=postgresql://mysports_writer.ztnppejmdwmhqstqsfks:[A-Za-z0-9] R2_SECRET_ACCESS_KEY=[A-Za-z0-9]"` must print nothing. Confirm nothing under `assets/`, `artifacts/`, or `.env` is staged.
3. Commit with this message exactly (fill the two count placeholders from your Section 2 results):

```
Milestone 3 part 1: renderer reads the database (spec 18 M3) + reconcile selectivity fix

- pipeline/render_feed.py: one viewing day (pro) or week (cfb) from mysports.* in the adapter fixture shape -
  games + teams + venues + active game_broadcasts (access/market/carriage mapped back to adapter vocabulary,
  source 'mysports-db') + latest odds/records; deterministic output
- Acceptance: DB-fed render == fixture-fed render for NHL 10-01 (3/0/5), NBA 10-28 (3/0/9), NFL 09-13 (2/0/11),
  CFB week 1 (<counts>); DAZN row seats the Cavs game, no CARRIER TBA
- render_all.yml: renders from the database (render_feed + --fixture), SUPABASE_DB_URL added, fixture-artifact
  download removed - the daily render no longer depends on adapter runs
- pipeline/reconcile.py: CHANGED_WHERE drops last_seen_at - a repeat sighting cannot change a decision; default
  mode after a bump-only load now reconciles 0 games instead of all 237
Multi-sport day layout (spec 11.9) deliberately not included - design pending
```

4. `git push origin main`; `git rev-parse HEAD` and `git rev-parse origin/main` must match. Report both.

## 6. Report
Paste the git status, the Section 0.3 proof lines, the render_feed console output for all four cases, the eight count lines side by side, the byte-identity result, the secret-gate result, the commit hash, and the two rev-parse hashes. If you made any judgment call the spec above left open (envelope keys, the cfb week flag, feed file naming), list each in one line.
