# Prompt 107 — WHAT THE MOBILE GRID LOOKS LIKE AT iPAD WIDTHS

**REVISED 2026-09-22** after prompts 108 and 109 landed and the push deployed: HEAD is now `506f081`,
`AGENTS.md` is gone, and the standings truncation that would have corrupted these measurements is
fixed. The capture day is now pinned rather than left open.

**Read-only measurement. No tracked file changes, no commits, no push, no gates.** This run exists so
Joe can look at something nobody has ever seen before deciding whether to change a breakpoint.

*(The remaining `geometry.mjs:110-111` comment correction and the `gridIndex` ruling ride in prompt
110. Preemption is 111.)*

## Why

Joe installed MySports as a web app on an iPad for the first time and hit this, quoted from
`web/app/page.js:98-99`:

> The desktop grid is rendered per league — pick one above to see it. On a phone, GRID VIEW shows
> every sport on one timeline.

He wants the one-timeline grid on the iPad. **Cowork has verified that nothing needs to be built:**

- `web/app/globals.css:2400-2403` — `.mgrid-only { display: none }` globally, `display: block` below
  699px.
- `web/app/globals.css:2410-2411` — `.deskgrid-only` is the exact mirror.
- `web/components/Listing.js:318` renders `<div className="mgrid-only"><MobileGrid …/></div>`
  unconditionally when `showGrid`.

**Both grids are in the DOM at every width and CSS hides one.** The comment records why: *"BOTH are
rendered with one hidden by a media query rather than chosen in JS, so there is no server/client
hydration mismatch."* Every iPad is above 699 (mini 744, most 820–834, 13-inch Pro 1024 portrait),
so the phone grid is present and hidden on Joe's device right now.

**What is NOT verified, and is the whole point of this run:** nobody has ever seen the mobile grid
at a tablet width. `web/scripts/qa-shots.mjs:43-46` runs exactly two viewports — 390 and 1440. The
`geometry` hard stops were derived at phone widths. The grid may hold up at 820px or it may go
slack, which is the open "500–699 px band" problem one size larger.

**And it is a contract change, not a tweak.** `globals.css:2396-2397` records a ruling: *"The mobile
grid is a PHONE artefact — the Mobile Grid Addendum's deviations are explicitly phone-only (M5: 'PC
keeps v1.2 labels')."* Do not act on that here. This run only produces the pictures.

## What to do

1. Start the dev server: `npm run dev` from `web/` (Next defaults to port 3000). Stop it at the end
   and say so.
2. Write a **standalone throwaway script** — do not put it anywhere tracked, and do not name it as a
   gate. Playwright is already a dependency of `qa-shots.mjs`; reuse its import style.
3. **Do NOT modify `web/scripts/qa-shots.mjs`.** Adding a viewport there moves a gate count
   (121/121) and this run must move nothing.
4. **Do NOT edit `globals.css` to reveal the grid.** Inject the override at runtime with
   Playwright's `addStyleTag`:
   `.mgrid-only{display:block!important} .deskgrid-only{display:none!important}`
   — so the tree stays byte-clean and `nav.test.mjs`'s three-claimant count is untouched.

**Before capturing anything, verify Cowork's claim rather than trusting it:** confirm that override
alone is sufficient to reveal a populated mobile grid at 820px. If something else also gates it — a
JS branch, a prop, a zero-height container — **that is the finding**, and it changes the whole
answer. Report what you checked, not only what you concluded.

## The captures

**Pin the day to `2026-09-03`, GRID VIEW, ALL SPORTS** — `/?day=2026-09-03&view=grid`. That is the
`geometry` ALL SPORTS case, so its slate is known and stable: **14 blocks across 9 rows**, spanning
more than one sport. Using it means the tablet figures can be compared against a baseline that
already exists. It is also archived rather than live, so nothing drifts mid-run.

Use `deviceScaleFactor: 2`, `isMobile: true`, `hasTouch: true` so `pointer: coarse` matches what an
iPad reports.

| viewport | why |
|---|---|
| 390 × 844 | **the control** — what the grid is designed to be |
| 820 × 1180 | iPad / iPad Air portrait, the common case |
| 834 × 1194 | iPad Pro 11" portrait |
| 1180 × 820 | iPad Air landscape |
| 1366 × 1024 | iPad Pro 13" landscape, the ceiling |

**Capture the ARCHIVED PC GRID at the same four tablet viewports too** (no override — that is what
renders there today). Joe's real choice in landscape may be to keep the PC grid, and he cannot make
that call without both pictures side by side.

Save everything under `assets/p107-tablet-grid/` (untracked) and say where it is.

## What to measure, not eyeball

Report numbers per viewport, with the phone figure beside each so the stretch is visible:

- The lane width, and the rail width against its 60px spec.
- The day's horizontal span — does it fill the canvas or leave dead space?
- The shortest program block against the 46px floor.
- The axis rail and the now marker: still aligned, still pinned?
- Any horizontal overflow, wrapped team name, or truncated record.
- Whether the sticky time row and the axis still lock under the picker.
- **Block count and row count at each viewport against the known 14 and 9.** If either changes with
  width, that is a finding in itself.

**Do not assert legibility from a passing check.** The deliverable is the images plus the figures.

## Explicitly out of scope

- **No breakpoint change.** Not `.mgrid-only`, not `.deskgrid-only`, not the 699/700 boundary.
- **No amendment to the Mobile Grid Addendum or M5.** Joe rules on that after seeing the pictures.
- No tablet viewport added to any gate.
- **No `geometry.mjs` edit** — the comment at `:110-111` is prompt 110's, not this run's.
- **No `gridIndex` change** — prompt 110, pending Joe's ruling.
- The preemption work (now 111).

## Gates — deliberately not run

This run changes no tracked file, adds no assertion and needs no mutation check. Running 626 pytest
cases to take screenshots is pure cost. End with `git status --porcelain`, `git rev-parse --short
HEAD` and `git rev-parse --short origin/main`, and confirm the tree is unchanged at `506f081`, level
with `origin/main`, with nothing outstanding but the known-untracked `assets/`.

## The report

The five mobile-grid images plus the four PC-grid comparisons, the measured table, a plain statement
of whether the mobile grid holds at 820 and at 1366 or not, and anything you found that contradicts
Cowork's reading of how the two grids are gated. Flag disagreements rather than reconciling them.
