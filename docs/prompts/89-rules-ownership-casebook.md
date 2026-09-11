# Claude Code — prompt 89: CLAUDE.md takes ownership of the working rules

**Run in Claude Code**, in `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports`, on `main`.
**Docs only. No application code, no data files, no migrations, no database access of any kind.**

This closes `docs/queue.md` item 8. **Joe ruled on 2026-09-11, twice:**

1. **`CLAUDE.md` owns the working rules outright.** `docs/handoff-status.md` drops its copy and points
   at `CLAUDE.md`. The precedence line gets one carve-out: `handoff-status.md` keeps the win on
   **state**, `CLAUDE.md` wins on **rules**.
2. **The incident detail behind the long-form rules is preserved, in a new `docs/rules-casebook.md`** —
   append-only history, explicitly non-binding. It is not discarded, and it does not move into
   `CLAUDE.md`.

Both rulings are Joe's; do not re-litigate either. If the tree contradicts a measurement below, say so
and stop — that is expected and wanted, and it is the reason stage A exists.

---

## Preconditions, once

- `HEAD == origin/main == 09dcf728700020558069c47ea71cef3d76018d8b` (or a descendant — if it is a
  descendant, say which commits landed since and re-check every line number below before cutting).
- Tree clean apart from `assets/`, which is untracked on purpose. **Report anything else that is dirty
  or untracked rather than assuming it is expected** — Cowork could not check the tree's status this
  session (see below). If something else is dirty, **stop**: another prompt may be in flight and
  working rule 2 forbids working beside it.
- Run the five gates as the baseline and report them as five separate commands. **Read the floors from
  `docs/handoff-status.md` under "Repo state" and nowhere else** — not from `CLAUDE.md`, not from this
  brief, which deliberately quotes no gate number.

---

## What Cowork measured, and what it could not

Measured on 2026-09-11 against staged copies of the working tree at the mtimes given. Every figure
below is a byte count or a line number from the file itself, not from a note describing it.

**`CLAUDE.md`** — 285 lines, 19,784 bytes, mtime `2026-09-11 03:30:30Z` (11:30 PM ET, 2026-09-10).

- `## Working rules (binding)` at **`CLAUDE.md:53`**; the section runs to the `---` at **`:192`**, with
  `## Gates` at `:194`.
- **Rules 1 through 36, none missing.** Enumerated, not assumed: the section's rule numbers are
  `1 2 3 … 34 35 36`.
- The rules section is **11,355 bytes**.

**`docs/handoff-status.md`** — 1,088 lines, 83,282 bytes, mtime `2026-09-11 03:31:56Z` (11:31 PM ET, 2026-09-10).

- `## Working rules (binding)` at **`:837`**. Rule 29 begins at **`:906`**. Rule 34's last line of
  text is **`:1084`** (`Y" is the shape to distrust.`). `:1087` is a trailing `---`; the last
  non-blank line in the file is `:1087`.
- **Rules 1 through 34. Rules 35 and 36 are absent** — the drift queue item 8 records, confirmed.
- The rules section is **19,214 bytes**.

**The two copies are not duplicates, and this is the finding that shaped the ruling.** Per-rule byte
comparison of the two sections:

- **Rules 1–18: equivalent.** Deltas are within ±10 bytes, except that `CLAUDE.md` is *longer* on
  rule 12 (1,185 vs 513) and rule 14 (1,372 vs 1,024). **Nothing is lost by deleting these from
  `handoff-status.md`.**
- **Rules 19–28: `handoff-status.md` carries modestly more** — deltas `+52, +125, +160, +33, +46,
  +117, +411, +278` on rules 19, 21, 22, 23, 24, 26, 27, 28 (rules 20 and 25 are equivalent).
- **Rules 29–34: `handoff-status.md` carries substantially more** — `+1504, +1547, +1613, +1563,
  +2138, +1496`. Each of these six is 1.5–2.1 KB there against 0.3–0.8 KB in `CLAUDE.md`. This is the
  worked incident detail: the CRLF/LF byte divergence and the 29 open renormalisations, prompt 52's
  two stale-absence instances, and so on.
