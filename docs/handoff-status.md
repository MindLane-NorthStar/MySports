# MySports — Handoff Status (rewritten 2026-09-05, prompt 46 stage 2)

**This file lives in the repo** at `docs/handoff-status.md` and is mirrored to the Claude project at
`claude/handoff-status.md`. The repo copy is the source; the project copy is written from it. Edit here.

Read first for any session picking up MySports. Companions: **`docs/enhancement-register.md`** (§14
only in the repo; §1–§13 are still project-only and Joe is supplying them — check there before
re-raising any decision), **`docs/feature-study/05-home-page-decisions.md` — BINDING** (D1–D6, the D3
amendment, §9 NETWORK TBD, §11 mobile page order, §12 the DATE/WEEK headers, §13 the 2026-09-05
review), `docs/rendering-contract.md` **v1.6.14**, `docs/rendering-contract-mobile.md` (Addendum
v1.2), `claude/program-card-design-v1.md`.

## Repo state

main, HEAD **e1d44ee**. Gates: **232 Python tests + 1 skipped**, **269 JS unit tests**, smoke
**30/30**, qa-shots **14/14**. Tree clean apart from always-untracked `assets/` (and `web/qa/`, which
prompt 46 added to `.gitignore`).

Prompt 46 stage 1 — Joe's second installed-app review, 2026-09-05:
`6d9e168` headroom +7→+4 → `f46a57c` symmetric header spacing, tiles-to-section gap → `56e15f3`
styled pickers over native controls → `66df3fd` two-line season-week headings → `eb22693` grid
name·record space + all-zero suppression (contract v1.6.14) → `e1d44ee` venue one step brighter, and
05 §13.

Prompt 45: `98bf919` the artwork paints the safe-area band (the seam) → `e5ff931` DATE/WEEK headers
carry the picker → `6b3bc58` ALL SPORTS.

Prompt 44: `a68af01` absorb nothing of the inset; `392a130` the card-ladder fixture stops rotting.

Prompt 43: `bd7bd22` icon v7 → `0649dd9` banner phone v2 → `560d1c1` banner desktop v2, retire
`banner-layout.json` → `c1d9955` **the banner is on every route; NavBanner and the compact bar are
gone**.

Prompt 42: `fbfc2f8` contract v1.6.13 — the card's fit order mirrors the grid's.

Earlier prompts are in `git log`; this file no longer restates them.

**CRLF hazard — CLOSED** by `f15449f` (prompt 24). `.js .mjs .jsx .css .html` are `text eol=lf` in
`.gitattributes`. A plain `git diff` tells the truth from either OS. Note `globals.css` is CRLF *on
disk* and LF *in the index* — git normalises on add, so preserve line endings when editing it
programmatically.

## DEPLOYED

**https://my-sports-xi.vercel.app** — Vercel project `my-sports`, team `mindlane-northstar` (Pro),
Root Directory `web`. **Leave Vercel Authentication on Standard Protection.** Do not buy Advanced
Deployment Protection. Every push to `main` is the production deploy.

**Akamai does not block Vercel** (probe from `iad1`, four 200s). The 403 is specific to the Cowork
cloud workspace. **Never reapply a bare browser UA.**

## What works now

- **Data spine:** 29-table `mysports` schema (migrations through `0011_division_seed.sql`); adapters
  cfbd / espn-nfl / nhl / nba / mlb; reconciliation; standings for 4 leagues; MLB probables.
- **A FULL 2026 CFB + NFL REGULAR SEASON IS LOADED.** `games` ≈1,379. CFB 14 weeks (week 14 absent,
  week 15 holds 1 game — that is what CFBD returns for `season-type=regular`; **not a load failure**).
  NFL 18 weeks complete. `mlb` 153 / `nba` 19 / `nhl` 47 are date-driven and therefore **partial** —
  see Open. `bootstrap_season.yml` is manual-dispatch only; `schedule_refresh.yml` is scoped to the
  current CFB week and the coming NFL Sunday.
- **Live scores, read-only:** `web/lib/livescores.js` — state/score/clock/period on render, 60 s
  cache, fails open, never writes. Stale-LIVE guard at 8 h (`isStaleLive`, `format.js`).
