# MySports — Handoff Status (rewritten 2026-09-05, prompt 46 stage 2)

**This file lives in the repo** at `docs/handoff-status.md` and is mirrored to the Claude project at
`claude/handoff-status.md`. The repo copy is the source; the project copy is written from it. Edit here.

**THE CLOSED AND SUPERSEDED HISTORY LIVES IN `docs/handoff-archive.md`** (split out by prompt 87 on
2026-09-10, moved verbatim, nothing deleted): the run narratives for prompts 46–84, closed and superseded
sections, and the older measurement records. **This file stays the authority for anything current**;
read the archive when you need to know why something was decided.

Read first for any session picking up MySports. Companions: **`docs/enhancement-register.md`** (§1–§35, all
in the repo — check there before re-raising any decision; §23 list-is-a-list,
**§24 prompt 56’s ten approved revisions, the band-title rename, R11 declined and the VERTICAL
SCALE**), **`docs/feature-study/05-home-page-decisions.md` — BINDING** (D1–D6, the D3
amendment, §9 NETWORK TBD, §11 mobile page order, §12 the DATE/WEEK headers, §13 the 2026-09-05
review — **D1b’s three band-title STRINGS are superseded by register §24b; its three STATES are
not; and D6’s closed open-item is superseded on the PHONE SIZE of `.favlabel` by §24h, because that
closure’s premise — that the label was the first heading on the page — expired when prompts 51 and 56
retired every path to page level**), `docs/rendering-contract.md` **v1.7**, `docs/rendering-contract-mobile.md` (Addendum
**v2.2** since prompt 86 block C — M5's axis pins under the picker; v2.0 — M4 amended for the 60px rail and the ink-area fit, M5's gold moved; Addendum v1.2 + M19-M22), **`docs/design/program-card-design-v1.md`** — the program card's design of record,
in the repo since prompt 48 stage 0 along with the ten events & shows research documents under
`docs/research/`. `docs/research/README-events-docs.md` maps their Project names to their repo paths. **`docs/prompts/`**
holds the Claude Code briefs themselves, verbatim and never
edited after the fact. ~~**62 files, covering prompts 01-60**~~ **91 briefs, covering 01–87, since prompt 87 filed
61–80 and 82–87** - five numbers (13, 23, 26, 43, 86) carry more than one file, which is why the file
count runs ahead of the highest number. **39 and 42 are the
only missing numbers and neither is recoverable**: 39 exists nowhere at all, and 42's brief is gone
though its handoff survives at `assets/handoff/banner-v2/HANDOFF-Prompt-42.md`. Neither was
reconstructed and no placeholder was written for either. Prompts are the as-run record of why a
commit exists; THIS file is what is current.

> **A correction this file owes, and the reason working rule 30 exists.** Until `cdfae84` these
> lines said 50 and 51 "were never filed" and "could not be reconstructed". **Both statements were
> false.** Prompt 52 stage 8 read `docs/prompts/README.md`, saw a deliberate "not yet filed" note,
> and reported a permanent gap - while the very paragraph it was reading named prompt 50's path in
> `Claude outputs\` exactly. The briefs were never lost; nobody had walked the last step, and filing
> them was a copy rather than a reconstruction.

**`docs/hub/` - THE SCHEDULE HUB, the largest structural change queued for this app**, and four
files that have to be read in this order:
**`MYSPORTS_UI_RESTRUCTURE.md`** is the spec (ChatGPT, 2026-09-05) - a source of requirements, not
instructions, and blind to the decision record.
**`restructure-triage-2026-09-05.md`** is Cowork's triage of it, and its **section 6a carries Joe's
rulings R1-R8, which are BINDING**; do not re-raise a ruled item.
**`hub-audit-2026-09-05.md`** is Claude Code's read-only code-level audit - its section A is a
current, cited architecture map and reading it first saves the rediscovery.
**`claude-code-hub-audit-2026-09-05.md`** is the brief that produced the audit.
**Two rulings changed after the audit ran**: R3b is REVERSED (off-service games are hidden again -
the audit's section I measured the alternative at 195 cards and 32,917px on the heaviest week), and
the count line is now page-level at the foot of the page rather than per band.

## Repo state

main, HEAD is prompt 66. **THIS IS THE ONLY PLACE THE GATE FLOORS ARE RECORDED.** `CLAUDE.md`
carried a second copy and it was wrong four times in one week (prompts 62, 63, 64, and again between
`9a69810` and `5c5f63d`); prompt 66 replaced it with a pointer here. Rule 10 already made this file
the winner — do not put a number back there, and do not add a third copy anywhere else.

**Measured 2026-09-10, prompt 87 block A — after that block's last gate run, not during it.** No count
moved in block A (documents only, plus geometry's 2026-09-13 span re-pinned 770.1 → 830.4 for Countdown);
the table below is unchanged from prompt 86 block C.

**IT WAS STALE BY TWO ROWS AGAIN, AND BY THE SAME MECHANISM.** Prompt 86 opened by running all five
gates on the unmodified tree at `dcf6281`: `pytest` **521 passed + 1 skipped**, `test:unit` 570,
`smoke` 33/33, `qa-shots` **108/108**, geometry all hard stops. The movements table below agreed with
every figure; the floor table did not — it still read **515 + 1** and **96/96**. Prompt 83 block E
(`TheDesktopBannerIsTranscribed`, +6 pytest) and prompt 84 (the banner read off the served DOM, +12
qa-shots) each added a movements row and neither touched the floor row. **A block that adds a
movement row edits the floor row in the same keystroke** — that is the whole fix, and it is cheaper
than any tooling.

**QA-SHOTS FAILED 106/108 ON TWO OF THE FIRST THREE RUNS OF THE UNMODIFIED TREE**, on *"week: the
picker sits flush under the bar"* (picker top 0 vs bar bottom 44) and the push check that reads from
it. It was the harness, measured rather than assumed: `data-hdr` flips to `collapsed` a frame before
the ResizeObserver rewrites `--stack-h`, so a read on the flip can still see the EXPANDED value, 0px.
A probe caught it 1 run in 8 (picker 0 / `--stack-h` 0px on the flip, 44 / 44 two frames later). The
read now waits on `stackSynced` — the condition `qa-shots.mjs` already used for the SECOND read for
exactly this reason — and three consecutive runs read 108/108. No assertion changed.

**THE PROMPT-84 TABLE WAS STALE BY TWO ROWS TOO, AND THAT GAP IS RECORDED RATHER THAN ERASED.** It read
`514 passed + 1 skipped` and `552` while the tree already sat at 515 + 1 and 560 — **prompt 80's
committed work moved both and only the geometry section below was updated.** It has already misled:
prompt 81's brief quoted 514 and 552 out of this table. Rule 30 says the correction lands in the same
commit as the work it misled, which is why it is here and not deferred to a later block.

**AND A STALE SOLE AUTHORITY IS WORSE THAN A SECOND COPY**, which is the thing worth remembering.
Prompt 66 deleted the duplicate from `CLAUDE.md` after it was wrong four times in a week, and that
was right — but the cost is that nobody diffs this table against anything any more, so nothing fails
when it drifts. The only defence left is writing it after the last gate run of every block, as this
line claims to do.

**The three movements, in order:**

| when | gate | from → to | what moved it |
|---|---|---|---|
| prompt 78 block B | `test:unit` | 537 → 552 | `web/test/livejoin.test.mjs` (15) |
| prompt 80 block B | `pytest` | 514 → **515** | the watch-link workflow guard in `tests/test_workflows.py` |
| prompt 80 block D1 | `test:unit` | 552 → **560** | the eight D1 ordering tests in `favorites.test.mjs` |
| prompt 82 block F | `test:unit` | 560 → **568** | `web/test/mlbdeeplink.test.mjs` (8) |
| prompt 82 block D2 | `test:unit` | 568 → **570** | **net +2, and THREE TESTS WERE REMOVED — see the accounting below** |
| prompt 82 block D2 | `qa-shots` | 91 → **94** | the favourite mark: the gold token, an unmarked card's border, zero layout cost, and the interleaving |
| prompt 83 block D2 | `qa-shots` | 94 → **96** | the off-service compose: both cues present, neither silently winning |
| prompt 83 block E | `pytest` | 515 → **521** | `TheDesktopBannerIsTranscribed` in `tests/test_banner_generator.py` (6) — the desktop banner had NO guard at all |
| prompt 84 | `qa-shots` | 96 → **108** | the banner READ OFF THE SERVED DOM, 6 checks × 2 breakpoints — the layer rule 24 says the other guards are not |
| prompt 86 block A | `pytest` | 521 → **527** | Sunday NFL Countdown in `tests/test_studio_shows.py` (6); two existing tests there were rewritten in place, not removed — the one that pinned Countdown INSIDE `_not_loaded`, and the anchor-rule test, which now requires prose and query to agree in both directions so a standalone show is representable |
| prompt 86 block B | `pytest` | 527 → **531** | `tests/test_scores.py`: the cfb whole-id branch pinned against a hyphenated id, no ESPN template a box-score page, and `ScoresWrite` (2) — the write has no state gate and keeps `coalesce`, and the call site passes one value per placeholder. The three ESPN template assertions were UPDATED in place to `/game/` |
| prompt 86 block B | `test:unit` | 570 → **582** | `web/test/gamelink.test.mjs` (12) runs the label rule. Four `livejoin.test.mjs` B2 tests were REWRITTEN IN PLACE, not removed — they pinned prompt 78's live-and-final gate, which Joe replaced |
| prompt 86 block C | `test:unit` | 582 → **593** | `web/test/stickytimes.test.mjs` (10) and the `--pick-h` test in `collapsedheader.test.mjs` (1). Two tests REWRITTEN IN PLACE — the scroll-listener guard and `split.test.mjs`'s second-picker guard; see the Block C section below |
| prompt 86 block C | `qa-shots` | 108 → **113** | the pinned time row, measured: axis top vs `--stack-h + --pick-h`, the noon gridline and the NOON label over the lanes' noon gridline after a 200px pan, M4 in the live DOM, and the day's last label on screen at full pan |

**QA-SHOTS' EXIT CODE WAS DECORATIVE UNTIL THIS COMMIT, AND EVERY `NODE EXIT=0` ABOVE IS AFFECTED.**
The runner ended in `process.exit(0)` unconditionally: a failing assertion went into
`assertions.json` and printed `FAILURES - n/m`, and the process still exited 0. So for that gate,
**rule 26's two deciders were one** — the parsed counts were the whole signal and the exit code
carried no information at all.

**No past result is invalidated.** 91/91, 94/94 and 96/96 were all read from the printed counts,
which were and are correct. What was wrong was the confidence attached to them: prompt 83 reported
`NODE EXIT=0` as if it corroborated 96/96, and it corroborated nothing. It is also exactly what let
`| tail -4` hide a `TimeoutError` in that same block — with no real exit code to lose, losing it to a
pipe cost nothing extra, and the mistake was invisible.

`process.exit(failed === 0 ? 0 : 1)` from prompt 84 onward, so the two deciders are two.

**D2 REMOVED A FEATURE AND ITS TESTS WENT WITH IT, SAID OUT LOUD** as the exception above requires.
`splitFavorites` was retired — nothing outside the tests imported it once the float was gone — and
the three tests that exercised it went too:

| removed from `favorites.test.mjs` | why it could not survive |
|---|---|
| *"the float PRESERVES chronological order inside both groups"* | there is no float and no split to preserve anything |
| *"no favourites on the day means no split and no label"* | there is no split and there was no label after prompt 59 |
| *"an empty favourites list leaves the listing untouched"* | replaced by *"an empty favourites list marks nothing"*, which is the same property against the mark |

**THE COVERAGE MOVED RATHER THAN DISAPPEARING**, which is the part that matters: the property those
three protected — a band reads as a timeline — is now pinned against `chronological()` in
`pageorder.test.mjs` (*"A BAND READS AS A TIMELINE"*) and in `favorites.test.mjs`'s D1 block. The
file-by-file arithmetic, measured rather than asserted:

| file | before | after | delta |
|---|---|---|---|
| `favbracket.test.mjs` | 6 | 9 | **+3** (rewritten against the mark) |
| `favorites.test.mjs` | 36 | 35 | **−1** (3 removed, 2 added) |
| `pageorder.test.mjs` | 8 | 8 | 0 (inverted in place) |
| `rhythm.test.mjs` | 7 | 7 | 0 (repointed at the surviving rule) |
| **net** | | | **+2** |

**BLOCK E ADDED A GUARD WHERE THERE HAD NEVER BEEN ONE.** `tests/test_banner_generator.py` has
pinned the MOBILE banner byte-for-byte since prompt 57, because a program writes that file and the
test can re-run it. `BannerDesktopV2.jsx` had nothing — no generator, no `--check`, and a header
telling the next reader to "regenerate from the JSON", which is a tool this repo does not contain
(rule 33). Block E had to hand-edit it, so the six new tests pin every value that gets transcribed:
the cutout filename, both gradient stop lists, the whole halo filter, the halo fill, the cap-height
arithmetic on BOTH breakpoints, and the header no longer claiming the generator. The 23 mark
coordinates are deliberately NOT pinned — they came out of prompt 42 and restating them here would
protect nothing.

Neither prompt-80 movement was written here at the time, and both are legitimate: a floor may only go
up, and nothing was removed or weakened. The other three gates are unchanged throughout.

### THE RECORD IS SPLIT, THE QUEUE IS FILED, THE STALE NOTES ARE CORRECTED (prompt 87 block A, 2026-09-10)

The goal was one sentence: **a fresh session should be able to start from the repo and the Project
alone.** What moved, and where to look now:

- **This file was split.** 159,569 bytes → **70KB** here and a new **`docs/handoff-archive.md`** for
  the closed histories, superseded sections and the prompt 46–84 run narratives. **Moved verbatim:**
  rebuilding the original from the two new files, using the archive's own per-block provenance
  comments, reproduces it byte for byte. Kept here: Repo state with both tables, every `### OPEN`
  item, the working rules, the "read this before…" operating notes, and prompts 84–87.
