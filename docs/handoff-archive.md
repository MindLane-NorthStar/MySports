# MySports — Handoff Archive

**What this is.** The closed prompt histories, superseded sections and detailed run narratives that used
to make `docs/handoff-status.md` a 155KB read at the start of every session. Prompt 87 moved them here
on 2026-09-10 **verbatim — nothing was deleted and nothing was rewritten**; each block below carries a
comment naming the lines it came from, so it can be traced to the pre-split file in git. Much of it is
superseded by design: it is the record of why decisions were made, not a description of the app today.
**`docs/handoff-status.md` remains the authority for anything current** — gate floors, open items, the
working rules — and where the two disagree, that file wins.

<!-- moved verbatim from docs/handoff-status.md lines 210-246 (pre-split numbering, parent of the prompt 87 commit) -->
### MLB LIVE SCORES HAD NEVER WORKED, AND THE ID SCHEME WAS NOT WHY (prompt 78 block B)

`/api/live` reported `mlb: { returned: 15, joined: 0 }` — the fetch succeeded, the parse succeeded,
`stats` was populated, nothing warned, and every card silently kept the database's score. It had been
in that state since live scores shipped. **What surfaced it was Joe asking why a score had not
moved**, which is not a control; `scripts/probes/live-join.mjs` is now the control.

**COWORK'S PROMPT-76 INFERENCE WAS RIGHT ABOUT THE PREMISE AND WRONG ABOUT THE CONCLUSION**, and the
record should say which. Both sides really do build `mlb-<gamePk>` — `adapters/mlb.py:350` emits
`f"mlb-{pk}"` and `readMlbSchedule` builds the same. Printed side by side on 2026-09-09:

```
returned  mlb-824792  mlb-824228  mlb-823414     <- MLB's answer
ours      mlb-824226  mlb-823172  mlb-823818     <- the 2026-09-09 slate
```

**Same shape, different GAMES.** `?sportId=1` with no date answers for MLB's own idea of today, which
was **2026-09-08** — that endpoint holds the previous date well past midnight ET, which is sensible
for a league whose west-coast games finish after it. Adding `&date=` returned ids matching ours
exactly. **Join 0/15 → 15/15.**

**IT WAS THE SAME BUG IN ALL FIVE SOURCES, invisible in four because nothing joined anyway** (rule
32). Undated → dated for 2026-09-09: NFL **16 → 1** (our one game, still joined), CFB 24 → 0, NBA
1 → 0, NHL a gameWeek starting **2026-09-29** → the week containing the day asked for. Every
`returned` is now a game that could actually join, so `stats.unjoined` means what it says.

**FIXED IN THE MATCHER, NOT THE DATA** (rule 6). `games.id` is a primary key that other tables and
the app's own overlay key point at; nothing stored was touched and no DML was run. CFB ids are bare
numbers (`401858202`) and `espnGameId('cfb', …)` returns bare — checked, not drift.

**THE GUARD IS `joinFailures(stats)`** — `returned > 0 && joined === 0`, the shape that hid for the
life of the feature. Zero returned is not a fault (no games, or an outage `fetchSport` already logs)
and a partial join is not either. **One rule, two callers** (rule 32): the unit tests pin it against
fixtures, and `scripts/probes/live-join.mjs` runs it against the live providers. **The live half is a
PROBE and not a gate deliberately** — it depends on five external hosts, and a gate that goes red for
someone else's outage is one that gets ignored, which is exactly how this survived.


<!-- moved verbatim from docs/handoff-status.md lines 320-766 (pre-split numbering, parent of the prompt 87 commit) -->
### WHERE THE AUTO-SCROLL LANDS — measured, because the figures were living in a commit message

`components/AutoScroll.js` lands the reader on what is on now; `lib/autoscroll.js` holds its pure
half. Prompt 67 recorded its landing positions in a commit message and nowhere else, which is how a
figure survives the change that invalidates it. **Re-measured 2026-09-08 at 390×844 after prompt 68
raised the gap from 8px to 16px**, sticky stack 92px, so a correct landing is `92 + 16 = 108`:

| scenario | scrollY | target top |
|---|---|---|
| 70-card day, the 30th card live | 4108 | 109 |
| an earlier card also live (earliest wins) | 1583 | 108 |
| week containing today, list | 754 | 108 |
| week containing today, grid | 596 | 108 |

**THOSE FIGURES ARE PRE-PROMPT-71 AND THE OFFSET MOVED TWICE SINCE — WITH THE HEADER, AND THEN WITH
THE BANNER PIN.** Prompt 71 stage 2 stopped the landing collapsing the header — Joe: "once you change
to week view it closes the banner since the screen auto scrolls to the current day" — so at the
moment of landing there is no sticky stack to clear. `--stack-h` is written from `.chdr`, which is
0px tall while the header is expanded, so `stackBottom()` returned the picker's height alone and the
target landed ~47px down instead of 108. The arithmetic adapted itself; nothing was re-tuned.

**PROMPT 73 ADDED A THIRD TERM AND PROMPT 74 REMOVED A WRONG ONE.** The banner now pins to the top
of the viewport until the reader's own first scroll, and `stackBottom()` counts **only what is
actually stuck** — read from each candidate's computed `position`, never from `data-hdr` or
`data-pin`. It used to count `.pickrow` unconditionally; the picker only STICKS while the header is
COLLAPSED, and since prompt 71 every landing happens with the header EXPANDED, so 31.4px was being
reserved for an obstruction that was not there. Nothing was re-tuned in either change: the
arithmetic followed the layout both times.

**WHAT IS STUCK, MEASURED IN THE BROWSER at 390 in all four states** — this is the control that
proves the collapsed path is untouched:

| state | `.chdr` | `.pickrow` | `.banner` | `stackBottom()` | target lands at |
|---|---|---|---|---|---|
| expanded + pinned — **every landing since prompt 73** | sticky, `display:none`, 0 | static, 31.4 | sticky, 124 | **124** | **140** |
| collapsed | sticky, 44 | sticky, 48.4 | none, 0 | **92.4** | **108.4** |
| collapsed, league row open | sticky, **127** | sticky, 48.4 | none, 0 | **175.4** | 191.4 |
| expanded + pin released | sticky, 0 | static, 31.4 | relative, 0 | **0** | 16 |

The collapsed row is the 92px stack this file has recorded since prompt 60 and the 108px landing
from before prompt 71 — unchanged, arrived at from a different direction. With the league row open
the bar measures 127 and the sum follows it with no arithmetic anywhere.

**140 = 124 + 16, AND THE 16 IS JOE'S OWN BUFFER** — prompt 69's ruling after he reported the league
logo *"super tight to the gold line"*, the same 16px `html[data-hdr='collapsed'] .pickrow` carries as
`margin-block`. The 31.4 that prompt 73 reported and left was not a decision anybody made; it was a
term that outlived the collapse that used to justify it.

**Re-measured 2026-09-09 at 390×844, prompt 74. Each row is reached by an IN-APP navigation**, which
is what the arrival rule (prompt 68) requires — a `page.goto` is a fresh document and deliberately
does not scroll, so a harness that navigates with `goto` measures nothing:

| view | scrollY before p73 | after p74 | target top before p73 | after p74 |
|---|---|---|---|---|
| week / ALL GAMES / LIST | 1050 | **957** | 47.3 | **140.3** |
| week / MY TEAMS / LIST | 603 | **510** | 47.1 | **140.1** |
| week / ALL GAMES / GRID | 892 | **799** | 47.3 | **140.3** |
| week / MY TEAMS / GRID | 728 | **635** | 47.2 | **140.2** |
| week / ALL GAMES / LIST / a league tile | 0 | 0 | — | no today in that week, no scroll |
| day / ALL GAMES / LIST | 144 | 144 | 191.4 | 191.4 |
| day / ALL GAMES / GRID | 75 | 75 | 260.4 | 260.4 |
| day / MY TEAMS, either view | 0 | 0 | 367.3 | 367.3 |
| day / ALL GAMES / LIST / a league tile | 0 | 0 | 443.1 | 443.1 |
| a week or day without today | 0 | 0 | — | no scroll |

Every week landing moved by **+93 scrollY and +93 target top** against pre-prompt-73: +124 for the
banner the reader now keeps, −31.4 for the picker that was never in the way.

**THE DAY ROWS DID NOT MOVE, AND THE REASON IS NOT THAT THE PIN MISSED THEM.** A day page is short —
2026-09-08 is ~988px — so the landing SATURATES against the bottom of the document at scrollY 144
both before and after. The clearance changed; there was nowhere left to spend it. On a long day it
moves like the week rows.

**THE BUDGET at 390×844:** pinned banner **124px**; control stack (`.hubctl`, expanded) **203.4px**
at top 132; first content on a cold open **335.4px** down, leaving 508.6px; room below the pinned
banner after a landing **720px**. Cards visible there, week / all games / list: **3 whole, 4
touching**; week / my teams / list **4 whole, 6 touching** — that second one gained a partial card
from prompt 74's 31px, and the ALL GAMES row did not because an MLB card is ~190px tall. What the
31px bought in both is the picture: today's heading now sits 16px under the banner's gold rule
instead of 47px, and the tail of the PREVIOUS day's card no longer letterboxes between them.

**PROMPT 67's TABLE ABOVE IS KEPT AS HISTORY, NOT AS CURRENT.** Its every scrollY had moved by
exactly −8 from prompt 67's own figures, which was prompt 68's gap increase and nothing else; two
prompts have moved them since. **AT THE TOP OF THE PAGE THE GAP CANNOT APPLY** — day mode's target
sits ~100px down with the page already at 0, so there is nowhere to scroll up to.

### THE SCORE UPDATES WITHOUT RE-RENDERING THE PAGE (prompt 77 stage 1, Joe 2026-09-09)

**`router.refresh()` IS RETIRED.** `Listing` re-rendered the WHOLE page on the server every
`REFRESH_SECONDS` to update three fields; it now fetches `GET /api/live?day=…` and patches the cards
already on screen. **60 seconds, because that IS `REVALIDATE_SECONDS`** in `lib/livescores.js` — the
staleness was entirely the client's, since the server's answer was never more than a minute old while
the phone waited fifteen. `livepoll.test.mjs` asserts the two numbers are EQUAL rather than asserting
each is 60, so they cannot drift apart with both tests passing. `REFRESH_SECONDS` is deleted, not
left exported with no reader.

**THE HAZARD, MEASURED (rule 34) — `scripts/probes/live-poll.mjs`, tracked.** A poll that remounted
`Listing` would re-arm prompt 73's banner pin and re-fire prompt 71's landing every sixty seconds.
Measured over a full cycle at 390×844 with a fake clock and a stubbed live score:

| | |
|---|---|
| cards that went live | **0 → 3** — the patch landed, which is what makes the rest mean anything |
| scrollY | **201 → 201**, and **one distinct value across 243 sampled frames** |
| `data-pin` | unchanged, one distinct value across the same frames |
| `data-hdr`, URL, card count | all unchanged — no navigation, no churn |

**THE FIRST TWO RUNS OF THAT PROBE PASSED EVERY "DID NOT MOVE" CHECK AND PROVED NOTHING**, because
the fake clock sat outside every visible game's window and the poll never armed. Its own
*"the patch LANDED"* assertion is what caught it, which is why that assertion is first and why the
probe now SEARCHES the day's kickoffs for a time that arms the poll rather than computing one — the
visible slate is decided by the off-service filter in the app and cannot be known from the database.

**Also new:** the poll stops while the app is backgrounded, and returns fetch once on becoming
visible rather than waiting out the interval.

