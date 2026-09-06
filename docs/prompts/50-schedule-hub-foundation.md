# Prompt 50 — the Schedule Hub foundation, the controls restack, hiding restored, and the grid header retired

**Run in Claude Code**, in `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` on `main` at `ec0f74f` or a descendant. Six stages, six commits, the merged-unattended shape of prompts 35–49 and every standing rule in `docs/handoff-status.md` (1–28): gate and commit as separate commands; stage by explicit path; secret gate with `grep` on ADDED lines only, never `findstr`; push and print the rev-parse pair; JSON through a parser; **locate by content and cite file and line before asserting what anything does** (rule 22); and `docs/design/mobile_demo.html` changes in the same commit as anything it specifies (rule 23).

**No database writes. No migrations. No pipeline or adapter changes.** PostgREST anon reads are the app's normal read path and are expected (rule 14). **Any DML is a hard stop.**

**Hard stops:** the secret gate, a push reject, any database write, and the geometry tripwire in stage 5.

**Hard-stop policy.** Stop that stage, leave earlier stages' commits alone, record what stopped and why, and continue to anything that does not depend on it. Never roll back a green stage because a later one failed. **The one exception is stage 1** — every stage after it assumes the app is a single route, so a stage-1 stop halts the run. Say so plainly if it happens.

---

## Preconditions — checked once, here

- `git rev-parse --short HEAD` == `ec0f74f`, and `HEAD == origin/main`.
- Python **465 passed + 1 skipped**, JS **329/329**, smoke **30/30**, qa-shots **14/14**.
- Tree clean apart from always-untracked `assets/` and **one untracked directory, `docs/ux-reference/`, holding two PNGs** — Cowork placed them 2026-09-06 with the repo idle. That is stage 0's input, not a precondition failure.
- **Geometry tripwire, recorded at stage 0 and re-checked in stage 5** (`document.fonts.ready` first): CFB `2026-09-05` **64 blocks / {240, 223, 205, 136} / scrollWidth 1282**; MLB `2026-09-03` **3 / {228} / 577**. Note the dates — prompt 36 nearly called a false hard stop by comparing a different slate.

---

## What this prompt is, and the one thing to understand before writing code

The app becomes **one page**. `TODAY`, `WEEKS` and `HISTORY` stop being three routes with a tab row and become one Schedule Hub whose state lives entirely in the address bar. Joe's rulings (`docs/hub/restructure-triage-2026-09-05.md` §6a, R1–R8) and the audit that verified them (`docs/hub/hub-audit-2026-09-05.md`) are both in the repo. **Read the audit's section A before touching anything** — it is a current, cited architecture map and it will save you the rediscovery.

**Two of Joe's rulings changed after the audit ran, and this prompt carries the new ones:**

1. **R3b is REVERSED.** Games on services Joe does not have are **hidden again**, restoring D4's filter-by-default. The audit's §I measurement is why: showing everything took the heaviest week from 109 cards to 195 and the page from 17,971 px to 32,917 px — a 39-screen phone page. **The day-strip mitigation the audit floated for WEEK + LIST is not needed and is not in this prompt.**
2. **The count line moves to the BOTTOM OF THE PAGE and becomes page-level**, not per band.

**The page Joe is building reads downward as a sentence:** *I am looking at the DAY view, ALL GAMES, LIST VIEW, ALL SPORTS (or one league), and here is the day I picked.* The stack order in stage 2 is that sentence, and it is why the picker moves below the tiles.

**The design of record for this restructure is `docs/ux-reference/schedule-hub-concept.png` and `schedule-hub-real-world-examples.png`** — Joe's own renderings, committed in stage 0. Read them as intent, not as pixel spec: they predate the programs load, so they show six league tiles where the app has eight, and they show no ALL SPORTS bar because they were drawn before register §16 moved ALL out of the tile row. **The app's eight tiles and its ALL SPORTS bar both stay.**

---

# Stage 0 — housekeeping · commit `docs: ux reference, the prompt archive 01-44, and the hub pointer`

Three unrelated pieces of filing, deliberately batched into one docs commit so they cost one gate rather than three.

### 0a. The design references

