# Claude Code — RUN 3: the refresh job needs more than 20 minutes

**Run in Claude Code**, in `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports`, on `main`.
**One workflow line, one `CLAUDE.md` fix, and the records. No pipeline code, no application code, no
database access of any kind.**

**THIS IS AN UNATTENDED RUN.** Self-commit and push under working rule 7's default, stop only for
S1–S7. Small brief — one commit is right.

`main` and `origin/main` were both `4fc0ff8c1704bff5992a6cc2d632970afddb870f` when Cowork checked.

---

## What Cowork measured, and why this is not papering over a bug

**`schedule_refresh` run #18 failed on 2026-09-11 with the annotation "The job has exceeded the maximum
execution time of 20m0s."** The `refresh` job at `.github/workflows/schedule_refresh.yml:16` carries
`timeout-minutes: 20` at `:18`. The run lasted 20m 13s.

**That run predates today's commits** — it started at 10:44 AM EDT; RUN 1 pushed at 11:48 and RUN 2 at
12:21 — so it ran entirely on old code. **This is a pre-existing defect, not a consequence of prompts
89, 90 or 91.**

**Where the job actually got to, measured from the database rather than the log:**

| step | line | evidence | UTC |
|---|---|---|---|
| Standings (pro leagues) | `:86` | `refresh_runs` 142 | 14:51:49 |
| CFB polls → rankings | `:90` | `refresh_runs` 143 | 14:52:02 |
| Reconcile program eligibility | `:235` | `refresh_runs` 144 | 14:54:24 |
| Load fixtures | `:253` | `refresh_runs` 145 | 14:58:06 |
| **CFB ranks/records into games** | **`:255`** | **cfb week 15 `games.updated_at`** | **15:02:31** |
| Reconcile canonical facts | `:262` | `refresh_runs` 146 | 15:02:33 |
| Unit tests / watch links / archive | `:264`, `:266`, `:280` | never recorded | — |

Job start was 14:44 UTC, so **the CFB enrichment step is reached at roughly 18 minutes and the job is
killed at 20.** The three tail steps never complete. `render` at `:288` declares `needs: refresh`, so
**while `refresh` fails, the grids never regenerate either.**

**Why raising the limit is the honest fix rather than a workaround.** That job runs eight provider
fetches, an R2 asset pull and push, the loader, two reconcilers, a unit-test pass, a link checker and
an archive upload. Twenty minutes was always tight and the job has grown into it — successful runs on
2026-09-10 took 18m, 22m and 23m. **Nothing regressed; the work outgrew the box.** And RUN 2 just added
to that same step: a week-range query, a CFBD `/records` fetch, and an upsert of roughly 680 rows.
Dispatching at a 20-minute ceiling would be a coin flip.

**The durable fix is splitting the job, and it is deliberately NOT in this brief** — that is a design
question about ordering and failure isolation, and queue item 7 (building the schedule to April 2027)
makes it urgent rather than optional. Record it; do not do it.

---

## Preconditions

- `git status` clean apart from `assets/`. Report anything else rather than assuming it is expected.
- `HEAD == origin/main`; say what it is.
- Five gates as the baseline, each its own command, each against the floor in
  `docs/handoff-status.md` under "Repo state" and nowhere else. This brief quotes no gate number.
- Working rule 1: certify the Python interpreter for Windows before running anything Python.

---

## The changes

**1. `.github/workflows/schedule_refresh.yml:18` — `timeout-minutes: 20` becomes `timeout-minutes: 35`.**

Fifteen minutes of headroom over the 20 the job currently exhausts, and low enough that a genuinely
hung job still fails within the hour rather than burning a runner. **Add a one-line comment above it**
recording what it was, the date, and that run #18 hit the old ceiling — so the next person to read it
knows the number was measured rather than guessed.

**Change nothing else in that file.** Not the step order, not the CFB step's position, not `render`.

**2. `CLAUDE.md:23` still reads `§1–§39`; the register now has §40.** RUN 2 created that drift and
flagged it. Fix it. **Count the register's sections rather than trusting either number** and say what
you counted.

**3. The record.**

- **`docs/enhancement-register.md`** — a new section at **the next unused number; count, do not
  assume**. Record the measured evidence above, the number chosen and why, and state plainly that the
  job outgrew its box rather than regressing.
- **`docs/handoff-status.md`** — one open item: the `refresh` job is at roughly 18 of its 20 minutes
  before the CFB step even begins, the tail steps have not been completing, and `render` has been
  blocked behind it.
- **`docs/queue.md`** — a new entry: split the `refresh` job. Say what the evidence is, that the three
  tail steps (`:264`, `:266`, `:280`) are the natural cut because none of them writes canonical data,
  and that queue item 7 makes it pressing. **A description of a problem, not an approved plan.**
- File this brief to `docs/prompts/92-refresh-timeout.md`, verbatim, `NN-slug.md`. Update
  `docs/prompts/README.md` and `CLAUDE.md`'s prompt-count row per their own conventions. **Count the
  directory; do not increment the number.**

---

## Assertions

- `grep` the workflow: `timeout-minutes` appears once, reads 35, and is on the `refresh` job.
- The workflow still parses. `tests/test_workflows.py` is the guard — working rule 28 says a
  Python-side parse is no evidence Actions agrees, so **run that test and report it by name**, do not
  substitute a PyYAML load.
- `CLAUDE.md` contains no `§1–§39`, and its register row matches the section count you measured.
- No step name, no step order and no `run:` line in `schedule_refresh.yml` differs — diff the file and
  confirm the only changed lines are the timeout and its new comment.

---

## Gates, then commit and push

All five, each its own command, each against the floor in `docs/handoff-status.md` under "Repo state".
Gate and commit are separate commands. Then commit and push, and report the Vercel result.

**End with the undo block** — the revert command with the real SHA, what was one-way (nothing: no
database rows, no deletions), and whether the push deployed.

**Do not dispatch the workflow.** Joe does that, after this lands.

---

## When to actually stop

Only these. Everything else, decide and keep going, and log the call.

1. `git status` is not clean apart from `assets/` at the start.
2. `tests/test_workflows.py` fails after the edit.
3. A secret-gate hit.
4. A gate fails and cannot be made to pass.
5. Any database write or DDL would be required — it will not be.
6. A force-push, history rewrite or branch deletion would be required.
7. A file outside the scope below would have to be deleted or overwritten.
8. `.env`, `.env.example`, or `.gitignore`'s credential lines would have to change.

---

## Standing rules

- Working rule 2: never write to the repo while another prompt is in flight.
- Working rule 4: stage by explicit path; never `git add -A`.
- Working rule 3: secret gate on added lines, with `grep`, never `findstr`.
- Working rule 5: run the workflow, never Re-run it.
- Working rule 14: no database write; the `mysports_writer` credential is never read, printed or used.
- Working rule 28: a Python-side parse is no evidence GitHub Actions agrees.
- Gate floors: `docs/handoff-status.md` under "Repo state", nowhere else. This brief quotes none.
- `assets/` is untracked on purpose and is not drift.
- WUAB and RESN are never named. Credentials never enter the repo or a committed doc.

**Scope this brief may touch:** `.github/workflows/schedule_refresh.yml`, `CLAUDE.md`,
`docs/enhancement-register.md`, `docs/handoff-status.md`, `docs/queue.md`, `docs/prompts/README.md`,
`docs/prompts/92-refresh-timeout.md`. Nothing else.