- **Total text present only in `handoff-status.md`: 11,089 bytes across rules 19–34.** That is the
  material the casebook exists to preserve. Check this arithmetic before relying on it.
- **`docs/rules-casebook.md` does not currently exist.** Verified 2026-09-11 by listing `docs/` with
  sizes — 17 entries, no casebook. You are creating it, not editing it.

**What Cowork could NOT check, and why.** Cowork's device shell could not mount the connected folder
for this entire session — `sandbox-helper: no Plan9 drive shares mounted under
/mnt/.virtiofs-root/shared`, now attributed by the tool itself to **a Windows update released
2026-09-08**. So **no `grep` of the tree was possible.** Every figure above comes from five files
staged individually and read in the cloud container:

```
CLAUDE.md   docs/handoff-status.md   docs/queue.md
.git/refs/heads/main   .git/refs/remotes/origin/main
```

**Nothing else in the repo was searched.** Cowork does not know how many other files reference
`handoff-status.md` for the rules. Two are known only because they were read for other reasons:

- **`docs/queue.md`** item 8 — cites `handoff-status.md:836` and `:1052`.
- **`docs/hub/claude-code-hub-audit-2026-09-05.md`** — "Standing rules apply (`docs/handoff-status.md`
  rules 1–28)". The file exists (15,121 bytes, verified by directory listing 2026-09-11); **whether it
  is tracked is unverified** — the 2026-09-05 handoff recorded `docs/hub/` as untracked and due to ride
  a later commit, and that note is a timestamp, not a fact (working rule 30). A historical brief;
  probably leave it, but it must appear in stage A's list so the decision is made rather than
  defaulted.

**Stage A exists because that enumeration is Claude Code's to do, not Cowork's to guess.** Treat the
two above as seeds, not as the answer.

---

## Stage A — enumerate every reference. Read-only.

Search the whole working tree — **tracked and untracked**, excluding `node_modules/`, `.next/`,
`assets/` and `web/qa/` — and report every hit with file, line and the quoted text:

1. Anything pointing at `handoff-status.md` **for the working rules** — the phrase `working rules`, the
   phrase `rules 1-`/`rules 1–`, `rules in full`, `full working rules`, `the 29 working rules`, `:836`,
   `:837`, `:1052`.
2. Every occurrence of `Working rules (binding)` anywhere in the tree.
3. Any **machine-readable** dependency on the section: a test, a script, a workflow, or a JSON/YAML
   file that reads, counts, parses or asserts against `handoff-status.md`'s rules section or its line
   numbers. Search `tests/`, `scripts/`, `web/scripts/`, `web/test/`, `.github/workflows/`.

**Say what you searched, not only what you found** — the commands and the paths covered. A search that
finds nothing is evidence about the query (working rule 31).

**HARD STOP if 3 finds anything.** If any test, script or workflow depends on that section's presence,
structure or line numbers, stop and report. That would mean the deletion breaks a gate, and the shape
of this fix changes. Do not work around it.

If 3 is empty, **continue without stopping.** Report 1 and 2 in full and carry their hits into stage E.

---

## Stage B — create `docs/rules-casebook.md`

The casebook holds the incident detail for the rules where `handoff-status.md` carried more than
`CLAUDE.md` — **rules 19, 21, 22, 23, 24, 26, 27, 28, 29, 30, 31, 32, 33, 34** on Cowork's
measurement. Verify that list against the two files yourself before writing; correct it if the
arithmetic is wrong and say so.

**The casebook must not read as binding text.** That is the whole point: a second copy of the rules is
what this prompt is removing, and a casebook that looks like rules would reintroduce the exact failure
mode — a session reading the wrong copy and following it.

So:

- Open with a header stating plainly: **the binding rules are in `CLAUDE.md`'s "Working rules
  (binding)" section and nowhere else. This file is history — the incidents that produced those rules.
  It is append-only. It never states a rule and it is never the authority on one.**
- One entry per rule, as `### Rule N — <the rule's short title>`, in ascending order.
- Inside each entry, **only the material `CLAUDE.md` does not carry**: the incident, the file paths,
  the prompt numbers, the measurements, the way it hid. Carry it **verbatim** from
  `docs/handoff-status.md:837-1084` wherever it is already prose. Do not summarize, do not improve,
  do not add anything of your own.
