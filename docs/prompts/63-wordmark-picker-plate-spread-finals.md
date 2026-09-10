# Prompt 63 — the wordmark, the picker's plate, the point spread, and the finals that never land

**Venue:** Claude Code. **Shape:** staged, self-committing. **Nothing pushes.**
Two strikes on a stage and you skip it and report.

Four findings from the phone, in the order they cost Joe the most. Stage 1 is a visible regression
from prompt 61 and should land first.

## Rules that bite

Rule 3 (secret gate, ADDED only, `grep`), rule 4 (stage by path), rule 11 (`--no-optional-locks`),
rule 13 (**a threshold is measured against the LOCAL background**), rule 16 (tokens read from
`globals.css`), rule 20 (line-anchored surgery), rule 22 (read the component, cite file and line),
rule 23 (`docs/design/mobile_demo.html` moves in the same commit as anything it implements),
rule 26 (gate and commit are separate commands).

**Read the gate floors from `CLAUDE.md`, not from this brief.** Line numbers in this brief came from
Cowork reading the files today; verify each before relying on it, and note any that had drifted.

## The five gates, each its own command, before every commit

```
pytest · npm run test:unit · npm run smoke · node scripts/qa-shots.mjs · npm run geometry
```

---

# Stage 1 — MYSPORTS TV is invisible

**The wordmark is gone from the navbar in every screenshot.** The box is still there — the toggles
are still pushed right by it — so this is a paint failure, not a layout one, which is exactly why
stage 5b's measurements (button top 0, height 44, widths unmoved) all passed.

## The cause, and verify it before fixing it

`.chdr-wm` carries the gradient fill: `background-image: linear-gradient(...)` plus
`-webkit-background-clip: text`, `background-clip: text` and `color: transparent`. Prompt 61 stage 5b
moved the text out of the button and into a child, `<span className="chdr-wm-ink">MYSPORTS TV</span>`
(`components/CollapsedHeader.js:331`).

`background-clip: text` clips an element's own background to **that element's own glyphs**. With the
text in a child, the child paints the glyphs and inherits `color: transparent`, while the parent has
no text of its own for its background to clip to. Result: transparent letters over nothing.

## Do