### THE WEEK CHECKS LIVE SCORES AGAIN — prompt 53 stage 4b REVERSED (prompt 77, Joe 2026-09-09)

Its recorded reason — *"up to ten live calls on one render"* — described an implementation nobody had
to write: only today's games can be live, so a week needs exactly ONE overlay. **Confirmed by reading
before it was relied on**, and the reading changed one detail: `sportsWorthFetching` already returns
`[]` for any day that is not today, so a week was never going to cost ten calls — but it collects
every sport with a NON-FINAL row and does **not** skip `scheduled`, so handing it the whole week would
fetch NHL for a scheduled Friday game with no NHL on today. It is handed `grouped[today]`, which makes
the call byte-for-byte day mode's.

**The footnote changed in the same commit**, because a page that says it is not checking while it is
checking is worse than one that never checked. Measured on the dev server: a week containing today
prints *"live scores checked 8:43 AM, 1 game updated"*, identical to day mode; a week without today
prints *"no live check — this week does not contain today"*.

**Register §31.** The grid is out of scope and stays so.

### THE LIVE OVERLAY JOINS 1 OF 16 TODAY, AND THAT IS NOT PROMPT 77'S DOING

Worth a look by somebody. `/api/live?day=2026-09-09` returns `mlb: {returned: 15, joined: 0}` — the
MLB source hands back fifteen rows and none of their ids match ours — while NFL joins 1 of 16. **Day
mode reports exactly the same figure**, so this predates the poll and is not a regression from it;
`overlay.stats` exists precisely so a drifting id scheme shows up as a number rather than as cards
that quietly never go live, and it is showing one now.

### THE BANNER PINS UNTIL THE READER SCROLLS (prompts 73 and 74, Joe's ruling 2026-09-09)

> "I think the answer to all of this is to make banner STICKY until the user scrolls, regardless of
> day/week, All Games/MyTeams, List/Grid, All Sports or League tile."

**PROMPT 71 WAS NOT A REGRESSION AND IS NOT REOPENED.** Measured before this change: week / all games
/ list lands at scrollY 1050 with `data-hdr` null and the banner still in the document — the collapse
suppression holds exactly as prompt 71 left it. What defeated it is the landing. `.banner` was
`position: relative` and first in flow, so at scrollY 1050 its top sat at −1050. Joe: "the banner
doesn't go anywhere but it's lost atop the screen because the scroll scrolls past the banner in
total."

**TWO EVENTS AT TWO MOMENTS, and conflating them is the hazard.** RELEASE is the reader's own first
scroll; COLLAPSE is the sentinel crossing, unchanged. Between them is a stretch with no navbar,
which is prompt 71's behaviour and which Joe chose over an immediate swap in place having been shown
both — *"lets try 1."* **REJECTED and recorded: a permanently pinned banner swapped for the navbar in
place.** It reads better and it is a larger change, because a banner that never travels breaks the
sentinel, the height arithmetic and the route back to the expanded banner.

**`position: sticky`, NEVER `fixed`, and that is load-bearing.** A sticky element keeps its box in
the flow, so arming and releasing the pin move nothing: measured at the week landing, releasing the
pin left today's block at 171.3 and scrollY at 926, both unchanged. A fixed banner would leave 124px
of empty ground behind it and would break the sentinel, the compensation and the re-expand.

**WHAT THE RELEASE IS KEYED ON.** The document's own `scroll` event — not `wheel`/`touchmove`, and
not a flag. Two reasons, and the second decided it: a scroll event covers every way a page moves,
and a horizontal PAN inside `.mgrid-scroll` is a touchmove and is *not* the reader scrolling the
page. **The auto-scroll cannot trip it because the listener does not EXIST while a landing is in
flight** — `land()` takes a `done` callback and installs it one animation frame after its last
correction. A flag could not close that hole: `scrollBy` moves the offset synchronously and delivers
its `scroll` event a frame later, after `releaseScrollCollapse()` on the next line has already run.
**A programmatic `window.scrollTo` from a script DOES release it**, which is right — in the app the
only programmatic scrolls are the landing (guarded) and `expandHeader()`'s trip to the top (where a
released pin is invisible).

**IT DOES NOT FEED `--stack-h`, HAS NO CUSTOM PROPERTY OF ITS OWN, AND SINCE PROMPT 74 PUBLISHES NO
HEIGHT EITHER.** `--stack-h` is the offset `.pickrow` sticks at, and the picker only sticks while the
header is COLLAPSED — where the banner is `display: none`. Folding the banner in would push the
picker down by a banner nobody can see, and that state is reachable (tap the television before
scrolling). A companion property no stylesheet reads would be a second copy of a height that can go
stale. Prompt 73 answered that with a `pinnedBannerHeight()` export; prompt 74 deleted it, because
`stackBottom()` now asks each of the three candidate boxes what its `position` RESOLVED to and
measures the ones that are held. One predicate covers `.chdr`, `.pickrow` and `.banner` — which is
what fixed the picker term, and no single attribute could have: `.chdr` and `.pickrow` are switched
by `data-hdr` and `.banner` by `data-pin`. A hidden box answers itself (a `display: none` element
measures 0), and the desktop banner's 229px is carried with no breakpoint written down.

**`--stack-h` IS NO LONGER READ BY THE LANDING AT ALL, and losing it is a gain.** It is written from
`.chdr`'s box by a ResizeObserver, so reading it gave exactly what measuring `.chdr` gives — while
its `BAR_FALLBACK` could have contributed a whole 44px bar in a state where the bar is not on the
screen, and reading it made the landing depend on an observer having run. The property is untouched
and still does its one job.

**THE MATRIX, all ten combinations at 390×844, each reached by an in-app navigation.** Every one
landed with the banner pinned at top 0 and `data-hdr` null. The four week landings moved by exactly
−124 scrollY; the day landings saturate against a short document (see the landing table above).

**THE BUDGET Joe asked for, at 390×844:**

| | |
|---|---|
| pinned banner | **124px** |
| control stack (`.hubctl`, expanded) | **203.4px**, top at 132 |
| first content on a cold open | **335.4px** down — 508.6px left for content |
| room below the pinned banner after a landing | **720px** |
| cards visible there, week / all games / list | **3 whole, 4 touching** (was 3 whole / 5 touching in 844px) |

So the pin costs about one partial card, not the feature. The auto-scroll and the banner are not
fighting.

**HAZARD CHECKS, measured rather than reasoned:**

* **No letterbox.** 247 scroll positions across four views — day/list 59 over 9,631px, day/grid 19
  over 3,673px, week/list 117 over 18,314px, week/grid 52 over 8,586px. At every one the banner held
  top 0, `elementFromPoint` at its top, middle and foot all resolved inside it, and **its own pixels
  were byte-identical to the first position** — nothing behind it shows through. There is structurally
  no gap to open: while pinned and expanded the banner is the ONLY stuck element, and `.pickrow` only
  sticks in the collapsed state where the banner is hidden.
* **The grid is untouched.** `npm run geometry` all hard stops, CFB 2026-09-05 64 / {240, 223, 205,
  136} / 1273 and MLB 2026-09-03 3 / {228} / 567 — the tripwire figures unmoved. `.banner` is a
  sibling of `.shell` and never an ancestor of `<main>`, and `position: sticky` establishes no
  containing block for descendants, so it cannot reach `.mrail-cell`'s chain.
* **A horizontal pan inside the grid does not release the pin** (scrollLeft 0 → 200, pin still armed).

**RULE 23: `docs/design/mobile_demo.html` NEEDS NO CHANGE, and it says so itself** — "This page
models no scroll behaviour at all - each phone frame is a fixed-height mock." A pin that exists only
between a landing and the next gesture is a behaviour over time, which is precisely what that
declaration excludes; and the file's own scope is the card, the chip row and the grid's construction,
none of which moved. The note recording that was extended in the same commit rather than left to be
re-derived.

### TESTS THAT PASS ON −1 — THE SWEEP (prompt 74)

**ONE TEST WAS PASSING VACUOUSLY, PROMPT 73 FOUND IT BY READING THE FILE, AND READING IS NOT A
CONTROL.** `autoscroll.test.mjs`'s "the header is collapsed BEFORE anything is measured" asserted
`c.indexOf('collapseHeader();') < c.indexOf(...)`. Prompt 71 deleted that call, so `indexOf` returned
−1, and −1 is less than any index — the assertion held for the one reason it existed to rule out. Its
guard was worse: `c.indexOf('collapseHeader()')` matched the string inside the COMMENT explaining the
deletion. **Prompt 71's green gate was partly hollow and nothing could have said so.**

**`web/scripts/probes/test-mutation.mjs` IS THE CONTROL, and it is tracked** — the same ruling as
prompt 70's promotion of the two spacing probes, and the same ruling as `landmark.mjs` beside it: a
tool that answers after its landmark disappears is worse than one that stops. It asks two questions:

* **is the anchor currently absent, or present only inside a comment?** A text scan. **0 of 39.**
* **would the assertion still PASS if the anchor went absent?** It copies `lib`, `app`, `components`,
  `scripts` and `test` to a scratch directory, deletes the anchor from the copy, and runs the test.
  **41 anchors swept, SIX survived** — two in `collapsedheader.test.mjs`, two in `emptyday.test.mjs`,
  two in `programpanel.test.mjs`. All six were the REGION shape rather than prompt 71's ordering
  shape: a slice whose START anchor vanishes becomes one character and every `doesNotMatch` over it
  passes; one whose END anchor vanishes becomes the rest of the file, so "inside the panel head"
  silently becomes "somewhere in this component". Neither fails. Both stop being the test that was
  written.

**`--selfcheck` RECONSTRUCTS PROMPT 71'S DEFECT AND REQUIRES THE TOOL TO FIND BOTH HALVES**, because
a clean result from a query nobody can see is not evidence (rule 31). It also requires the tool to
ignore a human label passed to a helper and to ignore the LOCAL `at()` fixture builder that
`myteamsonce.test.mjs` and `primewindow.test.mjs` each define — seven fixture timestamps were reported
as source anchors before that was fixed, which is why the shared helper is named `anchorAt`.

**THE BARE `indexOf` USES THAT REMAIN ARE SOUND, and each was checked rather than converted for
tidiness.** Every one carries an explicit guard — `assert.ok(i > 0, ...)`, `i > -1`, `i !== -1` in a
loop condition — or is an ordering CHAIN in which −1 always lands on the left of the comparison and
therefore loses it (`pagehead.test.mjs`'s four-way stack order is the example, and it now carries a
comment saying why, because reversing any one of those comparisons would turn it into the defect).
The mutation sweep is what says so: deleting each of those anchors fails its file.

**THE FIX IS `web/test/region.mjs`, AND ALL SEVENTEEN SLICE SITES USE IT.** `region()`, `after()`,
`before()` and `anchorAt()` THROW when an anchor is missing, with `landmark.mjs`'s own wording. Six
were unsound and eleven more were sound only by luck of what the following assertion happened to
match; converting all seventeen removes the shape rather than the instances, and
`region.test.mjs`'s last test fails on any new bare anchored slice anywhere in the suite (rule 32 —
enumerate the renderers, do not sample one).

**THE SEARCHES RUN, named because a clean result from a query nobody can see is not evidence
(rule 31):**

| search | scope | result |
|---|---|---|
| `indexOf` / `lastIndexOf` | `web/test/` | 41 anchors — the sweep above |
| `.search(` | `web/test/` | **none** |
| `.match(` used as a value | `web/test/` | 20 sites, **all sound** — either `x.match(...)[0]`, which throws a TypeError on `null` when the pattern misses, or `(x.match(...) \|\| []).length` compared to a count, which goes to 0 and fails |
| `.find(` | `tests/*.py` | **none** — this is the −1 returner and Python does not use it here |
| `.index(` | `tests/*.py` | 3 sites in `test_program_card_svg.py`, **sound by language**: `str.index` raises `ValueError` rather than returning −1, so the ordering assertions on lines 123–124 cannot hold on absence |

