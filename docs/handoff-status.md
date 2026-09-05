# MySports — Handoff Status (rewritten 2026-09-05, prompt 46 stage 2)

**This file lives in the repo** at `docs/handoff-status.md` and is mirrored to the Claude project at
`claude/handoff-status.md`. The repo copy is the source; the project copy is written from it. Edit here.

Read first for any session picking up MySports. Companions: **`docs/enhancement-register.md`** (§1–§17, all
in the repo — check there before re-raising any decision), **`docs/feature-study/05-home-page-decisions.md` — BINDING** (D1–D6, the D3
amendment, §9 NETWORK TBD, §11 mobile page order, §12 the DATE/WEEK headers, §13 the 2026-09-05
review), `docs/rendering-contract.md` **v1.7**, `docs/rendering-contract-mobile.md` (Addendum
v1.2 + M19/M20), **`docs/design/program-card-design-v1.md`** — the program card's design of record,
in the repo since prompt 48 stage 0 along with the ten events & shows research documents under
`docs/research/`. `docs/research/README-events-docs.md` maps their Project names to their repo paths.

## Repo state

main, HEAD is prompt 48's stage-9 commit. Gates: **443 Python tests + 1 skipped**, **329 JS unit
tests**, smoke **30/30**, qa-shots **14/14**. Tree clean apart from always-untracked `assets/` (and
`web/qa/`, which prompt 46 added to `.gitignore`).

**PROGRAMS ARE LIVE.** 307 non-game programs render on both the phone grid and the listings -
NASCAR 98, studio shows 111, AEW 35, WWE 36, IndyCar 18, UFC 9 - under rendering-contract **v1.7**,
each carrying an eligibility verdict from migration 0014.

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

- ~~Rendering-contract v1.7~~ **SHIPPED** in prompt 48 stage 2 (`376ef36`) — the program card on both
  grids, the list-card variant, the now marker, studio bookends, and the `open_ended` ↔
  `render_policies` reconciliation, all in one change. The gate it held is open: studio shows,
  WWE, AEW, UFC, IndyCar and NASCAR all render.
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
- ~~The enhancement register §1–§13 are still project-only.~~ **CLOSED** — §1–§17 are in the repo.
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
27. **Check the schedule before a bulk database write, and never run two at once.** Prompt 46's
    pre-approved `--all` reconcile started at 13:40:38 and the scheduled daily refresh — already
    running since 13:37:02 — died five seconds later with `ERROR: deadlock detected` in its fixture
    loader. The cron is `0 11 * * *` and drifts by up to four hours, so "it is the afternoon" is not
    an answer; `gh run list --workflow schedule_refresh.yml -L 1` is. The same rule is why prompt
    47's NASCAR load waited for its own NHL/NBA bootstrap to finish rather than running beside it.
28. **A Python-side parse is no evidence GitHub Actions agrees.** PyYAML validated a
    `bootstrap_season.yml` that Actions could not parse at all, and prompt 46 shipped it green. An
    Actions expression is substituted everywhere in a `run:` block — inside shell comments too — and
    an empty one is a syntax error for the whole file. `tests/test_workflows.py` is the guard.
29. **A text write with no `newline=` produces different BYTES on Windows than on the runner.**
    Python's text mode translates every `\n` to the platform separator, so
    `path.write_text(x, encoding="utf-8")` emitted CRLF on this laptop and LF on Actions - one
    adapter, two byte streams, depending on where it ran. `adapters/common.py`'s `dump_json` and
    `write_text` did exactly that, and `scripts/build_cap_table.py` did it to two tracked files.
    **Any writer that can reach a tracked file passes `newline="\n"` or writes bytes.**
    This is rule 1 in a costume; it gets its own number because rule 1 did not stop it.

    **`tests/fixtures/*` is `-text` ON PURPOSE** (prompt 48): recorded fetches are asserted as
    bytes, four tests pin a `sha256` and one pins a byte count, and normalisation on checkout
    would break those on every machine but the recording one. So a recorded page KEEPS its CRs -
    `indycar_2026_schedule.html` carries 5,727 of them - and "no CR under `tests/fixtures/`" is
    the wrong rule. The right one is **disk bytes == index bytes**, which
    `tests/test_fixture_bytes.py` asserts for both fixture directories.

    **How it hid.** `.gitattributes` declares `*.json text eol=lf`, which normalises on read, so
    git compared an LF blob against a CRLF working copy and reported the tree clean; git's stat
    cache then never re-compared them. Prompt 49 stage 0 measured **34 tracked files** whose disk
    bytes differ from their blobs - pure line-ending churn, identical payload. Five were restored
    (the four `tests/fixtures/*_raw.json` and `web/test/fixtures/team-colours.json`); the other
    **29 are an open item**, because renormalising them rewrites 29 files and touches blame, and
    that deserves its own commit and Joe's sign-off rather than a ride-along.


