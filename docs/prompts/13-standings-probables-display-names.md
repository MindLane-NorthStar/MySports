You are working in the MySports repo (C:\Users\jlull\Joe's Projects\Apps - Personal\MySports), branch main, HEAD 40c32e9. This prompt BUILDS the listings data line's missing inputs (Joe's decision, 2026-09-02): every game card in the app gets ONE compact data line — team records, division standing, betting odds, and for MLB the probable-pitcher matchup. Odds and records already flow; this stage adds **standings** and **probable pitchers** end to end. Cowork has left ONE new untracked file: `db/migrations/0008_standings_and_probables.sql` (read it first). These are loader-written provider facts, NOT reconciled observations — same design as 0007's scores; the reconciler never touches them. Never print any value from `.env`. If an acceptance check fails, stop, report, and wait.

## 0. Preconditions
1. `git status --short` shows exactly `?? db/migrations/0008_standings_and_probables.sql` plus the always-untracked `assets/` dirs (stray artifacts are fine). Paste it.
2. `python -m unittest discover tests` — expect 88 green.
3. Read the migration.

## 1. Apply migration 0008
1. Backups: `python scripts/backup_table.py team_records` and `... games`. Paste counts.
2. `python scripts/apply_migration.py db/migrations/0008_standings_and_probables.sql --dry-run` (run the verification selects separately — apply_migration doesn't surface SELECT output, per the 0007 lesson), then apply live. Paste.
3. `db/README.md` ledger entry.

## 2. Standings — new `pipeline/standings.py`
One module fetching all four pro leagues' standings and upserting `team_records` (upsert key `(team_id, season, as_of)`; as_of = today ET; write wins/losses/ties/ot_losses/points/division_rank/games_back as each league provides them, null where it doesn't). Same conventions as the rest of `pipeline/` (stdlib HTTP via adapters.common, Windows-portable, ASCII, never print the DSN). CLI: `python -m pipeline.standings [--league mlb|nhl|nba|nfl] [--from-file ...]` — default all four; save raw snapshots like the adapters do.

Endpoints (verify shapes live; report anything this table gets wrong):
- **MLB**: `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=2026` — division ranks, GB, W/L. Team key = `mlb-{team.id}`.
- **NHL**: `https://api-web.nhle.com/v1/standings/now` — W/L/OTL, points, `divisionSequence`. Map via the NHL↔ESPN abbreviation map in `adapters/nhl.py` to `nhl-{id}` (the payload carries team ids — prefer those). NOTE: this host once dropped a connection on Windows (WinError 10054, M8.1 loose end) — catch and retry once before failing the league.
- **NBA**: `https://site.api.espn.com/apis/v2/sports/basketball/nba/standings` — W/L, and **store the CONFERENCE rank (playoff seed / conference standing), not the division rank, in `division_rank`** — Joe's ruling (2026-09-02): NBA cards show place in conference. Document the column's NBA semantics in `db/README.md`. Team key = `nba-{TRICODE}` via the ESPN abbreviation map in `adapters/nba.py`. (Preseason: expect last season's shape or zeros — write what it says, honestly.)
- **NFL**: `https://site.api.espn.com/apis/v2/sports/football/nfl/standings` — W/L/T, division rank. Team key = `nfl-{espnId}`.
Fail-honest per league: a league whose fetch or mapping fails is SKIPPED with a console warning, never guessed; the other leagues still commit.

## 3. Probable pitchers — `adapters/mlb.py` + loader
1. Add `probablePitcher` to the schedule hydration (brief §1 documented it; the current code doesn't emit it), AND fetch each named pitcher's season record + ERA with one batched call: `GET /api/v1/people?personIds=<comma-list>&hydrate=stats(group=[pitching],type=[season])` (verified live 2026-09-02 — splits[0].stat carries wins/losses/era). Each game's fixture gains `"probables": {"away": "F. Lastname (W-L, ERA)", "home": ...}` — a display-ready string (first initial + last name, stats in parens; name alone when stats are missing), null-safe when the API omits a pitcher (common >2 days out and for game 2 of doubleheaders). The stored DB value is this same string.
2. `pipeline/load.py`: write `probable_home_pitcher`/`probable_away_pitcher` on the games upsert, null-safe (incoming null never erases a stored name; a CHANGED name overwrites — pitchers get scratched).
3. `tests/`: extend with at least 4 tests — probables parse from a live/saved payload, absent-probable → null, loader null-safety both directions (emit-sql assertions fine).

## 3b. Display names — teams.display_name (the media-standard short forms)
The app must show what broadcasters show: "LIU", not "Long Island University"; "NC A&T", not "North Carolina A&T"; but "Georgia State" spelled out because it fits. The authority is ESPN's `shortDisplayName`. Migration 0008 added `teams.display_name` (null = app falls back to short_name).
1. New small script or bootstrap step: fetch ESPN's college-football teams for BOTH groups — FBS (`?groups=80`) and FCS (`?groups=81`), `limit=500` each — via `site.api.espn.com/apis/site/v2/sports/football/college-football/teams`. (This host 403s Anthropic's cloud today — Akamai bot-blocking, same class as cdn.nba.com — but works from your machine and the Actions runner; if it 403s you too, STOP and report.) Match to our cfb teams by ESPN id where `external_ids`/existing joins allow, else by normalized school-name match; write `display_name = shortDisplayName` wherever it DIFFERS from our `short_name`. Leave pro sports null (their short_names are already nicknames and correct).
2. Report the FULL diff list (our short_name → ESPN shortDisplayName) for the ~186 game-referenced cfb teams — Joe reviews the names. Spot-assert: LIU, NC A&T, and San José State get their expected forms; Georgia State stays spelled out (identical → null is fine).
3. Unmatched teams: list them, leave null — never guess an abbreviation.

## 3c. Fix MLB short names — "Sox" is not a team
Joe's finding (2026-09-02): `teams` rows mlb-111 (Boston) and mlb-145 (Chicago AL) BOTH store `short_name = 'Sox'` — the card would read "Sox @ Sox". Root cause is the field the MLB bootstrap picked from statsapi's teams payload (whichever field carries the bare club-noun). The correct field is **`teamName`** — statsapi's nickname field, which carries "Red Sox" and "White Sox" (verify live: `GET https://statsapi.mlb.com/api/v1/teams?sportId=1&season=2026`, check ids 111 and 145).
1. Fix the bootstrap/team-upsert code in `adapters/mlb.py` to source short_name from `teamName`.
2. Audit ALL 30 MLB rows: paste a 30-row table of `team_id | current short_name | statsapi teamName`, then update every row where they differ (expect at least the two Sox rows; report any others rather than silently fixing).
3. Add a test asserting the parser maps 111→"Red Sox" and 145→"White Sox" from a saved payload.
`schedule_refresh.yml`: add a daily standings step (`python -m pipeline.standings`) after the adapter fetches. YAML parses.

## 5. Live acceptance
1. `python -m pipeline.standings` — paste the console. Verify via psycopg: today's `team_records` rows per league (mlb 30 with division_rank AND games_back; nhl 32 with points; nfl 32; nba 30 — or honest preseason findings), and CLE Guardians' row specifically (paste it — Joe can sanity-check the rank).
2. `python -m adapters.mlb --date 2026-09-04` (re-fetch) — probables now in the fixture; paste the two CLE games' lines. Then `--date 2026-09-03` (tomorrow — probables usually named): paste 3 games with named pitchers INCLUDING their (W-L, ERA) stats.
3. `python -m pipeline.load --all --workflow claude-code` — probables land; verify the two Sept 4 CLE games' pitcher columns via psycopg; re-load the same fixture → unchanged (null-safety).
4. `python -m pipeline.reconcile --workflow claude-code` — standings/probables must NOT wake it beyond normally-changed games; paste the line.
5. Full suite: `python -m unittest discover tests` — 92+ green.
6. Renderer regression: `python scripts/render_day.py --sport mlb --date 2026-09-04 --fixture artifacts/validation/mlb_2026_2026-09-04_fixture.json` — count line unchanged vs v1.6.3 (`3 on grid · 0 TBA · 13 omitted`); the renderer ignores unknown fixture keys, prove it stays true.

## 6. Commit and push
1. Stage exactly: `git add db/migrations/0008_standings_and_probables.sql db/README.md pipeline/standings.py pipeline/load.py adapters/mlb.py adapters/README.md tests .github/workflows/schedule_refresh.yml` (update adapters/README with the probables note first; drop anything untouched).
2. Secret gate as always; nothing under `assets/`, `artifacts/`, `.env`, `node_modules/` staged.
3. Commit message:

```
Standings + probable pitchers: the listings data line's missing inputs

- db 0008: team_records gains ot_losses/points/division_rank/games_back; games gains probable pitcher
  columns - loader-written provider facts, NOT reconciled observations (0007 reasoning)
- pipeline/standings.py: mlb (statsapi) + nhl (api-web, retry-once for the Windows reset) + nba/nfl (ESPN)
  daily standings upsert into team_records (NBA stores CONFERENCE rank per Joe); fail-honest per league
- adapters/mlb.py: probablePitcher hydration + batched season W-L/ERA, emitted as display-ready probables{}; loader writes null-safe
  (a scratched pitcher's replacement overwrites; null never erases)
- teams.display_name: cfb media-standard short forms from ESPN shortDisplayName (LIU, NC A&T, ...);
  null = fall back to short_name; unmatched left null, never guessed
- mlb short_name sourced from statsapi teamName: fixes 111/145 both storing 'Sox'; all 30 audited
- schedule_refresh: daily standings step
Acceptance: [counts] standings rows across four leagues incl. CLE division rank; probables live for
[date]; renderer count line unchanged; suite [n] green
```

4. Push; rev-parse pair identical. Report both.

## 7. Report
Paste: git status, backups, migration dry-run+live, the display_name diff list, the 30-row MLB short_name audit, standings console + per-league verification + the Guardians row, the probables fixtures and DB rows, reconcile line, suite count, renderer regression line, secret gate, commit hash, rev-parse pair. Judgment calls one line each, and name any endpoint whose live shape differed from Section 2's table.
