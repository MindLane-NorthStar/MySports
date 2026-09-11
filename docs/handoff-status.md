# MySports — Handoff Status (rewritten 2026-09-05, prompt 46 stage 2)

**This file lives in the repo** at `docs/handoff-status.md`, and the repo copy is the only copy. It
used to be mirrored to the Claude project as `claude/handoff-status.md`; that copy was deleted from the
Project on 2026-09-06 as a stale copy of a live authority (Cowork's check, 2026-09-11). Edit here.

**THE CLOSED AND SUPERSEDED HISTORY LIVES IN `docs/handoff-archive.md`** (split out by prompt 87 on
2026-09-10, moved verbatim, nothing deleted): the run narratives for prompts 46–84, closed and superseded
sections, and the older measurement records. **This file stays the authority for current state** —
repo state, gate floors, open items; since prompt 89 the working rules are `CLAUDE.md`'s alone. Read
the archive when you need to know why something was decided.

Read first for any session picking up MySports. Companions: **`docs/enhancement-register.md`** (§1–§39, all
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
edited after the fact. ~~**62 files, covering prompts 01-60**~~ **96 briefs, covering 01–92, counted 2026-09-11 by prompt 92
(95 after prompt 90; 94 with 90 still to be filed before that; 92 before prompt 91, which prompt 89 missed)** - five numbers (13, 23, 26, 43, 86) carry more than one file, which is why the file
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

**Re-measured 2026-09-11, run 3 (prompt 92) — no count moved; a workflow timeout and documents.**

**Measured 2026-09-11, run 2 (prompt 90) — `pytest` 544 → 569** (`tests/test_enrich_cfb_records.py`, 25);
the other four did not move, and geometry's figures are unchanged because the CFB rows have not landed.

**Re-measured 2026-09-11, run 1 (prompts 89 and 91) — no count moved; both are documents and one config
file.** The line below is prompt 88's.

**Measured 2026-09-10, prompt 88 blocks A and B — after the last gate run, not during it; committed
as `8f3b3c1`.** Block A moved `pytest` 543 → 544; block B moved no count; the prompt 88 follow-up
(step names, the Stage A2 result, register §37, queue item 8) moved none. Prompt 87
before it: `pytest` 531 → 543, `test:unit` 593 → 596, `qa-shots` 113 → 121.

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
| prompt 87 block B | `pytest` | 531 → **543** | `tests/test_game_url_backfill.py` (12): migration 0019's own SQL expression EXECUTED (SQLite, with Postgres's `strpos` shimmed) against `boxscore_url()` for every sport and id shape, incl. cfb's whole-id asymmetry and a two-hyphen MLB id |
| prompt 87 block C | `test:unit` | 593 → **596** | three status-row tests in `gamelink.test.mjs` (the link is a child of the status row and of no links row; the row renders with an empty right slot; two explicit columns with the link stretched). Two tests REWRITTEN IN PLACE: `gamelink`'s footer test (the clause is now forbidden, not required) and `livejoin`'s render-site test (one site, not two) |
| prompt 87 block C | `qa-shots` | 113 → **121** | the status row measured at 390 AND 560px: the link spans label top to value bottom, sits in the right column and in no links row, the closing line says nothing about it, and a program's row renders with its right slot empty — 4 checks × 2 widths |
| prompt 88 block A | `pytest` | 543 → **544** | `test_nfl_refresh_covers_every_game_day_not_only_sunday` in `tests/test_workflows.py`: the NFL step's 7-day loop, the Sunday selector's absence, and the team-art step before the R2 push — parsed, not substring-matched (rule 28) |
| prompt 90 | `pytest` | 544 → **569** | `tests/test_enrich_cfb_records.py` (25): the `"W-L"` split and the all-zero skip, the team_records rows (conference when carried, unknown ids skipped), `--current-week` pinned to fixed 2026 dates with both fallbacks, `main()` driven against a fake DB (one commit covers both writes; `--latest-week` keeps its meaning), and the nightly step's flag. Mutation-checked: wins/losses swapped fails 4; `max(week)` fails 8 |

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

### THE GAME LINK SITS BESIDE THE STATUS (prompt 87 block C, Joe's Option A, 2026-09-10)

The detail panel's Status/score left `.dgrid` for its own two-column row, `.dstatusrow`: Status left,
the game link right at the status pair's full height, at every width. The link no longer renders in
either link row, and the closing line's sentence about it is DELETED (Joe: *"we don't need a sentence
describing any of the three"*). **Measured:** 390px — link 475.16–509.22 against label top 475.16 and
value bottom 509.22, left edge 199 on the right column; 560px — 534.00–568.06 against 534.00 and
568.06, left edge 284, which is also the Venue column's (with two cells, `.dgrid`'s `auto-fit` collapses
the empty third track, so even at 560 it is two columns). Contract: `rendering-contract.md` §12 v1.7.1
and Addendum M11's v2.2 amendment; `docs/design/mobile_demo.html` moved with it (rule 23).

