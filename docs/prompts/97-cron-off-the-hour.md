# Claude Code — prompt 97: two refresh runs a day, both off the top of the hour

**Run in Claude Code**, in `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports`, on `main`.

**Two cron lines, a comment, and the record. No application code, no pipeline code, no database
access of any kind.**

**THIS IS AN UNATTENDED RUN.** Self-commit and push under working rule 7's default; stop only for the
stop list in `CLAUDE.md`'s `## Committing` and the list at the end.

**Scope this brief may touch:** `.github/workflows/schedule_refresh.yml`,
`docs/enhancement-register.md`, `docs/handoff-status.md`, `docs/queue.md`,
`docs/prompts/README.md`, `docs/prompts/97-cron-off-the-hour.md`, `CLAUDE.md`. Nothing else —
in particular **`render_all.yml` is out of scope**; stage C records a finding about it and changes
nothing.

---

## Joe's ruling, 2026-09-14

**Two scheduled runs a day, both off the top of the hour: 3:37 a.m. and 7:37 a.m. Eastern.**

On 2026-09-14 the White Sox–Guardians card carried Friday's records, Friday's games-back and no
pitching matchup. One cause: the day's refresh had not run. Every row for that game was last written
`2026-09-13 14:48:39 UTC`.

**And the schedule has never been firing on time.** `schedule_refresh.yml:8` is `"0 11 * * *"` —
11:00 UTC. Cowork measured the first recorded step in `mysports.refresh_runs` on days with a single
run and no manual dispatch:

| day | first recorded step (UTC) | apparent delay |
|---|---|---|
| Fri 09-04 | 14:41 | ~3h 40m |
| Mon 09-07 | 16:16 | ~5h 15m |
| Wed 09-09 | 15:01 | ~4h |
| Sun 09-13 | 14:47 | ~3h 45m |

**Those are inferred, not measured, and stage A's job is to replace them.** The first recorded step
lands after the R2 pull and the provider fetches — about eight minutes on run #18, which is a single
observation from a day the log itself called slow. `refresh_runs` records steps, never job starts.

The cause is not this repository. GitHub runs scheduled workflows on a best-effort basis and the top
of the hour is the platform's most congested minute; multi-hour drift and outright drops are widely
reported. **Moving off `:00` usually helps and is not a guaranteed cure** — at least one public report
describes the delay persisting after a minute change. That is why the second run matters more than
the new minute: **one run a day has no backstop, and this brief is buying redundancy rather than
punctuality.**

---

## Preconditions

- `79797d1` in history. `git status` clean apart from `assets/`; report anything else.
- `HEAD == origin/main`; say what it is.
- Five gates as the baseline, each its own command, each against the floor **read from**
  `docs/handoff-status.md` under "Repo state". Prompt 96 moved the pytest floor. **This brief quotes
  no gate number.**
- Working rule 1: certify the Python interpreter for Windows before running anything Python.

---

## Stage A — measure the real fire times, and correct Cowork's table

`gh run list --workflow=schedule_refresh.yml --limit 40 --json databaseId,createdAt,startedAt,updatedAt,conclusion,event`
gives what `refresh_runs` cannot: **when each run was actually created and started**, and whether its
`event` was `schedule` or `workflow_dispatch`.

Report, for the scheduled runs only:

- the real delay between 11:00 UTC and each run's start, per day;
- the **median and the worst**, stated as numbers;
- whether any scheduled run is **missing entirely** for a date — a drop is different from a delay and
  changes what the second run is worth;
- the same for `render_all.yml`, which stage C needs.

**Put the real table in the register and say plainly where Cowork's inferred figures were wrong.**
If `gh` is not authenticated, say so and record the measurement as outstanding rather than keeping
the inferred numbers as though they were measured.

---

## Stage B — the two crons

Replace the single `- cron: "0 11 * * *"` at `:8` with two lines:

```
    - cron: "37 7 * * *"
    - cron: "37 11 * * *"
```

**07:37 UTC = 3:37 a.m. EDT; 11:37 UTC = 7:37 a.m. EDT.** Joe asked for 3:37 and 7:37 Eastern; those
are the conversions for the offset in force today.

**Write a comment above them recording three things**, because each one is a thing the next reader
will otherwise have to rediscover:

1. **The minute is deliberate.** `:00` is the platform's most congested slot; `:37` is not. Name the
   measurement stage A produced as the reason, not a belief.
2. **The second run is a backstop, not a second opinion.** The loader is idempotent, so a second pass
   costs runner minutes and nothing else, and a delayed or dropped morning run no longer means a
   wrong card all evening.
3. **DST.** Cron is UTC and has no daylight-saving awareness. These land at 3:37 and 7:37 Eastern
   until **2026-11-01**, after which they land at 2:37 and 6:37 until March. Say that whoever wants
   the clock times back must shift both lines by an hour, and that nothing in the repo will remind
   them.

