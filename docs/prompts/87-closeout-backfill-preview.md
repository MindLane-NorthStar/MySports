# PROMPT 87 — the close-out, the game-link backfill, and the Preview's new home

**Written by Cowork 2026-09-10, after prompt 86 shipped (`1b458a0`, `a24f7af`, `f08d7dc`) and
migration 0018 was applied.** Three blocks. **Block A is the one that matters most** — if the clock
beats this run, stop after A and the other two carry forward as their own prompt.

Read `CLAUDE.md` and `docs/handoff-status.md` first.

## SELF-COMMITTING RUN — RULE 7 MODE

Joe authorized this on 2026-09-10 for **this brief**. Each block commits and pushes its own work once
its five gates are green. Two-strikes-skip applies. Hard stops: a secret-gate hit, a destructive
database operation, a rejected push, a red Vercel deploy, or any gate below its floor.

**Block B's backfill is a database write and is NOT covered.** Rule 14: named approval per operation.
Count, paste, wait.

---

## STEP 0 — GEOMETRY IS PROBABLY ALREADY RED. FIX THAT FIRST.

The `schedule_refresh` run at ~19:00 UTC on 2026-09-10 loaded Countdown: **16 instances**, confirmed
in the database. So Sept 13 now starts at 10:00 rather than 11:00 and `npm run geometry` should be
failing on that day's span.

1. Run `npm run geometry` from `web/` before anything else.
2. If it fails on Sept 13, **check the delta is exactly the 60 minutes Countdown adds at the front of
   the day.** If the span moved by anything else, stop and report — that is not the data.
3. Re-pin with the **measured** figure, never the predicted one.
4. If geometry is green, say so and move on — do not go looking for a failure that isn't there.

This lands in Block A's commit.

---

# BLOCK A — THE CLOSE-OUT

The goal is one sentence: **a fresh session should be able to start from the repo and the Project
alone, with no transcript.** Everything below serves that.

## A1. Split `docs/handoff-status.md`

It is **155KB**, and every session must read it. That is the single largest fixed cost of starting
work here.

- **`docs/handoff-status.md` keeps**: the `## Repo state` section including the gate-floor table and
  the movements table, every `### OPEN` item, the working rules in full, and the entries for the
  three most recent prompts (85, 86, 87).
- **`docs/handoff-archive.md` takes**: the closed prompt histories, the superseded sections, the
  detailed run narratives for prompts 53–84. **Tracked, not deleted.**
- The archive opens with a one-paragraph header saying what it is and that
  `handoff-status.md` remains the authority for anything current.
- `handoff-status.md` gains a single pointer line to the archive near the top.

**NOTHING IS DELETED AND NOTHING IS REWRITTEN.** Move text verbatim. This file's history is the record
of why several decisions were made, and a "tidy" that loses a reason is worse than the 155KB.

**Report the two resulting byte counts.**

## A2. Correct every stale note — in place, per rule 30

Each of these was found by reading the file, not by inference. Verify each before changing it; a note
recording an absence is a timestamp.

| where | what it says | what is true |
|---|---|---|
| `CLAUDE.md`, Read-first table | `docs/prompts/` is *"62 files covering 01–60, verbatim; 39 and 42 are the only gaps"* | false once A3 lands — rewrite it to match what is actually there |
| `docs/research/mlb-tv-tap-test.md` | the tap from inside the installed PWA is unproven | **proven 2026-09-10** — Joe tapped the MLB.TV link from inside MySports TV and the MLB app opened. `target="_blank"` on `GameDetail.js:64` does NOT suppress the universal-link hand-off. Block F is closed. |
| `handoff-status.md` ≈`:850` and ≈`:902` | two `### OPEN — GRID VIEW HAS NO COLLAPSED BAR` entries | superseded by `### CLOSED — THE NAVBAR NOW RENDERS IN GRID VIEW` at ≈`:756`. Mark them closed where they sit; do not delete. |
| `handoff-status.md` ≈`:1538` | *"THREE STUDIO SHOWS STILL HAVE NO ART"*, naming `foxnflkickoff` | `data/brands.json` gives `foxnflkickoff` a `mark_dark` and `web/public/programs/fox-nfl-kickoff.png` exists (11,987 bytes). Re-check all three and correct the count. |
| `handoff-status.md` ≈`:722` | `### OPEN — AN NFL BAND STILL LISTS ITS PREGAME SHOW AFTER THE GAME` — *"`allRows` is unsorted for every scope"* | **predates prompts 80 and 82**, which added the `chronological()` sort called at `app/page.js:561`. **Check whether it is still live** — Countdown is now a Sunday NFL pregame show and would hit it. Close it or restate it with today's evidence. Do not leave it as a timestamp. |
| `db/README.md`, register §7 | anything still describing Countdown as not loaded | prompt 86 corrected these; confirm nothing was missed |

