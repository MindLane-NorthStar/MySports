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

Then render: `python scripts/render_day.py --sport nhl --date 2026-10-01` / `--sport nfl --date 2026-09-13` / `--week 1 --date 2026-09-05` (cfb, unchanged).

Every adapter accepts `--from-file <raw.json>` to replay a saved payload offline. `--all-logos` (nhl, nba) fetches every team's logo instead of only the window's — the season bootstrap uses it. Data files the adapters read:
`data/markets.json` (market-of-one), `data/market_coverage_nfl.json` (weekly 506sports hand entry),
`data/local_rights.json` (late-binding local rows), `data/access_profile.json` (spec §3.2), `data/render_policies.json` (§7.19).
