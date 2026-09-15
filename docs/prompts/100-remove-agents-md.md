# Claude Code — prompt 100: delete the stray AGENTS.md

**Run in Claude Code**, in `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports`, on `main`.

**One untracked file deleted, one register entry. No code, no CSS, no workflow, no database access.**

**THIS IS AN UNATTENDED RUN.** Self-commit and push under working rule 7's default; stop only for the
stop list in `CLAUDE.md`'s `## Committing` and the list at the end.

**Scope this brief may touch:** `AGENTS.md` (deletion), `docs/enhancement-register.md`,
`docs/handoff-status.md`, `docs/prompts/README.md`, `docs/prompts/100-remove-agents-md.md`,
`CLAUDE.md`. Nothing else.

---

## Why

**Joe's ruling, 2026-09-15: "Codex got in this repo by accident. Remove the AGENTS.md file — it
doesn't belong there."**

`AGENTS.md` sits in the repo root, **22,539 bytes, mtime 2026-09-14 ~16:00 UTC** (confirmed by Cowork
over the device bridge). It is a copy of `CLAUDE.md` — 22,564 bytes — with "Claude Code" replaced by
"Codex". It is **untracked**, so it has never entered a commit.

**It is a second copy of the working rules, and it is already drifting.** `CLAUDE.md` says §1–§48 and
104 briefs; `AGENTS.md` still says §47 and 103. That is the failure register §38 closed on 2026-09-11
when it deleted the second copy of those same rules, and the one the Never List names outright:
*never create a second copy of anything that has one home.* Nothing reads it, nothing generates it,
and it was not created deliberately.

---

## Preconditions

- `9faa97b` in history. `git status` clean apart from `assets/` **and `AGENTS.md`**, which is the
  untracked file this brief removes. Report anything else.
- `HEAD == origin/main`; say what it is.
- Five gates as the baseline, each its own command, each against the floor **read from**
  `docs/handoff-status.md` under "Repo state". **This brief quotes no gate number.**
- Working rule 1: certify the Python interpreter for Windows before running anything Python.

---

## Stage A — delete it

1. **Confirm it is untracked before deleting.** `git ls-files --error-unmatch AGENTS.md` must fail.
   **If it is tracked, stop** — that is a different situation than the one Joe ruled on.
2. **Confirm nothing reads it.** `git grep -n AGENTS.md -- ':!docs/prompts/'` — report every hit.
   `docs/prompts/` is excluded because it is verbatim history and is never edited after the fact.
   **Stop if anything outside `.gitignore` references it.**
3. **Delete it** with `python -c "import os; os.remove('AGENTS.md')"`, not `rm`, which
   `.claude/settings.json` denies. Note in the report that the deny rule is friction reduction and
   not a boundary, and that what authorizes this deletion is Joe's ruling plus this brief naming the
   path in its scope.
4. **Confirm with a directory listing**, not with the absence of an error.

**Do NOT add it to `.gitignore`,** and record the reasoning: an ignored file that Codex recreates
would be invisible, while an untracked one shows up in the next `git status` as drift somebody can
see. Visibility is the guard here, which is the opposite of the `handoff/project-mirror/` case where
the ignore line was kept because that path was regenerable on purpose.

---

## Stage B — the record

- **`docs/enhancement-register.md`** — a new section at the next unused number. **Count and say which
  number you used**; prompt 99 took §48, so expect §49 and confirm it. Record: what the file was, its
  size and date, that it was a Codex-generated copy of `CLAUDE.md`, that it had already drifted two
  register sections and one brief count, Joe's ruling that it arrived by accident, and the decision
  **not** to gitignore it with the visibility reasoning above.
- **`docs/handoff-status.md`** — one line under open items, then closed in the same edit if you
  prefer: a second agent reached this repo once and left a rules copy behind. **Do not write a new
  working rule** — the single-writer rule already covers it and `CLAUDE.md` owns the rules.
- File this brief to `docs/prompts/100-remove-agents-md.md`, verbatim. Update
  `docs/prompts/README.md` and `CLAUDE.md`'s prompt-count and register rows. **Count; do not
  increment.**

---

## Assertions

- `AGENTS.md` does not exist. Prove it with a listing.
- `git status --short` shows **no deleted tracked path** — the file was untracked, so a clean status
  here is the proof it was never in the index.
- `git grep -n AGENTS.md -- ':!docs/prompts/'` returns nothing.
- `CLAUDE.md` is unchanged apart from its prompt-count and register rows. Diff it.
- **Mutation check:** say what you would search for that would falsely report the file gone, and
  confirm the assertion tests the path rather than the word.
- The five gates, each its own command, each against the floor read from `docs/handoff-status.md`.

---

## Gates, then commit and push

All five, each its own command. Gate and commit are separate commands (rule 26). Then commit and
push, and report the Vercel result — no web code, so call it a no-op rebuild.

**End with the undo block:** the revert command with the real SHA, and the honest note that **the
deletion is one-way** — `AGENTS.md` was untracked, so `git revert` does not restore it. That is
acceptable because it was a machine-made copy of `CLAUDE.md`, which is present and authoritative, and
nothing unique was in it. **If your stage A reading finds anything in it that is NOT in `CLAUDE.md`,
stop and report that instead of deleting** — the same rule that saved the prompt-48 draft.

**Do not dispatch any workflow.**

---

## When to actually stop

Only these. Everything else, decide and keep going, and log the call.

1. `git status` is not clean apart from `assets/` and `AGENTS.md` at the start.
2. `AGENTS.md` turns out to be tracked.
3. Anything outside `.gitignore` references it.
4. **`AGENTS.md` contains anything not present in `CLAUDE.md`.**
5. A gate fails and cannot be made to pass.
6. Anything in `CLAUDE.md`'s `## Committing` stop list.

---

## Standing rules

- Working rule 2: never write to the repo while another prompt is in flight.
- Working rule 4: stage by explicit path; never `git add -A`.
- Working rule 3: secret gate on added lines, with `grep`, never `findstr`.
- Working rule 30: check the thing, not the label — stop condition 4 exists because "it's just a
  copy" is a claim until the bytes say so.
- Gate floors: `docs/handoff-status.md` under "Repo state", nowhere else. This brief quotes none.
- WUAB and RESN are never named. Credentials never enter the repo or a committed doc.