1. Move the gradient, both `background-clip` declarations and `color: transparent` onto
   `.chdr-wm-ink`. Leave the button's box alone — its 44px height is the tap target on purpose
   (`.chdr-wm`'s own comment says so), and `background-color: transparent` must stay on the button
   rather than becoming `background: none`, which would take the gradient with it.
2. Keep stage 5b's optical offset. Re-measure the two gaps and confirm they are still 14.25/13.75 at
   390 and 15.00/15.75 at 360, or report what moved.
3. **Add a test that would have caught this.** A box measurement cannot see it. Assert the paint
   contract instead: whichever element carries `background-clip: text` also carries the
   `background-image` and the `color: transparent`, and it is the element that holds the text.

**Commit:** `header: the wordmark paints again`

---

# Stage 2 — the picker's plate, and the space above it

Two symptoms, possibly one cause. **Measure before changing anything** — Cowork has hypotheses and no
measurements, and both hypotheses may be wrong.

## Symptom A — the surround does not match the navbar

Joe: *"the surround/background color of the picker is the same color as the background of the app
below, not the surround/background of the navbar."*

`html[data-hdr='collapsed'] .pickrow` already sets `background: var(--spot-2)` (`globals.css:3160`),
which is the same token `.chdr` uses. So on paper they match, and they visibly do not.

**Cowork's hypothesis, to test rather than accept:** `.chdr` is full-bleed, but `.pickrow` lives
inside `.shell`, which carries `padding: … calc(20px + env(safe-area-inset-right)) …`. So the
picker's plate stops ~20px short of each edge and the page's radial ground shows through at the
sides — and near the top of the page that gradient is much lighter than `#1b1b1b`.

**Measure it:** sample the rendered pixel colour at three points in the collapsed state — inside the
navbar, in the picker's surround beside the pill, and at the picker row's far left edge — and report
three hex values. That settles it in one step. If the hypothesis holds, the plate needs to reach the
viewport edges without the picker's *content* leaving the column.

## Symptom B — more space above the picker than below

Joe: *"more vertical space between the thin gold line above the picker and the picker itself than
between the picker and the gold line beneath it. This only renders when you have scrolled down…
when you scroll back up it compresses and goes away."*

`.pickrow` collapsed has `padding: 8px 0` — symmetric — so the asymmetry comes from somewhere else.

**Two candidates, both checkable:**
- `--stack-h` is larger than `.chdr`'s real height, leaving a strip between the navbar's hairline and
  the stuck picker where scrolling content shows through. The ResizeObserver measures `.chdr`
  including `padding-top: env(safe-area-inset-top)`; confirm the value it writes equals the element's
  actual `getBoundingClientRect().height` on a device with a non-zero inset.
- Something between `.chdr-inner`'s hairline and `.pickrow` adds height — `.chdr`'s own box below its
  last child, or a margin surviving on `.pickrow` in one state.

**Measure both gaps directly**: the distance from the navbar hairline's bottom to the picker pill's
top, and from the pill's bottom to the picker hairline's top, in the collapsed state, at a simulated
inset of 59 as well as 0. Report all four numbers before you change anything. Joe reports the
asymmetry only appears with a real inset, so a zero-inset test may show nothing.

**Commit:** `header: the picker's plate reaches the edges and sits square`

---

# Stage 3 — the point spread replaces the moneyline

Joe's ruling: the right rail shows the **point spread**, not the moneyline, with the favourite's mark
above it. Confirmed with him: **the mark stays in the right rail only** — the matchup itself keeps
away-on-top and does not reorder.

## Where it lives

`slotContent` in `web/lib/format.js:222` is the five-rung state machine, and rung 4 at `:271` is the
scheduled-with-a-line case. It currently sets `row2` from `fav.ml`. `favourite()` in
`components/MatchupCard.js:142` already picks the side from the moneylines first and the spread
second, and `game_odds.spread` is **home-relative: negative means home is favoured** (`0003_games.sql:139`).

## Do

1. **Row 2 becomes the spread** when the game has one: the favourite's own number, so a home favourite
   at `-7.5` reads `-7.5` and an away favourite at spread `+7.5` also reads `-7.5`. The sign is always
   negative for the favourite — that is what a spread means.
2. **Fall back to the moneyline** when there is no spread (Joe's ruling). MLB is usually priced on the
   moneyline and the run line, so this is the common path there, not an edge case. Nothing ever
   renders blank where a number exists.
3. **A pick'em is not a favourite.** `favourite()` already returns null at `sp === 0`; keep that.
4. **`row2Px`.** The comment at `:278` says a moneyline never needs the step-down because the widest
   is 54.95px at 17px. A spread is narrower than any moneyline, so the same holds — but say so from a
   measurement rather than inheriting the claim.
5. **O/U stays** in row 3 unchanged.
6. Applies to every sport that carries a spread — this is one function, so do not special-case CFB.

**Commit:** `odds: the right rail shows the point spread`

---

# Stage 4 — completed games still show odds

Joe: *"any game that has completed is still showing betting odds."* Screenshot evidence: the MLB week
list for **Mon Sep 7**, viewed on Sep 8, still shows `-139 / O/U 7` for Guardians at Orioles — a game
that finished the previous afternoon.

## This is a data fault, not a rendering one

`slotContent` already does what Joe described, and does it **before** it reaches the odds rung: a
scored game returns the winner's mark, the score with the higher number first, and `resultLabel`
(FINAL) at `:244-261`. The odds rung at `:271` only fires when `status === 'scheduled'`. So the UI is
already correct and the row's `result_status` never left `scheduled`.

`pipeline/load.py:89` writes it as `result_status = coalesce(%s, result_status)`, and the adapters
compute it from provider state — so the write path exists and is null-safe.

**Cowork's leading hypothesis:** the nightly anchors on *today* and never re-fetches yesterday, so a
game that finished after the last fetch covering it is never revisited. Check what window
`schedule_refresh.yml` actually loads and whether any step looks backwards.

## Do

1. **Diagnose first, and report before fixing.** For a handful of known-complete games, read
   `result_status`, `home_score`, `away_score` and `completed_at` straight from the database over
   PostgREST anon reads (rule 14 permits reads; use the paginating `restAll()`, rule 19). Say whether
   the rows are stale or the UI is misreading them. If the rows are correct and the UI is wrong,
   **stop and report** — that is a different bug from the one this stage describes.
2. If the rows are stale, establish what would have to change for a finished game to get its final:
   a backward-looking window on the nightly, a separate results pass, or a re-fetch of any game whose
   kickoff has passed and whose status is still `scheduled`. **Describe the options and their cost.
   Do not implement one** — a change to what the nightly fetches is Joe's call, and it is the same
   workflow that has already broken once this week.
3. **Team records.** Joe wants them current after a game completes. Check whether `team_records` and
   the game-level record fields update on the same path. Report; do not change.

**Commit:** only if step 1 produced a committable diagnostic (a test or a script). Otherwise report.

---

# Stage 5 — a check Cowork wants run, not a change

The odds upsert now carries an update list — `["spread","total","home_moneyline","away_moneyline",
"fetched_at"]` — and **no `preserve`**. `pipeline/db.py`'s own docstring records why that matters: a
loader that could not reach its provider once wrote nulls over 94 rows of reference data, and
`preserve` exists so a null means "I did not find out" rather than "the value is gone."

Screenshot evidence that this may already be biting: the MLB cards for **Tue Sep 8**, screenshotted at
7:14 AM ET — fourteen minutes after the 11:00 UTC nightly — render `–` where Sep 7's cards, written
before the loader change, show real moneylines.

**Do:** read the current rows for a few of those games and say whether their moneylines are null. If
they are, say whether the provider sent nulls or the update wrote them. **Report only.** Adding
`preserve` is a judgement about what a missing line means, and Joe should make it with the numbers in
front of him.

---

# The report

Per stage: what changed, the five gate counts, the commit hash, and every number you measured with the
command that produced it. Then:

- **The three sampled hex values** from stage 2, and the four gap measurements.
- **Whether the wordmark test would have failed** against the broken version — write it, then confirm
  it goes red on the old markup before you call it a guard.
- **Stage 4's verdict**: stale rows or misread rows, and the options with their cost.
- **Stage 5's numbers**, and whether the provider or the loader produced the nulls.
- **Anything in this brief that turned out to be wrong**, including the line citations.
