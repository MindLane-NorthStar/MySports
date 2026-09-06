# Prompt 51 — one gap everywhere, shorter toggle rows, six more pixels off the banner, and MY TEAMS finished

**Run in Claude Code**, in `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` on `main` at `5698d9f` or a descendant. Five stages, five commits, the merged-unattended shape of prompts 35–50 and every standing rule in `docs/handoff-status.md`: gate and commit as separate commands; stage by explicit path; secret gate with `grep` on ADDED lines only; push and print the rev-parse pair; **locate by content and cite file and line before asserting what anything does** (rule 22); `docs/design/mobile_demo.html` changes in the same commit as anything it specifies (rule 23).

**No database writes. No migrations. No pipeline or adapter changes.** Any DML is a hard stop.

**Hard stops:** the secret gate, a push reject, any database write, the geometry tripwire in stage 5, and stage 3's clipping check.

**Hard-stop policy.** Stop that stage, leave earlier commits alone, record what stopped, continue to anything independent. Stages 1–3 are layout and stage 4 is behaviour; none blocks another.

---

## Preconditions

- `git rev-parse --short HEAD` == `5698d9f`, and `HEAD == origin/main`.
- Python **465 passed + 1 skipped**, JS **345/345**, smoke **30/30**, qa-shots **14/14**.
- Tree clean apart from always-untracked `assets/`.
- **Geometry tripwire**, recorded at stage 0 and re-checked in stage 5 (`document.fonts.ready` first): CFB `2026-09-05` **64 blocks / {240, 223, 205, 136} / 1282**; MLB `2026-09-03` **3 / {228} / 577**. Nothing in this prompt touches the grid canvas.

---

## Where this comes from

Joe has the hub on his phone and confirmed **the stack order is correct** — the design sheets showed the picker above the tiles and his typed instruction put it below them, the build followed his words, and he has now ruled that the built order is what he wanted. That question is closed; do not revisit it.

Four things came back from the device, and one defect came out of prompt 50's own report.

---

# Stage 0 — measure before changing anything · no commit

**This stage writes nothing.** It establishes the numbers stages 1–3 are defined against, because Joe's instruction is expressed as *"whatever that distance is"* rather than as a literal.

At **390 px** on the hub, with `document.fonts.ready` awaited, measure and report:

1. **The canonical gap** — the rendered vertical distance between the **bottom of the `DAY | WEEK` row** and the **top of the `ALL GAMES | MY TEAMS · LIST VIEW | GRID VIEW` row**. Cowork reads `.segrow`'s `margin: 0 0 8px` as the only contributor, so the expected answer is **8 px**. **Measure it; do not assume it.**
2. The gap from the **bottom of the banner** to the **top of the `DAY | WEEK` row**.
3. The gap from the **bottom of the four-toggle row** to the **top of the `ALL SPORTS` bar**. Note that `.hubctl` is `display: flex; flex-direction: column`, and **flex containers do not collapse margins** — so this is `.segrow`'s 8 px bottom *plus* `.controls`' top margin, added, not the larger of the two.
4. The gap from the **bottom of the picker row** to the **top of the first content element**, in both `view=list` and `view=grid`.
5. The gap from the **ALL SPORTS bar** to the **league tiles**, and from the **league tiles** to the **picker** — these two are *not* in Joe's instruction and are being measured only so the report can show him what the page looks like once four of the six gaps are equalised.
6. The rendered height of `.seg button` (expected 44 px) and of the ALL SPORTS bar (expected ~24 px after prompt 50).
7. The first content row's offset from the top of the viewport — prompt 50 measured **406.2 px**; confirm.

Put all seven in the report before any stage changes anything.

---

# Stage 1 — the two toggle rows get shorter · commit `hub: the toggle rows come down to 31px`

Joe asked for *"much shorter. Not as short as the ALL SPORTS button — but probably about 60% of the vertical size that they are currently."* **Sixty percent is 26.4 px, which lands 2 px from the ALL SPORTS bar's 24 px — effectively the same height as the thing he said these should not be as short as. Shown that arithmetic, Joe ruled 70%.**

`.seg button` is `height: 44px` (`globals.css`, in the `.seg` block prompt 50 added). **Build 31 px** (44 × 0.70 = 30.8). Both rows, both breakpoints unless the desktop rule differs; report what desktop does.

