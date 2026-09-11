# Prompt 88 — the NFL refresh window, and making rule 14 true

**Written by Cowork 2026-09-10. Two blocks, independent of each other.** Both carry a ruling Joe gave
explicitly this session; neither is a proposal to be re-argued. Block A closes `docs/queue.md` item 1.
Block B closes the "DECISION WAITING ON JOE" section at the foot of the same file.

**Tree at the time of writing:** `main` == `origin/main` == `b54e502`, clean apart from untracked
`assets/`. Verified from `.git/refs/heads/main` and `.git/refs/remotes/origin/main`.

**Commit policy for this run: DO NOT COMMIT AND DO NOT PUSH.** Neither block is authorized to
self-commit. Prompts 86 and 87 carried that authorization for themselves and it did not survive them.
Each block ends by reporting the five gates and leaving the work in the tree for Joe.

**Read first, in this order:** `CLAUDE.md`, then `docs/handoff-status.md` — the gate floors are under
"Repo state" there and nowhere else. **This brief quotes no gate numbers on purpose.**

**This file is already in the tree** at `docs/prompts/88-nfl-window-rule14.md`, written by Cowork
before the run and untracked until the work is committed. It is not drift and needs no action.

---

## Block A — give NFL the same rolling 7-day window NBA and MLB already have

### The ruling

Joe chose the seven-day date window over both alternatives (fetching by NFL week number, and patching
Thursday and Monday explicitly). The reasoning he accepted: date-driven code never has to know what an
NFL "week" is, so flex moves, December Saturdays, international morning games and the January
regular-season/playoff boundary are all covered without anyone having to anticipate them. The
week-number option was rejected because nothing in the nightly derives an NFL week and a naive
date-arithmetic derivation breaks precisely at week 18 — CFB needed a purpose-built `--latest-week`
resolver for that same reason (`.github/workflows/schedule_refresh.yml:50-52`).

### The measurement

`.github/workflows/schedule_refresh.yml:54-57` is the NFL step. It fetches exactly two dates:

```
:56   --date <yesterday>                       # finals pass
:57   --date <t + timedelta((6 - t.weekday()) % 7)>   # the coming Sunday
```

`adapters/espn.py:270` documents `--date` as "viewing day YYYY-MM-DD (ET); **fixture holds only that
day's games**", and `adapters/espn.py:177` is the filter that enforces it —
`if day_filter and (dt is None or et_date(start) != day_filter): continue`. So a date fetch returns
that day and nothing else, and every NFL game not on a Sunday is in neither of the two questions on
the day it is played.

Confirmed by measurement on 2026-09-10 (recorded in `docs/queue.md` item 1): Thursday
`nfl-401872657` and Monday `nfl-401872931` were the only two games of week 1 without a stored game
link; all fifteen Sunday games had one. Migration 0019 has since given every game a link, so **that
symptom is gone and is not what this block fixes.** What remains is that those games carry whatever
kickoff time and status the last full load wrote, and no score is stored while they are being played.

### What to change

Replace the step at `:54-57` with the loop shape the NBA step already uses at `:62-66`. The
recommended form — deviate only if you can justify it in the report:

```yaml
      - name: NFL (ESPN) — next 7 viewing days (every game day, not only Sunday)
        run: |
          for i in -1 0 1 2 3 4 5 6; do
            python -m adapters.espn --league nfl --date $(python -c "import datetime as d;print((d.date.fromisoformat('${{ steps.when.outputs.date }}')+d.timedelta($i)).isoformat())") --no-logos || exit 1
          done
      - name: NFL teams + logos (ESPN) — the art refresh the date loop no longer carries
        run: python -m adapters.espn --league nfl --teams-only
```

**The `--no-logos` flag is not cosmetic and the second step is not optional.** Verify both against the
adapter before you write them:

- `adapters/espn.py:315-316` runs `fetch_logos(...)` on every invocation **unless** `--no-logos` is
  passed. The current NFL step passes no such flag, so today two calls means two logo passes; seven
  calls without the flag would mean seven, for no benefit. The NBA, NHL and MLB steps all pass it
  (`:60`, `:65`, `:70`).
- But `adapters/espn.py:290-292` shows the NFL path is the **only** league whose logos this adapter
  writes at all. Suppressing logos across all seven calls therefore stops NFL art refreshing
  entirely — an accidental behavior change riding along with a scheduling fix. The `--teams-only`
  step restores it explicitly, and is the shape `bootstrap_season.yml:43` already uses.
