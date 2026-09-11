# Claude Code — RUN 4 rev C: rescue, delete the mirror, rewrite queue item 9

**Run in Claude Code**, in `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports`, on `main`.
**One file rescued, one untracked directory deleted, six documents edited. No application code, no
pipeline code, no workflow change, no database access of any kind.**

**THIS IS AN UNATTENDED RUN.** Self-commit and push under working rule 7's default; stop only for the
stop list in `CLAUDE.md`'s `## Committing` and the list at the end of this brief.

**Scope this brief may touch:** `handoff/project-mirror/` (deletion), `.gitignore`, `docs/queue.md`,
`docs/handoff-status.md`, `docs/enhancement-register.md`, `docs/rules-casebook.md`,
`docs/prompts/README.md`, `docs/prompts/93-r2-sync-diagnosis.md`,
`docs/prompts/48-programs-live-part-2.md`, and `CLAUDE.md`. Nothing else.

---

## Why there is a rev C, and the three rulings in it

Rev B's stop condition 5 **could never pass as written**, and you were right to hold. It asked for
`grep -rn "project-mirror"` to return `.gitignore:28` alone, while stage A required a header naming
that path, and while the brief itself sits in untracked scratch naming it. Three rulings, so the
reissue is decidable:

**1. The six historical briefs are acceptable and are not to be touched.** `docs/prompts/` is
verbatim history under the README's never-edit-after-the-fact rule, and a closed brief pointing at a
path that was later deleted is what history looks like. **Use `git grep`, not `grep -rn`** — it
searches tracked files only, which excludes `Claude outputs\` for free — and exclude the archive:

```
git grep -n project-mirror -- ':!docs/prompts/'
```

Expect `.gitignore:28` and nothing else. The post-run assertion carries the same restriction.

**2. The header comes out. File the bytes verbatim and put the provenance in the README row.** You
named the conflict correctly and the alternative you offered is the better one. A header inside the
brief would make it the only filed brief carrying one, and it would put provenance in a second place
when the README table is already where every other brief's provenance lives — which is the exact
failure mode this project keeps paying for. One home. **So: no header, no added line, nothing above
or below the original bytes. The filed file's own sha256 must equal the mirror file's.**

**3. Your filename is right and mine was wrong.** `48-programs-live-part-2.md`, per the README's own
precedent at 43 — two briefs, one number, no letter suffix. Cowork proposed `48b` without checking
that precedent; you did check it. Keep yours.

**One factual correction to rev B:** the mirror file's mtime is **2026-09-05 22:07 UTC (18:07 ET)**,
not 2026-09-06.

**Rev A is not filed as a brief.** It produced no commit and rev B contains its corrected content in
full, so a `93-…-superseded.md` would be a second copy of a superseded thing. Its failure goes to
`docs/rules-casebook.md` instead, which is what that file is for — see stage D.

---

## Preconditions

- `git status` clean apart from `assets/`. Report anything else.
- `HEAD == origin/main`; it was `cd08250`. Say what it is.
- Five gates as the baseline, each its own command, each against the floor in
  `docs/handoff-status.md` under "Repo state" and nowhere else. **This brief quotes no gate number.**
- Working rule 1: certify the Python interpreter for Windows before running anything Python.
- You already measured `git ls-files assets/` == 5 == the `local cache: 5 files` in runs #15/#16/#17.
  **Quote it; do not re-derive it.**

---

## Stage A — rescue the prompt-48 file, verbatim, before anything is deleted

1. **Re-verify uniqueness immediately before acting.** You confirmed it against 1,636 blobs and
   16,415 files; re-run the check that costs least and say which one you ran, because the deletion is
   the irreversible step and a check from an earlier session is a timestamp.
2. **Copy `handoff/project-mirror/claude_phase4-claude-code-prompt-48-programs-live.md` to
   `docs/prompts/48-programs-live-part-2.md`, byte for byte.** No header. No provenance line. No
   trailing newline added or removed. Whatever the scratchpad copy is, reproduce from the mirror
   original so there is one source.
3. **Assert `sha256(docs/prompts/48-programs-live-part-2.md) == sha256(the mirror file)` on the whole
   file**, not on a portion of it. You recorded the body as `84358ed7…366b`; with no header that is
   now the whole-file hash and the two should agree. **If they do not, stop.**
4. Stage it by explicit path.

---

## Stage B — delete the mirror

1. `git grep -n project-mirror -- ':!docs/prompts/'`. **Report every hit.** Stop if anything other
   than `.gitignore:28` appears. Do not edit the six historical briefs under any circumstances.
2. Delete `handoff/project-mirror/`, then `handoff/` if it is empty. Fourteen files are confirmed
   copies of historical blobs; the fifteenth is now filed and staged.

   **Use `python -c "import shutil; shutil.rmtree('handoff/project-mirror')"`, not `rm -rf`**, which
   `.claude/settings.json` denies. Say in your report that **the deny rule is friction reduction and
   not a boundary** — prompt 91 says so in its own text — and that what authorizes the deletion is
   this brief naming the path in its scope.
3. Confirm with a directory listing, not with the absence of an error.
4. **Keep `.gitignore:28` and rewrite its comment** to record: deleted 2026-09-11; three to six days
   stale; held the copy of the working rules that register §38 removed; one of its fifteen files
   existed nowhere else and is now `docs/prompts/48-programs-live-part-2.md`; the ignore line stays
   as a guard. Point at `CLAUDE.md` rather than restating the Never List rule.

---

## Stage C — rewrite queue item 9 from what was measured

**1. `docs/queue.md`, item 9.** Keep the heading and the "Numbered 9, not 8" note. Replace the
evidence, natural-cut and size paragraphs:

- **The cost is the R2 pull, twice.** `refresh` pulls 1,620 of 1,625 objects; `render` pulls the same
  1,620 again. Quote the log line and name the runs. The five that are not pulled are the tracked
  fonts; give `git ls-files assets/` as the check.
- **Why nothing prevents it:** `actions/cache` appears nowhere in `schedule_refresh.yml`;
  `cache: pip` at `:35` is the only cache. `sync_assets.py:60-72` returns only what is on disk and
  `:312-314` pulls every remote key that is not.
- **The push's second cost:** `:308` falls through to `remote_sha()` at `:92-96` — a `head_object`
  per file — whenever the size matches, which it always does for a file pulled minutes earlier.
  1,533 compared, 0 pushed, measured.
- **The defect on the same line.** `:312-314` decides what to pull by key alone, so a local file is
  never re-downloaded however far its bytes have drifted, and the next `--push` republishes the stale
  bytes over the newer object. Art reverts, silently. **Say that caching `assets/` cannot ship before
  this is fixed**, and that **prompt 94 is written to fix it.**
- **The tail-step cut is demoted, not deleted.** 0.5–2 minutes, and what it buys is failure isolation
  — `render` declares `needs: refresh` at `:289`. Say it was never where the time was.
- Keep the closing line: **a description of a problem, not an approved plan.**

**2. `docs/handoff-status.md`, open items — one new entry** for the pull defect as a live bug, naming
`scripts/sync_assets.py:312-314` and the symptom: art that reverts after a nightly, no error.

**3. `docs/enhancement-register.md` — a new section at the next unused number. Count and say which
number you used.** Record the measurement including `render`'s duplicate pull, the finding that the
cost and the defect are the same line, **the correction to rev A's fact 1** — `assets/` inferred
untracked from `.gitignore` rather than measured with `git ls-files`, five tracked fonts — and the
ruling that the fix is deferred to prompt 94 because the comparison strategy was Joe's to choose. Note
that a multipart ETag carries a `-N` suffix and is not an MD5.

---

## Stage D — the casebook, the filings, and `CLAUDE.md`

**1. `docs/rules-casebook.md` — one new entry, in that file's existing format.** This is what the
casebook is for: append-only incident history, never a rule, never the authority on one. The
incident, in substance:

> On 2026-09-11 a Cowork brief asserted `assets/` was untracked, inferred from its absence in
> `.gitignore` and from the standing "clean apart from `assets/`" precondition. `git ls-files assets/`
> returns five tracked fonts. The brief's own stop condition caught it before any change. The same
> brief asserted every file in `handoff/project-mirror/` was a copy of a tracked document; one of
> fifteen was not, and deleting the directory as briefed would have destroyed the only copy of it.
> A third revision was needed because the rev B stop condition was unsatisfiable — it required a
> `grep` to find nothing while the brief itself mandated writing a line the grep would match.

Record what each stop caught and that no change reached the tree. **Do not write a new rule** and do
not restate rules 30 or 34; point at them.

**2. File this brief** to `docs/prompts/93-r2-sync-diagnosis.md`, verbatim.

**3. `docs/prompts/README.md`** — rows for both new files. For `48-programs-live-part-2.md`, the row
carries its provenance in whatever form the README's own format allows: recovered 2026-09-11 from the
gitignored `handoff/project-mirror/`, 9,684 bytes, mtime 2026-09-05 22:07 UTC, never previously
filed, **and that whether it is an earlier draft of 48 or a genuine second block is not
determined** — its title says "part 2" and its length says otherwise. **Do not resolve that by
inference.** For 93, note that revs A and B stopped at their own stop conditions and are not filed.

**4. `CLAUDE.md`** — update the prompt-count row and the register range row. **State the numbers you
counted**, and never quote a gate figure from that file.

---

## Assertions

- `handoff/` does not exist. Prove it with a listing.
- `sha256(docs/prompts/48-programs-live-part-2.md)` equals the hash recorded in stage A before the
  deletion, whole file.
- `git grep -n project-mirror -- ':!docs/prompts/'` returns `.gitignore:28` and nothing else.
- The six historical briefs under `docs/prompts/` are unmodified. `git status --short` proves it.
- `git status --short` shows the two added files and **no deleted tracked path**.
- `docs/queue.md` item 9 contains no sentence claiming the tail steps are where the time is, and does
  contain `render`'s duplicate pull.
- `CLAUDE.md`'s register row matches the section count you printed.
- **Mutation check on the hash assertion:** say what you would change to make it fail, and confirm it
  tests the bytes rather than the filename.

---

## Gates, then commit and push

All five, each its own command, each against the floor in `docs/handoff-status.md` under "Repo
state". Gate and commit are separate commands (rule 26). Then commit and push, and report the Vercel
result.

**End with the undo block.** The deleted directory is the one-way piece — `git revert` does not
restore an untracked path — and what makes that acceptable is that fourteen files were verified
duplicates of historical blobs **and the fifteenth is in the commit**. State it that way rather than
as the general claim rev A got wrong.

**Do not dispatch any workflow.**

---

## When to actually stop

Only these. Everything else, decide and keep going, and log the call.

1. `git status` is not clean apart from `assets/` at the start.
2. The rescued file's whole-file hash does not match the mirror original's.
3. A second mirror file turns out to have no counterpart in git history.
4. `git grep -n project-mirror -- ':!docs/prompts/'` finds a hit outside `.gitignore`.
5. A gate fails and cannot be made to pass.
6. Anything in `CLAUDE.md`'s `## Committing` stop list.

---

## Standing rules

- Working rule 2: never write to the repo while another prompt is in flight.
- Working rule 4: stage by explicit path; never `git add -A`.
- Working rule 3: secret gate on added lines, with `grep`, never `findstr`.
- Working rule 14: no database write; the `mysports_writer` credential is never read, printed or used.
- Working rule 30: check the thing, not the label. Two of this brief's three revisions exist because
  Cowork broke it.
- Gate floors: `docs/handoff-status.md` under "Repo state", nowhere else. This brief quotes none.
- `assets/` is a cache with five tracked fonts in it; R2 is the source of truth, and `assets/` being
  dirty is not drift.
- WUAB and RESN are never named. Credentials never enter the repo or a committed doc.

**After this lands, run prompt 94** (`claude/prompt-94-r2-byte-compare-2026-09-11.md`), which fixes
the defect stage C records.
