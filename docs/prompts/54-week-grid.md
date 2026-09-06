# Prompt 54 — the week grid

**Run this AFTER prompt 53.** It depends on stage 3 of that run: GRID VIEW must already mean "the
grid is the primary object" before a week can have one, or this prompt would be building a second
answer to a question 53 already settled.

`CLAUDE.md` is the standing brief and you have read it. This prompt names rule numbers only where a
stage collides with one.

---

## WHAT THIS BUILDS, AND JOE'S MODEL

> "Choosing 'Week 1 NFL' displays all cards for that week's NFL games — cards from Wednesday,
> Thursday and Sunday — and TV grid from Wednesday, Thursday and Sunday."

**A TV grid's x-axis is one viewing day's minutes.** Seven days cannot share one horizontal ruler, so
a week grid is **N grids, stacked, one per day that has games**, each under its own day heading. That
is exactly what Joe described.

**The sport tiles are the scaling control**, ruled 2026-09-06 after the measured comparison: the
heaviest ALL-SPORTS week renders 109 cards at 17,971px while a single ALL-SPORTS day renders 87 at
16,807px — within 7% of each other. Week mode is not the expensive axis; ALL SPORTS is, and it is
already that expensive in day mode. **Do not add a day sub-picker inside the week.** If a seven-day
MLB grid stack proves unusable, the answer is the per-day lazy rendering already scoped as the next
lever, and it applies to the list identically — one job, not a week-grid special case.

---

## PRECONDITIONS

1. `HEAD` is prompt 53's final commit, and `HEAD == origin/main`.
2. Tree clean except the untracked `assets/` directories.
3. Baseline gates recorded from prompt 53's report, not from this brief.
4. **Confirm 53 stage 3 shipped**: in day mode at 390, GRID VIEW renders zero cards. If it does not,
   stop and report — this prompt has nothing to build on.

---

## STAGE 1 — the week renders a grid per day