**Change nothing else in that file.** Not `concurrency`, not `timeout-minutes`, not the step order.

**Say in your report what this costs:** the job runs 15–20 minutes, so two runs is roughly 40 minutes
of runner time a day against 20. Report the figure; do not editorialize about whether it is worth it
— that is Joe's call and he has made it.

**One interaction to state, not to solve.** `concurrency: { group: mysports-refresh,
cancel-in-progress: false }` means a second run that starts while the first is still going will
**queue rather than cancel**. Four hours apart, that should never happen; under the drift stage A
measures, it could. Say whether stage A's worst delay makes it possible.

---

## Stage C — record what `render_all.yml` is doing, and change nothing

`render_all.yml:6` carries its own schedule: `cron: "30 9 * 9,10,11,12,1,2 *"` — 09:30 UTC, September
through February. Its own header says it runs "after a successful refresh." **09:30 is ninety minutes
before the 11:00 refresh it claims to follow**, so the standalone render has been drawing grids from
the previous day's rows, independently of the drift.

`schedule_refresh.yml` also calls it directly — the `render` job declares `needs: refresh` and
`uses: ./.github/workflows/render_all.yml` — so a render already follows every refresh. The standalone
schedule is a second trigger for the same work.

**Do not change it.** Record it in `docs/queue.md` as a decision for Joe: whether the standalone
render schedule should exist at all now that the refresh triggers one, or should simply move after
the new run times. Give stage A's measured `render_all` fire times, state that under the new 07:37
run a 09:30 render would fall *after* it **only if the drift is actually gone**, and say plainly
which way stage A's numbers point. **A description of a problem, not an approved plan.**

---

## Stage D — the record

- **`docs/enhancement-register.md`** — a new section at the next unused number. **Count and say which
  number you used**; prompt 96 took §45, so expect §46 and confirm it. Record Joe's ruling, stage A's
  real delay table, the correction to Cowork's inferred figures, the platform reason, the honest
  caveat that moving off `:00` is not a guaranteed cure, the DST note with its date, and the
  render_all finding.
- **`docs/handoff-status.md`** — an open item: the schedule is best-effort and has been measurably
  late; the second run is the mitigation, and the next thing to try if both runs still drift is an
  external trigger calling `workflow_dispatch` through the API. **Do not build that here.**
- File this brief to `docs/prompts/97-cron-off-the-hour.md`, verbatim. Update
  `docs/prompts/README.md` and `CLAUDE.md`'s prompt-count and register rows. **Count; do not
  increment.**

---

## Assertions

- `grep` the workflow: `cron` appears exactly twice in `schedule_refresh.yml`, reads `37 7 * * *` and
  `37 11 * * *`, and **neither is at minute 0**.
- The workflow still parses, and **`tests/test_workflows.py` is the guard** — working rule 28 says a
  Python-side parse is no evidence Actions agrees, so **run that test and report it by name**; do not
  substitute a PyYAML load.
- `diff` the file and confirm the only changed lines are the cron block and its comment.
- `render_all.yml` is byte-identical. `git status --short` proves it.
- The five gates, each its own command, each against the floor read from `docs/handoff-status.md`.

---

## Gates, then commit and push

All five, each its own command. Gate and commit are separate commands (rule 26). Then commit and
push, and report the Vercel result — no web code, so call it a no-op rebuild.

**End with the undo block:** the revert command with the real SHA, and the note that nothing here is
one-way — a revert restores the single 11:00 cron and no data is affected either way.

**Do not dispatch any workflow.** Joe dispatched one manually today at about 15:40 UTC; the next
scheduled run under the new times is the real test, and it will be tomorrow.

---

## When to actually stop

Only these. Everything else, decide and keep going, and log the call.

1. `git status` is not clean apart from `assets/` at the start.
2. `tests/test_workflows.py` fails after the edit.
3. `render_all.yml` would have to change.
4. A gate fails and cannot be made to pass.
5. Anything in `CLAUDE.md`'s `## Committing` stop list.

---

## Standing rules

- Working rule 2: never write to the repo while another prompt is in flight.
- Working rule 4: stage by explicit path; never `git add -A`.
- Working rule 3: secret gate on added lines, with `grep`, never `findstr`.
- Working rule 5: run the workflow, never Re-run it.
- Working rule 14: no database write; the `mysports_writer` credential is never read, printed or used.
- Working rule 28: a Python-side parse is no evidence GitHub Actions agrees.
- Working rule 30: check the thing, not the label — stage A exists because Cowork's delay figures
  were inferred from a table that does not record job starts.
- Gate floors: `docs/handoff-status.md` under "Repo state", nowhere else. This brief quotes none.
- WUAB and RESN are never named. Credentials never enter the repo or a committed doc.