**The Python side cannot have this defect at all**, and that is a property of the language rather
than of the tests: the only position-returning search in `tests/` throws.

**AND ONE MORE OF PROMPT 71'S OWN SHAPE was found in the sweep and hardened**:
`collapsedheader.test.mjs`'s compensation-ordering test read
`before < paint && paint < after` with `before = body.indexOf('const before')`. Renaming `const
before` would have made it −1 and the assertion would have held. It was saved only by a neighbouring
`assert.match` happening to require the same string — a neighbour, not a guard. It now uses
`anchorAt`, which throws before the comparison can happen.

**A NAME COLLISION CAME OUT OF IT.** The helper was `at()` for one iteration; two test files already
define a local `at(sport, time)` fixture builder, and `test/collapsedheader.test.mjs` had a local
`const after` that shadowed the imported `after` for its whole block — a `ReferenceError`, which is
how it was caught. The locals there are `iBefore`/`iAfter` now and the helper is `anchorAt`.

**`qa-shots` GOES FLAKY WHEN THE MACHINE IS DIRTY, and it is the gate rather than the app.** Prompt 66
ran it nine times while stray processes were alive and got 91/91 once, the other eight returning one
to three failures and never the same set. After killing them it returned **91/91 three times in a
row.** Every one of them was in the header-interaction
cluster — `tapping GRID in the navbar keeps the collapse`, `and GRID -> LIST works from the same
control`, `picking ALL SPORTS in the row puts the WORDS back`, `360: every toggle is 44px` — and each
failed on a URL that had not changed yet inside a fixed `page.waitForTimeout(300…900)`. Nothing was
wrong with the header; the wait was shorter than a `next dev` client navigation under load. **Before
debugging the app, kill every stray `next dev` and every stray chromium** — prompt 66 found FIVE dev
servers sharing one `.next` and 25 orphaned chromium processes. **The real fix, not yet done: wait on
the condition (`page.waitForURL`, `expect.poll`) instead of on a duration.**

**PROMPTS 73 AND 74 MEASURED IT PROPERLY, WITH MATCHED SAMPLES, AND THE ANSWER IS THAT THE BANNER
PIN DOES NOT TOUCH IT.** This mattered more than a flake usually would: the pin RE-ARMS ON EVERY
NAVIGATION, and one of prompt 73's two failures printed `?day=2026-09-05` — a URL that had not
changed — which is a navigation-timing symptom and therefore a plausible mechanism rather than an
established one.

Prompt 73 ran nine on its own tree and four on the pre-change tree, and 7/9 against 4/4 is not a
difference that can be called at those counts. Prompt 74 ran the pre-change tree to the SAME COUNT,
on the same clean machine, one series after the other with nothing else using the browser:

| tree | runs | 91/91 | 90/91 |
|---|---|---|---|
| **finished (prompts 73 + 74)** | 9 | **8** | 1 — *and GRID -> LIST works from the same control* |
| **pre-change (`ccaa9a8`)** | 9 | **8** | 1 — *tapping GRID in the navbar keeps the collapse* |

**Identical, and the pre-change failure printed `?day=2026-09-05` too** — the same assertion cluster,
the same "the URL had not changed yet" symptom, on a tree with no pin in it at all. That is the
control the mechanism needed, and it clears the pin.

**The owed fix is still owed**, and it is the same one it has been since prompt 66: wait on the
condition (`page.waitForURL`, `expect.poll`), not on a fixed duration. Until then a single 90/91 in
that cluster is the gate, not the app — but re-run it before believing that, because *"it is the
known flake"* is exactly the sentence that hides a real one.

### THE SPLIT SHIPPED (prompt 62) — the picker joins the bar

`.chdr` is **sticky in flow**, not fixed. Collapsed, `.hubctl` becomes `display: contents` and its
four non-picker children `display: none`, so `.pickrow` becomes a direct child of `<main>` and
sticks under the bar at `var(--stack-h)` — a ResizeObserver on `.chdr`, so the offset carries the
44px row, the safe-area inset and the league row without arithmetic. **The picker is not moved and
its data is not threaded**: it still renders from `Controls` in `app/page.js`, server-side.

Measured, day and week: closed, bar 45 / picker top 45, flush. Row open, bar 127 / picker top 127 —
**the bar grew 82px and the picker moved 82px.** That is the split.

**THE 160ms SLIDE-IN IS GONE** and could not be kept — the two states differ by `display`, which has
no intermediate frame. Nothing replaced it.

### THE DEAD BAND OVER THE GRID IS NOW 92px, MEASURED

Prompt 60 measured **45px against the 44px navbar**. The stack is 44 + 48.39 = **92.39px**, and a
touch landing on it targets the stack rather than `.mgrid-scroll`. Re-measured 2026-09-08 with real
CDP touch input, 390, grid view:

| where | dead band | visible grid | share |
|---|---|---|---|
| day / grid, most positions | 92px | 844 | **10.9%** |
| day / grid, near the foot | 92px | 542 | **17%** |
| week / grid, a day fully in view | 92px | 715 | **0%** — the stack is not over it |
| week / grid, partly scrolled | 92px | 370 | **25%** |
| week / grid, worst position | 92px | 171 | **54%** |

**It roughly doubled**, and at the worst week-mode position it is now more than half the visible
grid. A pinch inside the band does not reach the grid; the same pinch 60px lower works normally.
**With the league row open it is 100% of that worst position** — transient, and the reader opened it.

**This is reported, not fixed.** `MobileGrid`'s touch handling is untouched and the document-level
pinch rebind stays shelved — the named fix if the band is ever wanted back is to bind the pinch at
the document level and gate it on the gesture's midpoint being over a `.mgrid-scroll`. **This is the
first thing to look at on the phone**, because 54% is a number a browser can measure and only a
thumb can judge.

> ### DEVICE-CONFIRMED THROUGH PROMPT 57. FOUR THINGS ARE WAITING ON THE PHONE.
>
> Joe checked prompts 52–57 on 2026-09-07, including prompt 52's four veto calls as **accepted**.
> Since then four surfaces have shipped that only a device can judge, in the order they should be
> looked at:
>
> 1. **The navbar and the one-way collapse** (§28a–c) — scroll down and watch the banner go; scroll
>    back to the top and check that it STAYS gone; tap the television to collapse it deliberately;
>    tap MYSPORTS TV to bring it back. Then judge the quiet gold ring around the TV, which is the
>    one thing in this run chosen without a measurement to settle it.
> 1a. **The navbar OVER THE GRID** (§28h) — switch to GRID while collapsed and try to pinch and pan
>    the grid near the top edge. A browser says the top 45px is inert but harmless; a thumb is the
>    only thing that can say whether that is annoying.
> 2. **MY TEAMS** (§28d) — one chronological list, said once, no sport headings.
> 3. ~~**The favourites bracket** (§27a)~~ — **RETIRED at prompt 82, register §32.** The question
>    expired rather than being answered: there is no group to read as separate any more. What Joe
>    checks instead is the gold BORDER on a favourite card, and whether 1px is loud enough.
> 4. **The program panels** (§27b) — tap a NASCAR race, a UFC card and a studio show.
>
> **Prompt 58's collapsed bar is no longer on this list because prompt 60 replaced it.** Judge the
> navbar, not the bar.

**PROMPT 60 — THE NAVBAR JOE DESIGNED, AND MY TEAMS SAID ONCE.** Five commits, from `c59f1d5`:

| stage | commit | what shipped |
|---|---|---|
| 1 | `892b5f0` | the header collapses one way and expands only on request |
| 2 | `03f0ba1` | the collapsed toggles show both states |
| 3 | `bb2527b` | the live tile opens the league row |
| 4 | `9d7530f` | my teams is one chronological list |
| 5 | `17a13f5` | register §28, the prompt filed |
| 6 | *(this commit)* | the navbar renders in grid view too, and the hedge is measured |

**Read register §28.**

### THE HEADER IS A ONE-WAY MACHINE, AND THE ASYMMETRY IS THE DESIGN

Scroll only ever COLLAPSES. Expansion is a tap on the wordmark, and it is the only manual thing.
Prompt 58's `setCollapsed(!entry.isIntersecting)` was two-way, so the moment a tap could also set the
state two inputs would be writing one boolean — and a deliberate collapse would be undone by the next
scroll to the top. One direction each removes the conflict rather than managing it.

The state is a **module** (`lib/headerstate.js`) writing **one attribute on `<html>`**, because three
surfaces share the boolean and one of them is a server component that can hold no client state. The
sentinel moved out of `layout.js` into `Controls`, after `.hubctl` and outside it, and the collapse
compensates the scroll: **measured at 0.00px of movement** under the reader, sampled per frame.

The TV is a real `<button>` — 51.0 × 53.6 at 390 — drawn as an **overlay at the artwork's percentage
coordinates**, so `build_banner_mobile.py --check` still holds.

### THE LABELS ARE SHORT, ON MEASURED EVIDENCE

`LIST VIEW` / `GRID VIEW` needs 233.44px of run against 221.73px of room at 360 and 228.13px at
**390, Joe's own device**. It fits only at 375 and 430. `LIST` / `GRID` is 221.58px and fits
everywhere. Joe wanted the full words and said he would take the short ones on evidence; this is the
evidence.

**No third exception to the 44px rule.** The brief suspected one; the targets measure
44 / 58.13 / 44 / 63.45 at 360 with `min-width` applied. **§18b still holds exactly two.**

### MY TEAMS IS R4, FINALLY IMPLEMENTED IN THE RENDER LAYER

Not a new ruling — `page.js` has said "chronological across every sport" since prompt 51. Three
mechanisms broke it and **what Joe read as a sort fault was not one**: the first band is TONIGHT, so
it showed 8:00 PM RAW while the 1:35 PM Guardians game fell before the prime window and appeared only
below. Two correctly-ordered sections, stacked.

The third mechanism is real and was invisible: `allRows = [...games, ...programRows]` is a
concatenation of two separately-ordered reads, so R4's own comment was false. **ALL GAMES is
untouched and proven so** — eight views snapshotted before and after, byte-identical once the band's
clock is normalised.


<!-- moved verbatim from docs/handoff-status.md lines 774-793 (pre-split numbering, parent of the prompt 87 commit) -->
### CLOSED — MIGRATION 0017 IS APPLIED (2026-09-08)

Applied from **Cowork** at **01:34 UTC on 2026-09-08**, on Joe's explicit named approval, under the
rule 14 revised the day before. Measured either side:

| | |
|---|---|
| rows before / after | **595 → 516**, 79 deleted |
| `(game_id, provider)` pairs holding more than one row | **32 → 0** |
| constraints | **both** present — the new `game_odds_game_provider_key` on `(game_id, provider)`, and 0003's three-column one, kept deliberately |

**The 111 rows of those 32 pairs are archived**, each marked KEEP or DELETE, at
`docs/research/game-odds-surplus-2026-09-08.json` — six checksums verified against the live database
before the delete ran, and they recompute from the file. Rule 6 says close rather than delete;
`game_odds` has no `valid_to`, so the archive IS the closure.

**The loader followed separately in `f7fe047`** and had to: with the constraint in place its old
conflict target of `(game_id, provider, fetched_at)` matched nothing, and the next nightly run would
have raised a unique violation and taken `pipeline.load` down with it.


