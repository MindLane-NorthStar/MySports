# Prompt 111 — THE STALE CLAUSES COME OUT, AND THE PROMPT ARCHIVE CATCHES UP

Stacks on `69616fe`. **Stages self-commit on green. The push is Block D's question, not a default.**

*(Numbering: preemption slides to 112. It has slid four times already — 106 named it 107, 108 named
it 109, 109 named it 110, 110 named it 111 — and the numbers are identifiers, not a run order.)*

Three documentation defects, all measured by Cowork against the tree on 2026-09-22 at `69616fe`.
**No code changes. No gate should move.** If one does, that is a finding — report it, do not absorb
it.

---

## Block A — the clause that has now gone stale twice by the same mechanism

**`docs/handoff-status.md:56` reads:**

> `main, HEAD is prompt 101.`

**HEAD is prompt 110** (`69616fe`, *"grid: the one-timeline grid reaches touch devices…"*,
2026-09-22 12:20 EDT). Verify that yourself before editing.

The block quote directly beneath it, at `:61-64`, records that this exact clause read *"HEAD is
prompt 66"* for **thirty-five prompts**, because every run appended a `Re-measured … prompt NN` line
underneath without touching the sentence above. Prompt 101 fixed it on 2026-09-16. **It went stale
again in nine prompts and six days.**

**Cowork's recommendation, and Joe may veto it: delete the standing claim rather than reset it.**
A sentence that has been wrong for forty-four of the last forty-five prompts is not information, and
resetting it to 110 only restarts the clock — prompt 101 already ran that experiment. Keep `main.`
as the opening word, drop the prompt claim, and say instead that the tree's position is read from
`git log` and that the dated measurement lines below carry the history, each with its own prompt
number already attached. Nothing else in that paragraph changes: the floors-live-here rule, its
provenance, and rule 10's precedence are all correct as written.

**If you disagree, say so and reset it to 110 instead — but say which you did and why.** Do not do
both, and do not leave the sentence as it is.

**DO NOT TOUCH THE BLOCK QUOTE AT `:61-64`.** It quotes *"HEAD is prompt 66"* as history, and that
quotation is the whole point of it. Editing history to match the present is the failure this file
exists to prevent.

---

## Block B — measure the push state, then correct every statement of it

**Four places in `docs/handoff-status.md` say the tree is unpushed. Cowork believes all four are
stale, and is not certain.** Measure first; the correction depends on what you find.

