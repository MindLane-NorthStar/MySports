# Claude Code — Prompt 26: the rulings from the prompt-25 report

**Repo:** `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` · **main**

**Preconditions, hard stop if any fail:**

- `git rev-parse HEAD` == `a5c588f`, and `HEAD == origin/main`.
- Python **200 OK (skipped=1)**, JS unit **138/138**, smoke **30/30**, qa-shots **8/8**.
- Tree clean apart from untracked `assets/` and `artifacts/`.

**What this prompt is.** Prompt 25 measured well and stopped in the right places. This lands Joe's rulings on what it found, plus the iOS standalone work that was always real.

**Two things are deliberately not here.** The grid zoom item — see *Explicitly out of scope*. And the **implementation** of the mobile page order, which this prompt *documents* in stage 1c but does not build: it changes which games each count line covers, and stage 3 is already changing what that line says. Landing both in one unattended run means a mid-run stop leaves it unclear whether the numbers are wrong because of the merge or because of the reorder. That is the same reasoning that split 24 from 25 and 25 from 26. It rides prompt 27.

**Working rule 22 applies throughout:** before asserting what a component does, open it and cite file and line. Prompt 25 caught three bad citations in its own brief, one of them Cowork's. Line numbers below were taken at `a5c588f` where prompt 25 reported them and at `10efae7` otherwise; **if a number does not match, re-locate and say so in the report.**

**Standing rules that bite here:** rule 3 (secret gate, ADDED lines only, `grep` never `findstr`), rule 4 (stage by explicit path, never `git add -A`), rule 7 (self-committing stages, 2-strikes-skip), rule 13 (measure against the local background), rule 16 (colour tokens read from `globals.css`), rule 20 (never a bare repeated string replace).

**This prompt touches no database and no pipeline code.**

---

## Stage 1 — move the authorities into the repo, and record three amendments

Prompt 25 reported that two of its five named authorities were not in the repo, so it worked from what the prompt quoted inline. That is the same gap prompt 23 flagged for `claude/src/mobile_demo.html`. Joe's ruling: **the authorities live in the repo and are mirrored to the Claude project, repo copy is the source** — the convention `docs/handoff-status.md` already states in its own header.

### 1a. Relocate

Use `git mv` where a repo copy already exists so history follows; otherwise add the file. Joe will supply any file that exists only in the Claude project — **if a source file is missing from your working tree, list it in the report and skip it rather than reconstructing it from quotes.**

- `enhancement-register.md` → `docs/enhancement-register.md`
- the audit triage → `docs/audit-triage-2026-09-03.md`
- the mobile reference implementation → `docs/design/mobile_demo.html`

Each gains the same two-line header `handoff-status.md` carries: that the repo copy is the source and the project copy is written from it. Update every in-repo reference to the old paths — grep for `enhancement-register`, `mobile_demo` and `audit-triage` across `docs/`, `web/`, `scripts/` and `tests/` and fix what you find. **Do not mirror anything to the Claude project; Cowork owns that copy.**

### 1b. Append to `docs/feature-study/05-home-page-decisions.md`, verbatim

```markdown
## 10. COUNT LINE AMENDED — 2026-09-03, after prompt 25's 390 px measurement

Prompt 25 measured the §9 count line at 390 px on 2026-11-14. `56 games · 6 available to you · 45
network TBD · 5 not on your services` renders **404 px against 366 px of available width** — two
lines, with the "Show all" toggle pushed to a third. A day carrying both market-pending and
network-TBD games reaches an estimated 427 px even with the total removed, so dropping the total
alone does not close it.

**Joe's ruling: the count line is a summary, not a full accounting.**

    6 airing · 48 TBD · 5 unavailable

Three changes from the §9 shape:

1. **The total is dropped.** It is duplicated one scroll above by the Today page's `<p class="sub">`
   ("56 games on this viewing day"), and the three segments sum to it.
2. **Market-pending and network-TBD are summed into one `TBD` figure.** §9's objection was to
   *labelling* a network-TBD game "market pending" — asserting a broadcaster exists when none has
   been named. A neutral `TBD` asserts neither. The distinction is not lost: it moves to the card,
   which keeps `MARKET TBD` and `NETWORK TBD` as two separate badges, mutually exclusive by
   construction, with prompt 24's test unchanged.
3. **The wording shortens** to `airing` / `TBD` / `unavailable`.

**Cost named at decision time, and accepted.** `airing` is true of all 56 games — six of them are
airing *on services Joe has*. `unavailable` reads as "not on television" rather than "not on your
services". Both amend D4's language, which deliberately said "available to you" and "not on your
services" because this product's differentiator is access, not broadcast. Joe ruled for brevity on a
line that has to survive a 56-game November Saturday at 390 px, with the trade-off on the record.

**This supersedes D4's count-line wording and §9's count-line shape. The four states themselves, the
D4 filter carve-outs for market-pending and network-TBD, and the card badges are untouched.**

Zero-count segments remain omitted.
```