**31 px sits 7 px above the ALL SPORTS bar**, which is the visible separation the ruling is for. Report the two heights side by side so it is on the record that they read as two sizes rather than one.

Scale the button type down from its current 14 px so the labels sit comfortably in 31 px without crowding the border — 31 px is roomier than 26 would have been, so the type may need very little. `LIST VIEW` and `GRID VIEW` are the longest labels and the pair row is the tightest case; prompt 50 measured it needing 289.5 px of 320 available at 360 px. **Re-measure at 360 after the change and confirm nothing wraps or truncates.**

**One thing to report rather than resolve.** This is the third control family to go under 44 px, after the ALL SPORTS bar (24 px, prompt 50), with `.chip` and the eight tiles still at 44. The same reasoning holds and holds more easily at 31 than it would have at 26 — a row whose buttons are roughly 90 px wide in the four-up case and 185 px in the two-up case carries well over a 44 × 44 square's target area — but **stage 5 consolidates the amendment into one entry rather than adding a third separate exception.** The picker's `‹` `›` arrows keep their 44 px and are not part of this change.

Gates, commit, push.

---

# Stage 2 — one gap, applied in four places · commit `hub: the control stack's vertical rhythm is one gap`

Joe's instruction: whatever the `DAY | WEEK` → four-toggle gap measures, **that same distance becomes the fixed gap** in three more places — banner to `DAY | WEEK`, four-toggle row to `ALL SPORTS`, and picker to the content beneath it.

**Implement it as a single `gap` on the flex column, not as four margin pairs.** `.hubctl` is already `display: flex; flex-direction: column`. Put `gap: <the stage-0 measurement>` on it and **zero the vertical margins of its children** — `.segrow`'s `margin: 0 0 8px`, `.controls`' top and bottom, `.pickrow`'s `margin: 2px 0 6px`. One number governs the rhythm and there is nothing left to drift out of step.

**Before zeroing `.controls`' margins, grep for every other consumer of `.controls` and `.controls-stack` and report what you find.** `/weeks` and `/history` are redirects since prompt 50, but `WeekSelect` and anything else that renders a control block may still rely on those margins; if one does, scope the change to the hub rather than changing the shared rule.

**The banner gap and the content gap sit outside `.hubctl`.** The banner is above it and the schedule below it, so those two need their own treatment — most likely `.shell`'s top padding and the first content element's top margin. **Locate each, cite it, and set it to the same number.** Do not reach for negative margins.

**Two gaps are deliberately NOT being equalised** — `ALL SPORTS` → tiles, and tiles → picker. Joe did not name them. **Report what they measure once the other four are equal**, with a screenshot, so he can see whether the stack now reads as evenly spaced or as four equal gaps with two odd ones in the middle. That is his call, not yours.

**Acceptance:** all four named gaps measure identical to the stage-0 canonical, at 360, 390, 430 and 1440 px. Report the new first-content-row offset against stage 0's number and against prompt 50's 406.2 px.

Gates, commit, push.

---

# Stage 3 — six more pixels off the banner · commit `hub: the banner rises a further 6px`

Joe, after seeing prompt 50 on the device: *"remove 6px from the dead space atop the banner bar. We already removed 8 now take 6 more."*

Prompt 50 stage 3 set `.banner`'s `padding-top` to `max(0px, calc(env(safe-area-inset-top, 0px) - 8px))`. **Take it to 14 px.** Keep the `max(0px, …)` guard — a browser with no safe area reports 0, and 0 − 14 is negative padding.

### The measurement that has to accompany it, and the hard stop

**14 px exceeds the artwork's own headroom, and that is a change in kind rather than degree.** Prompt 44 (`a68af01`) established that banner v2 carries **11 stage px above the wordmark's first ink**, and ruled that the wrapper absorbs *nothing* of the inset because that 11 px is the gap Joe himself set in the September 4 phone iteration. Prompt 50's 8 px stayed inside that headroom. **14 px does not** — it pulls the artwork roughly 3 px into the space the inset reserves.

Prompt 44's harness is at `artifacts/qa/2026-09-04-banner/tools/`. **Re-use it, do not rebuild it.** With a simulated inset at **47 px and again at 59 px** (the Dynamic Island value for Joe's device class), at 390 and 430:

1. Report the **y coordinate of the wordmark's first ink** and where that sits relative to the top of the inset.
2. Report whether the ink overlaps the **clock and battery glyphs**, which do not fill the whole inset band — a few pixels of overlap with the band's empty upper region is very likely fine, and overlap with the glyphs is not.
3. **HARD STOP if any wordmark ink would be clipped off-screen** — that is, if the padding resolves such that the artwork's top is above y = 0. Report and stop rather than shipping something Joe cannot see.
4. With **no** inset — desktop, and any plain browser shot — **nothing may move.** Prove it: the banner element's height and the five measurements prompt 43 recorded, re-measured and identical.

**Rewrite the comment block above the rule.** It currently explains an 8 px absorption; it must record 14, that this now exceeds banner v2's 11 px of headroom, and that prompt 44's absorb-nothing ruling is superseded by Joe's device observations of 2026-09-06. A comment describing the old number is how prompt 32 found a rule implemented backwards.

**Say plainly in the report that this cannot be self-verified.** Chromium's `env()` is 0, so the entire change is invisible there by construction. Joe's phone is the authority.

Gates, commit, push.

---

# Stage 4 — MY TEAMS is finished · commit `hub: the favourites section retires, and the team-less sports join MY TEAMS`

Prompt 50's own report found this: **R4 is half built.** `?scope=mine` filters correctly, but the page-level YOUR TEAMS section still renders under ALL GAMES, so both mechanisms are on screen at once. And `scope=mine` returns **no programs at all**. Prompt 50 documented both rulings in its docs stage and assigned neither to a build stage — a sequencing failure in the brief, not in the run.

### 4a. The YOUR TEAMS section retires

**Read first and cite:** `web/components/Listing.js` (the favourites split prompt 27 built), `web/components/SportBand.js` (`floatFavorites`, `sectionLabel`, `.favlabel`, `.favrule`), `web/app/page.js`.

R4: **the MY TEAMS toggle replaces the page-level section.** `ALL GAMES` renders the sport bands with **band-level favourite marks** — D6's hairline and micro-label, which survive — and the card itself is untouched. `MY TEAMS` renders favourites only, every sport, chronological among themselves.

Remove the page-level section and the split that feeds it. **`05-home-page-decisions.md` §11's page order is already recorded as superseded** by prompt 50's docs stage; this is the build catching up to the record.

**Do not touch the card.** The favourite marker lives at section or band level and never on the card — that is what keeps the locked card contract closed, and it is the one thing that survived D6 unchanged.

### 4b. The team-less sports are permanently in MY TEAMS

Joe's ruling, recorded as register §18: **NASCAR, IndyCar, UFC, WWE and AEW have no rosters to pick from, so following the sport is following all of it.** They render under MY TEAMS alongside the thirteen teams' games.

`favoriteIds()` matches team ids; a race, a fight card and a weekly show have none, which is why the scope currently shows nothing from them. **Add the sport-level rule beside the team rule** — under `scope=mine`, a program qualifies if either its home or away team is a favourite **or** its sport is one of those five.

**Studio shows are NOT included.** They are pregame and postgame bookends attached to sports that do have teams, Joe's ruling named five sports and studio shows were not among them, and a GameDay instance is not a thing to follow in its own right. **If you disagree after reading how they are modelled, report it — do not decide it.**

### 4c. Tests and acceptance

Pin the scope rule with fixtures, not a DOM: a favourite team's game qualifies; a non-favourite team's game does not; a NASCAR race qualifies with no team on it; a studio show does not; a program with a null sport does not crash.