- **Check that claim yourself.** Read `adapters/espn.py:290-293` and confirm that `--teams-only` on
  NFL reaches `fetch_logos` and returns before the schedule fetch. If it does not, say so and propose
  the alternative rather than shipping the step.

### What was searched, and what it did and did not find

- `grep -ni "nfl\|weekday\|sunday" tests/test_workflows.py` → **no hits.** There is no existing
  assertion anywhere in that file about the NFL step's shape, so the test below is additive, not a
  replacement.
- `grep -n "^      - name:" .github/workflows/schedule_refresh.yml` → **exactly one step name begins
  with "NFL"**, which is what makes the selector in the test below safe.
- **Not searched, because Cowork could not:** the rest of the repo. The device shell could not mount
  the folder this session, so this brief was assembled from staged copies of individual files.
  **Before editing, run `grep -rn "(6-t.weekday())" .` and `grep -rni "coming sunday" .` and report
  every occurrence.** If the Sunday selector or a comment describing it appears anywhere else —
  another workflow, a doc, a test — name it and stop rather than leaving a second copy behind.

### In scope and NOT in scope

- **The NHL step at `:58-61` looks wrong and is not in scope.** Its name says "the 7-day window" but
  its `run` makes two single-date calls, the same shape the NFL step has. It is almost certainly fine
  because the NHL adapter's own date endpoint returns a week — but Cowork did not verify that and is
  not asking you to change it. **If you confirm either way while you are in the file, report it in one
  line and change nothing.** It becomes a queue entry, not part of this run.
- `pipeline.load --all` at `:239-240` needs no change: it globs `artifacts/validation` and already
  handles the eight fixtures each of NBA and MLB produce. Seven NFL fixtures are the same shape. State
  in the report that you confirmed this rather than assumed it.
- The hard-coded `--through 2026-12-31` end dates are `docs/queue.md` item 7 and are **not** in scope.

### The test, and its mutation check

Add one test to `tests/test_workflows.py`, in the style of
`test_schedule_refresh_conditions_logos_before_pushing` at `:91-112` — **parse the YAML and walk to
the step**, per rule 28. A substring test against the raw file would pass with the loop sitting in a
comment.

It must assert both halves: that the step covers a range of days, and that the Sunday-only selector is
gone. Something like:

```python
def test_nfl_refresh_covers_every_game_day_not_only_sunday():
    doc = yaml.safe_load((ROOT / ".github" / "workflows" / "schedule_refresh.yml").read_text(encoding="utf-8"))
    steps = doc["jobs"]["refresh"]["steps"]
    nfl = [s for s in steps if str(s.get("name", "")).startswith("NFL") and "--date" in str(s.get("run", ""))]
    assert len(nfl) == 1, f"expected exactly one NFL date-driven step, found {len(nfl)}"
    run = nfl[0]["run"]
    assert "for i in -1 0 1 2 3 4 5 6" in run
    assert "(6-t.weekday())" not in run, "the Sunday-only selector must be gone, not merely supplemented"
```

Write the docstring the way that file's docstrings are written: what it pins, why parsing beats
substring matching here, and **why it matters enough to pin** — that the hole it guards silently drops
two game days a week for an entire season and fails no other gate.

**Mutation check, and report it explicitly:** restore the two-date form, run the test, confirm it
fails, restore the loop, confirm it passes. An assertion that has never been seen to fail is not
evidence.

### Verification — two stages, with a stop between them

**Stage A1 — in the tree, no commit.**

1. Make the change and add the test.
2. Run the mutation check above.
3. Run all five gates as their own commands, from the directories `CLAUDE.md` names:
   `pytest` (repo root), `npm run test:unit`, `npm run smoke`, `node scripts/qa-shots.mjs`,
   `npm run geometry` (all from `web/`). Read the floors from `docs/handoff-status.md` under "Repo
   state" and report all five counts against them. Never read a gate's result from a chained
   command's exit code.
4. Report, and **stop.** Do not commit. Do not push.

**Stage A2 — after Joe approves the push. Do not begin this on your own.**

A `workflow_dispatch` runs the workflow as it exists on the branch, so this change cannot be verified
by a dispatched run until it is pushed. That is why the stop is where it is.

Once Joe has approved and the commit is pushed: dispatch `schedule_refresh` once — **rule 5, dispatch
it, never re-run a previous run** — and report from the run log:

- the NFL step's fetch count: **seven `fixture: N games` lines, one per date**, not two;
- that **today's date appears among them**. 2026-09-10 is a Thursday with a scheduled game
  (`nfl-401872657`, 20:35 ET), so its fixture should be non-empty — that single line is the whole
  point of the change and is the acceptance test;