### 1c. Append to the same file, verbatim — the mobile page order

```markdown
## 11. MOBILE PAGE ORDER RULED — 2026-09-03. This supersedes D6's placement.

**Joe's ruling, and it is the source of truth: the page reads YOUR TEAMS → grid → everything else.**

D6 ruled that favourites float to the top of their own sport band, with no separate pin band and no
duplicated card; the reasoning on record was that the band never stops reading as a timeline. That
placement is superseded. The reasoning that produced it was not wrong — it was answering where
favourites sit *within* a band. This ruling answers where they sit *on the page*, and it wins.

**The shape.**

1. A page-level **YOUR TEAMS** section carrying Joe's favourites across every sport, in chronological
   order among themselves.
2. The **grid**, where one renders.
3. The **sport bands**, in the existing SPORTS order, carrying everything else.

**Structural consequence, named because it is larger than the ruling sounds.** A page-level
favourites section and D6's in-band float cannot both exist without either duplicating the card —
which D6 rejected and this ruling does not revive — or holding a JS width state, which this app
deliberately avoids: every breakpoint in it is CSS-gated at 699 px precisely so there is no
server/client hydration mismatch. **So the favourites section moves to page level at every width and
D6's in-band float is retired.** What stays mobile-only is the *grid's* position — hoisted above the
bands at ≤699 px with CSS `order`, left below them above it, so the DOM is written once.

**Counting.** Each section counts what it shows. The YOUR TEAMS section carries its own count line;
each sport band counts only the games still in it. Every number then describes the rows beneath it,
which is the property that made the count line trustworthy in the first place. A band reading
`8 airing · 2 TBD` beside a YOUR TEAMS section reading `3 airing` is correct and adds up; a band
whose count includes rows that are not in it would not be.

**What survives from D6 unchanged:** the favourites list and its thirteen teams; ids not names; the
"Ohio is Ohio University, not Ohio State" trap; chronological order among the floated rows; the
marker living at section level and never on the card, so the locked card contract stays closed; and
the rejection of a duplicated card.

**Consequence for the jump chip.** With the grid second on a phone, `Grid ↓` has almost nothing to
jump past. Retire it at ≤699 px.

**Desktop.** D5's band-left / grid-right composition at ≥1600 px is untouched by this ruling. What
changes above the breakpoint is only that favourites are a page-level section rather than a float
inside each band.
```

### 1d. Append to `docs/enhancement-register.md`, verbatim

```markdown
## 14. THE ACTIVE CHIP INVERTED — 2026-09-03, after prompt 25 measured the marks on gold

§13's selected-chip rule read: the active chip sits on a gold plate, so its mark uses the **raw**
art, not `_dark` (contract v1.3e, light plate = raw).

**A consequence nobody priced.** Prompt 25 stage 3 measured every league mark composited on the real
gold plate (`--gold` `#f0c850`). The CFP mark — which §13 itself chose for the CFB chip, logo-only —
is effectively invisible on it: **100% of its opaque ink below 3:1, best case 1.61:1**, confirmed by
eye as a ghost. This is not a `_dark` problem: `cfp_dark` reads 10.05:1 on charcoal. The raw art is
light-on-light and no treatment fixes that.