- **`docs/queue.md` is new** — real work that is understood and not started, each entry with its file
  and line, plus the **`.env` writer-credential contradiction written up as a decision for Joe**
  (rule 14 says there is none; `.env` has one, per `deployment-contract.md:142`; nothing was changed).
- **`docs/prompts/` is complete to 87**: 28 briefs filed from `Claude outputs\` (61–80, 82–87), byte-
  identical by sha256. 86 carries three revisions; its README says which ran.
- **The six superseded root specs moved to `docs/archive/`** with a README saying what each was.
- **Stale notes corrected in place:** the NFL-band pregame entry (closed, with the served order), the
  studio-show art count (zero, not three), the two grid-view OPEN entries (closed where they sit, in
  the archive), the MLB.TV tap test (proven from inside the PWA), and the counts in `CLAUDE.md`.
- **Step 0:** geometry's 2026-09-13 NFL span re-pinned 770.1 → 830.4 after Countdown loaded — exactly
  its 60 minutes, measured (see the geometry table below).

**FOUND WHILE CHECKING THE QUEUE, not in the brief:** Monday Night Football has the same refresh hole
as Thursday — `nfl-401872931` (Mon 9/14) had no stored link alongside Thursday's `nfl-401872657`,
because the nightly fetches only yesterday and the coming Sunday. Queue item 1 carries both.

### THE TIME ROW LOCKS UNDER THE PICKER (prompt 86 block C, Joe's Route A, 2026-09-10)

The phone grid's hour row now pins beneath the collapsed bar and picker on a downward scroll and
stays over its own columns at every pan and zoom. **Measured at 390×844, CFB 2026-09-05, scrollY
530, panned 200px:** axis top **92.39** = `--stack-h` 44 + `--pick-h` 48.39; the axis's noon
gridline **82.44** on the lanes' noon gridline **82.44**; the NOON label at **80.44**, which is its own
`translateX(-2px)` and nothing else. `mobile__axis-pinned.png` in each qa-shots run is the picture.

**THREE THINGS THE BRIEF DID NOT ANTICIPATE, ALL FOUND BY MEASUREMENT OR BY A GATE:**

- **`.mgrid`'s `overflow: hidden` was the same trap one level up.** `hidden` is a scroll container,
  so the hoisted sticky row pinned to `.mgrid` and never moved: forced back to `hidden`, the axis sat
  at **−306.22**, off the screen. It is `overflow: clip` now (with `hidden` as the fallback line).
- **The hoist cost the row its gestures.** qa-shots' *"the same pinch 60px lower"* landed on the new
  28px strip and did nothing. The pinch handlers now listen on the row too, and a one-finger swipe on
  the row pans the scroller (measured: a 170px swipe → scrollLeft 170, row and columns still aligned).
  No momentum on that one strip.
- **The hoist cost the last hour label its reach, and geometry's day-span stop caught it.** The
  last label's text overhangs the canvas edge (CFB "2AM" 26.56px, MLB "10PM" 13.17px) and that
  overhang had counted toward `scrollWidth` — 1273 → 1248 and 568 → 556 without it, and at full pan
  the label sat just off screen. An invisible, zero-height copy of the labels stays in the canvas as
  `.mgrid-axis-reach`; scrollWidth is back to 1273 / 568 / 1044 and **the spans were NOT re-pinned**.

**TWO EXISTING TESTS WERE REWRITTEN IN PLACE.** `collapsedheader.test.mjs` forbade any scroll listener
in `MobileGrid.js` — prompt 58's ruling was about the HEADER trigger, and Route A chose one passive
listener on the grid's own scroller, so exactly that one is now allowed and the page stays
listener-free. `split.test.mjs` forbade the word `pickrow` in `CollapsedHeader.js`; its message is
"must not render a second picker", and the header now MEASURES the picker, so it forbids rendering
one instead.

### A COWORK CORRECTION: THE STALE-RENDER FINDING READ A LABEL, NOT THE THING (prompt 84)

Prompt 84 opened by asserting Block E's render was stale, on the evidence that
`web/qa/p83final/mobile__today-all.png` was byte-identical to `web/qa/p83/`'s (sha256
`df1656e4f93d77b5`). **It was the wrong file.** `p83final` was written at **19:38:58**; the first
banner source edit landed at **19:54:38**. It is block **D2**'s run, and it is identical to `p83`
because at that moment the banner genuinely had not been touched — the correct result under a
misleading name.

**THE MTIME WAS IN COWORK'S OWN TOOL OUTPUT AND WENT UNCOMPARED** against the edit time. The run was
identified from a DIRECTORY NAME and an assertion count instead — which is reading a label rather
than checking the thing, the failure this repo has rules 30, 31, 33 and 34 about. The live artifact
said the opposite and was one `getpixel` away: the TV screen reads mean rgb(30, 30, 35) at a
per-pixel channel spread of **5.7**, against p83's rgb(127, 113, 116) at **103.0**.

**THE RECOMMENDATION UNDERNEATH IT WAS SOUND AND IS WHY THE BLOCK WAS WORTH RUNNING.** Every banner
guard really was Python reading JSX as text (rule 24), five gates really did go green with nothing
watching the served page, and the fix — `web/scripts/lib/bannerdom.mjs`, twelve runtime assertions,
and `probes/banner-mutation.mjs` breaking each one to prove it is a guard — exists because of it.
**But a right recommendation reached through a wrong measurement is still a wrong measurement**, and
the next one may not land as well.

**TWO THINGS CHANGED, NOT ONE.** The naming: a snapshot directory is named for the BLOCK from now
on, never the prompt — `p83final` holding a mid-prompt run is what made the mislabel available. And
the habit: an artifact's identity is settled by its mtime against the edit it is supposed to contain,
which is one comparison and was already on screen.

### THE BOX SCORE LINK IS WRITTEN WHILE THE GAME IS ON (prompt 78 block B2, Joe 2026-09-09)

> **SUPERSEDED 2026-09-10 BY PROMPT 86 BLOCK B — the section below is the record of why the gate
> existed, not the current behaviour.** Joe's new ruling: one link, one destination per sport, and
> the label follows the state — *Preview*, *Live box score*, *Box score*. The ESPN templates moved
> from `/boxscore/_/gameId/` to `/game/_/gameId/`, a page that is a preview before kickoff, so the
> "dead tap" that justified refusing scheduled games is gone and the state gate went with it;
> `coalesce` (never overwrite) and the UI's guard on a stored URL both stayed. The labels live in
> `web/lib/gamelink.js`. **Migration 0018 rewrote the stored old-form rows — APPLIED 2026-09-10
> 16:45 UTC on Joe's named approval** (rule 14): 99 rows (cfb 98, nfl 1) moved to `/game/`, 0 left
> in the old form, mlb's 138 untouched. The before/after counts are in the migration's header.
> Register §35c records the column's naming debt.

`pipeline/load.py`'s `case when … = 'final'` became `in ('final', 'in_progress')` — **widened, not
dropped**, because the gate's reason is Joe's ruling too: live and final, never scheduled, since a
box score for a game that has not started is a dead tap. `completed_at` is deliberately NOT widened;
it is the moment the game ended, and stamping `now()` on a live game would make it look finished.

Measured before the change: **0 of 790 scheduled CFB rows** carried a URL and 0 of 2,822 across the
unstarted leagues, against **203 of 203 finals** — so relaxing the UI gate alone would have rendered
a link that does nothing in exactly the window it was being added for. `GameDetail` now shows it for
both states, labelled **"Live box score"** and **"Box score"**, still guarded on the URL's presence:
rows that were in progress before this loader change have none until the next refresh writes one.

**Deriving the URL in JS was rejected** — it would put the same per-sport mapping in two languages
that must agree. `load.py`'s `_BOXSCORE` stays its one owner, and a test forbids those URL shapes
appearing in the JS. **Only a matchup can ever have one**: `programs` has no such column, so all
4,230 programs are outside it by construction. The three MLB rows that reverted from final to
scheduled and kept a URL are stale data, left alone.

**Prompt 77's floors, for the record:** `test:unit`
is 518 → **537**: prompt 77 added `web/test/livepoll.test.mjs` (19). One existing test was CORRECTED
rather than added to — `myteamsonce.test.mjs` pinned `flatLabel = null }) {`, which also required
`flatLabel` to be the LAST parameter of `Listing`, so it failed the moment a prop was added beside
it on a change that had nothing to do with what it tests. It now asserts the DEFAULT, which is the
property it was written for. The other four gates are unchanged.

**PROMPTS 75 AND 76 ARE NOT IN THIS REPOSITORY.** Prompt 77's brief said they would have moved these
floors; `git log` at the time of the run showed HEAD at `392d08b`, prompt 74's commit, with
`origin/main == HEAD` and a clean tree. The floors below were prompt 74's and were read from THIS
file, not carried in from the brief — which is the whole reason rule 10 puts them here.

**The 2026-09-09 prompt-74 measurement, for the record:** `test:unit`
is 494 → **518**, and every one of the 24 is accounted for: prompt 73 added
`web/test/bannerpin.test.mjs`, prompt 74 moved three of its clearance tests into
`autoscroll.test.mjs` and added five more there, and added `web/test/region.test.mjs` (9) for the
anchor helper. Two existing tests were REWRITTEN IN PLACE rather than added to — the one prompt 73
found passing vacuously and the compensation-ordering one prompt 74 found in the same shape.
Nothing was removed and no test was weakened. The other four gates are unchanged.

| gate | run from | floor |
|---|---|---|
| `pytest` | repo root | **531 passed + 1 skipped** (36 subtests) |
| `npm run test:unit` | `web/` | **593** |
| `npm run smoke` | `web/` | **33/33** |
| `node scripts/qa-shots.mjs` | `web/` | **113/113** |
| `npm run geometry` | `web/` | all hard stops |

They are a floor and may only go up — **with the one exception that a removed feature takes its
tests with it, and that has to be said out loud each time it happens.**

**`test:unit` DIPPED TO 449 MID-RUN AND CAME BACK TO 470, and both halves are accounted for.**
Prompt 67 removed the TONIGHT band, which made `web/lib/bandstate.js` unreferenced;
`web/test/bandstate.test.mjs` held exactly 25 tests of that module and went with it, 474 → 449. Its
stages 2 and 3 then added 21: `autoscroll.test.mjs` (11) and `weekrange.test.mjs` (10). No test was
weakened or deleted to make a gate pass, and the ones that pinned the band's RENDER were inverted
rather than removed, so a band coming back fails a gate.

**AND THE 473 IN THIS TABLE BEFORE THIS EDIT WAS WRONG — it was 474.** Prompt 66 wrote its own floors
here mid-run, before its last test additions landed, in the very commit whose point was that a number
kept in two places drifts. One place is necessary and not sufficient: the number still has to be
written after the last gate run, not during.

### CLOSED (was OPEN) — AN NFL BAND STILL LISTS ITS PREGAME SHOW AFTER THE GAME

> **CLOSED — checked against the served page by prompt 87, 2026-09-10, not inferred from the code.**
> Prompt 71 stage 3 put ALL GAMES through the same `chronological()` MY TEAMS uses
> (`web/app/page.js:561`, citing Joe's 2026-09-08 ruling), with a studio show first on an equal
> start (`web/lib/favorites.js:206-211`). The case this entry describes is now live — Sunday NFL
> Countdown is a Sunday NFL pregame show — so it was measured: `/?day=2026-09-13`, ALL GAMES, list,
> the NFL band reads **10:00 Sunday NFL Countdown, 11:00 FOX NFL Kickoff, 12:00 FOX NFL Sunday,
> 12:00 The NFL Today, then the 1:00 PM games**. The text below is the record of the question.

Found while fixing MY TEAMS and deliberately **not** fixed, because it changes ALL GAMES. `allRows`
is unsorted for every scope; under ALL GAMES the sport bands regroup it, so within one band a
program can still follow a game it precedes. Sorting `allRows` outright would reorder ALL GAMES
without being asked. It is a small, real question for a later prompt.

### OPEN — THE STREAMING TAP TEST IS STILL OWED

`docs/research/universal-links-aasa-2026-09-07.md` holds what 23 services publicly claim.
**`www.espn.com` claims `/*/game/_/gameId/*`** and the database already holds those ids — but there
is **no general `/watch` claim**, so the declared route opens the app on the game rather than on a
stream. Next: which patterns MySports can populate, then a tap on the phone.

**Easier than when this was written (prompt 87):** on 2026-09-10 Joe tapped the MLB.TV link from
inside the installed app and the MLB app opened, so a `target="_blank"` link from the PWA DOES hand off
to a claimed app (`docs/research/mlb-tv-tap-test.md`). `docs/queue.md` item 2 carries this forward.

### OPEN — THE STREAMING FEATURE IS AT THE EVIDENCE-GATHERED STAGE

`docs/research/universal-links-aasa-2026-09-07.md` holds what 23 services publicly claim; the bodies
are at `artifacts/aasa/` (gitignored). **`www.espn.com` claims `/*/game/_/gameId/*`** and the database
already holds those ids — but there is **no general `/watch` claim**, so the declared route opens the
app on the game rather than on a stream. Next: which patterns MySports can populate, then a tap test.

### THE VERTICAL SCALE BELOW THE PICKER — read this before changing any spacing in globals.css

| role | value |
|---|---|
| card → card, and anything inside one group | **8px** |
| a heading → the content it labels | **16px** |
| one section → the next section | **24px** |

**THREE HARD RULES.** (1) **No rendered gap may grow** — a pair already below its target keeps what
it has and is reported. (2) **Nothing inside a list card or a grid block changes** — the card
contract is locked and the grid's internal geometry is frozen by the tripwire. (3) **The control
stack is out of scope** — prompt 51 tuned it; the scale starts BELOW the picker.

**MEASURE RENDERED, NEVER DECLARED, AND INK TO INK.** `.listing` is a flex column with no `gap`, so
nothing collapses out of it while adjacent block margins elsewhere do; and a box-to-box gap hides a
margin living INSIDE one of the boxes, which is where the day heading's clearance sits. The scale and
the three rules are also written into `globals.css` above the band rules, so the file carries them.

Ink to ink at 390, before → after: **last card → next day heading 61 → 24**; **last content → the
count line 44 → 18**; band → band 26 → 24; the favourites rule 14 → 8 both sides; count line →
provenance 34 → 24; provenance → footnote 34 → 24; picker → first day heading (week) 29 → 24; scope
line → content (week) 37 → 16. Page heights fell in all eight views (18512 → 18111 on the heaviest).

**Held by hard rule 1 and NOT changed:** band header → cards 8, day heading → its content 6, first
band → the list 22, first band head → its body 13, last content → count line 18, picker → first
content 8 / 22 / 24 by view. **One stated exception:** Day · My Teams · Grid, scope line → grid is
30 — the caption's 16 plus the grid panel's own 14, which is also what makes Day · All · Grid's
picker → grid 22px.

**The geometry tripwire did not move at all** — block counts, lane counts, row counts, widths,
`scrollWidth` and all three ratios identical.

### THE GEOMETRY CHECK REPLACED THE TRIPWIRE — read this before hunting a regression

**`npm run geometry`** from `web/`. The absolute pixel figures are NO LONGER a hard stop, because
prompt 53 measured the MLB baseline moving with no code change at all: every block width and
`scrollWidth` derive from `widest`, the widest rendered team line, which carries the RECORD and the
CFB POLL RANK. Both drift all season.

**Hard stop:** block count per network row, lane count per row, network-row count, painted ==
laid-out width at zoom 0.6/1.0/2.5, rail delta 0.0px at every zoom, the 46px block floor, no wrapped
or truncated team name, and **day/week equality**.

**Reported:** widths and `scrollWidth`, with `widest` and the ratio beside them.
`.mgrid-canvas` carries `data-widest`, `data-pxpermin`, `data-day`.

> **`widest` moved and `scrollWidth / widest` held → the standings.
> The RATIO moved → CODE, and that is the stop.**

**THE RATIO RULE ABOVE IS WRONG AND PROMPT 66 REPLACED IT.** `pxPerMinute = (widest + 2*CAP +
NAME_PAD) / blockMinutes` (`gridmodel.js:46`), i.e. `(widest + 182)/blockMinutes`, so `scrollWidth`
scales with **`widest + 182`** and `scrollWidth / widest` moves whenever `widest` moves — on pure
standings drift, with no code involved. Use **`scrollWidth / (widest + 182)`**, or equivalently
`scrollWidth / data-pxpermin`, which is the minutes the day spans.

### THE TRIPWIRE IS THE DAY'S SPAN NOW, NOT THE WIDTHS (prompt 80)

**MLB DRIFTED A SECOND TIME AND FOR THE SAME REASON**, which is what settled this. On 2026-09-09 it
went **{228}/567/widest 86.508 → {229}/569/widest 87.084** because `schedule_refresh` ran at 14:55Z
in the middle of a session and loaded standings — `widest` is measured off the rendered team line
INCLUDING the record, so a club gaining a digit moves every width on the slate. Hard stops held: 3
blocks, 2 network rows. **The paragraph below already recorded the first instance in the same words.**

**A TRIPWIRE THAT CRIES WOLF IS WORSE THAN NO TRIPWIRE, and this session paid for exactly that.**
Prompt 74 measured `qa-shots` at 8/9 on both trees and recorded it as the known flake; three prompts
later that was false, and prompt 78's genuine regression landed in the bucket the recorded flake had
dug. A figure that moves whenever a team's record gains a digit trains the reader to wave it through.

**SO THE ASSERTED FIGURE IS NOW THE DAY'S SPAN IN MINUTES**, and `geometry.mjs` hard-stops on it:

> `pxPerMinute = (widest + 2·CAP + NAME_PAD) / blockMinutes(sport)` (gridmodel.js:46-48) and
> `scrollWidth = rail + pxPerMinute × spanMinutes`, so **`(scrollWidth − rail) / pxPerMinute`** is the
> span and every `widest` term cancels.

**Measured across the actual drift, which is the only reason to believe it:** MLB 2026-09-03 went
**393.04 → 393.75 minutes** across the standings load that moved the raw figure by two pixels. The
residue is `scrollWidth` being an integer, not the span changing. **`sw/(widest+182)` was the
candidate this file named and it is not good enough** — it moved 0.14% over the same drift, for the
same rounding reason, and it has no physical meaning to reason about when it does move. Tolerance is
**2 minutes**, about three times the observed residue and far below what any code change does. A
genuine schedule change moves it too, and that is correct: a game rescheduled at either end of the
day really does change how much time the grid spans.

| day | sport | **span (minutes, ASSERTED ±2)** | blocks | rows |
|---|---|---|---|---|
| `2026-09-05` | cfb | **1042.4** | 64 | 15 |
| `2026-09-03` | mlb | **393.4** | 3 | 2 |
| `2026-09-13` | nfl | ~~770.1~~ **830.4** | ~~17~~ 18 | ~~3~~ 4 |

**THE NFL ROW MOVED ON 2026-09-10 AND IT WAS THE DATA, PROVED (prompt 87 step 0).** The 2026-09-10
refresh loaded Sunday NFL Countdown (10:00–13:00 ET, ESPN), so the day starts at 10:00 instead of
FOX NFL Kickoff's 11:00. Gate reading 770.11 → **830.38**; off the canvas's fractional width it is
770.0 → **829.998**, exactly the 60 minutes Countdown adds at the front, the +0.27 being scrollWidth
rounding 1120.516 up to 1121. First axis label 11AM → 10AM, last still 11PM; the one new row is ESPN,
the one new block Countdown; day/week equality held (18/18 blocks, 4/4 rows). Re-pinned in
`web/scripts/geometry.mjs` to the measured 830.4. The reported table below is prompt 80's and is
left as its record.

**Re-baselined 2026-09-09, prompt 80 — REPORTED, not asserted, and expected to drift:**

| day | sport | blocks | rows | widths | `widest` | scrollWidth | sw/(widest+182) |
|---|---|---|---|---|---|---|---|
| `2026-09-05` | cfb | 64 | 15 | {240, 223, 205, 136} | 98.760 | 1273 | 4.5341 |
| `2026-09-03` | mlb | 3 | 2 | **{229}** | **87.084** | **569** | **2.1146** |
| `2026-09-13` | nfl | 17 | 3 | {264, 98, 73} | 122.724 | 1044 | 3.4261 |

**The block and network-row counts are unchanged and remain hard stops.** They are code-derived and
no amount of standings drift touches them.

**The 2026-09-08 measurement at `201ed07`, kept as the first instance of the same mechanism:**

| day | sport | blocks | rows | widths | `widest` | scrollWidth | sw/(widest+182) |
|---|---|---|---|---|---|---|---|
| `2026-09-05` | cfb | 64 | 15 | {240, 223, 205, 136} | 98.760 | 1273 | 4.5341 |
| `2026-09-03` | mlb | 3 | 2 | {228} | 86.508 | 567 | 2.1117 |
| `2026-09-13` | nfl | 17 | 3 | {264, 98, 73} | 122.724 | 1044 | 3.4261 |

**MLB is re-baselined from {226}/564/widest 84.65, and the move was DATA.** Prompt 66 looked for the
commit and there is none: between `f7fe047` and `7d9938e`, `MobileGrid.js`, `gridmodel.js` and
`cardGeometry.js` are byte-identical, no grid selector or `--rail-w` changed in `globals.css`, and
`geometry.mjs`'s MLB case is untouched (`4a301fb` changed only the CFB and NFL week keys). The one
`format.js` change (`cec928b`) is the listings card's row 2 and never reaches the grid's `widest`.
The arithmetic closes it: scaling by `(86.508+182)/(84.648+182) = 1.006975` predicts block width
227.58 → **228 observed** and `scrollWidth` 567.93 → **567 observed**. Records drifted; that is all.

The `--rail-w` derived check stays a hard stop: change it by N, `scrollWidth` moves by exactly N.

**PROMPT 53 — the hub's display architecture corrected, and the studio logos.** Nine commits, from
`61469b6`:

| stage | commit | what shipped |
|---|---|---|
| 1 | `08be11a` | the archive is 54 files; **working rule 30** |
| 2 | `022b02b` | a season week shows its own sport's programs |
| 3 | `a1baa78` | GRID VIEW shows a grid and nothing else |
| 4 | `2aa07fb` | a week says why a chip is empty, and where its scores came from |
| 5 | `6bfbe4e` | an all-sports week separates its sports |
| 6 | `3e0451b` | MY TEAMS does not label every row as yours |
| 7 | `fdce95d` | four studio-show marks — **all 18 brands now have art** |
| 8 | `19a2f83` | the program logo renders first, the title only when it fits |
| 9 | *(this commit)* | register §21, this file, the prompt filed |

**Read `docs/enhancement-register.md` §21** before touching the hub's display logic. Six of the ten
stages fixed things that were WRONG rather than adding anything, and two had shipped since prompt 50.

## DEPLOYED

**https://my-sports-xi.vercel.app** — Vercel project `my-sports`, team `mindlane-northstar` (Pro),
Root Directory `web`. **Leave Vercel Authentication on Standard Protection.** Do not buy Advanced
Deployment Protection. Every push to `main` is the production deploy.

**Akamai does not block Vercel** (probe from `iad1`, four 200s). The 403 is specific to the Cowork
cloud workspace. **Never reapply a bare browser UA.**

## What works now

- **Data spine:** 29-table `mysports` schema (migrations through `0011_division_seed.sql`); adapters
  cfbd / espn-nfl / nhl / nba / mlb; reconciliation; standings for 4 leagues; MLB probables.
- **A FULL 2026 CFB + NFL REGULAR SEASON IS LOADED.** `games` ≈1,379. CFB 14 weeks (week 14 absent,
  week 15 holds 1 game — that is what CFBD returns for `season-type=regular`; **not a load failure**).
  NFL 18 weeks complete. `mlb` 153 / `nba` 19 / `nhl` 47 are date-driven and therefore **partial** —
  see Open. `bootstrap_season.yml` is manual-dispatch only; `schedule_refresh.yml` is scoped to the
  current CFB week and the coming NFL Sunday.
- **Live scores, read-only:** `web/lib/livescores.js` — state/score/clock/period on render, 60 s
  cache, fails open, never writes. Stale-LIVE guard at 8 h (`isStaleLive`, `format.js`).
- **Overlap rule** (contract v1.6.5, Addendum M14 v1.1) in **both** renderers, pinned by nine shared
  fixtures at `tests/fixtures/overlap_cases.json`.
- **Chrome:** one masthead on every route — the full banner (`BannerMobileV2` / `BannerDesktopV2`,
  coordinates baked in; the v2 JSON files are documentation and are imported by nothing) plus the
  `.homenav` tab row. `.banner` carries the app's ONLY top safe-area inset, +4 px when installed.
- **Pickers:** a drawn face over an invisible native control, so iOS keeps its wheel and calendar.
- **Off-service (D4/E3)** from `mysports.viewer_game_eligibility`, never recomputed in JS.
  **Favorites (D6):** `data/favorites.json`, 13 teams. **Market-pending (E5)** in
  `pipeline/reconcile.py`; the rule is `access_status = 'unverified'`.
- ~~**Per-sport bands:** every band reports its counts (`4250aa9` — do not regress).~~
  **RETIRED 2026-09-06 by prompt 50 stage 4.** A single page-level count line at the FOOT of the page
  superseded it — `68 games on your services · 2 TBD` plus the reveal. There is no per-band count any
  more, so there is nothing left to regress. 05 §14 records the supersession.
- **Navigation:** `web/lib/routes.js` is still the single route-list definition, and since prompt 50
  it holds **one** route: the app is the Schedule Hub at `/` and its whole state is the query string.

## The hub's open items (prompt 50)

- ~~**R4 IS HALF BUILT.**~~ **CLOSED** by prompt 51 stage 4a (`a2eb11c`): the page-level section is
  retired and D6's in-band float is back at band level, card untouched.
- ~~**`scope=mine` SHOWS NO PROGRAMS.**~~ **CLOSED** by prompt 51 stage 4b: `isMine()` adds the sport
  rule and the five team-less sports are in scope — 196 rows the scope had been hiding.
- ~~**ONE GAP IN THE CONTROL STACK IS NOT 8px, PENDING JOE.**~~ **CLOSED** by prompt 52 stage 2:
  Joe confirmed `ALL SPORTS` → tiles stays 6px as the named exception. All six gaps re-measured at
  360/390/430/1440 and reported above; nothing needed building.
- **THE CONTROL STACK'S RHYTHM MAY STILL READ UNEVEN, AND IT IS A ROW-HEIGHT QUESTION.** The gaps
  are uniform but the rows are 33 / 33 / 24 / 44 / 44px, and the eye measures ink to ink. Prompt 52
  stage 2 deliberately did NOT adjust gaps to compensate for a height problem. **Needs Joe's ruling
  before anything moves.**
- **The AEW band renders its title lowercase, "aew".** `Listing` does `SPORT_LABEL[s] || s` and
  `config.js` has no `SPORT_LABEL` entry for aew, so it falls back to the raw enum value. It predates
  prompt 51 but MY TEAMS makes it far more visible. A one-line fix, deliberately not taken unasked.
- **The `· N TBD` segment on the count line is Cowork's call**, flagged for Joe's veto — his
  renderings show one segment. Without it the line undercounts what is on screen by a factor of six
  on 2026-11-14.
- **Grouping the revealed games by sport is Cowork's call** too; one flat chronological list is the
  alternative and is a two-line change.
- **The restack COSTS vertical space, it does not save it.** Measured at 390: the first content row
  moved from 367.0px to 406.2px, +39.2px, because two 46px toggle rows were added where a 45.3px tab
  row and a 43.5px heading row came out. On the installed app the banner nudge takes 8 of that back.
  The audit's §F2 question — how much of an 844px phone a viewport-owning grid gets — moves the wrong
  way by this.
- **`.mgrid-note` and the page count line say the same number in different words** on a
  network-TBD day: "58 games not on the grid · network TBD" and "· 58 TBD". Not contradictory,
  but duplicated.
- **The grid footer's `N on the grid` and the page line's `N games on your services` disagree on
  market-pending days** — 17 against 6 on NFL 2026-09-13 — because a market-pending game takes a lane
  but is not on a confirmed service. Both true, different questions, and 8,539px apart on screen so
  they are never read together. Joe's call whether that matters.
- **`countParts()` and `countSummary()` have no app caller** since stage 4. Retained deliberately:
  ~15 assertions pin the four-state vocabulary through them, and `countLines()` is still called by
  `offServiceSummary` itself.
- **D1's first band can say "Nothing loaded for this viewing day yet" above a full slate** — seen on
  NFL 2026-09-13 and MLB 2026-09-03, where the band's window finds nothing while the sport bands
  below render every game. Pre-dates the hub; unchanged by it.

## THE ART LOOKED STALE AND NOTHING WAS BROKEN — read this first (prompt 66)

**If you ship art and the phone keeps painting the old one, it is the HTTP cache. Five minutes, not
an hour.** That hour was spent on 2026-09-08 after `9a69810`: the bytes in R2 were correct, the same
URL in Safari showed the new art, and the installed home-screen app kept the old one until Joe
re-added it. The art, the contrast, the render scale and the CDN were all ruled out first.

**There is no service worker.** No `serviceWorker.register`, no workbox, no `sw.js` anywhere in
`web/` — nothing in the app was caching anything. `scripts/sync_assets.py` uploaded with
`ExtraArgs={"ContentType": ...}` and nothing else, so every object in the bucket answered with **no
`Cache-Control` at all**, and a response with no policy lets the browser pick its own HEURISTIC
freshness — commonly a fraction of the object's age, which for a file that has sat there for days is
hours or days. `teamLogoDarkUrl()` (`web/lib/config.js:156`) is a bare path that never changes when
the art does, so nothing ever told a client to look again.

**Fixed in prompt 66:** uploads now carry `Cache-Control: public, max-age=300`, set in ONE place
(`sync_assets.py:_extra_args`) because the two call sites had been duplicating the args, which is how
both came to be missing it. Five minutes of free reuse, then a conditional request that costs a 304
on a small PNG. `stale-while-revalidate` was considered and rejected: it lets a client serve the
STALE copy while refetching, so the first load after a change still paints the old art — the exact
symptom, just shorter. Append `, stale-while-revalidate=604800` if request count ever matters more.

**CLOSED FOR `logos/` ON 2026-09-08 (prompt 67 stage 4a). All 1,532 objects carry the policy** —
verified by `head_object` on a random sample of 25 and on `logos/mlb-114.png`, which read
`CacheControl=None` before and reads `public, max-age=300` after.

A `--push` compares size and sha256 and SKIPS anything unchanged, so an object already in the bucket
keeps the headers it was written with and prompt 66's fix had reached only the 387 whose art changed
that day. **`--force` was added for exactly this** (`scripts/sync_assets.py`): it pushes every local
file under `--prefix` even where the bytes match, which is the only way to set a header on an object
that already exists. Verify with `head_object`, not by looking at the image.

**`fonts/` CLOSED TOO (prompt 68): 5 objects re-uploaded**, `CacheControl` `None` →
`public, max-age=300`, verified on all five.

**`network-logos/` AND `brand/` CLOSED BY PROMPT 69 with a new `--existing-only` flag** — the one
prompt 68 proposed. It never creates an object: a local file the bucket does not have is skipped
rather than uploaded, so the local cache decides only WHICH bytes get rewritten and never what the
bucket contains. `network-logos/` 31 rewritten / 9 skipped, `brand/` 9 rewritten / 12 skipped, both
verified 31/31 and 9/9 afterwards, and **nothing named `-retired` or `-rejected` is in the bucket.**

**THE OTHER THREE ARE NOT A ONE-COMMAND JOB, and that is why they are still open.** Running
`--force` over them would do more than rewrite headers:

| prefix | in bucket | local | `--force` would ALSO publish |
|---|---|---|---|
| `network-logos/` | 31 | 40 | **9 new objects** — incl. `hbo-max-wide-2023-retired.svg` |
| `brand/` | 9 | 21 | **12 new objects** — incl. `app-icon-mysports-tv-v5-retired.png`, `…-v6a-rejected.png` |
| `grids/` | 35 | **0** | nothing — neither `--force` nor `--existing-only` can reach it |

The first two would push RETIRED and REJECTED art into a public bucket, which is a publish and not a
header fix. `grids/` cannot be reached because `sync_assets.local_files()` walks
`FOLDERS = ("logos", "network-logos", "fonts", "brand")` and grid objects arrive by `--push-grids`
from `artifacts/rendering`, which is not a local cache directory.

**ALL THREE ARE CLOSED, AND SO IS THE WHOLE BUCKET (prompt 70).** `grids/`: 35 seen, 34 rewritten,
1 already correct, **35 objects before and 35 after**. Every prefix re-run as a verification pass and
all reported 0 rewritten. **The public bucket is 1,613 objects and every one carries
`public, max-age=300`** — checked one `head_object` at a time, not sampled.

**NEITHER ROUTE PROMPT 69 NAMED WOULD HAVE DONE IT, and only one of them was a dead end.** Widening
`FOLDERS` is: `local_files()` walks `assets/{folder}` and there is no `assets/grids/`. But
`--push-grids artifacts/rendering` was NOT — that directory holds 13 grid files here, and all 13 keys
already exist in the bucket. It would have fixed **13 of 35** and left 22, and it is an upload path,
so a stray file under the directory it is pointed at becomes a published object.

**`--recache` is what closed it.** It reads no local file: it lists the bucket under a prefix and
rewrites `Cache-Control` in place on the keys `list_objects_v2` just returned. Creating an object is
not something it declines to do — it has no expression for it, which is a stronger guarantee than
`--existing-only`'s skipping. `copy_object` onto the same key with `MetadataDirective="REPLACE"`,
**verified against R2 before it was built** (rule 34): Cloudflare's S3 page lists
`x-amz-metadata-directive` and `Cache-Control` as implemented, and one real call on
`grids/cfb/grid_2026-08-29.svg` confirmed it — header set, ContentType and the `sha256` metadata
preserved, ETag and byte count unmoved, so no data transfer. `REPLACE` replaces metadata wholesale,
so both are read first and passed back; dropping the `sha256` would make the next `--push` see the
whole bucket as changed.

**Deliberately NOT done, and both are bigger decisions:** a service worker, and cache-busting query
strings or content-addressed filenames. The second is the real fix for "the URL never changes when
the art does" and is worth a prompt of its own.

## Opened by prompt 52

- **FOUR CALLS OPEN TO JOE'S VETO**, all recorded in register §19 with their measurements:
  the **banner wordmark recoloured** (§19c — the app's signature element); **LIVE kept GREEN**
  (§19e — `--alert` already means "you cannot watch this", so a red LIVE would collide with it);
  **the card gradient kept** against the rendering's flat `#2A2A2A` (§19f — prompt 25 measured the
  contrast ramp against both ends of it); and **the gold sites that carry information rather than
  selection** (§19i — FINAL, the grid's hour axis, the day-column times, the market-pending labels).
- **ESPN2 IS THE ONE MARK THAT CANNOT REACH THE RAIL'S 600px² TARGET** (9.9px tall). Its brand IS a
  wide wordmark and no compact lockup exists; the `52/a` term binds above aspect 4.51. If a stacked
  ESPN2 ever appears, dropping it in closes the last mark **with no code change**.
- ~~**THREE STUDIO SHOWS STILL HAVE NO ART:** `foxnflkickoff` (the only findable art is the generic
  Fox Sports wordmark — the NETWORK, not the show), `tnfpregame` and `netflixpregame` (no distinct
  branding, and zero loaded rows). Their typographic fallback renders and is tested.~~
  **CLOSED — ZERO, NOT THREE (checked prompt 87, 2026-09-10).** All three got art on 2026-09-06,
  supplied by Joe and built through `scripts/build_brand_marks.py`: `data/brands.json` gives each a
  `mark_dark` and the files are on disk — `fox-nfl-kickoff.png` 11,987 bytes, `tnf-pregame.png`
  19,364, `netflix-gameday.png` 21,414 — and all ten program marks are in
  `web/public/programs/manifest.json`. `tnfpregame` and `netflixpregame` still have no loaded rows;
  that is register §7 Q4's `_not_loaded`, not missing art.
- **`fox-nfl-sunday` IS A RETIRED LOCKUP**, shipped and flagged per the sourcing rules. If Joe wants
  the current Fox branding it is a one-file swap plus a rebuild.
- **`fnia` HAS ART BUT KEEPS ITS PROVISIONAL COLOUR.** After the dark-context lift only 1.3% of its
  pixels are saturated, and they are the NBC peacock — multicolour by design. There is no single hue
  to derive and picking one arm of a peacock would be an invented fact.
- **PRE-EXISTING DRIFT IN THE PROGRAM MARKS, found not caused.** The published program PNGs already
  disagreed with their own manifest: `big-noon` ink area re-measures at 10609 against the recorded
  10085 (5.2%), `college-gameday` 7975 against 7947. Any rebuild was always going to move those.
- **`--gold-dim` IS BELOW AA FOR TEXT ON TWO GROUNDS** — 3.49:1 on `--panel`, 2.79:1 on
  `--panel-top`. Pre-existing (it was 3.37 and 2.70) and improved by the new value, not caused by it.
  Its three sites are small metadata labels.
- **`--hairline` HAS ZERO CONSUMERS.** A dead token, found during the §9 border audit. Left in place;
  removing it is a tidy-up nobody asked for.
- ~~**PROMPTS 50 AND 51 WERE NEVER FILED** in `docs/prompts/`. Found at stage 8. They could not be
  reconstructed from here and no placeholder was written.~~ **CLOSED by `cdfae84`, and the entry
  was wrong twice over:** both briefs had been sitting in `Claude outputs\` the whole time, and
  the README paragraph prompt 52 was reading named prompt 50's path. Filing them was a copy, not
  a reconstruction. **Working rule 30 exists because of this.**

## THE HEADLINE OPEN ITEM — the announcement horizon

**~529 of ~1,379 games have zero `game_broadcasts` rows.** Ruled in
`05-home-page-decisions.md` **§9 — NETWORK TBD is a fourth state**, always shown, never filtered,
counted on its own line, mutually exclusive with market-pending. Implemented in prompt 24. Read §9
before touching any count line.

## Open

- ~~Rendering-contract v1.7~~ **SHIPPED** in prompt 48 stage 2 (`376ef36`) — the program card on both
  grids, the list-card variant, the now marker, studio bookends, and the `open_ended` ↔
  `render_policies` reconciliation, all in one change. The gate it held is open: studio shows,
  WWE, AEW, UFC, IndyCar and NASCAR all render.
- **506sports NFL maps → `market_coverage_nfl`** (~Sept 8–9). Resolves E5's market-pending games; on
  the critical path for September 13.
- **NHL and NBA hold only date-driven partial seasons** (47 and 19 games). `nba-BOS`, `nba-PHX`,
  `nba-POR` have art and no games for that reason. A one-time bootstrap is the fix.
- **NHL/NBA `team_records` are season 2025 by design** (prompt 37); their cards show thin standings
  until a 2026-27 standings load exists.
- **NFL/NBA adapters do not carry a conference.**
- **The list card's abbreviation step is not implemented** — the grid's fourth concession. Its one
  residual at 390 px is *UT Rio Grande Valley*, 24.57 px short with the record already dropped.
- **The list card re-tiers on cold load** (v1.6.13, known and accepted): the tier settles when the
  webfont resolves, so the first paint uses the character-count size.
- **The 500–699 px band** stretches the phone stage to 253 px — one breakpoint at 700. Options: cap
  `.bn-mobile` at ~480 px centred on the stage ground, or move the breakpoint to the 560 px the card
  uses. Not ruled.
- **The banner glow ellipses' 0.021 / 0.028 outer stops** leave a 3.4/255 edge at stage y=−20, beside
  the clock. It is an ARTWORK fix, not CSS — fading the stops to zero repaints 10.6 % of the visible
  stage by up to 6/255 (measured, prompt 45).
- **1D's gold sport-week heading line and 1F's `--ink` venue token are Cowork's calls, open to veto.**
- **The venue now shares the team names' token** and is separated from them by size alone (12 px vs
  14 px). If that reads too bright on the device the fix is a new palette step, not a weight.
- **HELD FOR JOE — twelve MLB rows stuck at `in_progress`** (kickoffs 2026-09-01/02). The DISPLAY
  guard shipped; the backfill is a database write and was deliberately not made.
- **A pipeline logic gap behind those rows:** `schedule_refresh` failed three times on 2026-09-02 with
  `FileNotFoundError: artifacts/validation/mlb_2026_teams.json`; something wrote `completed_at` on all
  twelve without setting `result_status='final'`.
- ~~**TBS has no mark and it is a LIVE gap** — 2 loaded `game_broadcasts` rows, no art in
  `assets/network-logos/`. Sourcing it is Cowork's job.~~ **CLOSED by prompt 55 stage 2** (`b3afe16`),
  along with NFL Network, truTV and ACCNX.
- **ESPN3 IS THE ONLY ACCESS-PROFILE NETWORK WITHOUT A MARK** — 32 of 33 are covered. Its supplied
  art carries a **"clearpng" watermark baked over the letterforms**, which `key_neutral`'s flood
  cannot reach: the watermark touches no border and where it crosses the red it is not neutral.
  **Do not re-source it blind** — the rejection and the reason are register §23c. The typographic
  fallback is better than bad art.
- **`unverified` is load-bearing semantics** — now documented in `data/authority_rules.json` `_about`
  and `adapters/README.md`.
- **The privacy gate before the Cavs season (late October):** production is a public URL. Confirm no
  loaded broadcast row publishes the unannounced WUAB/RESN arrangement.
- **CBJ watch escalation ~Sept 15** (ask first). **IndyCar**: 2027 schedule, October.
- **The unruled backlog:** E8, E9, E11, E12, E13, E15.
- ~~The enhancement register §1–§13 are still project-only.~~ **CLOSED** — §1–§17 are in the repo.
- **The design builders are project-only** — `build_demo.py`, `app_template.html`, `build_banner.py`,
  `markkit.py`. `docs/design/mobile_demo.html` is a TEMPLATE (`__DATA__`, `__GRIDSVG__`, …), so the
  repo copy cannot be rebuilt from the repo. A filing item, not a defect.
- **`--faint` reaches 3.63:1 on the card top and true AA is unreachable there.** Joe's call, accepted.
  **Not a defect to re-raise.**

## Working rules (binding)

1. Certify Python for Windows.
2. Never write to the repo while a Claude Code prompt is in flight.
3. Secret gate every commit, ADDED lines only, with `grep`; never `findstr`.
4. Stage by explicit path; never `git add -A`.
5. Run-workflow-never-Re-run.
6. DB: additive over destructive; SELECT-and-paste first; close (`valid_to`), don't delete.
7. Unattended runs: self-committing stages, 2-strikes-skip, hard stops only for secret-gate /
   destructive-DB / push-reject.
8. WUAB/RESN sources never named.
9. Loader-written provider facts never become reconciled observations.
10. Check the register §7–§13, the home-page decision record, and this file before re-raising any
    settled decision.
11. Cowork's bridge shell calls git with `--no-optional-locks`.
12. **`next build` cannot run locally** — Next interpolates the absolute path into a single-quoted JS
    string and this repo lives under `Joe's Projects`. Fires only for `app/apple-icon.png`,
    `app/icon.png`, `app/manifest.js`. Vercel builds at a path with no apostrophe; `next dev` is
    unaffected. **Ruling: do nothing.** Never set `experimental.useWasmBinary`. **Standing caution:
    the repo path contains an apostrophe and will keep breaking tooling that interpolates paths into
    quoted strings.**
13. **A numeric threshold is measured against the LOCAL background, never a global corner sample.**
14. **DB writes go through the Supabase connector and only it** — still no direct Postgres
    connection and no writer credential in the repo, `.env` or any prompt. Anon PostgREST reads
    stay the normal read path. Every write needs NAMED approval for that operation (never
    standing), SELECT-and-paste first (6), the schedule checked (27), and **every DDL statement
    already in `db/migrations/` and applied FROM that file** — a connector change nobody wrote
    down is drift no gate can catch. Hard stops regardless: `drop`, `truncate`, `delete` with no
    `where`, any write while the loader runs.
15. `npm run test:unit` is `node --test "test/**/*.test.mjs"` — quoted glob.
16. Colour tokens are read from `web/app/globals.css`, never quoted from the mockups.
17. **Edit JSON data files through a parser, never line-based**, and assert nothing but the intended
    key changed.
18. **Team-name resolution is exact-match within sport**, never substring or fuzzy — and MLB canonical
    names are nickname-only, so cross-check a second key such as `abbreviation`.
19. **Never issue an unbounded PostgREST select.** It silently caps at 1,000 rows and returns no
    error. Use the paginating `restAll()`. Pin regression tests to the **call site**, never a row
    count, or the test rots as the season grows.
20. **Never edit a source file with a bare repeated string replace.** Use line-anchored surgery or a
    parser, and assert only the intended region changed.
21. ~~`git diff --ignore-cr-at-eol`~~ **RETIRED** — the condition it waited on was met. Kept as a
    numbered stub so rules are never renumbered under a session that memorised them.
22. **Before asserting what a component does, read the component and cite file and line — never the
    contract document that describes it.** A contract says what a component SHOULD do; only the file
    says what it DOES. Prompt 46 found its own brief naming `fitNameAndRecord()` as the grid's fit
    function when it belongs to the list card and the grid never calls it.
23. **When a change alters anything the locked reference implements, `docs/design/mobile_demo.html`
    changes in the same commit.** A reference that lags the app stops being an authority and becomes
    a second opinion.
24. **A count computed on the Python side is no evidence the JS runtime agrees.** Pin the runtime path
    on every kind of input it can receive.
25. **A prompt is done when the deploy is green and the device agrees, not when it commits.**
26. **The gate and the commit are SEPARATE COMMANDS.** The runner's exit code and its parsed counts
    decide — never the last command in a chain. `b1b1d9b` went out red because a commit was
    `&&`-chained after a gate whose final command was a `grep` that succeeded.
27. **Check the schedule before a bulk database write, and never run two at once.** Prompt 46's
    pre-approved `--all` reconcile started at 13:40:38 and the scheduled daily refresh — already
    running since 13:37:02 — died five seconds later with `ERROR: deadlock detected` in its fixture
    loader. The cron is `0 11 * * *` and drifts by up to four hours, so "it is the afternoon" is not
    an answer; `gh run list --workflow schedule_refresh.yml -L 1` is. The same rule is why prompt
    47's NASCAR load waited for its own NHL/NBA bootstrap to finish rather than running beside it.
28. **A Python-side parse is no evidence GitHub Actions agrees.** PyYAML validated a
    `bootstrap_season.yml` that Actions could not parse at all, and prompt 46 shipped it green. An
    Actions expression is substituted everywhere in a `run:` block — inside shell comments too — and
    an empty one is a syntax error for the whole file. `tests/test_workflows.py` is the guard.
29. **A text write with no `newline=` produces different BYTES on Windows than on the runner.**
    Python's text mode translates every `\n` to the platform separator, so
    `path.write_text(x, encoding="utf-8")` emitted CRLF on this laptop and LF on Actions - one
    adapter, two byte streams, depending on where it ran. `adapters/common.py`'s `dump_json` and
    `write_text` did exactly that, and `scripts/build_cap_table.py` did it to two tracked files.
    **Any writer that can reach a tracked file passes `newline="\n"` or writes bytes.**
    This is rule 1 in a costume; it gets its own number because rule 1 did not stop it.

    **`tests/fixtures/*` is `-text` ON PURPOSE** (prompt 48): recorded fetches are asserted as
    bytes, four tests pin a `sha256` and one pins a byte count, and normalisation on checkout
    would break those on every machine but the recording one. So a recorded page KEEPS its CRs -
    `indycar_2026_schedule.html` carries 5,727 of them - and "no CR under `tests/fixtures/`" is
    the wrong rule. The right one is **disk bytes == index bytes**, which
    `tests/test_fixture_bytes.py` asserts for both fixture directories.

    **How it hid.** `.gitattributes` declares `*.json text eol=lf`, which normalises on read, so
    git compared an LF blob against a CRLF working copy and reported the tree clean; git's stat
    cache then never re-compared them. Prompt 49 stage 0 measured **34 tracked files** whose disk
    bytes differ from their blobs - pure line-ending churn, identical payload. Five were restored
    (the four `tests/fixtures/*_raw.json` and `web/test/fixtures/team-colours.json`); the other
    **29 are an open item**, because renormalising them rewrites 29 files and touches blame, and
    that deserves its own commit and Joe's sign-off rather than a ride-along.

30. **A NOTE RECORDING AN ABSENCE IS A TIMESTAMP, NOT A FACT.** Before acting on "missing", "not yet
    filed", "no mark in the tree", "none exists" or "TBD", **check the thing itself** - and when the
    note turns out to be stale, **correct the note in the same commit as the work it misled you
    about**, rather than leaving a corrected repo described by an uncorrected file.

    Two instances in one run, prompt 52, which is why this is a rule and not an anecdote:

    - **`data/brands.json`'s `bignoon` carried "no mark in the tree; FOX's cached wordmark is
      monochrome, so no colour to derive."** `web/public/programs/big-noon-kickoff.png` had existed
      since 2026-09-02 - four days - built correctly through the pipeline and referenced by nothing.
      The note was true when written and false when read. Stage 6 caught it only because the prompt
      named it; the colour it said could not be derived came out at 70.9 % saturated pixels.
    - **`docs/prompts/README.md` carried a deliberate "Prompt 50's own brief is not yet filed",
      naming its exact path in `Claude outputs\`.** Stage 8 read that section, concluded 50 and 51
      were permanently lost, wrote "could not be reconstructed" into `docs/handoff-status.md`, and
      moved on - without opening the path the note had just given it. Both briefs were filed from
      that path minutes later (`cdfae84`) by copying, not reconstructing.

    **The failure mode is the same both times: a note about an absence was read as evidence of the
    absence.** The two are different ages. A note ages; the tree does not. The check is cheap - one
    `ls`, one `git grep`, one `Test-Path` - and both misses cost a stage each.

    **The second half of the rule is the half that was missed.** Prompt 52 corrected `bignoon`'s note
    in the same commit as the wiring, which is the rule working; it then left its own false claim
    standing in `handoff-status.md` for two commits after `cdfae84` had disproved it. Prompt 53
    stage 1 is that cleanup, and it should not have needed a stage.

31. **A SEARCH THAT FINDS NOTHING IS EVIDENCE ABOUT THE QUERY, NOT ABOUT THE REPO.** Before reporting
    something absent, check that you searched **the representation the file actually uses** - label
    versus slug, display name versus id, the enum versus the filter token, `+` versus `-plus`. **Name
    the search you ran** in the report, so the reader can see what was and was not asked.

    **THIS IS NOT RULE 30 IN A COSTUME, and the distinction is the remedy.** Rule 30 is about a claim
    that was TRUE WHEN WRITTEN and went stale; its fix is "check the thing itself". Here the files
    were correct and current, the thing itself WAS checked, and the answer was still wrong - because
    the question was asked in the wrong vocabulary. Rule 30's remedy does not catch this one.

    **Four instances, three of them in one week:**

    - **`nfl-network`, reported absent from `data/access_profile.json` and `data/row_order.json`
      TWICE** (prompt 54's report and the exchange before it). Both files carried it the whole time
      under the label **`NFL Network`**. The search was `'nfl-network' in json.dumps(...)` - the
      SLUG, against files that are LABEL-KEYED. The recommendation built on it was to ask Joe whether
      he even receives the channel, which was a real question made to look like a blocker.
    - **`truTV` and `TBS`**, the same shape: `trutv` and `tbs` find nothing, `truTV` and `TBS` find
      both files.
    - **`Paramount+` and `Disney+`, prompt 55 stage 2, caught mid-stage.** A slugify that mapped
      non-alphanumerics to `-` turned `Paramount+` into `paramount`, so a count of "access-profile
      networks without a mark" reported three when the answer was one. The published slugs are
      `paramount-plus` and `disney-plus`. **The rule was being written while the mistake was being
      made**, which is the best argument for it.

    **The cheap defence is to search for the THING, not your spelling of it** - grep the file for a
    distinctive substring (`NFL`, `Paramount`) before concluding, and read what shape came back. One
    extra command; the misses above cost a wrong recommendation and a stage of rework.

32. **A RULING IS NOT IMPLEMENTED UNTIL EVERY PLACE THAT RENDERS THE SAME THING OBEYS IT.** Before
    calling a display ruling done, **enumerate the renderers** — `git grep` the CLASS, the COMPONENT
    and the CONDITION, not the concept — and make each one obey or say in the report why it does not.

    **THIS IS NOT 22, 30 OR 31 IN A COSTUME.** Rule 22 says read THE component before asserting what
    it does; prompt 55's assertion about `Listing` was **correct**, and `Listing` really did obey the
    ruling. Rules 30 and 31 are about an absence and about a query's vocabulary. Every fault below is
    code that was **present, correct in its own file, and simply not the only file** — so none of the
    three catches it.

    **Four instances in one run (prompt 56), which is why this is a rule and not an anecdote:**

    - **The reveal.** Joe ruled *"I only want list cards on list view and only grids on grid view."*
      Prompt 55 put that into `Listing`. `PageCount`'s reveal button kept opening sport bands, `<h2>`
      titles, matchup and program cards and the detail panel — **20 card and band elements under
      Day · All · GRID, 88 under Week · All · GRID**, measured. The two components never met.
    - **The weekday heading**, rendered at two DOM levels by the same file: a `<p>` above the bands
      under ALL SPORTS, a `sectionLabel` inside `.band-headrow` with a tile picked.
    - **The provenance line**, rendered on `rows.length` in day mode and on
      `(visible.length || hidden.length)` in week mode — so a day whose games were all off-service
      showed a count with no provenance while the identical week showed both.
    - **"Does this day have content?"** — asked as `games.length` by day mode and `grouped[d]?.length`
      by week mode, so a programs-only day rendered an empty container on the laptop in one mode and
      answered properly in the other.

    **The cheap defence is to name the OTHER renderer before you start.** Three of the four above are
    one component rendering the same thing twice, or two components rendering the same thing
    differently — findable in one `git grep` of the class or the prop, and each one shipped and sat
    in the app for at least a prompt.

33. **A NOTE ASSERTING THAT SOMETHING EXISTS IS NOT EVIDENCE THAT IT DOES.** Before relying on a
    workflow a comment describes — "regenerated from", "built by", "validated against", "kept in
    sync with" — **open the thing it names.** A file can be generated by a tool nobody has any more,
    and the comment will not know.

    **THIS IS RULE 30'S MIRROR, AND THAT IS EXACTLY WHY IT NEEDS ITS OWN NUMBER.** Rule 30 fires on
    a note recording an ABSENCE — "missing", "not yet filed", "none exists", "TBD" — and every
    trigger word in it is a negative. This case is the opposite shape: a note recording a PRESENCE,
    stated with total confidence, which nothing had checked. Rule 30 as written would never fire
    here, because nothing said anything was missing. The remedy is the same — go and look — but the
    prompt to apply it is inverted, and a rule you never think to invoke is not a rule.

    **NOR IS IT RULE 22 IN A COSTUME.** 22 says read THE COMPONENT before asserting what it does,
    and here the component was read: `web/components/Banner.js:5-7` says plainly that the JSON files
    "ship as DOCUMENTATION", that "nothing reads them at build time", and that "if the design moves,
    the JSON changes and the component is regenerated from it - coordinates are never hand-edited
    here." Reading it was not the problem. Believing its claim about a tool **somewhere else** was.
    22 governs what a file does; 33 governs what a file says about the world outside it.

    **THE INSTANCE.** Prompt 57 stage 6 went looking for that generator to apply model F.
    `git grep` for `banner-mobile-v2` returned docs, `Banner.js`, the JSX and the JSON itself —
    nothing under `scripts/`, `pipeline/` or `tests/` read it. The tool had never been in the repo.
    So the instruction "edit the JSON and regenerate" was unfollowable, and had been since prompt 42
    wrote it: the only edit anyone could actually make was the one the comment forbade. The stage
    wrote `scripts/build_banner_mobile.py`, proved it reproduced the committed component
    byte-for-byte from the unmodified JSON, and only then moved a coordinate.

    **AND THE SAME SHAPE HAD ALREADY BEEN RECORDED TWICE WITHOUT BEING NAMED.** `build_demo.py`,
    which `docs/design/mobile_demo.html` says regenerates it, is project-only — prompt 55 noted the
    consequence ("the repo copy cannot be regenerated") and annotated the file by hand instead. So
    is `app_template.html`, `build_banner.py` and `markkit.py`. **Every one of those is a live
    instance of this rule**, and the honest reading is that this repo has a class of documented
    tools that do not exist in it, not a one-off.

    **The cheap defence is one `git grep` for the tool's own name** before believing a sentence
    about how a file is maintained. If it is not there, either write it or write down that it is
    missing — and the second is what prompt 55 did, correctly, when writing it was out of scope.

34. **A PLATFORM BEHAVIOUR RECALLED FROM MEMORY IS NOT EVIDENCE.** Before briefing a risk, a
    constraint or a workaround that rests on what CSS, the DOM, HTTP or a runtime *does*, check it —
    against the spec, or against a note this repo already wrote next to the code it governs. State
    which you checked.

    **THE INSTANCE.** Cowork told Joe that a sticky page header "creates a new containing block"
    above the mobile grid's sticky rail, called it a serious risk, and shaped a whole risk profile
    around it. **It is false.** `position: fixed` and `position: sticky` do not establish containing
    blocks for descendants; only `transform`, `filter`, `perspective`, `backdrop-filter`,
    `will-change` and `contain` do. The recollection was of a real rule, applied to the wrong
    property.

    **THE REPO ALREADY HELD THE CORRECT VERSION, on the exact selector it governs.** `globals.css`
    on `.mrail-cell` says the rail holds *"only while nothing between this element and
    `.mgrid-scroll` carries a transform: a transformed ancestor would become its containing block…
    which is exactly the bug prompt 30 fixed. Do not add one."* One `grep` for `mrail-cell` would
    have produced it.

    **WHAT IT COST, and it is not nothing even though the brief self-corrected.** The false version
    reached Joe as a serious risk before a later pass caught it. A risk profile that is wrong in the
    direction of caution still spends the reader's attention and can talk a design out of existence.

    **DISTINCT FROM 22 AND 33, and the difference is what you go and read.** 22 says read THE
    COMPONENT before asserting what it does; 33 says a note asserting something EXISTS is not
    evidence it does. Both point at this repository. **This one's object is the platform**, which no
    file here is authoritative for — the repo happening to carry the right note this time was luck,
    and next time it will not. When the claim is about a language or a runtime, the spec is the
    authority and memory is not.

    **The cheap defence is that platform claims are the easiest of all to check** — one search, and
    the answer is normative rather than a judgement. Anything phrased as "X creates/blocks/prevents
    Y" is the shape to distrust.


---

