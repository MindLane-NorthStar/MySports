# Prompt 75 — one chronological run per band, and the favourites marker moves onto the card

Follows `392d08b`. Three stages, one commit each.

Gate floors from `docs/handoff-status.md`: `pytest` 514 + 1 skipped · `test:unit` 518 ·
`smoke` 33/33 · `qa-shots` 91/91 · `geometry` all hard stops. Clear stray dev servers and chromium
before the first gate and report what you started from.

---

## JOE'S RULING, 2026-09-09

> *"Organize qualifying events by TIME, including pregame shows and MyTeams games. THEN when events
> start at the same time, prioritize by: Pregame shows, MyTeams, Other events."*

His worked example — Sunday NFL, day view, list, with the Browns and Panthers among his teams:

```
FOX NFL Kickoff             11:00   FOX
FOX NFL Sunday              12:00   FOX
CBS NFL Today               12:00   CBS
Browns @ Steelers            1:00   CBS
Football Night in America    7:00   NBC
Panthers @ Bucs              8:15   NBC
```

Answers he gave to the three questions:

1. **Within each sport band**, not one flat list across sports. The band headings stay.
2. **The gold left rule becomes a gold OUTLINE of the card.**
3. **Any studio show, pre or post.** His words: *"so long as the priority is 1) TIME 2) pre/post THEN
   myteams THEN other events."*

---

## STAGE 1 — `chronological()` learns a third term

`chronological()` (`web/lib/favorites.js:172`) already sorts by time and already breaks a tie with
`isProgram`. **It needs one more term after that: a favourite outranks a non-favourite.**

Final order within a band: **time → studio show → favourite → everything else.**

**It does not currently know what a favourite is** — it takes `rows` and nothing else. Both call
sites (`page.js:325` and `:524`) already have `favIds` in hand. Decide deliberately how the
comparator learns it and say why: an argument, or a rank function supplied by the caller. **Do not
restate `isProgram` or the favourite test inside the comparator** — `chronological()`'s own comment
says why (`programs.js:250` is one line, and one line is exactly what gets copied and then drifts).

**Both call sites, and rule 32 applies again.** Prompt 71's brief named day mode only and week mode
had the identical defect. `chronological()` is shared by MY TEAMS and ALL GAMES; in MY TEAMS every row
is a favourite, so the new term is inert there — **confirm that by measurement rather than by
reasoning, because "inert" is the assumption most likely to be wrong.**

Pin Joe's example as a test: six rows, two favourites, three studio shows, two pairs tying at 12:00,
asserted in his stated order.

---

## STAGE 2 — the favourites float comes out

**This reverses a settled decision and must be recorded as a reversal, not slipped in (rule 10).**
D6 ruled it at prompt 20; prompt 59 reworked it into the gold bracket after Joe said the old
treatment read *"like an afterthought"*; prompt 53 stage 6 gave MY TEAMS the switch to turn it off.
It is being removed because Joe's new ordering makes position meaningful, and a group that floats to
the top of the band contradicts a list sorted by clock.

`floatFavorites` threads from `page.js:415` and `:661` (`!P.isMine`) through `Listing.js:49`, `:204`
and `:235` into `SportBand`. **With the float gone, nothing passes `true` any more** — so the prop
and the `.favgroup` rule (`globals.css:2091`) are dead, and dead code goes with the feature.
Prompt 67 set that precedent when it deleted `FirstBand` and `bandstate.js` together, and named what
it kept and why.

**Enumerate before deleting.** `git grep` `floatFavorites`, `favgroup`, and whatever `SportBand` calls
the group internally, and report every hit with file and line. **Anything that survives — a qa probe,
a test, a contract line — gets named along with why it stays.** Tests that pinned the float's render
are inverted rather than deleted, so a float coming back fails a gate.

`docs/enhancement-register.md` and `docs/handoff-status.md` both carry D6's reasoning. **Correct them
in the same commit** — a register that still describes the float as live is the "note recording an
absence" failure in reverse.

---

## STAGE 3 — the gold outline, and it must not be a border

Joe: *"make the gold line a gold OUTLINE of the card."*

### Use CSS `outline`, not `border`, and the reason is measured

`.mcard` is `grid-template-columns: 78px minmax(0, 1fr) 92px 100px` (`globals.css:456`). The body
track is `minmax(0, 1fr)`, so **anything that takes horizontal space comes out of the room
`fitNameAndRecord` has for a team name and a record.** Prompt 59 measured exactly this when it sized
the bracket, across 26 favourite cards over seven days:

| inset | body track | name tiers dropped |
|---|---|---|
| 2 + 9 = 11px | 103px | **10 of 26** |
| 2 + 4 = 6px | 108px | 0 of 26 |

A 2px border on all four sides costs 4px horizontally and would eat into that budget on every
favourite card. **`outline` is drawn outside the border box and takes no layout space at all**, so
the cost is zero and prompt 59's finding is preserved rather than re-litigated. **Verify that claim
in the browser — measure the body track on a favourite card before and after and show it unchanged**
rather than trusting this brief (rule 34: a platform behaviour recalled from outside the code is not
evidence, and this session has four instances of me getting exactly this class wrong).

### THE COLLISION YOU MUST RESOLVE — gold outline already means focus

`globals.css:1015` is `outline: 2px solid var(--gold)` as a **`:focus-visible` indicator**, and
`.bn-tvtap:focus-visible` (`:1948`) is the same. `.mcard` is a `button` (`globals.css:835`), so it
takes that focus ring itself. **A gold outline marking ownership would be indistinguishable from the
focus ring, and a keyboard or switch user would lose the ability to see where they are.**

Make the two unmistakably different and **say how you did it and what you measured** — a different
width, an `outline-offset`, a different token, or a change to the focus ring itself. If nothing reads
clearly at 390px, **stop and report rather than shipping two golds that mean different things.**

### The other checks

- **Clipping and collision.** An outline paints outside the box, so an `overflow: hidden` ancestor
  will crop it and a tight row gap will let it touch the neighbouring card. Check both, and set
  `outline-offset` deliberately rather than by default.
- **`border-radius`.** The outline should follow the card's corners, not box it.
- **Charcoal.** Measure the gold's contrast against the card ground, as this repo does for every
  other mark.
- **MY TEAMS view.** Every card is a favourite there, so every card would be outlined — which is
  noise, not signal. **Report what it looks like and recommend**; do not decide silently.

Screenshots at 390×844 into `assets/`: Joe's Sunday NFL example in ALL GAMES day/list; a mixed band
with favourites scattered through it; a focused card beside an unfocused favourite; and MY TEAMS.

---

## GATES AND COMMITTING

Five gates, each its own command, all reported, before any commit (rule 26). Both spacing probes in
`web/scripts/probes/` too — a probe that throws is the bug surfacing, not a guard to soften.

The tripwire must not move — this run changes list ordering and card decoration, not block geometry:
CFB `2026-09-05` 64 / {240, 223, 205, 136} / 1273, MLB `2026-09-03` 3 / {228} / 567,
NFL 17 / {264, 98, 73} / 1044.

**Rule 23:** `docs/design/mobile_demo.html` implements card treatment and list order. Establish
whether it shows a favourites float or a bracket, and change it in the same commit if so — this is
the case rule 23 was written for, unlike the last three where it was scroll behaviour.

Three commits, staged by explicit path (rule 4, never `git add -A`; `assets/` stays untracked).
Secret-gate each on ADDED lines only, with `grep` (rule 3).

**Do not commit or push without Joe's explicit approval.** Report the gates, the enumeration from
stage 2, the body-track measurement and the focus-ring resolution from stage 3, and the screenshots.
