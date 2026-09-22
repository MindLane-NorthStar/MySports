# Prompt 103 — MEASURE WHEN THE SCHEDULED REFRESH ACTUALLY FIRES

**Read-only. No code changes, no commits, no pushes. Nothing in this brief modifies the tree.**

## Why

Joe checked the installed app at 6:45 a.m. ET on 2026-09-15 and 2026-09-16 and found the prior day's
results missing; they were there later in the morning. He reads that as the 7:37 a.m. run doing work the
3:37 a.m. run failed to do, and asked for the cron times to be changed.

**Two stories produce that identical symptom, and they have opposite fixes:**

**A.** The 3:37 run fires on time and the fresh rows do not reach the phone. The cron is innocent and the
fault is downstream — the `render` job, the R2 publish, Vercel, or the installed PWA's own cache.
**B.** The 3:37 run has not started by 6:45. The cron is irrelevant, because the time in the file is not
the time GitHub honors.

This brief decides which. **Do not fix anything.** Measure and report.

## What is already established — do not re-derive it

`docs/enhancement-register.md` §46 (prompt 97, 2026-09-14) measured twelve scheduled runs against the OLD
`0 11 * * *` schedule: a median 3h44m late, worst 5h13m, best 2h37m, and on 2026-09-14 one had not fired
5h22m after it was due. `startedAt == createdAt` in every one, so the delay is GitHub queuing the event,
not a runner waiting. That table is the baseline; this run measures the NEW schedule against it.

## What the tree says — verified 2026-09-16 before this brief was written

- `.github/workflows/schedule_refresh.yml:20-21` carries `cron: "37 7 * * *"` and `cron: "37 11 * * *"`
  — 3:37 and 7:37 a.m. EDT.
- That block landed in `dd8714e`, committed **2026-09-14 16:36 UTC**. **So the new schedule has produced
  at most four scheduled runs**: 07:37 and 11:37 UTC on 2026-09-15 and 2026-09-16. **n = 4.** Say so in
  the report and do not present four runs as a trend.
- `schedule_refresh.yml` has two jobs: `refresh` (line 29, `timeout-minutes: 35`) and `render`
  (line 307, `needs: refresh`).
- `render_all.yml` has no schedule of its own — `workflow_dispatch` and `workflow_call` only (prompt 98,
  register §47). It is not a second trigger and is not in scope.

## Block A — the run history

1. `gh auth status`. Report the account and token scopes verbatim. **If `gh` is not authenticated, stop
   and say so** — do not attempt to authenticate or to install anything.
2. `gh run list --repo MindLane-NorthStar/MySports --workflow schedule_refresh.yml --limit 40 --json databaseId,event,status,conclusion,createdAt,startedAt,updatedAt,headBranch`
3. From that JSON, for every run created on or after 2026-09-14, give one row per run: run id, `event`,
   `createdAt` and `updatedAt` in **both UTC and America/New_York**, elapsed minutes
   (`updatedAt − createdAt`), `conclusion`, `headBranch`.
4. **Partition by `event`.** `schedule` rows are the measurement. `workflow_dispatch` rows are Joe's
   manual runs and must be labeled as such — never folded into a delay figure.
5. For each `schedule` row, compute the delay against the nearer of 07:37 and 11:37 UTC.

**THE ATTRIBUTION LIMIT, AND DO NOT PAPER OVER IT.** Two cron lines live in one workflow and a run object
does not record which line fired it. With delays measured in hours and the two due times four hours
apart, attribution is a guess. **Report each run's actual start time as the fact**, and mark any cron
attribution explicitly as inferred, with the reasoning shown. If two scheduled runs on one date cannot be
told apart, say exactly that.

6. List every UTC date from 2026-09-15 onward and how many `schedule` runs it carried. **A date with
   fewer than two is the finding**, not a gap to smooth over.

## Block B — did they succeed, and when did the work actually land

7. For each scheduled run since 2026-09-15, report `conclusion`. **A run that fired at 3:40 and failed
   explains Joe's symptom as surely as one that never fired** — do not treat "it fired" as the answer.
8. For the most recent scheduled run of each date: `gh run view <id> --json jobs`, and report per job
   (`refresh` and `render`) the `startedAt`, `completedAt` and `conclusion`. **The number that matters is
   when the `render` job COMPLETED** — that, not the refresh's start, is the earliest a fresh grid could
   reach the phone. Give it in ET.
9. State plainly, per date: **was the `render` job complete before 6:45 a.m. ET?**

## Explicitly out of scope

- **Do not change the cron, the workflow, or any file.** The point of this run is to decide whether a
  change is warranted at all. Joe has ruled nothing.
- **Do not investigate the downstream path** — render output, R2, Vercel, or the PWA cache. If Block B
  shows the render completing before 6:45 a.m. on a day Joe saw stale data, that is story A, and it is
  the NEXT brief with a different instrument. Name it and stop.
- **Do not build or evaluate an external scheduler.** Cowork has scoped the options (Supabase Cron,
  a Cloudflare Worker cron, a third-party service); the decision is Joe's and has not been made.
- **No database reads.** `mysports.refresh_runs` records steps, not job starts, and §46 already found it
  overstates delays by 2–6 minutes. The Actions log is the better instrument for this question.

## Gates — a judgment call, stated rather than assumed

**The five gates are NOT to be run for this brief.** It changes no file, adds no assertion and needs no
mutation check; running 598 pytest cases and 609 unit tests to read a cron log is pure cost. Instead end
the run with `git status --porcelain` and `git rev-parse --short HEAD`, and confirm the tree is unchanged
at `192677f` with nothing outstanding but the known-untracked `assets/` (which is untracked on purpose
and is not drift).

## The report I want back

The scheduled runs since 2026-09-15 with actual start and `render` completion times in ET; the yes/no per
date on "complete before 6:45 a.m."; which story — **A or B** — the evidence supports, **or a plain
statement that n = 4 cannot support either**; and anything in the run history that contradicts §46's
baseline. Flag disagreements rather than reconciling them silently.