## A3. Backfill `docs/prompts/`

The directory stops at 60. Prompts **61–86** exist in the Claude Project under `claude/`. Copy them in
under the directory's existing naming convention. Where a prompt has more than one revision (86 has
three), file the **revision that was actually run** and name the others as superseded, or file only
the run one and say so in A2's `CLAUDE.md` rewrite. Report how many files landed.

## A4. Move the superseded root specs to `docs/archive/`

Six files, ~237KB, at the repository root, **referenced by no authority document** — Cowork grepped
`CLAUDE.md` and `handoff-status.md` for both name stems and found nothing:

```
CFB_TV_GRID_AGENT_BUILD_SPEC_v0.1.md
CFB_TV_GRID_AGENT_BUILD_SPEC_v0.2.md
CFB_TV_GRID_AGENT_BUILD_SPEC_v0.3.md
CFB_TV_GRID_AGENT_SOURCE_AUTHORITY_v0.1.md
MYSPORTS_BUILD_SPEC_v0.4.md
MYSPORTS_BUILD_SPEC_v0.5.md
```

`git mv` them to `docs/archive/`. **Confirm each is tracked before moving it** — a `git mv` on an
untracked path is the exact defect prompt 81's draft carried. Add `docs/archive/README.md` naming
what they were, when they were superseded, and by what.

The hazard being closed: a fresh agent lands in the root and reads the file called
`MYSPORTS_BUILD_SPEC_v0.5.md`.

## A5. Create `docs/queue.md` — the work that is real and not started

New tracked file, wired into `CLAUDE.md`'s Read-first table. Each entry gets: what it is, why it
matters, the file and line where the work starts, and how big it is. **Not a TODO list — a briefing
for someone who has not read this conversation.**

Seed it with these, and check each against the tree before writing it down:

1. **The Thursday NFL hole in `.github/workflows/schedule_refresh.yml`.** The NFL step fetches exactly
   two dates: yesterday, and `t + timedelta((6 - t.weekday()) % 7)` — the coming Sunday. **A Thursday
   game is in neither on the day it is played.** Measured 2026-09-10: SF @ LAR was the only game on
   the slate with no stored link, while all six others had one. It is picked up Friday as
   "yesterday," after it has finished. Same shape will hit Saturday NFL games in December. **The real
   question is whether NFL should get a 7-day window like NBA and MLB rather than a two-day patch** —
   that is a design call, not a typo fix. Note that Block B's backfill removes the *visible* symptom
   but not the underlying one: Thursday games will still carry stale kickoff times and no live scores.
2. **ESPN deep links.** Evidence gathered, not started. `docs/research/universal-links-aasa-2026-09-07.md`
   holds what 23 services claim. Now easier than it was: the MLB result in A2 proves a universal link
   survives the PWA's `target="_blank"`.
3. **The 34-row watch-link audit table**, for Joe's eye. `docs/research/watch-links-2026-09-09.md`.
4. **Three MLB rows stuck at `scheduled` while carrying a link** — `mlb-823908`, `mlb-823984`,
   `mlb-825038`, all `viewing_day` 2026-09-01. They were in progress when a loader run wrote the URL
   and the status never advanced. Three rows out of 3,953; a data oddity, not a code defect.