- whether the NFL teams/logos step ran clean;
- the job's total wall time against the eighteen minutes it ran before, so the cost of the change is
  a measured number and not an estimate.

---

## Block B — make CLAUDE.md rule 14 true

### The ruling

Joe chose to amend the rule rather than remove the credential. The credential stays on the laptop; the
rule stops claiming it does not exist.

### The two facts, both verified 2026-09-10

- **`CLAUDE.md:85-87` says:** *"Database writes go through the Supabase connector, and only through
  it. There is still no direct Postgres connection and no writer credential in the repo, in `.env`, or
  in any prompt — the connector holds it."*
- **`.env` exists at the repo root, 501 bytes**, and holds a live `mysports_writer` connection string.
  Confirmed by counting the line, never by printing it. **Do not print it, echo it, cat it, or quote
  any part of it in the report, the commit message, or any file.**
- **`.gitignore:1-3` is `.env`, `.env.*`, `!.env.example`.** The file cannot be committed. Nothing is
  exposed to anyone; the rule and the file simply disagree.
- **`docs/deployment-contract.md:142`** is §7 step 5, "Local `.env`", the instruction that told Joe to
  create the variable in the first place. It sits in a list of five env vars of which four are R2
  credentials.

### What to change — one file, one rule, surgically

Rewrite only the clause that is false. Rule 14 bundles several claims and **the rest of it must
survive verbatim**: the four binding conditions (named approval per operation, SELECT and paste first,
schedule checked first, every DDL statement existing as a file in `db/migrations/` before it is
applied), the hard stops (`drop`, `truncate`, a `delete` with no `where`, any write while the loader
is running), and the sentence establishing PostgREST reads with the publishable anon key as the app's
normal read path.

The replacement clause must say all four of these and no more:

1. Database writes go through the Supabase connector — unchanged, still the operative rule.
2. There is no direct Postgres connection and no writer credential **in the repo or in any prompt**.
3. A `mysports_writer` credential **does** exist in the untracked local `.env`, put there by
   `docs/deployment-contract.md` §7 step 5, for the pipeline's own use — `scripts/apply_migration.py`
   and loader runs that write directly rather than emitting SQL. `.gitignore:1-2` makes it
   uncommittable.
4. **A Claude Code session never reads it, prints it, or uses it.** Writes go through the connector or
   the nightly Action, under the four conditions already stated.

Keep the numbering and the surrounding rules untouched.

### What NOT to touch

**`docs/deployment-contract.md` is correct as written and must not be edited.** Cowork's earlier
framing to Joe was that one of the two documents would have to change; on reading both, only
`CLAUDE.md` does. The contract instructs a setup step that is legitimate — the same `.env` holds four
R2 credentials that nothing disputes. Amending rule 14 makes the two agree without touching it. **Do
not add a cross-reference to it either.** If you believe it needs one, say so in the report and leave
it alone.

`.env` itself is not touched by this block. Neither is `.env.example`.

### Queue cleanup, both blocks

`docs/queue.md`'s own header says an entry is deleted there and the work recorded in
`docs/handoff-status.md` when it is taken. Do both, in the same change as the work:

- **Delete item 1** ("NFL games off Sunday are never refreshed on the day they are played") and record
  in `docs/handoff-status.md` what was done and what it was measured against.
- **Delete the whole "DECISION WAITING ON JOE — the writer credential in `.env`" section** at the foot
  of `queue.md`, and record the ruling and its reasoning in `docs/enhancement-register.md` — a
  decision with a rationale belongs in the register, not only in a status note.
- **Renumber the remaining queue entries** so the file has no gap at 1, and check whether any surviving
  entry cross-references another by number before you do. Report what you found.

### Verification

Run all five gates as their own commands and report all five against the floors in
`docs/handoff-status.md`. Then **stop. Do not commit. Do not push.**

---

## What to report

For each block, in this order: what you searched and what it returned — **including searches that
found nothing**, since an absence is the finding in three places above; every file and line you
changed; the mutation check and whether the test was actually seen to fail; all five gate counts
against their floors; anything in the brief that turned out to be wrong when checked against the tree,
named plainly rather than worked around; and the work left in the tree, as `git status --short`.

**Two claims in this brief are Cowork's and should be checked, not trusted:** that `--teams-only` on
NFL reaches `fetch_logos` (`adapters/espn.py:290-293`), and that nothing outside
`tests/test_workflows.py` asserts on the NFL step's shape. The first was read from a staged copy of
the file; the second could not be searched repo-wide from Cowork this session. A brief's claims are
claims.