**Acceptance, on real days:** report the rendered card count and a sample of what appears under `?scope=mine` for **2026-09-06** (NASCAR's Darlington race is loaded that day), for a day carrying WWE or AEW, and for a day carrying one of the thirteen teams. Confirm the YOUR TEAMS section no longer renders under ALL GAMES, and that band-level favourite marks still do.

Gates, commit, push.

---

# Stage 5 — the record · commit `docs: the control stack's rhythm, the tap-target amendment consolidated, and MY TEAMS closed`

**`docs/enhancement-register.md` §18** — extend rather than duplicate:

- **Consolidate the tap-target amendment into one entry covering all three control families.** The ALL SPORTS bar at 24 px (prompt 50) and both toggle rows at 26 px (stage 1) are deliberate exceptions to the 44 px minimum prompt 25 established and prompt 34 restored, on Joe's ruling and with his reasoning on record: the rule protects small targets, and a wide short control carries more target area than a 44 × 44 square. **Name what is NOT excepted** — `.chip`, the eight league tiles, the picker arrows and the reveal toggle all keep 44 px. Three separate exception notes would rot; one entry with a list will not.
- **Record the control stack's rhythm** as one gap on `.hubctl`, with the stage-0 measurement as its value, and note the two gaps deliberately left alone pending Joe.
- **Close the MY TEAMS items**: the section retired, the five team-less sports permanently in scope, studio shows deliberately out, and the in-app team picker still a named future feature running on `data/favorites.json`'s thirteen ids.

**`docs/feature-study/05-home-page-decisions.md`** — §14 already records that §11 is superseded. Add one line noting that stage 4a is the build that made it true, with this prompt's commit.

**`docs/rendering-contract-mobile.md`** — nothing here touches the grid canvas, but the banner's inset treatment is a mobile presentation rule. Record stage 3's supersession of prompt 44 and bump the addendum version.

**`docs/handoff-status.md`** — refresh Repo state to this prompt's HEAD with the five-commit chain and the gate numbers; add the two open items this run leaves (the two unequalised gaps, and the 26 px versus 31 px toggle-row question).

**Rule 23** — whatever stages 1, 2 and 3 changed that `docs/design/mobile_demo.html` implements changes in the same commit. **Check the token block again** — prompt 29 found `--faint` stale there and prompt 37 found `--body` still declaring Barlow; report any remaining drift.

Refresh `handoff/project-mirror/` for every doc this prompt changed.

Gates, commit, push.

---

# Report

Per stage: what changed, the commit, the evidence, every judgment call. Gates before and after. Call out specifically:

- **Stage 0's seven measurements**, in full, before anything else.
- **Stage 1:** the rendered row height, whether the type still fits at 360, and **a screenshot showing the 31 px rows beside the 24 px ALL SPORTS bar** so the 7 px separation is on the record.
- **Stage 2:** the four gaps measured identical, at four widths; every consumer of `.controls` you found; and **what the two unequalised gaps measure**, with a screenshot of the whole stack.
- **Stage 3:** the wordmark ink's y coordinate at 47 px and 59 px insets, whether it overlaps the clock glyphs, and the proof that nothing moves without an inset. **Flagged as unverifiable in Chromium.**
- **Stage 4:** the card counts and samples for three real days, and confirmation that both the old section is gone and the band-level marks remain.
- **The tripwire** side by side, and prompt 30's rail-pinned check at zoom 0.6 / 1.0 / 2.5.
- **Anything in this brief that turned out wrong.** The last ten briefs carried 6, 3, 6, 1, 0, 0, 4, 5, 5 and 6 errors; naming them has been the most useful part of every report. **Prompt 50's brief carried a measurement that was wrong in sign** — it claimed the restack would reclaim ~99 px when it cost 39.2 — so treat every number in this one as a claim to check, including stage 0's expected 8 px.

**For Joe:**

1. Force-close the installed app — swipe up from the bottom, pause, swipe the MySports TV card away — and reopen it from the Home Screen.
2. Look at the top of the screen. The banner has risen a further 6 px. **Does the MySports TV wordmark now crowd the iPhone clock or the battery icon?** If yes, that is a fail and the remaining pixels have to come from somewhere else.
3. Look at the spacing down the control stack: banner, then `Day | Week`, then the four buttons, then `ALL SPORTS`, then the league tiles, then the date picker. **Four of those gaps are now identical. Do the two that were left alone — below `ALL SPORTS` and below the tiles — look out of step?**
4. Look at the `Day | Week` and `All Games | My Teams` rows. They are about 40% shorter. **Do they still read as buttons, and are they still easy to hit with a thumb?**
5. Tap `My Teams`. **Confirm you see your thirteen teams' games and also NASCAR, IndyCar, UFC, WWE and AEW.** Then tap `All Games` and confirm the old `YOUR TEAMS` section at the top of the page is gone, while favourite games still carry their mark inside their sport band.
6. Anything wrong: screenshot with the step number into the Cowork chat.
