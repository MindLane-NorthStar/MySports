# Claude Code — prompt 98: drop the standalone render schedule, and fix the contract rows it leaves behind

**Run in Claude Code**, in `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports`, on `main`.

**One schedule block removed, two contract rows corrected, one measurement, and the record. No
application code, no pipeline code, no database access of any kind.**

**THIS IS AN UNATTENDED RUN.** Self-commit and push under working rule 7's default; stop only for the
stop list in `CLAUDE.md`'s `## Committing` and the list at the end.

**Scope this brief may touch:** `.github/workflows/render_all.yml`, `docs/deployment-contract.md`,
`docs/queue.md`, `docs/enhancement-register.md`, `docs/handoff-status.md`, `docs/prompts/README.md`,
`docs/prompts/98-drop-standalone-render.md`, `CLAUDE.md`. Nothing else.

---

## Joe's ruling, 2026-09-14: drop it

Queue item 10 is decided. **`render_all.yml`'s own `schedule:` block comes out.** The refresh already
triggers a render — `schedule_refresh.yml`'s `render` job declares `needs: refresh` and
`uses: ./.github/workflows/render_all.yml` — and there are now two refreshes a day, so two correctly
ordered renders follow without it.

The evidence prompt 97 measured: **the standalone run fired before the refresh on 12 of 12 days**, by
42 to 74 minutes. It has never once drawn current rows. Every grid it produced on its own schedule
was built from the previous day's data.

**The argument for keeping it was that it is a backstop when the refresh fails.** What it renders on
those days is stale data, so it produces grids that look current and are not — the same failure shape
as the `25 generated` counts line that hid the logo defect for five days. A failed refresh should
leave yesterday's grids in R2 untouched, which §5's own failure rules already provide for, rather
than publish a fresh-looking wrong one. And chasing the ordering with a later cron does not work:
the two workflows drift by different amounts (refresh median 3h44m, render 4h15m), so the schedule
cannot pin an order that GitHub's queue decides.

---

## Preconditions

- `dd8714e` in history. `git status` clean apart from `assets/`; report anything else.
- `HEAD == origin/main`; say what it is.
- Five gates as the baseline, each its own command, each against the floor **read from**
  `docs/handoff-status.md` under "Repo state". **This brief quotes no gate number.**
- Working rule 1: certify the Python interpreter for Windows before running anything Python.

---

## Stage A — remove the schedule, keep everything else

`render_all.yml:5-6` is:

```
on:
  schedule:
    - cron: "30 9 * 9,10,11,12,1,2 *"
```

**Remove only the `schedule:` key and its cron.** `workflow_dispatch` and `workflow_call` both stay —
the first is how Joe runs a render by hand, the second is how the refresh calls it, and removing
either would break something that works.

**Update the file's header comment.** Line 2 currently reads "Daily 09:30 UTC in season (05:30 EDT),
after a successful refresh, or manual." That is now wrong in its first clause and was wrong in
substance all along, since 09:30 preceded the refresh it claimed to follow. Replace it with what is
true: the render runs after a refresh, or on manual dispatch, and record **why** the standalone
schedule was removed — 12 of 12 days early, by 42–74 minutes — so nobody adds it back as an
apparent omission.

**Cowork checked and no test asserts this file has a schedule.** `tests/test_workflows.py:85`
`test_schedule_refresh_is_still_scheduled` reads `schedule_refresh.yml` only. The parametrized
`test_still_valid_yaml` covers every workflow, so the file must stay valid YAML. **Run the suite and
report it by name** — working rule 28: a Python-side parse is no evidence Actions agrees.

---

## Stage B — the contract has two stale rows, and one of them is ours

`docs/deployment-contract.md` is the authority on deploy and environment facts, and its §5 table is
now wrong twice:

- **`:118`** — "`render_all.yml` | daily **09:30 UTC** in season (05:30 EDT) + after a successful
  refresh + manual". Stage A makes the first clause false.
- **`:117`** — "`schedule_refresh.yml` | **daily 11:00 UTC** (07:00 EDT / 06:00 EST) + manual
  dispatch". **Prompt 97 changed that cron yesterday and did not update this row.** That is a miss
  from the previous brief; fix it here rather than leaving it for someone to trip over.

Correct both to what the workflows now say: refresh at **07:37 and 11:37 UTC** (3:37 and 7:37 a.m.
EDT, moving to 2:37 and 6:37 after 2026-11-01), render **after a successful refresh or on manual
dispatch**, no schedule of its own.

**Follow the contract's own changelog convention** — it carries dated version entries, and
**v1.0.3's own wording is the precedent for this edit**: "three corrections where this contract had
drifted from the shipped code. In all three the code was right and the contract was stale, so the
contract moved." Add an entry in that register and in that spirit. **Read the file's existing
version numbering and continue it; do not invent a scheme.**

