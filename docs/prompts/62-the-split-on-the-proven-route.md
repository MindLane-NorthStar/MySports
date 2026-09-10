# Prompt 62 — the split, built on the route the last run proved

**Venue:** Claude Code. **Shape:** staged, self-committing. **Nothing pushes** except where a stage
says so. Two strikes on a stage and you skip it and report.

**Run the loader fix first.** If `pipeline/load.py`'s `game_odds` upsert still names
`"game_id, provider, fetched_at"`, stop and do that instead — the nightly is broken until it lands.

## Hard stops

1. A secret-gate hit on ADDED lines.
2. A destructive database operation. *(None here.)*
3. A rejected push.
4. The geometry tripwire's block counts or block widths moving. The rail width is untouched by this
   run, so a move there is a defect, not a re-baseline.

## Rules that bite

Rule 3 (secret gate, ADDED only, `grep`), rule 4 (stage by path), rule 11 (`--no-optional-locks`),
rule 16 (tokens read from `globals.css`), rule 20 (line-anchored surgery), rule 22 (read the
component, cite file and line), **rule 23 (`docs/design/mobile_demo.html` moves in the same commit)**,
rule 26 (gate and commit are separate commands), rule 29 (`newline="\n"`).

**The floors are 496 + 1 skipped · 446 · 30/30 · 73/73 · geometry.** Read them from `CLAUDE.md`
rather than from this brief — last run's brief was three prompts stale and this one may be too.

---

# Stage 1 — the 0017 records the repo still owes

Migration 0017 was applied to the database from Cowork on 2026-09-08 at 01:34 UTC, on Joe's explicit
approval. The database moved; the repo has not been told. Close that first — rule 14 now says the
repo is the schema's record, and it is currently wrong.

1. **`db/migrations/0017_game_odds_one_row_per_book.sql`** — uncomment the STEP 1 delete and add an
   `APPLIED 2026-09-08` header naming Joe as the approver. The file must show what actually ran.
2. **Commit the archive** Joe was given as `docs/research/game-odds-surplus-2026-09-08.json`. It holds
   all 111 rows of the 32 duplicate pairs, each marked KEEP or DELETE, and its six checksums were
   verified against the live database before the delete ran.
3. **`docs/handoff-status.md`** — close the 0017 items at `:128` and `:202` and the prompt-57 item at
   `:744-758`. Record the applied state: **595 rows before, 516 after, 0 duplicate pairs remaining,
   both unique constraints present** (the three-column one was kept, as the file intended).

**Commit:** `docs: 0017 is applied, and the repo now says so`

---

# Stage 2 — the split

## What Joe asked for

The picker renders directly beneath the navbar and stays there. Tapping the ALL SPORTS tile opens the
league row **between the navbar and the picker**, pushing the picker and the schedule down rather than
covering them — because a dropdown belongs immediately below the control that opened it.

## The route, and why it is the one to build

