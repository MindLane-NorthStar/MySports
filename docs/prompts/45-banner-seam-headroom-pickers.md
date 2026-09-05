# Prompt 45 — banner seam and headroom, DATE / WEEK header pickers, ALL SPORTS bar

**Run in Claude Code**, in `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` on `main` at prompt 44's final HEAD or a descendant. Straight through, no pause. Three self-committing units in the merged-unattended shape of prompts 35–44: preconditions once at the top; each unit gates, commits and pushes on its own; two strikes then skip that unit; a hard stop stops *that unit only* and never rolls back a green one. Hard stops: the secret gate, a push reject, anything that touches the database. **The gate is a separate command and the commit is another** — run each runner on its own, capture its exit code, parse its counts, compare to the baseline, write the numbers into the report, then stage and commit in a separate command. Stage by explicit path, never `git add -A`; secret gate with `grep` (never `findstr`) on added lines (`git diff --cached | grep -E "CFBD_API_KEY=[A-Za-z0-9]{20,}"` prints nothing); push and print `git rev-parse HEAD` and `git rev-parse origin/main` after every unit. Windows Python: `encoding="utf-8"` on every `open()`, ASCII-only console output. No `npm ci`. The repo is frozen for Cowork while this runs.

**Read `docs/handoff-status.md` first** for the working rules — rule 22 above all: before asserting what any component does, open it and cite file and line. Every claim in this brief was written from prompts 25, 31, 36, 43 and 44 and the 2026-09-04 phone screenshots, not from the tree; where a citation does not match what you find, report the discrepancy and implement against the tree.

**Source of these changes:** Joe's review of the installed Home Screen app (iPhone 14 Pro Max, 2026-09-04) on the Today and Weeks routes. Every change below applies to **all three routes** (`/`, `/weeks`, `/history`) where the element exists, with one exclusion: **History's header text is not touched** (Joe: "we will address it later").

---

## Stage 0 — preconditions and baseline, once