---

## 2026-09-05 night run (prompt 46)

Ran on `main` from `6b3bc58`. Final HEAD **8f63741**. Gates moved
**232 + 1 / 259 / 30 / 14** → **280 + 1 / 290 / 30 / 14**.

| stage | commit | what shipped |
|---|---|---|
| 1A | `6d9e168` | standalone headroom +7 → +4 |
| 1B | `f46a57c` | symmetric header spacing; tiles→section gap = bar→tiles gap |
| 1C | `56e15f3` | styled pickers over native controls; gold sport-week, long date |
| 1D | `66df3fd` | two-line season-week headings, sport-week in gold |
| 1E | `eb22693` | grid name·record space, all-zero records absent (contract v1.6.14) |
| 1F | `e1d44ee` | venue one step brighter; 05 §13 records the batch |
| 2 | `588065a` | this file rewritten; the old chrome's leftovers retired |
| 3 | `2127d75` | one telecast ladder; the re-reconcile (run id 81) |
| 4 | `d6c19c7` | `db/enums.json` + row-level quarantine in the loader |
| 5 | `569aef0` | D1 the first band, D5 the 1592 px composition |
| 6 | `3fd5f6c` | bootstrap takes NHL/NBA date ranges — **the loads did not run** |
| 7 | `8f63741` | NASCAR adapter + recorded feeds — **the load did not run** |

**The phone-grid tripwire was re-baselined once, in 1E, and held for every stage after:**
CFB `2026-09-05` 62 blocks / {240, 223} / **1073** (unchanged); MLB `2026-09-03` 3 / **228** / **577**
(was 231 / 582 — M2 stopped measuring a second space it never drew).

**The one database write:** the stage-3 re-reconcile, run id 81, 1,384 games in 172 s. Sanity gate
passed on all seven criteria; the change set was provably bare-only (78 rows: nfl 24 + nhl 38 +
nba 16 moved `no_linear_telecast` → `tbd`). Backups at
`artifacts/backups/{games,viewer_game_eligibility}_2026-09-05T133646Z.csv`.

### Opened by this run

- **NHL and NBA season loads still owe their data.** The workflow can now do it
  (`nhl_from`/`nhl_to`, `nba_from`/`nba_to`) but the loads must run **in the workflow, not from this
  laptop**: measured at stage 0, ESPN answered **403 three times out of three** and
  `api-web.nhle.com` answered **200 on 2 of 5** bounded attempts. Both blocks are local — the daily
  refresh uses the same adapters from GitHub's network and is green. Someone has to be present for
  the sanity gate (NHL near 1,312, NBA near 1,230, a shortfall over 5 % is a stop).
- **NASCAR needs two migrations before its 98 programs can load**, both named in `8f63741`:
  `game_broadcasts` has no `program_id` and `game_id` is NOT NULL, so a program cannot own a
  broadcast row; and `programs` has no natural key, so there is nothing to upsert on and a second
  run would insert 98 duplicates.
- **v1.7 now has NASCAR data waiting for it** — the adapter and three recorded feeds exist; nothing
  renders a program until the contract lands.
- **1D's gold sport-week heading line and 1F's `--ink` venue token are Cowork's calls, open to veto.**
- **D1's three states are pinned by fixtures but only `tonight` was screenshot** — the run happened
  at 10:04 ET. Injecting a different `now` into a server render would mean a debug query parameter
  on a production page.
- **`programs == games` is no longer a database-wide invariant** — one-directional now: every game
  has a program, not every program has a game.

---

## 2026-09-06 programs run (prompt 47)

