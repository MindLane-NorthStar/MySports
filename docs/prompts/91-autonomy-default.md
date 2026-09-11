# Claude Code — RUN 1 of 2: commit prompt 89, then make self-commit the default

**Run in Claude Code**, in `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports`, on `main`.
**Docs and one config file. No application code, no pipeline code, no data files, no migrations, and
no database access of any kind.**

**THIS IS AN UNATTENDED RUN. JOE IS NOT AT THE KEYBOARD.** Both blocks below are authorized to
commit and push. Work the way working rule 7 describes an unattended run: **self-committing stages,
two-strikes-skip, and hard stops ONLY for the list under "When to actually stop" at the end of this
brief.** Everywhere else, make the reasonable call, keep going, and log every judgment call in the
report. Do not stop to ask a question Joe cannot answer for hours.

**Note on numbering:** this brief carries out prompt 91's work, and prompt 90 runs *after* it in
RUN 2. The numbers in `docs/prompts/` are identifiers, not a run order. Filing 91 before 90 is
expected and is not drift.

---

## BLOCK 0 — commit the work prompt 89 already did

**Prompt 89 has already run. Its changes are sitting uncommitted in the working tree.** Nothing in
this block re-does that work; it inspects it, fixes one wrap, and commits it.

`main` and `origin/main` were both `09dcf728700020558069c47ea71cef3d76018d8b` when Cowork checked at
12:58 PM ET on 2026-09-11.

### 0.1 — confirm the tree is what prompt 89 left

Expected, from prompt 89's own report and from Cowork's verification against the tree:

- **7 files modified:** `CLAUDE.md`, `docs/archive/README.md`, `docs/enhancement-register.md`,
  `docs/handoff-archive.md`, `docs/handoff-status.md`, `docs/prompts/README.md`, `docs/queue.md`
- **2 files new:** `docs/rules-casebook.md`, `docs/prompts/89-rules-ownership-casebook.md`
- Diff stat roughly **+87 / −323**
- `assets/` untracked, as always, including `assets/network-logos/NFL Network.jpg` — git quotes paths
  with spaces, which is why that one can look like a new entry

**If the tree matches, continue. If it does not** — extra modified files, missing files, or a wildly
different diff stat — **stop and report**, because something touched the repo since prompt 89 ran and
committing blind would bury it.

### 0.2 — the one fix to fold in

**`docs/handoff-status.md:187` is 122 characters long.** The prompt 89 parenthetical was inserted
mid-sentence and the line was never re-wrapped; every other line in these documents sits near 100.
The prose is correct — **this is a wrap fix only, do not change a word.** Re-wrap it to match the
file's convention.

While you are there, one optional tidy, and skip it if it is not obviously safe: `docs/handoff-status.md`
around `:255` still describes the prompt 87 split as leaving "70KB" in this file. It is now 65,561
bytes. That sentence is a historical record of the split rather than a description of the file today,
so **leave it alone unless it reads as a present-tense claim**, in which case correct the figure. Say
which you did.

### 0.3 — gates, secret gate, commit, push

Run all five gates, each as its own command, each reported with its count against the floor in
`docs/handoff-status.md` under "Repo state" and nowhere else. This brief quotes no gate number.

```
pytest                       # from the repo root
npm run test:unit            # from web/
npm run smoke                # from web/
node scripts/qa-shots.mjs    # from web/
npm run geometry             # from web/ — all hard stops
```

They passed at the end of prompt 89's run; re-running them is cheap insurance that nothing drifted in
the hours since. The gate and the commit are separate commands — do not chain them or read a gate's
result from a chained exit code.

Then **secret gate the added lines with `grep`, never `findstr`**, stage by explicit path, **commit
and push**. Commit message lower-case, saying what shipped. Report the Vercel result.

---

## BLOCK 1 — self-commit becomes the default, and the stop list becomes unwaivable

### Joe's ruling, 2026-09-11

**Self-committing stages and a push on green gates become the default for every brief, not the
exception. In exchange, a short list of stops becomes unwaivable — no brief may authorize past them.**

The reasoning, recorded so it is not re-argued:

- **Gating the commit was close to pure cost.** An uncommitted working tree is not safer than a
  commit; it is *less* reviewable. A commit gives a stable SHA, a clean diff, and `git revert` as a
  one-command undo. A dirty tree gives a diff against a moving baseline and no undo but
  `checkout --`.
- **The push is cheap here specifically.** A bad deploy on a single-user personal app costs Joe a
  broken page for the minutes until a revert deploys. And if Vercel is the only compile check that
  exists, gating the deploy means the compile check happens late and rarely.
- **The one thing a push makes truly irreversible is a leaked secret.** Hence the secret gate becomes
  a stop no brief can authorize past, ever.
- **The undo must be rehearsed, not theoretical.** Hence the report requirement in 1.3.

**Two-strikes-skip is NOT extended to attended runs.** It stays an unattended-run behavior.

**Line numbers below were measured post-prompt-89 but pre-commit.** Block 0's wrap fix may shift
`docs/handoff-status.md` by a line. Re-derive rather than cutting by number alone.