- **Overlap rule** (contract v1.6.5, Addendum M14 v1.1) in **both** renderers, pinned by nine shared
  fixtures at `tests/fixtures/overlap_cases.json`.
- **Chrome:** one masthead on every route — the full banner (`BannerMobileV2` / `BannerDesktopV2`,
  coordinates baked in; the v2 JSON files are documentation and are imported by nothing) plus the
  `.homenav` tab row. `.banner` carries the app's ONLY top safe-area inset, +4 px when installed.
- **Pickers:** a drawn face over an invisible native control, so iOS keeps its wheel and calendar.
- **Off-service (D4/E3)** from `mysports.viewer_game_eligibility`, never recomputed in JS.
  **Favorites (D6):** `data/favorites.json`, 13 teams. **Market-pending (E5)** in
  `pipeline/reconcile.py`; the rule is `access_status = 'unverified'`.
- **Per-sport bands:** every band reports its counts, not only bands with something hidden
  (`4250aa9` — do not regress).
- **Navigation:** `web/lib/routes.js` is the single route-list definition.

## THE HEADLINE OPEN ITEM — the announcement horizon

**~529 of ~1,379 games have zero `game_broadcasts` rows.** Ruled in
`05-home-page-decisions.md` **§9 — NETWORK TBD is a fourth state**, always shown, never filtered,
counted on its own line, mutually exclusive with market-pending. Implemented in prompt 24. Read §9
before touching any count line.

## Open

- **Rendering-contract v1.7** — the program card (`claude/program-card-design-v1.md`), studio-show
  bookends, the grid "now" marker, and `open_ended` ↔ `render_policies` reconciled in one change.
  **This is the gate** for studio shows, WWE/AEW, UFC, and for NASCAR data to become visible.
- **506sports NFL maps → `market_coverage_nfl`** (~Sept 8–9). Resolves E5's market-pending games; on
  the critical path for September 13.
- **NHL and NBA hold only date-driven partial seasons** (47 and 19 games). `nba-BOS`, `nba-PHX`,
  `nba-POR` have art and no games for that reason. A one-time bootstrap is the fix.
- **NHL/NBA `team_records` are season 2025 by design** (prompt 37); their cards show thin standings
  until a 2026-27 standings load exists.
- **NFL/NBA adapters do not carry a conference.**
- **The list card's abbreviation step is not implemented** — the grid's fourth concession. Its one
  residual at 390 px is *UT Rio Grande Valley*, 24.57 px short with the record already dropped.
- **The list card re-tiers on cold load** (v1.6.13, known and accepted): the tier settles when the
  webfont resolves, so the first paint uses the character-count size.
- **The 500–699 px band** stretches the phone stage to 253 px — one breakpoint at 700. Options: cap
  `.bn-mobile` at ~480 px centred on the stage ground, or move the breakpoint to the 560 px the card
  uses. Not ruled.
- **The banner glow ellipses' 0.021 / 0.028 outer stops** leave a 3.4/255 edge at stage y=−20, beside
  the clock. It is an ARTWORK fix, not CSS — fading the stops to zero repaints 10.6 % of the visible
  stage by up to 6/255 (measured, prompt 45).
- **1D's gold sport-week heading line and 1F's `--ink` venue token are Cowork's calls, open to veto.**
- **The venue now shares the team names' token** and is separated from them by size alone (12 px vs
  14 px). If that reads too bright on the device the fix is a new palette step, not a weight.
- **HELD FOR JOE — twelve MLB rows stuck at `in_progress`** (kickoffs 2026-09-01/02). The DISPLAY
  guard shipped; the backfill is a database write and was deliberately not made.
- **A pipeline logic gap behind those rows:** `schedule_refresh` failed three times on 2026-09-02 with
  `FileNotFoundError: artifacts/validation/mlb_2026_teams.json`; something wrote `completed_at` on all
  twelve without setting `result_status='final'`.
- **TBS has no mark and it is a LIVE gap** — 2 loaded `game_broadcasts` rows, no art in
  `assets/network-logos/`. Sourcing it is Cowork's job.
- **`unverified` is load-bearing semantics** — now documented in `data/authority_rules.json` `_about`
  and `adapters/README.md`.
- **The privacy gate before the Cavs season (late October):** production is a public URL. Confirm no
  loaded broadcast row publishes the unannounced WUAB/RESN arrangement.
