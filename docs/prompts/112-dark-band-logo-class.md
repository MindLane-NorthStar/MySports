# Prompt 112 — THE DARK-BAND LOGO CLASS: MEASURE IT, THEN FILE IT

Stacks on `f4aab2c` (prompt 111). **Check `git rev-parse --short origin/main` first** — if it is
behind `f4aab2c`, prompt 111's push is still pending and is not this run's business; say so and
carry on.

**Block A is read-only and must fix nothing. Block B commits documents only.**

*(Numbering: preemption slides to 113.)*

---

## What Joe reported, and why the handoff's two candidate mechanisms are both wrong

**Joe, on the device, 2026-09-22: on the GRID, the San Diego Padres mark renders brown on brown and
the Los Angeles Rams mark renders dark on dark. Both illegible.**

`claude/cowork-handoff-2026-09-22.md` §4 named two candidate mechanisms and said to establish which
one draws the grid mark before doing anything else. **Cowork established it from the files on
2026-09-22, and it is neither of them.** Verify this reading rather than adopting it — but do not
re-derive it from scratch, and do not go looking in the two places it rules out:

- **`data/logo_conditioning.json` + `build_web_marks.py:team_dark_variants()` is the wrong path.**
  That function's own docstring (`:694-700`) says it builds `{id}_dark.png` for *charcoal-floating*
  contexts — a listings card's line 1, the odds slot, the detail panel. It is not what a grid block
  paints.
- **`build_web_marks.py:team_cap_art()` is the wrong path too.** `web/lib/config.js:222` says
  `teamLogoCapUrl()` (`:226`) is *"ONLY REACHED WHEN THE CAP TABLE SAYS `art: \"cap\"`"*, and exactly
  **one** of the 124 ruled teams carries `art: 'cap'`. Neither of Joe's two teams does.

**The actual path:** `web/lib/gridmodel.js:392` `capFor(teamId)` reads `web/lib/cap-table.json`,
which `scripts/build_cap_table.py` generates by measuring the logos at render size. That row decides
whether the block paints the raw file or `{id}_dark.png`.

**What the two rows say** (`web/lib/cap-table.json`, and the ruled band from
`data/grid_colors_pro.json`):

| team | id | band | text ink | ratio | cap-table `art` | `edge_crisp` |
|---|---|---|---|---|---|---|
| Padres | `mlb-135` | `#2f241d` (brown) | `#ffc425` | 9.47 | `raw` | **1.0** |
| Los Angeles Rams | `nfl-14` | `#003594` (navy) | `#ffd100` | 7.42 | `raw` | **1.0** |

**Both score a PERFECT 1.0 on the measure that chose their art, and both are the ones Joe cannot
read.** That is the finding, and it is not a contradiction — it is what the measure was built to do.

---

## The mechanism, cited

`scripts/build_cap_table.py:14-20` defines it, and the two sentences that matter are:

> *"'edge' is ink within 2 device px of a non-ink pixel, **which is the outer silhouette and the only
> place the logo actually meets the surface**. `edge_crisp` is the share of edge pixels whose WCAG
> luminance ratio against the surface is **>= 1.5:1**"*

So the measure looks at a 2-pixel rim at a 1.5:1 bar. **It says nothing about the interior mass of
the logo.** A mark with a light rim and a dark interior scores perfectly on a dark band and still
reads as a dark shape on a dark ground at 46 CSS px. The Padres' brown-and-gold and the Rams' navy
horn are both that shape.

**And there is a structural consequence worth stating plainly.** `:23-25` gives the rule:

> *"on the chosen surface, art = dark only when the `_dark` file beats raw by MORE than 0.05, else raw"*

**A logo that scores 1.000 on raw can never be given the dark variant**, because nothing can beat
1.000 by 0.05. So for exactly the teams whose rim is bright and whose interior is not, the table is
incapable of choosing the other file. That is why both of Joe's reports carry `edge_crisp: 1.0`.

**`web/lib/gridmodel.js:427-429` already records a related loose end in the same area** — 16 of the
42 ruled teams carrying `art: 'dark'` were scored against a *tinted* surface that has since changed
to flat, and it says re-measuring *"needs the pixels at render size … which is not a runtime rule and
not this change."* That is adjacent, not identical: it is about a surface that moved underneath a
score. This is about what the score measures at all. **Do not conflate them in the write-up**, and
say so if you think Cowork has that distinction wrong.