### 1.1 — amend working rule 7

`CLAUDE.md:67-68` currently reads, in full:

```
7. Unattended runs: self-committing stages, two-strikes-skip, hard stops only for a secret-gate hit,
   a destructive database operation, or a rejected push.
```

Rewrite it so that it says, in substance:

- **Every brief self-commits its stages and pushes when all five gates pass, unless the brief says
  otherwise.** A brief that wants a stop says so; silence now means proceed.
- **A red gate is never committed over.**
- **Two-strikes-skip remains an unattended-run behavior only.** Attended runs stop and report on a
  stage that fails twice.
- **The stop list is unwaivable** — point at it rather than restating it, since it lives in
  `## Committing` after 1.2.

Keep it to the compressed register of the other rules — three or four lines, not a section.
**Numbering is frozen: this is still rule 7, and nothing renumbers.**

### 1.2 — rewrite the `## Committing` section

The heading is at `CLAUDE.md:282`. Its body at `:284-286` currently reads:

```
**Never commit or push without Joe's explicit approval**, and never during an unattended run except
where that run's own brief authorizes its stages to self-commit. Preserve intentionally
known-broken states rather than tidying them. `assets/` is always untracked and is not drift.
```

Replace the first sentence with the new default. **Keep the rest of that paragraph verbatim** —
"Preserve intentionally known-broken states rather than tidying them" and the `assets/` clause are
unrelated and still true. Keep the commit-message line at `:288` as it is.

Then add **THE STOP LIST — the seven things no brief may authorize past**, as a list, in this order,
each with its one-line reason:

1. **A secret-gate hit on added lines.** A pushed secret is the only truly irreversible outcome in
   this repo; the fix is rotating the credential in three places.
2. **Any database write, and any DDL.** Working rule 14 already forbids a session using the
   `mysports_writer` credential — this restates it as unwaivable so no brief can read the two rules
   as being in tension.
3. **`git push --force`, any history rewrite, any branch deletion.** A revert is recoverable; a
   pushed rewritten history is not, reliably.
4. **A gate that fails and cannot be made to pass.** Never commit or push over a red gate. Stop and
   report which gate and what it said.
5. **Deleting or overwriting a tracked file outside the scope the brief names.** A brief now names
   the paths it may touch; anything outside that is a stop, not a judgment call.
6. **Any write to `.env`, `.env.example`, or `.gitignore`'s credential lines.**
7. **An R2 object deletion.** The upload is atomic per file, so an overwrite leaves the previous
   bytes gone.

Say plainly that **this list overrides any brief**, including one that appears to authorize the
action, and that a brief containing such an authorization is itself the error to report.

### 1.3 — the report requirement, which is what makes the undo real

Add to `## Committing`: **every self-committing run ends its report with an undo block.** Three
things, no prose:

- **The exact revert command with the real SHA filled in** — not a template. Two commits means both,
  in the order they must be reverted.
- **Which stages were one-way**, if any, and what undoing them would actually require. A committed
  file deletion is not one-way; a dispatched workflow that wrote rows is.
- **Whether the push deployed**, and the Vercel result.

A run with nothing irreversible says so explicitly rather than omitting the block.

**Also record what Cowork now owes**, since this is a two-sided change: every brief Cowork writes must
name the paths it may touch, so stop-list item 5 has a definition. A brief that does not name its
scope is incomplete, and Claude Code should say so rather than inferring one.

### 1.4 — `.claude/settings.json`

**`.claude/` does not exist in this repo** — verified by directory listing on 2026-09-11. You are
creating it.

The goal is to stop Claude Code asking permission for this project's safe, constant commands while
making the dangerous ones refuse rather than prompt. **Project-level and committed:
`.claude/settings.json`.** Do not use `.claude/settings.local.json`; that file is personal, is not
gitignored automatically, and this configuration should travel with the repo.

**Cowork researched the schema and is handing you the intent plus what it believes the syntax to be.
Verify against your installed version before trusting it** — run `claude --version`, and check the
result with `/permissions` after writing the file. Report the version and what `/permissions` showed.
Three facts Cowork confirmed that shape the file:

- **`deny` is checked first and always beats `allow`.** You cannot write an allow-exception inside a
  deny rule.
- **`ask` also beats `allow`**, so an over-broad `ask` rule silently defeats a precise `allow` one.
  Prefer no `ask` rules here at all.
- **The wildcard goes AFTER the subcommand.** `Bash(git log *)` is right; `Bash(git * main)` matches
  every git subcommand and is the classic over-match. The `:*` form equals a trailing ` *` but is
  newer — if your version does not support it, use the space form.

**Allow** — read-only or locally reversible, and constant in this project: `git status`, `git diff`
and its variants, `git log`, `git show`, `git rev-parse`, `git add` by explicit path, `git commit`,
`git stash`, `pytest`, `npm run test:unit`, `npm run smoke`, `npm run geometry`,
`node scripts/qa-shots.mjs`, and plain reads — `ls`, `cat`, `grep`. Do not allow `findstr`; it is
never used here.

