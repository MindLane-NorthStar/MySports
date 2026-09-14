# Claude Code — prompt 95: stop `--push` from publishing art nobody approved, and diagnose the 25 conflicts

**Run in Claude Code**, in `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports`, on `main`.

**One guard, one workflow line, its tests, a read-only diagnosis, and the record. No application code,
no pipeline code, no database access of any kind.** Caching `assets/` and narrowing what the nightly
pulls are **not** here — that is brief 96.

**THIS IS AN UNATTENDED RUN.** Self-commit and push under working rule 7's default; stop only for the
stop list in `CLAUDE.md`'s `## Committing` and the list at the end.

**Scope this brief may touch:** `scripts/sync_assets.py`, `tests/test_sync_assets.py`,
`.github/workflows/schedule_refresh.yml`, `docs/enhancement-register.md`, `docs/handoff-status.md`,
`docs/queue.md`, `docs/prompts/README.md`, `docs/prompts/95-push-guard-and-conflicts.md`,
`CLAUDE.md`. Nothing else.

**`assets/` is not written by this brief, and neither is the bucket** — no `--push`, no `--pull`, no
`--force`, no `--recache`. Stage A downloads to a scratch directory only.

---

## Why this is the next brief and not the cache

Prompt 94 made the comparison honest, and the first thing an honest comparison did was show what was
already there: **29 local-only files that a bare `--push` from Joe's laptop would publish**, among
them the retired and rejected art that prompts 68 and 69 stopped at the last moment. Those two
prompts caught it by reading a diff carefully. That is not a control — it is two lucky catches, and
the bucket is public.

**The guard is the urgent work. The cache is only minutes.** The cache can wait a day; a `--push`
typed at the wrong moment cannot be un-published in any way that matters, because the upload is
atomic per file and prompt 91's stop list already names an R2 object deletion as unwaivable.

The 25 conflicts are the same measurement's other half and are almost certainly harmless — but
"almost certainly" is not a finding, so stage A measures it instead of assuming.

---

## Preconditions

- `c77e113` in history. `git status` clean apart from `assets/`; report anything else.
- `HEAD == origin/main`; say what it is.
- Five gates as the baseline, each its own command, each against the floor in
  `docs/handoff-status.md` under "Repo state" and nowhere else. **This brief quotes no gate number**
  — note that prompt 94 moved the pytest floor, so read it rather than remembering it.
- Working rule 1: certify the Python interpreter for Windows before running anything Python.
- `.env` is never read, printed or opened by you; `sync_assets.py`'s own loader reads it.

**Cowork measured, 2026-09-14 12:46 UTC:** the nightly ran on 09-12 and 09-13 and recorded its
canonical steps both days, and `team_records` carries CFB rows at `as_of` 2026-09-13 (650 rows).
The job is green. **`refresh_runs` records none of the R2 steps**, so it cannot say whether prompt
94's push saving materialized — that is stage C.

---

## Stage A — what are the 25 conflicts, really? Read-only.

All 25 are `logos/nba-*_dark.png`, and Joe's copies are 1.5–2× the bucket's size. **PNG is lossless**,
so a larger file at the same dimensions is weaker compression carrying identical pixels — which would
make this a byte difference and not an art difference at all. Measure it; do not reason it.

A throwaway probe in the scratchpad, **not committed**, that downloads the bucket's 25 objects **into
the scratchpad** — never into `assets/` — and for each pair reports:

- both file sizes;
- `Image.open(...)` mode and dimensions for each;
- whether the decoded pixels are identical (convert both to the same mode first, then compare
  `tobytes()`; if they differ, report how many pixels and the maximum per-channel delta).

**Report the verdict as one of three, and resolve nothing:**

1. **All 25 identical in pixels** → the conflict is compression only. Say so plainly; the resolution
   is a one-line `--pull` at Joe's convenience and nothing is at risk either way.
2. **Pixels differ** → this is an art question for Joe's eye, not yours. Report which teams and the
   size of the difference, and **say that it needs a look at pixel scale** rather than a rule.
3. **Anything that will not decode** → report it as its own case.

Then say which side the derive chain would regenerate: `--make-dark` builds `{id}_dark.png` through
`scripts/build_web_marks.py`'s `team_dark_variants()`, so a difference between two machines is most
likely a Pillow-version difference in the encoder. **Report the local Pillow version.** That is the
explanation to confirm or rule out, not to assert.

---

## Stage B — the guard

**`--push` must refuse to CREATE objects unless the operator says so.** Rewriting an object the
bucket already has is the normal case and stays untouched; publishing something new is the case that
has twice nearly gone wrong.

- Add an opt-in flag — `--allow-new` or whatever name reads best in the existing help text; say which
  you chose. Without it, a `--push` whose plan contains any `local_only` key **exits non-zero before
  uploading anything**, prints the count and **lists every local-only key** (not a sample — 29 is
  small and the whole point is that Joe can see what would have gone out), and names the two ways
  forward: re-run with the opt-in flag, or use `--existing-only`.
- The refusal happens **before the first `_put`**, so a partial publish is impossible.
- `--existing-only` keeps its exact current meaning and is unaffected. `--force` still rewrites
  matching bytes, and `--force` **plus** a local-only key still trips the guard — force is about
  headers on existing objects, which is what its own comment at `plan()` says.
- `--push-grids` and `--push-data` are different code paths with different intent; **leave them
  alone** and say in the report that you did.

