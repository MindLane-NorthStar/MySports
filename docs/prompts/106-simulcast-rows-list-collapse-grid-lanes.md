# Prompt 106 — THE SIMULCAST ROWS, THE LIST COLLAPSE, AND THE GRID LANES

**This is the render prompt prompts 104 and 105 were foundation for.** It emits the broadcast rows
that do not exist yet, collapses them on the list card, and puts the game in every lane on the grid.
**Preemption is NOT in this prompt** — see the end for why it changed shape.

Stacks on `875a50b`. **Check `git rev-parse --short origin/main` first:** if it is still `192677f`,
this tree has unpushed work and Vercel has compile-checked none of it.

## Joe's rulings, all given 2026-09-16

1. **Every network airing a Cavs game shows it on the GRID** — the WOIO/CBS row, the WUAB 43 lane,
   and the RESN/DAZN lane, as applicable per game. A both-station game therefore appears three times
   on one grid. **Deliberate, not duplication.**
2. **The LIST card shows one card per game** with the composite mark for its simulcast state.
3. **On a collapsed LIST row the grey network text is suppressed** — mark only. This **overrides**
   `web/lib/marks.js:26`, which states that a listings row shows network text for every matchup with
   the mark as an addition. Record it as an override, not a tidy-up.

## What the tree says — verified 2026-09-16 before this brief was written

- **`adapters/nba.py:70` `simulcast_outlets(carriage, abbrev, other_ab, start)`** returns the outlet
  list for a game, matched on **ET date AND opponent tricode together**. Already tested. Use it.
- **`adapters/nba.py:90` `_simulcast_row(...)` returns `None`, deliberately.** Its docstring names the
  three things this prompt must decide. **That docstring says "PROMPT 105 OWNS THE ROW" — stale.**
  105 became the width match. Correct the reference while you are in the function.
- **Two call sites, `adapters/nba.py:174-175` and `:249-250`**, both guarded by
  `if sim and not any(m["outlet"] == sim["outlet"] for m in media)`. **That dedupe assumes one outlet
  per row**, which is the shape below.
- **`data/row_order.json` HAS NO WOIO LANE IN THE NBA BAND.** `{"network": "CBS", "station": "WOIO",
  "channel": 19}` appears only under `/cfb/broadcast[3]` and `/nfl/broadcast[0]`. The NBA band carries
  `/nba/broadcast[2]` = `WUAB 43`, whose `_note` records that station and channel keys are omitted on
  purpose because the Cleveland's 43 mark identifies the station (Joe, 2026-09-01).
- **`web/components/MatchupCard.js:168`** is the list card's mark:
  `const mark = showsMark(b) ? markUrl(b.service_id) : null;`, rendered at `:240` as
  `<img className="mnet-mark">`.
- **`web/components/MobileGrid.js:406`** is the rail: `markStyle(r.id, 26)`.
- **`web/components/GameDetail.js:370`** renders a mark per broadcast row — a third surface.

## Block A — the lane that does not exist

Add the CBS/WOIO lane to the **NBA band** in `data/row_order.json`, positioned by the station
ordering rule the file already carries (WOIO 19 → WUAB 43 → WBNX 55, channel order).

**Match the band's own convention, do not copy the CFB/NFL entry blindly.** The NBA band's WUAB entry
deliberately omits `station` and `channel` because its mark carries the call letters. Decide whether
the NBA CBS entry should do the same, **say which you chose and why**, and make it consistent with
how the lane's mark renders. If the CFB/NFL shape is right here too, say that — but say it as a
decision, not a default.

## Block B — emit the rows

`_simulcast_row` emits. **One row per outlet**, because that is what the callers' `m["outlet"]` dedupe
at `:175` and `:250` already expects, and because the grid needs one row per lane.

- A WOIO game emits a **CBS** row. WOIO is deliberately absent from `data/access_profile.json` and
  **must stay absent** — it resolves as CBS. Where that resolution lives is yours to place; name it.