Ran on `main` from `0a6c617`. Final HEAD **d921576**. Gates **280 + 1 / 290 / 30 / 14** →
**320 + 1 / 298 / 30 / 14**.

| stage | commit | what shipped |
|---|---|---|
| 1 | `798251c` | migrations 0012 + 0013; the reconciler guard for a nullable `game_id` |
| — | `743c2bc` | **fix**: `bootstrap_season.yml` did not parse and never assigned its ranges |
| 3b | `8782f94` | `vs` retired; `(neutral site)` on the venue line (contract v1.6.15) |
| 3 code | `69aaea5` | per-race NASCAR broadcasts; `pipeline/load_programs.py` |
| 2 | `34aaef0` | NHL + NBA 2026-27 loaded via Actions — **1,384 → 3,868 games** |
| 3 load | `042a231` | 98 NASCAR race sessions + 98 broadcasts, idempotent |
| 10 | `d921576` | fail-honest NASCAR refresh step |

**Stages 4–9 were not built.** See "What this run could not do" below.

### The two defects this run found in its own predecessors

1. **Prompt 46's `bootstrap_season.yml` never worked.** A shell comment inside the `run:` block
   contained a literal empty Actions expression, so the file failed to parse — every push since
   `3fd5f6c` died in 0 s — and separately `NHL_FROM`/`NBA_FROM` were read but never assigned. PyYAML
   validated it green, which is rule 24 in a new costume. Fixed in `743c2bc` with a 19-assertion
   guard (`tests/test_workflows.py`).
2. **Prompt 46's `--all` reconcile deadlocked the scheduled refresh.** Today's 11:00 cron
   (run `33969416271`) died at 13:40:43 with `ERROR: deadlock detected` in the fixture loader — five
   seconds after that reconcile began writing at 13:40:38. **New working rule 27** below.

### Corrections to the record

- **ESPN is not blocked from this laptop.** Prompt 46 reported "403 three times out of three"; the
  403 came from an ad-hoc User-Agent it invented for the probe. Same URL, same second: project UA
  200, no UA 200, prompt 46's UA 403. NHL's flakiness *is* real and UA-independent (TLS resets).
- **`nascar_dark.png` was already committed** — stage 0 was told to check whether it needed to ride
  a commit; it did not.
- **0009 had already built** `studio_shows`, `studio_show_instances`, `game_broadcasts.window_start/
  window_end`, and every `sport` and `program_type` enum value. 0013 therefore contains **no
  `ALTER TYPE`** and extends the studio tables rather than creating them.

### What this run could not do, and why

