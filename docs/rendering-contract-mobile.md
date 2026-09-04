# Mobile Grid Addendum — v1.2 (decided 2026-09-02; overlap rule added 2026-09-03; zoom mechanism corrected 2026-09-03)

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

**M12. Team logos — two contexts (app-wide).** On cap endcaps and light tint plates: RAW, never lightness-adjusted (contract v1.3e). Floating on charcoal (listings, odds slot): the derive + lightness-floor chain. Network marks use the locked per-network recipe table + frozen ink-area normalization in card contexts; the rail keeps derive_dark_mark.

**M13. Everything else** — block anatomy, cap gradients (tint 0.86→0.58), centered names with rank + record run, hairlines, seam gradient, pills tray with drop priority, marquee gold plate, ALT pills, eligibility buckets, row order, legend glyphs — identical to the PC contract. No other mobile deviations exist.

**M14. Overlapping programs split the difference (v1.1, Joe 2026-09-03).** Two programs on the same network row whose blocks overlap by **60 minutes or less** each give up half the overlap - the earlier one's end and the later one's start meet at its midpoint - so they share ONE row rather than forcing a second lane. Over 60 minutes generates the second row as before; three or more mutually overlapping programs fall back to lanes; and if splitting would leave either chip under 60 minutes of rendered width, that pair takes the second row too. **Presentational only** - the drawn block moves, the kickoff never does, and the detail panel still shows real times. Identical to the PC contract's v1.6.5 rule and pinned to it by `tests/fixtures/overlap_cases.json`, which both renderers' test suites read. On CFB 2026-09-05 this takes the phone grid from 38 lanes to 36, with 2 pairs split and the width guard never firing.
