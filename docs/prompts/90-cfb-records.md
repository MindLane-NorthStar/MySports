# Claude Code — RUN 2 of 2 (rev B): CFB records reach the card, and the CFB nightly stops enriching December

**Run in Claude Code**, in `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports`, on `main`.

**RUN 1 IS DONE.** `main` and `origin/main` are both `29fa5dfbc5943dfd9319d7c9781a2a420c069f57`,
verified by Cowork against the tree. Rule 7, the S1–S7 stop list, the undo-block requirement and
`.claude/settings.json` are all in place. **If `git status` is not clean apart from `assets/`, stop and
say so** — RUN 1 left nothing behind, so anything else in the tree came from elsewhere.

**Rev B exists because RUN 1's report found a gap Cowork left in the permissions file.** Stage 0 below
closes it before anything else happens. Cowork's original intent list simply omitted `git push`, and
an unattended run that cannot push is an unattended run that hangs.

**Start a fresh Claude Code session for this run.** RUN 1 wrote `.claude/settings.json`, and a
permissions file is read at session start. A new session is how you know you are running under it.

**THIS IS AN UNATTENDED RUN. JOE IS NOT AT THE KEYBOARD.** Self-committing stages, two-strikes-skip,
and hard stops ONLY for the list under "When to actually stop" at the end. Everywhere else, make the
reasonable call, keep going, and log every judgment call in the report. Do not stop to ask a question
Joe cannot answer for hours.

**Note on numbering:** this is prompt 90 and it runs after prompt 91. The numbers in `docs/prompts/`
are identifiers, not a run order. That is expected and is not drift.

**No database writes in this prompt.** Working rule 14 forbids a Claude Code session from using the
`mysports_writer` credential, and every write here belongs to the nightly Action. This prompt changes
code, the workflow and docs; the data lands when Joe dispatches the workflow afterwards. Do not run
`pipeline.enrich_cfb` against the database, with or without `--emit-sql` pointed anywhere but a file.

---

## STAGE 0 — close the permissions gap, first, before anything else

RUN 1 reported three consequences of `.claude/settings.json` for this run. Cowork verified all three
by reading the committed file. Two are fine; one would stop this run dead.

**The blocker: `git push` is neither allowed nor denied.** It appears in the deny list only in its
force-push spellings. A plain `git push` therefore falls through to whatever the session mode decides,
and if it prompts, this unattended run hangs with nobody there to answer. **That is Cowork's omission,
not RUN 1's** — the intent list handed over never named `git push` at all.

**Fix it as your first act, and commit it on its own.** Add to the `allow` array:

```
"Bash(git push)",
"Bash(git push *)"
```

**This is safe, and the reason is the precedence rule RUN 1 already confirmed: deny is evaluated first
and always beats allow.** The four force-push denies — `git push *--force*`, `git push *-f`,
`git push *-f *`, `git push *+*` — and their PowerShell twins keep matching. S3 is untouched. You are
permitting exactly the ordinary fast-forward push and nothing else.

Then **prove it**, because a permissions claim is a label until a command runs: make the Stage 0 commit
and push it, and report whether the push ran without prompting. If it still prompts, say so plainly and
stop — that means the rule did not match and the rest of this run cannot self-commit either.

**Two other consequences, neither a blocker. Do not "fix" either one.**

- **Every form of `python -m pipeline.enrich_cfb` is denied**, including an `--emit-sql` dry run, and a
  deny rule cannot carve out an exception. **Do not attempt to invoke the module at all.** Everything
  this brief needs proving is provable through `pytest`, which is allowed — which is also why the
  assertions below require the record parse and the week resolution to be unit-testable with fixed
  inputs rather than exercised through the CLI. If you find yourself wanting to run the module, that is
  a signal the logic is not factored testably; fix the factoring, not the permissions.
- **`rm -rf web/.next` is denied.** That is rule 12's recovery step, but rule 36 already writes it in
  the PowerShell form — `Remove-Item -Recurse -Force web/.next` — which is not denied. Use that if a
  gate ever needs `.next` cleared.

