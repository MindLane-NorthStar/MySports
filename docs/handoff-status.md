# MySports — Handoff Status (post-prompt-20, 2026-09-03)

**This file now lives in the repo** at `docs/handoff-status.md` and is mirrored to the Claude project at `claude/handoff-status.md`. The repo copy is the source; the project copy is written from it. Edit here.

Read first for any session picking up MySports. Memory `/areas/mysports.md` + `/areas/mysports-build-log.md` carry the compressed truth. Companions: `claude/enhancement-register.md` — a project doc, not in the repo (check §7–§9 before re-raising ANY decision), **`docs/feature-study/05-home-page-decisions.md` (D1–D6, the D3 amendment, deployment facts, and E5 — BINDING)**, `docs/rendering-contract-mobile.md`, `claude/program-card-design-v1.md`.

## Repo state
main, HEAD **65cfdf2**. **174 Python tests OK (skipped=1)**, **81/81 JS unit tests**, smoke **29/30** (known `generated_grids` bare-key failure only). Tree clean apart from always-untracked `assets/` and `artifacts/`.

Prompt 20: `a28c26f` retry restored → `aadedd7` home nav → `c8c7d91` prime-window policy → `c6b8a0e` off-service via `viewer_game_eligibility` → `7ec7e91` favorites float → `65cfdf2` NBA id guard.
Prompt 19: `1c9cfda` → `a5b549b` → `023430d` → `c5b4bf8` → `99ea3c5`. Prompt 18: `9f0e362` → `7fb547b` → `b274ee5`.

## DEPLOYED
**https://my-sports-xi.vercel.app** — Vercel project `my-sports`, team `mindlane-northstar` (Pro), Root Directory `web`. **Leave Vercel Authentication on Standard Protection** (it exempts the production alias, keeps previews behind login). Do not buy Advanced Deployment Protection.

**Akamai does not block Vercel** (probe from `iad1`, four 200s). The 403 is specific to the Cowork cloud workspace. **Never reapply a bare browser UA** — it scores worse than an honest bot UA.

## What works now
- **Data spine:** 29-table `mysports` schema; adapters cfbd/espn-nfl/nhl/nba/mlb; reconciliation; standings for 4 leagues; MLB probables.
- **Live scores, read-only:** `web/lib/livescores.js` — state/score/clock/period from the providers on render, 60 s cache, fails open, never writes. Ports `result_status()`/`score_int()` and is tested against `tests/fixtures/`.
- **Card state (E1) + data-as-of (E4).** `MatchupCard.js` untouched by construction — E1 is a return-value change in `resultLabel`. NHL in-progress uses `P3`, not `T3` (`T` already means top-of-inning for baseball on the same page).
- **iOS home screen:** `web/app/apple-icon.png` 180×180 + manifest + label. The squircle mask clips no artwork (proofs in `artifacts/qa/2026-09-03-appicon/`). Delete and re-add an existing home-screen entry to pick it up.
- **Navigation:** `web/lib/routes.js` is the single route-list definition; `PrimaryNav` mounts on both branches of `Chrome`, so the standalone app is no longer a dead end on `/`.
- **Off-service (D4/E3):** read from `mysports.viewer_game_eligibility` — never recomputed in JS. 375 rows for 375 games, 100% coverage.
- **Favorites (D6):** `data/favorites.json`, 13 teams resolved to ids.
- **Prime window (D2):** `prime_window_start` per sport in `data/render_policies.json` + `web/lib/primewindow.js`. **Nothing consumes it yet — prompt 21's band does.**

