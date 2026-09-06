You are working in the MySports repo (C:\Users\jlull\Joe's Projects\Apps - Personal\MySports), branch main. This prompt has TWO parts that commit separately: **Part A** amends the rendering contract with the Mobile Grid Addendum (decided by Joe 2026-09-02); **Part B** applies the locked design system to the production web app in `web/`. PRECONDITION: prompt 13 has landed (standings, probable pitchers, teams.display_name, MLB short_name fix) — verify before starting; if it has not, STOP and report. Never print any value from `.env`. Secret gate before every commit as always; nothing under `assets/`, `artifacts/`, `.env`, `node_modules/` staged EXCEPT the explicitly listed `web/public/marks/` outputs. If an acceptance check fails, stop, report, wait.

## 0. Preconditions
1. `git status --short` clean apart from always-untracked asset dirs. Paste.
2. `python -m unittest discover tests` — expect 92+ green (post-prompt-13 count). Paste the count.
3. `cd web && npm run build` succeeds on the current skeleton. Paste the last lines.

---
## PART A — Contract amendment (own commit)

Create `docs/rendering-contract-mobile.md` with EXACTLY the addendum text below (verbatim, including the version line), then add to `docs/rendering-contract.md` §12 change log: `- **v1.5 (2026-09-02):** Mobile Grid Addendum v1.0 adopted as a sibling document (docs/rendering-contract-mobile.md) — mobile presentation rules for every sport and view; the PC/archival grid is unchanged.`

<<<BEGIN ADDENDUM FILE CONTENT
# Mobile Grid Addendum — v1.0 (decided 2026-09-02)

**Scope: EVERY grid rendering in EVERY mobile view, for EVERY sport** — CFB, NFL, MLB, NBA, NHL, and any future sport — in the Today, Weeks, and History views alike. The PC/archival grid remains governed by `docs/rendering-contract.md` unamended; anything not listed below inherits that contract verbatim on mobile too.

**M1. Presentation scale.** All grid content renders at 80% of contract design size (the 10px call letters cross the ~8px legibility floor below 80%).

**M2. Time scale — per-day maximum compression.** Per day, per sport: minimum standard-block width = (widest rendered team line on the slate, including rank prefix and record run, measured in the real fonts) + 2×CAP (148) + 34; `PX = that width ÷ the sport's standard display duration` (CFB/NFL 210 min; MLB/NBA/NHL per render policy). Nothing is ever pushed to an additional line — by construction. Shorter truncated blocks keep the contract fit rules (shrink-keep-record → drop record → shrink name → abbreviation).

**M3. Gap collapse — hard cut.** A stretch ≥60 min with no game airing (start → start + sport's estimated duration) is cut: thin dashed seam labeled with the skipped range ("no games 5:15 – 6:40"); axis resumes at the next window. Continuous days render uncut.

**M4. Network rail — fixed, narrowed inside.** Rail 69pt (86 design px at 80%). Tile height unchanged; the mark shrinks inside, fit-boxed; the 10px call-letters band unchanged. Accepted: fine print on detail badges (SEC Network, FS1, ACCN, B1G) is soft-but-identifiable. The rail is permanently fixed left on the grid screen — panning moves only the schedule — and stays pinned at every pinch-zoom level (scaling with zoom).

**M5. Axis labels — hour-only shorthand, Style B, MOBILE ONLY.** Labels only on the hour: Noon, 1pm … 11pm, Midnight, 1am. Style B: Barlow Condensed 700 ~17px design, gold #F0C850, UPPERCASE (NOON · 1PM), letter-spacing 1.2. Gridlines and block placement keep :15 granularity; exact kickoffs stay in card trays. PC/archival keeps v1.2 block-start/end labels.

**M6. Pinch-to-zoom.** Enabled; rail pinned per M4.

**M7. TBD section.** Cards scale to viewport width; card fit rules absorb shrink. Grouping/ordering/tray unchanged.

**M8. Streaming-group rows.** Full size, lanes never capped; a jump-to-network quick-nav row is added.

**M9. Header/legend/footer.** The contract's narrow-day stacking rule is the mobile default; footer pills wrap; the omitted-games pill is never dropped.

**M10. Empty rows.** Omitted — identical to contract §2.

**M11. Interaction.** Tap block → game detail panel (broadcast list w/ access, odds, records, venue, best-effort deep link to the carrying service / DirecTV Stream); finals → box-score link per history rules. Near-live 15-minute refresh during game windows.

**M12. Team logos — two contexts (app-wide).** On cap endcaps and light tint plates: RAW, never lightness-adjusted (contract v1.3e). Floating on charcoal (listings, odds slot): the derive + lightness-floor chain. Network marks use the locked per-network recipe table + frozen ink-area normalization in card contexts; the rail keeps derive_dark_mark.

**M13. Everything else** — block anatomy, cap gradients (tint 0.86→0.58), centered names with rank + record run, hairlines, seam gradient, pills tray with drop priority, marquee gold plate, ALT pills, eligibility buckets, row order, legend glyphs — identical to the PC contract. No other mobile deviations exist.
END ADDENDUM FILE CONTENT>>>

Commit Part A alone: `Rendering contract v1.5: Mobile Grid Addendum v1.0 (sibling doc)` + attribution lines. Push. Report hash.

---
## PART B — Design application to web/ (the production app)

### B1. Design tokens + fonts
`web/app/globals.css` (or equivalent): charcoal spotlight background (radial #3B3B3B 0% → #232323 42% → #1B1B1B 64% → #0E0E0E 100%), panel #23262B/#31363D→#1E2126, line #3A3F47/#2B2F35, ink #F2F2F0, dim #9AA0A8, faint #6A7078, gold #F0C850, gold-dim #8A7530. Self-hosted `@font-face` from copies of `assets/fonts/` placed in `web/public/fonts/` (BarlowCondensed-Bold/SemiBold, Inter-Regular/SemiBold/Bold — OFL, fine to commit): display = Barlow Condensed, body = Inter. Dark-only app: `color-scheme: dark`.

### B2. Processed marks pipeline — `scripts/build_web_marks.py`
New script producing `web/public/marks/{slug}.png` + `web/public/marks/manifest.json` from `assets/network-logos/` (these OUTPUTS are committed; sources stay untracked). Implement, in this order:
1. `derive(im)`: gray pixels (channel spread < 46) luminance-inverted, BUT ONLY when the gray pixels' mean luminance < 128 — never darken an already-light mark (DAZN/WUAB plates).
2. `floor_l(im, f=0.5)`: HLS lightness floor, hue/sat preserved (l' = f + l*0.25 for l < f).
3. `whiten_dark(im, cut)`: any visible pixel with HLS lightness < cut → near-white (245,245,245).
4. `alpha_harden(im, solid=180, mult=1.35, fringe_cut=140)`: alpha ≥ solid → 255; else ×mult clamped; kill dark (lum<90) low-alpha fringe.
5. `with_suffix(im, '+'/'UNLIMITED')`: white composited suffix per the PC contract convention.
6. Per-network recipe table (Joe-approved 2026-09-02) — everything else gets `dark_ready` (= raw if colored_fraction>0.08 else derive; then floor_l if weighted lum < 95):
   Apple TV → alpha_harden(raw). Big Ten Network → whiten_dark(0.32). Prime Video → whiten_dark(0.35). NBC, Peacock → derive. ESPNU → RAW (no floor). FS1 → floor_l(0.58). Disney+ → floor_l(derive(svg raster), 0.5). HBO Max → derive(svg raster) [the white wordmark]. Paramount+ → svg raster RAW. SEC Network → svg raster. SEC Network+ → with_suffix(svg raster, '+'). ESPN+ → with_suffix(floor_l(png,0.5), '+'). ESPN Unlimited → with_suffix(floor_l(png,0.5), subline 'UNLIMITED'). Guardians TV / MLB Network → dark_ready of the brand composites in assets.
7. Normalization: trim transparent padding; ink area at reference height = (visible px)·(100/h)²; target = the SUITE-WIDE median (computed over all marks, frozen into the manifest); hf = clamp(sqrt(target/area), 0.62, 1.15); override {'Guardians TV': 1.25}. Manifest rows: `{slug, hf}`.
8. Paste the full manifest in the report (Joe reviews the frozen factors).

### B3. Team logos — two contexts
Extend the R2 sync (or a small build step) to publish, beside each `logos/{id}.png` (raw — used by grid caps), a `logos/{id}_dark.png` conditioned variant (derive-guarded + floor_l(0.5) chain — used wherever a logo floats on charcoal: listings, odds slot). Idempotent; count uploaded. The app never applies the wrong context (M12).

### B4. Listings views (Today + Weeks) — the LOCKED card design, all sports
One card component: left time column (gold, ET); duel line = away tcol, big "@" HUGGING the gap (centered between the away name's last character and the home logo — content-flow, not aligned column), home tcol; tcol line1 logo (charcoal-context variant) + name 15px with tiered shrink (12.5px >13 chars, 11px >19) before truncation, using `display_name → short_name` fallback; line2 record + standing from team_records (NBA = conference rank; line OMITTED when absent, never blank); line3 MLB probable "F. Lastname (W-L, ERA)" / "Starter TBA"; grey network text under every matchup; for networks in Joe's access profile ADDITIONALLY the processed mark from B2 at 2/3 of the 3-line height × its manifest hf, vertically centered on line 2; right slot = favored team logo + moneyline over O/U when a line exists, else Sched/Final. Two-week model per the existing weeks route.

### B5. Mobile grid — implement the Addendum (Part A) exactly
App-side component fed by the day feed (never a second SVG): M1 80% presentation; M2 per-day PX computed from the slate with the real font metrics (measure via canvas/opentype against the self-hosted fonts); M3 hard-cut seams; M4 69pt rail, `position: sticky; left: 0` overlay that survives pan AND pinch-zoom; M5 gold Barlow Condensed hour-shorthand labels; M6 pinch-zoom (CSS transform on the scroll canvas; rail pinned); M7–M10 per the addendum; M11 tap → detail panel route/sheet, finals → box-score URL from the games table. Blocks are the full contract anatomy: cap endcaps with RAW logos on tint(0.86→0.58) gradients, hairlines, centered names + rank + record run with the contract fit order, seam gradient, tray with kickoff · venue and pills (favored-logo spread, O/U; drop right-to-left), marquee gold plate when criteria met.

### B6. Detail panel + refresh
Panel: matchup header w/ logos, full broadcast list with access flags, odds w/ book, records/standings, probables (MLB), venue, watch deep links (the curated WATCH map — include DirecTV Stream fallback `https://stream.directv.com`), box score for finals. Refresh: revalidate/poll at 900s during that sport's game windows, honest "data as of" from the feed's generatedAt.

### B7. Acceptance
1. `npm run build` clean; `node web/smoke.mjs` all green (extend it: standings present for the 4 pro leagues or honest preseason nulls; a probable pitcher renders for tomorrow's MLB slate; display_name fallback proves LIU + Georgia State; Red Sox and White Sox distinct).
2. `python scripts/build_web_marks.py` — paste manifest.
3. Unit tests still green. Renderer regression untouched: re-run the v1.6.3 count line check.
4. NO DEPLOY. Screenshots are Cowork's job afterward — do not attempt browser checks.

### B8. Commit and push (Part B commit)
Stage exactly: `docs/rendering-contract-mobile.md` changes from Part A are already committed; here stage `web/` (including `web/public/marks/` and `web/public/fonts/`), `scripts/build_web_marks.py`, any sync-script change, `tests` additions. Secret gate. Message: `Web app v0.2: locked design system applied — listings cards, mobile grid per Addendum v1.0, processed marks pipeline` + acceptance summary + attribution lines. Push; rev-parse pair identical.

## Report
Paste: precondition outputs, Part A hash, marks manifest, smoke output, test count, renderer regression line, secret gate, Part B hash, rev-parse pair. One line per judgment call. Name anything in the addendum you could not implement exactly and why — do NOT silently approximate a design rule.