- `HEAD == origin/main`; tree clean apart from untracked `assets/` and `web/qa/` (`artifacts/` is gitignored). Anything else dirty: stop and say so.
- Run the four gates (Python, `npm run test:unit`, smoke, qa-shots) and record them as the baseline. Below prompt 44's reported counts means the tree is not what its report says — stop the whole run and say so. If you cannot find prompt 44's numbers, prompt 43's were Python 232 + 1 skip / JS 251 / smoke 30/30 / qa-shots 14/14; nothing may be below those.
- **Confirm prompt 44 landed:** `web/app/globals.css` `.banner` reads `padding-top: env(safe-area-inset-top, 0px);` with no `max()` and no `- 18px`. If the old subtracting form is still there, prompt 44 did not land — apply its one-line change as the first step of unit 1, cite it, and say so in the report.
- Record the frozen phone-grid geometry from a real render (CFB `2026-09-05` 62 / 240,223 / 1073; MLB `2026-09-03` 3 / 231 / 582; wait for `document.fonts.ready`). The grids are untouched here; this is the tripwire that proves it.
- Locate and cite, with lines: `web/components/Banner.js` (the `<header className="banner">` and its `.bn-mobile` / `.bn-pc` mounts); `web/components/BannerMobileV2.jsx` (the `<svg viewBox="0 0 428 155">`, its ground rect, and every glow/halo shape and the gradient defs they use — note for each gradient whether `gradientUnits` is `objectBoundingBox` (the default) or `userSpaceOnUse`); the `.banner` rule block in `globals.css` (padding, background gradient, bottom border); `web/app/page.js` (`<h1>`, the `.controls` block, the ALL bar + `SportFilter`, the Day row with its `<label>`, date `<input>` and count text); `web/app/weeks/page.js` (`<h1>Weeks</h1>`, the chip row, the `WeekSelect` mount); `web/components/WeekSelect.js` (the `<label htmlFor="week-select">`, the `<select>`); `web/components/Filters.js` (the ALL bar's rendered string and its `aria-pressed`); every test that pins any of these strings or geometries (`grep -rn` across `web/test` for `broadcasts`, `Viewing day`, `Weeks`, `'All'`, `"All"`, `longDay`, `156.00`, `142.23`). Report the list; the units re-base these tests, never loosen or delete them.
- Locate prompt 43/44's simulated-inset harness under `artifacts/qa/2026-09-04-banner/tools/` (or wherever prompt 44 left it). Unit 1 re-uses it; if it is gone, rebuild the minimum — a Playwright run that overrides `.banner`'s `padding-top` with a literal in place of `env(...)` — and say so.

---

## Unit 1 — the banner: no seam, 18 px headroom · commit `banner: paint the safe-area band from the artwork; headroom 11 -> 18 in the installed app`

### 1a. Why there is a seam

Joe: *"Notice the faint line directly above MySports TV and the MLB logo which appears to be the seam between the gradient fade background of the banner and the pure background color extension behind the clock, bezel and battery."*

Prompt 43 unit 3 set `.banner`'s CSS background to the stage gradient and stated that in the safe-area padding above the phone SVG "nothing of the ground shows … except in the safe-area padding above it, which should read as the stage's top color." Prompt 44 verified exactly that: the padding band reads `#272727`. **That is the seam.** The band is flat `#272727`; the SVG's top row is not flat — the gold glow behind the wordmark and the warm glow behind the TV reach the artwork's top edge, so at `y = inset` there is a step from flat charcoal into a lit gradient at every x where a glow is present. It is invisible at x ≈ 214 (neutral ground) and visible under the wordmark and the TV — which is exactly where Joe saw it.

### 1b. The fix — the artwork paints the band

Make the SVG's **ground and glow layers** (never its marks) extend upward past the top of the viewBox, and let that overflow paint into the padding band. The element's box, height math (`width × 155 / 428`), the marks' coordinates and the 0–155 region's pixels do not change.

1. In `BannerMobileV2.jsx`, put `overflow="visible"` on the root `<svg>` (attribute or `style={{ overflow: 'visible' }}` — cite which and why).
2. Identify the ground rect and every glow/halo shape. Extend each of them upward so it begins at **`y = -90`** stage px and keeps its current bottom edge and x extent (a 59 px inset at 390 CSS px is 64.7 stage px; plus unit 1c's 7 px is 72; 90 leaves margin for taller future insets).
3. **The gradients must not move.** If a glow's gradient is `objectBoundingBox` (the default), stretching its rect stretches the gradient with it and the 0–155 region changes. For every such gradient, convert it to `gradientUnits="userSpaceOnUse"` with the absolute center/focal point and radius computed from the rect's *current* box, so that the visible region is pixel-identical before extending the rect. Do the arithmetic in a tiny script and paste it into the report; do not eyeball it. Gradients already in `userSpaceOnUse` need nothing.
4. Confirm nothing between the SVG and the viewport clips the overflow: `.bn-mobile`, `.banner`, `Chrome`'s wrapper and `body` — grep each for `overflow` and `clip-path`; report what you find. `.banner`'s CSS background gradient stays as the fallback underneath.
5. `web/lib/banner-mobile-v2.json` is documentation; it embeds the coordinates. Add a top-level `"headroom_paint"` note recording that the ground and glow shapes are extended to y = -90 for the safe-area band and that mark coordinates are unchanged — through a JSON parser (rule 17), not a string edit. Do not touch any mark entry.
6. `BannerDesktopV2.jsx` is untouched — the desktop breakpoint never has a top inset.

### 1c. The headroom — 11 becomes 18, installed only

Joe: *"Note the tight distance between the bezel and top of the 'MySports TV' text. I believe we need to add a smidge of padding."* Ruling: **18 px.**

This amends the banner iteration-9 gap (22 → 11) that prompt 44 enshrined as "the designed gap". Joe made both calls; the later one wins. The 11 stays baked into the artwork (coordinates are never hand-edited); the extra 7 comes from the wrapper, and only where an inset exists:

```css
/* installed on iOS the web view runs under the status bar; the artwork's 11 px
   headroom reads as tight against the bezel there (Joe, 2026-09-04) — add 7 so the
   wordmark's first ink sits 18 px below the inset. Browsers and desktop have no
   inset and are unchanged. Prompt 45 amends prompt 44's "absorb nothing". */
@media (display-mode: standalone) {
  .banner { padding-top: calc(env(safe-area-inset-top, 0px) + 7px); }
}
```

Place it directly under the existing `.banner` rule and rewrite prompt 44's comment above that rule so it records the amendment rather than contradicting it. Nothing else in the file for this unit.

**Cowork's call, flagged for veto:** gating on `display-mode: standalone` rather than adding 7 px unconditionally. Unconditional would add a 7 px ground strip above the banner on desktop and in Safari, change the banner element's height everywhere and re-base every height test for no visible benefit. If you find that the installed app does not match `display-mode: standalone` (it should — `manifest.js` declares `display: 'standalone'`), fall back to an unconditional `+7px`, re-base the heights, and say so.

### 1d. Acceptance

Everything into `artifacts/qa/2026-09-05-banner-seam/`.

- **Visible region unchanged:** render `BannerMobileV2` alone at 428 CSS px, DPR 3, before and after 1b, and diff the 0–155 region. Zero mismatched pixels is the expectation; anything above zero is reported with the diff image and explained (a converted gradient that did not land exactly is the likely cause — fix it, do not accept it).
- **Simulated inset, all three routes, 390 and 428:** the harness overrides `padding-top` with `calc(47px + 7px)` (the standalone rule cannot match in Chromium, so the harness applies the same arithmetic). Wordmark first ink at **y = 65 ± 1 at 428 and 64 ± 1 at 390** (47 + 7 + the 11.0 / 10.0 headroom prompt 43 measured).
- **Seam gone, measured not eyeballed:** on each shot sample a vertical run of pixels from `y = inset − 4` to `y = inset + 4` at three x positions — under the wordmark glow (x ≈ 100 at 428), under the TV glow (x ≈ 330), and neutral ground (x ≈ 214). Report the per-row luminance; the largest step between adjacent rows must be ≤ 2/255 at all three. The neutral column is the control (it should already pass); the two glow columns are the test. Also save a 3× crop of the band edge for Joe.
- **No inset, nothing changes:** desktop at 1280 / 1400 / 1440 and phone at 390 / 428 with `padding-top` at its natural value — the five banner heights from prompt 43 re-measured and identical; the tab-row seam still 0 px; no horizontal scroll.
- Gates: green, no fewer than the baseline. Re-base any test that read the JSON spec's key set.
- **State plainly that the installed app cannot be self-verified from Chromium.** Joe's phone is the authority.

Gate, commit, push.

---

## Unit 2 — `DATE` and `WEEK` headers with the picker beside them · commit `chrome: DATE / WEEK page headers carry the picker; Day row and count text retired`

### 2a. The ruling

Joe: *"Replace today's date with the word DATE and replace 'Weeks' with the word WEEK in the same large white text. Then relocate the date picker on TODAY to the right of the word DATE and the week picker on WEEKS to the right of the word WEEK — the picker moves up to the header line and sits directly to the right of the header text, aligned with it. Eliminate the broadcast count."* No colon on either word. History's header text is untouched.

This amends two earlier rulings, both by Joe, both recorded in `docs/feature-study/05-home-page-decisions.md`: prompt 31 stage 3 (the Day row below the tiles, carrying the `Day` label, the date input and the `N broadcasts` count) and prompt 25's "keep the `Day` label — it does real work in front of a control whose own text is a date". The heading now does that work.

### 2b. Today — `web/app/page.js`

1. The `<h1>` renders the literal string `DATE`. Do not rely on `text-transform`; the current heading renders mixed case (`Friday, September 4, 2026`), so there is none to rely on. `longDay()` loses this consumer — grep for others (prompt 36 D4 reused it for the grid header); keep it if anything else calls it, delete it only if nothing does, and report.
2. Wrap the heading and the date `<input>` in one row: `<div className="pagehead">` with `display: flex; align-items: center; gap: 12px` (take the gap from an existing spacing token if `globals.css` has one; rule 16). The heading is `flex: 0 0 auto`; the input keeps its current chip styling and intrinsic width. Vertical alignment is **centered on the heading's text box** — that is what "aligned with it" means here; measure it in the shot.
3. The input keeps `aria-label="Viewing day"` and its `id`. Make the heading text the control's visible label so the pairing survives in the accessibility tree: `<h1><label htmlFor={dayInputId}>DATE</label></h1>` — a `<label>` inside an `<h1>` is valid phrasing content, and tapping the word focuses the picker. If you find a reason this reads badly in the tree (report what a screen reader would announce), keep the bare `<h1>` and the `aria-label` instead and say so.
4. **Delete the Day row entirely:** the `Day` `<label>`, the row wrapper, and the count text (`80 broadcasts` / `9 MLB broadcasts` / singulars). Grep for the count formatter's other callers — the grid header (prompt 36 D4) also says "Broadcasts" and may share a helper; delete only page.js's use, keep any shared helper, and report. Remove the row's CSS if nothing else uses it (grep the class names across `web/app` and `web/components` first).
5. Block order after this unit: **header row (DATE + picker) → ALL bar → tile row → the bands.** Nothing below the tile row changes.

### 2c. Weeks — `web/app/weeks/page.js` and `web/components/WeekSelect.js`

1. The `<h1>` renders the literal `WEEK`.
2. `WeekSelect.js` carries the one real `<label htmlFor="week-select">` in the app (prompt 25 §4b protected it on purpose). It must survive as the heading: the same `.pagehead` row, `<h1><label htmlFor="week-select">WEEK</label></h1>` beside the `<select>`. If `WeekSelect` owns the label and the select as one block, lift the label out through a prop (or split the component) rather than rendering a second, hidden label — one label, one control. Report what you changed.
3. The select trigger keeps its chip styling. Give it `flex: 1 1 auto; min-width: 0; max-width: 100%` so the longest option label (`NFL Week 1 · Wed Sep 9 - Mon Sep 14, 2026` — find the actual longest from the loaded week list and quote it) cannot push the row past the viewport at 390. **Report the widest trigger label at 390 and whether the browser clips it**; a clipped trigger is reported, not hidden.
4. Delete the old `WEEK` row below the chips and its CSS if orphaned.
5. Block order after this unit: **header row (WEEK + picker) → ALL bar → tile row → the week block.** The per-day headers inside the week block (prompt 36 C3) are untouched.

### 2d. Both breakpoints

The `.pagehead` row is the same rule at every width. At ≥ 700 px the heading is larger and the tiles are fixed 36 px left-aligned; the picker sits to the right of the heading, centered, and keeps its desktop width. Screenshot `/` and `/weeks` at **390, 428 and 1280**, plus `/history` at 390 to prove its `<h1>` text and layout did not change. Measure and report: the heading's rendered font-size and line box, the picker's box, the vertical offset between the two centers (target 0 ± 1 px), and the row's total width at 390 (must not exceed the content width; no horizontal scroll).

### 2e. Doc append — `docs/feature-study/05-home-page-decisions.md`, verbatim, as the next section number

```markdown
## NN. DATE / WEEK HEADERS CARRY THE PICKER — 2026-09-04, Joe's ruling from the installed app

The Today heading no longer prints the viewing day and the Weeks heading no longer reads
"Weeks". Each reads a single word in the heading style — `DATE` on Today, `WEEK` on Weeks,
no colon — and the page's picker sits directly to its right on the same line, centered on the
heading's text box. The row is the first block on the page, above the ALL bar and the tiles.

Three earlier rulings are amended:

1. **Prompt 31 stage 3's Day row is retired.** The `Day` label, the date input's row below the
   tiles, and the `N broadcasts` count text are gone. The count duplicated what the bands
   already say (`6 airing · 48 TBD · 5 unavailable`) and Joe ruled it eliminated.
2. **Prompt 25 §4b's "keep the Day label" no longer applies** — the reason it existed (a
   control whose own text is a date needs a visible name) is now carried by the heading,
   which is the control's `<label>`.
3. **Prompt 36 C1–C3 keeps its week-format rules**; only the position of the picker and the
   heading text change. `WeekSelect`'s real `<label htmlFor="week-select">` survives as the
   heading.

History's heading is deliberately unchanged; Joe will rule on it separately.
```

Replace `NN` with the next section number after reading the file. Cowork re-mirrors the Project copy after the report; do not mirror anything.

### 2f. Tests

Re-base every test found in Stage 0 that pinned the `<h1>` strings, the `Day` label, the count text or the Weeks heading. Add one assertion per page that the `<h1>` contains a `<label>` whose `htmlFor` matches the picker's `id` (or, if 2b.3's fallback was taken, that the input still carries `aria-label="Viewing day"`).

Gate, commit, push.

---

## Unit 3 — the ALL bar reads `ALL SPORTS` · commit `filters: the ALL bar reads ALL SPORTS; geometry unchanged`

Joe: *"Make the ALL chip ALL SPORTS and keep its size as-is. I don't want to interrupt the balance horizontally that we've accomplished with this chip and the tiles below it."*

1. In `web/components/Filters.js` the bar's rendered string becomes `ALL SPORTS` (if a `text-transform: uppercase` rule already exists on the bar, `All Sports` in markup is acceptable; either way the rendered glyphs read `ALL SPORTS`). Its accessible name follows the visible text; `aria-pressed={!sport}` stays.
2. **Every other "All" stays.** Grep `web/app`, `web/components` and `web/lib` for `'All'` / `"All"` / `>All<` and list each hit with a decision: the bar (changed), the grid header's ALL treatment from prompt 36 D4 (unchanged), any `SPORT_LABEL` fallback (unchanged), anything else (unchanged unless it *is* the bar rendered through a second path — then change it and say so). One mental model across Today and Weeks means the bar reads `ALL SPORTS` on both, since prompt 36 C2 made them one component; confirm it did.
3. **Geometry is the acceptance.** Measure the bar's box (`getBoundingClientRect`) and the tile row's box at **390, 428 and 1280** before and after: identical to the pixel. Prompt 31 §2d's rules stand — same height as a tile, same radius, border and plate, edges flush with the tile row. If the longer string forces a wrap or a height change at any width, that is a defect to fix (letter-spacing or font-size on the bar's text only, never its box), not a change to accept.
4. Re-base any test that pinned the string `All` on the bar. Screenshot the bar active and inactive at 390 and 428 into `artifacts/qa/2026-09-05-banner-seam/`.