- A WUAB game emits a **WUAB 43** row.
- A both-station game emits **both**.
- The RESN/DAZN row is unchanged and still emitted as it is today. Every simulcast game keeps it.
- **Do not emit for a nationally exclusive game.** `national_exclusive` at `:167` and `:242` already
  computes this; respect it and say what happens to a simulcast entry that collides with one. (None
  of the fifteen should, since the package is the DAZN free games — if one does, that is a finding.)

**Availability:** a simulcast game is available if **any** of its outlets is available. Joe ruled this
in principle — someone with an antenna and no DAZN can watch. Implement it where outlet access is
resolved, not per surface.

## Block C — the LIST collapses

One card per game. The card's mark is chosen by the set of Cleveland services present on that game:

| services present | mark |
|---|---|
| DAZN + CBS | `cbs-dazn` |
| DAZN + WUAB 43 + CBS | `cbs-wuab-43` |
| DAZN + WUAB 43 | `wuab-43` (existing) |
| DAZN alone | `dazn` (unchanged) |

**Derive the mark from the services present — do not read the simulcast file from the component.**
The rendering surface should not know about `local_rights.json`.

Suppress the grey network text on a collapsed row, per Joe's ruling. **Leave it exactly as it is on
every non-collapsed row** — this override is scoped to collapsed rows and nothing else.

**`GameDetail.js` is NOT collapsed** — Cowork's call, stated for Joe to override: the detail view has
room, it is the surface where "which service carries this" is the actual question, and showing each
row with its own mark is the honest answer there. Change nothing at `:370`.

## Block D — the guard the last prompt asked for

`web/test/railmark.test.mjs` already notes that Joe ruled the composites **list view only** and that
**nothing in the manifest records a mark's surface.** Close it: a composite must not be reachable by
the rail or the grid. A convention is not a guard, and both composites currently land on the rail's
600px² target, so a leak would render correctly and go unnoticed.

**Also fix the lying test name while you are in that file:** `:47` is called
`'31 of 32 marks land on the 600px^2 target…'` while `:67` asserts `manifest.length - off.length === 34`
against 35 marks. The assertion is right; the name has been stale since prompt 72 added `directv`, and
prompts 104 and 105 both passed over it. A failing run currently sends the reader hunting for 32 marks
that do not exist.

## Explicitly out of scope

- **PREEMPTION, and it changed shape — read this before scoping it later.** There is no CBS
  entertainment programming in this app to preempt; it carries sports. The only real collision is a
  Cavs simulcast overlapping a CBS **sports** event on the same station, which puts the same station
  in two different sport bands in the same hour — a cross-band problem, not a row-suppression one.
  Several of the fifteen dates sit near bowl season, the NFL playoffs and selection Sunday, so it is
  live rather than theoretical. **Prompt 107. Do not design for it here, and do not leave a hook.**
- The 43 artwork and the "Cleveland's" question. Untouched.
- The refresh-schedule work. Untouched.
- **No `access_profile.json` entry for WOIO.**

## Gates and committing

All five gates, each as its own command with its own count, floors read from `docs/handoff-status.md`
under "Repo state" beforehand. New assertions get mutation checks, said out loud — in particular, a
mutation that emits one row for a both-station game, and one that picks the wrong composite for a
service set, must each fail.

**This prompt changes rendering, so a passing test is not the deliverable.** Produce rendered evidence
of a list card at each of the four mark states and of one both-station game on the grid showing three
lanes, saved under `assets/p106-simulcast-render/` (untracked), and say where it is.

Record the rulings in `docs/enhancement-register.md` as its own section: the three-lane grid as
deliberate, the list collapse, the text suppression as an override of `marks.js:26`, the availability
rule, and the GameDetail decision.

**Stages self-commit on green. DO NOT PUSH** — Joe authorizes it, same as 104 and 105. End with
`git status --porcelain`, `git rev-parse --short HEAD`, `git rev-parse --short origin/main`, and the
work left in the tree.