**Read and cite first:** `page.js:254-286` (the week branch's return), `:270-279` (the day map),
`Listing.js:28-30`, `:97`, `:103-106`, `:145-150`.

### This is smaller than it looks

`Listing` already renders a grid for whatever day it is given: `showGrid = Boolean(grid && games.length)`
(`Listing.js:97`), and `MobileGrid` takes `games`, `sport`, `day` and `nowMinute` (`:147`). The week
branch calls `Listing` **once per day already** (`page.js:275`). It simply passes none of the grid
props.

So the build is: pass them, per day.

```
<Listing games={grouped[d]} … day={d} sport={P.sport}
         grid nowMinute={d === today ? viewingMinutes(now) : null}
         heading={shortDay(d)} headingClass="weekday-head" />
```

- **`grid`** turns the day's grid on.
- **`sport`** is currently not passed at all in week mode — `MobileGrid` and `SportBand` both receive
  `undefined`. Pass it. (Prompt 53 stage 5 may already have added it for the bands; if so, this is
  a no-op and say so.)
- **`nowMinute`** — `viewingMinutes` is already imported (`page.js:33`) and `now` already exists in
  the day branch. The week branch has no `now`; add one, computed **on the server** from the request
  time exactly as day mode does (`page.js:320`), so no clock reaches the client and nothing enters
  the hydration path. **Only the day that IS today gets a marker**; every other day gets `null`.

### The list, in grid view

Prompt 53 stage 3 made GRID VIEW suppress the list. That suppression must apply **per day** here: in
week + GRID each day group renders its heading and its grid, and **no cards**. In week + LIST nothing
about this stage is visible — confirm that by diffing the rendered DOM against the previous commit.

### Acceptance

- WEEK · NFL · GRID at 390: one grid per day that has games — for a typical week that is Thursday,
  Sunday and Monday, **not seven**. `page.js:271` already gates on `grouped[d]?.length`, so empty
  days must not produce empty grids. Report the day count and the block count per day.
- WEEK · ALL SPORTS · GRID at 390 on the heaviest loaded week: report the number of grids, the total
  page height, and the DOM node count. **This is the number Joe will want** — if it is past ~35,000px
  say so plainly rather than burying it.
- The now-marker renders on exactly one day and only when the week contains today. Prove it on a week
  that does and a week that does not.
- WEEK · LIST is byte-identical to prompt 53's output.

**Commit:** `hub: a week renders a grid for each of its days`

---

## STAGE 2 — the week grid on desktop

The mobile grid is phone-only and stays that way — the Mobile Grid Addendum's deviations are
phone-only, M5 says "PC keeps v1.2 labels," and prompt 53 stage 3 already settled desktop GRID VIEW
in day mode by promoting `ArchivedGrid`.

**Week mode follows the same rule, per day.** With a sport selected, each day that has an archived PC
grid for that `(sport, day)` renders it under its day heading; the list stays suppressed.

**Two cases need copy rather than a fallback:**

- **A day with no archived render.** `ArchivedGrid` already has an honest one-liner (`page.js:91-98`).
  Seven of those stacked is noise — so **report once for the week**, naming which days are missing,
  rather than once per day. Write it in the existing voice.
- **ALL SPORTS on desktop.** An archived grid is per `(sport, day)` by construction, so there is
  nothing to promote. One line for the week saying the desktop grid is per league and to pick one —
  the same sentence prompt 53 stage 3 wrote for day mode. **Reuse it; do not write a second.**

Never fall back to the phone grid at desktop width.

**Commit:** `hub: the desktop week shows archived grids, or says why it cannot`

---

## STAGE 3 — the geometry check, RESHAPED

**Prompt 53 found the tripwire firing on data, and this stage fixes the tripwire rather than adding
seven more of them.**

### What prompt 53 found, and what it actually means

The MLB baseline moved to 3 / {226} / 564 against the recorded 3 / {228} / 568, **with every file of
that run reverted** — so no code caused it. Cowork then verified the mechanism:
`MobileGrid.js:~160-166` measures `widest` from `` `${at}${rank} ${name} ${record}` `` and
`pxPerMin = pxPerMinute(widest / SCALE, scaleSport) * SCALE`. Every block width AND `scrollWidth`
derive from that one number.

**So the pixel figures are a function of the schedule (stable), the records (drift all season) and
the CFB poll ranks (drift every Sunday).** The CFB baseline is the MORE volatile of the two — it
moves when a team enters or leaves the top 25 — and it has held so far only because early-season
records are two characters.

Re-baselining resets a clock. A tripwire that fires on the standings gets ignored, and an ignored
tripwire catches nothing.

### Reshape it

**HARD STOP — code-derived, immune to data:**

- block **count** per network row
- **lane** count per row, and the number of network rows
- painted width == laid-out width at zoom 0.6 / 1.0 / 2.5 (the prompt-30 bug)
- rail delta **0.0px** at every zoom after panning fully right (M4)
- no block below the 46px floor; no team name wrapped or truncated

**REPORT AND EXPLAIN — data-derived, legitimately drifts:**

- block widths and `scrollWidth`. Record them **with the `widest` measurement beside them**, so the
  next run can tell data from code in one step: if `widest` moved and the ratio `scrollWidth / widest`
  held, that is the standings. If the **ratio** moved, that is code, and that is the stop.

**AND KEEP THE ONE DERIVED CHECK THAT EARNED ITS PLACE:** when `--rail-w` changes by N, `scrollWidth`
must change by exactly N. That is what proved prompt 52's rail narrowing did what it intended, and it
holds at any absolute value.

Re-baseline MLB to 226 / 564 as part of this, with its `widest` recorded, and say plainly in the note
that the figure is expected to drift.

### The week's own check is better than any baseline

A grid inside a week must produce **identical geometry** to the same day rendered in day mode — same
component, same data, same everything. **That comparison is completely immune to data drift, because
both sides see the same standings.** It is the strongest check available here and it should be the
week grid's primary guard.

Prove it for at least three days across two weeks, including one day whose slate spans more than one
sport. Assert block counts, lane counts, widths and scrollWidth are **exactly equal** between the two
render paths. If they differ, the week path is handing `MobileGrid` different input — that is the bug,
and it is a hard stop.

**Tests:** pin the per-day grid at the call site rather than to a row count (rule 19's lesson applied
to rendering), assert an empty day produces no grid, assert the now-marker appears on exactly one day,
and assert the day/week equality above.

**Commit:** `grid: the week baseline, and the day/week geometry equality`

---

## STAGE 4 — the record

**Enhancement register §22** (verify §21 is prompt 53's): the week grid. Record Joe's model, the
per-day stacking and why a single time axis cannot span a week, the measured comparison that settled
the scaling question (109 cards / 17,971px for the heaviest week against 87 / 16,807px for one
all-sports day), the ruling that the sport tiles are the scaling control, and the rejection of a day
sub-picker with the lazy-rendering lever named as the future alternative.

**Mobile Grid Addendum:** a new clause for the week grid, and the reshaped geometry check — what is a
hard stop, what is reported, and why the pixel figures drift. Bump the version.

**`docs/handoff-status.md`:** the stage/commit table, gates, and the week baselines.

**`CLAUDE.md`:** rewrite the tripwire section to the reshaped form. It currently states the absolute
pixel figures as a hard stop, which prompt 53 proved wrong — that line would send a future session
hunting a regression that is the standings. This correction is the point of stage 3 and must not be
skipped.

**`docs/design/mobile_demo.html`** if anything it implements changed (rule 23) — likely not, since the
grid component is unchanged, but check rather than assume.

**File this prompt** at `docs/prompts/54-week-grid.md`, verbatim.

**Commit:** `docs: register §22, the week grid on the record`

---

## THE REPORT

1. **The number Joe wants first:** WEEK · ALL SPORTS · GRID on the heaviest week — grids, page height,
   DOM nodes — set beside the day-mode figures so he can see whether the scaling worry was founded.
2. Per-day block counts for the NFL and CFB weeks used as baselines.
3. The day/week geometry equality proof.
4. Stage by stage: sha, gates, anything skipped.
5. Every citation in this brief that was wrong.
6. HEAD, and whether `HEAD == origin/main`.

**One thing to flag rather than fix if you find it:** if a seven-day ALL-SPORTS grid stack is
genuinely unusable on a phone, say so with the measurement and stop. That is Joe's call and the lever
is already named — it is not this prompt's job to invent virtualisation at 3am.
