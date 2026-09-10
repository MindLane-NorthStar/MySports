# Prompt 73 — the banner stays on screen until Joe scrolls

Follows `ccaa9a8`. One stage, and it revises a ruling from prompt 71.

Gate floors from `docs/handoff-status.md`: `pytest` 514 + 1 skipped · `test:unit` 494 ·
`smoke` 33/33 · `qa-shots` 91/91 · `geometry` all hard stops. Clear stray dev servers and chromium
before the first gate and report what you started from.

---

## WHAT IS ACTUALLY WRONG — prompt 71 stage 2 works, and this is not a regression of it

Joe, 2026-09-09: *"the banner doesn't go anywhere but it's lost atop the screen because the scroll
scrolls past the banner in total."*

**The header is no longer collapsing — that half shipped and holds.** What defeats it is the landing:
in week view the auto-scroll moves the page to today's block, which on a mid-week day is ~1000px
down, and the banner — `position: relative`, first in flow — goes off the top of the viewport with
everything else. Not collapsed. Scrolled past. The reader sees the control stack and cards, which
is indistinguishable from the complaint prompt 71 set out to fix.

**Do not re-open the collapse suppression.** `AutoScroll` and `CollapsedHeader` behave as prompt 71
measured; this is about where the page comes to rest, not about the observer.

## JOE'S RULING

> *"I think the answer to all of this is to make banner STICKY until the user scrolls, regardless of
> day/week, All Games/MyTeams, List/Grid, All Sports or League tile."*

**The banner pins to the top of the viewport and stays there until the reader's own first scroll
releases it.** After release, everything behaves exactly as it does today — the banner scrolls away,
the sentinel crosses, `.chdr` appears, `.pickrow` sticks at `--stack-h`.

### TWO EVENTS, NOT ONE — Joe's ruling 2026-09-09, and the thing most likely to be misread

**RELEASE and COLLAPSE are separate, and they happen at different moments.**

| # | event | trigger | what the reader sees |
|---|---|---|---|
| 1 | **release** | the reader's own first scroll | the pin lets go; the banner becomes ordinary flow content and moves with the finger |
| 2 | **collapse** | the sentinel crossing, exactly as today | banner and control stack have cleared the top; `.chdr` appears, `.pickrow` sticks at `--stack-h` |

**Between them there is a stretch with no navbar yet**, while the banner's tail and the picker are
still leaving. That is today's behaviour and it is deliberate — Joe chose this over an immediate
swap-in-place, having been shown both.

**So the banner stays IN FLOW.** Pin it for the pinned interval and return it to flow on release; do
not convert it into a frame element. The sentinel, `--stack-h` and the re-expand path all keep
working the way they do now, and this stage is additive to a mechanism that already holds.

**REJECTED, and recorded so it is not re-proposed as an improvement:** making the banner permanently
pinned and swapping it to the navbar in place. It reads better — no transitional beat, the top edge
always holds something — and it is a different and larger change, because a banner that never travels
breaks the sentinel that triggers the collapse, the height arithmetic the landing depends on, and the
route back to the expanded banner. Joe's words: *"lets try 1."* If the transitional beat turns out to
bother him on the phone, that is a follow-up prompt, not a reason to reach for it here.

**Every view combination, no exceptions.** Rule 32: enumerate them rather than testing one — day and
week, ALL GAMES and MY TEAMS, LIST and GRID, ALL SPORTS and a league tile. Report the matrix and what
each showed.

---

## THE FOUR HAZARDS, and none of them should be reasoned about from this brief

I have been wrong about this component's mechanics four times in this session. **Measure each.**

### 1. The landing arithmetic has to include the pinned banner

`AutoScroll` clears the sticky stack via `stackBottom()`, which is built from `--stack-h` — and
`--stack-h` is `.chdr`'s rendered height, written by a ResizeObserver in `CollapsedHeader.js:193`.
**While the header is expanded `.chdr` is `display: none`, so `--stack-h` is 0** — which is exactly
why prompt 71 reported the week landing moving from 108 to 47.

A pinned banner adds a second thing the landing must clear, and it is not in that variable. **If the
arithmetic does not learn about it, today's block lands behind the banner** — the same class of fault
prompt 67's first implementation hit. Decide deliberately whether the banner feeds `--stack-h` or a
companion variable, say which and why, and re-measure every landing figure. The current baselines are
in `handoff-status.md`; **re-baseline them there rather than in a commit message.**

### 2. Prompt 62's letterbox

`.chdr` is sticky at `top: 0` and `.pickrow` at `top: var(--stack-h)`. A pinned banner makes a third
sticky element in that stack. Prompt 62 found that a transparent band between two stuck elements
becomes *"a letterbox that the schedule scrolls through"*, which is why that 8px is padding inside the
plate rather than margin. **Verify across scroll positions that no transparent strip opens between
the banner and whatever is under it.** Prompt 70 sampled 68 positions over a 10,490px day; do
something of that order rather than eyeballing two.

### 3. "Until the user scrolls" means the reader's own gesture

The programmatic scroll must not release the pin — it is the thing the pin exists to survive. Prompt
71 got the equivalent distinction right by finding the trigger was a crossing observer rather than a
position check; find the equivalent here and **say what you keyed the release on.** A release keyed
to `scrollY` changing will fire on the auto-scroll itself and this whole stage will do nothing.

### 4. GRID view scrolls sideways and has its own sticky rail

`MobileGrid` has a sticky rail and a horizontal scroller with a frozen geometry. **A pinned banner
over it is the case most likely to break something**, and the phone-grid tripwire is a hard stop:
CFB `2026-09-05` 64 / {240, 223, 205, 136} / 1273, MLB `2026-09-03` 3 / {228} / 567. If a block count
or width moves, stop and report — do not re-baseline.

---

## THE NUMBER JOE NEEDS BACK

The banner's phone stage is 428×135 (`globals.css:1955`), so the artwork is roughly 123 CSS px at
390 — **affordable, but measure the real total** with the control stack, and report:

- pinned banner height, control stack height, and **how many CSS px remain for content at 390×844**
- **how many cards are visible** below the pinned banner after the week-view landing

That second figure is the one that decides whether this design is right. The auto-scroll exists to
show what is on now; if pinning the banner leaves one card visible, the two features are fighting and
Joe should see that in a screenshot rather than on his phone.

Screenshot into `assets/`, all at 390×844: cold open; after switching to week view (banner pinned,
today landed); after the first manual scroll (banner released); and the same three in GRID.

---

## GATES AND COMMITTING

Five gates, each its own command, all reported, before any commit. Never read a gate's result from
the exit code of a chained command (rule 26).

`qa-shots` and the spacing probes measure this region — `web/scripts/probes/` now holds
`s0-gaps.mjs` and `s3-spacing.mjs` as tracked tools with a throwing landmark guard. **Run them and
report, and if a probe throws, that is the bug surfacing — report it rather than softening the
guard.**

Rule 23: `docs/design/mobile_demo.html` models no scroll behaviour, which prompt 71 established by
its own declaration. **Confirm that still holds and say so** rather than leaving the check unstated.

One commit, staged by explicit path (rule 4, never `git add -A`; `assets/` stays untracked).
Secret-gate on ADDED lines only, with `grep` (rule 3).

**Do not commit or push without Joe's explicit approval.** Report the matrix, the two measurements
and the six screenshots, and wait.