<!-- moved verbatim from docs/handoff-status.md lines 801-887 (pre-split numbering, parent of the prompt 87 commit) -->
### CLOSED — THE NAVBAR NOW RENDERS IN GRID VIEW (§28h)

The exclusion cost more than it bought: tapping GRID in the bar deleted the bar and returned ~340px
of header to the flow above the reader, every time. Measured before the lift — collapsed at scrollY
904, tapping GRID left scrollY 759 with the grid's top at −335.

**AND THE HEDGE IT WAS PROTECTING IS REAL, MEASURED RATHER THAN WAVED THROUGH.** The bar's **45px
sits over `.mgrid-scroll`**, which owns the pinch; a touch landing there targets the bar, which is a
sibling of `.shell` and not an ancestor of the scroller, so the scroller's listeners never see it. A
pinch with both fingers in that band does not zoom (scrollWidth 1273 → 1273); **nor does a pinch with
only ONE finger in it**, which is the natural gesture and worse than the hedge predicted. It is
**8.3–9.0% of the visible scroller in day mode and 26.4% in week mode** at the worst transient
position.

**Accepted, on two measured grounds:** the band is INERT — a drag starting on any of the five
controls activates nothing, because a drag cancels the click — and the same pinch 60px lower works
normally. Every one of those figures is in the qa-shots gate.

**The named fix if the band is ever wanted back:** bind the pinch at the DOCUMENT level and gate it
on whether the gesture's midpoint is over a `.mgrid-scroll`, rather than binding it to the scroller.
Out of scope here; it is a change to `MobileGrid`'s touch handling.

**This is the one thing on the phone list that a device can settle better than a browser can.**

Tree clean apart from always-untracked `assets/` (and `web/qa/` and `artifacts/`, both gitignored).
**PROMPT 59 — THE FAVOURITES BRACKET, THE PROGRAM PANEL, AND TWO HARVESTS.** Five commits, from
`c6a423b`:

| stage | commit | what shipped |
|---|---|---|
| 1 | *(none)* | confirmed prompt 58's deploy READY — Joe had already pushed it |
| 2 | `0f4ba2d` | a gold bracket where the favourites heading was |
| 3 | `f9950ba` | the panel knows a program from a matchup |
| 4 | `2a1e7cd` | what the game_odds surplus actually contains |
| 5 | `fa042c0` | harvest the apple-app-site-association files for every held service |
| 6 | *(this commit)* | register §27, the prompt filed |

**Read register §27.**

### SUPERSEDED — THE FLOAT IS GONE AND THE CARD CARRIES A GOLD BORDER (prompt 82, register §32)

**The section below is prompt 59's and is kept as the record of why the BRACKET was right for its
own moment.** What changed is not taste but ORDER: `chronological()` now sorts time → studio show →
favourite (prompt 80, `4e495b8`), and `SportBand` was taking that sorted list and splitting it, so
the page sorted and the band un-sorted it. A group floating to the top of a list ordered by the clock
contradicts the sort.

**The mark is a recoloured `border`, never an `outline`** — `button.mcard:focus-visible` already is
`outline: 2px solid var(--gold)`, so an outline would be the focus ring character for character and a
keyboard user would lose their position. `.mcard` already has a 1px border and a radius, so
recolouring costs **zero layout: 114px body track marked, 114px unmarked**, measured in `qa-shots`.
Prompt 59's inset table is kept in `globals.css` beside the new rule because it is the reason for the
shape.

**Still open for the device:** whether 1px reads loudly enough. `qa-shots` renders
`mobile__favourite-mark-1px.png` and `-2px.png` so it is a choice from a picture; the escalation is
one `box-shadow` line and also costs no layout.

### (prompt 59, superseded) THE FAVOURITES GROUP IS A BRACKET, NOT A HEADING

`.favlabel` and `.favrule` are **retired**. The label was `.band-title` character for character, so
YOUR TEAMS competed with COLLEGE FOOTBALL at equal weight; the rule was 1px of `--line-soft` on a
card gradient and nobody could see it. A gold left rule — `.scopeline`'s own gesture — says where the
group starts, where it ends and whose it is.

**4px of padding, not `.scopeline`'s 9px, and the difference was measured**: at 9px, ten of 26
favourite cards dropped a name tier; at 4px the bracket costs nothing. `.scopeline` keeps 9px because
it sits above content rather than beside a width-constrained card.

**This retires the "Your teams" / "My teams" naming inconsistency** deliberately — the band no longer
names the scope, so there is nothing left to disagree with the toggle.

### THE DETAIL PANEL BRANCHES ON `isProgram`

It printed **TBD @ TBD** for every race, fight card and studio show. Three defects, two of which Joe
could not see: the probable-pitcher block was unguarded (latent — no program carries `sport: 'mlb'`
today), and the venue row read `venue.name` instead of `location_text` on the 130 programs that carry
one. Helpers are imported from `lib/programs.js`, never reimplemented.

### CLOSED — MIGRATION 0017 IS APPLIED (2026-09-08)

Both of Joe's decisions were taken: the constraint approved, and the 79 surplus rows deleted rather
than kept — 31 of them identical re-fetches, 48 real line movement, all 111 rows of the 32 affected
pairs archived at `docs/research/game-odds-surplus-2026-09-08.json` first. See the repo-state entry
above for the before/after counts. If line movement is ever wanted as a FEATURE, this constraint is
the wrong shape and a history table is the right one; that question is not closed by this.


<!-- moved verbatim from docs/handoff-status.md lines 895-1043 (pre-split numbering, parent of the prompt 87 commit) -->
### CLOSED (was OPEN) — GRID VIEW STILL HAS NO COLLAPSED BAR

> **CLOSED — superseded by `### CLOSED — THE NAVBAR NOW RENDERS IN GRID VIEW (§28h)` above**
> (prompt 60, 2026-09-07: the grid exclusion was lifted after it was measured). Marked closed where it
> sits by prompt 87 rather than deleted; the text below is the record of what had to be true first.

Unchanged from prompt 58, deliberate and temporary. Before it lifts: the bar confirmed on the phone
in list view, the week grid stack confirmed on a phone at all (outstanding since prompt 54), and a
pinch and a horizontal pan tried with the bar showing at the scroller's top edge.

Tree clean apart from always-untracked `assets/` (and `web/qa/` and `artifacts/`, both gitignored).

**PROMPT 58 — THE COLLAPSING HEADER.** Seven commits, from `2532ac7`:

| stage | commit | what shipped |
|---|---|---|
| 0 | `f329c83` | half the gradient back, and the third grey lifted to meet it |
| 1 | `ae86c6f` | a collapsing header, mechanism only |
| 2 | `2e5e02c` | the collapsed bar names the wordmark and the four choices |
| 3 | `9b1a7cc` | the collapsed binaries flip on tap |
| 4 | `9d4abda` | all sports opens the tile row from the collapsed bar |
| 5 | `5e126c4` | the collapsed bar is list view only, for now |
| 6 | *(this commit)* | register §26, **working rule 34**, the prompt filed |

**Read register §26.** Joe's six rulings, why the tagline and the TV are not in the bar, the third
accessibility pattern, the ephemeral-UI-state line, and the grid exclusion with what has to be true
before it lifts.

### THE COLOUR TOKENS ARE `#2A2E34` AND `#8E959E`

Prompt 57 solved for AA alone and flattened the card gradient from 1.327 to 1.064. Halfway back
restores **1.183** and keeps all three greys clear of AA on the card top (12.17 / 5.18 / 4.51).
**`--dim` vs `--faint` is now 1.148, down from 1.272** — the AA lift was paid for with separation
between the second and third greys. Widening it again means moving `--dim`, and that is still open
and still Joe's.

### THE HUB HAS CLIENT-SIDE UI STATE NOW, AND §26c DRAWS THE LINE

Two pieces, both ephemeral: whether the bar is collapsed, and whether the tile row is open. **The
server renders the expanded state**, the observer applies the collapse after hydration, nothing is
persisted. State that answers a question about the WORLD belongs in the URL; state that describes
where the reader is LOOKING is presentation. Cite §26c before adding a third.

### THE HEADER IS A SIBLING OF `.shell`, AND THAT POSITION IS LOAD-BEARING

It is mounted in `layout.js` beside `Chrome`, so it can never be an ancestor of `<main>` or of the
mobile grid, and therefore never a containing block for `.mrail-cell`. A test asserts it never wraps
the content. **The briefed risk that a sticky header creates a containing block is false** — see
working rule 34.

### `SPORT_SHORT` IS THE ONE SHORT-LABEL MAP

In `config.js`, covering every sport. It replaced page.js's local `SPORT_TAG` (same five keys,
identical values). "College Football" is 93.3px against an ALL SPORTS target of 57.5px, which is why
the collapsed bar cannot use `SPORT_LABEL`.

### CLOSED (was OPEN) — GRID VIEW HAS NO COLLAPSED BAR

> **CLOSED — superseded by `### CLOSED — THE NAVBAR NOW RENDERS IN GRID VIEW (§28h)` above**
> (prompt 60, 2026-09-07: the grid exclusion was lifted after it was measured). Marked closed where it
> sits by prompt 87 rather than deleted; the text below is the record of what had to be true first.

Deliberate and temporary. `.mgrid-scroll` sets `touch-action: pan-x pan-y` and runs a pinch handler,
and a fixed bar over the top 44px of that scroller has never been tried on a device; week mode
stacks N of them. **Before it lifts:** the bar confirmed on the phone in list view, the week grid
stack confirmed on a phone at all (outstanding since prompt 54), and a pinch and a horizontal pan
tried with the bar showing at the scroller's top edge. Chromium will never reproduce it — prompt
30's rail bug was WebKit-only.

Tree clean apart from always-untracked `assets/` (and `web/qa/`, which prompt 46 added to
`.gitignore`).

**PROMPT 57 — THE ODDS PIPELINE, THE THIRD GREY, AND THE BANNER GENERATOR.** Ten commits, from
`07afc52`:
`07afc52`:

| stage | commit | what shipped |
|---|---|---|
| 0 | `4cddb07` | one phone size for the favourites marker (the pending `.favlabel` work) |
| 1 | `538ebcb` | the card reads the newest line, not the first |
| 2 | `c73f928` | NHL odds from the ESPN scoreboard, joined on date and abbreviation |
| 3 | `e73ff21` | CFB — the lines fetcher wired into the fixture builder |
| 4 | `a60c6cf` | the `game_odds` uniqueness migration, **unapplied** |
| 5 | `ff512b1` | darken the card gradient so the third grey survives |
| 6a | `f274fcc` | a real generator for the mobile banner |
| 6b | `d24e8e0` | model F |
| 7 | `1810960` | a single sheen across the wordmark |
| 8 | `9520310` | retire three dead strings and the search chain that carried one |
| 9 | *(this commit)* | register §25, **working rule 33**, the prompt filed |

**Read register §25.** Four odds defects, three fixed; the third grey; and a documented tool that
did not exist.

### THE ODDS PIPELINE — WHAT IS FIXED AND WHAT IS WAITING ON JOE

- **The card reads the newest line.** `odds:game_odds(...)` had no `order` and no `limit`, and
  PostgREST guarantees nothing about an embedded resource's order. `ODDS_NEWEST` is appended at all
  **five** `GAME_SELECT` call sites, and there are **three** consumers, not two — `MobileGrid.js:597`
  is the one that gets forgotten.