---

## Block A — measure the class. FIX NOTHING.

**94 of the 124 ruled teams carry `art: 'raw'`; 29 carry `'dark'` and 1 carries `'cap'`** (Cowork's
count from `web/lib/cap-table.json` against `data/grid_colors_pro.json`). Thirteen ruled bands are
pure `#000000`. The class is somewhere inside the raw-art group and nobody has looked.

1. **Reproduce the two reports at render size.** Composite the Padres' and Rams' raw logos over their
   ruled bands at **138 px (46 CSS px at DPR 3)** — the size `build_cap_table.py` itself uses, so the
   numbers are comparable. Report `edge_crisp` as the script computes it, and beside it **two figures
   the script does not compute**: the share of *all* ink pixels (not only edge) clearing 1.5:1
   against the band, and the median luminance ratio of the ink mass against the band. Those two are
   the candidate instrument; name them as Cowork's proposal, not as a decided metric.

2. **Sweep every ruled team whose cap-table row says `art: 'raw'`** with the same three figures, and
   rank by the interior measure. **Report where the Padres and the Rams land in that ranking** — if
   they are not near the bottom, the proposed instrument does not explain Joe's reports and that is
   the finding, not something to tune around.

3. **For the worst ~12, also compute what the `_dark` file would score** on the same interior
   measure, so it is known whether a different file would even help. **If for some teams neither file
   works, say so** — the answer for those is new art or a band change, both Joe's, and it changes the
   shape of the queue entry.

4. **Render the pictures.** The worst ~12 blocks as they render today, at true grid size and at 4×
   for inspection, plus the Padres and Rams before/after with the `_dark` file where one exists.
   Save under `assets/p112-dark-band-logos/` (untracked) and say where it is. **A passing measurement
   and a legible block are different claims** — Cowork opens these at pixel scale and Joe rules from
   them.

5. Check whether `tests/test_cap_table.py`, `web/test/captable.test.mjs` or
   `web/test/gridcolors.test.mjs` pins anything a future interior measure would contradict.
   **Report it; change nothing.**

**Do NOT, in this block or any other:**

- change `scripts/build_cap_table.py`, `web/lib/cap-table.json`, `data/grid_colors_pro.json`,
  `data/logo_conditioning.json`, or any logo file;
- regenerate the cap table, even to see what happens — it feeds the grid's live rendering;
- add or alter an assertion in `tests/test_cap_table.py`, `web/test/captable.test.mjs` or
  `web/test/gridcolors.test.mjs`;
- touch `build_web_marks.py`.

**The art a ruled team paints is Joe's ruling** (prompts 66 and 69, register §21-era). Changing it —
or changing the rule that picks it — is a re-ruling he makes by eye, from the pictures this run
produces. This run produces evidence and nothing else.

---

## Block B — four documentation items, committed

### B1 — the queue entry that is owed

`docs/queue.md` has no entry for any of this, and the 2026-09-22 handoff says to put one there.
**Write it from what Block A measured, not from this brief** — and if Block A contradicts Cowork's
reading above, write the entry to match the measurement and say in the run report that it did.

Follow the file's own shape (**What / Why not yet / Where it starts / Size**, ending in *"A
description of a problem, not an approved plan"*). **Take the next free number; never renumber an
existing item.** It should carry: Joe's two reports as the trigger; that the grid's art comes from
`capFor()` and the cap table, naming the two paths this ruled out so nobody re-treads them; that
`edge_crisp` is an outer-silhouette measure at 1.5:1 and is silent on interior mass, with the file
and line; that a 1.000 raw score structurally locks out the dark variant; how many teams the sweep
found and where the Padres and Rams ranked; and that the fix is Joe's ruling — a per-team re-ruling,
a second measure added to the table build, or new art — **with none of those chosen**.

### B2 — the duplicate-numbers count now says two different things

Prompt 111 corrected `docs/handoff-status.md:27` from five to **six** numbers carrying more than one
file (13, 23, 26, 43, 48, 86), and `docs/enhancement-register.md:4713` repeats six.
**`docs/prompts/README.md:181` says FIVE** — 23, 26, 43 and 48 two each, 86 three — and it excludes
13 deliberately, with its reason written in the same sentence: *"`13-14-combined-…` is the merged run
of two numbers and has its own row, so it is not counted here."*

