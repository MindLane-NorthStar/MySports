You are working in the MySports repo (C:\Users\jlull\Joe's Projects\Apps - Personal\MySports), branch main, HEAD f4d1135. This prompt BUILDS the MLB adapter (Milestone 8.3) — Joe wants baseball on the grid for the remainder of the 2026 regular season and the postseason, starting now. Your specification is **`docs/research/mlb-adapter-brief.md`** (in the repo, shipped by Cowork in stage 12 along with the §11.9 design memo, the research-changelog entry, and four data-file changes): read it end to end before writing code — it documents the live-probed endpoint shapes, broadcast codes, raw outlet spellings, doubleheader/postponement semantics, blackout rules, and a proposed fixture mapping table. Where this prompt and the brief conflict, THIS PROMPT WINS (it carries Joe's decisions from tonight); where the brief marks something UNVERIFIED, code defensively and report what you observe. Also riding in this commit: the uncommitted odds-details fix in `pipeline/render_feed.py` and all stage-12 files. Never print any value from `.env`. If an acceptance check fails, stop, report, and wait.

## Joe's decisions that override or settle the brief's open questions
1. **MLB Network is AVAILABLE** (Joe, 2026-09-01 — already added to `data/access_profile.json` in stage 12). The brief's "not in profile" framing is obsolete; MLBN games seat normally.
2. **Guardians TV** is modeled as a LINEAR outlet (canonical name `Guardians TV`), heading the mlb cable group in `data/row_order.json` (stage 12). **Joe confirmed DIRECTV channel 662 IS Guardians TV (2026-09-01), so `Guardians TV` is in the access profile as available** — its rows resolve AVAILABLE through the normal profile lookup. Do not model a separate CLEGuardians.TV streaming row in v1 (brief §5.3's chip idea is deferred).
3. The WUAB 43 / Cavs matter is settled and none of your business this prompt — do not touch `nba.*` or `local_rights.json`.
4. 2027 rows: treat like any season; nothing assumes Opening Day (brief §4.3).

## 0. Preconditions
1. `git status --short` must show exactly: `M data/access_profile.json`, `M data/local_rights.json`, `M data/row_order.json`, `M docs/research/research-changelog.md`, `M pipeline/render_feed.py`, `?? data/market_coverage_mlb.json`, `?? docs/design/`, `?? docs/research/mlb-adapter-brief.md`, plus the always-untracked `assets/` dirs. Paste it. Delete `artifacts\_phase4_stage_12.zip` if present.
2. `python -m unittest tests.test_reconcile` — `Ran 19 tests` … `OK`.
3. Read `docs/research/mlb-adapter-brief.md` fully. List in one line each any brief recommendation you will NOT follow, with why, before writing code.

## 1. Build `adapters/mlb.py`
Same conventions as `adapters/nhl.py` / `adapters/nba.py` (stdlib HTTP via `adapters.common`, Windows-portable, `--from-file` replay, raw snapshot saved, fixture via `fixture_envelope`, ASCII console). CLI:

```
python -m adapters.mlb --date 2026-09-04                  # one viewing day (officialDate == ET viewing day, brief §7)
python -m adapters.mlb --date 2026-09-04 --teams          # also refresh mlb_2026_teams.json + logos
python -m adapters.mlb --date 2026-09-04 --all-logos      # logos for every team (season bootstrap)
```

Requirements, keyed to the brief:
- One `GET /api/v1/schedule` call with `sportId=1`, the date, and `hydrate=broadcasts(all),probablePitcher` odds hydration per brief §1/§9 — use `preGameOdds` if its shape held in your live check; if not, omit odds and report (ESPN is NOT a fallback in this build).
- Broadcast mapping per brief §2/§9: TV rows only; `homeAway` → feed side; national/exclusive/local codes → `market` and suppression semantics. National exclusives suppress locals **by omission** in the feed; add the brief's fail-closed guard: if a game has zero TV rows AND is not a known exclusive, emit no local row and print a warning line rather than guessing.
- Outlet normalization: add these to `OUTLET_ALIASES` in `adapters/common.py` AND `ALIASES` in `pipeline/bootstrap.py`: `Guardians.TV Presented by Progressive` → `Guardians TV`, `CLEGuardians.TV` → `Guardians TV`, `MLBN` → `MLB Network`, `ESPN/ESPN App` → `ESPN`, `ABC/ESPN App` → `ABC`, `NBC/Peacock` → `NBC`, `Peacock/NBCSN` → `Peacock`, `Peacock / NBCSN Extra` → `Peacock`, `FOX / FOX ONE` → `FOX`, `TBS (out-of-market only)` → `TBS`. `FOX / FS1` and the FOX Saturday regional split follow brief §8.1 with `data/market_coverage_mlb.json` as the hand-entry authority (empty today → regional FOX games without a Guardians side are UNVERIFIED, same honesty rule as the NFL). Opponent-side local RSN names (brief §3.3) pass through verbatim as OUT_OF_MARKET rows — no aliases, and heed the brief's `RSN` caution (exact-match aliases only, never substring).
- Guardians rows: the local row ARRIVES from the API (no synthesis). WKYC simulcast days carry both rows; the broadcast-group rail order seats WKYC as primary naturally.
- Teams: `mlb-{id}` ids, `mlb_2026_teams.json`, ESPN colors/logos joined per brief §6 (`adapters.espn.fetch_teams("mlb")`), divisions as conferences (`mlb-al-central` style).
- Doubleheaders/postponements per brief §7: game 2's placeholder start renders `startTimeTBD` true; postponed twin `gamePk` entries — keep the row whose status is live/scheduled, report the other in console notes.

## 2. Live acceptance (all from this machine)
1. `python -m adapters.mlb --date 2026-09-04 --teams` — the Guardians DOUBLEHEADER day the brief probed. Paste the console. Expect: 30 teams; the fixture carries both CLE games with game 2 `startTimeTBD: true`; each carries a `Guardians TV` local row (access AVAILABLE — DIRECTV 662 confirmed); logos fetched for the day's teams.
2. `python -m adapters.mlb --date 2026-09-18` — the WKYC simulcast day (A's @ Guardians). Expect the CLE game to carry BOTH `WKYC 3`-mapped NBC row... (report the exact outlet mapping you chose for `WKYC 3` — canonical `NBC` with station, or a distinct outlet — and why) and `Guardians TV`.
3. `python scripts/render_day.py --sport mlb --date 2026-09-04 --png` and `--date 2026-09-18` — paste the `v1.6 [mlb]` count lines; no traceback/Unicode/strftime errors; the Guardians games must seat (not omit); send nothing to CARRIER TBA.
4. `python -m pipeline.load --all --workflow claude-code` then `python -m pipeline.reconcile --workflow claude-code` — the new MLB fixtures load and reconcile. Paste the TOTAL and summary lines. Expect new games/broadcasts/observations from the two MLB days, a reconcile run covering only the new games (the selectivity fix), 0 conflicts.
5. Verify via psycopg (counts only): mlb games count, `networks_services` gained `guardians-tv` (type from bootstrap/stub) and the opponent RSN stubs, the two CLE games' `primary_network_id` and `canonical_state`, eligibility rows for them. Paste.
6. `python -m pipeline.bootstrap` — picks up `mlb_2026_teams.json`: expect `conferences: 83; teams: 808` (77+6 divisions, 778+30) or report actuals.
7. Week-1 window check (read-only, from the research refresh): `python -c` over `artifacts/validation/nfl_2026_week1_fixture.json` — print each game's ET date. Week 1 includes Wed Sept 9 (NE@SEA, NBC/Peacock) and Thu Sept 10 (SF-LAR, Netflix, Melbourne). If they are ABSENT from the fixture, do NOT fix anything — report it as a finding (the fix belongs to a Cowork stage).

## 3. Workflows
- `bootstrap_season.yml`: replace the mlb echo with `python -m adapters.mlb --date $(TZ=America/New_York date +%F) --teams --all-logos`.
- `schedule_refresh.yml`: add an MLB step mirroring the NHL/NBA pattern (viewing-day fetch).
- `render_all.yml`: add `mlb` to the sports loop.
- Validate all YAML parses.

## 4. Commit and push
1. Stage exactly: `git add adapters/mlb.py adapters/common.py adapters/README.md pipeline/bootstrap.py pipeline/render_feed.py data/access_profile.json data/local_rights.json data/row_order.json data/market_coverage_mlb.json docs/design docs/research/mlb-adapter-brief.md docs/research/research-changelog.md .github/workflows/bootstrap_season.yml .github/workflows/schedule_refresh.yml .github/workflows/render_all.yml` (update `adapters/README.md` with the mlb row first).
2. Secret gate: `git diff --cached | findstr /R "CFBD_API_KEY=[A-Za-z0-9] SUPABASE_DB_URL=postgresql://mysports_writer.ztnppejmdwmhqstqsfks:[A-Za-z0-9] R2_SECRET_ACCESS_KEY=[A-Za-z0-9]"` prints nothing; nothing under `assets/`, `artifacts/`, or `.env` staged.
3. Commit with this message exactly (fill the two bracketed counts from Section 2):

```
Milestone 8.3: MLB adapter (statsapi single-call), rest-of-2026 + postseason in scope

- adapters/mlb.py: schedule + hydrate=broadcasts(all) (+odds hydration where stable) per docs/research/mlb-adapter-brief.md;
  officialDate == ET viewing day; national exclusives suppress locals by omission with a fail-closed guard; doubleheader
  game 2 renders startTimeTBD; Guardians local row arrives from the API (Guardians TV, access via profile - DIRECTV 662
  check pending); FOX Saturday regionals gated by data/market_coverage_mlb.json hand entry
- aliases: MLB raw spellings -> canonical (Guardians TV, MLB Network, ESPN, NBC, Peacock, FOX, TBS); opponent RSNs pass
  through verbatim as OUT_OF_MARKET; exact-match only (RSN caution)
- data: MLB Network available (Joe 2026-09-01); mlb rail in row_order (Guardians TV heads cable); market_coverage_mlb
  skeleton; Cavs simulcast note updated (hand-entered authority, public announcement pending)
- docs: mlb-adapter-brief.md and the 11.9 design memo + wireframes filed; research changelog 2026-09-01 evening entry
  (CBJ still TBA - Prime Video is a report; Guardians/ESPN 2027; NFL Wk1 Wed/Thu games; ESPN Unlimited price)
- pipeline/render_feed.py rider: odds details synthesized from home-relative spread (JAX -7.5 style)
- workflows: mlb in bootstrap_season / schedule_refresh / render_all
Acceptance: Sept 4 doubleheader [counts] and Sept 18 WKYC simulcast day [counts] fetched, rendered, loaded, reconciled - 0 conflicts
```

4. `git push origin main`; `git rev-parse HEAD` == `git rev-parse origin/main`. Report both.

## 5. Report
Paste the git status, your brief-deviation list, the two adapter consoles, the render count lines, the loader TOTAL + reconcile summary, the verification output, the bootstrap counts, the Week-1 window finding, the secret-gate result, the commit hash, and the rev-parse pair. List every judgment call the brief or this prompt left open, one line each.
