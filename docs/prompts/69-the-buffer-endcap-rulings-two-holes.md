# Prompt 69 — the buffer Joe actually asked for, three endcap rulings, and two open holes

Follows `7f53ab7` + prompt 68's four commits. Five stages, in this order. **Stage 1 is the one Joe
reported twice; do not let the others push it down the run.**

Gate floors from `docs/handoff-status.md` — that file is the only home, rule 10:

```
pytest                       # repo root — 511 passed + 1 skipped
npm run test:unit            # web/ — 479
npm run smoke                # web/ — 33/33
node scripts/qa-shots.mjs    # web/ — 91/91
npm run geometry             # web/ — all hard stops
```

**Kill stray dev servers and chromium BEFORE the first gate run.** Prompt 68 started from 15 orphans
and killed them up front; that is why every gate was green first try.

---

## STAGE 1 — the buffer under the gold line

**This is Joe's report, still open after prompt 68, and prompt 68 is what proved where it lives:**

> Below the gold line that rests below the picker, the league logo is super tight to the gold line.
> There's no buffer above the league logo and beneath the gold line.

Prompt 68 measured it: in day mode the page is at scroll 0 when it lands, the picker's rule ends at
y=100, `#all-today` begins at exactly y=100, and the day/list screenshots at `SCROLL_GAP` 16 and 24
are byte-identical. **There is no scroll to adjust. It is layout.**

Prompt 68 named the change and correctly declined to make it unasked: a `margin-bottom` on
`html[data-hdr='collapsed'] .pickrow` (`web/app/globals.css:3092`), **16px, matching `SCROLL_GAP`.**
Joe has now asked for it.

### Read prompt 62's veto before you write it, and satisfy yourself the hazard does not apply

The rule's own comment says the 8px above the picker is **padding rather than margin** because *"a
transparent 8px band between two sticky elements is a letterbox that the schedule scrolls through"* —
and it did, in that stage's first build. **That veto is about the TOP edge, between two elements both
stuck to the top.** The bottom edge is a different case: nothing below the picker is sticky, so the
margin band sits in normal flow and scrolls away under the plate rather than staying visible.

**Verify that rather than taking this brief's word for it (rule 22).** Scroll a long day in the
browser and confirm no transparent strip appears under the picker at any scroll position. If one
does, stop and report — do not paper over it with a background colour.

**Expect the spacing probes to move.** `qa/tools/s0-gaps.mjs` and `s3-spacing.mjs` measure this
region and reach for `.today-split` by name. Re-baseline them to the measured figures and say what
moved. `qa-shots` may move with them.

Screenshot day/list and week/list at 390×844 at rest, before and after, into `assets/`.

---

## STAGE 2 — Phillies and Raptors: pure data, no code

Joe's ruling, 2026-09-08, after seeing both rendered at true grid size: **take the tinted surface and
lift the ink.**

**AND THE CHEAP WAY TO DO IT IS NOT A `tint` FLAG.** `capFor()` (`web/lib/gridmodel.js:418`) forces
`{ tint: 1 }` for every ruled team, and its comment states the invariant that makes that safe:
*"a grid renders one sport, every pro team is ruled and no college team is, so no single view mixes a
tinted cap with an untinted one."* Giving two teams `tint: 0.72` **breaks that invariant** — an MLB
grid would paint the Phillies' block on a darker surface than its neighbours.

`grid_colors_pro.json` stores an **exact band hex**, so write the tinted colour in directly and leave
`capFor()` alone. `tint(c, 0.72) = round(c*0.72 + 5.712)` per channel, which gives exactly:

| team | band now | band after | ink now | ink after | edge_crisp | ink ratio |
|---|---|---|---|---|---|---|
| Phillies `mlb-143` | `#e81828` | **`#ad1723`** | `#101214` | **`#f2f2f0`** | 0.000 → **0.961** | 4.11 → **6.41** |
| Raptors `nba-TOR` | `#d91244` | **`#a21337`** | `#000000` | **`#f2f2f0`** | 0.308 → **1.000** | 4.12 → **6.98** |

Same pixels as the 0.72 tint, no mixed cap levels, no runtime change. Art is unchanged for both —
Phillies stays `raw`, Raptors stays `dark`.

**Verify the arithmetic yourself** against `tint()` (`gridmodel.js:397`) rather than trusting the
table above, and **re-measure `edge_crisp` and the ink ratio from the pixels** with
`scripts/build_cap_table.py`'s own `measure()` and `ratio_hex()`. Update the `ratio` field in the
JSON to what you measure. Edit through a parser, assert only the intended keys moved (rule 17).

**`capFor()`'s comment is now partly wrong and must be corrected in the same commit.** It cites
*"Phillies 4.11 → 2.61, Raptors 4.12 → 2.68"* as the damage prompt 66's tint was doing. Those two
teams now sit on that surface deliberately, with an ink chosen for it. Leave the reasoning; add what
changed and why, or the next reader will read a contradiction.

Check whether `tests/test_cap_table.py` or `web/test/gridcolors.test.mjs` pins the count of blocks
under 3:1 — Joe's deliberate eleven. Both teams move **up**, so eleven should stay eleven; confirm it.

