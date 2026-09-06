# Claude Code — Prompt 37: the data, the grid polish, and the card redesign

**Repo:** `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` · **main**

**Preconditions, hard stop if any fail:**

- `git rev-parse HEAD` == `3793e6d`, and `HEAD == origin/main`.
- JS **185/185**, smoke **30/30**, qa-shots **14/14**.
- Tree clean apart from untracked `assets/`.

**Python is NOT a precondition here — A1 fixes it.** `pytest` and `psycopg` are both missing from the machine, which is why prompt 36 could not run the Python suite. Once A1 lands, the Python gate applies to every phase after it.

**Run start to finish without stopping.** Three phases, each gated and committed on its own. Preconditions are checked **once, here** — later phases begin from whatever the earlier ones left, so do not re-assert `3793e6d`.

**Joe has pre-approved every database write named in this brief.** Phase A does not stop for confirmation on A2, A3 or A4. It still runs each one's dry run first and reports the diff — that is rule 6's SELECT-and-paste, satisfied by evidence in the report rather than by waiting. **Anything destructive that this brief does not explicitly name remains a hard stop.**

**Hard-stop policy.** Stop that stage, leave earlier phases' commits alone, record what stopped and why, continue to anything that does not depend on it. Never roll back a green phase because a later one failed.

**Working rule 22** — locate by content, and **report any citation in this brief that does not match.** Prompt 35's brief carried six errors and prompt 36's carried three; every reference below was read this session and that was true both times too. **Rule 23** — `docs/design/mobile_demo.html` changes in the same commit as anything it specifies. Also rules 3, 4, 13, 16, 20.

## How the database writes happen — read this before A2

**Rule 14 is not a bar on writing. It is a bar on ad-hoc DML.** The repo already has a sanctioned write path and this prompt uses it exclusively:

- `pipeline/db.py` — one connection against `SUPABASE_DB_URL`, batched upserts, and an **`--emit-sql` dry-run mode** that collects statements to a file instead of executing them. That mode *is* rule 6's "SELECT-and-paste first", implemented in code.
- `scripts/apply_migration.py` — applies one `db/migrations/*.sql` in a single transaction, with `--dry-run` that executes and rolls back so the file's own verification still runs.
- `scripts/backup_table.py` — run it before any UPDATE.
- `db/migrations/` is at `0010_market_pending.sql`; `db/README.md` is the ledger.

**Do not hand-write DML at a psql prompt and do not invent a second connection path.** Every write below goes through one of those three scripts.

---

# PHASE A — the data

## A1 — install what is missing

`pip install -r requirements.txt` (pillow, boto3, **psycopg[binary]>=3.2**) and `pip install pytest`. There is no venv at the repo root; match whatever interpreter the existing scripts use and **report which one**, because working rule 1 is "certify Python for Windows" and a second interpreter is exactly how that rule gets broken.

Then run the Python suite and **report the number**. Prompt 36 could not, so the last known figure is prompt 35's **200 OK (skipped=1)**. If it comes back different, that difference is a finding — say so rather than adopting the new number silently.

## A2 — reconcile the division seed, which is ALREADY APPLIED

**Cowork applied this directly through its Supabase connector before this prompt was written.** It reported **10 conference rows inserted and 94 teams assigned**. Do not re-apply it as new work; **reconcile the repo with the database.**

What was written:

- Into `mysports.conferences` — NFL `nfl-afc-east|north|south|west`, `nfl-nfc-east|north|south|west` named `AFC East` … `NFC West`; NHL `nhl-atlantic|metropolitan|central|pacific` named `Atlantic`, `Metropolitan`, `Central`, `Pacific`; NBA `nba-eastern-conference`, `nba-western-conference` named `Eastern Conference`, `Western Conference`.
- Into `mysports.teams.conference_id` — all 32 NFL, 32 NHL and 30 NBA teams, guarded by `where conference_id is null` so MLB's six divisions and college football's 73 conferences could not be touched.

**Why those groupings and not others** — measured from `division_rank`'s actual range: MLB 1–5 (a division of five), NHL 1–8 (a division of eight), **NBA 1–15 (a conference of fifteen, not a division)**. So NBA is seeded at conference level, which is also what Joe's card spec asks for and what `shortGroup()` already anticipates — it maps `Eastern Conference → East` and `Western Conference → West`, wording that only makes sense if those rows were always intended.

**Your job:**