---

## Stage C — the budget line, measured rather than assumed

`docs/deployment-contract.md:19` (decision **D7**) justifies GitHub Actions on the free tier with
"2,000 free minutes/month; **a refresh run is ~3 minutes**".

**Prompt 97 measured a whole run at 10–28 minutes, median about 21.** If that figure is right, D7's
premise is off by roughly seven times, and the change Joe just approved **doubles the number of
runs**. Two runs a day at ~21 minutes is on the order of 1,300 minutes a month against a 2,000-minute
allowance on a private repo, where minutes are actually consumed.

**Measure it; do not estimate it.** `gh api` exposes billable minutes for the repository
(`/repos/{owner}/{repo}/actions/workflows/{id}/timing` per workflow, and the account's billing
endpoint for the total). Report:

- actual minutes consumed so far this billing month, and the allowance;
- the per-run median for `schedule_refresh` and for `render_all` separately;
- a projection for a full month under the new two-run schedule, **with the standalone render gone**;
- whether that projection clears or breaches 2,000.

**Correct D7's "~3 minutes" to the measured figure** and record the projection beside it. **Do not
change the schedule, and do not propose one** — if the projection is uncomfortable, say so plainly
and leave the decision to Joe. If `gh` cannot reach the billing endpoint, say so and record the
measurement as outstanding rather than keeping "~3 minutes" as though it were measured.

---

## Stage D — the record

- **`docs/queue.md`** — delete item 10 and say in the register what closed it. Per the file's own
  rule, an entry that has been taken is removed here and the work recorded in `handoff-status.md`.
- **`docs/enhancement-register.md`** — a new section at the next unused number. **Count and say which
  number you used**; prompt 97 took §46, so expect §47 and confirm it. Record the ruling, the 12-of-12
  evidence, the backstop argument and why it lost, the two corrected contract rows including that
  `:117` was prompt 97's miss, and stage C's measured budget figures.
- **`docs/handoff-status.md`** — record that the render now runs only after a refresh, and keep the
  existing open item about schedule drift. If stage C's projection is close to the allowance, add it
  as its own open item.
- File this brief to `docs/prompts/98-drop-standalone-render.md`, verbatim. Update
  `docs/prompts/README.md` and `CLAUDE.md`'s prompt-count and register rows. **Count; do not
  increment.**

---

## Assertions

- `grep` `render_all.yml`: no `schedule:` and no `cron:`; `workflow_dispatch:` and `workflow_call:`
  both still present.
- `grep` the repo's workflows: `cron` now appears **twice in total**, both in `schedule_refresh.yml`.
- `tests/test_workflows.py` passes, reported by name with its count, including the parametrized
  YAML check for `render_all.yml`.
- `docs/deployment-contract.md` contains no `11:00 UTC` row for the refresh and no `09:30` row for
  the render. `grep` both.
- `schedule_refresh.yml` is byte-identical — this brief does not touch it. `git status --short`
  proves it.
- **Mutation check on the grep assertion:** say what you would search for to make it pass falsely,
  and confirm it tests the schedule block rather than the word.

---

## Gates, then commit and push

All five, each its own command. Gate and commit are separate commands (rule 26). Then commit and
push, and report the Vercel result — no web code, so call it a no-op rebuild.

**End with the undo block:** the revert command with the real SHA. Note that nothing here is one-way,
**and that a revert restores a schedule that has never rendered current data** — so if it is ever
reverted, it should be for a reason other than tidiness.

**Do not dispatch any workflow.** The 07:37 UTC run tomorrow is the first test of prompt 97's change
and should be left alone to be observed.

---

## When to actually stop

Only these. Everything else, decide and keep going, and log the call.

1. `git status` is not clean apart from `assets/` at the start.
2. `tests/test_workflows.py` fails after the edit.
3. Removing the `schedule:` block would require touching `workflow_dispatch` or `workflow_call`.
4. `schedule_refresh.yml` would have to change.
5. A gate fails and cannot be made to pass.
6. Anything in `CLAUDE.md`'s `## Committing` stop list.

---

## Standing rules

- Working rule 2: never write to the repo while another prompt is in flight.
- Working rule 4: stage by explicit path; never `git add -A`.
- Working rule 3: secret gate on added lines, with `grep`, never `findstr`.
- Working rule 5: run the workflow, never Re-run it.
- Working rule 14: no database write; the `mysports_writer` credential is never read, printed or used.
- Working rule 28: a Python-side parse is no evidence GitHub Actions agrees.
- Working rule 30: check the thing, not the label — stage C exists because "~3 minutes" is a figure
  nobody has re-measured since the contract was written.
- Gate floors: `docs/handoff-status.md` under "Repo state", nowhere else. This brief quotes none.
- WUAB and RESN are never named. Credentials never enter the repo or a committed doc.