### RULE 14 IS TRUE AGAIN — AMENDED, THE CREDENTIAL KEPT (prompt 88 block B, Joe's ruling 2026-09-10)

Rule 14 claimed no writer credential existed in `.env`; one does (`deployment-contract.md` §7 step 5,
uncommittable under `.gitignore:1-2`). Joe kept the credential and amended the rule: it now says the
credential exists locally for the pipeline's own use and that **a Claude Code session never reads,
prints or uses it** — writes go through the connector or the nightly Action. The four conditions and
the hard stops are unchanged. **Amended in both copies that existed on 2026-09-10** — `CLAUDE.md` and
this file's own rules section — because this file then won a disagreement. (Prompt 89 later removed
this file's copy and made `CLAUDE.md` the authority on rules; register §38.) The ruling and its
reasoning are register §36; the queue's "decision waiting on Joe" section is deleted.
`deployment-contract.md`, `.env` and `.env.example` were not touched.

### THE NFL NIGHTLY FETCHES EVERY GAME DAY, NOT ONLY SUNDAY (prompt 88 block A, Joe's ruling 2026-09-10)

`schedule_refresh.yml`'s NFL step fetched two dates — yesterday and the coming Sunday,
`t + timedelta((6 - t.weekday()) % 7)` — and `adapters/espn.py --date` holds only that day's games
(`espn.py:177`), so Thursday and Monday games (and December Saturdays) were never refreshed on the
day they were played: stale kickoff and status, no score stored while they were on. **It is now the
NBA/MLB loop**: `for i in -1 0 1 2 3 4 5 6`, one `--date` call per viewing day, each `--no-logos`.
Dates, not NFL week numbers — Joe's choice over a week-number fetch and over patching Thursday and
Monday — so flex moves, December Saturdays and the week-18 boundary need no special case.

**The art the loop suppresses moved to its own step**, `adapters.espn --league nfl --teams-only`,
before the R2 push: NFL is the only league whose logos that adapter writes (`espn.py:290-292`), and
`--teams-only` reaches `fetch_logos` for all 32 teams and returns before any schedule fetch (checked,
not assumed; `bootstrap_season.yml:43` is the precedent). It is named "team art", not "logos":
`test_schedule_refresh_conditions_logos_before_pushing` selects the ONE step whose name contains
"logos" — the R2 push — and the brief's suggested name would have made that two.

