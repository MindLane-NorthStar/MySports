# Prompt 109 — PAGINATE THE STANDINGS READ, MAKE THE CAP LOUD, AND CLOSE THE SECOND-WRITER HOLE

**REVISED TWICE on 2026-09-22.** Block F was added after Joe's ruling on `AGENTS.md`, then its
CAUSE was corrected — see the correction note inside Block F. Record the corrected cause, not the
earlier inference.

The fix for the truncation prompt 108 proved, the guard that stops a third occurrence, and the
guard for a different silent reappearance. Stacks on `322b38f`. `origin/main` is `192677f` — four
commits behind when this lands. **Stages self-commit on green; DO NOT PUSH.**

*(107, the iPad tablet-grid measurement, still waits — it measures block widths that depend on the
record strings this prompt corrects. Preemption is 110.)*

## What prompt 108 established

`standingsFor` (`web/lib/queries.js:210-218`) issues one unbounded PostgREST read ordered
`as_of.asc`. Measured:

| | day 2026-09-03 | week 2026-08-31 |
|---|---|---|
| unique teams | 40 | 210 |
| rows returned | 660 | **1000** |
| rows available | 660 | **2820** |
| newest `as_of` seen | 2026-09-22 | 2026-09-14 |

**1,820 rows silently dropped.** Because the order is ascending, truncation removes the newest rows,
and `indexStandings` (`web/lib/standings.js:142-150`) then picks the newest of what survived. Forty
`(team, season)` pairs differ and the week is older in every one. This has been live in production on
every week view, not only in the gate.

**This is the second time.** `web/lib/rest.js:53-54` already records the lesson from the Weeks picker
losing a third of the season: *"Use it for any read whose row count grows with the season — a bigger
magic limit only moves the cliff to next year."* `restAll()` has existed at `:56` since then.
`standingsFor` called `rest()` anyway.

## Block A — the fix

**`standingsFor` uses `restAll()`.** That is the repo's own prescribed answer and the only option
that is correct at any row count.

Three alternatives were considered and rejected — record why in the register, briefly, so this is not
re-litigated:

- `order=as_of.desc` alone hides the truncation rather than removing it; the response is still short.
- A bounded `as_of` window drops the record line for any team whose newest row predates it.
  `docs/handoff-status.md` records that NHL and NBA `team_records` are season 2025 by design
  (prompt 37), and the Cavaliers' over-the-air games begin 2026-10-26 with sparse early standings —
  so this would strip records off exactly the cards prompts 104–106 just built.
- A `latest_team_records` view or `distinct on` is the best long-term shape (≈210 rows for the week
  instead of 2,820) but needs a migration, and is not required to stop the bleeding. **Name it in the
  register as the eventual answer; do not build it here.**

**Report the round-trip count and the total rows after the change**, for both the day and the week.
`restAll` pages at 1,000, so the week should take three.

## Block B — the cap guard, so there is no third time

A static test over `web/lib/queries.js` that walks **every** `rest()` call site and requires each to
be one of:

1. carrying an explicit `limit=`, or
2. bounded by a filter that cannot grow with the season (a single id, one viewing day, one week), or
3. using `restAll()`.

Anything else fails. Bounded calls go in an **allowlist that states the reason per entry** — the
value is in someone having to write the reason down, the same way `railmark.test.mjs` makes a new
mark impossible to add unnoticed.

**Mutation-check it:** reverting `standingsFor` to bare `rest()` must fail this test, and so must
adding a new unbounded call.

## Block C — the audit prompt 108 opened

Measure, today, the actual row count of every bare `rest()` read that can grow, and report each
against 1,000. **`web/lib/queries.js:181` is the one to look at hardest:** it reads
`generated_grids` with **no filter at all**, one row per sport per day, ordered `generated_at.desc`.
Descending order means it fails benignly — truncation drops the oldest — but it means the grid index
silently sees only the newest 1,000 grids, and an archived day past that horizon would render as "no
grid" with no error. **Report its count. Do not fix it in this prompt** unless it is already over the
cap, in which case say so and stop for Joe's ruling.

`rankingsFor` (`:229-237`) measured 24 of 24 in prompt 108 — under the cap only because it filters by
week. It should satisfy the Block B allowlist on that basis, with the reason written down.

## Block D — the corrections this commit owes

Rule 30: a correction lands in the same commit as the work it misled.

- **`CLAUDE.md`'s claim that the geometry check is "immune to drift, because both sides see the same
  standings on the same run" is FALSE** and prompt 108 proved it. Correct it. Both sides saw
  different standings on the same run for eight days.
- **`docs/deployment-contract.md` does not mention `db-max-rows` anywhere.** The 1,000-row cap is a
  Supabase project setting that silently changes app behaviour, and it has now caused two production
  defects. Record it there as a deployment property, with a pointer to `rest.js`'s prescription.
- `CLAUDE.md` rule 19 already names the cap — check whether it needs sharpening now that a second
  read has crossed it, and say what you decided either way.

## Block E — does the gate go green on its own?

After Block A, re-run `npm run geometry` and report the ALL SPORTS case.