- **NHL and CFB now emit odds at all.** NHL joins ESPN's scoreboard on `(ET date, away abbrev, home
  abbrev)` — never ids. CFB's `fetch_lines()` had been written and never called.
- **`game_odds` accumulates and the fix is a migration awaiting approval.** See the open items.

### THE ABBREVIATION MAP IS TWO MAPS, AND CONFLATING THEM DROPS UTAH

`NHL_TO_ESPN` is right for ESPN's **teams** endpoint (`UTA -> UTAH`) and wrong for its
**scoreboard**, which spells Utah `UTA` exactly as the NHL does. The scoreboard diverges on **four**
clubs, not five — LAK, NJD, TBL, SJS. `NHL_TO_ESPN_SCOREBOARD` is separate and
`tests/test_nhl_odds.py` fails if the two are ever tidied into one.

### THE VERTICAL SCALE AND THE COLOUR TOKENS

The 8/16/24 scale from prompt 56 §24d is unchanged. `--panel-top` is now **`#23262b`**, darkened on
Joe's ruling so `--faint` reaches AA (4.53:1, from 3.63) on the top of the card gradient. It
coincides exactly with `--panel` and that is arithmetic, not a typo. **`--dim` vs `--faint` is
1.272:1 and no background change can alter it** — separating those two greys is still open and still
Joe's call.

### THE BANNER IS GENERATED FOR REAL NOW

`scripts/build_banner_mobile.py` reads `web/lib/banner-mobile-v2.json` and writes
`web/components/BannerMobileV2.jsx`; `--check` exits 1 on drift and `tests/test_banner_generator.py`
gates it. **Edit the JSON and regenerate — never the JSX.** That instruction has been in `Banner.js`
since prompt 42 and was unfollowable until now, which is what working rule 33 is about. The mobile
banner is **model F**: viewBox `0 0 428 135`, rendering 123.0px at 390, down from 141.2. The
**desktop** banner is untouched and still has no generator.

Tree clean apart from always-untracked `assets/` (and `web/qa/`, which prompt 46 added to
`.gitignore`).

**PROMPT 56 — TEN APPROVED REVISIONS, AND THE VERTICAL RHYTHM.** Nine commits, from `017d73e`:

| stage | commit | what shipped |
|---|---|---|
| 1 | `a9b1664` | one footer, one noun, one condition for the provenance line (R5, R7, R6) |
| 2 | `05711ac` | the count line reports in GRID view, it does not reveal (R1) |
| 3 | `1875386` | MY TEAMS names itself (R2) |
| 4 | `5dced9a` | a week names its league, and its day heading holds one shape (R3, R4) |
| 5 | `edb459f` | an empty day points at the next loaded one (R8) |
| 6 | `e7a39be` | the first band states the clock, and its three titles share one voice (R9) |
| 7 | `50d4a67` | the desktop grid answers on a day with no games (R10) |
| 8 | `96c8c08` | one vertical rhythm below the picker |
| 9 | *(this commit)* | register §24, **working rule 32**, the reference annotated, the prompt filed |

**Read register §24.** Every one of the ten was shown to Joe as a paired before/after mockup and
approved on 2026-09-06. **R11 — "2 of 14 today" beside the first band's clock — was CONSIDERED AND
DECLINED**; a test pins its absence so it is not re-proposed.

### THE THREE BAND TITLES CHANGED — 05 §D1b's WORDING IS SUPERSEDED

`Tonight` (unchanged) · `On now · Next up` → **`Live & Upcoming`** · `Finals · Tomorrow` →
**`Finals & Tomorrow`**. Joe asked for one and then ruled all three should match rather than leaving
two connectors doing one job. **The three STATES are untouched** and are still exactly the three D1b
specced — only what they are called. The feature study, its mockups and the prompt archive still
quote the old names, correctly: they record what was decided when. The first band's subtext is now
the clock alone — **`as of 7:12 PM`**, no day and no " ET".


<!-- moved verbatim from docs/handoff-status.md lines 1076-1160 (pre-split numbering, parent of the prompt 87 commit) -->
### THE COUNT LINE, THE FOOTER AND THE EMPTY DAY

- The page count line reads **"N broadcasts on your services"**. `on` counts every row shown, and
  since v1.7 that includes races, fight cards and studio shows — none of them a game.
- **The developer footnote is gone from all eight views.** `.footnote-tz` is now the only footnote.
- **In the four GRID views the count line reports and does not reveal**: no button, and a clause —
  *"18 not on your services — switch to List to see them"*. All four render **0** elements matching
  `.mcard, .pcard, .band-head`, with no control that could open one. Before the fix one press put 20
  such elements under Day · All · GRID and 88 under Week · All · GRID.
- **The empty day names the nearest LOADED day** instead of six hardcoded dates, three of which were
  already in the past. `nearestLoadedDay` is bounded — `select=viewing_day`, ordered, `limit=1`,
  sport-scoped (rule 19) — runs only on a day that is already empty, and falls back to a line with no
  date in it if it fails. It reads `games` only, so a **programs-only day is never offered**; it
  still renders normally when reached.

### `.yourteams` IS GONE, AND SO IS AN EMPTY HAIRLINE

`git grep yourteams` returns nothing under `web/`. The class was not merely unused — `SportBand` was
still APPLYING it to any band handed a `sectionLabel`, and the only caller passing one was week mode
passing a **weekday**, so every Tuesday was marked as the page-level favourites section prompt 51
retired. `sectionLabel` and `headingClass` are removed from `SportBand`; so are
`.listing > .yourteams` and `.band-headrow > .favlabel`. A **third** dead thing fell out with them:
with `showHeader` false and no `sectionLabel`, `.band-headrow` rendered EMPTY and painted a bare
hairline plus 14px above the first band's cards. It is gated on `showHeader` now.

Tree clean apart from always-untracked `assets/` (and `web/qa/`, which prompt 46 added to
`.gitignore`).

**PROMPT 55 — LIST IS A LIST, GRID IS A GRID, AND FOUR NETWORK MARKS.** Four commits, from `c18eea0`:

| stage | commit | what shipped |
|---|---|---|
| 1 | `7ccf020` | the grid leaves LIST view — one meaning for the toggle in both modes |
| 2 | `b3afe16` | NFL Network, TBS, truTV and ACCNX join the rail |
| 3 | `34e1544` | **working rule 31** — a search that finds nothing |
| 4 | *(this commit)* | register §23, the locked reference annotated, the prompt filed |

**Read register §23.** Joe: *"I only want list cards on list view and only grids on grid view."*
That **supersedes 05 §11's phone page order** — §11 put the grid inside the list on 2026-09-03, three
days before the LIST | GRID toggle existed, so it was never a design chosen over the toggle. The day
page is **3,208px shorter at 390** (13,201 → 9,993px), DOM 3,862 → 1,653.

### THE MARKS SUITE IS 32, AND ESPN3 IS THE ONLY GAP

32 of 33 access-profile networks now carry a mark, down from five missing. **ESPN3 is rejected on
purpose**: its supplied art has a "clearpng" watermark baked over the letterforms, which the flood
key cannot reach because it is not connected to the border. **Do not re-source it blind** — §23c.

`key_neutral` was added to `build_web_marks.py` for sources that arrive with a **checkerboard baked
in as opaque pixels** (PNG-aggregator output). `key_plate` cannot key those: it samples an edge
median, and a two-tone checkerboard puts the median between the tones. `key_neutral` tests a
predicate and floods from the border, which is what preserves the NFL shield's interior white stars.

The ink-area target stayed frozen at `NET_TARGET = 11646.499633789062` (prompt 52 stage 7), so the
manifest diff is **4 added, 0 changed** and every existing PNG is byte-identical. All four land on
600px²; the rail spread is unchanged at **1.16×**.
Tree clean apart from always-untracked `assets/` (and `web/qa/`, which prompt 46 added to
`.gitignore`).

**PROMPT 54 — THE WEEK GRID.** Four commits, from `ea9dd1f`:

| stage | commit | what shipped |
|---|---|---|
| 1 | `c110c6e` | a week renders a grid for each of its days |
| 2 | `af91ffb` | the desktop week shows archived grids, or says why it cannot |
| 3 | `4d87e88` | the week baseline, and the day/week geometry equality |
| 4 | *(this commit)* | register §22, addendum v2.1 + M23, CLAUDE.md, the prompt filed |

**Read register §22 and addendum M23.** Joe's model: a TV grid's x-axis is ONE viewing day's
minutes, so a week grid is N grids stacked, one per day that has games, each under its own heading.

### THE SCALING QUESTION IS SETTLED, AND IT LANDED THE OTHER WAY

Heaviest loaded ALL SPORTS week, `2026-11-09`, at 390:

| | grids / cards | page height | DOM |
|---|---|---|---|
| week, LIST | 173 cards | 27,252px | 4,239 |
| **week, GRID** | **7 grids** | **12,443px** | **2,937** |
| day `2026-09-05`, GRID | 70 blocks | 4,092px | 2,499 |

The grid stack is **less than half the height of the same week's list**. **The sport tiles are the
scaling control**, not the mode. No day sub-picker; if a stack ever does prove unusable the lever is
per-day lazy rendering, which applies to the list identically.


<!-- moved verbatim from docs/handoff-status.md lines 1265-1410 (pre-split numbering, parent of the prompt 87 commit) -->
### THE MLB TRIPWIRE MOVED, AND NO CODE CAUSED IT

**CFB `2026-09-05` = 64 blocks / {240, 223, 205, 136} / scrollWidth 1273 — unchanged.**
**MLB `2026-09-03` now reads 3 / {226} / 564 against the recorded 3 / {228} / 568.**

Measured at `61469b6` with every file of prompt 53 reverted, it is **already** 226/564 — the change
predates the run. **Block count is unchanged**, which is the part that signals a regression. The
cause is DATA: `MobileGrid.js:143-163` derives `pxPerMin` from a runtime measurement of the widest
rendered team line *in the real fonts*, and that line carries the record — every MLB record on this
slate is now five characters wide. **This figure drifts with the standings.** Whether to re-baseline
it or to pin the tripwire to something that does not move with the season is Joe's call; it is
recorded rather than silently adopted.

### THE GRID'S LOGO-PRIORITY RULE (§21f, Joe's ruling)

A program block draws its mark at its clear height — `blockH x 0.62 x aspect / 0.78` — and renders
the title **only if what remains fits it at 18 x SCALE (14.4px)**. Below that the block is LOGO ONLY:
the mark fills the body, the wash, seam and tray stay, the brand bar and subtitle go. Aspect is read
from `web/public/programs/manifest.json` and `web/public/leagues/leagues-manifest.json`
(`dark_w`/`dark_h`), **never measured in the DOM**. A brand with no art keeps the old `w/3` treatment.

**PROMPT 52 — the metallic gold, the rail, NASCAR unfiltered, the studio art.** Nine commits:

| stage | commit | what shipped |
|---|---|---|
| 0 | `c730f2a` | the metallic-gold handoff and its rendering, filed in `docs/ux-reference/` |
| 1 | `846bff7` | the NASCAR series sub-filter retired — register §9 and §16 superseded |
| 2 | *(no commit)* | row spacing VERIFIED, nothing to build — see below |
| 3 | `68ee198` | the metallic gold family replaces the yellow; tokens and every surface reading them |
| 4 | `5e5eb1f` | the banner wordmark and the segmented controls join the metallic family |
| 5 | `671fa51` | one ink weight for every network mark; the rail 69 → 60px |
| 6 | `131b5a3` | Big Noon and GameDay render the marks that were already built for them |
| 7a | `47df7da` | five studio-show marks sourced and processed |
| 7b | `4fcccf6` | a compact lockup closes HBO Max onto the target weight |
| 8 | *(this commit)* | register §19 and §20, addendum v2.0, this file, the prompt filed |

**Read `docs/enhancement-register.md` §19 and §20** before touching the gold, the rail, the marks
pipeline or the NASCAR filter — every decision this run made and every call left open to Joe is
recorded there with its measurement.

