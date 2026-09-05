# Prompt 46 — the unattended night run (rebuilt 2026-09-05): UI batch, documents, reconciler ladder, enum hardening, D1 band + D5 composition, NHL/NBA seasons, NASCAR

**Run in Claude Code**, in `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` on `main` at `6b3bc58` or a descendant (prompt 45's final HEAD; gates there: Python 232 + 1 skip, JS 259, smoke 30/30, qa-shots 14/14). Straight through, no pause, nobody reading mid-run. Eight stages, the first with six self-committing units, in the merged-unattended shape of prompts 35–45: preconditions checked **once** at the top and never re-asserted by sha; every stage and unit gates, commits and pushes on its own; two strikes then skip; a hard stop stops *that stage only* and never rolls back a green one. Hard stops: the secret gate, a push reject, and **any database write not named in the pre-approvals below**. Standing rules on every commit: stage by explicit path, never `git add -A`; secret gate with `grep` (never `findstr`) on added lines (`git diff --cached | grep -E "CFBD_API_KEY=[A-Za-z0-9]{20,}"` prints nothing); push and print `git rev-parse HEAD` and `git rev-parse origin/main`; Windows-certified Python (`encoding="utf-8"` on every `open()`, ASCII-only console output, no glibc-only `strftime` directives); JSON through a parser; no bare repeated string replaces; measure numeric thresholds against the local background (rule 13); color tokens read from `globals.css`, never retyped (rule 16); before asserting what a component does, open it and cite file and line (rule 22); when a change alters anything the locked reference implements, `docs/design/mobile_demo.html` changes in the same commit (rule 23). No `npm ci`. This is `main`: every push is the production deploy. The repo is frozen for Cowork while this runs.

**The gate is a separate command, and the commit is another.** Run each runner on its own, capture its exit code, parse its counts, compare them to the baseline, write the four numbers into the report — and only then, in a separate command, stage and commit. Never `&&` or `;` a commit onto a test run. If a commit is nevertheless found red after its push, fix forward in the next commit and name the red sha in the report; never amend or force-push.

**Pre-approved database writes (Joe, 2026-09-04, reconfirmed 2026-09-05), each one backed up with `scripts/backup_table.py` first, dry-run with `--emit-sql` first, and sanity-gated as written in its stage:** (a) the re-reconcile in stage 3; (b) the NHL and NBA regular-season loads in stage 6; (c) the NASCAR programs load in stage 7. Nothing else touches the database. No DDL — if a stage finds it needs a migration, it reports the migration and stops that stage.

**Read first:** `docs/handoff-status.md` (stale — post-prompt-23 on facts; trust the tree; stage 2 rewrites it and later stages re-read the rewritten one); `docs/feature-study/05-home-page-decisions.md` (all sections, §12 is prompt 45's; D1–D6, the D3 amendment and §9 bind stage 5); `docs/rendering-contract.md` (v1.6.13) and `docs/rendering-contract-mobile.md`; `claude/program-card-design-v1.md` is *not* consumed here.

**Source of stage 1:** Joe's second review of the installed app on the iPhone 14 Pro Max, 2026-09-05, after prompt 45 shipped. Every stage-1 change applies to all three routes where the element exists; History's heading text stays untouched.

---

## Stage 0 — preconditions and baseline, once

- `HEAD == origin/main`, `6b3bc58` or a descendant. Record it. Tree clean apart from untracked `assets/` and `web/qa/` (`artifacts/` is gitignored). If anything else is dirty or untracked, something ran after prompt 45 — **stop the whole run and say so.**
- `.env` present with `SUPABASE_DB_URL` and `CFBD_API_KEY` (values never printed). The project interpreter is Python 3.13 (`psycopg` lives there; bare `py` is 3.14 and is not the project's).
- Run the four gates and **record them as this run's baseline.** Below 232 + 1 / 259 / 30 / 14 means the tree is not what prompt 45 reported — stop the whole run and say so. Every later gate is "green, and no fewer tests than the stage before."
- **Record the frozen phone-grid geometry** from a real render (wait for `document.fonts.ready`): CFB `2026-09-05` = 62 blocks / widths 240 and 223 / scrollWidth 1073; MLB `2026-09-03` = 3 / 231 / 582. **Stage 1E legitimately changes this** (a space enters the name·record run and 0-0 records leave it, and M2 sizes the day from the widest rendered team line). Unit 1E re-baselines it deliberately, with the reason and the deltas in the report; every later stage's tripwire is the **post-1E** geometry, and it must not move again.
- Provider reachability from this laptop, one call each, honest UA: ESPN scoreboard, `api-web.nhle.com` (resets intermittently here — the bounded retry exists), `cf.nascar.com` series feeds for series 1, 2, 3. Record status codes. A provider that is down tonight skips the stage that needs it; it does not fail the run.
- Housekeeping: delete the untracked folder `artifacts/cloud/` if it still exists (an abandoned plan). Leave every `~syncthing~*.tmp` file under `assets/` alone.
- Locate and cite with lines, for stage 1: the `.banner` standalone rule prompt 45 added (`globals.css` ≈1681–1690); `.homenav` and its bottom border; `.pagehead` (prompt 45) on all three pages; the ALL bar (`.sportbar`?) and the tile row (`.chiprow`/`.spbtn`) in `web/components/Filters.js`; `DatePicker` in `Filters.js` (the `<label htmlFor="viewing-day">` inside the `<h1>`, the `<input type="date">`); `web/components/WeekSelect.js` (the `<select>`, its trigger styling, the label-builder that produces `NFL Week 1 · Wed Sep 9 - Mon Sep 14, 2026` and the calendar-week form); `weekChoices()` and the week block `<h3>` in `web/app/weeks/page.js`; the `YOUR TEAMS` heading (`.favlabel` / band-head treatment from prompt 31 stage 4) and the first list card; `fitNameAndRecord()` and `row2Size()` in `web/lib/format.js`; the block name·record run in `web/components/MobileGrid.js` and the TBD card path; the venue line in `web/components/MatchupCard.js` and its rule in `globals.css` (token and weight today); `web/test/pagehead.test.mjs` (prompt 45's eight tests). List every test that pins any of these strings or geometries; stage 1 re-bases, never loosens or deletes.

---

## Stage 1 — Joe's 2026-09-05 UI batch (six units, six commits)

### Unit 1A — halve the headroom addition · commit `banner: standalone headroom +7 -> +4`

Joe: *"Now there is too much space above MySports TV. Whatever padding was added to the last version, reduce that amount that was added by half."*

The prompt-45 rule `@media (display-mode: standalone) { .banner { padding-top: calc(env(safe-area-inset-top, 0px) + 7px); } }` becomes `+ 4px` (half of 7 is 3.5; integer pixel, the difference is invisible at 3× DPR — log it). Rewrite the comment above it to say 4 and cite this prompt. Nothing else changes. Re-run prompt 45's simulated-inset harness with `calc(47px + 4px)`: first ink at **y = 62 ± 1 at 428 and 61 ± 1 at 390**; the seam columns still ≤ 2/255; no-inset heights identical. Shots into `artifacts/qa/2026-09-05-night/1A/`.

### Unit 1B — the spacing equations · commit `chrome: symmetric header-row spacing; tiles-to-section gap = bar-to-tiles gap`

Three rules, each stated as a measurement Joe made on the screen, each applied on all three routes and at both breakpoints (measure and apply desktop separately with desktop's own values).

**Rule 1 (Joe's items 2–4).** Measure `gap_below` = the vertical distance from the bottom of the header row (the lower of the `<h1>` box and the picker box) to the top of the ALL SPORTS bar. Set `gap_above` = the vertical distance from the bottom edge of `.homenav`'s dividing hairline to the top of the header row **equal to `gap_below`**. Implement it on whichever element owns that space today (the page container's padding-top or `.pagehead`'s margin-top — cite which, and remove any competing spacing so exactly one rule carries it). History has no picker; its row is the `<h1>` alone and takes the same rule with its own measured `gap_below`; its heading text is untouched.

**Rule 2 (Joe's item 8, which wins over item 6).** Measure `gap_bar_tiles` = the distance from the bottom of the ALL SPORTS bar to the top of the tile row. Set the distance from the bottom of the tile row to the top of the first section below it **equal to `gap_bar_tiles`**: on Today that is the `YOUR TEAMS` heading's top (its text box, not a wrapper), on Weeks the week block's top edge, on History whatever is first below the tiles (name it). **After stage 5 lands, the first section on Today is the D1 band** — the rule is "the first block below the tiles", so stage 5 inherits it without a new rule; write the CSS so that is true (a margin on the tile row's wrapper, not on the `YOUR TEAMS` heading).

**Check only (Joe's items 5–6, superseded by item 8 by his ruling).** Measure the distance from the bottom of the `YOUR TEAMS` heading (its hairline, if the hairline is what the eye reads as the bottom) to the top of the first list card, and report it beside `gap_bar_tiles`. If the two differ by more than 2 px, say so — Joe expected them to agree, and item 8's value stands either way.

Acceptance: a table per route × width (390, 428, 1280) of `gap_above`, `gap_below`, `gap_bar_tiles`, `gap_tiles_section`, `gap_teams_card` before and after, from `getBoundingClientRect`, with the rule-1 and rule-2 pairs equal to the pixel after. Screenshots of all three routes at 390 and 428 into `.../1B/`. The frozen grid geometry unchanged. Re-base `pagehead.test.mjs` if it pinned any of these numbers.

### Unit 1C — the pickers · commit `pickers: styled triggers over native controls — gold sport-week prefix, long date`

Joe, items 7, 10, 11: the WEEK picker at rest reads **`NFL Week 1`** (or `CFB Week 1`) in app gold, then the date range in the subtle gray; calendar weeks (MLB, NHL, NBA, ALL) have no prefix and their date range stays in the current ink color — only NFL/CFB get gold + gray. The DATE picker stays a real calendar but renders **`Friday, September 4, 2026`** on the page, and takes the WEEK picker's shape, size, text treatment and chevron so the two read as a matched pair.

**Why it is a rebuild, not a restyle.** Both are native controls (prompt 23 chose them so iOS supplies the wheel and the calendar). A native `<select>` cannot render two colors, and a native `<input type="date">` renders its own locale text (`Sep 4, 2026`) that no CSS reaches. So the visible trigger becomes ours and the native control stays, invisibly, on top of it:

1. One shared wrapper — `.picker` (name yours; one class, used by both) — `position: relative; display: inline-flex; align-items: center`, the trigger pill's plate, border, radius, height, padding, font and chevron **taken from the current WEEK trigger's rules** so the WEEK picker's visible geometry does not change (measure its box before and after; identical). Inside it, the visible trigger `<span aria-hidden="true">` and the native control positioned `absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; appearance: none; font-size: 16px` (16 px or larger, so iOS does not zoom the page on focus). The native control keeps its `id`, its `<label htmlFor>` in the `<h1>`, its `name`, its `onChange`/navigation, and its focusability; `.picker:focus-within` draws the focus ring on the wrapper so keyboard users see focus. The accessible name is the label; the visible trigger is `aria-hidden`.
2. **WEEK trigger content** comes from the same builder that makes the option label — extend `WeekSelect.js`'s label-builder to return parts (`{ prefix, range }` for season weeks, `{ range }` for calendar weeks) and keep the joined form for the `<option>` text. Render `<b class="pk-sport">NFL Week 1</b> <span class="pk-sep">·</span> <span class="pk-range">Wed Sep 9 - Mon Sep 14, 2026</span>` for season weeks; `<span class="pk-range pk-range--solo">Mon Aug 31 - Sun Sep 6, 2026</span>` for calendar weeks. Tokens: `.pk-sport` `var(--gold)`; `.pk-range` the subtle-gray token the list cards use for the standings line (read it from `globals.css` — rule 16 — and name it); `.pk-range--solo` the trigger's current ink color. Never derive the parts by splitting the joined string on `·`. The trigger mirrors the `<select>`'s current value on the server render (the URL is the source of truth, so a change navigates and re-renders — confirm there is no client state to keep in sync; if there is, mirror it in `onChange` before navigating).
3. **DATE trigger content** = `longDay(viewingDay)` — it already produced `Friday, September 4, 2026` for the old `<h1>`; reuse it, do not add a formatter. Single span, trigger ink color, same chevron as WEEK.
4. Widths: the WEEK trigger keeps prompt 45's `flex: 1 1 auto; min-width: 0; max-width: 100%`; the DATE trigger takes the same rule. At 390 report the DATE trigger's width beside `DATE`, and the WEEK trigger's with `NFL Week 12 · Wed Nov 25 - Mon Nov 30, 2026` (prompt 45's measured widest) — neither may exceed the row; if the WEEK trigger's parts wrap or clip at 390, `.pk-range` takes `text-overflow: ellipsis; overflow: hidden; white-space: nowrap` and the prefix is never the part that clips. Report what happened.
5. Desktop: same wrapper, same rules; measure at 1280.
6. Tests: the trigger renders the parts for a season week and a solo range for a calendar week; the DATE trigger text equals `longDay()` of the viewing day; the native control is still present, labelled, and is the element that receives the change event; `.picker`'s box equals the pre-change WEEK trigger box at 390 and 428.
7. **Plainly in the report:** iOS behavior (tap opens the wheel / the calendar through an `opacity: 0` control) is not verifiable from Chromium. Joe's phone is the authority; his checklist covers it.

### Unit 1D — the week block heading splits for season weeks · commit `weeks: season-week block heading on two lines; sport-week line in gold`

Joe, item 9: the NFL/CFB block headings wrap. **For season-week sports only**, the `<h3>` renders two lines: **`NFL Week 1`** on the first (its current position), the date range on the second. Calendar-week headings stay on one line, unchanged.

**Cowork's call, flagged for veto (Joe did not rule on it):** the first line is gold, matching the picker's prefix — the same string in two places should wear the same color. The second line keeps the heading's family, at a size no larger than line one; pick between the heading's current size and the count-line size by render, and report which. Use the same `{ prefix, range }` parts from 1C's builder, not a second formatter. Screenshot the NFL and CFB week blocks and one calendar-week block at 390 and 428 into `.../1D/`; confirm no wrap at 360 either. Prompt 36 C3's rule that both pages share day-heading rules is untouched — this is the *week* heading.

### Unit 1E — grid cards: a space in the name·record run, no record when 0-0 · commit `grid: space between name and record; all-zero records omitted`

Joe, items 12–13: on every grid matchup card the record follows the team name with a space; when the record is all zeros nothing follows the name.

1. In `fitNameAndRecord()` (and wherever `MobileGrid.js` assembles the run, block and TBD card alike — cite lines) the joiner becomes a single space. **The list card shares this function since prompt 42** — the card renders name and record as separate spans, so it should be unaffected; prove it with a card DOM diff before and after, and if the function's output feeds the card's text too, branch on the caller rather than changing the card.
2. A record is "all zeros" when every numeric component is 0: `0-0`, `0-0-0` (NHL), `0-0-0-0`; parse, do not regex-match a literal. Such a record is treated as absent by the run, so the fit ladder (shrink-keep-record → drop record → shrink name → abbreviation) starts from "no record" for that team. The list card's `Record (if one exists)` rule is **not** changed here; report whether any list card renders a 0-0 today, as an open item for Joe.
3. M2 sizes each day from the widest rendered team line, so PX and block widths move. **Re-baseline the tripwire** after this unit: re-measure CFB `2026-09-05` and MLB `2026-09-03`, report old → new for blocks, widths and scrollWidth with the explanation, and carry the new numbers as the tripwire for stages 2–8.
4. Rendering contract: append this entry verbatim to `docs/rendering-contract.md`'s changelog as the next version after v1.6.13:

   ```markdown
   ### v1.6.14 — 2026-09-05 — grid name·record run: separator and all-zero records
   Joe's ruling from the installed app. (1) In the block and TBD-card name·record run a single
   space separates the name from the record; the run was previously concatenated. (2) A record
   whose every component is zero (0-0, 0-0-0, 0-0-0-0) is treated as absent by the run: nothing
   follows the name and the fit ladder begins at "no record". Widths under M2 move accordingly;
   the phone-grid tripwire was re-baselined in prompt 46 unit 1E. The list card's record rule is
   unchanged by this entry.
   ```

5. Rule 23: if `docs/design/mobile_demo.html` implements the run, apply both changes there in this commit; if its grid section is the pre-rendered `__GRIDSVG__` and does not compose the run, say so and leave it.
6. Tests: the run for `("Tigers","64-75")` contains `Tigers 64-75`; for `("Buckeyes","0-0")` equals `Buckeyes`; for an NHL `0-0-0` likewise; the fit ladder result for a 0-0 team equals the result for a null record. Screenshots of the CFB `2026-09-05` grid at 390 (a week-1 day, so 0-0 records are common) and an MLB day into `.../1E/`.

### Unit 1F — the list card's venue line · commit `card: venue line one step brighter than the standings lines`

Joe, item 14: make the venue easier to distinguish from the subtle text used for the record, standing and games-back. Ruling: **one step brighter, still under the team names.**

Read the venue rule and the standings-line rule in `globals.css` (cite tokens). Try `var(--dim)` at weight 500 first; compare by render against plain `var(--ink)` at the current size; **pick by looking and report which and why**, with the contrast ratio of each against the card's local background (rule 13). Whichever wins, the venue must still read as quieter than the team names. Rule 23: align `docs/design/mobile_demo.html`'s venue rule in the same commit. Screenshot one MLB card and one CFB card at 390 and 428 into `.../1F/`; card heights unchanged (prompt 42's 132.3 / 160.3 / 168.3); the card DOM unchanged.

### Stage 1 doc append — `docs/feature-study/05-home-page-decisions.md`, verbatim, as the next section

Append at the end of unit 1F's commit (so one commit carries the record of the batch):

```markdown
## NN. SECOND INSTALLED-APP REVIEW — 2026-09-05, Joe's rulings, shipped in prompt 46 stage 1

1. **Headroom.** The installed-app addition above the banner is 4 px, not 7 (half of prompt 45's
   addition; Joe: "too much space").
2. **Header row breathes evenly.** The space between the tab row's hairline and the DATE / WEEK /
   HISTORY header row equals the space between that row and the ALL SPORTS bar.
3. **One control block.** The space between the tile row and the first section below it equals
   the space between the ALL SPORTS bar and the tile row. Joe's item 6 (use the YOUR TEAMS→card
   distance) was superseded by his item 8; the first-section rule is written so the D1 band
   inherits it.
4. **Pickers.** Both pickers render a styled trigger with the native control invisible on top
   of it, so iOS keeps its wheel and calendar. WEEK: `NFL Week 1` / `CFB Week 1` in gold, the
   date range in the standings-line gray; calendar weeks show only the range in the trigger's
   ink. DATE: `Friday, September 4, 2026`, the same pill and chevron as WEEK.
5. **Season-week block headings** are two lines: the sport-week line, then the range. The
   sport-week line is gold (Cowork's call, matching the picker; open to veto).
6. **Grid cards:** a space before the record; an all-zero record is absent (contract v1.6.14).
7. **List card venue** is one step brighter than the standings lines (token recorded in the
   commit).
```

Replace `NN` after reading the file (§12 is prompt 45's). Cowork mirrors; do not mirror.

---

## Stage 2 — documents (one commit)

1. **Rewrite `docs/handoff-status.md`** from ground truth: `git log b44893e..HEAD`, the changelogs in `docs/rendering-contract.md` (now v1.6.14) and `docs/rendering-contract-mobile.md`, `db/README.md`, `db/migrations/` (0011 latest), the README or header comment of anything those commits added, and prompts 43, 44, 45 and this run's stage 1. Keep its shape — Repo state · Deployed · What works now · Open · Working rules — and its voice: facts with shas. Carry every existing working rule and add the five earned since it was written: (22) before asserting what a component does, read the component and cite file and line, never the contract that describes it; (23) when a change alters anything the locked reference implements, `docs/design/mobile_demo.html` changes in the same commit; (24) a count computed on the Python side is no evidence the JS runtime agrees — pin the runtime path on every kind of input it can receive; (25) a prompt is done when the deploy is green and the device agrees, not when it commits; (26) the gate and the commit are separate commands — the runner's exit code and parsed counts decide, never the last command in a chain (`b1b1d9b` went out red this way). Under Open, list exactly these: rendering-contract v1.7 (program card per `claude/program-card-design-v1.md`, studio-show bookends, grid "now" marker, `open_ended` ↔ `render_policies` in one change) — the gate for studio shows, WWE/AEW, UFC and for NASCAR becoming visible; 506sports → `market_coverage_nfl` (~Sept 8–9, critical for Sept 13); NFL/NBA adapters carrying a conference; the list card's abbreviation step; UT Rio Grande Valley still truncating at 390; the list card's cold-load re-tier (v1.6.13, known cost); the privacy gate before the Cavs season; the CBJ watch ~Sept 15; the unruled E8/E9/E11/E12/E13/E15 backlog; IndyCar (2027 schedule, October); the 500–699 px band where the phone stage stretches to 253 px (single breakpoint at 700 — options: cap `.bn-mobile` at ~480 px centered on the stage ground, or move the breakpoint to the 560 px the card uses); the banner glow ellipses' 0.02 outer stops leaving a 3.4/255 edge beside the clock (artwork fix, not CSS — prompt 45 report); any list card rendering a 0-0 record (stage 1E's open item); the week-trigger clip decision if 1C had to ellipsize. Where a claim cannot be verified from the repo, say so beside it rather than dropping it.
2. **Retire the old chrome's leftovers**, each only after a grep proves nothing reads it: `docs/design/banner/banner-mobile.svg`, `banner-pc.svg`, `navbar.html`; the `banner-layout.json` read/write path in `scripts/build_brand_marks.py` (lines ≈72, 326, 328, 343 — a guarded no-op since `560d1c1`); `web/public/brand/tv-cutout.png` (the compact bar's TV — distinct from `web/public/banner/tv-cutout.png`, which stays); the two dead `.wordmark` blocks in `globals.css` (≈151–162 and ≈1691–1693 — re-locate by content, the numbers have drifted); `web/components/Nav.js` (no importers per prompt 43). Report each grep.
3. `data/authority_rules.json` `_about` (parser edit, assert only that key changed) and `adapters/README.md`: `access_status = 'unverified'` is load-bearing — "regional window, no market conclusion yet, pending a map" — and the sole input to market-pending; an adapter writing it loosely manufactures false market-pending rows.
4. `docs/design/mobile_demo.html`: its `.mhair` is `rgba(255,255,255,.7)`; the app draws `rgba(0,0,0,.22)`. Align the reference to the app (rule 23). Nothing else in the file beyond what stage 1 already changed.
5. `.gitignore`: add `web/qa/` under the existing "generated validation/rendering artifacts" comment. Do not move or delete the folder; do not change where the script writes.
6. Gates, commit, push.

---

## Stage 3 — the reconciler ladder, and the bare-game rows (pre-approved write a)

`pipeline/reconcile.py` — the reason / `network_status` ladder in `reconcile_game()` has been wrong twice (prompt 24 fixed `reason` for bare non-CFB games; the twin on `network_status` at the `sport == "cfb"` split still labels a bare NFL game `no_linear_telecast`, so its card reads "No linear telecast" under a NETWORK TBD badge).

1. Extract the ladder into a **pure function** over `(sport, active_rows)` returning `(reason, network_status)`, called from `reconcile_game()`; no DB handle, no side effects. Every rows-present case must produce **byte-identical** strings to today (the database holds 94 distinct reason strings; do not rewrite any).
2. Fix the twin: with zero active rows, `network_status` is `tbd` for **every** sport, matching `reason = "no telecast observed"`. `no_linear_telecast` is only ever a conclusion from rows that exist.
3. Tests, no DB: bare list for cfb and for nfl/nhl/nba/mlb; rows present and `unverified`; `unavailable` ("not receivable: …"); `out_of_market` with `blackout_rule OUT_OF_MARKET`; linear available; stream only; verify access; authority conflict; local feed carrier TBA. Assert the pair.
4. **Pre-approved write (a): re-reconcile.** Back up `games` and `viewer_game_eligibility`. Dry-run first and put the diff summary in the report. Then re-reconcile all games (prompt 24 did 1,379 in 2m33s). **Sanity gate, hard stop if it fails:** the counts of eligible, market-pending and hidden games are identical before and after; genuinely-unavailable (rows present, not receivable) is identical; eligibility coverage stays 0 uncovered / 0 orphans; and the only rows whose `network_status` changed are ones with zero active broadcast rows (expected nfl 24 + nhl 38 + nba 16 as of Sept 3 — the number has moved; report it). Record the run id in `db/README.md`.
5. Gates, commit, push.

---

## Stage 4 — loader enum hardening

One mistyped enum (`carriageCertainty="UNVERIFIED"` in an `access_status` slot) once aborted a whole daily refresh. Fix the class, and do it **before** stage 6's loads so they run under it.

1. `scripts/build_enums.py` generates **`db/enums.json`** from `db/migrations/*.sql`: every `CREATE TYPE … AS ENUM` and every later `ALTER TYPE … ADD VALUE`, in order. A test asserts the checked-in JSON equals a fresh generation.
2. In the loader path (read `pipeline/db.py`'s upsert and the step that assembles rows; cite file and line), validate every enum-typed column against `db/enums.json` before the statement is built. An invalid value **quarantines that row** — one warning line naming table, column, value and the row's natural key — and the run continues; a summary count at the end of the step; a non-zero quarantine count is a warning, never a failure. Same fail-honest-per-unit shape the standings step uses.
3. Tests in `--emit-sql` mode: a payload where one row carries `carriage_certainty="UNVERIFIED"` loads the rest and quarantines that one; a valid payload quarantines nothing; a value added by a later `ALTER TYPE` is accepted.
4. Gates, commit, push.

---

## Stage 5 — D1 the time-adaptive first band, and D5 the desktop composition

The binding record is `docs/feature-study/05-home-page-decisions.md`. Read D1, D1b, D2, D5, D6, the D3 amendment, §12 and stage 1's new section before touching anything; do not re-raise them.

**D1 — a first band on the Today page that follows the clock.** Three states: **Tonight** (before the day's prime window: the games from the window onward), **On now / Next up** (inside it: in-progress games from the live overlay, then the next kickoffs), **Finals · Tomorrow** (after the last game: today's finals, then tomorrow's first games). The header always states the viewing day and the clock used — **`Friday, September 4 · 9:14 PM ET`** — and Joe reconfirmed this on 2026-09-05: now that the page heading reads `DATE`, this band header is the one place the viewing day is spelled out in words; keep it as ruled. There is always a "See all today" escape that jumps to the sport bands below. The prime window is per sport-day from `data/render_policies.json` `prime_window_start` (NFL 13:00, CFB 12:00, all others 18:00; the day opens at the earliest sport with games) through the helper prompt 20 shipped in `web/lib/primewindow.js` — the ruling unconsumed since. The viewing day uses the 03:00 ET cutover already in `gridmodel.js`. The band is *added above* the sport bands and *below* the tile row, and **inherits stage 1B's rule 2**: the tile-row-to-first-section gap it now occupies must measure `gap_bar_tiles`, and `YOUR TEAMS` below it keeps the band-to-band spacing the sport bands use. The banner and its wrapper, the header row and pickers (1B/1C), the ALL bar and tiles, the sport bands, their count lines (every band reports — `4250aa9` must not regress), D4/E5/network-TBD counts, the favorites float (D6) and the list cards are unchanged. **Off limits — as they stand after stage 1, not as they stood on the 4th:** `web/components/MatchupCard.js` and its CSS (1F's venue token included), `web/lib/useTextMeasurer.js`, `fitNameAndRecord()` (1E's form), `row2Size()` in `format.js`, `web/lib/cardGeometry.js`. If the band renders cards, it renders `MatchupCard` as it is; if it needs its own row and that row fits a team name, it imports the card's fit function — never a fork. Compare the card DOM before and after this stage. Two traps prompt 42 fell into and climbed out of, both of which this stage's shape invites: a `useLayoutEffect`/`useEffect` swap keyed on `typeof window` produced exactly the hydration mismatch React refuses to patch (the cards froze at their server sizes), and gating the first paint on `document.fonts.ready` left seconds of wrong sizes on an 80-card page. The band's state is computed once on the server from the request's `now` and reaches the client as props; the client does not recompute it until the 15-minute refresh. Measure against the served chunk, not a stale dev bundle.

**The derivation is written exactly once:** `web/lib/bandstate.js` (name yours) takes `(games, now, policies)` and returns the state, the header text and the row set. It is pure, takes `now` as an argument, and is pinned by **shared fixtures** at `tests/fixtures/band_state_cases.json` so renderer v1.7's §11.9 Tonight line can be pinned to the same cases later: Sept 5 CFB at 09:00 / 13:30 / 20:00 / 23:59 ET; Sept 13 NFL at 10:00 / 13:30 / 16:30 / 22:00; a day with only MLB (18:00 window); a day with no games (E10 copy — honest, names the day); a favourite in the On-now set. The state is computed on the server from the request time (the page is force-dynamic) and re-rendered by M11's 15-minute client refresh; no hydration mismatch — test it.

**D5 — the composition at ≥1600 px:** band left, grid right; below 1600 the band sits above the grid; **never grid-first**. The threshold is the memo's corrected arithmetic (1120 grid minimum + 400 band + 24 gap + 48 padding = 1592). Today page only, and only the content below the tile row — the banner keeps its own wrapper (prompt 43 unit 3) and the header row keeps 1B's rules.

Acceptance: unit tests for every fixture; screenshots into `artifacts/qa/2026-09-05-night/5/` at 390 for all three states (inject `now`), at 1440 (band above grid) and at 1600 and 1920 (side by side); the banner heights re-measured at 390 and 1440 and unchanged; 1B's gap table re-measured on Today with the band as the first section and the rule-2 pair still equal; the post-1E phone-grid geometry unchanged; sport-band count strings unchanged on `2026-09-03`, `2026-09-05`, `2026-09-13`; the card DOM unchanged; card heights still 132.3 / 160.3 / 168.3 and the truncated-name count at 390 over the four loaded days still 1 (prompt 42's residual). **Joe judges this on his phone after the run — it goes live — so the report names what he should look at.** Gates, commit, push.

---

## Stage 6 — NHL and NBA regular seasons (pre-approved write b)

The database holds `nhl` 47 and `nba` 19 games because the daily refresh loads days, not seasons; `nba-BOS`, `nba-PHX`, `nba-POR` have art and no games for that reason. Load the 2026-27 regular seasons the way prompt 23 loaded CFB/NFL — as a one-time bootstrap, with `schedule_refresh.yml` untouched.

1. Read `pipeline/bootstrap_season` / `.github/workflows/bootstrap_season.yml` and the NHL and NBA adapters. Add date-range inputs for the date-driven sports (`nhl_from/nhl_to`, `nba_from/nba_to`) with a per-date (or per-week where the provider offers it) loop; a zero-game date is logged and skipped, never fatal. **Ids are the trap:** NBA games are `nba-{espnEventId}` and must be loaded through the ESPN path — **never** the `cdn.nba.com` league file, whose `nba-{nbaGameId}` scheme would silently break the live-overlay join (the guard from `65cfdf2` must stay green). NHL games are `nhl-{nhlId}` from `api-web.nhle.com`. Season labelling follows what the existing 47 and 19 rows carry — check, don't assume — and remember ESPN mislabels seasons (read `season.displayName`). If stage 0 found ESPN blocked from this laptop, the NBA half skips with the status code in the report; NHL proceeds.
2. Back up `games`, `game_broadcasts`, `viewer_game_eligibility`. Dry-run with `--emit-sql`; report the row counts it would insert per sport.
3. Load. **Sanity gate, hard stop if it fails:** no pre-existing count decreases; NHL lands near 1,312 and NBA near 1,230 regular-season games (report the exact numbers; a shortfall over 5% is a stop, not a shrug); eligibility coverage grows to match (0 games without a row); `bootstrap_season` remains manual-dispatch; `schedule_refresh.yml` byte-identical. Then reconcile the new games (the daily will not — and stage 3's ladder is what reconciles them) and re-check coverage. Report wall-clock per sport.
4. `team_records` for NHL/NBA are season 2025 by design (prompt 37); the cards will show thin standings until a 2026-27 standings load exists — say so, do not load standings.
5. Gates, commit (workflow + adapter changes only; data is not in git), push.

---

## Stage 7 — NASCAR: the adapter, recorded fixtures, and the programs load (pre-approved write c)

**Know what this buys before you start.** The app renders `games`; a race is a `program` (spec v0.5, migration 0009: `programs` supertype, `program_type = race_session`, `sport = nascar`, `series ∈ cup | oreilly | truck`) with no `games` row, and nothing in `web/` renders programs until rendering-contract v1.7 lands. So this stage makes the data and the adapter exist — the Racing chip's empty state stays honest until v1.7. Do not invent a race card.

1. `adapters/nascar.py` against the three `cf.nascar.com` series feeds (prompt 17 probed them from this laptop: 113 / 92 / 73 entries carrying start and end times and a track id — those counts include practice and qualifying; per register §7 Q2 **race sessions only**). Honest UA via `adapters/common.py`. Record one raw feed per series under `tests/fixtures/` (sha-listed) so the adapter is tested against bytes, like the other four.
2. Emit `programs` rows: `sport nascar`, `program_type race_session`, `series`, `title`, `start_at`, `expected_duration_min` from the feed's start/end (with `duration_defaults.json` provenance if the feed lacks one), venue as the schema allows (`venue_id` FK or `location_text`), `source_tier`. Broadcasts: read migration 0009 to see whether a broadcast row can attach to a program without a `games` row. If it can, emit them with the feed's broadcaster; **if it needs DDL, do not write a migration — load programs only, and put the exact migration this needs in the report.**
3. Back up `programs` (and `game_broadcasts` if touched). Dry-run; report counts per series. Load the **2026 season** (the playoffs run Sept 6 – Nov 8). **Sanity gate:** every existing `programs` row untouched (the 1,379-plus game programs, by count and by a checksum of their ids); the new rows carry no `game_id`; nothing in `web/` throws on a day that now has a program without a game — render `2026-09-06` at 390 and 1440. **Find and fix the proof that will break:** prompt 17's "programs == games" zero-behaviour proof becomes one-directional ("every game has a program"), or this load fails a test that was pinning the wrong invariant.
4. Gates, commit, push.

---

## Stage 8 — the handoff, and the report

Append a "2026-09-05 night run" block to `docs/handoff-status.md` (stage 2 wrote the rest): each stage's and unit's commit, the new gate counts, the loads' row counts, the re-baselined tripwire, and the open items this run created — v1.7 now has NASCAR data waiting for it; the broadcast-attachment migration if stage 7 needed one; the 2026-27 NHL/NBA standings load; 1D's gold heading line and 1F's token, both open to veto. Commit, push, verify the rev-parse pair. Report the production deployment state for the final HEAD if it can be read from here; if not, say so.

**Report**, the standing shape: per stage and unit what shipped and its commit; the baseline gates and the gates after every commit; every backup path and every dry-run summary; every measurement table stage 1 asked for; the tripwire before and after 1E and unchanged thereafter; every judgment call and why; what was skipped by two strikes and why; and **anything in this prompt that turned out wrong**, as its own section — prompt 45's brief carried six.

**End with the checklist for Joe, numbered, exhaustive, phone first:**

1. Close the installed MySports TV app fully (swipe up from the bottom and pause to open the app switcher, then swipe the MySports TV card up and off the screen) and reopen it from the Home Screen.
2. Top of the banner: the gap above `MYSPORTS TV` should now read as half the extra it had this morning; still no line above the artwork.
3. On `TODAY`: the space above `DATE` (from the tab row's line) should look the same as the space below it (to `ALL SPORTS`); the space between the tiles and the first section should look the same as the space between `ALL SPORTS` and the tiles.
4. The date pill should read `Friday, September 5, 2026` (or whatever the viewing day is) in the same shape as the week pill. Tap it — the iOS calendar must open. Pick a day; the page must move to it.
5. Tap `WEEKS`. The week pill should read the sport-week in gold and the dates in gray for NFL and CFB weeks, and just the dates for other sports. Tap it — the iOS wheel must open. Pick `NFL Week 12` and confirm the pill does not clip.
6. On an NFL or CFB week, the block heading should be two lines: `NFL Week 1` then the dates, with no wrapping.
7. Tap `HISTORY` and repeat step 3's spacing check.
8. Back on `TODAY`, open the grid (any sport with games): team names should show a space before the record, and week-1 teams at 0-0 should show no record at all.
9. On the list cards, the venue line (`Progressive Field`) should be easier to tell apart from the record and standings lines above it, while still quieter than the team names.
10. The first band on `TODAY`: read its header (the day and the time), confirm its state matches the time you are looking (Tonight / On now / Finals · Tomorrow), and tap `See all today`.
11. `WEEKS` should now list NHL and NBA weeks; the Racing chip's empty state should still be honest.
12. On the laptop: the Today page at whatever width the browser opens to — the header row and pickers, the band above the grid below 1600 px and beside it above.
13. Anything wrong: screenshot it with the step number and paste it into the Cowork chat.