- **CBJ watch escalation ~Sept 15** (ask first). **IndyCar**: 2027 schedule, October.
- **The unruled backlog:** E8, E9, E11, E12, E13, E15.
- **The enhancement register §1–§13 are still project-only.** Joe to supply.
- **The design builders are project-only** — `build_demo.py`, `app_template.html`, `build_banner.py`,
  `markkit.py`. `docs/design/mobile_demo.html` is a TEMPLATE (`__DATA__`, `__GRIDSVG__`, …), so the
  repo copy cannot be rebuilt from the repo. A filing item, not a defect.
- **`--faint` reaches 3.63:1 on the card top and true AA is unreachable there.** Joe's call, accepted.
  **Not a defect to re-raise.**

## Working rules (binding)

1. Certify Python for Windows.
2. Never write to the repo while a Claude Code prompt is in flight.
3. Secret gate every commit, ADDED lines only, with `grep`; never `findstr`.
4. Stage by explicit path; never `git add -A`.
5. Run-workflow-never-Re-run.
6. DB: additive over destructive; SELECT-and-paste first; close (`valid_to`), don't delete.
7. Unattended runs: self-committing stages, 2-strikes-skip, hard stops only for secret-gate /
   destructive-DB / push-reject.
8. WUAB/RESN sources never named.
9. Loader-written provider facts never become reconciled observations.
10. Check the register §7–§13, the home-page decision record, and this file before re-raising any
    settled decision.
11. Cowork's bridge shell calls git with `--no-optional-locks`.
12. **`next build` cannot run locally** — Next interpolates the absolute path into a single-quoted JS
    string and this repo lives under `Joe's Projects`. Fires only for `app/apple-icon.png`,
    `app/icon.png`, `app/manifest.js`. Vercel builds at a path with no apostrophe; `next dev` is
    unaffected. **Ruling: do nothing.** Never set `experimental.useWasmBinary`. **Standing caution:
    the repo path contains an apostrophe and will keep breaking tooling that interpolates paths into
    quoted strings.**
13. **A numeric threshold is measured against the LOCAL background, never a global corner sample.**
14. The DB hard stop is "no direct Postgres connection, no writer credential, no DML" — PostgREST
    reads with the publishable anon key are the app's normal read path and are always allowed.
15. `npm run test:unit` is `node --test "test/**/*.test.mjs"` — quoted glob.
16. Colour tokens are read from `web/app/globals.css`, never quoted from the mockups.
17. **Edit JSON data files through a parser, never line-based**, and assert nothing but the intended
    key changed.
18. **Team-name resolution is exact-match within sport**, never substring or fuzzy — and MLB canonical
    names are nickname-only, so cross-check a second key such as `abbreviation`.
19. **Never issue an unbounded PostgREST select.** It silently caps at 1,000 rows and returns no
    error. Use the paginating `restAll()`. Pin regression tests to the **call site**, never a row
    count, or the test rots as the season grows.
20. **Never edit a source file with a bare repeated string replace.** Use line-anchored surgery or a
    parser, and assert only the intended region changed.
21. ~~`git diff --ignore-cr-at-eol`~~ **RETIRED** — the condition it waited on was met. Kept as a
    numbered stub so rules are never renumbered under a session that memorised them.
22. **Before asserting what a component does, read the component and cite file and line — never the
    contract document that describes it.** A contract says what a component SHOULD do; only the file
    says what it DOES. Prompt 46 found its own brief naming `fitNameAndRecord()` as the grid's fit
    function when it belongs to the list card and the grid never calls it.
23. **When a change alters anything the locked reference implements, `docs/design/mobile_demo.html`
    changes in the same commit.** A reference that lags the app stops being an authority and becomes
    a second opinion.
24. **A count computed on the Python side is no evidence the JS runtime agrees.** Pin the runtime path
    on every kind of input it can receive.
25. **A prompt is done when the deploy is green and the device agrees, not when it commits.**
26. **The gate and the commit are SEPARATE COMMANDS.** The runner's exit code and its parsed counts
    decide — never the last command in a chain. `b1b1d9b` went out red because a commit was
    `&&`-chained after a gate whose final command was a `grep` that succeeded.
