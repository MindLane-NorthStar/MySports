# Mobile Grid Addendum — v1.6 (decided 2026-09-02; overlap rule added 2026-09-03; zoom mechanism corrected 2026-09-03 · bands, name run and record format added 2026-09-04 · flat endcap added 2026-09-04 · flat endcap renumbered M17→M18 2026-09-04 · per-team cap surface and art, candidate D, 2026-09-04)

> **Numbering note (v1.5).** v1.4 added the fitted name run and the flat endcap in one commit and
> numbered **both M17**. The endcap is now **M18**; the name run keeps M17. M13's superseded-gradient
> note pointed at the ambiguous number and now names M18, which is the rule that actually replaced the
> gradient. No other rule number is duplicated. Rules are listed M1–M12, M15, M16, M17, M13, M14, M18 —
> out of numeric order, which predates this and is left alone rather than silently reshuffled.

**Scope: EVERY grid rendering in EVERY mobile view, for EVERY sport** — CFB, NFL, MLB, NBA, NHL, and any future sport — in the Today, Weeks, and History views alike. The PC/archival grid remains governed by `docs/rendering-contract.md` unamended; anything not listed below inherits that contract verbatim on mobile too.

**M1. Presentation scale.** All grid content renders at 80% of contract design size (the 10px call letters cross the ~8px legibility floor below 80%).

**M2. Time scale — per-day maximum compression.** Per day, per sport: minimum standard-block width = (widest rendered team line on the slate, including rank prefix and record run, measured in the real fonts) + 2×CAP (148) + 34; `PX = that width ÷ the sport's standard display duration` (CFB/NFL 210 min; MLB/NBA/NHL per render policy). Nothing is ever pushed to an additional line — by construction. Shorter truncated blocks keep the contract fit rules (shrink-keep-record → drop record → shrink name → abbreviation).