5. **`boxscore_url` is now a misleading column name** — it holds a preview URL before kickoff. The
   rename reaches `web/lib/queries.js:25`, the PostgREST select list and every test that names it.
   Deliberately deferred from prompt 86.
6. **Monday Night Countdown's two corrections**, already in register §35 — the release gives an NFL
   Network simulcast and a 6–8 p.m. window; `data/studio_shows.json` has `simulcast: null` and
   `duration_min: null`. Left alone on purpose; the bookend rule currently produces a correct result.
7. **Studio shows stop at Dec 31.** `schedule_refresh.yml` runs `load_studio_shows.py --through
   2026-12-31` while the registry's `active_to` is `2027-01-03`, so the Jan 3 Sunday is missing for
   every NFL Sunday show. WWE and AEW carry the same hardcoded cliff.
8. **Building the schedule out to April 2027.** Joe's stated goal. `bootstrap_season.yml` already
   takes `nhl_from`/`nhl_to`, `nba_from`/`nba_to` and `nfl_weeks`, so the vehicle exists. Three things
   to settle first: the nightly's forward horizon is one week at most for every sport; **schedule and
   broadcast are different problems** — NBA and NHL publish full seasons but national TV assignments
   cover only part of them and the NFL flexes windows on ~12 days' notice, so most of a season-long
   calendar would carry no channel and render "Not yet confirmed"; and UFC cannot be built that far at
   all, since the source announces cards 8–12 weeks out.

## A6. Record the `.env` contradiction as a decision, not a contradiction

`CLAUDE.md` rule 14 states *"there is still no direct Postgres connection and no writer credential in
the repo, in `.env`, or in any prompt."* **`.env` contains a live `mysports_writer` password**, and
`docs/deployment-contract.md` §142 is what told Joe to put it there. `.gitignore:1-2` covers `.env`
and `.env.*`, so it cannot be committed — this is not a leak, it is two documents disagreeing.

Write it up in `docs/queue.md` as a decision waiting on Joe, with both sides stated: removing it means
local loader runs stop and everything goes through the nightly Action; keeping it means rule 14 is
false as written and should be amended instead. **Do not change either document, and do not touch
`.env`.**

## A7. Gates, then commit and push

All five as their own commands, all five reported. Suggested subject:
`docs: the record is split, the queue is filed, and the stale notes are corrected`

---

# BLOCK B — EVERY GAME GETS ITS LINK

## What was measured

After today's refresh, from the database:

| status | games | with a link |
|---|---|---|
| scheduled | 3,717 | **190** |
| final | 234 | 234 |
| in_progress | 2 | 2 |

The 190 are only the games inside the nightly's refresh window. Beyond it: Sept 17 NFL 0 of 1,
Sept 18 CFB 0 of 3, Sept 18 MLB 0 of 15.

**The link does not need a source fetch.** `pipeline/load.py:75-80` derives it from the sport and the
game's own id and nothing else. `SCORES_SQL` only runs for games in the fetched payload, which is the
only reason coverage is patchy.

## Do this

1. **`db/migrations/0019_backfill_game_urls.sql`.** Populate `boxscore_url` for every row that has
   none, deriving it exactly as `boxscore_url()` does — including the asymmetry at `load.py:80`, where
   **cfb uses the whole id and every other sport uses the part after the first hyphen.** Guard it:
   `where boxscore_url is null`, so nothing already stored is touched.

2. **A test that the SQL and the Python agree.** This is the point of the block, not a nicety —
   putting the same per-sport mapping in two languages is the thing prompt 78 ruled against. Assert
   for each of cfb, nfl, nba, nhl, mlb that the migration's expression and `boxscore_url()` produce
   the same string for a known id. **Mutation check: change one template in the SQL and the test must
   fail.**

3. **Count first, then wait.** Report how many rows would be touched, broken down by sport, and
   **stop for Joe's approval by name** (rule 14). Check the schedule first (rule 27) — a refresh ran
   at ~19:00 UTC today.