---

## What is wrong, measured

Joe's report: **no record renders beside a college football team on the list card or the grid card.**
Cowork measured the database and read the components on 2026-09-11. Three findings, two of them
defects.

**1. `mysports.team_records` holds no CFB rows at all.** 684 CFB teams, **zero** with a record, against
1,146 rows covering all of MLB, NBA, NFL and NHL through `as_of` 2026-09-10. The cause is one line:
`pipeline/standings.py:46` reads `LEAGUES = ("mlb", "nhl", "nba", "nfl")` and its docstring says
"standings for all four pro leagues." CFB was never in scope.

**This is the whole reason no record renders, on either surface.** Both read `team_records`:

- **The list card** reads it directly — `queries.js:215 standingsFor()` → `standings.js:145
  indexStandings()` → `:155 standingFor()` → `:107 standingParts()`, whose `record` is
  `realRecord(row, sport)`. No row, no record.
- **The grid** reads `game.home_record` first and falls back to `team_records` —
  `MobileGrid.js:99-101`, `const rec = stored || (row ? recordText(row, game.sport) : null)`. The
  `stored` branch is **dead**: `GAME_SELECT` (`queries.js:9-46`) selects `home_rank` and `away_rank`
  but **not** `home_record` or `away_record`, so `game.home_record` is always `undefined` and the
  fallback always fires. Verified by grep: those two column names appear nowhere in `queries.js`.

**2. `enrich_cfb.py --latest-week` resolves to the wrong week, and the nightly runs it that way.**
`enrich_cfb.py:201-204`:

```python
rows = db.fetch("select max(week) from games where sport = 'cfb' and season = %s", (args.year,))
```

The flag's own help text says "use the newest loaded week" — the newest week **loaded into the
database**, not the week containing today. Measured 2026-09-11:

| | |
|---|---|
| today | 2026-09-11 |
| the week containing today | **week 2**, 2026-09-10 to 2026-09-12, **86 games** |
| `max(week)` for cfb 2026 | **week 15**, 2026-12-12, **1 game** |

So `schedule_refresh.yml:261` (`python -m pipeline.enrich_cfb --latest-week --fetch`) has been
enriching one December game every night. The game-column data proves it and dates it: week 1 carries
18 home / 55 away records from a manual `--week 1` run, **week 8 carries 5 / 8**, week 15 carries
1 / 1, and **weeks 2 through 7 and 9 through 13 carry zero.** The module's own docstring, written
2026-09-03, says "week 8 today" — because eight weeks were loaded then and `max(week)` was 8. The
nightly has been following the schedule outward as it gets built. **Queue item 7, building the
calendar to April 2027, makes this strictly worse.**

**This is why the grid shows no rank either.** The grid's rank comes from `game.home_rank`
(`MobileGrid.js:98`), and week 2's rank columns are zero for the same reason. The list card is
unaffected because it reads `mysports.rankings`, which **is** current — weeks 1 and 2 are both loaded,
AP and Coaches, 25 teams each.

**3. Two stale comments that will mislead the next reader.** Neither is a defect; both are in scope
because this prompt makes them wronger.

- `pipeline/load.py:312-313` says "the same adapter records that feed `team_records` also go on the
  GAME, so the grid's record run and the listings card read one consistent source instead of two."
  The grid and the card do read one source, but it is `team_records` — not the game columns.
- `MobileGrid.js:91-94` says the game record columns "are null for every game in the database today."
  They are not: 24 games carry `home_record` and 64 carry `away_record`. The sentence's *conclusion*
  (the run falls back to `team_records`) is right, for a different reason — the columns are not
  selected.

**What Cowork did NOT check.** The device shell could not mount the connected folder this session
(`sandbox-helper: no Plan9 drive shares`, attributed by the tool to a Windows update released
2026-09-08), so **no `grep` of the tree was possible.** Every claim above comes from these files,
staged and read individually, plus direct Supabase queries:

```
CLAUDE.md  docs/handoff-status.md  docs/queue.md  docs/rendering-contract.md
docs/rendering-contract-mobile.md  adapters/espn.py  adapters/cfbd.py
pipeline/load.py  pipeline/standings.py  pipeline/enrich_cfb.py  scripts/probe_enrichment.py
web/lib/queries.js  web/lib/standings.js  web/components/MobileGrid.js  web/components/Listing.js
.github/workflows/schedule_refresh.yml
```

**Nothing else was searched.** In particular Cowork does not know every caller of `apply_week()`,
every consumer of `team_records`, or whether any test asserts on the CFB record columns. Stage A owns
that.

---

## Joe's rulings, 2026-09-11

1. **CFB records go into `mysports.team_records`**, written by `pipeline/enrich_cfb.py`, so CFB uses
   the same read path every other sport already uses. Not into `GAME_SELECT`; not by extending
   `standings.py`.
2. **The CFB nightly enriches the week containing today**, not the newest loaded week.
3. **No backfill.** Joe first approved a one-time backfill of weeks 2 onward; Cowork then measured
   that `team_records` is keyed `(team_id, season, as_of)` and `standingFor()` takes only the newest
   `as_of` per team, so historical rows render nowhere and a backfill would add rows nothing reads.
   **Cowork withdrew the backfill and Joe accepted.** One nightly write of every team's current record
   serves every CFB card in the season, past and future.

Do not re-litigate any of the three. If the tree contradicts a measurement above, say so and stop.

---

## Preconditions

- `git status`: clean apart from `assets/` (untracked on purpose). RUN 1's two commits are pushed.
  Report anything else dirty or untracked rather than assuming it is expected. If something else is
  dirty, stop — working rule 2.
- `HEAD == origin/main`, and say what it is.
- Five gates as the baseline, each its own command, each against the floor in
  `docs/handoff-status.md` under "Repo state" and nowhere else. This brief quotes no gate number.
- Working rule 1: certify the Python interpreter for Windows before running anything Python.

---

## Stage A — reconnaissance. Read-only, report, continue unless something below says stop.

1. **Every caller and consumer.** Search the whole working tree (tracked and untracked, excluding
   `node_modules/`, `.next/`, `assets/`, `web/qa/`) for: `apply_week`, `team_records`, `home_record`,
   `away_record`, `latest_week`, `latest-week`, `enrich_cfb`. Report file, line and quoted text.
2. **Every test that touches any of it** — `tests/`, `web/test/`, `web/scripts/`, `scripts/`. Name the
   test and what it asserts.
3. **The enrichment file's records block, as it actually is on disk.** Find which
   `artifacts/validation/cfbd_2026_week*_enrichment.json` files exist. Open the one for **week 2** if
   it exists, and print the `records` block's shape for two teams — the keys present under a team id,
   including whether `display` is a plain `"W-L"` string, and what `conf` carries. Cowork read this
   only through `enrich_cfb.py:record_display()` and `apply_week()`, never the file. **If no week-2
   file exists, say so and note that stage C's fetch will create it.**
4. **Whether CFBD's records block covers all teams or only teams playing that week.** `apply_week()`
   iterates games and looks each side up, so the current code cannot tell you. Read
   `scripts/probe_enrichment.py` and report which CFBD endpoint fills `records` and what its coverage
   is. **This decides whether stage C writes a row for every team with a record, or only for teams on
   that week's slate.** Report the answer; do not stop.
5. **HARD STOP if any test, script or workflow other than `schedule_refresh.yml:261` invokes
   `enrich_cfb` with `--latest-week`**, or if anything asserts on `max(week)` semantics. Changing the
   resolution would then break a caller this brief has not accounted for.

---

## Stage B — resolve the current week correctly

**Add a new flag; do not repurpose `--latest-week`.** Its name and help text describe what it does,
other callers may rely on it, and a manual `--latest-week` run is still useful. Add
`--current-week`, and change **only** `schedule_refresh.yml:261` to use it.