**Both are defensible and the arithmetic is not in dispute** (Cowork verified: 116 files, 109
distinct numbers, 7 extra files — 13, 23, 26, 43 and 48 contribute one each, 86 contributes two).
What is wrong is that the identical phrase carries two different numbers in three files, which is the
second-copy drift prompt 111 existed to clean up.

**Reconcile it, and say which way you went and why.** The cheaper direction is to leave the README's
five alone — it is the considered one — and make the handoff and register say *"six numbers if
`13-14-combined` is counted under 13, five as the README counts it, and the README explains why"*.
**One place should own this and the others should point at it**, the way the gate floors do.

**There is also a smaller error to correct in the same pass.** The handoff's new parenthetical reads
*"this said five until prompt 111 counted the directory; 48 has carried two since prompt 93"* — which
implies it was correcting the README's five. It was not: the handoff's old five was
(13, 23, 26, 43, 86), which both included 13 **and** omitted 48, so it was wrong in two directions and
that note describes only one of them.

### B3 — a comment names a test file that does not exist

`web/lib/gridmodel.js:353` reads *"`tests/test_cap_table.py` pins that over every real colour pair
and **cap-table.test.mjs** pins it again here"*. **There is no `cap-table.test.mjs`.** The file is
`web/test/captable.test.mjs`, with no hyphen; `web/test/gridcolors.test.mjs` also reads the table.
This is rule 31 — the search that finds nothing is evidence about the query — and it misled this
brief, so rule 30 puts the correction in this commit. **Fix the comment to the real filenames.**
Change no test and no logic.

### B4 — `docs/queue.md` has no item 8, and it turns out that is correct

Cowork flagged the 7 → 9 gap this morning as possible drift. **It is not drift, and the record is
clear** — `git log -S'## 8.' -- docs/queue.md`:

- `3ebc4d0` added *"## 8. Building the schedule out to April 2027"*; `8f3b3c1` (prompt 88) removed it
  — that work is item **7** today.
- `09dcf72` added *"## 8. The working rules exist in two copies, and they have already drifted"*;
  `44d7d7c` (prompt 89) removed it, and **`docs/enhancement-register.md:3362` says
  *"item 8 is closed by this entry"*** — register §38, the entry that made `CLAUDE.md` the sole owner
  of the working rules.

So the number was retired on closure, which is the convention. **Add a one-line tombstone** where
item 8 would sit, naming what closed it and pointing at §38, so the next reader does not re-flag the
gap as Cowork did. `docs/handoff-status.md:159`'s mention of *"queue item 8"* is a dated line about
what prompt 88's follow-up touched and was true then — **leave it alone.**

---

## Explicitly out of scope

- **Any change to what a block actually paints.** Block A's prohibitions bind the whole run.
- Preemption (113).
- The `Banner.js:21` / `banner-mobile-v2.json` *"155/428"* debt.
- The `latest_team_records` view (`docs/queue.md` item 10) — still trigger-gated.
- Pushing prompt 111's commit, if it is still unpushed; that is Joe's separate answer.
- **No new gate, no new viewport, no assertion added anywhere.**

---

## Gates and committing

All five, each as its own command with its own count, floors read from `docs/handoff-status.md` under
**"Repo state"** beforehand — never from `CLAUDE.md`, a summary, or this brief, which quotes none of
them.

**No count should move.** Block A adds no assertion and Block B is documents. **If one moves, that is
a finding** — report which gate and why, and edit the floor row in the same keystroke as the
movements row. Block A starts a dev server only if it needs one; stop it by path (rule 35) and say so.

Record the mechanism in `docs/enhancement-register.md` as **§57**, confirming §1–§56 each appear
exactly once first. It is a diagnosis, not a ruling, and should say so: what Joe saw, that the grid's
art comes from `capFor()` and the cap table rather than either path the handoff proposed, what
`edge_crisp` measures and what it is silent about, the 1.000 lock-out, the sweep's numbers, and that
**no fix was chosen and the ruling is Joe's.**

**Stages self-commit on green. DO NOT PUSH** — prompt 111 may still be unpushed ahead of this, and
Joe authorizes both together or separately as he chooses.

**End with the undo block** (`CLAUDE.md` `## Committing`): the exact revert command with the real
SHA, whether anything was one-way, and whether the push deployed.