- **No line in the file may match `^[0-9]+\. \*\*`** — the numbered-bold format both current copies use
  for a rule statement. If a piece of detail only makes sense with its rule sentence, quote the
  sentence inside the prose, not as a numbered item.
- Where an entry carries an **open item** — rule 29's "29 tracked files are an open item", for
  instance — say in that entry that its status lives in `docs/handoff-status.md`, because state does
  not belong here either.

Report the new file's byte count and its line count.

---

## Stage C — remove the copy from `docs/handoff-status.md`

Delete the `## Working rules (binding)` section: **`:837` through `:1087`**, the trailing `---`
included, leaving the file ending cleanly after the content that currently precedes `:837`.

**Confirm the boundaries before cutting.** Print `:835-:838` and `:1082-:1088` first and check they
match this brief. If they do not, the file moved since Cowork measured it — say so and re-derive them.

In its place, at the end of the file, put a short pointer section — a heading and a few lines, no rule
text:

- The binding working rules live in **`CLAUDE.md`**, section `## Working rules (binding)`, and that is
  the authority on them.
- The incidents behind them are in **`docs/rules-casebook.md`**.
- This file is the authority on **state** — repo state, gate floors, open items — and **not** on rules.
- Name the date and this prompt number, and point at register §38.

**Also correct `:184`.** The prompt 88 narrative currently reads "**Amended in both copies** —
`CLAUDE.md` and the working rules below — because this file wins a disagreement." Both halves stop
being true here: there is no copy below, and this file no longer wins on rules. Amend it to record
what happened without asserting a structure that no longer exists — it is a history entry, so keep it
truthful about 2026-09-10 while not claiming a present-tense arrangement.

Report the file's new line count and byte count.

---

## Stage D — `CLAUDE.md` takes ownership

Two edits, both surgical.

**`CLAUDE.md:9`** currently reads: *"When it disagrees with `docs/handoff-status.md`, that file wins
and this one is stale — say so."* Amend it to carry the carve-out: `handoff-status.md` wins on repo
state, gate floors and open items; **`CLAUDE.md` wins on the working rules**, which live here and
nowhere else. Keep the "say so" instruction. Keep it to the same two or three lines — this is the
sentence a session reads in its first ten seconds and length is a cost.

**`CLAUDE.md:18`** is the "Read first" table row:

```
| current repo state, gates, open items, the full working rules | `docs/handoff-status.md` |
```

Remove `, the full working rules` from that row, and add one row for the casebook — the incidents
behind the rules, `docs/rules-casebook.md`, non-binding. Do **not** add a row for the rules
themselves: they are in this file, and a table row pointing at the file you are already reading is
noise.

**Do not touch the rules section itself (`:53-192`).** It is already correct and already complete at
36 rules. This prompt adds no rule and changes no rule's text.

**Check the "Gates" section (`:194` onward) for a sentence that now reads oddly** — it narrates the
gate-count duplication as the precedent for keeping one copy, which this change follows rather than
contradicts. Report what it says; change it only if it makes a claim that is now false.

---

## Stage E — the record

- **`docs/queue.md`**: delete item 8 entirely, per that file's own instruction that a taken entry is
  deleted there and recorded in `handoff-status.md`. Leave items 1–7 renumbered **only if** the file's
  convention requires contiguous numbering — check how prompt 87 and prompt 88 handled it and match.
  Say which you did.
- **`docs/enhancement-register.md`**: add **§38** — the ruling, both halves, dated 2026-09-11, Joe's.
  Record the reasoning in one short paragraph: rules are standing instructions and not state, so they
  do not belong in the file whose job is to track what changed; the drift proved where they are
  actually maintained; and the casebook is append-only history so a stale casebook cannot misdirect a
  session the way a stale rule copy can. Record the cost honestly too: the precedence rule is now
  conditional, and a conditional rule about which file wins is itself a thing to get wrong.
