# Prompt 105 — CBS MATCHES THE WIDTH BENEATH IT, AND THAT OVERRIDES THE INK-AREA RULE

**Small change, one file, one ruling.** This resizes the two composites prompt 104 built. It does not
touch the render rules — those move to prompt 106. Stacks on `55b946c`, which is **still unpushed**,
so the tree finishes two commits ahead of `origin/main`.

## What Joe ruled, and what it replaces

**Joe, 2026-09-16, having looked at the shipped marks at the real list box: the CBS half is too big
in both composites. Scale CBS down so its width equals the width of the mark beneath it, and let its
height follow proportionally.**

**This overrides the ink-area balance, and that is the point of this prompt.**
`scripts/build_web_marks.py:441` — `stack()` currently scales each part to carry the SAME INK AREA
(`sqrt(ref/area)` against the smallest area in the stack), deliberately scaling the inkier half down.
The comment at `:432` records why: *"CBS is the widest, inkiest mark in the suite (hf 0.758, the
lowest but one)"*. **The recipe already anticipated this complaint and answered it by ink area. Joe
looked at that answer and ruled it insufficient.** Width matching is a different governing rule, not
a correction of a bug, and it must be recorded as an override with Joe's reason — not as a fix.

Scope the override to `COMPOSITES`. Nothing else in the suite changes.

## The measurements this brief rests on — Cowork, 2026-09-16, from `web/public/marks/`

- Sources: `cbs` 461×128, `dazn` 280×128, `wuab-43` 174×128.
- **Inside `wuab-43`, the RESN/DAZN block is 174px wide and the "Cleveland's 43" row is 165px** — so
  RESN/DAZN is the full width of that mark. Joe's phrase "the RESN/DAZN below it" and "the mark
  beneath it" resolve to the same number. There is no ambiguity to resolve.
- Shipped composites today: `cbs-dazn` 192×128 filling **56.0 × 37.3** of the 56×40 box;
  `cbs-wuab-43` 158×128 filling **49.3 × 40.0**.
- Cowork's mock of the width-matched result: `cbs-dazn` ≈164×128 filling **≈51.3 × 40.0**;
  `cbs-wuab-43` ≈120×128 filling **≈37.3 × 40.0**.

**Those mock figures are Cowork's approximation of the recipe, not a target.** Do not tune anything
to hit them. Report what the recipe actually produces; a small divergence is expected and fine, a
large one is a finding.

**Joe has seen and accepted the cost.** Width matching makes each stack taller and narrower, so
`object-fit: contain` fits by height instead of width and the mark shrinks horizontally.
`cbs-wuab-43` drops to roughly two-thirds of the box width. That is the accepted outcome, not a
regression to design around.

## What to change

1. **`stack()`'s balancing rule for `COMPOSITES` only:** every part scaled to the width of the
   **lower** part, height proportional. Both composites are two-part stacks, so in practice CBS is
   scaled to the lower mark's width.
2. **Leave `COMPOSITE_GAP = 0.10` alone.** It is a fraction of the taller half and it produces the
   ~7px output gap both shipped composites show. Do not convert it to pixels.
3. **Leave `HF_MIN` / `HF_MAX` (0.62 / 1.15) alone.** Both composites already clamp at `HF_MAX` and
   the taller, narrower shapes will clamp harder. **Report the derived and published `hf` for each**
   beside the shipped values (`cbs-dazn` raw 1.249, `cbs-wuab-43` raw 1.487, both published 1.150).
   The clamp is not a defect — the list card fits by CSS box and reads no `hf` at all — but the
   figures belong on the record.

## What must not move

- **All 33 non-composite marks rebuild byte-identical.** Prove it the way prompt 104 did, and report
  `build_brand_marks.target()` before and after (it read `11764.455021972657`).
- **`web/test/railmark.test.mjs` keeps `manifest.length === 35`.** No mark is added or removed.
- The composites' rail dimensions **will change** — the file records them at 30.00 × 20.00 and
  27.21 × 22.05, both 600.0. Re-measure, update with the reason, and **keep them inside every
  assertion**. Do not except them from the 600px² target to make the test pass; if one no longer
  lands on it, that is a finding to report, not to route around.
- `tests/test_cavs_simulcast.py`'s composite assertions need updating to the new rule.
  **Mutation-check the new rule specifically:** restoring the ink-area balance must fail a test, and
  so must matching CBS to the wrong part's width.
- **No data changes.** Block A of prompt 104 is done and correct; do not revisit it.

## The samples

Regenerate the comparison under `assets/p105-composite-width-match/` (untracked), at the real
`.mcard .mnet-mark` box — 56 × 40, `object-fit: contain`, DPR 3 — showing **both composites before and
after**, with the drawn size of each in CSS pixels. Say where it is. Do not assert legibility from a
passing test.

## A follow-up that is NOT this prompt

"Cleveland's" inside `wuab-43` does not read at any size that fits this box, at either the old or the
new sizing, and it costs a tier of height that pushes everything else smaller. **If `cbs-wuab-43`
reads too small on Joe's device, the lever is the 43 artwork, not the stack rule.** Record it; do not
act on it.

## Gates and committing

All five gates, each as its own command with its own count, floors read from `docs/handoff-status.md`
under "Repo state" beforehand. **Note for whoever writes that table: `pytest` and `test:unit` both
read 609 as of `55b946c`** — two gates at the same number, in a file with a history of transposed
counts. Worth a word where they are recorded.

Record the ruling in `docs/enhancement-register.md` as its own section, carrying: Joe's instruction,
that it overrides `stack()`'s ink-area balance, that the recipe had already answered the same
complaint by ink area, the measured before-and-after fills, and the accepted cost.

**Stages self-commit on green. DO NOT PUSH** — this overrides rule 7's default, same as prompt 104,
and for the same reason: the push deploys the artwork and it is Joe's to authorize. End with
`git status --porcelain`, `git rev-parse --short HEAD`, and the work left in the tree.