### THE NEW GOLD TOKENS — read from `web/app/globals.css`, never retyped (rule 16)

```
--gold: #C6AF7A   --gold-dim: #8C7650   --gold-hi: #E0D1A5   --gold-mid: #B39A69
--gold-glow: rgba(198,175,122,0.22)     --gold-line: rgba(198,175,122,0.55)
```

Source: `docs/ux-reference/visual-refinement-handoff-2026-09-06.md` §4. **`data/brands.json`'s AEW
`#F0C850` is a BRAND CONSTANT, not a use of the old token** — it survives on purpose (§19b).

### THE RAIL CONSTANTS

`--rail-w: 60px` (`globals.css`) and, in `web/lib/marks.js`, `RAIL_TARGET_AREA = 600`,
`RAIL_BOX_W = 52`, `RAIL_MAX_H = 30`. **`RAIL_BOX_W` must be changed by hand whenever `--rail-w` is**
— it is `--rail-w` minus a 2px border-right and 6px of padding, and JS cannot read it from the
stylesheet. 27 of 28 marks land on 600px²; ESPN2 is the one that cannot.

### THE PHONE-GRID TRIPWIRE — RE-BASELINED BY STAGE 5 (prompt 52's figures, not today's)

**CFB `2026-09-05` = 64 blocks / {240, 223, 205, 136} / scrollWidth 1273;
MLB `2026-09-03` = 3 / {228} / 568.** (Was 1282 and 577.) Only scrollWidth moved, by exactly the
9px the rail lost. **MLB HAS SINCE DRIFTED TO 567** with the standings — the live row is in the
table under "Repo state" above, which is the only current copy. This paragraph is prompt 52's
record and is left as measured. **Block counts and block widths did not change and must not** — if either moves,
that is a real regression, not this re-baseline.

### STAGE 2's MEASUREMENTS — the control stack, verified not rebuilt

All six gaps, at 360 / 390 / 430 / 1440, measured after stage 1 removed the series row:

| gap | 360 | 390 | 430 | 1440 |
|---|---|---|---|---|
| banner → DAY\|WEEK | 8 | 8 | 8 | 8 |
| DAY\|WEEK → ALL GAMES\|MY TEAMS | 8 | 8 | 8 | 8 |
| ALL GAMES\|MY TEAMS → ALL SPORTS | 8 | 8 | 8 | 8 |
| **ALL SPORTS → league tiles** | **6** | **6** | **6** | **6** |
| league tiles → picker | 8 | 8 | 8 | 8 |
| picker → content | 8 | 8 | 8 | 8 |

The 6px is Joe's named exception — `.sportbar`'s own internal gap, what makes the bar and the tiles
read as one control (§16). **Nothing needed building; prompt 51 stage 2 had already done it.**

**Row heights, for the rhythm conversation this run did NOT open:** DAY|WEEK **33px**, ALL
GAMES|MY TEAMS **33px**, ALL SPORTS **24px**, league tiles **44px** (36px at 1440), picker **44px**.
Note the toggle ROW is 33px, not the 31px usually quoted — 31px is `.seg button`'s height and `.seg`
adds a 1px border top and bottom. The eye measures ink to ink, so uniform 8px gaps between boxes of
24, 33 and 44 can still read as an uneven rhythm. **That is a row-height question and it needs Joe's
ruling before anything moves.** Gaps were not adjusted to compensate.

**Prompt 51 finished the hub against Joe's device review.** Five commits:

| stage | commit | what shipped |
|---|---|---|
| 1 | `610ca87` | the toggle rows 44px -> 31px |
| 2 | `897fff2` | one 8px gap governs the whole control stack |
| 3 | `33cbb51` | the banner absorbs 6px more of the inset, 14 in total |
| 4 | `a2eb11c` | the YOUR TEAMS section retires; the five team-less sports join MY TEAMS |
| 5 | *(this commit)* | this file, register §18 consolidated, 05 §14, addendum v1.9 |

**THE STACK ORDER IS CLOSED.** The design sheets showed the picker above the tiles, Joe's typed
instruction put it below them, the build followed his words, and he has ruled the built order correct.
Do not revisit it.

**THE APP IS ONE PAGE.** Prompt 50 built the Schedule Hub. Six commits:

| stage | commit | what shipped |
|---|---|---|
| 0 | `17a7429` | `docs/ux-reference/`, the 36 missing prompts, the hub pointer |
| 1 | `494dd7b` | one route, the six-parameter model, the redirects, the tab row retired |
| 2 | `eb4f0ed` | the two toggle rows, the 24px ALL SPORTS bar, the picker below the tiles |
| 3 | `92a8055` | the banner up 8px, the picker's vertical space |
| 4 | `fe075da` | off-service games hidden again, one page-level count line |
| 5 | `eb0e5db` | the grid's own header removed |
| 6 | *(this commit)* | this file, 05 §14, register §18, addendum v1.8, the locked reference |

Read **`docs/hub/`** before touching the app's chrome, its routes or its count lines — every one of
those is now governed by a ruling recorded there, and 05 **§14** is where the amendments land.

**PROGRAMS ARE LIVE.** 307 non-game programs render on both the phone grid and the listings -
NASCAR 98, studio shows 111, AEW 35, WWE 36, IndyCar 18, UFC 9 - under rendering-contract **v1.7**,
each carrying an eligibility verdict from migration 0014.

Prompt 46 stage 1 — Joe's second installed-app review, 2026-09-05:
`6d9e168` headroom +7→+4 → `f46a57c` symmetric header spacing, tiles-to-section gap → `56e15f3`
styled pickers over native controls → `66df3fd` two-line season-week headings → `eb22693` grid
name·record space + all-zero suppression (contract v1.6.14) → `e1d44ee` venue one step brighter, and
05 §13.

Prompt 45: `98bf919` the artwork paints the safe-area band (the seam) → `e5ff931` DATE/WEEK headers
carry the picker → `6b3bc58` ALL SPORTS.

Prompt 44: `a68af01` absorb nothing of the inset; `392a130` the card-ladder fixture stops rotting.

Prompt 43: `bd7bd22` icon v7 → `0649dd9` banner phone v2 → `560d1c1` banner desktop v2, retire
`banner-layout.json` → `c1d9955` **the banner is on every route; NavBanner and the compact bar are
gone**.

Prompt 42: `fbfc2f8` contract v1.6.13 — the card's fit order mirrors the grid's.

Earlier prompts are in `git log`; this file no longer restates them.

**CRLF hazard — CLOSED** by `f15449f` (prompt 24). `.js .mjs .jsx .css .html` are `text eol=lf` in
`.gitattributes`. A plain `git diff` tells the truth from either OS. Note `globals.css` is CRLF *on
disk* and LF *in the index* — git normalises on add, so preserve line endings when editing it
programmatically.


<!-- moved verbatim from docs/handoff-status.md lines 1487-1508 (pre-split numbering, parent of the prompt 87 commit) -->
## Opened by prompt 57 — TWO, AND THEY MUST LAND IN THIS ORDER

- **BOTH CLOSED, 2026-09-08, AND THEY LANDED IN THE ORDER THIS ENTRY DEMANDED.**

  **The migration** was applied from Cowork at 01:34 UTC on Joe's explicit named approval: 595 rows
  → 516, 79 deleted, 32 duplicate pairs → 0, both unique constraints present. All 111 rows of the
  affected pairs were archived KEEP/DELETE at
  `docs/research/game-odds-surplus-2026-09-08.json`, with six checksums verified against the live
  database first.

  **The loader followed in `f7fe047`**, not before — `pipeline/load.py` now upserts on
  `"game_id, provider"` with the update list
  `["spread", "total", "home_moneyline", "away_moneyline", "fetched_at"]`. Shipping it first would
  have failed every loader run with "there is no unique or exclusion constraint matching the ON
  CONFLICT specification"; shipping the migration alone would have failed them the other way, which
  is why the loader went in the same morning rather than waiting for a docs stage.

  **One thing this did NOT settle.** The non-empty update list is what makes the constraint useful:
  `pipeline/db.py:186-192` compiles an empty list to `DO NOTHING`, which with the new constraint
  would silently freeze every book at the first line it ever quoted. That is a quieter failure than
  the violation, and it is why the update list is pinned in the file's own comment.


<!-- moved verbatim from docs/handoff-status.md lines 1930-2328 (pre-split numbering, parent of the prompt 87 commit) -->
## 2026-09-05 night run (prompt 46)

Ran on `main` from `6b3bc58`. Final HEAD **8f63741**. Gates moved
**232 + 1 / 259 / 30 / 14** → **280 + 1 / 290 / 30 / 14**.

| stage | commit | what shipped |
|---|---|---|
| 1A | `6d9e168` | standalone headroom +7 → +4 |
| 1B | `f46a57c` | symmetric header spacing; tiles→section gap = bar→tiles gap |
| 1C | `56e15f3` | styled pickers over native controls; gold sport-week, long date |
| 1D | `66df3fd` | two-line season-week headings, sport-week in gold |
| 1E | `eb22693` | grid name·record space, all-zero records absent (contract v1.6.14) |
| 1F | `e1d44ee` | venue one step brighter; 05 §13 records the batch |
| 2 | `588065a` | this file rewritten; the old chrome's leftovers retired |
| 3 | `2127d75` | one telecast ladder; the re-reconcile (run id 81) |
| 4 | `d6c19c7` | `db/enums.json` + row-level quarantine in the loader |
| 5 | `569aef0` | D1 the first band, D5 the 1592 px composition |
| 6 | `3fd5f6c` | bootstrap takes NHL/NBA date ranges — **the loads did not run** |
| 7 | `8f63741` | NASCAR adapter + recorded feeds — **the load did not run** |

**The phone-grid tripwire was re-baselined once, in 1E, and held for every stage after:**
CFB `2026-09-05` 62 blocks / {240, 223} / **1073** (unchanged); MLB `2026-09-03` 3 / **228** / **577**
(was 231 / 582 — M2 stopped measuring a second space it never drew).

**The one database write:** the stage-3 re-reconcile, run id 81, 1,384 games in 172 s. Sanity gate
passed on all seven criteria; the change set was provably bare-only (78 rows: nfl 24 + nhl 38 +
nba 16 moved `no_linear_telecast` → `tbd`). Backups at
`artifacts/backups/{games,viewer_game_eligibility}_2026-09-05T133646Z.csv`.

### Opened by this run

- **NHL and NBA season loads still owe their data.** The workflow can now do it
  (`nhl_from`/`nhl_to`, `nba_from`/`nba_to`) but the loads must run **in the workflow, not from this
  laptop**: measured at stage 0, ESPN answered **403 three times out of three** and
  `api-web.nhle.com` answered **200 on 2 of 5** bounded attempts. Both blocks are local — the daily
  refresh uses the same adapters from GitHub's network and is green. Someone has to be present for
  the sanity gate (NHL near 1,312, NBA near 1,230, a shortfall over 5 % is a stop).
- **NASCAR needs two migrations before its 98 programs can load**, both named in `8f63741`:
  `game_broadcasts` has no `program_id` and `game_id` is NOT NULL, so a program cannot own a
  broadcast row; and `programs` has no natural key, so there is nothing to upsert on and a second
  run would insert 98 duplicates.
- **v1.7 now has NASCAR data waiting for it** — the adapter and three recorded feeds exist; nothing
  renders a program until the contract lands.
- **1D's gold sport-week heading line and 1F's `--ink` venue token are Cowork's calls, open to veto.**
- **D1's three states are pinned by fixtures but only `tonight` was screenshot** — the run happened
  at 10:04 ET. Injecting a different `now` into a server render would mean a debug query parameter
  on a production page.