**Deny:** `git push --force` and `--force-with-lease` in every spelling, `git reset --hard`,
`git clean`, `git rebase`, `git filter-branch`, `git branch -D`, `rm -rf`, `psql`, anything invoking
`pipeline.standings` / `pipeline.load` / `pipeline.enrich_cfb` **without** `--emit-sql` (those write
to the database), and **reads of `.env`** — a `Read` deny rule also blocks Edit and Write on that path
in current versions.

**State the limit honestly in the report, because it matters:** these rules are friction reduction and
a speed bump, **not a security boundary.** A `Bash(rm -rf *)` deny does not stop `/bin/rm -rf`, and a
`Read(.env)` deny does not stop a Python script opening it or a `grep -r` that happens to match it.
The real control is 1.2's stop list, which governs intent.

**Leave `defaultMode` alone** unless you can state what the current default is and why changing it is
better. An unexplained mode change is exactly the kind of quiet behavior shift this project punishes.

**RUN 2 FOLLOWS THIS BRIEF AND TOUCHES `pipeline/enrich_cfb.py` AND `.github/workflows/`.** Sanity-check
that nothing you deny here would block it — it needs to read and edit those files, run `pytest`, and
commit. If a deny rule would catch a command RUN 2 needs, say so in the report rather than loosening
it silently.

### 1.5 — the record

- **`docs/enhancement-register.md`** — a new section at **the next unused number**. **Count the
  existing sections and say which number you used**; do not assume. Record the ruling, the four
  reasons, the stop list, and the cost Joe accepted: this trades a pre-commit gate for a post-commit
  review, and the review has to actually happen before the next brief is written.
- **`docs/handoff-status.md`** — under the open items, one entry: the permission file is friction
  reduction and not a boundary, and the OS-level option (sandboxing) exists and has not been
  evaluated. **Do not evaluate it here.**
- **`CLAUDE.md`'s "Read first" table** — update only if this change makes a row wrong. Report whether
  it did.
- File this brief to **`docs/prompts/91-autonomy-default.md`**, verbatim, `NN-slug.md`. Update
  `docs/prompts/README.md` and `CLAUDE.md`'s prompt-count row per their own conventions. **Count the
  directory; do not increment the number.**

### 1.6 — assertions

- `CLAUDE.md` rule numbers still enumerate `1 … 36` — print them.
- The phrase "Never commit or push without Joe's explicit approval" appears nowhere in `CLAUDE.md`.
- The stop list has exactly seven items, and the word "unwaivable" (or your chosen equivalent, named
  in the report) appears in that section.
- `.claude/settings.json` is valid JSON — **parse it and print the result, do not eyeball it.**
- **The live check, and it is the one that decides whether 1.4 worked:** after writing the file, run
  one allowed command and one denied command and report what happened to each. **A denied command must
  refuse. If it prompts instead of refusing, the rule did not match and the file is wrong.**
- **Mutation check:** state what you would change in `settings.json` to make the deny check fail, and
  confirm the check is testing the rule rather than the filename.

### 1.7 — gates, then commit and push

All five, each as its own command, each against the floor in `docs/handoff-status.md` under "Repo
state". Gate and commit are separate commands. Then **commit and push**, and report the Vercel result.

---

## What to report, and where to stop

**End the whole run with the undo block 1.3 defines** — this run is its own first test of that
requirement. Two commits, so name both SHAs and the order to revert them. If the block is awkward to
write for this run, say so; that is information about the requirement.

**Also say, in one line each:** which judgment calls you made and why, and anything you skipped under
two-strikes.

**When to actually stop.** Only these. Everything else, decide and keep going.

1. The tree in 0.1 does not match what prompt 89 left.
2. A secret-gate hit.
3. A gate fails and cannot be made to pass.
4. Any database write or DDL would be required — it will not be; this brief touches no data.
5. A force-push, history rewrite, or branch deletion would be required.
6. A file outside the scope below would have to be deleted or overwritten.
7. `.env`, `.env.example`, or `.gitignore`'s credential lines would have to change.

---

## Standing rules

- Working rule 1: certify the Python interpreter for Windows before running anything Python.
- Working rule 2: never write to the repo while another prompt is in flight.
- Working rule 3: secret gate on added lines, with `grep`, never `findstr`.
- Working rule 4: stage by explicit path; never `git add -A`.
- Working rule 14: no database write, and the `mysports_writer` credential is never read, printed, or
  used.
- Working rule 26: the gate and the commit are separate commands.
- Gate floors: `docs/handoff-status.md` under "Repo state", nowhere else. This brief quotes none.
- `assets/` is untracked on purpose and is not drift.
- WUAB and RESN are never named. Credentials never enter the repo or a committed doc.

**Scope this run may touch:** `CLAUDE.md`, `docs/handoff-status.md`, `docs/enhancement-register.md`,
`docs/handoff-archive.md`, `docs/archive/README.md`, `docs/queue.md`, `docs/rules-casebook.md`,
`docs/prompts/README.md`, `docs/prompts/89-rules-ownership-casebook.md`,
`docs/prompts/91-autonomy-default.md`, `.claude/settings.json`. Nothing else.