**Measured before the push, in an ignored directory:** the adapter for Thu 9/10 → 1 game, Fri 9/11 →
**0 games, exit 0** (so an off day cannot trip the loop's `|| exit 1`), Mon 9/14 → 1 game; the
loader takes the empty-day fixture cleanly (`--emit-sql`, 0 games, exit 0) and Thursday's emits 16
statements naming `nfl-401872657`. `pipeline.load --all` needs no change — it globs
`*_fixture.json` (`load.py:351`). **PROVED ON THE RUNNER (Stage A2):** dispatch
`34554883837` on `8f3b3c1`, 2026-09-11 02:30 UTC (22:30 ET Thursday). The NFL step logged **eight**
`fixture:` lines, one per viewing day 2026-09-09 through 2026-09-16 — the loop is yesterday, today
and six more, so the brief's "seven" was a miscount of the same range — returning 1, 1, 0, 0, 13, 1,
0, 0 games. **The database confirms it independently:** all 16 NFL games of 9/09–9/14 carry one
transaction (xmin 11570) and `updated_at` 2026-09-11 02:42:34.832 UTC — 9/09 final, **9/10
`in_progress` (the Thursday game, 49ers @ Rams 17–7, written while it was on)**, 9/13 thirteen
scheduled, 9/14 scheduled. The team-art step ran clean (`logos: ok 0, cached 32, error 0`). Wall time
22m03s against 18m32s; the NFL steps took ~4s, and the largest deltas were R2 transfer (+149s pulling
the cache before any NFL step, −79s in render) — the fixture load's +61s is the only growth plausibly
tied to the change, and one pair of runs cannot separate it from database load. The NHL step, whose name says "7-day window" over two calls, is
fine: `adapters/nhl.py:323` — the NHL `/schedule/{date}` endpoint returns a 7-day `gameWeek`.

`tests/test_workflows.py::test_nfl_refresh_covers_every_game_day_not_only_sunday` parses the YAML
(rule 28) and pins the loop, the Sunday selector's ABSENCE, and the art step before the push.
Mutation-checked three ways: the original two-date step, the loop with the Sunday line added back,
and the art step removed — each fails it.

### EVERY GAME GETS ITS LINK — MIGRATION 0019, APPLIED (prompt 87 block B, 2026-09-10)

`db/migrations/0019_backfill_game_urls.sql` fills `boxscore_url` for every game that has none, deriving
it exactly as `pipeline/load.py`'s `boxscore_url()` does — the link needs no fetch, only the sport and
the id, so coverage was patchy only because `SCORES_SQL` runs for fetched games. **Measured before it
was written: 3,527 games without a link** (cfb 704, mlb 15, nba 1,206, nfl 258, nhl 1,344). Guarded
`where boxscore_url is null`, so nothing stored is touched. **The SQL restates the per-sport mapping,
which prompt 78 ruled against, so it is pinned**: `tests/test_game_url_backfill.py` executes the
migration's own expression and compares it with `boxscore_url()`; a changed template in either
place fails it (mutation-checked, and the cfb asymmetry is caught only by the hyphenated-cfb case,
which is why it is there). **Applied only on Joe's named approval (rule 14)**, after the push. It
fixes the LINK only; the Thursday/Monday NFL refresh hole was `docs/queue.md` item 1, closed by
prompt 88 block A (see its entry above).

**APPLIED 2026-09-10 20:21 UTC on Joe's named approval.** 3,527 rows written — exactly the
migration transaction's rows — and **0 games are left without a link, 3,953 of 3,953**. The 426
links stored before re-fingerprint identically, and no link differs from the derived expression.
The migration's header carries the before/after record.

### THE RECORD IS SPLIT, THE QUEUE IS FILED, THE STALE NOTES ARE CORRECTED (prompt 87 block A, 2026-09-10)

The goal was one sentence: **a fresh session should be able to start from the repo and the Project
alone.** What moved, and where to look now:

- **This file was split.** 159,569 bytes → **70KB** here and a new **`docs/handoff-archive.md`** for
  the closed histories, superseded sections and the prompt 46–84 run narratives. **Moved verbatim:**
  rebuilding the original from the two new files, using the archive's own per-block provenance
  comments, reproduces it byte for byte. Kept here: Repo state with both tables, every `### OPEN`
  item, the working rules (until prompt 89 left them to `CLAUDE.md` alone), the "read this before…"
  operating notes, and prompts 84–87.
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
because the nightly fetches only yesterday and the coming Sunday. Queue item 1 carried both; prompt
88 block A closed it.

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
| `pytest` | repo root | **569 passed + 1 skipped** (36 subtests) |
| `npm run test:unit` | `web/` | **596** |
| `npm run smoke` | `web/` | **33/33** |
| `node scripts/qa-shots.mjs` | `web/` | **121/121** |
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
to a claimed app (`docs/research/mlb-tv-tap-test.md`). `docs/queue.md` item 1 carries this forward
(it was item 2 until prompt 88 closed the NFL-window entry).

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
- **21 tracked files still have CRLF working copies against LF blobs** — line-ending churn, identical
  payload. Measured 2026-09-11 with `git ls-files --eol` (`i/lf` against `w/crlf`). Prompt 49 counted
  34, restored 5 and left 29 open; the count has fallen since and the cause was not traced.
  Renormalising rewrites every one and touches blame, so it is its own commit and Joe's sign-off. This
  item lived inside the old rule 29 text until prompt 89 moved the rules out; the incident and how it
  hid are in `docs/rules-casebook.md`, rule 29.
- **`.claude/settings.json` is friction reduction, not a security boundary** (prompt 91, register §39).
  Its allow and deny rules are prefix matches per tool: a differently spelled command, a script that
  opens a file itself, or a `grep -r` that happens to cross `.env` all pass them. The stop list in
  `CLAUDE.md` `## Committing` is the real control. **The OS-level option — Claude Code's sandboxing —
  exists and has not been evaluated.** Not evaluated here either.
- **CFB RECORDS: THE DATA HAS NOT LANDED YET (prompt 90, register §40).** Prompt 90 changed the code and
  the nightly step and wrote no row. `team_records` holds zero CFB rows until `schedule_refresh` runs
  from the pushed ref — Joe dispatches it — and Cowork verifies the rows in the database directly
  (`source = 'cfbd.enrich_cfb'`, `as_of` the run's ET date), not from the run's log. Until then every
  CFB card renders exactly as before: no record on either surface, and no rank prefix on the grid.
  `web/test/standings.test.mjs:131` says "Zero CFB team_records rows exist" and goes stale on that run.
- **The game record columns are written and not read.** `enrich_cfb.py` still writes
  `games.home_record` / `away_record` (the archived desktop renderer's path, with its conference form),
  and `GAME_SELECT` (`web/lib/queries.js:9-46`) does not select them, so `MobileGrid.js`'s `stored`
  branch never fires. The rank columns ARE selected and are what the grid's rank prefix reads — which
  is the next item. Deliberately not changed by prompt 90.
- **The grid and the card take a CFB rank from two places.** The grid reads `game.home_rank` /
  `away_rank` (`MobileGrid.js:98`), a bare number with no poll; the list card reads `mysports.rankings`
  and so is the only surface that can print the `AP` / `CFP` label and honour CFP-before-AP
  (`web/lib/standings.js:103-105` and `:167` say exactly this). Once `--current-week` runs the grid's
  number will be current again, but it stays label-less. What the compact grid run should show is a
  design question, and it is Joe's. **Not fixed here.**
- **THE `refresh` JOB REACHES THE CFB STEP AT ~18 OF WHAT WERE ITS 20 MINUTES (prompt 92, register §41).**
  Run #18 (2026-09-11, old code) was killed at 20m03s: the CFB enrichment step ran at ~18 minutes, the
  unit tests and the watch-link report completed, and the archive upload — the last real step — was
  cancelled. Because `render` `needs: refresh`, **the grids did not regenerate that morning**, and they
  will not on any morning the job overruns. Prompt 92 raised the ceiling to 35
  (`schedule_refresh.yml:19`); successful jobs run 8–16 minutes, most of it the R2 asset pull (4–8m),
  the R2 logo push (2–3m) and the loader (1–4m). **Headroom, not a fix** — the durable fix is splitting
  the job, `docs/queue.md` item 9, not approved. Prompt 92 did not dispatch the workflow; Joe does.

## Working rules — not in this file

**The binding working rules live in `CLAUDE.md`, section `## Working rules (binding)`, and that section
is the authority on them.** The incidents behind them are in **`docs/rules-casebook.md`**, which is
history and never binding.

**This file is the authority on state** — repo state, gate floors, open items — **and not on rules.**
It carried a second, longer copy of the rules until 2026-09-11, when prompt 89 removed it on Joe's
ruling; that copy had already fallen two rules behind `CLAUDE.md`. Register §38.