And it is not only CFP. Raw-on-gold, measured: cfp 1.23 · nba 1.50 · nfl 1.83 · indycar 1.91 ·
mlb 2.08 · nhl 3.35 · ufc 3.40 · aew 8.76 · nascar 10.00 · wwe 10.55. Five of ten below 3:1.
Prompt 25's caveat is on record and endorsed: a multi-colour mark always has *some* ink near any
ground, and the NFL shield reads clearly on gold by eye at 9.20:1 best ink — it trusted the render
over the arithmetic, which is working rule 13 behaving correctly. CFP is the one that genuinely fails.

**Ruling: invert the active chip.** The active chip becomes a **charcoal plate with a gold border**,
not a gold fill. Every chip then floats on charcoal in both states and takes `_dark` always.

- One mark state on the chip row instead of two.
- No new art. The CFP problem disappears, and so do the four other weak raw-on-gold marks.
- It scales: every future league mark is only ever asked to read on one ground.
- Contract v1.3e's light-plate context still exists and is unchanged — it governs grid caps and light
  tint plates (addendum M12). It simply no longer applies to chips.
- **Cost, named:** a bordered chip reads quieter than a filled plate. The active state must stay
  unmistakable at a glance — gold border *and* gold text, not border alone.

This amends §13's selected-chip rule only. Marks-only chips, the chip roster, the AEW amendment, the
CFP choice for the CFB chip, the scrolling row and the band-header rule are all unchanged.
```

### 1e. `docs/handoff-status.md`

Refresh repo state to this prompt's HEAD when you finish. Add to the open list:

- **`--faint` reaches 3.63:1 on the card top and true AA is unreachable there** without moving `--dim` or lightening `--panel-top`. Prompt 25's finding, Joe's call, accepted — not a defect to re-raise.
- **The mobile page order (05 §11) is ruled and documented but not built.** It rides prompt 27.

---

## Stage 2 — invert the active chip (register §14)

**Read first:** `web/app/globals.css:249` (`.chip[data-active='true']`), `:237` (`.chip`), `web/components/Filters.js` (the `src` template for `chip-mark`), and whatever prompt 25 left at `:1474`/`:1476` for `.chip-league` and `.chip-mark`.

- `.chip[data-active='true']` becomes: charcoal ground (keep the existing `.chip` panel gradient, or `--spot-2` if the gradient reads muddy against the border — pick by render and say which), `border-color: var(--gold)`, `color: var(--gold)`. Remove the gold `background` fill and the `#1b1b1b` text colour.
- **The border must not shift layout.** `.chip` already has `border: 1px solid var(--line-soft)`, so changing only the colour is free. If you thicken it, compensate the padding so the chip's box does not change size between states — a chip that grows on selection makes the whole row jump.
- `Filters.js`: the mark `src` no longer branches on active state. Every chip takes `_dark`. Delete the ternary and the comment above it explaining the two-context swap, and replace it with one line saying chips are single-context per register §14.
- The `All` chip is text and follows the same treatment: gold text, gold border, charcoal ground.

**Acceptance:**

- The active chip is unmistakable at 360, 390 and 430 px. **Screenshot every one of the ten chips in its active state.** If any reads as ambiguous against its neighbours, say so — a quieter active state is the named cost of this ruling and Joe needs to see it, not be told it is fine.
- CFP active on charcoal: re-measure and report. It should land near `cfp_dark`'s 10.05:1.
- No layout shift between states — measure the chip's width and height active vs inactive.
- Row still scrolls on one line; no page-level horizontal overflow.

---

## Stage 3 — the count line (05 §10)

`web/lib/offservice.js:208`, `countSummary(lines)`, currently:

```js
return [lines.total, lines.on, lines.pending, lines.tbd, lines.off].filter(Boolean).join(' · ');
```

Becomes three segments: **`airing`**, **`TBD`** (market-pending + network-TBD summed), **`unavailable`**. Drop `total` entirely. Zero-count segments stay omitted, so a fully-available day still reads `62 airing`.