Semantics, stated so there is no guessing: **the CFB week whose day range contains today (ET); if no
week contains today, the next week that starts after today; if there is none, the highest week that
has already ended.** That last clause keeps a December run from resolving to nothing.

Derive it from the database, not from a provider call — the dates are already there and a fetch is a
new failure mode. `games.viewing_day` per `(season, week)` is the range; the measured ranges are in
the table above, so week 2 is the expected answer today.

**Report the resolved week and the date range it came from, every run.** A step that silently picks a
week is how this defect survived. A one-line print naming the week and its range would have caught it.

Do not touch the `--week`, `--rivalries-only` or `--emit-sql` paths.

---

## Stage C — `enrich_cfb.py` writes `team_records`

Add the write beside the existing game-column write, in the same module and the same transaction. Keep
the game-column write: it is the archived desktop renderer's path, `record_display()` builds that
surface's conference form, and removing it is a separate decision nobody has made.

**Shape, matching how the pro leagues already do it** (`load.py:322-329` is the working pattern):

- Upsert into `team_records` on conflict target `team_id, season, as_of`, updating `wins, losses,
  ties`. One row per team.
- `wins` / `losses` come from splitting the records block's plain `"W-L"` display on `-` into
  integers, exactly as `load.py:324` does (`parts = [int(x) for x in r.split("-") if x.isdigit()]`).
  **Use the plain overall record, never `record_display()`'s output** — that function appends the
  conference form for same-conference games (`"4-1, 2-0 BIG 12"`) and would not parse.
- `ties` is 0 unless the source carries a third component.
- `season` is the enrichment year. `as_of` is **today's date in ET** — this is a current-standings
  snapshot, not a per-week fact. Say in the code why, in one line.
- `source` is a new stable string for this path. Name it for the provider and the module, consistent
  with the existing values (`espn.standings`, `nhl.standings`, `mlb-statsapi`). Report what you chose.
- **Skip a team whose record is all zeroes.** `standings.js:52 realRecord()` and
  `MobileGrid.js:76-88 allZeroRecord()` both treat all-zero as "no record yet," so writing a 0-0 row
  buys nothing and adds a row the app must then discard.
- `conf_wins` / `conf_losses`: write them **if** the records block carries a conference record, and
  say so in the report. Nothing renders them today — M16 keeps the conference form off the phone and
  `recordText()` never reads them — so this is storage, not display. If the block does not carry them
  cleanly, leave them null rather than deriving anything.

**Coverage follows stage A part 4.** If the records block covers every team, write a row for every
team with a non-zero record, independent of that week's slate — that is the behavior that makes every
CFB card in the season correct from one nightly run. If it only covers the week's teams, write those
and **say plainly in the report that a team not playing this week will carry a stale record until it
plays**, because that is a real limitation Joe should know about rather than discover.

Count and report the rows written, separately from the existing `record_sides` count.

---

## Stage D — the workflow

Change `schedule_refresh.yml:261` from `--latest-week` to `--current-week`. Nothing else in that step.

**Then check the neighbours and report, without changing them:** does any other step in that workflow
use a "latest" or "max" resolution that has the same shape of bug? Queue item 6 already records
hard-coded `2026-12-31` horizons in the studio-show steps; this is the adjacent question, not that
one. Report what you find; open nothing.

---

## The rendering rules this change must respect

Cowork read these from the files, not from a summary. **None of them changes.** They are here so the
implementation and the assertions are measured against the real contract.

- **`recordText()`, `standings.js:42`** — `W-L`; NHL is `W-L-OTL`; a third component renders only when
  `ties` is non-zero. CFB therefore renders `W-L`.
- **All-zero is not a record** — `standings.js:52 realRecord()`, and `MobileGrid.js:76-88
  allZeroRecord()`, which **parses** rather than matching a literal, at any arity.