**The expectation is that it passes without touching `web/scripts/geometry.mjs`** — once the week
view reads current records, the day and week strings agree and the three failing checks resolve. **Do
not assume it. Measure it.**

- If it goes green: say so, and note that the pinned-week change proposed in the earlier report was
  never needed and would have masked a live production bug.
- If it does NOT go green: **stop and report.** Do not re-baseline a measured figure and do not move
  the pinned case. That would be a second finding and it is Joe's ruling.

## Block F — `AGENTS.md`, and why `git status` was not enough

**Joe's ruling, 2026-09-22: `CLAUDE.md` is the only agent-instruction file this repo has, and a
reappearance of any other must be a red gate rather than a line in `git status`.**

**A CORRECTION TO THE CAUSE, and record THIS version rather than the earlier one.** Cowork first
inferred from register §49's precedent that a recreated `AGENTS.md` meant Codex had been run against
this repo again. **Joe corrected that on 2026-09-22: the file was Codex output generated for an
entirely different project that landed in this folder.** It is a stray write, not a second agent
working this repo. The guard is still worth having — the risk below does not depend on intent — but
the register must not record a deliberate second agent, because that is not what happened.

The file itself, verified by Cowork rather than carried from the register: untracked root
`AGENTS.md`, 22,540 bytes, dated 2026-09-16 23:31, and it is **`CLAUDE.md` with "Claude Code"
replaced by "Codex"** — five mentions of Codex, zero of Claude Code, *"Codex (here) — the default for
anything whose answer is in the repo"*, *"Never write to the repo while another Codex prompt is in
flight"*, and "Claude.ai Project" rewritten as "Codex.ai Project". Its "Read first" table cites the
register as `§1–§53`, so it was generated from a `CLAUDE.md` that already included prompt 106.

**Why the existing guard failed.** Register §49 chose `git status` visibility as the protection:
*"if it comes back it shows as `?? AGENTS.md`."* It came back on the 16th and was not noticed until
the 22nd — six days and three commits later. **Visibility is only a guard if someone looks**, and a
stray write is exactly the case nobody is looking for.

**Why it is worth guarding even as an accident.** A divergent copy of the rules is dangerous
regardless of how it arrived: the September 14 copy had already drifted two rows from `CLAUDE.md`
when prompt 100 found it, and a rules copy includes the unwaivable stop list and the push
authorization. This is the same second-copy failure that made `docs/handoff-status.md` the only home
for the gate floors. A file that arrives by accident can be read on purpose.

Do:

1. **Delete the root `AGENTS.md`.**
2. **Do NOT gitignore it.** §49's reasoning holds — an ignored file is invisible to both the gate and
   the eye.
3. **Add a repo-root `pytest` test** (this belongs in `tests/`, not `web/test/` — `test:unit` runs
   from `web/` and cannot see the repo root) that fails when an agent-instruction file other than
   `CLAUDE.md` exists at the root. Cover the conventions that exist today, not only this one:
   `AGENTS.md`, `GEMINI.md`, `.cursorrules`, `.windsurfrules`, `.github/copilot-instructions.md`,
   `CONVENTIONS.md`. **Verified 2026-09-22: none of these exist except `AGENTS.md`**, so the test is
   green the moment that file is gone.
4. **The failure message is the deliverable, not the assertion.** It must say what was found, that
   `CLAUDE.md` is the only agent instruction file this repo has, that a copy of the rules is
   dangerous because it drifts, and that the fix is to delete the file and find out what created it —
   not to add it to the allowlist. Someone hitting this in four months has none of today's context.
   **Say in the message that the known cause is a stray write from another project**, so the next
   reader does not go hunting for an intruder.
5. **Mutation-check it:** recreating any one of those files must fail the test.

## Do NOT

- **Do not push.** Joe authorizes it.
- **Do not touch `web/scripts/geometry.mjs`** — not the pinned case, not a baseline, not a skip.
- **Do not build the `latest_team_records` view or any migration.**
- **Do not gitignore `AGENTS.md`** (Block F item 2).
- **Do not create `.vscode/settings.json` or any editor config.** There is no `.vscode` directory and
  it is not gitignored, so a file there would be a new untracked repo artifact — the exact category
  Block F is guarding. Joe is handling the editor side on his machine, outside the repo.
- No iPad or tablet work (107), no preemption (110).

## Gates and committing

All five gates, each as its own command with its own count, floors read from `docs/handoff-status.md`
under "Repo state" beforehand — they moved with prompt 106 (`pytest` 619 + 1 skipped, `test:unit`
624). **`pytest` will move again** with Block F's test; report the new floor and edit the floor row in
the same keystroke as the movements row.

Every new assertion gets a mutation check, said out loud.

Record in `docs/enhancement-register.md` as its own section: the measured truncation, that it was the
second occurrence of a lesson already written in `rest.js`, the four options and why `restAll` won,
the view as the eventual answer, the cap guard — **and, as its own sub-section, Joe's `AGENTS.md`
ruling, the corrected cause above, and why `git status` visibility was insufficient**, amending §49
rather than contradicting it.

**Stages self-commit on green. DO NOT PUSH.** End with `git status --porcelain`,
`git rev-parse --short HEAD`, `git rev-parse --short origin/main`, and the work left in the tree.