1. Write `db/migrations/0011_division_seed.sql` reproducing exactly the above, **idempotently** — `on conflict do nothing` on the inserts, `where conference_id is null` on the assignments — so applying it against the current database is a no-op and applying it to a fresh one produces the same state.
2. Run it with `--dry-run` and confirm it reports zero changes. **A non-zero count means Cowork's write and this migration disagree — that is a hard stop, and report the difference.**
3. **Cowork sent 14 conference rows and only 10 inserted, so four already existed under the same ids and Cowork does not know which or why.** Find out. Report the four, when they were created, and whether anything references them. If they are stale rows from an earlier attempt, say so; do not delete them in this prompt.
4. Record the migration in `db/README.md`.

## A3 — the twelve stuck MLB rows

Prompt 35 verified these and shipped the display guard (`isStaleLive`, 8 hours, renders `Final pending`). The backfill was held for Joe. **He has now approved it, with a split:**

- **The eight carrying plausible scores → `result_status = 'final'`.**
- **The four reading 0-0 → leave `in_progress` and RE-FETCH.** Those scores were never written; flipping their status would freeze a wrong 0-0 into the record permanently. Prompt 35's own report recommended this split and Cowork endorses it.

`scripts/backup_table.py` on `games` first. Then the eight through `pipeline/db.py` with `--emit-sql`, **the emitted SQL quoted in the report**, then executed. Confirm afterwards that `isStaleLive` no longer fires for those eight and still does for the four.

For the four: re-fetch from the MLB adapter (`adapters/mlb.py`). **If the provider still returns no final score, leave them alone and report it** — that is a provider gap, not something to paper over.

## A4 — load the rankings table

`mysports.rankings` is **empty**, and its `poll_type` enum is already `AP, CFP, Coaches`. The schema was built for exactly this and was never populated. Meanwhile `adapters/cfbd.py` **already has `fetch_rankings(year, week, season_type)`** hitting `/rankings` — the fetch capability exists and has never been wired to a loader.

Build the loader, in the shape of the existing ones (`pipeline/standings.py` is the closest model):

1. **Fetch** every week of the 2026 regular season to date via `fetch_rankings`. `CFBD_API_KEY` is in `.env`.
2. **Materialise to a file first** — the fixture/artifact pattern the other loaders use, under `artifacts/`. This is Joe's "write to Python" step and it matters: it makes the fetch reviewable and re-runnable without hitting the API again.
3. **Load** from that file into `mysports.rankings` through `pipeline/db.py`, with `--emit-sql` first. Map the poll names onto the enum; **report anything CFBD returns that does not map**, and do not extend the enum in this prompt.
4. Wire it into the refresh so it updates weekly, in the same place the standings refresh lives. **Report where you put it.**

**Then add the resolver, as a tested pure function** beside the standings helpers: given a team and a week, return the CFP rank if one exists, else the AP rank, else null. That is Joe's precedence and phase C consumes it. Pin it with tests: CFP wins over AP; AP alone; neither; a team absent from the poll.

**Do not change any card in this phase.** A4 lands the data and the resolver; phase C renders them.

## A5 — the away-rank question

`games.away_rank` is set on **3** rows and `home_rank` on **23**, of 888 CFB games. On 2026-09-05, 15 ranked teams are all at home — which is exactly what a week-2 slate looks like, so the ratio may be entirely legitimate. **But Clemson at LSU carries a null away rank, and Clemson is normally ranked.**

**Investigate whether the adapter writes `away_rank` at all.** Report the finding. **Do not assert a bug you have not proven** — Cowork could not tell from the data and did not.

If it is a real gap, **do not fix it here**; A4's `rankings` table makes the card independent of the game row anyway, and the loader fix is its own prompt.

## Phase A gate

Full gate set including Python. Commit each stage separately. Continue to phase B.

---

# PHASE B — the grid, and two card details

## B1 — the grid header on two lines

Today: `<h3>{SPORT} Broadcasts</h3>` plus a meta line, which wraps mid-date — Joe sees `MLB Broadcasts - Saturday September 5,` then `2026 - 3 games`.

**Joe's ruling: stop letting it wrap and split it deliberately.**

- **Line 1:** `{Sport} Broadcasts`
- **Line 2:** the date and the game count
- **The league mark sits left of both, spanning their combined height**, at its current generous size.

A two-column flex — mark, then a column holding both lines — does this. Report the rendered result at 360, 390 and 430, and confirm neither line wraps at 360. Keep the TBD and gaps-cut suffixes; they carry information the count does not.

## B2 — stronger separation between networks

Joe: *"I'd like more distinguishable horizontal dividing lines between networks on the grid."* Three surfaces, together:

- the outline of the network tiles in the left rail,
- the horizontal line directly below the start times,
- the horizontal lines between networks.

**One clear step heavier, not a redesign.** The grid is a dense surface and over-weighting the rules makes it noisier, not clearer. **Report the before and after values and your own read on whether it went far enough** — you are looking at it and Joe is not.

## B3 — the MARKET TBD badge collides with the favourite's logo

`.pending-row::after` is pinned `top: 6px; right: 8px` — the card's top-right corner, which is where `.mslot` renders the favoured team's logo on an odds card. That is the overlap Joe sees.

**Move it over the network-mark column** (`.mnet-mark`), which sits between the matchup and the odds slot. It must rest above the mark without covering it. Report the measured position and confirm no overlap on all three card heights, and that the network-TBD badge — mutually exclusive with this one by construction — still lands correctly.

## B4 — the date under the start time

`.mtime-day` renders `shortDay(viewing_day)` as `WED, SEP 2` at **11px** uppercase with `0.04em` letter-spacing, in a **56px** column, and the `2` wraps.

**Joe's ruling: full day name on line 1, abbreviated month and date on line 2** — `WEDNESDAY` over `SEP 2`.

`WEDNESDAY` needs roughly 63px at the current size, so **Joe's chosen fix is to shrink the day text to fit** — about 9.5px with tighter letter-spacing — rather than widen the column, which would cost the matchup width the last two prompts fought for. **Measure the widest weekday and set the size from that measurement, not from this estimate.** Confirm no wrap at 360, 390 and 430, and that the 56px column is unchanged.

## B5 — the cap tint goes flat at 0.72

Prompt 36 measured logo ink lost against the cap surface across 307 teams: **tint 0.86 → 25.7% · tint 0.72 → 14.9% · tint 0.58 → 15.5% · flat band → 27.1%.** The shipped cap is a gradient from 0.86 to 0.58 — spanning from the *worst* non-flat value to a good one.

**Joe's ruling: a flat cap at tint 0.72.** It nearly halves logo ink loss against the gradient's top end, and being flat it also moves toward the continuous surface he asked for in prompt 36.

Re-run prompt 36's own measurement to confirm the 14.9% figure, **and name any team that gets materially worse than it is today** — the nine that went to zero readable edge under a flat band colour (Clemson, Ole Miss, SMU, Washington State, Cardinals, Giants, Phillies, Pirates, Raptors) are the ones to check first. **If a team regresses badly, report it rather than reverting the whole change.**

## Phase B gate

Full gate set. Commit. Continue to phase C.

---

# PHASE C — the list card redesign

## C1 — the matchup stacks

Today `.duel.hug` holds two `.tcol` columns **side by side**, away left and home right.

**Joe's ruling: away above home.** The away team's block first, the home team's block below it. The venue line stays at the bottom of the card, under both.

The time column on the left and the network mark and odds slot on the right remain full-height columns beside the whole stack; the time and date stay evenly spaced as prompt 31 set them.

**Report the card heights against prompt 29's 68.3 / 91.3 / 186.3px baseline.** This will grow them — that is expected and accepted, and Joe chose the taller of three options knowingly. What is *not* accepted is a name truncating: prompt 31 measured that `.mbody` is 152px at 390px while two names side by side need ~250px. **Stacked, each name now has the full width to itself, so the tiered shrink in `nameSize()` should rarely fire. Report how often it does.**

## C2 — three lines per team

Per team, in order:

1. **Logo · Name · Record** — the record moves up beside the name.
2. **The standings line** — what was left after the record moved off it.
3. **The MLB probable pitcher**, where it renders today.

`standingLine()` in `web/lib/standings.js` already builds its string as `[recordText, placement, games-back]` joined on ` · `. **Split the record off the front and return the remainder as line 2.** Keep a joined form if any other caller needs it — `GameDetail.js:44` calls the same function, so **check it and report what you did about it.**

**A line with nothing to say does not render.** The existing comment says it plainly: *"Absent means ABSENT: no blank line is reserved for a record that does not exist."* That holds for all three lines.

## C3 — Joe's per-sport rules, verbatim

> **NFL and NHL:** Away Team Name — Record *(if one exists)* / Place in Division — games back. Same for home.
>
> **NBA:** Away Team Name — Record *(if one exists)* / Place in CONFERENCE — games back. Same for home.
>
> **College Football:** Away Team Name — Record *(if one exists)* / CFP Rank (if one exists) — if no CFP Rank, then AP Rank (if one exists) — if no AP Rank then Place in Conference (if one exists) — if no place in conference exists then simply display conference name. Same for home.
>
> **For ALL team sports** — if a record does not yet exist, display nothing until one does. If a place in division standings (NFL, NHL) or conference standings (NBA, CFB) does not exist, ONLY display the conference name until a place does exist.