- **Sum at the count-line layer only. Do not merge the underlying sets.** `isMarketPending` and the network-TBD predicate stay separate — D4's carve-outs, the row-wrapper classes in `SportBand.js` and prompt 24's mutual-exclusivity test all depend on them, and the two badges must keep showing two different words.
- `SportBand.js:91`'s toggle label was set to `Show {offCount} not on your services` by prompt 25 stage 6b. Change it to match the new vocabulary: **`Show {offCount} unavailable`** / `Hide them`.
- Update the tests that pin the old strings. **Change assertions, not fixtures** — the fixtures encode states, and the states have not changed.
- Update the `/* 5c. One line… */` comment at `globals.css:1484` to record that the line now holds one line through three segments at 360 px, and why the total came out.

**Acceptance, measured at 390 px and 360 px:**

- `/?day=2026-11-14` → the literal string, its pixel width, and the line count. Target: one line.
- `/?day=2026-09-03` → report the literal string.
- `/?day=2027-01-10` → the all-TBD case.
- A day carrying both market-pending and network-TBD in one band, if one exists in the loaded season — **report which day you used and whether one exists.** If none does, say so rather than synthesising one.
- Screenshots at both widths.

---

## Stage 4 — WWE and UFC empty-state copy

Prompt 25 correctly declined to invent a schedule claim for these two, because §13 supplied worked examples only for NASCAR and IndyCar. Cowork owed the copy. Here it is.

**The reasoning, so it is not re-litigated.** §13 requires an honest empty state naming *why* a chip is empty and *when* it arrives. NASCAR and IndyCar could name a date because each has an external gate — a playoff start, a schedule publication. WWE and UFC run continuously, so there is no date to name that would not be invented. What is left that is true is that the data is not loaded. Rights facts were deliberately **not** used ("streams on Paramount+", "Raw is on Netflix"): they are verifiable today, but they go stale silently inside an empty state nobody re-reads, and production is a public URL.