Gate, commit, push.

---

## Report

Per unit: what changed with file and line, the commit sha and the rev-parse pair, the acceptance evidence, every judgment call. Gates before and after each unit against the Stage 0 baseline. Call out specifically:

- **Stage 0:** whether prompt 44 had landed; the gradient-units finding for every glow in `BannerMobileV2.jsx`; the test list that pins the changed strings/geometries.
- **Unit 1:** the 0–155 diff result; the nine luminance columns (three x × three routes at each width) with the largest adjacent-row step per column; the first-ink y at 390 and 428; the five no-inset heights; the `display-mode` decision; the plain statement that the phone is unverified from here.
- **Unit 2:** the accessibility-tree decision on `<label>`-in-`<h1>` for each page; the widest week label at 390 and whether it clips; the center-offset measurements; `longDay()` and the count helper — kept or deleted, and why; the section number used in 05.
- **Unit 3:** the "All" occurrence table with decisions; the before/after bar and tile-row boxes at three widths.
- The frozen phone-grid geometry re-measured at the end, identical to Stage 0.
- Anything in this brief that was wrong against the tree, listed as its own section.

**For Joe, at the end of the report, numbered and exhaustive** (he will do this on his phone, not in a terminal):

1. On the iPhone, close the installed MySports TV app fully (swipe up from the bottom and pause to open the app switcher, swipe the MySports TV card up and off the screen).
2. Reopen it from the Home Screen icon.
3. Look at the top edge above `MYSPORTS TV` and above the MLB logo: there should be no horizontal line anywhere between the clock/battery row and the artwork.
4. Judge the gap between the status bar and the top of `MYSPORTS TV` — it should read as a comfortable margin, not crowded.
5. Tap `WEEKS`, then `HISTORY`, and repeat steps 3–4 on each.
6. On `TODAY`, confirm the heading reads `DATE` with the date chip directly to its right on the same line, no broadcast count anywhere, and the bar under it reads `ALL SPORTS` at the same size as before.
7. On `WEEKS`, confirm `WEEK` with the week dropdown to its right, then open the dropdown and pick an NFL week to see whether the longest label fits.
8. If any of steps 3–7 fail, screenshot it and paste it into the Cowork chat with the step number.

## Explicitly out of scope

- Anything in `pipeline/`, `adapters/` or the database.
- Both grids and the listings card (unit 2 reorders blocks above them; it does not touch them — the Stage 0 tripwire proves it).
- History's header text and any History-specific layout.
- `BannerDesktopV2.jsx` and the desktop artwork.
- Prompt 43's open items: the dead `.wordmark` CSS blocks, `web/components/Nav.js`, the old chrome references under `docs/design/banner/`, `scripts/build_brand_marks.py`, the 699/700 breakpoint step.
- Any redesign of the ALL bar's shape, height or width — Joe ruled the geometry stays.