- **M16, `docs/rendering-contract-mobile.md:156` — the phone gets the SIMPLE record only.** `(1-0)`,
  never the PC contract's `(4-1, 2-0 BIG 12)`. The archived desktop grid keeps the full form. This is
  why stage C parses the plain record and not `record_display()`'s string.
- **Record run v1.1, `docs/rendering-contract.md:34`** — the record follows the name on the same
  baseline at 60% size and 82% ink opacity. Fit order when the span is narrow: shrink the whole line
  to 18px to keep the record → drop the record → shrink the name alone (min 14).
- **M17, addendum `:158`** — the name run is the largest size at which the whole `{rank} NAME
  (record)` run fits the block's name span, capped 20.8px, floored 11.2px.
- **CFB line 2, `standings.js:81` and `:114-119`** — the poll rank label **and** the conference,
  joined ` · `, each rendering when it exists. **"No placement means the GROUP NAME ALONE."** CFBD
  gives no conference placement, so `division_rank` stays null and a ranked CFB club reads
  `AP #14 · Big Ten` — already the documented "AP-ranked, not placed" row. **No new rule is needed and
  none may be invented.**

---

## M2 — THE GEOMETRY WILL MOVE, AND THAT IS EXPECTED

**`docs/rendering-contract-mobile.md:42` (M2):** the minimum standard-block width is derived from
"the widest rendered team line on the slate, **including rank prefix and record run**," and
`pxPerMin` is derived from that width. `MobileGrid.js:164` builds the measured string as
`` `${at}${rank} ${name} ${record}` ``.

So giving every CFB club a record **grows `widest` for every CFB slate**, which moves block widths and
`scrollWidth` across the whole CFB grid. **This is the data-derived drift the geometry tripwire was
reshaped for**, not a regression.

Report it the way that ruling requires:

- **Hard stops, unchanged and still hard:** block count, lane count, row count, painted == laid-out
  width, rail delta 0 at every zoom, the 46px floor, and **no wrap and no truncation**. If any of
  these fails, stop — that is a real regression.
- **Report-and-explain:** block widths and `scrollWidth`, each recorded **with the `widest`
  measurement beside it**. `scrollWidth / widest` holding steady means data moved; the ratio moving
  means code moved.
- **The one derived check that stays:** when `--rail-w` changes by N, `scrollWidth` must change by
  exactly N.
- **M17's fit is the risk to watch.** A longer run may drive the fitted name size down toward the
  11.2px floor, and the contract's fit order says drop the record before shrinking the name past
  legibility. **Say in a sentence whether any CFB block hit the floor or dropped a record**, and if
  one did, name the game.

---

## Assertions

- A unit test that `enrich_cfb`'s record parse turns `"3-1"` into wins 3 / losses 1, and that an
  all-zero record writes no row.
- A test that `--current-week` resolves to the week whose range contains a given date, plus the two
  fallback clauses. **Pin it to fixed dates, not to `today`**, or it rots in December.
- **Mutation checks on both new assertions:** break the parse and the split test must fail; make
  `--current-week` return `max(week)` and the resolution test must fail. State what you broke.
- **qa-shots on a CFB slate, and this is the one that decides it:** capture the phone grid and the
  list card for a week-2 day and **say in a sentence what the record run looks like** — present,
  legible, simple form, no conference suffix. A passing test and a legible result are different
  claims.
- Grep-level: `GAME_SELECT` still does not select `home_record`/`away_record` (this prompt does not
  add them), and `recordText()` is unchanged.

---

## Docs

- **`docs/enhancement-register.md` §39** — the three rulings, the two defects with their file:line,
  and the withdrawn backfill with the reason it was withdrawn. Record honestly that the CFB nightly
  enriched the wrong week from some point before 2026-09-03 until this prompt, and that the game
  record columns remain written and unread.
- **`docs/handoff-status.md`** — under the open items, the two things this leaves open: the game
  record/rank columns are written and not read by `GAME_SELECT`, and the grid takes its rank from
  `game.home_rank` while the list card takes it from `mysports.rankings`, so only the card can print
  the `AP`/`CFP` label (`standings.js:103-105` and `:167` both say exactly this). **Do not fix either here** — the
  second is a design question about what the compact grid run should show, and it is Joe's.