---

## STAGE 3 — the Giants get a cap-only art file

Joe's ruling: **the SF mark goes black on the orange band. The band does not change.** Measured:
black art on `#fd5a1e` scores `edge_crisp` **1.000** against the current 0.000, with the band and the
black ink both untouched.

**IT CANNOT BE WRITTEN INTO `mlb-137_dark.png`, AND THAT IS THE WHOLE STAGE.** `teamLogoDarkUrl()`
(`web/lib/config.js:156`) is read by `MatchupCard.js:108` and `:250` and by `GameDetail.js:98` and
`:102` — logos floating on charcoal. The same black art scores **0.000 on charcoal**: the Giants
would disappear from every list card in the app.

So this is a **third art context**, and the architecture already works this way — `config.js:151`
documents the two-context split, and the three `split_by_context` teams in `logo_conditioning.json`
depend on the grid and the charcoal contexts resolving different files.

What that means concretely, though **you own the shape**:

1. A cap-only art file per team that needs one — `logos/{id}_cap.png`.
2. A `teamLogoCapUrl()` beside the two in `config.js`, documented in the same comment block.
3. A third value for `cap.art` — `'cap'` — selected at `MobileGrid.js:636` and `:675`. Keep it a
   fall-through, so an id with no `_cap.png` behaves exactly as it does today.
4. The generator. `scripts/build_web_marks.py` owns team art; the operation is *every visible pixel
   to `#000000`, alpha untouched* — a silhouette, not a darkening, and not the lightness-floored
   derive that `logo_conditioning.json`'s `derive` list describes.
5. `art: 'cap'` for `mlb-137` in `web/lib/cap-table.json`, through a parser, with the same declared
   `OVERRIDES` entry pattern prompt 68 established for the 76ers rather than a loosened assertion.

**Only the Giants get a `_cap.png` in this prompt.** The mechanism is general; the roster is one.

---

## STAGE 4 — the three prefixes prompt 68 stopped at

Prompt 68 closed `fonts/` and stopped on the rest, correctly, because `--force` would have
**published** art rather than fixed headers: 9 new objects under `network-logos/` and 12 under
`brand/`, including files whose names say `-retired` and `-rejected`. `grids/` it could not reach at
all, because `local_files()` walks `FOLDERS = ("logos", "network-logos", "fonts", "brand")` and grid
objects arrive by `--push-grids` from `artifacts/rendering`.

**Build the flag prompt 68 proposed: rewrite the cache header on objects the bucket ALREADY has, and
upload nothing new.** One condition beside `--force`. Then run it over `network-logos/`, `brand/` and
`grids/` and report, per prefix: objects rewritten, objects skipped as not-in-bucket, and a spot check
of one object's `CacheControl` before and after.

**Nothing retired or rejected may reach the bucket.** If the flag cannot see `grids/` without
widening `FOLDERS`, say so and stop rather than widening it — that tuple decides what a plain
`--push` uploads, and changing it has reach beyond this stage.

---

## STAGE 5 — the tripwire figures stop being kept in three places

Prompt 68 caught Cowork quoting MLB `scrollWidth` **568** from `CLAUDE.md` when the real figure is
**567**, recorded at `docs/handoff-status.md:620` since prompt 67.

**This is the gate-floor defect, unfixed for the tripwire.** Prompt 66 established one home for the
floors because a duplicated number was wrong four times in one week. The tripwire rows were never
given the same treatment, and they are now wrong in two of their three homes:

- `docs/handoff-status.md:620` — **567. Correct. This is the home.**
- `CLAUDE.md`, the phone-grid geometry tripwire section — says 568.
- `docs/rendering-contract-mobile.md:223` — says 568.

**Replace the figures in `CLAUDE.md` with a pointer to `handoff-status.md`, exactly as prompt 66 did
for the gate floors.** For the Addendum, decide and say which you did: if line 223 is a *frozen
prompt-52 historical record* it stays and gets a note that the current figure lives elsewhere; if it
reads as current, it becomes a pointer too. Do not leave a bare number in either file that a future
run could copy.

---

## GATES AND COMMITTING

Five gates, each its own command, all reported, before any commit. **Never read a gate's result from
the exit code of a chained command (rule 26).** The geometry tripwire must not move — this run
touches spacing, colour and art, none of which is block geometry. If a block count or width moves,
stop and report rather than re-baselining.

**Rule 23:** stages 1–3 change spacing and cap art. Establish whether `docs/design/mobile_demo.html`
implements either, and say explicitly in the commit message whether it changed or why it did not —
prompt 68 set that precedent and it is a good one.

One commit per stage, five, staged by explicit path (rule 4, never `git add -A`; `assets/` stays
untracked). Secret-gate each on ADDED lines only, with `grep` (rule 3). Gate and commit are separate
commands.

**Do not commit or push without Joe's explicit approval.** Report the gates, the stage-1 screenshots
and the stage-4 per-prefix counts, and wait.

Write the gate floors into `docs/handoff-status.md` **after the last gate run**, not during it.