**M3. Gap collapse — hard cut.** A stretch ≥60 min with no game airing (start → start + sport's estimated duration) is cut: thin dashed seam labeled with the skipped range ("no games 5:15 – 6:40"); axis resumes at the next window. Continuous days render uncut.

**M4. Network rail — fixed, narrowed inside.** Rail 69pt (86 design px at 80%). Tile height unchanged; the mark shrinks inside, fit-boxed; the 10px call-letters band unchanged. Accepted: fine print on detail badges (SEC Network, FS1, ACCN, B1G) is soft-but-identifiable. The rail is permanently fixed left on the grid screen — panning moves only the schedule — and stays pinned at every pinch-zoom level. **v1.2 corrects HOW.** This previously read "(scaling with zoom)", which described the implementation that broke the rule: the canvas carried `transform: scale(zoom)`, and a transformed element becomes the containing block for its descendants, so the sticky rail resolved against the scaled canvas instead of the scrollport and slid across the screen under pinch. Joe found it on the installed app; Chromium reproduced it at +124.6px right of the scroller at zoom 2.5 and -272.8px left at 0.6. **Zoom is now a layout width** - it multiplies the scale model's `pxPerMin`, so the canvas is genuinely wider rather than painted larger, and the rail holds the scrollport natively. **The rail therefore no longer scales with zoom: it stays 69pt at every level** while the schedule stretches beside it. Nothing between the rail and `.mgrid-scroll` may carry a transform.

**M5. Axis labels — hour-only shorthand, Style B, MOBILE ONLY.** Labels only on the hour: Noon, 1pm … 11pm, Midnight, 1am. Style B: Barlow Condensed 700 ~17px design, gold #F0C850, UPPERCASE (NOON · 1PM), letter-spacing 1.2. Gridlines and block placement keep :15 granularity; exact kickoffs stay in card trays. PC/archival keeps v1.2 block-start/end labels.

**M6. Pinch-to-zoom.** Enabled, clamped to [0.6, 2.5]; rail pinned per M4. Zoom stretches the TIME axis through layout rather than magnifying the painted canvas, so block widths and axis ticks grow while the rail, the lane heights and the type stay put. Two consequences, both accepted: the dashed cut seam (M3) is a fixed marker and does not stretch, and `scrollWidth` now tracks the canvas at every level - which also closed the ~418px of dead scroll past the end at zoom 0.6 that prompt 25 measured.

**M7. TBD section.** Cards scale to viewport width; card fit rules absorb shrink. Grouping/ordering/tray unchanged.

**M8. Streaming-group rows.** Full size, lanes never capped; a jump-to-network quick-nav row is added.

**M9. Header/legend/footer.** The contract's narrow-day stacking rule is the mobile default; footer pills wrap; the omitted-games pill is never dropped.

**M10. Empty rows.** Omitted — identical to contract §2.

**M11. Interaction.** Tap block → game detail panel (broadcast list w/ access, odds, records, venue, best-effort deep link to the carrying service / DirecTV Stream); finals → box-score link per history rules. Near-live 15-minute refresh during game windows.

**M12. Team logos — two contexts (app-wide).** On cap endcaps and light tint plates: RAW, never lightness-adjusted (contract v1.3e). Floating on charcoal (listings, odds slot): the derive + lightness-floor chain. **CANDIDATE D (Joe, 2026-09-04): the grid endcap draws the RAW file or the existing `_dark` file, per team, from `web/lib/cap-table.json`.** Which one is measured, not chosen at runtime: the two files are scored at render size on the surface that team's cap actually gets, and `_dark` wins only when it beats raw by more than 0.05. **Selecting between two files that already exist is NOT a v1.3e lightness inversion** - that is Joe's ruling, and it is what lets SMU's white-outlined pony survive a flat red cap that erased the raw file entirely. No new art, no strokes, no halos. **THE LISTINGS CARD NO LONGER APPLIES INK-AREA NORMALIZATION** (Joe, 2026-09-04). Its network mark renders in a FIXED BOX per breakpoint - a **62px** track with a **56 x 40** box at <=560px, a **92px** track with **84 x 44** above it - `object-fit: contain`, centred both ways, with `hf` ignored. On that surface the normalization produced 22-45px heights and 39.7-92px widths, which left the column's left edge ragged by 39.1px in portrait and 57.1px in landscape and dragged the matchup column with it. **`web/public/marks/manifest.json` and its frozen `hf` values are unchanged and remain the authority for the banner and the grid rail**, where one shared height and per-mark normalization is still the right rule. Everywhere else M12 is unchanged. Network marks use the locked per-network recipe table + frozen ink-area normalization in card contexts; the rail keeps derive_dark_mark.

**M15. Team bands and the name run (2026-09-04).** The phone paints §3's team bands, and did not before: `.mnames` held two name rows on the block's own charcoal with no background at all, so the colour data arrived and was never used. It now implements **contract v1.6.8's mobile band rule** — the lighter of a team's two colours paints the band unmodified, the darker inks it, and where the pair fails only the ink is neutralised. **The ×0.82 darkening loop does not apply here** and must not be ported. The end caps tint the **band** colour, and rank and the `@`/`vs` marker take the band's ink rather than `--gold`/`--faint`.

**M15 (amended 2026-09-04, candidate D): the name rows take the CAP'S SURFACE.** `.mcap` and both `.mname` rows paint the same colour - the band itself on a flat-cap team, `tint(band, 0.72)` on a tinted one - so cap and names are one continuous field on every block rather than a tinted cap beside an untinted band. The ink is then re-derived for whichever surface that team got, by the band rule **generalised to any surface** (`inkFor()` in `web/lib/gridmodel.js`): of the team's two colours take the one with the higher WCAG ratio against the surface, use it when that clears 3.0 and is not the surface itself, otherwise `--ink` or charcoal, whichever measures higher. **On `surface === band` this reproduces `bandFor().ink` exactly**, which is pinned from both sides - `tests/test_cap_table.py` over every real colour pair, `web/test/captable.test.mjs` over the study teams and 2,000 random pairs. Measured over the study's 307 teams: **191 team-colour inks, 116 neutral, none under 3.0:1, minimum 3.04**. Twenty-six teams give up a team-colour ink for a neutral, all of them tinted-cap teams, and Joe has seen and accepted that list. **The ×0.82 darkening loop still does not apply on the phone.**

**M16. Record format — the SIMPLE record only.** `(1-0)`, never the PC contract's conference form `(4-1, 2-0 BIG 12)`. M2's per-day time compression makes the phone's name span far narrower than the PC grid's, and the long form would push cards into the drop-the-record fallback constantly — showing *less* information, not more. The archived desktop grid keeps the full form. **§3's `never (0-0)` suppression is now implemented**; it was specified and missing, so a week-1 slate rendered `FALCONS0-0 / @STEELERS0-0`.

**M17. The name run is fitted, not fixed (2026-09-04).** `nameSize` was a hardcoded `Math.max(8, 15 * 0.8)` — 12px that measured nothing, so a long run simply truncated. It is now the **largest size at which the whole `{rank} NAME (record)` run fits the block's name span**, measured per card with the same canvas context M2 uses, capped at the contract's 26px × M1's 0.8 (**20.8px**) and floored at 14px × 0.8 (**11.2px**). Geometry is frozen: block widths, lane counts, cap sizes and tray heights are unchanged, and a larger name never widens a block.

**M13. Everything else** — block anatomy, ~~cap gradients (tint 0.86→0.58)~~ **(superseded by M18)**, centered names with rank + record run, hairlines, ~~seam gradient~~ **(also M18: `.mseam` follows the two cap SURFACES on the phone)**, pills tray with drop priority, marquee gold plate, ALT pills, eligibility buckets, row order, legend glyphs — identical to the PC contract. ~~No other mobile deviations exist.~~ **That sentence was true when written and is not now — see M15 and M16.**

**M14. Overlapping programs split the difference (v1.1, Joe 2026-09-03).** Two programs on the same network row whose blocks overlap by **60 minutes or less** each give up half the overlap - the earlier one's end and the later one's start meet at its midpoint - so they share ONE row rather than forcing a second lane. Over 60 minutes generates the second row as before; three or more mutually overlapping programs fall back to lanes; and if splitting would leave either chip under 60 minutes of rendered width, that pair takes the second row too. **Presentational only** - the drawn block moves, the kickoff never does, and the detail panel still shows real times. Identical to the PC contract's v1.6.5 rule and pinned to it by `tests/fixtures/overlap_cases.json`, which both renderers' test suites read. On CFB 2026-09-05 this takes the phone grid from 38 lanes to 36, with 2 pairs split and the width guard never firing.

**M18. The endcap is PER TEAM - the band, or tint 0.72 - plus a 1px seam (2026-09-04, Joe's ruling on the
cap study; supersedes the flat-0.72 form of this rule).**

M13 inherited the PC contract's vertical gradient, `tint(0.86)` to `tint(0.58)`. B5 replaced it with a single
flat `tint(0.72)` on measurement - the gradient spent half of every cap at the one value that hides logos.
Candidate D replaces the single value with **two levels chosen per team**:

* **`tint = 1.0`** - the cap is the **band itself** - when the better of the team's two files reaches
  `edge_crisp >= 0.85` on the flat band;
* **`tint = 0.72`** otherwise.

`edge_crisp` is the share of the logo's outer-silhouette pixels clearing 1.5:1 WCAG luminance against the
surface, measured at **138 px** (46 CSS px at DPR 3 - the size the cap actually draws) with the art composited
over the surface at its real alpha. A 4px outline in a 500px file is a third of a pixel on the phone, so
nothing is scored at asset size.

**The table is generated, never derived at runtime** - `scripts/build_cap_table.py` produces
`web/lib/cap-table.json`, and the app reads it through `capFor()`, which falls back to `{0.72, raw}` for any id
the table does not carry. That fallback is today's exact behaviour, so a team that arrives before the table is
regenerated renders as it does now instead of breaking. Counts over the 307 teams that play this season and
have art: **170 flat/raw, 28 flat/dark, 84 tinted/raw, 25 tinted/dark.**

**Why per team rather than one global value.** D1 proposed the flat band for everyone and measurement vetoed
it: a logo drawn in the team's own brand colour cannot survive a cap painted that colour, and nine vanished
outright. B5's global 0.72 was the best single value for everybody, which is a different thing from the right
value for anybody. The table answers the question once per team, from the pixels.

**THE 1px SEAM.** At the cap/name boundary on both sides, `rgba(0, 0, 0, 0.30)`, drawn as an **inset
box-shadow** - away cap on its right edge, home cap on its left. Not a border: a border takes a pixel out of
the cap's own box and moves the geometry this contract freezes, where a shadow paints inside the box and moves
nothing. On the phone the ruling's "1pt" is 1 CSS px, which is 3 device px at DPR 3.

**`.mseam`, the 2px strip under the block, follows the two SURFACES**, not the two bands. D2 put it on the
bands because the seam is the block's own edge and not a shadow of it; that reasoning is unchanged and is
exactly why it had to move once the block started painting surfaces. Measured before the change, 31 of 53
blocks on the live slates drew a seam lighter than the cap above it - a full-gold `rgb(255,182,18)` strip
under a `rgb(189,137,19)` Steelers cap, which reads as a rendering fault rather than an edge.

`.mhair` stays `rgba(0,0,0,.22)`, the record run keeps its 82% opacity, the fitted name run (M17) and the
`(0-0)` suppression (M16) are untouched, geometry is unmoved, and the archival PC renderer
`scripts/render_day.py` is not part of this - §3's cap gradient still governs there.
