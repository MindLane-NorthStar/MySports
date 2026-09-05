# adapters/

League adapters (spec §3.12, §8.5, Milestone 8). Each one turns a league API payload into the sanitized fixture shape
`scripts/render_day.py` reads, plus a teams file, and downloads the PNG logos it needs into `assets/logos/`.
Run every command from the repo root; the machine needs egress to the league APIs (Claude Code on Windows).

| adapter | source | command | writes (`artifacts/validation/`) |
|---|---|---|---|
| `cfbd.py` | api.collegefootballdata.com (key in `.env`) | `python -m adapters.cfbd --week 1 [--teams]` | `cfbd_2026_week1_{calendar,games,media,fixture}.json`, `_adapter_report.md` |
| `espn.py` | site.api.espn.com (no key) | `python -m adapters.espn --league nfl --date 2026-09-13` or `--week 1` | `nfl_2026_{date|weekN}_{raw,fixture}.json`, `_report.md`, `nfl_2026_teams.json` |
| `espn.py` | same | `python -m adapters.espn --league nhl --teams-only` | `nhl_espn_teams.json` (colors + logo URLs; `nhl.py` fetches this itself when online) |
| `nhl.py` | api-web.nhle.com (no key) | `python -m adapters.nhl --date 2026-10-01 [--all-logos]` | `nhl_2026_{date}_{raw,fixture}.json`, `_report.md`, `nhl_2026_teams.json` (all 32 teams in any window, via `club-schedule-season/{local team}/now`) |
| `nba.py` | site.api.espn.com (no key); `cdn.nba.com` league file only via `--source league --from-file` | `python -m adapters.nba --date 2026-10-28 [--all-logos]` | `nba_2026_{date}_{raw,fixture}.json`, `_report.md`, `nba_2026_teams.json` |
| `mlb.py` | statsapi.mlb.com (no key) | `python -m adapters.mlb --date 2026-09-04 [--teams] [--all-logos]` | `mlb_2026_{date}_{raw,fixture}.json`, `_report.md`, `mlb_2026_teams.json`. One call: schedule + `broadcasts(all)` (TV rows with feed side + national/local code) + `preGameOdds`. `--date` takes a viewing day directly (`officialDate` == ET viewing day). National exclusives suppress locals by omission; a window with games but zero TV rows is refused rather than written. See `docs/research/mlb-adapter-brief.md`. Also hydrates `probablePitcher` and makes ONE batched `/people?personIds=...&hydrate=stats(group=[pitching],type=[season])` call - see the probable-pitcher note below. |

## Probable pitchers (MLB only, 2026-09-02)

`adapters/mlb.py` hydrates `probablePitcher` on the schedule call and follows it with ONE batched
`GET /api/v1/people?personIds=<every id in the window>&hydrate=stats(group=[pitching],type=[season])`
(chunked at 100 ids). Each game's fixture gains a display-ready block:

```json
"probables": {"away": "J. Soriano (11-7, 3.45)", "home": "T. Bibee (5-14, 3.88)"}
```

Rules, in order of how easily each is broken:

* **Both sides are always present**, `null` where MLB has not named a starter. That is the normal state
  more than two days out, and it is permanent for **game 2 of a doubleheader** - the league never names
  one (verified 2026-09-02: both halves of DET @ CLE on 2026-09-04).
* **Name alone when the stats are missing.** If `/people` does not answer for an id, or the ERA comes
  back as `-.--` (a pitcher with no innings), the string is just `"B. Tidwell"`. A record is never guessed.
* **A traded pitcher shows his COMBINED line.** `/people` returns one split per club PLUS a combined split
  carrying `numTeams` and no `team` key; that combined split is the season line (Jose Soriano, 11-7 3.45
  across two clubs, not 9-6 or 2-1). Per-club splits are never summed by hand.
* The raw `/people` payload is saved beside the schedule snapshot as `mlb_{season}_{date}_people.json`,
  so `--from-file` replay reproduces the same strings offline. Without it, replay still renders the names
  (they come from the schedule payload) and simply omits the stats.

`pipeline/load.py` writes them to `games.probable_{home,away}_pitcher` **null-safe in both directions**
(`coalesce`): an incoming null never erases a stored starter, a changed name always overwrites. Same rule
as scores, and for the same reason - the provider stops reporting a starter once the game is under way.

Then render: `python scripts/render_day.py --sport nhl --date 2026-10-01` / `--sport nfl --date 2026-09-13` / `--week 1 --date 2026-09-05` (cfb, unchanged).

Every adapter accepts `--from-file <raw.json>` to replay a saved payload offline. `--all-logos` (nhl, nba) fetches every team's logo instead of only the window's — the season bootstrap uses it. Data files the adapters read:
`data/markets.json` (market-of-one), `data/market_coverage_nfl.json` (weekly 506sports hand entry),
`data/local_rights.json` (late-binding local rows), `data/access_profile.json` (spec §3.2), `data/render_policies.json` (§7.19), `data/market_coverage_mlb.json` (FOX Saturday regionals).

## `access_status = 'unverified'` is load-bearing

It means **a regional window with no market conclusion yet, pending a coverage map**. It does not
mean "unknown", and it does not mean "probably fine".

It is the SOLE input to market-pending in `pipeline/reconcile.py`. An adapter that writes it loosely
- as a catch-all for anything it could not classify - manufactures false market-pending rows on games
nobody has any evidence about, and those rows then present to the reader as a real state with a real
badge. Write it only when the provider actually described a regional window.

The same note is on `data/authority_rules.json`'s `_about`.