4. After approval, apply it from the file, report the rows touched, and re-count to confirm zero rows
   remain without a link.

**In scope and not:** this fixes the missing *link*. It does not fix the Thursday hole — those games
still carry stale kickoff times and no live scores, which is queue item 1.

## Gates, then commit and push

The migration is applied after the code is pushed, same ordering as 0018 and for the same reason.

---

# BLOCK C — THE GAME LINK MOVES BESIDE THE STATUS

## What Joe asked for, and what was measured

The link currently renders in the panel's link row — under the "Watch Live on" buttons when a service
is accessible, and under the "Where to watch" list when none is. **Joe wants it in the empty cell to
the right of the Status/score pair**, the full two-row height, aligned with the right-hand column.

Cowork built the options at pixel scale and Joe chose **Option A: lift Status and the link into their
own guaranteed two-column row.** The reasoning, measured:

- `.dgrid` at `globals.css:1723` is `repeat(auto-fit, minmax(130px, 1fr))` — **not a fixed two
  columns.** The count comes from the width.
- `.dpanel` is `width: min(560px, 100%)` (`globals.css:1568`). At 560px the content is 528px, and
  three 130px columns plus two 8px gaps is 406px — **so the grid takes a third column on desktop.**
- The venue block is **conditional**. With no venue there are only two cells, so Status sits in the
  right column of row one and there is no empty slot beside it.

Simply appending the link as a fourth grid cell gives the right answer only in the case Joe
photographed. In the other two it lands in the wrong corner.

## Do this

1. **`web/components/GameDetail.js`.** Take the Status/score cell out of `.dgrid` and render it with
   the link in their own row beneath — Status left, link right, two explicit columns at every width.
   When there is no link the right slot is simply empty; **no placeholder.** Every program and every
   game the loader has not reached hits that path.

2. **The link no longer renders in the links row.** Remove it from both branches — the
   `.dlinks-watch` block and the `.dlinks` block under "Where to watch". Working rule 32: `git grep`
   for every place it renders and confirm those are the only two, or say what else you found.

3. **The button stretches to the full two-row height**, centred, keeping `.dlink`'s existing border,
   radius, gold and weight. `align-items: stretch` so a wrapped "Live box score" grows the button
   rather than clipping.

4. **Apply it at both breakpoints** — Joe's ruling. One layout, one contract clause.

5. **DELETE the closing sentence about the link entirely.** The panel's last line currently reads
   *"Watch links are best effort - they open the service, not this game. Preview opens this game's own
   page."* **Keep the first sentence. Remove the second completely** — no reworded replacement, and
   nothing describing Preview, Live box score or Box score. Joe's words, 2026-09-10: *"we don't need a
   sentence describing any of the three."*

6. **Amend `docs/rendering-contract.md`** where the detail panel's anatomy is specified. A layout
   change that does not reach the contract is drift.

## Assertions

- The link is a child of the status row and not of `.dlinks`, in both the accessible and
  not-accessible branches.
- With no `boxscore_url`, the row renders and the right slot is empty.
- A program row never produces one.
- **qa-shots, and this is the one that decides it:** at phone width AND at 560px, assert the link's
  box top aligns with the status label's top and its bottom with the status value's bottom, and that
  the closing paragraph contains no occurrence of "Preview", "box score" or "own page". Capture the
  PNG and **say in a sentence what it looks like.**
- **Mutation checks:** put the link back in `.dlinks` and the placement test must fail; restore the
  deleted sentence and the copy test must fail.

## Gates, then commit and push

All five, all reported. Then report the Vercel result and **stand by.**

---

## Standing rules

- Joe's commit-and-push approval covers **this brief only**. Block B's database write is excluded.
- Gate floors: `docs/handoff-status.md` under "Repo state", nowhere else.
- Never write to the repo while another prompt is in flight.
- `assets/` is untracked on purpose.
- WUAB and RESN are never named. Credentials never enter the repo or a committed doc.