| line | what it says |
|---|---|
| `:79-80` | *"**NOT PUSHED** — the tree is now FIVE commits ahead of `origin/main` (`192677f`); Joe authorizes the push."* (prompt 109's paragraph) |
| `:85-86` | *"**NOT PUSHED** — the tree is now THREE commits ahead of `origin/main`."* (prompt 106's paragraph) |
| `:102` | *"**NOT PUSHED** — the brief withheld the push; see the open item below."* (prompt 104's paragraph) |
| `:933` | *"**OPEN — PROMPTS 104, 105 AND 106 ARE COMMITTED BUT NOT PUSHED: the tree is THREE commits ahead of `origin/main`…**"* — this one is in the **Open** list, so it is a live claim, not a dated measurement |

**Against that, prompt 110's paragraph at `:66-72` says `**PUSHED**`,** and Cowork found the local
`origin/main` ref sitting exactly on `69616fe`, zero commits ahead.

**Cowork's evidence is weak on purpose, and you have better.** The `cowork-handoff-2026-09-22.md`
§1 warns that `git fetch` fails silently from the bridge shell, so a ref read there is a cache. A
local push *does* move that ref, which is why Cowork reads it as positive rather than stale — but it
is an inference, and it says nothing about whether Vercel built.

**Measure, in this order:**

1. `git fetch origin` (a real fetch, with credentials — the thing the bridge shell cannot do), then
   `git rev-parse HEAD`, `git rev-parse origin/main`, and `git rev-list --count origin/main..HEAD`.
2. `gh run list --repo MindLane-NorthStar/MySports --limit 10` — or the Vercel dashboard/CLI — for
   **the deployment result of `69616fe` specifically**. Rule 25: a prompt is done when the deploy is
   green, and nothing in the repo records whether it was.

**Then correct all four, by what you measured:**

- **If the tree is pushed:** `:933` is closed — strike it in the file's own `~~…~~` style with a
  dated note saying when the push happened and what the Vercel result was, the way every other
  closed item in that list reads. `:79-80`, `:85-86` and `:102` are **dated measurement lines and
  must not be erased** — they were true on the day. Mark each superseded in place, briefly, with a
  pointer to prompt 110's paragraph. Rule 30: the correction lands in the same commit as the work it
  misled.
- **If the tree is NOT pushed:** the lines are correct, prompt 110's `PUSHED` is the error, and that
  is a much bigger finding. **Stop, correct prompt 110's paragraph instead, and report** — do not
  push to make the documentation true.
- **If Vercel never built `69616fe` green:** say so plainly wherever you record the push, and raise
  it as an open item. A pushed commit that failed to build is not a shipped one, and the iPad
  confirmation in the 2026-09-22 handoff would then rest on a deploy nobody verified.

---

## Block C — the eight briefs that exist in one place, and the two ranges that name them

**`docs/prompts/` holds 107 briefs covering 01–102. Briefs 103 through 110 were never filed.** They
have lived only in the Claude.ai Project, which this session cannot read — and which
`docs/prompts/README.md` already records as having lost a session once. That is the failure the
directory exists to prevent, running for six days.

**Cowork has already written all nine files into the tree.** They are untracked, LF, each ending in
a newline, and each verified byte-identical between the container and the laptop by `sha256`:

| file | bytes | sha256 (first 16) |
|---|---|---|
| `docs/prompts/103-refresh-latency-measurement.md` | 6176 | `3a5092377a47d8bf` |
| `docs/prompts/104-cavs-ota-simulcast-data-and-marks.md` | 8776 | `ee21a52ccb94fda7` |
| `docs/prompts/105-composite-width-match.md` | 6103 | `ba187750fa0a3962` |
| `docs/prompts/106-simulcast-rows-list-collapse-grid-lanes.md` | 8171 | `3918856616c79ca7` |
| `docs/prompts/107-mobile-grid-at-tablet-widths.md` | 6536 | `0f8558a6369b3a28` |
| `docs/prompts/108-standings-row-truncation-check.md` | 7309 | `4b80a830920e2170` |
| `docs/prompts/109-standings-pagination-and-the-cap-guard.md` | 11251 | `992efa620a0fcdce` |
| `docs/prompts/110-tablet-grid-band-and-gridindex.md` | 6186 | `0389b8d7fb00b07e` |
| `docs/prompts/111-handoff-corrections-and-prompt-archive.md` | — | compute it |

**Verify them — do not rewrite them.** Re-run `sha256sum` and `stat` against the table, confirm no
`\r` in any of them (rule 29), and confirm none of the nine names collides with a file already
tracked. Then stage them **by explicit path** (rule 4).

**THE PROVENANCE IS WEAKER THAN EVERY OTHER ROW IN THAT TABLE, AND IT MUST SAY SO.** Every other
entry is `shutil.copyfile` from `Claude outputs\` with a `sha256` proving byte-identity against a
surviving second copy. **These nine have no second copy: `Claude outputs\` stops at prompt 102**
(verified 2026-09-22 — its newest brief is `prompt-102-close-device-confirmations.md`). The source
is the Project document, transcribed through a Cowork session. The `sha256` figures above prove the
container→laptop transfer was clean; **they prove nothing about Project→container fidelity, because
there is nothing to compare against.** Write that limitation into the provenance table in those
terms. An honest weaker row is worth more than a row that looks like the others.

**The README edits, and it has four places that count:**

1. The **"What is here"** paragraph — *"One hundred and seven briefs"* — and its parenthetical
   listing every prior value. Follow the rule that paragraph states: **count them from the directory,
   do not increment.**
2. The **table**, which currently ends at `102`. Add rows 103–111.
3. The **Provenance table** — one row for this batch, with the limitation above.
4. The **UPDATED-by-prompt-87** paragraph, which carries its own running count.

**Three of these were read-only measurement runs and may carry no commit** — 103 (refresh latency),
107 (tablet grid) and 108 (the truncation diagnostic) each say so in their own text. The README has
precedent for that shape in its *"75 and 76 — filed, and no commit carries them"* section. **Source
that claim to the briefs' own text and to `docs/handoff-status.md`, not to a guess from `git log`**,
and if you cannot establish it for one of them, say so rather than asserting it.

**Verify the gaps claim still holds:** the README says 39 and 42 are the only permanent gaps. Nothing
here should change that. Confirm it rather than carrying it forward.

**Then the two ranges in `CLAUDE.md` that name this material:**

- **`CLAUDE.md:23`** cites the register as `(§1–§53)`. **The register is at §55** —
  `docs/enhancement-register.md:4593` is *"## 55. THE MOBILE GRID IS A TOUCH ARTEFACT…"*. Verify and
  correct. (This one was already stale before today; register §54 notes in passing that the stray
  `AGENTS.md` was generated from a `CLAUDE.md` citing `§1–§53`.)
- **`CLAUDE.md:26`** says *"107 briefs covering 01–102"*. Correct it to the counted figure.

**Rule 32 — enumerate, do not assume this list is complete.** `git grep` for other statements of the
brief count, the covered range and the register range before you finish, and report what you searched
as well as what you found. Cowork searched `CLAUDE.md`, `docs/prompts/README.md` and
`docs/handoff-status.md` and found the places named above; it did not search the rendering contracts
or the casebook.

---

## Block D — the push

**Not a default either way, and the answer depends on Block B.** If Block B finds the tree already
level with `origin/main`, then this commit is the only thing unpushed and it is documentation only —
**ask Joe, report the commit SHA, and stop.** If Block B finds real unpushed work, say so and stop;
a documentation commit is not the vehicle for deploying four commits of in-season data and artwork.

---

## Explicitly out of scope

- **The Padres / Rams dark-primary logo class.** It is in neither `docs/queue.md` nor
  `handoff-status.md`, and Cowork owes the queue entry. Not this commit, and **do not start
  diagnosing which art path the grid draws** — that is its own run.
- **`docs/queue.md` has no item 8** (it runs 1–7, then 9, 10) while `handoff-status.md` references
  one. Cowork's to chase. Leave it.
- Preemption (112).
- The `Banner.js:21` / `banner-mobile-v2.json` *"155/428"* debt.
- **No new tests, no gate additions, no `qa-shots` viewport.** This commit adds no assertion, so
  there is nothing to mutation-check.

---

## Gates and committing

All five, each as its own command with its own count, floors read from `docs/handoff-status.md`
under **"Repo state"** beforehand — never from `CLAUDE.md`, a summary, or this brief, which
deliberately quotes none of them.

**The expectation is that no count moves.** Cowork grepped `tests/` and `web/test/` for anything
referencing `docs/prompts` and found nothing, so filing nine markdown files should be invisible to
every gate. **If a count does move, that is a finding** — report which gate and what added the
assertion, and edit the floor row in the same keystroke as the movements row.

Record a short section in `docs/enhancement-register.md` as **§56**, first confirming §1–§55 each
appear exactly once the way every prior section opens. Keep it brief — this is a correction, not a
ruling — and carry three things: that the HEAD clause went stale a second time by the identical
mechanism nine prompts after being fixed, what was decided about it and why; that the push state was
stated in four places and corrected from a measurement rather than an inference; and that the prompt
archive fell eight behind because the briefs stopped reaching `Claude outputs\` on 2026-09-16, with
the weaker provenance named.

**End with the undo block** (`CLAUDE.md` `## Committing`): the exact revert command with the real
SHA, whether anything was one-way, and whether the push deployed.