**Every document naming the 2026 slots, networks, durations and verified source URLs is absent from
the repository.** `claude/` does not exist; `program-card-design-v1.md`, `research-summary-2.md`,
`research-studio-shows.md`, `research-wwe.md`, `research-aew.md`, `research-ufc.md`,
`research-nascar.md` and `research-indycar.md` are nowhere in the tree. What exists is
`docs/enhancement-register.md` (§1–§16 — the handoff's old "project-only" note was stale) and
`docs/research/{changelog,mlb,nba,nfl,nhl,summary}.md`.

So **stage 4** had no design of record to build from — its brief says "read it twice" — and
**stages 5–9** had neither the slots nor the verified URLs. `wwe.com/schedule` and
`allelitewrestling.com/aew-schedule` both 404 at their obvious paths and `press.wbd.com` 403s, so the
URLs cannot be recovered by guessing either. Writing those schedules from memory would put invented
broadcast facts into a production database Joe reads as truth about what he can watch — which the
brief forbids in its own opening and rule 9 exists to prevent.

**To unblock:** put those seven documents in the repo (or tell me their Project paths to copy from).

### Open items this run created

- **Programs have no eligibility rows and cannot.** `viewer_game_eligibility.game_id` is
  `text NOT NULL`, so there is nowhere to record whether a race is on a service Joe has. Needs the
  same treatment 0012 gave `game_broadcasts`. **Gates v1.7**, which is the first thing that shows a
  program to a reader.
- **NHL loaded 1,344, not 1,312** — 84 games a club, internally consistent (1,344 distinct ids and
  external ids, 32 home clubs, no duplicates, all `REGULAR`). Recorded rather than rounded.
- **NBA loaded 1,206 against ~1,230** — −1.95 %, inside tolerance, cause not investigated.
- **NHL/NBA `team_records` are still season 2025** (prompt 37); their cards show thin standings.
- **No wrapped neutral-site case exists** — the longest neutral venue fits on one line even at 360,
  so v1.6.15's wrap rule is tested by construction, not by a screenshot.
- The refresh step was **not dispatched** tonight, deliberately — see rule 27.

---

## 2026-09-05/06 programs-live run (prompt 48)

Ran on `main` from `ef3d826`. Final HEAD is the stage-9 commit that carries this block. Gates moved
**320 + 1 / 298 / 30 / 14** → **443 + 1 / 329 / 30 / 14**.

**This is the run prompt 47 could not do.** Every document its stages 4–9 load from lived only in the
Claude.ai Project; Joe dropped the eleven of them into the repo, stage 0 committed them, and the rest
followed.

| stage | commit | what shipped |
|---|---|---|
| 0 | `1b20768` | the eleven events & shows source documents, verbatim from the Project |
| 1 | `27f570e` | migration 0014 — `viewer_program_eligibility`; the reconciler grows `--programs` |
| — | `77258ff` | **fix**: the NASCAR feed's times are Eastern, and a corrected time must not double the season |
| 2 | `376ef36` | rendering-contract **v1.7** — the program card on both grids, the list variant, the now marker |
| 3 | `5bca121` | IndyCar 2026 + migration 0015 (a NULL series cannot be a natural key) |
| 4 | `1d21442` | WWE — Raw, SmackDown and the PLEs |
| 5 | `3ec3231` | AEW — Dynamite and Collision, per-episode network |
| 6 | `83dea25` | studio shows — registry, 111 instances, the GameDay site parse, the crews |
| 7 | `50a5826` | UFC — 9 cards, plain, no invented segments and no invented CBS window |
| 8 | `3076900` | five more fail-honest refresh steps and a program reconcile |
| 9 | *(this commit)* | this file, the register close-outs, the changelog and the Project mirror |

### The database, before and after

| | before | after |
|---|---|---|
| `programs` | 3,966 | **4,190** |
| non-game programs | 98 (NASCAR only) | **307** — nascar 98 · studio 111 · aew 35 · wwe 36 · indycar 18 · ufc 9 |
| by type | race_session 98 | race_session 116 · studio_show 111 · weekly_show 68 · fight_card 9 · special_event 3 |
| `game_broadcasts` | 2,374 (98 on programs) | **2,681** (374 on programs) |
| `viewer_program_eligibility` | did not exist | **307 rows, 0 uncovered, 0 orphans** |
| `studio_shows` / `studio_show_instances` | 0 / 0 | **7 / 111**, every instance linked to its program |
| `games` | 3,868 | 3,883 — **+15 from the refresh run, not from this run** |

**The game side was provably untouched by every program stage.** The md5 over all 3,868 game verdicts
was `d4fa47cb02ab41427267dfcff1eb8440` before stage 1 and after stages 3, 4, 5, 6 and 7. It changed
only when the stage-8 refresh reconciled games, which is that workflow's job.

### The migrations

**0014 — `viewer_program_eligibility`.** The brief asked for 0012's shape on
`viewer_game_eligibility`: nullable `game_id`, a `program_id`, a one-subject check. **That works on
`game_broadcasts` and not here** — `game_id` is half `viewer_game_eligibility`'s PRIMARY KEY, so
"make it nullable" means dropping the primary key of the table the whole app reads its access
verdicts from, and the run's approval is *additive only, never a drop*. Built additively instead: a
separate table, column for column the sibling. Every existing count is then unchanged **by
construction** rather than by a `where game_id is not null` guard on each consumer.

**0015 — the race-session natural key survives a NULL series.** 0012's own finding in a second place.
It wrote *"NULLs are distinct in a unique constraint, so with game_id null every program broadcast
looks new and a re-load duplicates all of them"* — and the same sentence is true of `programs.series`,
which 0012's own index depends on. NASCAR carries a series; IndyCar runs one and carries none
(register §16 named that trap). Measured: two loads of the same 18 races produced 36 rows. 0015 adds
the `coalesce(series, '')` key, keeps 0012's index, and removes the 18 duplicates this run made —
scoped to `sport = 'indycar'`, raising rather than committing if any other sport moved.

### The tripwire

Held at CFB `2026-09-05` **62 / {240, 223} / 1073** and MLB `2026-09-03` **3 / 228 / 577** through
stages 0–5. It moved in stage 6, when the two CFB studio shows landed on that day, and the move is
fully accounted for:

| | before | after |
|---|---|---|
| blocks | 62 | **64** — College GameDay and Big Noon Kickoff |
| widths | {240, 223} | {240, 223, **205, 136**} — every GAME width unchanged |
| scrollWidth | 1073 | **1282** — the axis now opens at 9:00 AM for GameDay, earlier than the first kickoff |
| rows | 15 | 15 — both shows sit on ESPN's and FOX's existing rows |
| measured name width | 124 / 14744 | 124 / 14744 — **unchanged**, so no game name moved |
| MLB `2026-09-03` | 3 / 228 / 577 | 3 / 228 / 577 — untouched all night |

**New baseline: CFB `2026-09-05` = 64 / {240, 223, 205, 136} / 1282; MLB `2026-09-03` = 3 / 228 / 577.**

### Four defects this run found in data or code that predates it

1. **Every 2026 NASCAR race was four hours early.** `cf.nascar.com` writes `race_date` as
   `"2026-09-06T17:00:00"` with no zone and `parse_iso` stamps a naive value UTC, so the Darlington
   race — the one Joe is being asked to look at — sat at 1:00 PM instead of 5:00 PM. Established
   against ESPN's `racing/nascar-premier` scoreboard on six races: five agree with the Eastern
   reading to the minute, **including the Nov 8 finale, which is in EST**, so it is a wall clock and
   not a fixed offset. The DAYTONA 500 is a one-hour source disagreement and is pinned as one.
   **The 98 stored rows are still wrong** — correcting them changes a natural key, so it is a
   database decision and not a load.
2. **Fixing that would have doubled the season.** Every `program_type`'s natural key contains
   `start_at`, so a corrected time is a different key and tonight's refresh would have inserted 98
   second copies. `pipeline/load_programs.py` now refuses a row that matches a stored one on
   everything but `start_at` and says so with both times. Proved against the live rows: it fires on
   40 of 40 Cup races, and the stage-8 dispatch confirmed it on the runner.
3. **Two NASCAR races on FS2 read as watchable.** `adapters/nascar.py` wrote
   `access_status: "available"` for every broadcaster, and FS2 is in the profile's `unavailable`
   list. Fixed at the choke point rather than in the adapter: `load_programs.py` now classifies every
   broadcast row from `data/access_profile.json`, so all five adapters this run shipped inherit it.
4. **A slate ending at or after 03:00 read as already finished.** `web/lib/bandstate.js` — a UFC card
   at 9 PM with a 360-minute block closes at `"03:00"`, comes back as 180, and 180 is smaller than
   the window's own 14:00 opening, so D1 jumped to FINALS and rendered *"Nothing loaded for this
   viewing day yet"* over a card that had not started. A window cannot close before it opens; that is
   a wrap and is now read as one.

### Open items this run created

- **The 98 NASCAR rows are four hours early.** The correction changes a natural key, so a plain
  re-load duplicates rather than fixes — the moved-twin guard is what makes leaving them safe. It
  needs a Joe-approved delete-and-reload, or a targeted `update`. **This is the one thing on this
  list that a reader will notice.**
- **Ten brands have no mark**, so their endcaps render a typographic short title: `gameday`,
  `bignoon`, and the eight NFL studio-show keys. Nine of those also have **no colour** derivable from
  anything in the repo — `data/` has no network palette and the cached FOX and CBS wordmarks are
  monochrome — so they carry the grid's neutral `#4A505A`. Supply the marks through the marks
  pipeline and the colours derive.
- **Big Noon Kickoff's site is `tba` and its crew is `TBA`.** FOX Press Pass is now verified as
  fetch-clean but CONTENT-EMPTY: 200 on three paths, zero tables, zero occurrences of "Big Noon",
  because it is JS-rendered. The Wednesday research watch is the override path.
- **GameDay has one week's site**, Sept 5 Baton Rouge, from the one release recorded. Every other week
  is `tba` until its own release is recorded.
- **UFC segment times are not loaded** — the Paramount+ page carries the main-card start only.
- **UFC odds are not loaded** — register §9's provider key was not added, as the brief required.
- **The wwe.com dual listing** on Oct 10 and Nov 28 (ESPN Unlimited *and* Netflix): ESPN Unlimited
  only is loaded. Close it from a U.S.-specific release.
- **AEW ran the slot-default path.** `press.wbd.com` answers 200 but carries no AEW content at its
  root, and no trade had republished a monthly schedule. 33 of 35 rows are tiered `slot_default`, and
  the adapter re-reads allelitewrestling.com nightly to report drift.
- **Countdown to All Out is not loaded** — a source gap, not a scope decision: the doc gives its time
  but not its network.
- **Four studio shows named in the brief are not loaded** — Sunday NFL Countdown, the Prime TNF
  pregame, the Netflix pregames and the NASCAR pre/post shows. None has a verified 2026 slot in
  `docs/research/studio-shows.md` §1, and the brief's own rule is *"Nothing not in the doc"*. Each is
  recorded in `data/studio_shows.json` with its reason.
- **The archived desktop grid is still game-only.** `draw_program_card()` and a `--programs` input
  exist and are tested, but the daily `render_all` job writes no programs file beside the validation
  fixture, so nothing feeds it. The drawing is ready; the feed is not built.
- **NHL and NBA `team_records` are still season 2025** (prompt 37) — unchanged by this run.
- **The chip row is unchanged.** Register §16's eight tiles plus the ALL bar already matched the
  rulings; the only thing missing was §9's NASCAR series sub-filter, which lands as a SECOND row
  beneath the tiles so the tile geometry §16 froze does not move.
- **Two of Cowork's calls are open to veto**: programs as rows in the D1 first band on the days they
  air, and the list-card variant derived from the grid card.

### Corrections to the record

- **`src/` does not exist.** The brief calls the Python SVG renderer "the renderer under `src/`"; it
  is `scripts/render_day.py`.
- **`docs/research/changelog.md` does not exist** — the file is `docs/research/research-changelog.md`.
- **Register §16 supersedes §13's chip roster**, which the brief's stage 2c did not account for:
  NASCAR and IndyCar share one Racing chip and the ALL bar is a full-width row. The shipped
  `SPORT_FILTERS` already matched §16 and was left alone.
- **`docs/research/studio-shows.md` §1 does not carry Sunday NFL Countdown**, which the brief lists
  among the shows to load.
- **The ESPN Press Room GameDay page has no weekly Date/Site/Game table.** Its one table is a
  historical January bowl table; the weekly site is prose inside each week's own release.

### Stage 8 dispatched, and every new step ran green on the runner

Rule 27 checked first: the last scheduled run had completed (as a failure - the 0012-era deadlock) at
13:37Z, the next was thirteen hours out, and nothing from this run was still writing. Dispatched as
run **33994233255**; the `refresh` job succeeded.

| step | what the runner logged |
|---|---|
| NASCAR (prompt 47's) | `programs 0 \| broadcasts 0` and **`MOVED-TWIN SKIPPED 98 row(s)`** - the guard fired on every race and stopped the duplication it was written for |
| IndyCar | 18 parsed, `programs 18 \| broadcasts 18`, access available 18 |
| WWE | 33 weekly shows + 3 PLEs, `programs 36 \| broadcasts 36` |
| AEW | 35 episodes, `programs 35 \| broadcasts 70`, `source tiers: research_document 2 \| slot_default 33`, **no DRIFT line** - the site still agrees with the slot file |
| UFC | 9 cards, `programs 9 \| broadcasts 9` |
| Studio shows | 109 instances, `programs 109 \| broadcasts 140`, `registry 7 shows \| instances 109 written, 109 linked` |
| Reconcile program eligibility | `reconciled 0 game(s) and 307 program(s)` |
| Reconcile canonical facts (existing) | `reconciled 15 game(s) and 0 program(s)` |

**109 and not 111** because the step passes no `--from` and so starts at today: the Aug 29 GameDay and
Big Noon instances are not regenerated, and the two already loaded stay. Not a loss - the count in the
database is still 111.

**The NASCAR line is the one to read.** Without the guard that step would have inserted 98 second
copies of the 2026 season tonight, and Joe would have seen every race twice.
