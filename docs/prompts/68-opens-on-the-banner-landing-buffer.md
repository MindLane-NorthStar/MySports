# Prompt 68 — the app opens on the banner again, and the landing gets a buffer

Two reports from Joe, 2026-09-08, both against `7f53ab7`:

> 1) Now when opening the app, the main banner doesn't appear — the app opens with the navbar.
> 2) Below the gold line that rests below the picker, the league logo is super tight to the gold
>    line. There's no buffer above the league logo and beneath the gold line.

**Both are prompt 67 stage 2.** `web/components/AutoScroll.js` runs `land()` on mount — so a cold
open collapses the header and scrolls the banner off — and it parks the target at
`stackBottom() + SCROLL_GAP` where `SCROLL_GAP = 8` (`AutoScroll.js:` the export near the top), which
is what puts the league logo 8px under the gold rule. In day mode the scroll target is `#all-today`
(`web/app/page.js:625`) and the first thing inside it is the band header row carrying `.band-mark`,
the league logo. That is report 2, exactly.

**Read `web/components/AutoScroll.js` in full before changing anything, and cite file and line for
what you find — do not work from this brief's description of it (rule 22).**

---

## STAGE 1 — the auto-scroll does not fire on arrival

**Joe's ruling, 2026-09-08:** *"Can we tune the auto-scroll to NOT work on first opening of the
app?"*

**This walks back part of prompt 67's trigger and that has to be said out loud in the commit
message.** Prompt 67 chose the most aggressive trigger knowingly — every entry to the view AND every
return from the background — and Joe chose it over the gentler recommendation. He is now narrowing
it. The narrowing is what he wants; the record should show it was a deliberate reversal, not drift.

### The rule

**The scroll never fires until the reader has navigated within the app at least once in this
document.** After that first navigation, both triggers behave exactly as they do today.

That is a stronger rule than "skip the first run", and the difference matters on the target device.
On an iOS home-screen PWA the document usually SURVIVES backgrounding, so "opening the app" is
normally a `visibilitychange`, not a fresh mount. Suppressing only the mount would leave Joe's
complaint intact for the most common way he opens it. Suppress both until a navigation has happened
and the complaint is closed in every case.

### What that means concretely

| what the reader does | scroll? |
|---|---|
| cold open (fresh document) | **no** — banner visible, header not collapsed |
| backgrounds and returns, having navigated nowhere | **no** — the view is left exactly as it was |
| changes day, week, sport, scope or view | yes, as today |
| backgrounds and returns after any navigation | yes, as today |
| pull-to-refresh / iOS evicts and reloads the PWA | **no** — it is a fresh document, so it is an arrival |

### Implementation notes, not instructions — you own the shape

Two module-scope flags are the natural carrier, because module scope survives every re-render and
every client-side route change **within one document** and resets when the document does, which is
precisely the definition of "a fresh open of the app". A `useRef` would reset on remount and a
`sessionStorage` key would survive a reload, and both are wrong for that reason.

The `visibilitychange` handler has to consult the same flag — that is the whole point of the rule and
it is the easy thing to miss.

**Make the decision testable.** Right now the trigger logic lives inside the effect where a test can
only reach it by reading the source, and two of the eleven tests in `web/test/autoscroll.test.mjs`
already do exactly that. Export a small pure predicate — something the effect and the visibility
handler both call — and pin the five rows of the table above against it. Keep the existing eleven
tests passing; the two that assert on source text will need their expectations updated rather than
deleted.

---

## STAGE 2 — the landing gap

`SCROLL_GAP = 8` is the entire buffer between the sticky stack's lower edge and whatever the scroll
lands on. 8px is the scale's "inside one group" step (prompt 56 §24d); what this is actually doing is
seating a new section under a rule, which is the 16px heading→content step at minimum.

**Set it to 16.** Then screenshot the landing at 390×844 in both day/list and week/list at 16 and at
24, put all four images in `assets/` (untracked, rule from `CLAUDE.md`), and report which you would
ship. Joe decides between 16 and 24 from the pictures; ship 16 unless he says otherwise.

The test at `web/test/autoscroll.test.mjs:116` — *"the offset clears BOTH sticky elements, not just
the bar"* — pins this arithmetic. Update it to the new constant rather than loosening it; the
invariant it protects is that the gap is added to `stackBottom()`, not what the gap is.

