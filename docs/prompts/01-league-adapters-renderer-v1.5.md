You are working in the MySports repo (C:\Users\jlull\Joe's Projects\Apps - Personal\MySports), branch main. Cowork has written new files and has already run every adapter live from its own workspace (fixtures, reports and 64 pro-league logos are on disk). Your job is the Windows certification pass and the commit. Do not modify the code unless a step below fails; if one does, stop, report, and wait.

## 0. Preconditions
1. Run `python --version` and report it.
2. A stale lock is present: delete `.git\index.lock` (it is a 0-byte file left by a read-only status check from a Linux shell). Then run `git status --short` and confirm it lists: `M data/row_order.json`, `M docs/rendering-contract.md`, `M scripts/render_day.py`, and untracked `adapters/`, `data/access_profile.json`, `data/local_rights.json`, `data/market_coverage_nfl.json`, `data/markets.json`, `data/render_policies.json`. `assets/logos/` and `assets/network-logos/` also show as untracked — they stay untracked (do not `git add` them).
3. Delete the four staging archives `artifacts\_phase4_stage.zip`, `_phase4_stage_2.zip`, `_phase4_stage_3.zip`, `_phase4_stage_4.zip`.
4. Read `adapters/README.md`.

## 1. Live adapter runs on Windows (Cowork's runs were Linux; this is the certification pass — the files it overwrites are the same data)
Run each from the repo root and paste every console line into your report:
1. `python -m adapters.nhl --date 2026-10-01`
2. `python -m adapters.espn --league nfl --date 2026-09-13`
3. `python -m adapters.espn --league nfl --week 1`
4. `python -m adapters.cfbd --week 1`  (uses CFBD_API_KEY from .env; never print or write the key)

Then report:
- For step 1: the first 12 lines of `artifacts/validation/nhl_2026_2026-10-01_report.md`, and for the BUF @ CBJ game print its `media` array from `artifacts/validation/nhl_2026_2026-10-01_fixture.json`. Expected: one row, outlet `CBJ LOCAL`, market `local`, carriageCertainty `TBA_NO_RIGHTS_HOLDER`. Also report whether the console showed a `postal-lookup 44221: Columbus Blue Jackets` line.
- For step 2: the `## Regional games awaiting a Cleveland coverage entry` section of `artifacts/validation/nfl_2026_2026-09-13_report.md` in full, and how many games the fixture holds. The CLE @ JAX row must show `CBS[AVAI/reg]`.
- For step 4: run this comparison and paste the output:
  `python -c "import json;a=json.load(open('artifacts/validation/cfbd_2026_week1_fixture.json',encoding='utf-8'));print(len(a['games']),sorted(a['games'][0].keys()))"`
  Expected 99 games (or the current CFBD count) and the keys now include `sport` and `venue`.
- `assets/logos`: count files matching `nhl-*.png` and `nfl-*.png` (expect 32 and 32; the adapters report them as `cached`).

## 2. Renders (Windows Python)
1. `python scripts/render_day.py --sport nhl --date 2026-10-01`
2. `python scripts/render_day.py --sport nfl --date 2026-09-13`
3. `python scripts/render_day.py --week 1 --date 2026-09-05`
Paste the three `v1.5 [...]` console lines. Expected: nhl `3 on grid · 0 TBA · 5 omitted`; nfl `2 on grid · 0 TBA · 11 omitted`; cfb `62 on grid · 0 TBA · 6 omitted` exactly (nhl/nfl may differ only if the league files changed since 2026-09-01 — report whatever it says). Any Python traceback = stop and report.
Open `artifacts/rendering/grid_2026-10-01.svg` and `grid_2026-09-13.svg` in the browser and confirm team logos appear in every card.

## 3. Windows certification
Report that every command above ran under Windows Python with no traceback, no `UnicodeEncodeError`, and no `strftime` error. (Cowork's runs were on a Linux shell; this is the Windows pass.)

## 4. Commit and push
1. Stage exactly: `git add adapters data/access_profile.json data/local_rights.json data/market_coverage_nfl.json data/markets.json data/render_policies.json data/row_order.json docs/rendering-contract.md scripts/render_day.py`
2. Secret gate: `git diff --cached | findstr /R "CFBD_API_KEY=[A-Za-z0-9]"` must print nothing. If it prints anything, `git reset` and stop.
3. Confirm `git status --short` shows no staged file under `assets/` or `artifacts/`.
4. Commit with this message exactly:

```
Phase 4 M8.1: league adapters (cfbd, espn/NFL, nhl) + renderer v1.5 multi-sport plumbing

- adapters/: common fixture shape, CFBD provider extracted from the validation script,
  ESPN scoreboard/teams (NFL + shared colors/logos), NHL schedule + postal-lookup territory
- data/: markets (Cleveland market-of-one), market_coverage_nfl (506sports hand entry),
  local_rights (late-binding local rows), access_profile (spec 3.2), render_policies (spec 7.19),
  row_order gains nfl + nhl rails
- render_day.py v1.5: --sport, policy-driven block/title/rail, local CARRIER TBA row,
  market-filter omission with stated reasons, inline odds/records for pro fixtures;
  CFB Week 1 render byte-identical to v1.4 (timestamp/gradient-id normalized)
- rendering-contract.md: v1.5 change-log entry
Acceptance renders: 2026-10-01 CBJ opener (TBA local row), 2026-09-13 NFL Sunday (Cleveland filter)
```

5. `git push origin main`, then `git rev-parse HEAD` and `git rev-parse origin/main` — both hashes must match. Report both.

## 5. Report
Paste back: Python version, every console line from sections 1 and 2, the fixture excerpts requested, the logo counts, the secret-gate result, the commit hash, and the two rev-parse hashes. Do not summarize the console output; paste it.