## Immediate next steps
1. **Prompt 21 — the home page composition.** Must **create the per-sport band structure** (see Open below — it does not exist), then the three-state band (Tonight → On now/Next up → Finals·Tomorrow) with a header stating the viewing day and the clock it used and a permanent "See all today" escape; **E5 market-pending as a third state**; re-scope the favorites float to be per-band; the ≥1,600 px desktop composition; E10 empty-state copy. **The E2/E6 derivation must be written exactly once** and be importable by renderer v1.7's §11.9 "Tonight" line.
2. **Rendering-contract v1.7** — program card + studio shows (CFB now, NFL by Sept 13); the grid "now" marker; the `open_ended` vs `render_policies` reconciliation **landed with `prime_window_start`, same file**; the `generated_grids` bare-key fix; **plus the loader enum-hardening stage below**.
3. **506sports NFL maps land ~Sept 8–9 → `market_coverage_nfl`.** This is what resolves E5's market-pending games. It is now on the critical path for September 13.
4. Behind that: WWE/AEW → UFC → NASCAR (playoffs to Nov 8) → IndyCar (Dec). §11.9 views v2; CBJ watch escalation ~Sept 15 (ask first); research watch `trig_01Bvo3an2iZBcEBFphv9MqYs` Wednesdays. Cloud egress add still needed: cf.nascar.com.
5. **Privacy gate before the Cavs season (late October):** production is a public URL. Confirm no loaded broadcast row publishes the unannounced WUAB/RESN arrangement.

## Open — carry into prompt 21 / v1.7
- **There is no per-sport band component.** `web/app/page.js` renders ONE flat `Listing` of all games sorted by kickoff. The feature-study memo's "band per sport" describes intent, not shipped code. Prompt 21 must build it, and D6's favorites float re-scopes to per-band at that point.
- **Loader enum hardening (v1.7).** Run `33645776411` died because `adapters/mlb.py` wrote `carriageCertainty="UNVERIFIED"` — an `access_status` value in a `carriage_certainty` field. **One mistyped enum aborted the whole daily refresh and the render behind it.** The specific bug is fixed (`64c9764`); the class is not. The loader should validate enum-typed fields against the DB enum before insert and quarantine the offending ROW with a warning, the same fail-honest-per-unit shape the standings step already uses.
- **Watch the next scheduled refresh.** Only four `schedule_refresh` runs exist; three failed, all three causes are identified and fixed in HEAD, and the most recent is green in both jobs on current code. That is still only ONE green run, and the 11:00 UTC cron had not fired since. If the next scheduled run is red, stop and diagnose before more features land.
- **Sport-band and market-pending both touch the count line.** E5 adds a third count; D4's filter-by-default must exempt market-pending rows in every surface and toggle state.

## Working rules (binding)
1 Certify Python for Windows. 2 Never write to the repo while a Claude Code prompt is in flight. 3 Secret gate every commit, ADDED lines only (`git diff -U0 --cached` + `grep "^+"`); never `findstr`. 4 Stage by explicit path; never `git add -A`. 5 Run-workflow-never-Re-run. 6 DB: additive over destructive; SELECT-and-paste first; close (`valid_to`), don't delete. 7 Unattended runs: self-committing stages, 2-strikes-skip, hard stops only for secret-gate/destructive-DB/push-reject. 8 WUAB/RESN sources never named. 9 Loader-written provider facts never become reconciled observations. 10 Check the register §7–§9, the home-page decision record, and this file before re-raising any settled decision.
11 Cowork's bridge shell calls git with `--no-optional-locks`.
12 **Do not run `npm ci` on this laptop** and never set `experimental.useWasmBinary` — Windows Application Control blocks the re-extracted SWC binary and `next build` dies. Linux and Vercel are unaffected. Do not disable Smart App Control (it cannot be re-enabled without reinstalling Windows). Use the Vercel preview build for the route table.
13 **A numeric threshold is measured against the LOCAL background, never a global corner sample.** Look at the render, not just the number.
14 The DB hard stop is worded **"no direct Postgres connection, no writer credential, no DML"** — PostgREST reads with the publishable anon key are the app's normal read path and are always allowed.
15 `npm run test:unit` is `node --test "test/**/*.test.mjs"` — quoted glob.
16 Color tokens are read from `web/app/globals.css`, never quoted from the mockups: the mockups use `--ground`, the app calls the same `#1b1b1b` **`--spot-2`**.
17 **Edit JSON data files through a parser, never line-based**, and assert nothing but the intended key changed. Each sport in `data/render_policies.json` is one line; a line-based edit assuming multi-line objects corrupted it.
18 **Team-name resolution is exact-match within sport, never substring or fuzzy** — and pro leagues are not uniform: MLB canonical names are **nickname-only** ("Guardians"), so cross-check a second key such as `abbreviation`.