**AND THE LANDING FIGURE IS BASELINED IN PROSE, WHICH IS THE TRAP HERE.** Prompt 67 recorded a
92px sticky stack plus an 8px gap, so *"a correct landing is top = 100"*, and reported five landings
against it: 100, 101, 100, 100, and the week's list 762 / grid 604 both at 100. Raising the gap moves
every one of those to 108. **Find every place that number lives — the commit message is not one of
them, but `docs/handoff-status.md`, the Mobile Grid Addendum, any qa/tools probe and any test may
be — and re-baseline all of them in this commit.** A figure that survives the change it describes is
worse than no figure, and this repo has been bitten by exactly that twice (rule: a note recording an
absence is a timestamp, not a fact). Re-measure the five scenarios at 390×844 and record what they
actually are rather than adding 8 to what they were.

**Rule 23 check.** Establish whether `docs/design/mobile_demo.html` implements a landing gap under
the collapsed picker. If it does, it changes in the same commit. If it does not — because the
reference is static and has no scroll behaviour — **say so explicitly in the commit message**, so the
next reader knows the check was run and not skipped.

---

## STAGE 3 — the cache policy reaches the other four prefixes

Prompt 67 stage 4a added `--force` to `scripts/sync_assets.py` and ran it over `logos/`: 1,532
objects re-uploaded, `CacheControl` `None` → `public, max-age=300`, verified 25/25 on a random
sample. It recorded the rest as open:

> `network-logos/`, `fonts/`, `brand/` and `grids/` still carry none — same command, different
> prefix, recorded as open.

**Close it.** Those are the same defect that produced the incident this whole thread started from —
Joe's installed PWA serving stale art because nothing told the browser when to re-check. Network
logos and fonts are exactly as cacheable and exactly as likely to change.

Run the existing `--force` path over each of the four prefixes, one at a time, and report for each:
the object count re-uploaded, and a spot check of one object's `CacheControl` before and after. **No
code change should be needed** — if one is, stop and say why before writing it.

## STAGE 4 — the 76ers row

Prompt 67 stage 4b measured the 16 caps whose `art: 'dark'` was chosen against the tint that prompt
66 removed, and found one that is now wrong:

> **Philadelphia 76ers:** raw 0.599, dark 0.005 on `#e01234`. Its dark lockup all but vanishes.

**Flip it to `raw` in `data/cap-table.json`.** Cowork's call, and Joe can reverse it with one row.
The reasoning: an `edge_crisp` of 0.005 is not a close judgement about which lockup reads better, it
is a lockup that has stopped rendering as a shape at all — and the choice was made against a tint
that no longer exists, so it is a stale input rather than a preference Joe would defend.

Twelve of the sixteen cannot be wrong either way — their `_dark.png` is a byte copy of the raw file
because prompts 64 and 66 put them in `skip_derive`, so the two settings select the same pixels. Two
tie. Only the Rangers (+0.166) and Raptors (+0.308) still earn `dark`. **Change nothing but the
76ers row** — edit it through a parser, never line-based, and assert that nothing but that one key
moved (rule 17).

## GATES — all four, each as its own command, before any commit

Floors from `docs/handoff-status.md` (the only place they are recorded — rule 10, and do not write a
second copy anywhere):

```
pytest                       # repo root — 511 passed + 1 skipped
npm run test:unit            # web/ — 470
npm run smoke                # web/ — 33/33
node scripts/qa-shots.mjs    # web/ — 91/91
npm run geometry             # web/ — all hard stops
```

Report all five. **Never read a gate's result from the exit code of a chained command (rule 26).**

**Kill stray dev servers and chromium processes BEFORE the first gate run, not after a failure.**
Prompt 67 got 91/91 green on the first try on every run and said why: the machine was clean. Prompt
66 ran `qa-shots` nine times on a dirty machine and got 91/91 once. Starting clean is the difference
between one run and nine, so do it up front and report the process counts you started from.

**The phone-grid geometry tripwire must not move.** This is a scroll feature; it has no business
touching block counts, block widths or scrollWidth. If any of them moves, stop and report rather than
re-baselining.

- CFB `2026-09-05` — 64 blocks / {240, 223, 205, 136} / scrollWidth 1273
- MLB `2026-09-03` — 3 blocks / {228} / scrollWidth 568

---

## COMMITTING

One commit per stage — four — staged by explicit path (rule 4 — never `git add -A`; `assets/` stays
untracked and is not drift). Secret-gate each one on **ADDED lines only**, with `grep`, never
`findstr` (rule 3). The gate and the commit are separate commands (rule 26).

**Do not commit or push without Joe's explicit approval.** Report the gates and the four screenshots
and wait.

Update the gate floors in `docs/handoff-status.md` **after the last gate run**, not during it — that
is the mistake prompt 66 made and prompt 67 recorded.