Extend the per-sport empty state at `app/page.js` (prompt 25's stage 2d work) with:

- **WWE** — `WWE is not loaded yet. Raw, SmackDown and the premium live events are coming.`
- **UFC** — `UFC is not loaded yet. The numbered events and Fight Nights are coming.`

Match the sentence shape prompt 25 shipped for NASCAR and IndyCar exactly — same punctuation, same place in the block, same element.

**Flagged for Joe's veto:** the phrase "are coming" makes a soft promise with no date. The alternatives were a bare "no games" (which §13 rules out), a date (which would be invented), and a rights claim (which rots). If he prefers a different register, this is one string each.

---

## Stage 5 — iOS standalone

The PWA is built and correct: `web/app/manifest.js` (`display: 'standalone'`, `theme_color` and `background_color` `#1b1b1b`, 192/512 icons), `web/app/apple-icon.png`, `appleWebApp: { title: 'MySports TV' }` at `web/app/layout.js:14`. **Do not redesign any of it.** Two things are missing.

### 5a. Status bar

`appleWebApp` carries only `title`, so Next never emits `apple-mobile-web-app-status-bar-style` and iOS falls back to `default` — an opaque light bar above a `#1b1b1b` app. Set `statusBarStyle: 'black-translucent'`.

`black-translucent` makes the web view extend *under* the status bar, so it must not ship without 5b. If 5b cannot be made to work, use `'black'` instead — a dark opaque bar with no layout consequence — and say so.

### 5b. Safe-area insets

Verified absent at `10efae7`: zero occurrences of `env(safe-area-inset` or `viewport-fit` in `web/app` or `web/components`.

- Add a `viewport` export to `layout.js` with `viewportFit: 'cover'`. Use Next's App Router convention; **do not hand-write a `<meta name="viewport">`** — the same reasoning already recorded in the `apple-touch-icon` comment at `layout.js:9–13` applies.
- `env(safe-area-inset-left/right)` on `.shell`'s horizontal padding, `env(safe-area-inset-bottom)` on its bottom padding, each with a `0px` fallback so a normal browser is unchanged.
- **The banner is meant to bleed full width** — that is why `Chrome` renders outside `.shell` (`layout.js:22–26`). Give `.banner` a top padding of `env(safe-area-inset-top)` so its content clears the status bar while its background still reaches the top edge. That is the point of `black-translucent`.
- `.mgrid-scroll` is a horizontal scroller: check it against the left/right insets in landscape, and add inset padding only if content actually lands under the notch.

**Acceptance:** report the rendered meta tags and the CSS added. Then state plainly that **this stage cannot be self-verified** — Playwright at 390 px is Chromium, not iOS Safari, and not the installed standalone app.

---

## Stage 6 — two Cowork calls, flagged for Joe's veto

Implement both. Report them clearly enough that he can reverse either in one line.

### 6a. Shorten the Weeks view chips

Prompt 25 reported that `/weeks` shares `.chiprow`, so its two long View chips now scroll instead of wrapping — 369 px of content against 336 at 360 px. §13 did not price that.

`app/weeks/page.js:156,159`: `Calendar week · all sports` → **`Calendar week`**, and `Season week · NFL & CFB` → **`Season week`**. The qualifiers are redundant with the control directly beneath them: the week dropdown is already grouped by sport with `<optgroup>`, so it says which sports a season week covers better than a chip label can. Report the new row width at 360 and 390 px.

### 6b. Raise the chip marks to fill the pill

Prompt 25 flagged that the 44 px accessible pills read tall against 13 px marks. **The evidence points one way:** §13's width table — the one the scrolling row was sized against — was computed at a **21 px chip height**, and `globals.css:1476` renders marks at **13 px** at ≤699 px. The marks have been running well under the basis the row was designed for, which is why the pill looks empty.

Raise `.chip-mark` to **20 px** at ≤699 px, keeping `width: auto` so nothing is squashed. Desktop (15 px) is unchanged — its pill is still 29 px.

Expect the row to widen from prompt 25's measured 519 px to roughly 780 px. That is fine; it already scrolls. **Report the measured row width at 360/390/430, confirm one line and no page overflow, and screenshot the row so Joe can judge the proportion.** If 20 px makes NASCAR dominate the row uncomfortably, report that with the shot rather than picking a compromise value silently.

---

## Stage 7 — report, and the on-device checklist

Per stage: what changed, the sha, the acceptance evidence, every judgment call. Gates before and after. Then a section headed **"For Joe's phone"**, because two things in this build can only be settled on the device:

1. **Installed app, iOS Home Screen.** Status bar text legible over the banner on the Today page; the banner's background reaching the very top with no light bar; nothing clipped by the home indicator at the bottom of a long scroll; in landscape, no content under the notch on either side.
2. **The mobile grid at both zoom extremes, in real Safari.** Prompt 25 stage 7c measured Chromium: `scrollWidth` tracks the transform, the right edge is reachable at 2.5×, and the only artifact is ~418 px of dead scroll past the end at 0.6×. **Safari is the authority and may differ.** Ask him to pinch to maximum zoom on `/?sport=cfb&day=2026-09-05` and confirm the last program of the day is reachable, then pinch out to minimum and note whether it scrolls into empty space.

Also report **anything you were told here that turned out to be wrong.** Prompt 25 found three bad citations in its own brief and that was the most useful part of its report.

---

## Explicitly out of scope

- **The mobile page order implementation.** Ruled and documented in stage 1c; built in prompt 27. It changes which games each count line covers, and stage 3 is already changing what that line says — landing both together means a mid-run stop leaves it unclear which half of the count semantics landed.
- **The grid zoom fix.** Joe's ruling: the Chromium measurement says there is no clipping, and nothing gets designed around a defect until his phone confirms one exists. Stage 7 asks the question; a fix is a later prompt if the answer warrants it.
- **`SCHED` in the card's right slot** — Joe has opened it as a separate design conversation. Cowork owes him an options board.
- **`--faint`** — 3.63:1 on the card top is accepted and documented in stage 1e. Do not chase AA there.
- **`.favlabel` / `YOUR TEAMS` prominence** — Joe's ruling still open, and 05 §11 will move the label to section level anyway. Leave its size, weight and letter-spacing alone.
- **`programs/big-noon-kickoff.png`** — its 1.122% builder failure is known and deliberate. Prompt 16 kept it as an honest FAIL and declined to widen the tolerance. Leave it.
- Anything in `pipeline/`, `adapters/`, or the database.