- **Every hit from stage A parts 1 and 2** that makes a now-false claim: fix it, or say in the report
  why it is being left (a historical brief describing what was true when it ran is a legitimate
  leave — an active authority is not). Working rule 32: a ruling is not implemented until every place
  that renders the same thing obeys it.

- **File this brief into the repo**, per the project convention: `docs/prompts/89-rules-ownership-casebook.md`,
  **verbatim**, matching the `NN-slug.md` naming the other 94 files in that directory use (no date in the
  filename — Cowork verified the convention by listing the directory on 2026-09-11). Update
  `docs/prompts/README.md` according to its own stated convention.
- **`CLAUDE.md:21`** asserts `docs/prompts/` holds "92 briefs covering 01–88, verbatim; 39 and 42 are the
  only gaps, and 86 carries three revisions". Filing this one changes that. **Count the directory rather
  than incrementing the number** — Cowork's own listing suggests the figure may already be stale, and a
  count in a file is a label (working rule 33). Report the count you measured and what you corrected it to.

**Two known-false claims to fix while you are in there**, both found by Cowork, neither part of the
ruling:

- **`docs/handoff-status.md:3-4`** says the file "is mirrored to the Claude project at
  `claude/handoff-status.md`. The repo copy is the source; the project copy is written from it."
  **There is no `claude/handoff-status.md` in the Project** — Cowork enumerated all 60 project docs on
  2026-09-11 and it is absent; `claude/README-where-authority-lives.md` records it as deliberately
  deleted on 2026-09-06 for being a stale copy of a live authority. The mirror sentence is false.
  Delete it or correct it to say the repo is the only copy.
- Note for Joe's side, **not a repo edit**: `claude/README-where-authority-lives.md` says
  "the 29 working rules". There are 36. Cowork is fixing the project docs; do not touch them from here.

---

## Assertions

This is a docs-only change, so most of the proof is grep rather than tests. Report each as a command
and its output:

- `docs/rules-casebook.md` exists, and **no line matches `^[0-9]\+\. \*\*`**.
- `docs/prompts/89-rules-ownership-casebook.md` exists and is byte-identical to the brief you were given
  — `sha256` it against the source and print both.
- `docs/handoff-status.md` contains **no** `## Working rules (binding)` heading, and **no** line
  matching `^[0-9]\+\. \*\*`.
- `CLAUDE.md` still contains `## Working rules (binding)` and its rule numbers still enumerate
  `1 … 36` — print them, do not assert them.
- The phrase `full working rules` appears nowhere in the tree.
- **The preservation check, and it is the one that matters:** for each of rules 19, 21–24, 26–34, a
  distinctive string from that rule's old `handoff-status.md` detail is present in
  `docs/rules-casebook.md`. Pick the strings yourself from the pre-edit file — a path, a number, a
  quoted error — and list which string you used for each rule. **11,089 bytes were carried across;
  show that they arrived.**
- **Mutation check:** state what you would break to make each grep assertion fail, and confirm the
  assertion is checking the thing rather than a label.

---

## Gates, then stop

All five, each as its own command, each reported with its count against the floor in
`docs/handoff-status.md` under "Repo state":

```
pytest                       # from the repo root
npm run test:unit            # from web/
npm run smoke                # from web/
node scripts/qa-shots.mjs    # from web/
npm run geometry             # from web/ — all hard stops
```

The gate and the commit are separate commands (working rule 26). **Do not chain them and do not read a
gate's result from a chained exit code.**

**Then stop and report. Do not commit and do not push.** Joe has approved neither for this brief. Show
him the diff stat and the work left in the tree, and stand by.

---

## Standing rules

- Working rule 2: never write to the repo while another prompt is in flight.
- Working rule 4: stage by explicit path; never `git add -A`.
- Working rule 3: secret gate on added lines, with `grep`, never `findstr`.
- No database access of any kind in this prompt — not a read, not a write.
- Gate floors: `docs/handoff-status.md` under "Repo state", nowhere else. This brief quotes none.
- `assets/` is untracked on purpose and is not drift.
- WUAB and RESN are never named. Credentials never enter the repo or a committed doc.
- Working rule 1: certify Python for Windows before running anything Python.