`docs/ux-reference/` holds `schedule-hub-real-world-examples.png` and `schedule-hub-concept.png`, placed by Cowork. **Commit them by explicit path.** These are the `docs/ux-reference/` renderings the restructure spec's §29 referred to and that every planning document since has recorded as missing — that item is now closed.

### 0b. The prompt archive — 36 briefs

`docs/prompts/` currently holds fifteen prompts and a README, filed by prompt 49 stage 2 from `Claude outputs\`. **Thirty-six more exist only in the Claude.ai Project, which Claude Code cannot read.** Cowork extracted them and left a zip.

1. Extract `Claude outputs\prompt-archive-delta.zip` (gitignored, 204,133 bytes) with Python's `zipfile` — **not a shell unzip**, the repo path contains an apostrophe and the archive path contains a space. It holds `prompts-01-44-delta/` (36 `.md` files) and `MERGE-NOTE.md`.
2. Copy the 36 files into `docs/prompts/`. **Their names do not collide with anything already there** — verify that before copying and stop if one does.
3. **Read `MERGE-NOTE.md` and do what its "What the README still needs to say" section asks.** Extend the existing `docs/prompts/README.md`; **do not replace it.** It must gain: the provenance of the new 36, the two real gaps (**prompt 39 exists nowhere at all; prompt 42's brief is gone though its handoff survives at `assets/handoff/banner-v2/HANDOFF-Prompt-42.md`**), the note that prompt 26 exists in two versions and both are filed, and the one disclosure — `12-overnight-web-app-skeleton.md` carries the Supabase **anon** key inline, which is publishable by design and already committed in `web/lib/config.js`. **Do not reconstruct 39 or 42 and do not write placeholder files for them.**
4. `docs/prompts/` should hold **52 files** afterwards: 51 prompts plus the README. Report the count.
5. Delete `Claude outputs\prompt-archive-01-44.zip` — a superseded first pass whose contents would duplicate what prompt 49 already filed. The delta zip stays.

### 0c. The hub pointer

**`docs/handoff-status.md` does not mention the Schedule Hub anywhere.** The authority document has no pointer to the largest structural change queued for the app. Add one short paragraph to the companions list near the top naming `docs/hub/` and what each of its four files is, plus a line in Repo state recording that this prompt is the hub's first build.

Gates, commit, push, report the pair.

---

# Stage 1 — one route · commit `hub: one route, the parameter model, and the redirects`

**Read first and cite:** `web/lib/routes.js`, `web/app/page.js`, `web/app/weeks/page.js`, `web/app/history/page.js`, `web/components/Filters.js` (`useSetParam`), `web/lib/queries.js`, `web/lib/weeks.js` (`usesSeasonWeeks`, `currentWeekKey`), `web/test/nav.test.mjs`.

### 1a. The parameter model

The hub is `/` and its entire state is in the query string:

| parameter | values | default | notes |
|---|---|---|---|
| `mode` | `day` \| `week` | `day` | the DAY \| WEEK toggle |
| `day` | ISO date | today | read only when `mode=day` |
| `w` | week key | current | read only when `mode=week`; keep `currentWeekKey`'s "latest start wins" tie-break |
| `sport` | one of the eight, or absent | absent = all | absent means ALL SPORTS |
| `series` | NASCAR series | absent | **the audit found this omitted from every planning document (§C-2) while `page.js` reads it — it is in the contract** |
| `scope` | `all` \| `mine` | `all` | ALL GAMES \| MY TEAMS |
| `view` | `list` \| `grid` | `list` | LIST VIEW \| GRID VIEW |

**No persisted preference and no `localStorage`.** State is URL-only, which is the property that keeps this app free of hydration mismatches — do not introduce client storage in this prompt.

**Decide and report** whether `mode` is a real parameter or is derived from the presence of `day` versus `w`. Either is acceptable; say which you chose and why. **`?w=` deep links, browser back and forward, and shared links must all keep working**, and a stale `?w=` must behave as it does today (the code is at `weeks/page.js:108-111`; the audit notes the *comment* is at 15–17).

### 1b. The redirects

`/weeks` and `/history` become redirects to the hub. **Use route-level `redirect()`, not `next.config.mjs`** — the audit's §B2 gives the reasoning; read it before choosing otherwise.

- `/weeks` → the hub in `mode=week`, carrying any `?w=` and `?sport=` it was given.
- `/history` → the hub in `mode=day` at today. **History is retired as navigation, not as functionality** (R1): past dates still show finals, because a past `day` renders that day's completed games with their scores and box-score links exactly as they do now. **The cross-date `?q=` search does not survive** (R8) — it is held as a future MY TEAMS sub-feature, and stage 6 records it in the enhancement register.
- `web/lib/routes.js` is the single route-list definition. Update it; do not fork a second list.

### 1c. The tests

`nav.test.mjs` pins the three-route navigation. **Re-base it, never weaken it** (audit §B3): it should now assert the single route, the redirects, and that every parameter in 1a round-trips. Report what it asserted before and after.

**Acceptance:** every route in `routes.js` resolves; `/weeks?w=<key>` and `/history` both land where 1b says; the eight sports and the NASCAR series filter still return rows (test the series filter against the live database and report the status code — an unhandled value is a 400, not an empty state); back and forward work.

Gates, commit, push.

---

# Stage 2 — the controls restack · commit `hub: the two toggle rows, the shortened ALL SPORTS bar, and the picker below the tiles`

**Read first and cite:** `web/components/Filters.js` (`DatePicker`, `SportFilter`, `SeriesFilter`), `web/components/WeekSelect.js`, `web/app/page.js` (the `.controls`/`.controls-stack` block, currently `page.js:178` and `:184-185`), and in `globals.css`: `.pagehead` (222), `.controls` (272), `.controls-stack` (281), `.sportbar`, `.sportrow`, `.spbtn`, `.spbtn-bar` (2091), `.spbtn-all` (2175), `.spbtn[data-active='true']` (2186).

### 2a. The stack, top to bottom

This is Joe's ordering and it is the point of the whole stage:

1. The banner
2. **`DAY | WEEK`** — two buttons
3. **`ALL GAMES | MY TEAMS` · `LIST VIEW | GRID VIEW`** — four buttons in **one** row
4. **The ALL SPORTS bar** — full width, shortened (2c)
5. **The league tiles** — all eight, unchanged
6. **The picker** — the date picker in `mode=day`, the week picker in `mode=week`
7. The schedule

**The picker moves from above the tiles to below them.** That is the change that makes the page read downward as a sentence.

### 2b. What the toggles look like, and a contradiction to get right

**The four text toggles and the DAY | WEEK pair take a GOLD FILL when active**, with dark text — exactly as `docs/ux-reference/schedule-hub-concept.png` shows.

**This does not reopen register §14.** §14 inverted the *league tile* active state to a charcoal plate with a gold border because prompt 25 measured that five of ten league **marks** read under 3:1 on gold and CFP was a ghost at 1.61:1. That reasoning is about artwork on a light plate. **These six controls are text**, and text on gold is not the problem §14 solved. So: **text toggles gold-filled when active; the eight league tiles keep §14's charcoal-and-gold-border treatment unchanged.** Record that split in stage 6 so nobody "fixes" one to match the other.

**The ALL SPORTS bar keeps §14's treatment** — charcoal ground, gold border, gold text when active. Joe asked to change its height, not its colour.

Every toggle is a real control with an accessible name and a pressed state (`aria-pressed`, or `role="radiogroup"` with `aria-checked` if you prefer — the audit's §H3 has the analysis; pick one, say which).

### 2c. The ALL SPORTS bar shrinks — and this breaks a standing rule on purpose

`.spbtn` is `height: 44px` at ≤699 px (`globals.css`, the definite-height fix prompt 34 shipped after WebKit collapsed the tiles on Joe's phone). The bar inherits it.

**Reduce the bar's height by 45% — 44 px to about 24 px** — and scale `.spbtn-all`'s font down from its current 16 px at ≤699 px so the text sits comfortably inside. **Width is unchanged: full screen width, matching the tile row beneath it.** The tiles keep their 44 px.

**This violates the 44 px minimum tap target** established in prompt 25 and restored in prompt 34. **Joe has ruled it, with the reasoning on record:** that rule protects small targets, and a roughly 360 × 24 px full-width bar carries over four times the tappable area of a 44 × 44 tile. **Do not "fix" it back, and do not add invisible padding to restore 44 px of hit area** — that returns zero vertical space and defeats the instruction. Stage 6 records it as a deliberate amendment.

### 2d. The picker gains prev/next arrows

The date control is a native `<input type="date">` behind a drawn face with **no prev/next arrows** (`Filters.js:37-46`). Joe's renderings show `‹` and `›` either side of the date. Add them: previous day and next day in `mode=day`, previous and next week in `mode=week`. They are buttons, they update the URL through `useSetParam`, and they keep the ≥44 px target.

**The `DATE` / `WEEK` heading beside the picker retires.** The DAY | WEEK toggle above is now the label and repeating it is noise. That supersedes prompt 45's heading ruling; stage 6 records it.

### Acceptance

Screenshots at **360, 390, 430 and 1440 px** showing the full stack in order. Report the measured height of every row. Confirm no horizontal overflow at any width, the tiles still fit on one line without scrolling (register §16), and the picker still ellipsizes rather than wrapping when the week label is long.

Gates, commit, push.

---

# Stage 3 — the spacing · commit `hub: banner nudge and the picker's vertical space`

