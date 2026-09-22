# Prompt 110 — THE ONE-TIMELINE GRID REACHES TOUCH DEVICES, AND THE LAST TWO DEBTS CLOSE

Stacks on `506f081`, which is level with `origin/main`. **Stages self-commit on green, then PUSH** —
this one has to reach Joe's iPad to be judged, and the only way there is production.

*(Preemption is 111.)*

## Joe's ruling, 2026-09-22

**The mobile grid is a TOUCH artefact, not a phone artefact. Gate it on `pointer: coarse`, in both
orientations, with no width ceiling.**

He ruled this after prompt 107 measured the alternative. The evidence, from
`assets/p107-tablet-grid/` and Cowork's read of the images:

| | mobile grid | archived PC grid |
|---|---|---|
| 820 portrait | complete, 77px of pan | **amputated** — headline, game block and every around-the-league row cut mid-line, 508px of pan |
| 1180 / 1366 landscape | complete, ~230px dead space to the right | 228px of pan |
| ALL SPORTS, any tablet width | works | **does not exist** — renders the "pick one above" sentence |

Every measured figure is identical at every viewport, because the grid's width derives from the data
and never from the viewport: 14 blocks, 9 rows, rail 60, lane 768.08, day span 613.95, block widths
{268, 249, 229}, shortest block 229 against the 46 floor, zero wrapped names, zero overflow, axis
pinned at every width. **Nothing stretches. The only thing that changes is the fit around it.**

The ~230px of landscape dead space is **an accepted cost, not a defect.** Making the grid use the
extra width would change its geometry, which the Mobile Grid Addendum governs and the hard stops
pin. That is a separate decision and is NOT in this prompt.

## Block A — the band

`web/app/globals.css:2400-2403` and `:2410-2411` currently key `.mgrid-only` / `.deskgrid-only` off
`max-width: 699px`. Add the touch condition so a coarse pointer gets the mobile grid at any width.

**Keep the 699px rule as well.** A phone is both narrow and coarse, and the existing breakpoint is
load-bearing for everything else in the file. This adds a second way in; it does not replace the
first. `.deskgrid-only` must remain the exact mirror of `.mgrid-only` — that mirroring is stated in
the comment at `:2405-2409` and is what keeps a surface from showing both grids or neither.

**A trackpad reports `pointer: fine`**, so desktops and touch laptops keep the archived grid. That is
the intent; do not widen it.

**Pin it.** `nav.test.mjs` already counts CSS rules statically; add an assertion in the same style
that `.mgrid-only` and `.deskgrid-only` each carry exactly the same set of conditions and remain
mirrors. **Mutation-check it:** removing the coarse rule from one but not the other must fail.

**Do NOT add a tablet viewport to `qa-shots.mjs` in this prompt.** It would move a gate count and the
static mirror test is the cheaper guard. Name it as a follow-on if you think the surface needs
browser-level coverage.

## Block B — `gridIndex` (strike this block if Joe has changed his mind)

**Joe's ruling: page it now.**

`web/lib/queries.js:180-182` reads `generated_grids` with no filter and no limit, ordered
`generated_at.desc`. Prompt 109 measured it at 94 rows against the 1,000 cap, growing about four a
day — roughly nine months of headroom. Because the order is descending, truncation drops the
**oldest** archives, so the app would silently stop offering the earliest days it holds.

Use `restAll()`. One round trip today; more only when it would otherwise have broken.

**Then remove `gridIndex` from the REPORTED list in `restcap.test.mjs`** so the guard has no
exceptions at all. If the REPORTED mechanism now has no members, say whether you kept it (for the
next read that needs it) or removed it, and why.

## Block C — the last place the disproved claim stands

`web/scripts/geometry.mjs:110-111` still reads *"That comparison is COMPLETELY IMMUNE to data drift,
because both sides see the same standings on the same run."* It now sits directly above the console
line prompt 109's follow-up corrected. Rule 32: this is the last place saying it.

**Strike only the immunity claim.** The sentence that follows it — *"if the two differ, the week path
is handing MobileGrid different input, and that is the bug"* — was correct and is exactly what
happened. Keep it. Do not touch the pinned case, a baseline, or any check logic.

## The contract, which is the real change here

**`docs/rendering-contract-mobile.md` describes the addendum's deviations as phone-only, and M5 says
"PC keeps v1.2 labels."** Amend it: the deviations apply to **touch** surfaces, not only phones. The
PC/archived grid remains what a fine pointer sees.

**`web/app/globals.css:2396-2397` states the same phone-only ruling in a comment** and must be
amended in the same commit, or the file will argue with the rule directly beneath it.

Record in `docs/enhancement-register.md` as its own section: Joe's ruling, the measured comparison
above, that the decisive fact was the PC grid being unreadable at 820 and absent at ALL SPORTS, the
accepted landscape dead space, and the M5 amendment.

## Do NOT

- **No change to the grid's geometry** — not lane width, not the rail, not px-per-minute, not the
  day span. The landscape dead space stays.
- No `qa-shots.mjs` viewport (Block A).
- No `latest_team_records` view or migration — still queued.
- No preemption (111).

## Gates and committing

All five gates, each as its own command with its own count, floors read from
`docs/handoff-status.md` under "Repo state" beforehand. `test:unit` will move with Block A's
assertion and `pytest` may not move at all — report both and edit the floor row in the same keystroke
as the movements row.

Every new assertion gets a mutation check, said out loud.

**Stages self-commit on green, then PUSH and verify `origin/main == HEAD`.** Report the Vercel
deployment result. End with `git status --porcelain`, `git rev-parse --short HEAD`,
`git rev-parse --short origin/main`, and the work left in the tree.

**Then tell Joe to open the app on his iPad**, because rule 25's second half applies: the device is
the check, and nothing in this repo can confirm what a one-timeline grid looks like in his hands.