- **Fix the two stale comments** named in finding 3, in the same commit.
- **`docs/rendering-contract-mobile.md`** — add nothing unless a rendered result contradicts M2, M16
  or M17. If one does, stop and report rather than amending a locked contract mid-run.
- File this brief to `docs/prompts/90-cfb-records.md`, verbatim, matching the `NN-slug.md`
  convention, and update `docs/prompts/README.md` and `CLAUDE.md`'s prompt-count row per their own
  conventions. **Count the directory; do not increment the number.**

---

## Gates, then commit and push

All five, each as its own command, each reported with its count against the floor in
`docs/handoff-status.md` under "Repo state". The gate and the commit are separate commands (rule 26) —
do not chain them or read a gate's result from a chained exit code.

**Then commit and push**, under the default prompt 91 establishes. Report the diff stat, the Vercel
result, and the geometry figures with `widest` beside them. Commit message lower-case, saying what
shipped.

**End with the undo block** — the exact revert command with the real SHA filled in, which stages were
one-way, and whether the push deployed. Nothing in this brief is one-way: it writes no database rows
and deletes no tracked file.

**THE PUSH IS THE START OF THE TEST, NOT THE END.** This brief changes a nightly workflow step, and a
workflow runs from the pushed ref — so nothing here is proved until the workflow is dispatched and the
rows are checked. Say plainly in the report that **the data has not landed yet**, that Joe dispatches
the workflow, and that Cowork will verify the rows in the database directly rather than reading the
run's log. A green gate and a green deploy are not evidence that a CFB record exists.

---

## Standing rules

- Working rule 14: **no database write in this prompt**, and the `mysports_writer` credential is never
  read, printed or used. PostgREST reads with the publishable anon key are fine.
- Working rule 9: these are loader-written provider facts and never become reconciled observations —
  the reconciler neither reads nor writes `team_records`.
- Working rule 2: never write to the repo while another prompt is in flight.
- Working rule 4: stage by explicit path; never `git add -A`.
- Working rule 3: secret gate on added lines, with `grep`, never `findstr`.
- Working rule 17: edit JSON data files through a parser, never line-based.
- Working rule 18: team-name resolution is exact-match within sport, never substring or fuzzy.
- Gate floors: `docs/handoff-status.md` under "Repo state", nowhere else. This brief quotes none.
- `assets/` is untracked on purpose and is not drift.
- WUAB and RESN are never named. Credentials never enter the repo or a committed doc.

## When to actually stop

Only these. Everything else, decide and keep going, and log the call in the report.

1. `git status` is not clean apart from `assets/` at the start.
2. Stage 0's push still prompts after the allow rules are added — the rest of the run cannot
   self-commit either, so stop rather than proceeding into a run that will hang later.
2. Stage A part 3 finds a machine-readable dependency on what this brief changes.
3. A secret-gate hit.
4. A gate fails and cannot be made to pass.
5. Any database write or DDL would be required — it will not be; this brief writes no rows.
6. A force-push, history rewrite, or branch deletion would be required.
7. A file outside the scope below would have to be deleted or overwritten.
8. `.env`, `.env.example`, or `.gitignore`'s credential lines would have to change.

---

**Scope this brief may touch:** `.claude/settings.json` (Stage 0 only), `pipeline/enrich_cfb.py`, `pipeline/load.py` (the stale comment only),
`web/components/MobileGrid.js` (the stale comment only), `.github/workflows/schedule_refresh.yml`,
`docs/enhancement-register.md`, `docs/handoff-status.md`, `docs/prompts/README.md`,
`docs/prompts/90-cfb-records.md`, `CLAUDE.md` (the prompt-count row only), and any new test file the
assertions require. Nothing else — anything outside this list is a stop, not a judgment call.