Three measured changes. **Measure each before and after and put both numbers in the report** — the values below are read from the stylesheet, not from a render, and the render is the authority.

1. **The banner nudges UP 8 px.** Joe: it sits significantly lower on the page than it needs to. `.banner` carries `padding-top: env(safe-area-inset-top, 0px)` (`globals.css:1761`) and prompt 28 already made that inset *absorb* the artwork's own headroom rather than stack on it. **Take 8 px off the resulting top gap**, keeping the absorb form and the `max(0px, …)` guard so a zero inset can never produce negative padding. **Do not touch the left, right or bottom insets** — Joe confirmed those three are correct on the device.
2. **The space ABOVE the picker reduces by 65%.** In the restacked order this is the gap between the four-toggle row and the picker. `.pagehead`'s `margin: 22px 0 2px` is the current source; 22 px becomes about **8 px**.
3. **The space BELOW the picker reduces by 65%.** This is the gap between the picker and the first section beneath it. `.controls`' `margin: 18px 0 6px` currently supplies the effective gap; 18 px becomes about **6 px**.

**The comment blocks in `globals.css` around these rules explain why each number is what it is** (prompt 46 unit 1B, and prompt 25's 5b note about the banner-to-date gap). Update them rather than leaving explanations that describe the old values — a stale comment is how prompt 32 found a rule implemented backwards.

**Report the total vertical space reclaimed by stages 2 and 3 together**, at 390 px, against the audit's measured budget of 844 px. Cowork's arithmetic from the stylesheet predicts roughly 99 px including the retired tab row, which would take the grid's viewport from the audit's 344 px to about 443 px. **That is derived, not measured. Correct it.**

Gates, commit, push.

---

# Stage 4 — hiding restored, and the count line moves to the page bottom · commit `hub: games off your services hidden again, with a page-level count`

**Read first and cite:** `web/lib/offservice.js` (`offServiceSummary`, `countSummary`, `isMarketPending`, the network-TBD predicate), `web/components/SportBand.js` (the count block, the toggle, `rowClass`, and the `SportBand.js:128` conditional the audit identified in §C-5), `web/app/page.js`, `web/components/Listing.js`.

### 4a. What is hidden and what is not

**Hidden by default:** games whose broadcast is on a service Joe does not have — `viewer_game_eligibility` remains the sole source of that verdict, never recomputed in JS.

**Never hidden, and this is not negotiable:**
- **Network TBD** — no broadcaster has been named. Hiding a game because you cannot watch it, when nobody has decided whether you can, is a false statement about 529 games.
- **Market pending** — the broadcaster is known and Cleveland's coverage is not confirmed.
- Both keep their `MARKET TBD` and `NETWORK TBD` card badges, and prompt 24's mutual-exclusivity test stays green.

This restores D4's filter-by-default. **`isMarketPending` and the network-TBD predicate stay separate derivations** — the badges must keep showing two different words.

### 4b. One count line, at the bottom of the page

The per-band count lines **go away**. A single line renders at the foot of the page, below the last band:

- `8 games on your services` — the wording from Joe's renderings.
- Plus a `· N TBD` segment when any are present, so the line is not undercounting the rows above it. **Zero-count segments stay omitted**, so a day with nothing pending reads exactly as the rendering shows. *This second segment is Cowork's call, flagged for Joe's veto — his renderings show one segment only, and the alternative is that TBD games are shown but uncounted.*
- Then the reveal: **`Show N not on your services`**, collapsing to **`Hide them`**.

**This supersedes `05-home-page-decisions.md` §10's `airing · TBD · unavailable` vocabulary**, which prompt 26 shipped. Stage 6 records the supersession.

### 4c. What the reveal does — Cowork's call, flagged for veto

**Tapping the line opens the hidden games as a section immediately below it**, grouped by sport and chronological within each group. **Nothing above the reader moves.**

The reason: the control is at the foot of the page. If the revealed games expanded back into their sport bands higher up, the reader taps and the visible screen does not change while the page silently grows above them. **Report what it looks like** so Joe can reverse this in one line if the grouping reads wrong.

### 4d. Two consequences to name, not to soften

1. **A page-level count retires "every band reports its counts"** — the `4250aa9` fix, which the handoff has carried as "do not regress" since prompt 21. Joe's new instruction supersedes it. Record the reversal in stage 6; do not leave the old note standing.
2. **The audit found there are no tests pinning that behaviour** (§C-5) — the phrase lives only in documents and the behaviour is one conditional at `SportBand.js:128`. So this is a one-conditional change, not a test rebase. **Confirm that at the current HEAD before relying on it.**

### 4e. The toggle's target

`.offsvc-toggle` carries `min-height: 44px` and a comment calling it the most important of the three targets, because it gates access to every filtered game. **It still does.** Keep 44 px and report the measured height.

**Acceptance:** the literal rendered strings for `/?day=2026-09-05` (a heavy CFB Saturday), `/?day=2026-11-14`, and `/?day=2027-01-10` (all network-TBD). Card counts before and after, confirming the heaviest week returns to roughly its pre-R3b figure. Screenshots at 390 px of the collapsed and revealed states.

Gates, commit, push.

---

# Stage 5 — the grid header retires · commit `hub: the grid's own header comes off, its footer keeps the exceptions`

**Read first and cite:** `web/components/MobileGrid.js` — the header at `:301` with `.mgrid-headlines` at `:309`, and the footer at `:495` carrying `{onGrid} on the grid`, the kickoff-TBA pill and `.mgrid-note` at `:513`.

### 5a. The header goes

Joe: with the picker directly above the grid, the day is already stated, and the league tiles above state the sport. **Delete `.mgrid-head` and its CSS.**

**This reverses prompt 37's stage B1**, which rebuilt that header into two lines with the league mark spanning both. Say so in the report — it is a deletion of recent work and the record should show it was deliberate.

**Before deleting, enumerate everything the header carried and say where each piece now lives.** Cowork's reading, to be verified rather than trusted: the league mark and sport name are stated by the tile selection; the date by the picker; the game count by stage 4's page-bottom line; and the TBD and gaps-cut suffixes **were already duplicated in the footer**. **If any piece is carried nowhere else, stop and report it rather than dropping information.**

### 5b. The footer stays

`.mgrid-foot` keeps the kickoff-TBA pill, the gaps-cut note and `.mgrid-note`'s network-TBD line. These are notes about what the grid did, not a title.

**One thing to measure and report rather than decide:** the footer's `{onGrid} on the grid` and stage 4's page-bottom `N games on your services` now appear on the same screen counting different things — games placed on the grid, versus games you can watch. **Render both, screenshot them together at 390 px, and say whether they read as contradictory.** If they do, that is Joe's call, not yours.

### 5c. The tab row is already gone

The `TODAY / WEEKS / HISTORY` row disappears with stage 1 — one route leaves those tabs nothing to navigate to. **It is retired on every view, not just the grid**, which is more than Joe's ruling asked for and is a consequence of the hub rather than a decision. Confirm it is gone and report the height reclaimed.

### 5d. Geometry is frozen — this is the hard stop

Re-check the tripwire at the numbers in the preconditions. **Lane counts, block widths and `scrollWidth` must be unchanged.** Nothing in this prompt touches the grid's canvas, so any movement means something unintended reached it. Report the numbers side by side.

Also confirm prompt 30's zoom fix has not regressed: the rail pinned at `x=0` after panning fully right at zoom 0.6, 1.0 and 2.5. **Joe verified that on his phone; it must not break.**

Gates, commit, push.

---

# Stage 6 — the record · commit `docs: the hub's first build, and the rulings it supersedes`

Every ruling this prompt implements, and every earlier one it overturns.

**`docs/feature-study/05-home-page-decisions.md`** gains a **§14, the Schedule Hub**, recording: R1's single route; that **§11's page order is superseded** (the page-level YOUR TEAMS section is replaced by the MY TEAMS scope — R4); that **§10's count-line vocabulary is superseded** by stage 4b's wording and its move to the page foot; that **D4's filter-by-default is restored and R3b is reversed**, with the audit's §I measurement as the reason; and that **D6's in-band favourites float is retired on the hub**.

**`docs/enhancement-register.md`** gains a **§17** recording: the text-toggle gold fill versus §14's league-tile inversion, and why they differ; the **44 px amendment** for the ALL SPORTS bar, with Joe's reasoning; that the **in-app team picker is a named future feature** — MY TEAMS runs on the thirteen ids in `data/favorites.json` and scaling it to other users needs storage and identity the app does not have; that **NASCAR, IndyCar, UFC, WWE and AEW are permanently part of MY TEAMS**, since they have no rosters to pick from and following the sport is following all of it; and that **History's cross-date search is held as a MY TEAMS sub-feature**, retired from navigation.

**`docs/rendering-contract-mobile.md`** — the grid header's removal is a mobile presentation change. Add it as a numbered rule and bump the addendum version. **The audit's stage 4 found two rules both numbered M17 from prompt 37 and prompt 38 renumbered the second to M18** — confirm that renumbering held before adding another.

**`docs/handoff-status.md`** — refresh Repo state to this prompt's HEAD with the six-commit chain and the new gate numbers; add the hub's open items; and **strike the "every band reports its counts — do not regress" note**, replacing it with one line recording that a page-level count superseded it and when.

**Rule 23 —** `docs/design/mobile_demo.html` specifies the controls block and the grid's chrome. **Whatever stages 2, 3 and 5 changed in it changes in the same commit.** Prompt 29 found `--faint` stale in that file on the day rule 23 was written and prompt 37 found `--body` still declaring Barlow when the app ships Inter; **check the token block again and report any remaining drift.**

Refresh `handoff/project-mirror/` for every doc this prompt changed.

Gates, commit, push.

---

# Report

The standing shape: per stage what shipped and its commit; gates before and after; every judgment call. Call out specifically:

- **Stage 0:** the file count in `docs/prompts/` (expect 52), and confirmation that prompts 39 and 42 were left as acknowledged gaps.
- **Stage 1:** what you did with `mode`, and proof that `?w=` deep links, back and forward all still work. The live status code for the NASCAR series filter.
- **Stage 2:** the measured height of every row in the stack, at four widths, with screenshots. Whether the shortened ALL SPORTS bar still reads as a control.
- **Stage 3:** every spacing value before and after, **measured**, and the total vertical space reclaimed against Cowork's derived ~99 px.
- **Stage 4:** the literal count-line strings on three days; the card counts before and after; and **what the revealed section looks like**, since 4c is Cowork's call.
- **Stage 5:** the enumeration of what the header carried and where each piece went; the footer and page-bottom lines photographed together; the tripwire side by side.
- **Anything in this brief that turned out wrong.** The last nine briefs carried 6, 3, 6, 1, 0, 0, 4, 5 and 5 errors, and naming them has been the most useful part of every report.

**For Joe:**

1. Close the installed app fully and reopen it from the Home Screen.
2. Confirm the page now reads downward: DAY or WEEK, then the four toggles, then ALL SPORTS, then the league tiles, then the date or week picker.
3. Tap `‹` and `›` either side of the picker and confirm they move you a day (or a week) at a time.
4. Scroll to the bottom of the list and confirm the count line reads correctly, then tap `Show N not on your services` and confirm the hidden games open below it without the page jumping.
5. Switch to `GRID VIEW` and confirm the grid's own header is gone and the day above it is doing that job.
6. Confirm the banner sits 8 px higher and the space around the picker is noticeably tighter.
7. Anything wrong: screenshot with the step number into the Cowork chat.