- **`programs == games` is no longer a database-wide invariant** — one-directional now: every game
  has a program, not every program has a game.

---

## 2026-09-06 programs run (prompt 47)

Ran on `main` from `0a6c617`. Final HEAD **d921576**. Gates **280 + 1 / 290 / 30 / 14** →
**320 + 1 / 298 / 30 / 14**.

| stage | commit | what shipped |
|---|---|---|
| 1 | `798251c` | migrations 0012 + 0013; the reconciler guard for a nullable `game_id` |
| — | `743c2bc` | **fix**: `bootstrap_season.yml` did not parse and never assigned its ranges |
| 3b | `8782f94` | `vs` retired; `(neutral site)` on the venue line (contract v1.6.15) |
| 3 code | `69aaea5` | per-race NASCAR broadcasts; `pipeline/load_programs.py` |
| 2 | `34aaef0` | NHL + NBA 2026-27 loaded via Actions — **1,384 → 3,868 games** |
| 3 load | `042a231` | 98 NASCAR race sessions + 98 broadcasts, idempotent |
| 10 | `d921576` | fail-honest NASCAR refresh step |

**Stages 4–9 were not built.** See "What this run could not do" below.

### The two defects this run found in its own predecessors

1. **Prompt 46's `bootstrap_season.yml` never worked.** A shell comment inside the `run:` block
   contained a literal empty Actions expression, so the file failed to parse — every push since
   `3fd5f6c` died in 0 s — and separately `NHL_FROM`/`NBA_FROM` were read but never assigned. PyYAML
   validated it green, which is rule 24 in a new costume. Fixed in `743c2bc` with a 19-assertion
   guard (`tests/test_workflows.py`).
2. **Prompt 46's `--all` reconcile deadlocked the scheduled refresh.** Today's 11:00 cron
   (run `33969416271`) died at 13:40:43 with `ERROR: deadlock detected` in the fixture loader — five
   seconds after that reconcile began writing at 13:40:38. **New working rule 27** below.

### Corrections to the record

- **ESPN is not blocked from this laptop.** Prompt 46 reported "403 three times out of three"; the
  403 came from an ad-hoc User-Agent it invented for the probe. Same URL, same second: project UA
  200, no UA 200, prompt 46's UA 403. NHL's flakiness *is* real and UA-independent (TLS resets).
- **`nascar_dark.png` was already committed** — stage 0 was told to check whether it needed to ride
  a commit; it did not.
- **0009 had already built** `studio_shows`, `studio_show_instances`, `game_broadcasts.window_start/
  window_end`, and every `sport` and `program_type` enum value. 0013 therefore contains **no
  `ALTER TYPE`** and extends the studio tables rather than creating them.

### What this run could not do, and why