**MLB is unchanged** and stays as it renders today — `2nd AL Central · 3.0 GB` — with the record moved up per C2.

**Two rulings on top of that spec, both Joe's:**

- **NHL keeps its points.** The spec says "games back", but the NHL publishes none — `games_back` is null on all 96 NHL rows while `points` is set on all 96. Line 2 stays `104 pts · 2nd Atlantic`.
- **CFB's rank comes from A4's resolver**, not from `games.away_rank` / `home_rank`. The game row carries a bare number with no poll attached, so it cannot honour CFP-before-AP. The resolver can.

**What each sport will actually render after phase A** — verify these and report any that differ:

| sport | line 1 | line 2 |
|---|---|---|
| MLB | name + `70-70` | `2nd AL Central · 3.0 GB` |
| NHL | name + `55-16-11` | `104 pts · 2nd Atlantic` |
| NBA | name + record | `4th East · 2.0 GB` — check what `shortGroup` gives now that the conference rows exist |
| NFL | name + record, **suppressed while every record is 0-0 until Sep 9** | `AFC North` — the name only, because `division_rank` is null on all 32 |
| CFB | **nothing — zero `team_records` rows exist** | the resolver's rank, else conference name |

**Two of these are thin because the data is thin, not because the code is wrong.** Do not invent content to fill them.

## C4 — the reference and the contract

**Rule 23:** `docs/design/mobile_demo.html` renders the side-by-side duel. C1 changes that shape — **update the reference in the same commit**, and check the token block again for drift the way prompt 29's finding requires.

`docs/rendering-contract.md` describes the card. **Read the relevant section and report whether C1–C3 contradict it.** If they do, bump the version and update the text in the same commit. Do not bump silently either way.

## Phase C gate

Full gate set. Commit.

---

# Report

Per phase and stage: what changed, the sha, the evidence, every judgment call. Gates before and after each phase. Call out specifically:

- **A1: which Python interpreter**, and the suite's number against prompt 35's 200 OK (skipped=1).
- **A2: the dry run's change count** (zero is the pass), and **which four conference rows already existed and why.**
- **A3: the emitted SQL for the eight**, the backup's location, and what the re-fetch returned for the four.
- **A4: how many ranking rows loaded, across how many weeks and polls**, anything CFBD returned that did not map to the enum, and where the weekly refresh hook went.
- **A5: whether `away_rank` is written at all** — proven, or honestly inconclusive.
- **B1–B4: rendered results at 360 / 390 / 430**, and **your own read on whether B2's dividers went far enough.**
- **B5: the re-measured 0.72 figure**, and any team materially worse than today.
- **C1: card heights against 68.3 / 91.3 / 186.3**, and how often `nameSize()`'s shrink still fires.
- **C3: one real card per sport**, rendered, against the table above.
- **Geometry:** phase B touches the grid. Confirm lane counts, block widths and scrollWidth unchanged — CFB on **2026-09-05** is 62 blocks / 240,223 / 1073 and MLB **2026-09-03** is 3 / 231 / 582. **Note the dates: prompt 36 nearly called a false hard stop by comparing a 2026-09-12 slate against these.**
- **Prompt 30's zoom fix:** rail pinned at 0.6 / 1.0 / 2.5 after panning. Must not regress.
- **Anything in this brief that turned out wrong.**

---

# Explicitly out of scope

- **Deleting the four pre-existing conference rows.** A2 reports them; it does not remove them.
- **Fixing the `away_rank` loader**, if A5 proves a gap. Its own prompt.
- **Fixing the pipeline gap behind the stale finals** — `schedule_refresh` failing on the RENDER job with `FileNotFoundError: artifacts/validation/mlb_2026_teams.json`. Still its own prompt.
- **Loading racing data.** Zero `nascar`/`indycar` rows; a pipeline prompt.
- **Sourcing the TBS mark** — Cowork's job.
- **Extending the `poll_type` enum.** Report unmapped polls instead.
- **The count line moving beside the band header on the grid** — done for the list bands in prompt 36; the grid header is B1.
- **Widening any grid block, or `bandFor` and the ink rule.** Measured, shipped, frozen.
- Anything else in `pipeline/` or `adapters/` beyond A3's re-fetch and A4's new loader.