**The nightly legitimately creates objects** — a new team's dark variant has to reach the bucket. So
**`.github/workflows/schedule_refresh.yml:253` gains the opt-in flag in the same commit.** That line
is currently `python scripts/sync_assets.py --push --prefix logos/ --make-dark`. Add a short comment
above it saying the flag is deliberate and why the guard exists, so nobody removes it as noise.

**These two changes must land together.** A guard without the workflow flag breaks tonight's nightly;
a flag without the guard does nothing. If you can only do one, stop and report.

---

## Stage C — the measurement prompt 94 predicted but could not see

Prompt 94 predicted the "Push new logos to R2" step would fall from 2–3 minutes to seconds, with
`sha256 look-ups (head_object) 0` in its log. **Two nightlies have run since.** Read one with
`gh run view --log` and report the step's duration and its head-count line.

- **If it dropped, say so with the numbers** — that is the fix proving itself in production, which
  no local gate can stand in for.
- **If `gh` is unavailable, say so plainly** and record the check as outstanding. Do not infer it
  from `refresh_runs`; none of the R2 steps writes a row there, and reading a conclusion out of an
  absence is the rule-30 error this project keeps logging.

---

## Stage D — tests

Extend `tests/test_sync_assets.py`. The stub s3 client pattern is already there; no network, no
credentials, no bucket.

- A plan with one local-only key and no opt-in flag → `--push` refuses, exits non-zero, and
  **`_put` was never called.** Assert the call count; that assertion is the guard.
- The same plan **with** the flag → the upload proceeds.
- A plan with **no** local-only keys and no flag → proceeds, because the guard must not fire on the
  ordinary case.
- `--existing-only` with local-only keys present → proceeds and creates nothing, unchanged behavior.
- `--force` with a local-only key and no flag → refuses.

**Mutation checks, required:** break the guard so it fires after the first upload rather than before,
confirm the "never called" test fails; restore. Then remove the guard entirely, confirm at least two
tests fail; restore. **Report both directions.**

---

## Stage E — the record

- **`docs/enhancement-register.md`** — a new section at the next unused number. **Count and say which
  number you used**; prompt 94 took §43, so expect §44 and confirm it. Record: what the guard
  refuses and why the nightly needed the flag in the same commit; stage A's verdict on the 25; stage
  C's production measurement or its absence.
- **`docs/handoff-status.md`** — the open item prompt 94 filed for the 25 conflicts is updated with
  stage A's verdict, and closed **only if** stage A found them pixel-identical. Add the 29
  local-only files as their own item with the guard named as what now stands between them and the
  bucket. Move the pytest floor for the new tests, in both tables.
- **`docs/queue.md`** — item 9 keeps its entry. Note that the line numbers in it predate prompt 94
  **and this brief**, and that what remains is the cache and the render-side pull.
- File this brief to `docs/prompts/95-push-guard-and-conflicts.md`, verbatim. Update
  `docs/prompts/README.md` and `CLAUDE.md`'s prompt-count and register rows. **Count; do not
  increment.**

---

## Assertions

- `python scripts/sync_assets.py --check` still runs read-only and reports the same counts shape.
  Report them; a change in the numbers since 2026-09-11 is information, not an error.
- The guard's refusal path is reachable from the real CLI, not only from the unit test: demonstrate
  it once against the real bucket **in a mode that cannot write** — the refusal happens before any
  upload, so a real `--push` that refuses is safe and is the honest proof. **If you judge that too
  close to a write, say so and prove it another way rather than doing it.**
- `grep` the workflow: the opt-in flag appears exactly once, on the logo push line.
- `tests/test_sync_assets.py` passes, reported by name with its count.
- The five gates, each its own command, each against the floor read from `docs/handoff-status.md`.

---

## Gates, then commit and push

All five, each its own command. Gate and commit are separate commands (rule 26). Then commit and
push, and report the Vercel result — no web code changes here, so call that deploy a no-op rebuild
rather than implying it proved anything.

**End with the undo block:** the revert command with the real SHA, and the honest note on what a
revert would and would not undo. In particular, **a revert removes the guard and leaves the workflow
flag behind** — an unknown flag would then fail the nightly, so the revert is `git revert <sha>` of
the whole commit and not a partial one. Say that.

**Do not dispatch any workflow.**

---

## When to actually stop

Only these. Everything else, decide and keep going, and log the call.

1. `git status` is not clean apart from `assets/` at the start.
2. Stage A cannot download the 25 objects read-only.
3. The guard and the workflow flag cannot both land in one commit.
4. A mutation check does not fail when the guard is broken.
5. A gate fails and cannot be made to pass.
6. Anything in `CLAUDE.md`'s `## Committing` stop list.

---

## Standing rules

- Working rule 2: never write to the repo while another prompt is in flight.
- Working rule 4: stage by explicit path; never `git add -A`.
- Working rule 3: secret gate on added lines, with `grep`, never `findstr`.
- Working rule 14: no database write; the `mysports_writer` credential is never read, printed or used.
- Working rule 30: check the thing, not the label — stage A exists because "PNG is lossless so the
  pixels must match" is reasoning, not a measurement.
- Gate floors: `docs/handoff-status.md` under "Repo state", nowhere else. This brief quotes none.
- `assets/` is a cache with five tracked fonts in it; R2 is the source of truth.
- WUAB and RESN are never named. Credentials never enter the repo or a committed doc.
