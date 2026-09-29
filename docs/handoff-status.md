# MySports — Handoff Status (rewritten 2026-09-05, prompt 46 stage 2)

**This file lives in the repo** at `docs/handoff-status.md`, and the repo copy is the only copy. It
used to be mirrored to the Claude project as `claude/handoff-status.md`; that copy was deleted from the
Project on 2026-09-06 as a stale copy of a live authority (Cowork's check, 2026-09-11). Edit here.

**THE CLOSED AND SUPERSEDED HISTORY LIVES IN `docs/handoff-archive.md`** (split out by prompt 87 on
2026-09-10, moved verbatim, nothing deleted): the run narratives for prompts 46–84, closed and superseded
sections, and the older measurement records. **This file stays the authority for current state** —
repo state, gate floors, open items; since prompt 89 the working rules are `CLAUDE.md`'s alone. Read
the archive when you need to know why something was decided.

Read first for any session picking up MySports. Companions: **`docs/enhancement-register.md`** (§1–§68 — this said §1–§39 until prompt 99 corrected it, §1–§53 until prompt 111 did and §1–§61 until prompt 123 did, counted each time; all
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
edited after the fact. ~~**62 files, covering prompts 01-60**~~ **131 briefs, covering 01–124, counted 2026-09-29 by prompt 121 rev B (115 reserved)
(130 after prompt 124; 129 after prompt 123; 123 after prompt 116, and prompts 117–122 did not move this line though the README's count did; 122 after prompt 114 rev B; 121 after prompt 114; 120 after prompt 113 rev C; 118 after prompt 113; 117 after prompt 112; 116 after prompt 111; 107 after prompt 102, and it stood at 107 for eight prompts because 103–110 reached the Project and not `Claude outputs\`; 106 after prompt 101; 105 after prompt 100; 104 after prompt 99; 103 after prompt 98; 102 after prompt 97; 101 after prompt 96; 100 after prompt 95; 99 after prompt 94; 98 after prompt 93; 96 after prompt 92; 95 after prompt 90; 94 with 90 still to be filed before that; 92 before prompt 91, which prompt 89 missed)** - **`docs/prompts/README.md` "Duplicate numbers" owns this count**: seven numbers as the README counts them (23, 26, 43, 48 and 114 two each, 86 and 113 three; `13-14-combined` has its own row and is deliberately not counted under 13), eight if it is — which is why the file
count runs ahead of the highest number. (Prompt 111 wrote "six" here after counting the directory; the old "five" it replaced was (13, 23, 26, 43, 86), wrong in both directions — it counted 13 and omitted 48, which has carried two since prompt 93 — and prompt 112 pointed this line at the README rather than keep a second copy.) **39 and 42 are the
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

main. **The tree's position is read from `git log`, never from this sentence** — it said "HEAD is
prompt 66" for thirty-five prompts and then "HEAD is prompt 101" for nine more, stale both times by
the same mechanism (a run appends its dated line below and never touches the sentence above), so
prompt 111 removed the claim rather than reset it. The dated measurement lines below carry the
history, each with its own prompt number attached. **THIS IS THE ONLY PLACE THE GATE FLOORS ARE RECORDED.** `CLAUDE.md`
carried a second copy and it was wrong four times in one week (prompts 62, 63, 64, and again between
`9a69810` and `5c5f63d`); prompt 66 replaced it with a pointer here. Rule 10 already made this file
the winner — do not put a number back there, and do not add a third copy anywhere else.

> **"HEAD is prompt 66" STOOD IN THIS LINE UNTIL PROMPT 101 (2026-09-16).** Thirty-five prompts
> appended a `Re-measured … prompt NN` line beneath it without touching the sentence above them, so
> the one clause naming the tree's position was the one thing on this page that was never true. The
> rest of the paragraph is correct provenance for the floors-live-here rule and is unchanged.

**Measured 2026-09-29, prompt 121 rev B: `pytest` 728 passed + 1 skipped, `test:unit` 657, smoke 33/33, `qa-shots` 145/145
and geometry all hard stops; no floor moves (documentation and comments only).** Written after the last gate run.

- **The refresh's real trigger is written down** (register §68; deployment contract v1.0.6). Joe's Cloudflare Worker
  dispatches `schedule_refresh.yml` at 4 a.m. Cleveland time. `gh` measured a `workflow_dispatch` created 08:00–08:01
  UTC every day from 2026-09-17, by `MindLane-NorthStar`. The two crons are the backstop.
- The Worker's URL and account are not recorded, because **the repo is public**: `gh` read `PUBLIC` on 2026-09-29.
- **The account's 2,000 Actions minutes ran out on 2026-09-28 at about 19:01 UTC**, so #66 and #67 failed with no step
  run. That is why the repo went public, and Actions is free on it now.
- `schedule_refresh.yml`'s header comment names the three triggers. It was proved comment-only: the parsed YAML is
  equal, the `on:` block is byte-identical, and `tests/test_workflows.py` passes 25/25.
- Prompt 123's OPEN item is closed. Two OPEN items are added: the token's expiry date, and the 2026-11-01 check.
  Queue item 16 is buildable, and item 17 (the public `validation-*` artifact) is Joe's call.

**Measured 2026-09-29, prompt 124: `test:unit` 652 → 657; `pytest` 728 passed + 1 skipped, smoke 33/33, `qa-shots` 145/145
and geometry all hard stops did not move.** Written after the last gate run.

- **The TBD-badge check reads fixture rows now** (register §67). `/qa/tbd` is a dev-only page that renders the real
  `Listing` with rows in `gamesForDay()`'s exact shape, and it 404s in production like `qa/programs`. `qa-shots` counts
  the rows exactly and records logo requests, so a placeholder the predicate missed cannot pass on the error path's
  badge.
- **The `qa-shots` floor stays at 145.** The block still makes three assertions, so the count did not change and there
  was nothing to move.
- `docs/queue.md` item 15 is closed. The prompt 123 line below says the badge check "goes red again when the Wild Card
  series finish"; that is no longer true.
- Smoke still reads live rows by design (§60), and queue item 12 stands.
- Block A (`22a1b30`) was pushed before this block, so the production 404 could be read and recorded.
- One `qa-shots` run took longer than the tool's 600 s window, with dev renders of 8–14 s after four mutation runs.
  It finished 145/145 in the background.

**Measured 2026-09-28, prompt 123: `pytest` 718 → 728 passed + 1 skipped and `test:unit` 650 → 652; smoke 33/33, `qa-shots`
145/145 and geometry all hard stops did not move.** Written after the last gate run.

- **A change in who can watch a game now reaches the app** (register §66). The default reconcile re-decides eligibility,
  and nothing else, for every game whose broadcast rows were seen after its verdict was computed. So the way Sunday
  2026-09-27 showed "Market TBD" on games rule 4b had decided by Thursday cannot happen again. The first refresh after
  the push is also the backfill: the forecast is 802 rows rewritten and 14 verdicts changed, all NFL. Joe decides any
  dispatch; the OPEN item below says what to confirm.
- **Two gates were red on live data before anything was committed, both as the queue had predicted.** Smoke was
  32/33 on the Division Series placeholders ("AL 3/6 Winner" and three more; queue item 12). `qa-shots` was 143/145
  because its TBD-badge check found no placeholder left on 2026-09-29 (queue item 15). Joe ruled on both the same day:
  the series-winner form joins the placeholder pattern (register §60), and the badge check moves to 2026-10-03. That
  change is committed ahead of 123's two blocks. The badge check goes red again when the Wild Card series finish.
- Block B's guard is queue item 16; 34 games fail it today.
- `web/.next` was cleared before `next dev` started (rule 36; prompt 122's icon requests had left it behind).
  `geometry.mjs` defaults to port 3001 and this run's server was on 3000, so geometry ran with that base passed in,
  after a first attempt found nothing listening.

**Measured 2026-09-25, a conversational run with no brief — `pytest` 717 → 718 passed + 1 skipped; `test:unit` 650, smoke
33/33, `qa-shots` 145/145 and geometry all hard stops did not move.** Written after the last gate run. **The icon is v10 and
v9 never shipped**: Joe supplied `assets/brand/icon_MySportsTV_v2.png`, v9's composition with a white mixed-case "MySports
TV" in place of the gold caps, 1024×1024 RGB. It came with no smaller sizes, so they were made by the method that rebuilds
Cowork's v9 set pixel for pixel (one Pillow LANCZOS resize from the 1024; the bytes differ only in PNG compression) into
untracked `assets/brand/icon-v10/`. The five live files match it by md5 (`d7514236` 1024, `3e54b9be` 512, `348aec19` 192,
`b398a47d` 180, `8d2af634` 48); v9's master is retired to `app-icon-mysports-tv-v9-retired.png` beside v5–v8;
`manifest.js` needed no change. **The new wordmark is the element closest to the iOS mask**, 43.2 px, against v9's 57.9 and
v8's 26.1 by one method (a superellipse, n = 5, that reproduces brief 122's v9 figures to 0.1 px on NASCAR, CFB and NBA);
NASCAR is next at 46.2. Joe's art, shipped as supplied. **`AGENTS.md` is cleared at its cause** (register §65 addendum):
the checker now knows Codex also renames `CLAUDE.md` → `AGENTS.md`, and removed prompt 122's copy. **qa-shots' TBD-badge
check went red on data** — it hard-coded 7 placeholder sides on 2026-09-29, the Braves clinched and took one, 6 remained and
all 6 were badged — and by Joe's call it now counts the sides it finds and needs at least one; **queue item 15: it goes red
again when the last placeholder on that day resolves**, and that red is the check working. Its four runs: 144/145 on that
check; a crash waiting for the detail panel after a block tap (M11); a crash on the first navigation, whose server render
took 29.8 s while NHL live scores logged `fetch failed` (the same page rendered in under 1.5 s minutes later); then
145/145, the fourth run by Joe's call after two timeouts.

**Measured 2026-09-24, prompt 122 — `pytest` 716 passed + 1 failed + 1 skipped, `test:unit` 650, smoke 33/33, `qa-shots`
145/145 and geometry all hard stops; no floor moves.** Written after the last gate run. The one failure is
`tests/test_agent_instruction_files.py` on an `AGENTS.md` that `scripts/remove_codex_agents_md.py` **kept**: 23,770 bytes,
sha256 `dc313359…a37e`, mtime 2026-09-24 00:26 EDT, the Codex rewrite of `CLAUDE.md` at `ab5e4f4` on every line but one —
line 191, rule 35's own amendment, where "copy of `CLAUDE.md`" reads "copy of `AGENTS.md`". Rule 35 makes an unverified
file a stop and S4 forbids committing over the red gate, so **icon v9 sits installed in the working tree and its commit
waits on Joe's judgment of that file.** The five live icons match their `assets/brand/icon-v9/` sources by md5
(`7a0e4aa3`, `92f48221`, `919ff052`, `18677b24`, `2b3e7fe4`), the master is the v9 1024 and v8 is retired beside v5, v6A
and v7 in untracked `assets/brand/`; `manifest.js` needed no change. **Rule 12 has a second route, measured this run:**
a direct request for `/apple-icon.png` or `/icon.png` on `next dev` fails in `next-metadata-route-loader` on the
apostrophe exactly as the manifest does and every page 500s until `web/.next` is cleared. qa-shots' first run after
that recovery exited 1 with its output uncaptured; the two runs after it passed 145/145. Port 3000 was Joe's
`mylife-reader` dev server, left running; this repo's ran on 3001.

**Measured 2026-09-23, prompt 120 — `pytest` 708 → 717 passed + 1 skipped; `test:unit` 650, smoke 33/33, `qa-shots` 145/145 and
geometry all hard stops did not move.** Written after the last gate run. **The Codex copy of `CLAUDE.md` is identified
by its cause and removed on sight** (register §65): the stray `AGENTS.md` is written by the Codex desktop app's "import
from Claude Code" sync, measured from Joe's `.codex` folder, and `scripts/remove_codex_agents_md.py` deletes it only when
it is byte-identical to the Codex rewrite of a `CLAUDE.md` from the last 50 commits or the working tree; anything else is
kept for Joe. Joe's standing authorization is working rule 35's amendment. The guard test is not weakened; its docstring
now says the measured cause. This run's pre-check found no `AGENTS.md`, so the script's first live run was the silent
exit 0. The 2026-09-16 arrival has no matching import in Codex's log and is recorded as unexplained.

**Measured 2026-09-23, prompt 119 — `pytest` 701 → 708 passed + 1 skipped; `test:unit` 650, smoke 33/33, `qa-shots` 145/145 and
geometry all hard stops did not move.** Written after the last gate run. **Each week's coverage page stands alone**
(register §64): a week that fails is left out with a note and the other week's windows are written; only every week
failing writes no file. **Playoff games are national** before every other rule, from the event's own `season.type`
(3, measured on the live Wild Card Sunday of 2026-01-11 through the adapter's own fetch); source
`national window (postseason)`. The pre-check found an untracked `AGENTS.md` again (the §49 class); the session
could not delete it, so its first gate run had the instruction-file test red at 707; Joe removed the file and the
rerun before the commit passed 708 with that test green.

**Measured 2026-09-23, prompt 118 — `pytest` 675 → 701 passed + 1 skipped; `test:unit` 650, smoke 33/33, `qa-shots` 145/145 and
geometry all hard stops did not move.** Written after the last gate run. **No paid data (register §63):** Schedules
Direct stays dormant and EntitledSports' weekly coverage page is the source. `adapters/es_windows.py` reads
Cleveland's four Sunday windows for this NFL week and the next (the week from ESPN's calendar) into one JSON the NFL
step reads through `MYSPORTS_NFL_WINDOWS`, and `adapters/espn.py` rule 4b decides a CBS/FOX row from the window after
the listings and before `UNVERIFIED`: early before 3:00 PM ET, late otherwise; same teams by nickname AVAILABLE,
different teams OUT_OF_MARKET, TBD falls through. The one live call was the fetch of weeks 3 and 4 the fixtures come
from. Applies on the next scheduled refresh; Joe decides any dispatch.

**Measured 2026-09-23, prompt 117 — `pytest` 643 → 675 passed + 1 skipped; `test:unit` 650, smoke 33/33, `qa-shots` 145/145 and
geometry all hard stops did not move.** Written after the last gate run. **A CBS or FOX Sunday-afternoon row is
decided by what WOIO and WJW actually air** (register §62): `adapters/sd_listings.py` reads the two stations' listings
from Schedules Direct into one JSON the NFL step reads through `MYSPORTS_NFL_LISTINGS`, and `adapters/espn.py` decides
each row by the first of six rules — national window, hand override, Browns, the station's airing (same teams /
different game / no names), no game in the window, else `UNVERIFIED` as before. Inert until Joe adds the three
`SD_*` secrets; a failing listings step logs one line and changes nothing. No live call was made in the run.

**Measured 2026-09-23, prompt 116 — `pytest` 634 → 643, `test:unit` 642 → 650, `qa-shots` 142 → 145; smoke 33/33 and
geometry all hard stops did not move.** Written after the last gate run. **The loader now follows the source for a
game's teams** (register §61): `home_team_id`/`away_team_id` join the games upsert's update list, preserved, every
flip is logged to `refresh_runs.notes.team_changes`, and a missing id is never written. **A placeholder team shows a
grey TBD badge** in its logo box at all five mark sites, and a logo that fails to load swaps to it. Pushed on Joe's
authorization for the 2026-09-28 deadline.

**Measured 2026-09-23, prompt 114 rev B — `test:unit` 634 → 642; smoke back to 33/33; `pytest` 634 + 1 and
`qa-shots` 142 did not move; geometry all hard stops.** Written after the last gate run. Joe's ruling widened the
placeholder rule (register §60): `web/lib/placeholders.js` exempts a `-TBD` id or an MLB row named for a postseason
seed or wild card slot, and smoke names every row it exempts. Three commits, in order: Block E, then 114's A–C1,
then 114's D with both briefs. **NOT PUSHED** — the preview branch waits for Joe's `preview`.

**Measured 2026-09-23, prompt 114 — `test:unit` 633 → 634 and `qa-shots` 121 → 142; `pytest` did not move; smoke
was RED, 32/33, for a reason that was not this change** (the 08:00Z refresh loaded MLB postseason placeholder
teams whose ids do not end in `-TBD`; rev B widened the rule). Written after the last gate run. Nothing was
committed by that run — S4 forbids committing over a red gate. The iPad gets 32px of headroom above the navbar row and the desktop banner under
`(min-width: 700px) and (min-height: 600px) and (pointer: coarse)` (register §59); the phone renders
byte-identically at 390 × 844 and 932 × 430 in all three header states, and so does the desktop at 1440 × 900.

**Measured 2026-09-22, prompt 113 rev C — `pytest` 632 → 634 and `test:unit` 632 → 633** (the review-pin
tests); smoke, qa-shots and geometry did not move. Written after the last gate run. **Joe reviewed the 21
pairs and kept the old rendering for six** — Oklahoma St, Nicholls, N Arizona, Tarleton St, Tulane and the
Chargers — pinned in the build's `REVIEW_PINS` and declared in the tests; the Rams and the Rockets stand as
regenerated (register §58's dated subsection). The pinned caps render pixel-identical to the panels he
approved (`assets/p113-cap-regen/pins/`). **NOT PUSHED** — two commits ahead of `origin/main`; Joe
reviews Block C and Block D, then authorizes. *(Superseded: pushed 2026-09-22 with `02e3a52..ec99819`,
Vercel READY, the six pinned rows and `mlb-142` verified in the served bundle.)*

**Measured 2026-09-22, prompt 113 — `pytest` 626 → 632 and `test:unit` 631 → 632** (the ruled-branch pins in
`tests/test_cap_table.py`, six; the ruled-rows pin in `captable.test.mjs`, one); smoke, qa-shots and geometry did
not move. Written after the last gate run. **The cap table is scored against the band that paints** (Joe's
option (b), register §58): 38 ruled rows change art, 27 change only their tint label, and seven unruled college
rows follow their rebuilt `_dark` files (Joe's rev B ruling: keep them). **The study-ink counts did not move**
because `renderInk()` now reads the frozen study's tint and art, as its own comment required. **NOT PUSHED** —
one commit ahead of `origin/main`; Joe reviews the 21 before/after pairs under `assets/p113-cap-regen/` first,
and a push is a deploy that changes what 21 grid endcaps paint. *(Superseded: pushed 2026-09-22 with
`02e3a52..ec99819`, after rev C's pins.)*

**Re-measured 2026-09-22, prompt 112 — no count moved; documents only, plus one comment.** Written after
the last gate run: pytest 626 + 1 skipped, test:unit 631, smoke 33/33, qa-shots 121/121, geometry all hard
stops. Block A measured the dark-band logo class and found the cap table scored against the rule's band,
not the ruled band the block paints (register §57, queue item 11); nothing that paints a block changed.
**NOT PUSHED** — one commit ahead of `origin/main`; Joe authorizes. *(Superseded: pushed 2026-09-22 with
`f4aab2c..02e3a52`, Vercel READY.)*

**Re-measured 2026-09-22, prompt 111 — no count moved; documents only, and nine briefs filed.** Written after
the last gate run: pytest 626 + 1 skipped, test:unit 631, smoke 33/33, qa-shots 121/121, geometry all hard
stops. The HEAD clause above is deleted rather than reset (register §56); the push state is corrected from a
real fetch; `docs/prompts/` is 116 covering 01–111.

**Measured 2026-09-22, prompt 110 — `test:unit` 630 → 631** (the `.mgrid-only`/`.deskgrid-only` mirror
test in `nav.test.mjs`, +1; `restcap.test.mjs` −1 +1 as its REPORTED mechanism went and a `gridIndex`
pin arrived); `pytest`, smoke, qa-shots and geometry did not move. Written after the last gate run. **The
mobile grid is a TOUCH artefact now** (Joe's ruling, register §55): shown below 699px OR on a coarse
pointer, so an iPad gets the one-timeline grid in either orientation; a fine pointer keeps the archived
PC render. Mobile Grid Addendum v2.4. **PUSHED** — this one has to reach Joe's iPad, and the device is
the check (rule 25). `gridIndex` pages; `geometry.mjs`'s comment no longer claims immunity to drift.

**Measured 2026-09-22, prompt 109 — `pytest` 619 → 626 and `test:unit` 624 → 630** (block F's
`tests/test_agent_instruction_files.py`, 7, and `web/test/restcap.test.mjs`, 6, the cap guard); smoke,
qa-shots and geometry did not move. Written after the last gate run of the second stage. **Geometry went green
with `geometry.mjs` untouched:** the three ALL SPORTS failures prompt 108 measured were the week view's
standings read truncated at 1,000 of 2,820 rows, and `standingsFor` now pages (register §54). cfb 64 / 15,
mlb 3 / 2, nfl 18 / 4 and the ALL SPORTS 14 / 9 are identical on both sides. **NOT PUSHED** — the tree is
now FIVE commits ahead of `origin/main` (`192677f`); Joe authorizes the push. *(Superseded: pushed the same
day by prompt 109's follow-up, `192677f..506f081`, Vercel READY — see prompt 110's paragraph above.)*

**Measured 2026-09-16, prompt 106 — `pytest` 612 → 619 and `test:unit` 609 → 624** (the simulcast rows,
the list collapse and the grid lanes); smoke, qa-shots and geometry did not move. Written after the last
gate run. **The geometry figures are the point of that last clause:** the lane rule is scoped to the
fifteen games, and cfb 64 blocks / 15 rows, mlb 3 / 2 and nfl 18 / 4 are unchanged. **NOT PUSHED** — the
tree is now THREE commits ahead of `origin/main`. *(Superseded: pushed 2026-09-22 with `192677f..506f081` —
see prompt 110's paragraph above.)*

**Measured 2026-09-16, prompt 105 — `pytest` 609 → 612** (the width-match ruling, three tests); the other
four did not move.

> **A CAUTION FOR WHOEVER READS THE FLOOR TABLE NEXT: `pytest` and `test:unit` both read 609 at
> `55b946c`, and this file has a history of transposed counts** (prompts 62, 63 and 64 each found one
> wrong, which is why the floors live in one place). They diverge again at prompt 105 — pytest 612,
> test:unit 609 — but if a future run sees two gates at the same number, that is a coincidence of
> 2026-09-16 and not a copy of one row into the other. Read each from its own run.

**Measured 2026-09-16, prompt 104 — `pytest` 598 → 609** (`tests/test_cavs_simulcast.py`, 11); the other
four did not move. Written after the last gate run. **`test:unit` held at 609 only because two deliberate
counts were bumped:** `railmark.test.mjs` states the manifest size and the on-target count rather than
deriving them, exactly so a mark cannot appear unnoticed — 33 → 35 and 32 → 34 for the two new
composites, which land ON the 600px² rail target (30.00 × 20.00 and 27.21 × 22.05) rather than being
excepted from it. **NOT PUSHED** — the brief withheld the push; see the open item below. *(Superseded:
pushed 2026-09-22 with `192677f..506f081`; the open item is closed — see prompt 110's paragraph above.)*

**Re-measured 2026-09-16, prompt 102 — no count moved; two device items closed and CSS comments.** Written
after the last gate run. **One gate caught a real thing mid-run and is worth the line:** `test:unit` failed
608/609 on the first attempt because a new `globals.css` COMMENT spelled `safe-area-inset-top`, and
`nav.test.mjs` counts that token across the whole file to prove exactly three RULES claim the top edge. The
comment was reworded to say "the top inset" — the convention every other comment in that file already
follows — and the guard was not touched.

**Measured 2026-09-16, prompt 101 — `npm run test:unit` 596 → 609** (block A's release policy and
block B's re-arm, thirteen tests); the other four did not move.

**Re-measured 2026-09-15, prompt 100 — no count moved; one untracked file deleted and documents.** Written
after the last gate run; geometry again pointed at `-- http://localhost:3000`.

**Re-measured 2026-09-15, prompt 99 — no count moved; one metadata value and documents.** Written after
the last gate run. `npm run geometry` was pointed at the dev server's port (`-- http://localhost:3000`),
because the script defaults to 3001. Its figures are identical to the baseline taken at the start of the
run.

**Re-measured 2026-09-14, prompt 98 — no count moved; a workflow schedule removed and documents.**

**Re-measured 2026-09-14, prompt 97 — no count moved; two schedule lines and documents.**

**Measured 2026-09-14, prompt 96 — `pytest` 591 → 598** (`tests/test_logo_conditioning.py`, 7); the other
four did not move.

**Measured 2026-09-14, prompt 95 — `pytest` 585 → 591** (`PushGuard`, 6); the other four did not move.

**Measured 2026-09-11, run 5 (prompt 94) — `pytest` 569 → 585** (`tests/test_sync_assets.py`, 16); the other
four did not move.

**Re-measured 2026-09-11, run 4 (prompt 93) — no count moved; one prompt filed, one untracked directory
deleted, documents.**

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
| prompt 94 | `pytest` | 569 → **585** | `tests/test_sync_assets.py` (16): the byte comparison's order and its request count (a single-part ETag costs no `head_object`; a size difference costs no hashing), the multipart and absent-ETag fallback, `test_pull_retakes_a_cached_file_whose_bytes_differ_from_the_bucket`, a `grids/` key compared at its derived path, mixed-case filenames, `--force` and `--existing-only` unchanged. Mutation-checked: the free ETag step removed fails 7; a key-only pull restored fails 2 |
| prompt 95 | `pytest` | 585 → **591** | `PushGuard` in `tests/test_sync_assets.py` (6), driven through the real `main()` with `_put` counted: a push that would create an object refuses and uploads nothing; `--allow-new` publishes; a push with nothing new proceeds unflagged; `--existing-only` creates nothing; `--force` does not bypass the guard; the nightly's logo push carries the flag. Mutation-checked: the guard moved after the first upload fails 2; the guard removed fails 2 |
| prompt 106 | `pytest` | 612 → **619** | seven in `tests/test_cavs_simulcast.py` for the emitted rows: a WOIO game emits ONE row and it is CBS with the station kept in the label; a both-station game emits TWO, one per outlet; a WUAB-only game emits its own; a game outside the package emits none; availability is ANY outlet, driven through `outlet_access`; WOIO resolves through the alias table and stays out of `access_profile.json`; and BOTH call sites gate the rows on national exclusivity. Mutation-checked seven ways |
| prompt 119 | `pytest` | 701 → **708** | `tests/test_es_windows.py` (+3 net: one replaced, four added): the next week 404ing leaves the current week with one note and the log naming each week's result; the current week failing leaves the next week; both failing writes nothing with one line; a three-window week is named with its reason beside a good week with no note. `tests/test_nfl_market_rules.py` (+4): a postseason CBS 1:00 game national, a postseason FOX 4:30 game national over a hand entry saying no, the same times in the regular season unchanged, the predicate reading the event's own `season.type`. Three mutations each red. |
| prompt 120 | `pytest` | 708 → **717** | `tests/test_remove_codex_agents_md.py` (9), each in its own temp git repo with four commits of `CLAUDE.md` written as LF under `core.autocrlf=false`: an exact rewrite of the current `CLAUDE.md` deleted, naming HEAD; the copy three commits back deleted, naming that commit; an uncommitted working-tree edit's rewrite deleted; one extra line kept, exit 1, the nearest candidate named and the line shown; a rewrite that missed the `Claude.ai` swap kept, exit 1; no file exit 0 and silent; a CRLF copy of an LF `CLAUDE.md` kept and reported as CRLF; the rewrite is both swaps; `CLAUDE.md` carries the authorization line. Four mutations each red: working tree only (3), no `Claude.ai` swap (2), delete on mismatch (3), exit 0 on mismatch (3). |
| prompt 118 | `pytest` | 675 → **701** | `tests/test_es_windows.py` (17): the week 3 block read as two named early windows and two TBD late ones with the stamp, week 4 all TBD, an unrecognized marker recorded verbatim and made TBD, a missing Cleveland block / three windows / a garbled block each a page error, the week from ESPN's calendar pinned to the events' number and to 2026-09-27 → 3, 2026-10-04 → 4 and a Wednesday → 3, outside the season an error; the run: this week and the next from the calendar, `--week` skipping the calendar, an HTTP 500 / missing block / three windows / garbled block / the next page 404 each writing nothing and exiting 0, and the fixtures being the block only. `tests/test_nfl_market_rules.py` (+8): rule 4b — CIN @ PIT available and every other CBS early game out, the late windows and week 4 falling through, the 3:00 PM cut at 1:00 / 2:59 / 3:00 / 4:05 / 4:25, the two-team cities, TBD / a marker / no file / an uncovered week falling through, listings beating windows and a hand entry beating both, and the builder reading the file from the environment. `tests/test_workflows.py` (+1): the windows step between the listings step and the NFL step, the shared temp-dir path, no secret, no expression in `run`, the listings step named dormant. Five mutations each red. |
| prompt 117 | `pytest` | 643 → **675** | `tests/test_sd_listings.py` (16): the SHA-1 password and the token on every later call, the OTA lineup chosen and never re-added when present, added once when absent, station ids by callsign, the 15-date window, each program id fetched once, the real WJW 2026-09-27 sequence and WOIO's Bengals at Steelers read back, a game with no episode title, the three episode-title forms, the narrow game title, no postal code / lineup id / station id in the output or a log line, missing secrets and a 5xx each writing nothing and exiting 0, a good run writing the file. `tests/test_nfl_market_rules.py` (15): the six rules through the real fixture builder — Thanksgiving CBS national with no listings, Sunday night and a December Saturday, the window edges, a hand entry beating a listing, the Browns, same-teams AVAILABLE with the station and time in `source`, a different game OUT_OF_MARKET naming it, no team names UNVERIFIED, the 30-minute bound both sides, Rams vs Chargers and Jets vs Giants by nickname, WJW's no-late-game day, no listings for the date, a failed client leaving today's behaviour, and the order. `tests/test_workflows.py` (+1): the listings step before the NFL step, both on the same temp-dir file, the three secrets as job env, no expression in `run`, no `continue-on-error`. Six mutations each red. |
| prompt 116 | `pytest` | 634 → **643** | `tests/test_postseason_teams.py` (9): the games upsert's `DO UPDATE` carries both team columns, preserved; the loader reads before it writes; a placeholder becoming a club changes the stored id and writes `"mlb-849851: away mlb-4944 -> mlb-111"` to the notes; the same teams again note nothing; a `None` side keeps the stored value, is noted, and never reaches the row or a team stub; a NEW game with a `None` side is skipped live; the two new counters are in `ZERO_COUNTS`; `main` writes the notes. Mutation-checked five ways, each failing |
| prompt 116 | `test:unit` | 642 → **650** | `web/test/teammark.test.mjs` (8): the badge for a placeholder and for a `-TBD` id, the `<img>` for a club and for the same name on another sport, the badge for no src, the two error paths pinned at the source, every mark site through `TeamMark` with no bare `<img>` left, and the badge styled from `--spot-0`/`--dim` with one size rule per box |
| prompt 116 | `qa-shots` | 142 → **145** | the TBD badge on a cold load after hydration: seven badges on the four 2026-09-29 placeholder cards, the 20px box from the neutral tokens, and the Yankees' logo made to 404 swapping to the badge with no broken image painted |
| prompt 114 rev B | `test:unit` | 634 → **642** | `web/test/placeholders.test.mjs` (8): the seven MLB postseason names and `nba-TBD` are placeholders; a real club, `AL #3 Seeds`, `AL Wild Card`, `ALDS Winner A`, the name on another sport, `mlb-TBDX` and a missing row are not; and `smoke.mjs` uses the predicate rather than its own suffix test. Mutation-checked six ways, each failing: the sport guard dropped, each anchor dropped, `#\d+` widened to `.*`, the suffix branch removed, smoke back on `endsWith('-TBD')` |
| prompt 114 | `test:unit` | 633 → **634** | `nav.test.mjs` (+1): the iPad headroom block's condition list read off the stylesheet as a set and required to be exactly `(min-height: 600px)`, `(min-width: 700px)` and `(pointer: coarse)`; the token declared once at 32px; `.chdr` itself must not spend it; the inset-token count still 3; no `max-width: 699px` block spends it. Mutation-checked six ways, each failing: each clause dropped in turn, the token set to 0, the spacer moved onto `.chdr`'s padding, `.bn-pc`'s padding removed |
| prompt 114 | `qa-shots` | 121 → **142** | the headroom measured at five viewports (+21): at 1366 × 1024 and 1024 × 1366 coarse the `.bn-pc` padding and SVG top are 32, the `::before` spacer is 32 with `.chdr-inner` at 32, `.chdr` is 76 and `--stack-h` carries it, the picker flush under it (landscape); at 390 × 844, 932 × 430 coarse and 1440 × 900 fine every one of those rows is 0 / 44 / 44, exactly as before; the collapse on the iPad moves the first card by the scroll asked for and nothing more, and the wordmark tap re-arms the pin. Chromium has no scrim: these prove geometry, not legibility |
| prompt 113 rev C | `pytest` | 632 → **634** | `ReviewPins` in `tests/test_cap_table.py` (2): a pin overrides the scored row and carries the pinned art's own score on the pinned surface, and `apply_pins=False` returns the unpinned answer; the shipped pins are Joe's six and nothing else, with no id declared twice. Mutation-checked: a pin removed from `REVIEW_PINS` fails 1 |
| prompt 113 rev C | `test:unit` | 632 → **633** | `captable.test.mjs` (+1): every `REVIEW_PIN` is in the table as pinned, differs from what the build produces unpinned, and is not also in `FILE_CHANGED`; the unruled counts re-pinned 104/17/54/11 → 105/15/56/10 and the ruled split 106/17/1 → 107/16/1 with the arithmetic in the comment. Mutation-checked four ways, each failing: the Nicholls pin removed from the build and the table regenerated (JS and `--check` both red); `197` set back to its regenerated row in the table; `renderInk()` back on the live table; a pin removed from `REVIEW_PINS` (pytest) |
| prompt 113 | `pytest` | 626 → **632** | six in `tests/test_cap_table.py`, `RuledTeamsAreScoredOnTheirOwnBand`: a ruled team takes the dark file its ruled band needs where `band_for()` would refuse it (the Padres/Rams shape, on synthetic squares); a ruled team is never tinted; an unruled team keeps the two-level rule; the Giants' cap override is applied by the build and scored on the ruled band; the override table names the Giants and nothing else; a missing ruled file rules nobody. Mutation-checked: the ruled branch reverted in `row_for()` fails 3 |
| prompt 113 | `test:unit` | 631 → **632** | `captable.test.mjs`: the study match is RESTRICTED to the 186 unruled ids and pins 104/17/54/11 with seven file-changed rows declared (date and cause each); a new test pins the 124 ruled rows against the regenerated table (all tint 1, art 106/17/1, the Giants cap, the Padres and Rams dark); `renderInk()` reads the frozen study's tint and art so 191/116, 56/20/33 and the 26 did not move. Mutation-checked five ways, each failing: `renderInk()` back on the live table, a file-changed row undeclared, a declared row matching the study, the Padres set to raw in the table, and the `--check` acceptance with a matching declaration |
| prompt 110 | `test:unit` | 630 → **631** | `nav.test.mjs` (+1): `.mgrid-only` and `.deskgrid-only` read off the stylesheet and held to the SAME condition set, which must be exactly `(max-width: 699px)` and `(pointer: coarse)`, with opposite base rules. `restcap.test.mjs` (−1, +1): the REPORTED-list test went with the mechanism when `gridIndex` was paged, and a `gridIndex`-uses-`restAll`-with-a-total-order pin took its place. Mutation-checked four ways, each failing: coarse removed from either selector alone, `gridIndex` back to bare `rest()`, its tiebreaker dropped |
| prompt 109 block F | `pytest` | 619 → **626** | `tests/test_agent_instruction_files.py` (7): no `AGENTS.md`, `GEMINI.md`, `.cursorrules`, `.windsurfrules`, `.github/copilot-instructions.md` or `CONVENTIONS.md` at the root, and `CLAUDE.md` present. The failure message is the deliverable — it names the file, says `CLAUDE.md` is the only one, why a copy is dangerous, that the fix is delete-and-find-the-writer, and that the known cause is a stray write from another project. Mutation-checked six ways, each recreated file failing it |
| prompt 109 | `test:unit` | 624 → **630** | six in `web/test/restcap.test.mjs`: every `rest()` call in `queries.js` is paged, limited, or allowlisted with a written reason; `standingsFor` pages with `restAll` over a total order; the allowlists name only functions that exist; every entry carries a reason; and the REPORTED list is exactly `gridIndex`. Mutation-checked five ways, each failing: bare `rest()` restored, a new unbounded call, the tiebreakers dropped, `gridIndex` unlisted, a stale allowlist name |
| prompt 106 | `test:unit` | 609 → **624** | fifteen in `web/test/simulcastmark.test.mjs`: the four mark states Joe named, an inactive row not counting, the service set read off the GAME rather than the announcement file, the grid's lane rule (three lanes for a both-station game, ONE block for every other game in the app), and the three facts that keep a composite off the rail - it is in no `row_order.json` band, in no access profile, and named in no component |
| prompt 105 | `pytest` | 609 → **612** | three in `tests/test_cavs_simulcast.py` for Joe's width-match ruling: both composites' halves share a width in the PUBLISHED bitmap (measured off the ink, split on the seam, so `wuab-43`'s own internal row gap cannot fool it), and `stack()` reads the BOTTOM part rather than the widest. Mutation-checked four ways, each failing: the ink-area balance restored (in-memory AND with the marks rebuilt, where CBS comes back 192px over a 150px mark), matched to the widest part, and matched to the top part |
| prompt 104 | `pytest` | 598 → **609** | `tests/test_cavs_simulcast.py` (11): the fifteen announced games; the outlet is PER GAME and the package-level `outlet` survives only under `superseded`; the 9/2/4 split and the 13/6 totals; date+tricode is the key, proved on the two Detroit games whose outlets differ; `simulcast_outlets()` matching and its three misses (wrong opponent, wrong day, team with no package); that `_simulcast_row` still emits NOTHING, which is prompt 105's boundary; and both composite marks published, recipe-backed and inside the hf bounds. Mutation-checked five ways, each failing the assertion that guards it: the date check dropped from the matcher, `_simulcast_row` made to emit, a composite dropped from the recipe table, the two Detroit games flattened to the same outlets, and the package-level `outlet` restored |
| prompt 101 | `test:unit` | 596 → **609** | `bannerpin.test.mjs` (4): the release callback's direction both ways, that it runs only after the pin is off and the listener is removed, and that the one-argument signature still works. `autoscroll.test.mjs` (9): `pinReleaseCollapse`'s four cases (downward + sentinel above collapses; downward + sentinel on screen does NOT, because the observer still owns it; upward never; no sentinel is a no-op), the no-expand-path guard, `pinRearmOnExpand`'s four transition cases, and the wiring with its animation frame. One existing assertion REWRITTEN IN PLACE — `installPinRelease(window)` no longer matched once the call took a policy argument, and it now pins the whole call. Mutation-checked twelve ways, every one failing the suite |
| prompt 96 | `pytest` | 591 → **598** | seven in `tests/test_logo_conditioning.py`: the file really holds mixed-case rulings; a lowercase file for a team ruled raw in mixed case gets the ruling (the runner's case); the mixed-case file still does (the laptop's); case-insensitivity does not widen the ruling; the `derive` set matches in any case; one team ruled both ways under two spellings is still caught; a conditioned file already on the runner heals to the raw art once and a second run writes nothing. Two existing tests REWRITTEN IN PLACE to compare in `rule_key()` spelling, not weakened. Mutation-checked: the case-sensitive code restored fails 6; normalizing the sets but not the stem fails 1 |

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
| `pytest` | repo root | **717 passed + 1 skipped** (36 subtests) |
| `npm run test:unit` | `web/` | **650** |
| `npm run smoke` | `web/` | **33/33** |
| `node scripts/qa-shots.mjs` | `web/` | **145/145** |
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
- ~~**NHL and NBA hold only date-driven partial seasons** (47 and 19 games). `nba-BOS`, `nba-PHX`,
  `nba-POR` have art and no games for that reason. A one-time bootstrap is the fix.~~ **STALE, AND BY
  A LARGE MARGIN — corrected 2026-09-16 (prompt 104), measured through the anon REST path:** NBA holds
  **1,206 games, 2026-10-20 → 2027-04-11**, and NHL **1,376, 2026-09-19 → 2027-04-10**. Both are full
  seasons; the bootstrap this item asked for has evidently run. The figure was already wrong when
  prompt 87 backfilled game links against **nba 1,206** rows and nobody reconciled the two lines. It
  was found because prompt 104 expected most of the fifteen Cavs simulcast games to have no game to
  match and **all fifteen matched** (rule 30: check the thing, not the note). Whether `nba-BOS`,
  `nba-PHX` and `nba-POR` still lack games was NOT re-measured here.
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
- ~~**OPEN — PROMPTS 104, 105 AND 106 ARE COMMITTED BUT NOT PUSHED: the tree is THREE commits ahead of
  `origin/main` (2026-09-16, register §51, §52 and §53).**~~ **CLOSED 2026-09-22 — pushed, and measured
  rather than inferred by prompt 111:** Joe authorized the push in prompt 109's follow-up, which sent
  `192677f..506f081` (prompts 104–106, 109 and the geometry heading) at 16:21 UTC; prompt 110 pushed
  `506f081..69616fe`. A real `git fetch origin` on 2026-09-22 read `origin/main` at `69616fe` with the
  tree zero commits ahead, and Vercel built `69616fe` **READY** on production (deployment
  `dpl_2tCTCbjBFPzMs7E4Eb8shjhMzct6`, GitHub commit status success 16:21:02 UTC). The text below is the
  record of the question as it stood. ~~**Vercel has compile-checked none of it**,
  which is worth knowing before the next prompt stacks a fourth.~~ Both briefs withheld the push deliberately: the
  work changes in-season broadcast data and publishes new artwork, and Joe authorizes the deploy
  himself after looking at the rendered samples — `assets/p104-composite-marks/` for the marks as
  first built, and **`assets/p105-composite-width-match/` for the before/after of his width-match
  ruling**, which is the current state (both untracked). **ONE authorization, not two, and the brief expected
  two:** `git push` is the whole of it. **There is no R2 push for these marks and there was never
  going to be** — `web/lib/config.js:253` says the processed marks are what "the app ships itself
  (web/public/marks), NOT the raw bucket art", `markUrl()` returns the app-relative `/marks/{slug}.png`,
  and `scripts/sync_assets.py` syncs only `assets/{logos, network-logos, fonts, brand}`. The two PNGs
  are tracked files that reach production with the deploy. `--check` confirms it: local-only still
  reads 29, the same set prompt 95 recorded, with neither composite among them. **Nothing renders from
  any of this yet**: prompt 105 owns the row and the card.
- ~~**OPEN — SMOKE IS RED ON LIVE DATA, NOT ON CODE: THE 2026-09-23 08:00Z REFRESH LOADED MLB POSTSEASON
  PLACEHOLDER TEAMS.**~~ **CLOSED 2026-09-23 by prompt 114 rev B — Joe's ruling: widen the placeholder rule, no
  colour rulings for placeholder ids (register §60). Smoke 33/33 again, and it names the seven it exempts.** The
  text below is the record of the finding. `smoke.mjs`'s *"the only unruled pro rows are TBD placeholders"* requires every unruled
  pro id to end in `-TBD`; the refresh (`schedule_refresh` run 35834681015) loaded seven MLB rows that do not —
  `mlb-4614` "AL #3 Seed", `mlb-4617` "NL #3 Seed", `mlb-4619` "NL Wild Card #1", `mlb-4944`–`mlb-4947` the
  Wild Card #2/#3 seeds — with null colours, carried by four 2026-09-29 Wild Card games (`mlb-849843`,
  `-849845`, `-849849`, `-849851`, the last against the Yankees). Found by prompt 114's gate run; the check reads
  `teams` only and cannot be moved by a stylesheet. **Joe's ruling:** widen the placeholder rule (a name or a
  null-colour test rather than the `-TBD` suffix), or rule these ids a colour. Until then every run's smoke is
  red and nothing commits (S4). Prompt 114's own work sat uncommitted behind it until rev B.
- **OPEN — AFTER THE NEXT SCHEDULED REFRESH, COWORK READS THE WEEK 3 AND WEEK 4 CBS/FOX STATUSES AND THE WINDOWS
  FILE'S NOTES (prompt 118, register §63).** The refresh at 07:37 or 11:37 UTC applies rule 4b for the first time; Joe
  decides any dispatch before that. Expected from the pages read 2026-09-23: week 3 (2026-09-27) CBS 1:00 rows are
  `AVAILABLE` for CIN @ PIT with an `entitledsports week 3` source and `OUT_OF_MARKET` for every other CBS early game;
  CAR @ CLE is `AVAILABLE` by the Browns rule; the 4:05 / 4:25 rows stay `UNVERIFIED` until the site names the late
  windows; week 4 (2026-10-04) stays `UNVERIFIED` throughout until its page is updated. The windows step's log line
  should read `weeks 3, 4 (ESPN calendar), N of 8 windows named, 0 note(s)`; a note means the page carried a window
  text the reader has not seen, and the text is in the note. **Schedules Direct is dormant by ruling (no paid
  data)**; its prompt 117 OPEN item is closed unfulfilled, not carried.
- ~~**OPEN — AFTER THE FIRST PRODUCTION REFRESH, COWORK CONFIRMS `computed_at` IS FRESH FOR THE NEXT 7 DAYS' GAMES,
  AND THAT 2026-10-04'S NFL ROWS RESOLVE (prompt 123, register §66).**~~ **CLOSED 2026-09-29 by prompt 121 rev B
  (register §68).**
  - The first refresh after the push (09-28, `github_sha` `c561ba2`) logged `eligibility_only` **819** and
    `eligibility_changes` **14** in its reconcile row, against a forecast of about 802 and 14. Those are Cowork's
    SELECTs: `refresh_runs` answers 401 to the anon key.
  - Re-read by prompt 121 through PostgREST: queue item 16's query returns **0** games for viewing days 2026-09-29
    to 10-05 (146 games, 133 with broadcasts).
  - Every 2026-10-04 NFL CBS/FOX row carries its access's verdict. It is market pending only on MIA @ MIN
    (4:05 p.m. ET, FOX), the one `unverified` row.
  - Queue item 16 is buildable.

  The text below is the record of the item. The item above's rows reached
  `game_broadcasts` and never reached `viewer_game_eligibility`, so Sunday 2026-09-27 showed "Market TBD" all day.
  The default reconcile now re-decides eligibility for every game whose broadcast rows moved, so the first refresh
  after the push, scheduled or dispatched (Joe decides any dispatch), is also the backfill. In that run's
  `refresh_runs.notes` for the `reconcile` workflow row, expect `eligibility_only` near **802** and
  `eligibility_changes` near **14**, all NFL (forecast from 2026-09-28's rows; the load before it moves both a
  little). The reconcile log's `ELIGIBILITY` lines name each change. Then check two things with read-only
  queries. First, `docs/queue.md` item 16's query returns **0** games (it returned 34 before the push). Second,
  2026-10-04's NFL CBS/FOX rows carry the verdict their `game_broadcasts` access says: `linear cbs|fox` where
  `available`, not pending where `out_of_market`, and "Market TBD" only where the row is still `unverified`.
  Then queue item 16 can be built.
- **OPEN — JOE SUPPLIES THE WORKER TOKEN'S EXPIRY DATE (prompt 121 rev B, register §68; deployment contract §5).**
  The refresh's primary trigger is Joe's Cloudflare Worker, which dispatches `schedule_refresh.yml` at 4 a.m.
  Cleveland time using a fine-grained token scoped to this repo. If that token expires, the dispatch fails inside
  Cloudflare and nothing in this repo goes red: no run is created, so there is no failed run to see. Only the
  crons, measured hours late, would remain. The date goes in the contract's Worker row. The Worker's URL and
  account stay out of this public repo.
- **OPEN — ON 2026-11-01, CONFIRM THE WORKER'S DISPATCH MOVES TO 09:00 UTC (prompt 121 rev B, register §68).**
  This is the Cleveland-clock guard's first run across a time change. Every dispatch since 2026-09-17 was
  created at 08:00–08:01 UTC (4 a.m. EDT). From 2026-11-01 (EST) it should be created at 09:00 UTC, and never at
  08:00. `gh run list --workflow schedule_refresh.yml --json event,createdAt` answers it. A dispatch at 08:00
  UTC, or at both hours, means the guard is not doing what Cowork recorded.
- **OPEN — CONFIRM ON 2026-09-28, AFTER THE 07:37 UTC REFRESH, THAT THE FOUR WILD CARD GAMES CARRY REAL TEAMS,
  TIMES AND NETWORKS (prompt 116, register §61).** `mlb-849843`, `-849845`, `-849849` and `-849851` carry MLB's
  placeholder seeds today; the seeds clinch after Sunday 2026-09-27 and the loader now follows the source for a
  game's teams, logging each flip to `refresh_runs.notes.team_changes`. Cowork checks with a read-only query; the
  notes of that run should name four away/home changes. If they do not, the adapter's `side()` or the window is the
  next place to look, not the loader.
- **OPEN — 114 IS COMMITTED, AND AWAITS JOE'S iPAD SHOTS FROM THE PREVIEW (2026-09-23, register §59).**
  The iPad headroom is in `main` locally and NOT pushed; the only push the run may make is a preview
  branch (`p114-ipad-scrim-preview`) after Joe types `preview`. Milestone "iPad banner fixed" closes on
  Cowork's measurement of Joe's three shots off that preview — the navbar hairline at screen y ≈ 107,
  both wordmarks' first ink at ≈ 77–78, every wordmark row ≥ 0.98 of its reference — **not on a gate**:
  Chromium has no scrim, so every gate here proves geometry and nothing about legibility.
- **OPEN, FOR JOE — TWO OF THE FIFTEEN SIMULCAST GAMES COLLIDE WITH A NATIONALLY EXCLUSIVE ROW
  (prompt 106, register §53).** `nba-401910445` (2027-01-29 TOR, announced WOIO) carries **ESPN** and
  `nba-401910691` (2027-03-09 DET, announced WOIO **and** WUAB 43) carries **NBC**, both in
  `NATIONAL_EXCLUSIVE`. **So those two emit no simulcast row today**, and carry no DAZN row either —
  the adapter suppresses local feeds under national exclusivity, which prompt 106 respected rather
  than worked around. Whether the national selection supersedes the announced OTA simulcast, or the
  2027 national data is provisional and will move, is not decided. Worth a look before the season.
- **The privacy gate before the Cavs season (late October) — STILL OPEN, and its premise changed on
  2026-09-15.** Production is a public URL. The gate was written when the WUAB/RESN arrangement was
  UNANNOUNCED and hand-entered on Joe's authority; **WOIO/WUAB have now announced the fifteen-game
  schedule publicly** (register §51, `docs/research/research-changelog.md` 2026-09-16), so what would
  be published is a public fact rather than a private one. **That is a change of premise, not a
  ruling: the item stays open and Joe closes it.** Prompt 104 landed the data and the artwork and
  emitted no broadcast row at all — `adapters/nba.py`'s simulcast path deliberately returns nothing —
  so nothing is published today either way. `CLAUDE.md` rule 8 is untouched and still binds: it
  protects Joe's human sources, never the call signs, which this repo has always named.
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
- ~~**LIVE DEFECT — `--pull` NEVER CORRECTS A STALE LOCAL FILE, AND `--push` THEN REPUBLISHES IT (prompt
  93, register §42).**~~ **CLOSED by prompt 94** (register §43): `scripts/sync_assets.py` now compares
  bytes in both directions — size, then the listing's ETag against the local MD5, and a `head_object`
  only for a multipart or absent ETag — so a cached file whose bytes differ is pulled again, and a key
  that differs on both sides is reported as a CONFLICT instead of being silently republished. Pinned by
  `tests/test_sync_assets.py`, whose regression test is
  `test_pull_retakes_a_cached_file_whose_bytes_differ_from_the_bucket`.
- ~~**THE BUCKET HOLDS CONDITIONED DARK ART FOR 25 NBA TEAMS JOE RULED RAW — a live defect (prompts 94–95,
  register §44).**~~ **CLOSED by prompt 96** (register §45): `build_web_marks.rule_key()` makes the
  ruling match in any case, on both the rulings and the filename, so the runner's lowercase pulled files
  (`nba-bkn.png`) now hit `nba-BKN`. `data/logo_conditioning.json` is unchanged. **The bucket corrects
  itself on the next nightly — not by a manual push:** the ruled-raw branch sees the conditioned dark file
  differ from its base, copies the base over it, and the logo push rewrites the 25 existing objects
  (proved in scratch, idempotent on a second run). **Until that nightly runs, the 25 conflicts remain in
  `--check`.** What the run should log: `0 generated, 25 copied raw (ruled skip_derive)` and `pushed 25`.
- **29 LOCAL-ONLY FILES ON JOE'S LAPTOP — the guard now stands between them and the bucket (prompt 95).**
  `--check` lists 29 files under `network-logos/` and `brand/` that the bucket lacks, among them the
  retired and rejected art prompts 68–69 stopped (`hbo-max-wide-2023-retired.svg`,
  `app-icon-mysports-tv-v5-retired.png`, `…-v6a-rejected.png`). A bare `--push` now refuses, exits 3 and
  lists all 29 before any upload; publishing any of them takes `--allow-new`, deliberately. Whether some
  of them SHOULD be published is Joe's call.
- ~~**`bootstrap_season.yml:49` NEEDS `--allow-new` BEFORE ITS NEXT DISPATCH (prompt 95).**~~ **CLOSED by
  prompt 96**: the bare `--push` now passes `--allow-new`, with a comment saying the workflow exists to
  fetch art the bucket does not have yet.
- **THE NIGHTLY IS BEST-EFFORT, AND IT HAS BEEN MEASURABLY LATE (prompt 97, register §46).** GitHub queues
  scheduled workflows: the old `0 11 * * *` started a median 3h44m late (worst 5h13m) over 12 days, and
  on 2026-09-14 it had not fired 5h22m after it was due, which left that day's cards on Friday's records.
  **The mitigation is the second run** — `37 7` and `37 11` UTC since prompt 97 — which buys redundancy,
  not punctuality. **If both runs still drift, the next thing to try is an external trigger calling
  `workflow_dispatch` through the API** (a scheduler outside GitHub). Not built; not approved. The first
  scheduled run under the new times is the real test.
- ~~**THE STANDALONE `render_all` SCHEDULE FIRED BEFORE THE REFRESH EVERY DAY (queue item 10).**~~ **CLOSED by
  prompt 98** (register §47): Joe ruled it dropped, and `render_all.yml` has no schedule of its own. **The
  render now runs only after a refresh** (the refresh's `render` job) or on manual dispatch — twice a day
  since prompt 97. `docs/deployment-contract.md` §5 corrected to match (v1.0.4).
- **ACTIONS MINUTES: THE BUDGET CLEARS, WITH LESS ROOM THAN THE CONTRACT CLAIMED (prompt 98, register §47).**
  Measured from job times (billing API unreadable — it needs the `user` token scope), September so far is
  478 runner-minutes; a refresh run is a median of 15 minutes, 22 over the last six. Two runs a day
  projects to ≈ 900–1,320 minutes a month against 2,000 (45–66 %), and a `bootstrap_season` build-out
  (queue item 7; one run took 48 minutes) comes out of the same allowance. **Not close today; worth
  watching as the job grows.** The account's real figure needs `gh auth refresh -s user` or a look at the
  GitHub billing page — Joe's.
- ~~**OPEN — THE STATUS BAR IS `black` NOW, AND ONLY JOE'S PHONE CAN SAY WHETHER THAT FIXED THE WASH
  (prompt 99, register §48).**~~ **CLOSED 2026-09-16 — Joe tested the installed app after prompt 101
  deployed and reported *"It works — we're good."*** Rule 25's second half is satisfied for the banner:
  `web/app/layout.js` emits `apple-mobile-web-app-status-bar-style` = `black`, iOS draws its own opaque
  bar, and the wash over the wordmark is gone. **Two kinds of evidence, and they are not the same.** The
  BEFORE state is measured at pixel scale (the matched pair below); the AFTER is Joe reporting by eye on
  the device. **There is no post-fix pixel measurement**, and nobody should later read this entry as if
  there were. **ONE HALF OF THE ORIGINAL CRITERIA IS WEAKER THAN THE OTHER, said plainly:** the criteria
  were *"a dark opaque bar owned by iOS, the banner starting just below it, and no wash over the wordmark
  **or the collapsed header**."* The banner half is confirmed directly. **The collapsed header was never
  measured for wash** — the basis is Joe reporting the navbar rendering correctly across several
  screenshots, which is weaker, and is recorded at that strength rather than rounded up.
  **THE PRE-MEASURED FOLLOW-UP IS WITHDRAWN — DO NOT APPLY IT (prompt 101, 2026-09-16), AND CLOSING THIS
  ITEM DOES NOT REVIVE IT.** The line
  §48 wrote out (`margin-top: calc(-100% * 4.392 / 428)`) moves the wordmark 4.4 CSS px UP, and the
  matched screenshot pair of 2026-09-16 found iOS 27 feathering a scrim down to ~90 CSS px with the
  wordmark inside it — so up is darker, not better. §48 carries the reversal; register §50 has the
  pixel figures. The wordmark's first ink sits **4.41 CSS px below the bar at 430** (4.00 at 390) and
  stays there. For comparison: Joe's first ruling was 18 px, and
  under the translucent style the ink sat 5.59 px inside the band. **The revert is one word**, `black` back
  to `black-translucent`, plus the same reinstall.
- ~~**OPEN — BLOCK B IS PROVISIONAL UNTIL JOE'S PHONE AGREES (prompt 101, register §50).**~~ **CLOSED
  2026-09-16 — Joe confirmed on the device, by eye: the restored wordmark is no longer washed.** The
  wordmark's tap-restore re-arms the banner pin, and the SHIP is no longer provisional.
  **THE EXPLANATION IS STILL A HYPOTHESIS, and that is not a formality.** What Joe confirmed is the
  OUTCOME. The MECHANISM — that an element holding the top edge suppresses iOS 27's scroll-edge scrim —
  still rests on three consistent observed states and is not proof. A working fix is evidence FOR the
  hypothesis, not a promotion of it to fact. **If the scrim ever comes back after a change to the pin,
  read that sentence first**: the mechanism was never nailed down, so the pin is the suspect but not a
  proven cause. Before this change the wordmark measured **0.484 of full brightness** at the top of the
  capitals (pixel-measured); the after is Joe looking at his phone, with no post-fix measurement.
  The fallback that was held in reserve — headroom above the wordmark — was NOT needed and was not
  taken; the space stays where prompts 46, 50 and 51 left it.
- ~~**STALE COMMENTS PROMPT 99 COULD NOT CORRECT — `globals.css` was read-only for it (rule 30, owed).**~~
  **CLOSED by prompt 102** (2026-09-16): `globals.css`'s banner comments now say what is true. The header
  no longer claims the banner bleeds *"under the translucent status bar"*; the drawing's headroom reads
  **4.392 stage px** rather than *"11"*; and the measured table is kept as dated history with its two
  corrections named — `d24e8e0` moved the baseline 36.88 → 29.88 so the ink sat 5.59 px INSIDE the band,
  and prompt 99's `black` makes the inset 0. Figures taken from Addendum M22 v2.3, which agreed with the
  handoff figures exactly. **Comments only, proved rather than asserted:** with every comment stripped,
  the stylesheet is byte-identical before and after (same sha256), and the comment delimiters balance at
  262/262. **Three more of the same staleness were found and fixed in the same pass** beyond the three
  this item named — the old `:1991` *"the 11 stays in the drawing"*, and the standalone block's
  *"4 here + the artwork's own 11"* and *"lands exactly on the inset's lower edge"* (rule 32: a
  correction is not done until every place saying the same thing obeys).
  **STILL OWED, AND NOT THIS PROMPT:** `web/components/Banner.js:21` and `banner-mobile-v2.json`'s
  `stage.units` note both still say the phone banner is *"width x 155/428"* when the viewBox has been
  428 × 135 since `d24e8e0`. It touches a component and a data file, which prompt 102's scope excluded.
- ~~**A SECOND AGENT REACHED THIS REPO ONCE AND LEFT A COPY OF THE RULES BEHIND (found by prompt 99).**~~
  **CLOSED by prompt 100** (register §49, Joe's ruling 2026-09-15: Codex got in by accident). The
  untracked root `AGENTS.md` (22,539 bytes, 2026-09-14 16:00 EDT) was `CLAUDE.md` at `d6cd7b2` with
  "Claude Code" renamed to "Codex", byte for byte, and it had already drifted two rows. It was deleted
  and deliberately **not** gitignored: if it comes back it shows as `?? AGENTS.md` in `git status`, and
  that visibility is the guard. No new working rule; rule 2 covers a second writer.
  **AND IT CAME BACK, AND VISIBILITY WAS NOT A GUARD (prompt 109, 2026-09-22, register §54 block F).**
  Written again 2026-09-16 23:31 UTC — `CLAUDE.md` with "Claude Code" → "Codex", byte for byte,
  22,540 bytes — and it sat as `?? AGENTS.md` through three commits until 2026-09-22. **Joe's
  corrected cause: Codex output for an entirely different project that landed in this folder** — a
  stray write, not a second agent on this repo. **Joe's ruling:** `CLAUDE.md` is the only
  agent-instruction file this repo has, and a reappearance of any other is a RED GATE.
  `tests/test_agent_instruction_files.py` fails on any of six conventions at the root. Deleted again;
  still not gitignored.

## Working rules — not in this file

**The binding working rules live in `CLAUDE.md`, section `## Working rules (binding)`, and that section
is the authority on them.** The incidents behind them are in **`docs/rules-casebook.md`**, which is
history and never binding.

**This file is the authority on state** — repo state, gate floors, open items — **and not on rules.**
It carried a second, longer copy of the rules until 2026-09-11, when prompt 89 removed it on Joe's
ruling; that copy had already fallen two rules behind `CLAUDE.md`. Register §38.