Three earlier routes were costed and rejected: a portal from `page.js` (breaks SSR), moving
`CollapsedHeader` into the page (fights `.shell`'s column, rewrites a load-bearing note), and
duplicating the `weekIndexRows()` read in the layout (a second read that still cannot see the params
server-side). **This route moves neither the picker nor its data.**

- `.chdr` becomes sticky in normal flow.
- When collapsed, `.hubctl` becomes `display: contents` and its non-picker children become
  `display: none`, so `.pickrow` becomes a direct child of `<main>`.
- `.pickrow` becomes `position: sticky` at the stack's current height.

Opening the league row grows `.chdr`, which sits above `.hubctl` in flow, so the picker and the
schedule are pushed down. The picker keeps its server render, its data path, and its single place in
the DOM.

## What the last run already proved — do not re-litigate these

- **The bar is server-rendered.** A curl of the deployed page with no JS returns `class="chdr"` ×1,
  `chdr-inner` ×1, `chdr-wm` ×1, `chdr-toggle` ×3, `chdr-tile` ×1. Only the collapsed *state* is
  client-side, so this route has no SSR gap.
- **`display: contents` genuinely reparents `.pickrow` for sticky containment.** Measured over a
  3000px page: with it, the picker sticks at 44 from scrollY 200 all the way to 2500. The decisive
  control was the third arm — *merely hiding the four siblings* collapses `.hubctl` to 31.38px and the
  picker never sticks at all. The `display: contents` is load-bearing, not incidental.
- **The sentinel is unaffected.** `Controls` renders it after `.hubctl`, and `headerstate.js` measures
  the removed height rather than assuming it, so the scroll compensation self-adjusts.
- **`main > .hubctl:first-child { margin-top: 0 }` (`:2490`) still matches** and simply becomes moot.

## The four things that break, all already located

1. **The picker's spacing vanishes.** `.pickrow` carries `margin: 0` deliberately (`globals.css:3002`)
   because `.hubctl`'s `gap` sets the space above it and its `padding-bottom` sets the space below —
   both 8px, at `:2897-2902`. `display: contents` removes that box and takes both with it, leaving the
   picker flush against the navbar and flush against the first card. Re-establish both explicitly in
   the collapsed state, and **measure them before and after** rather than assuming 8 and 8 survive.
2. **The sticky must be scoped to collapsed.** Expanded, the navbar is out of flow, so an unscoped
   `.pickrow { position: sticky; top: 44px }` would detach the picker and park it 44px down the
   viewport with nothing above it. Gate on `html[data-hdr='collapsed']`.
3. **`.pickrow` needs an opaque background.** It has none today — it inherits the page ground, so
   cards would scroll visibly through it. Take the plate from the existing tokens (rule 16); stage 3's
   hairline presumes a defined block edge anyway.
4. **The two states cannot be transitioned.** `flex` ↔ `contents` is not animatable, so the 160ms
   slide-in at `:3394-3398` is lost. That is accepted — say so in the report so Joe is not surprised
   by a motion change he did not ask for.

## The one piece still unsolved

**The picker's sticky offset has to track the open row.** Both `.chdr` and `.pickrow` are sticky;
`.chdr` sticks at 0 and grows when the row opens, so a `.pickrow` stuck at the closed height would
slide underneath it. `CollapsedHeader` already knows `sportsOpen` — write the stack's height to a
custom property on `<html>` and read it in `.pickrow`'s `top`. Two things it must account for:
`.chdr` pads itself by `env(safe-area-inset-top)` (`:3045`), and the value has to be correct on the
frame the row opens, not one frame later.

## Also do

**Guard the sibling trap.** `.hubctl > :not(.pickrow) { display: none }` hides by default, so a sixth
child added to `Controls` later disappears silently with no test failing. Pin the expected child list
in a test so that addition breaks loudly.

**Both modes.** Week mode has its own picker. A change that works in day mode and drops the week
picker is the failure to watch for.

**Commit:** `header: the picker joins the bar and the league row splits them`

---

# Stage 3 — the three gold lines, tiered

Joe's ruling from the renderings.

- Navbar line: `rgba(198, 175, 122, 0.28)`
- League row line, while open: `rgba(198, 175, 122, 0.28)`
- Picker line — the outer edge of the fixed block: the existing `--gold-line`,
  `rgba(198, 175, 122, .55)` (`globals.css:134`)

Closed, the navbar line and the picker line sit ~31px apart with only the date between them, and two
rules at equal weight read as stripes rather than boundaries. The outer edge leads.

1. `.chdr` already carries `border-bottom: 1px solid var(--line-soft)` (`:3044`) — a value change on an
   existing border, not a new one.
2. Add a token for 0.28 beside `--gold-line` rather than writing the rgba inline three times (rule 16).
3. All three are **1px**. The renderings drew them at 2px so they would read at that size and said so;
   do not take 2px from those frames.
4. The league row's line exists only while the row is open.
5. These are decorative rules, not text. Do not "fix" them to a text contrast ratio.

**Commit:** `header: gold hairlines under the bar, the row and the picker`

---

# Stage 4 — the reference, the tripwire, and the dead band

1. **Rule 23.** `docs/design/mobile_demo.html` implements the header, and stages 2 and 3 both changed
   it. Update it in this commit.
2. **The tripwire.** Re-run `npm run geometry`. Block counts and widths must not move — hard stop 4.
   `scrollWidth` should hold too; the rail width is untouched.
3. **Measure the dead band. Do not project it.** The only measured figure on record is **45px against
   the 44px navbar**, from prompt 60's CDP touch runs. Everything else quoted anywhere is arithmetic.
   Re-run that measurement against the new stack, closed, in **week mode grid view**, and report the
   measured band in px, the visible grid height at that scroll position, and the band as a share of it.
   Report the open-row state separately and label it transient.
4. **Do not touch `MobileGrid`'s touch handling.** The document-level pinch rebind stays shelved. If
   the measured band is worse than expected, that is a finding to report, not a licence to fix it here.
5. Update `docs/handoff-status.md` with the measured band and what this run closed.

**Commit:** `docs: the reference, the tripwire and the measured dead band`

---

# The report

Per stage: what changed, the five gate counts, the commit hash, and every number you measured with the
command that produced it. Then:

- **The measured dead band**, against the 45px baseline, as a share of the visible week grid.
- **The picker's spacing above and below**, before and after — the two 8px gaps `display: contents`
  removes and stage 2 re-establishes.
- **Whether the 160ms slide-in survived.** It probably did not; say what replaced it, if anything.
- **Anything in this brief that turned out to be wrong.** The line citations here came from the last
  run's report rather than from Cowork, so they should hold — but check them, and say if they did not.

Nothing pushes. Joe reads the report, looks at his phone, then decides.