**Every document naming the 2026 slots, networks, durations and verified source URLs is absent from
the repository.** `claude/` does not exist; `program-card-design-v1.md`, `research-summary-2.md`,
`research-studio-shows.md`, `research-wwe.md`, `research-aew.md`, `research-ufc.md`,
`research-nascar.md` and `research-indycar.md` are nowhere in the tree. What exists is
`docs/enhancement-register.md` (§1–§16 — the handoff's old "project-only" note was stale) and
`docs/research/{changelog,mlb,nba,nfl,nhl,summary}.md`.

So **stage 4** had no design of record to build from — its brief says "read it twice" — and
**stages 5–9** had neither the slots nor the verified URLs. `wwe.com/schedule` and
`allelitewrestling.com/aew-schedule` both 404 at their obvious paths and `press.wbd.com` 403s, so the
URLs cannot be recovered by guessing either. Writing those schedules from memory would put invented
broadcast facts into a production database Joe reads as truth about what he can watch — which the
brief forbids in its own opening and rule 9 exists to prevent.

**To unblock:** put those seven documents in the repo (or tell me their Project paths to copy from).

### Open items this run created

- **Programs have no eligibility rows and cannot.** `viewer_game_eligibility.game_id` is
  `text NOT NULL`, so there is nowhere to record whether a race is on a service Joe has. Needs the
  same treatment 0012 gave `game_broadcasts`. **Gates v1.7**, which is the first thing that shows a
  program to a reader.
- **NHL loaded 1,344, not 1,312** — 84 games a club, internally consistent (1,344 distinct ids and
  external ids, 32 home clubs, no duplicates, all `REGULAR`). Recorded rather than rounded.
- **NBA loaded 1,206 against ~1,230** — −1.95 %, inside tolerance, cause not investigated.
- **NHL/NBA `team_records` are still season 2025** (prompt 37); their cards show thin standings.
- **No wrapped neutral-site case exists** — the longest neutral venue fits on one line even at 360,
  so v1.6.15's wrap rule is tested by construction, not by a screenshot.
- The refresh step was **not dispatched** tonight, deliberately — see rule 27.

---

## 2026-09-05/06 programs-live run (prompt 48)

Ran on `main` from `ef3d826`. Final HEAD is the stage-9 commit that carries this block. Gates moved
**320 + 1 / 298 / 30 / 14** → **443 + 1 / 329 / 30 / 14**.

**This is the run prompt 47 could not do.** Every document its stages 4–9 load from lived only in the
Claude.ai Project; Joe dropped the eleven of them into the repo, stage 0 committed them, and the rest
followed.

| stage | commit | what shipped |
|---|---|---|
| 0 | `1b20768` | the eleven events & shows source documents, verbatim from the Project |
| 1 | `27f570e` | migration 0014 — `viewer_program_eligibility`; the reconciler grows `--programs` |
| — | `77258ff` | **fix**: the NASCAR feed's times are Eastern, and a corrected time must not double the season |
| 2 | `376ef36` | rendering-contract **v1.7** — the program card on both grids, the list variant, the now marker |
| 3 | `5bca121` | IndyCar 2026 + migration 0015 (a NULL series cannot be a natural key) |
| 4 | `1d21442` | WWE — Raw, SmackDown and the PLEs |
| 5 | `3ec3231` | AEW — Dynamite and Collision, per-episode network |
| 6 | `83dea25` | studio shows — registry, 111 instances, the GameDay site parse, the crews |
| 7 | `50a5826` | UFC — 9 cards, plain, no invented segments and no invented CBS window |
| 8 | `3076900` | five more fail-honest refresh steps and a program reconcile |
| 9 | *(this commit)* | this file, the register close-outs, the changelog and the Project mirror |

### The database, before and after

| | before | after |
|---|---|---|
| `programs` | 3,966 | **4,190** |
| non-game programs | 98 (NASCAR only) | **307** — nascar 98 · studio 111 · aew 35 · wwe 36 · indycar 18 · ufc 9 |
| by type | race_session 98 | race_session 116 · studio_show 111 · weekly_show 68 · fight_card 9 · special_event 3 |
| `game_broadcasts` | 2,374 (98 on programs) | **2,681** (374 on programs) |
| `viewer_program_eligibility` | did not exist | **307 rows, 0 uncovered, 0 orphans** |
| `studio_shows` / `studio_show_instances` | 0 / 0 | **7 / 111**, every instance linked to its program |
| `games` | 3,868 | 3,883 — **+15 from the refresh run, not from this run** |

**The game side was provably untouched by every program stage.** The md5 over all 3,868 game verdicts
was `d4fa47cb02ab41427267dfcff1eb8440` before stage 1 and after stages 3, 4, 5, 6 and 7. It changed
only when the stage-8 refresh reconciled games, which is that workflow's job.

### The migrations

**0014 — `viewer_program_eligibility`.** The brief asked for 0012's shape on
`viewer_game_eligibility`: nullable `game_id`, a `program_id`, a one-subject check. **That works on
`game_broadcasts` and not here** — `game_id` is half `viewer_game_eligibility`'s PRIMARY KEY, so
"make it nullable" means dropping the primary key of the table the whole app reads its access
verdicts from, and the run's approval is *additive only, never a drop*. Built additively instead: a
separate table, column for column the sibling. Every existing count is then unchanged **by
construction** rather than by a `where game_id is not null` guard on each consumer.

**0015 — the race-session natural key survives a NULL series.** 0012's own finding in a second place.
It wrote *"NULLs are distinct in a unique constraint, so with game_id null every program broadcast
looks new and a re-load duplicates all of them"* — and the same sentence is true of `programs.series`,
which 0012's own index depends on. NASCAR carries a series; IndyCar runs one and carries none
(register §16 named that trap). Measured: two loads of the same 18 races produced 36 rows. 0015 adds
the `coalesce(series, '')` key, keeps 0012's index, and removes the 18 duplicates this run made —
scoped to `sport = 'indycar'`, raising rather than committing if any other sport moved.

### The tripwire

Held at CFB `2026-09-05` **62 / {240, 223} / 1073** and MLB `2026-09-03` **3 / 228 / 577** through
stages 0–5. It moved in stage 6, when the two CFB studio shows landed on that day, and the move is
fully accounted for:

| | before | after |
|---|---|---|
| blocks | 62 | **64** — College GameDay and Big Noon Kickoff |
| widths | {240, 223} | {240, 223, **205, 136**} — every GAME width unchanged |
| scrollWidth | 1073 | **1282** — the axis now opens at 9:00 AM for GameDay, earlier than the first kickoff |
| rows | 15 | 15 — both shows sit on ESPN's and FOX's existing rows |
| measured name width | 124 / 14744 | 124 / 14744 — **unchanged**, so no game name moved |
| MLB `2026-09-03` | 3 / 228 / 577 | 3 / 228 / 577 — untouched all night |

**New baseline: CFB `2026-09-05` = 64 / {240, 223, 205, 136} / 1282; MLB `2026-09-03` = 3 / 228 / 577.**

### Four defects this run found in data or code that predates it

1. **Every 2026 NASCAR race was four hours early.** `cf.nascar.com` writes `race_date` as
   `"2026-09-06T17:00:00"` with no zone and `parse_iso` stamps a naive value UTC, so the Darlington
   race — the one Joe is being asked to look at — sat at 1:00 PM instead of 5:00 PM. Established
   against ESPN's `racing/nascar-premier` scoreboard on six races: five agree with the Eastern
   reading to the minute, **including the Nov 8 finale, which is in EST**, so it is a wall clock and
   not a fixed offset. The DAYTONA 500 is a one-hour source disagreement and is pinned as one.
   **The 98 stored rows are still wrong** — correcting them changes a natural key, so it is a
   database decision and not a load.
2. **Fixing that would have doubled the season.** Every `program_type`'s natural key contains
   `start_at`, so a corrected time is a different key and tonight's refresh would have inserted 98
   second copies. `pipeline/load_programs.py` now refuses a row that matches a stored one on
   everything but `start_at` and says so with both times. Proved against the live rows: it fires on
   40 of 40 Cup races, and the stage-8 dispatch confirmed it on the runner.
3. **Two NASCAR races on FS2 read as watchable.** `adapters/nascar.py` wrote
   `access_status: "available"` for every broadcaster, and FS2 is in the profile's `unavailable`
   list. Fixed at the choke point rather than in the adapter: `load_programs.py` now classifies every
   broadcast row from `data/access_profile.json`, so all five adapters this run shipped inherit it.
4. **A slate ending at or after 03:00 read as already finished.** `web/lib/bandstate.js` — a UFC card
   at 9 PM with a 360-minute block closes at `"03:00"`, comes back as 180, and 180 is smaller than
   the window's own 14:00 opening, so D1 jumped to FINALS and rendered *"Nothing loaded for this
   viewing day yet"* over a card that had not started. A window cannot close before it opens; that is
   a wrap and is now read as one.

### Open items this run created

- **The 98 NASCAR rows are four hours early.** The correction changes a natural key, so a plain
  re-load duplicates rather than fixes — the moved-twin guard is what makes leaving them safe. It
  needs a Joe-approved delete-and-reload, or a targeted `update`. **This is the one thing on this
  list that a reader will notice.**
- **Ten brands have no mark**, so their endcaps render a typographic short title: `gameday`,
  `bignoon`, and the eight NFL studio-show keys. Nine of those also have **no colour** derivable from
  anything in the repo — `data/` has no network palette and the cached FOX and CBS wordmarks are
  monochrome — so they carry the grid's neutral `#4A505A`. Supply the marks through the marks
  pipeline and the colours derive.
- **Big Noon Kickoff's site is `tba` and its crew is `TBA`.** FOX Press Pass is now verified as
  fetch-clean but CONTENT-EMPTY: 200 on three paths, zero tables, zero occurrences of "Big Noon",
  because it is JS-rendered. The Wednesday research watch is the override path.
- **GameDay has one week's site**, Sept 5 Baton Rouge, from the one release recorded. Every other week
  is `tba` until its own release is recorded.
- **UFC segment times are not loaded** — the Paramount+ page carries the main-card start only.
- **UFC odds are not loaded** — register §9's provider key was not added, as the brief required.
- **The wwe.com dual listing** on Oct 10 and Nov 28 (ESPN Unlimited *and* Netflix): ESPN Unlimited
  only is loaded. Close it from a U.S.-specific release.
- **AEW ran the slot-default path.** `press.wbd.com` answers 200 but carries no AEW content at its
  root, and no trade had republished a monthly schedule. 33 of 35 rows are tiered `slot_default`, and
  the adapter re-reads allelitewrestling.com nightly to report drift.
- **Countdown to All Out is not loaded** — a source gap, not a scope decision: the doc gives its time
  but not its network.
- **Four studio shows named in the brief are not loaded** — Sunday NFL Countdown, the Prime TNF
  pregame, the Netflix pregames and the NASCAR pre/post shows. None has a verified 2026 slot in
  `docs/research/studio-shows.md` §1, and the brief's own rule is *"Nothing not in the doc"*. Each is
  recorded in `data/studio_shows.json` with its reason.
  **THREE AS OF PROMPT 86 (2026-09-10): Sunday NFL Countdown is registered.** ESPN's Super Bowl LXI
  season release (2026-08-19) states *"Sunday NFL Countdown (10 a.m.–1 p.m., ESPN)"*, §1 now carries
  it, and it is `sundaynflcountdown` in the registry — **standalone** (null `anchor_rule`, no
  `ANCHORS` entry), so no game can shorten the published window.
- **The archived desktop grid is still game-only.** `draw_program_card()` and a `--programs` input
  exist and are tested, but the daily `render_all` job writes no programs file beside the validation
  fixture, so nothing feeds it. The drawing is ready; the feed is not built.
- **NHL and NBA `team_records` are still season 2025** (prompt 37) — unchanged by this run.
- **The chip row is unchanged.** Register §16's eight tiles plus the ALL bar already matched the
  rulings; the only thing missing was §9's NASCAR series sub-filter, which lands as a SECOND row
  beneath the tiles so the tile geometry §16 froze does not move.
- **Two of Cowork's calls are open to veto**: programs as rows in the D1 first band on the days they
  air, and the list-card variant derived from the grid card.

### Corrections to the record

- **`src/` does not exist.** The brief calls the Python SVG renderer "the renderer under `src/`"; it
  is `scripts/render_day.py`.
- **`docs/research/changelog.md` does not exist** — the file is `docs/research/research-changelog.md`.
- **Register §16 supersedes §13's chip roster**, which the brief's stage 2c did not account for:
  NASCAR and IndyCar share one Racing chip and the ALL bar is a full-width row. The shipped
  `SPORT_FILTERS` already matched §16 and was left alone.
- **`docs/research/studio-shows.md` §1 does not carry Sunday NFL Countdown**, which the brief lists
  among the shows to load. *(True when written; closed by prompt 86, which added the line from ESPN's
  release — see the not-loaded list above.)*
- **The ESPN Press Room GameDay page has no weekly Date/Site/Game table.** Its one table is a
  historical January bowl table; the weekly site is prose inside each week's own release.

### Stage 8 dispatched, and every new step ran green on the runner

Rule 27 checked first: the last scheduled run had completed (as a failure - the 0012-era deadlock) at
13:37Z, the next was thirteen hours out, and nothing from this run was still writing. Dispatched as
run **33994233255**; the `refresh` job succeeded.

| step | what the runner logged |
|---|---|
| NASCAR (prompt 47's) | `programs 0 \| broadcasts 0` and **`MOVED-TWIN SKIPPED 98 row(s)`** - the guard fired on every race and stopped the duplication it was written for |
| IndyCar | 18 parsed, `programs 18 \| broadcasts 18`, access available 18 |
| WWE | 33 weekly shows + 3 PLEs, `programs 36 \| broadcasts 36` |
| AEW | 35 episodes, `programs 35 \| broadcasts 70`, `source tiers: research_document 2 \| slot_default 33`, **no DRIFT line** - the site still agrees with the slot file |
| UFC | 9 cards, `programs 9 \| broadcasts 9` |
| Studio shows | 109 instances, `programs 109 \| broadcasts 140`, `registry 7 shows \| instances 109 written, 109 linked` |
| Reconcile program eligibility | `reconciled 0 game(s) and 307 program(s)` |
| Reconcile canonical facts (existing) | `reconciled 15 game(s) and 0 program(s)` |

**109 and not 111** because the step passes no `--from` and so starts at today: the Aug 29 GameDay and
Big Noon instances are not regenerated, and the two already loaded stay. Not a loss - the count in the
database is still 111.

**The NASCAR line is the one to read.** Without the guard that step would have inserted 98 second
copies of the 2026 season tonight, and Joe would have seen every race twice.

---

## 2026-09-06 NASCAR times (prompt 49)

Ran on `main` from `f990165`. Four stages, four commits. Gates **443 + 1 / 329 / 30 / 14** ->
**465 + 1 / 329 / 30 / 14**. The tripwire did not move: CFB `2026-09-05` 64 / {240, 223, 205, 136} /
1282 and MLB `2026-09-03` 3 / 228 / 577, before and after.

| stage | commit | what shipped |
|---|---|---|
| 1 | `956f2d5` | the recorded fixtures round-trip again; the writer that broke them is fixed; **rule 29** |
| 2 | `7a0fcf5` | **`docs/prompts/`** - fifteen briefs filed verbatim |
| 3 | `225ef39` | the 98 NASCAR `start_at` values corrected in place |
| 4 | *(this commit)* | migration **0016** - `programs.external_id`, and a race key that survives a move |

### The 98 rows

`cf.nascar.com` publishes a NAIVE Eastern wall clock and `parse_iso` stamped it UTC, so every race
sat 4 hours early in EDT and 5 in EST. **Darlington now reads 5:00 PM ET instead of 1:00 PM**, on the
grid block and the list card - read off the page, not just the database.

Each row was matched on `(series, title, THE VALUE THE BUGGY LOADER WOULD HAVE WRITTEN)` - the naive
wall clock read as UTC. That is exact, it disambiguates the two Daytona Duels on their differing
naive times, and unlike a fuzzy match it **proves the defect's mechanism on every row it touches**.
98 of 98 stored rows matched 98 of 98 feed races; zero unmatched either way.

**The gate caught itself.** A first version asserted "+5h in January, February, November and
December" and failed two correct rows - DST 2026 runs March 8 to November 1, so the DuraMAX Texas
Grand Prix (Mar 1) and the GOVX 200 (Mar 7) are genuinely EST. It now asks `zoneinfo`.

Every checksum that had to hold, held: non-NASCAR `programs.start_at`, the program and game
eligibility verdicts, and every `game_broadcasts` window are byte-identical before and after.
`programs` has no column derived from `start_at`, and none of the 98 broadcast rows carries a window.

### 0016, and the key that was never a key

`programs.external_id` plus a partial unique index on
`(sport, coalesce(series, ''), external_id) where program_type = 'race_session' and external_id is
not null`. **0012's and 0015's indexes are kept** - dropping one is not additive - and are superseded
for rows carrying an id; they should be dropped in a later, separately approved migration.

`coalesce(series, '')` and not `series`, which the brief specified: that is **0015's lesson applied
one migration later rather than relearned.** NULLs are distinct in a unique index and IndyCar carries
no series, so the bare form would have made every IndyCar row invisible to its own key.

The 98 ids are the feed's own `race_id`, which `adapters/nascar.py` has carried in `_provenance`
since prompt 47 and which never reached the database because `PROGRAM_COLS` did not list it.
**IndyCar now supplies its schedule slug** the same way. Its 18 rows are still keyless, and the
loader **ADOPTS** them on the next run - stamping the id onto the existing row, matched on series,
title AND start_at - rather than inserting 18 copies. That adoption is the part with teeth: without
it, an adapter that starts emitting an id would duplicate everything it already had.

The moved-twin guard is relaxed for keyed rows and unchanged for keyless ones. A keyed race that
moves is now an UPDATE, and it says so: `moved: 'Race' (nascar 5624) <old> -> <new>`.

### Two writes beyond the letter of the approval, both named

The approval was `start_at` on 98 rows, plus 0016. Verifying the new key meant running the loader
against those 98, and a load necessarily writes the `game_broadcasts` rows it owns:

- **2 rows changed**, both FS2 - the Cook Out Clash and the Black's Tire 250 - from `available` to
  `unavailable`. That is the defect prompt 48 found and could not fix ("telling Joe he can watch
  something he cannot"). No row was added: 2,681 before and after.
- **A `--programs` reconcile** then followed, because those two rows had left the eligibility table
  contradicting the broadcast table. They now read `not receivable: fs2=unavailable`; NASCAR is
  96 eligible / 2 not.

Both writes only propagate facts already approved into derived tables, and reverting either would
restore a state prompt 48 documented as wrong - but they were not in the approval, and a dry run
should have come first.

### Stage 1's finding, which was bigger than the brief described

The four fixtures were **not** showing as modified here - git's stat cache hid a real disk/index
divergence. **A repo-wide sweep found 34 tracked files** whose disk bytes differ from their blobs,
including a fifth fixture the brief and Cowork both missed
(`web/test/fixtures/team-colours.json`, 1,245 CR). Five were restored; the other **29 are an open
item** - renormalising them rewrites 29 files and touches blame, which deserves its own commit.

### Open items this run leaves

- **29 tracked files still hold CRLF on disk against LF blobs.** Benign today, invisible to
  `git status`, and the first edit from Linux commits the churn into blame. Needs its own commit.
- **The DAYTONA 500 keeps cf.nascar.com's 2:30 PM ET**, one hour later than ESPN. Prompt 48 recorded
  it; this run corrected the timezone only, not the source disagreement.
- **0012's and 0015's race-session indexes are superseded but present.** Drop them once every race
  session carries an `external_id`.
- **IndyCar's 18 rows have no `external_id` yet.** The adapter now supplies one and the loader adopts
  on the next run; nothing was backfilled here, because that is a write this run was not approved to
  make.
- **The archived desktop grid is still game-only** (prompt 48's open item, unchanged): the drawing
  exists and is tested, the daily job writes it no programs file.
- **`docs/prompts/` holds 15 of 49 briefs.** 01-18, 24-39, 41 and 42 are Project-only and Cowork is
  extracting them; **42's brief has no known copy anywhere** and **39 has no trace at all**.

