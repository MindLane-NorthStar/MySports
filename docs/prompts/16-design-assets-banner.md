# MySports — Claude Code Prompt 16: Design assets (icon v6, league/program marks, home banner, navbar banner)

**Preconditions (Joe, before pasting):** Cowork wrote the design stage into the repo on 2026-09-02 at 23:10 UTC (31 new
files in tracked areas, all currently untracked — see "Files already placed") and no other Claude Code prompt is in
flight. `origin/main` == HEAD == `160499f` or later. If `git status` shows the 13 `web/` files as modified with equal
insertions and deletions, that is CRLF/LF noise from the Linux-side view and will not appear on Windows; do not touch it.
This prompt makes **no schema changes** and touches no data pipeline; it is web chrome + committed art + one
new script. Prompt numbering: the Events & Shows migration prompt (formerly "16") becomes **17**.

---

You are working in `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports` (branch `main`). Run as four
self-committing stages in order. Each stage ends with: secret gate (`git diff --cached | grep -E "CFBD_API_KEY=|mysports_writer|R2_SECRET_ACCESS_KEY="` must
match nothing — use grep, never findstr, which silently truncates long lines), `git commit`, `git push origin
main`, and a printed `git rev-parse HEAD origin/main` pair that must match. Never stage `assets/`, `artifacts/`,
`.env`, or `node_modules/` (the `web/.env.local.example` exception stands). Windows rules: Python has no
`%-` strftime, every `open()` passes `encoding=`, console output is ASCII only. Two strikes on a stage →
skip it, log why in `artifacts/RUN_LOG_2026-09-02-design.md`, continue. Hard stops only for the secret gate
or a rejected push.

## Files already placed by Cowork (verify they exist before Stage 1; abort the stage if any is missing)
- `web/public/brand/tv-cutout.png` (700px tall, alpha) and `web/public/brand/app-icon-mysports-tv.png` (1024, the chosen **v6-B**)
- `web/public/leagues/{nfl,nba,mlb,nhl,cfp,wwe,ufc,aew,nascar,indycar}.png` + `{slug}_dark.png` (256px, 20 files) + `leagues-manifest.json`
- `web/public/programs/{college-gameday,big-noon-kickoff}.png` + `manifest.json` (128px; hf 1.15 / 1.079 against the frozen network target 11,734)
- `web/lib/banner-layout.json` — the composition (pc + mobile), every mark's `href`, `cx`, `cy`, `h`, `hf` (networks), `pending`
- `docs/design/banner/banner-pc.svg`, `banner-mobile.svg` (static references), `banner-and-navbar.css`, `navbar.html`
- Untracked sources (never stage these): `assets/brand/app-icon-mysports-tv.png` (= v6-B), `app-icon-mysports-tv-v5-retired.png`, `app-icon-mysports-tv-v6A-rejected.png`, `tv-cutout-hires.png`; `assets/league-logos/*` (ESPN 500px + `nascar.svg`, `indycar-source.jpg`, `indycar-wordmark.svg`); `assets/program-logos/` (`college-gameday.png` = sponsor-free rebuilt shield, `college-gameday-sponsored-original.png`, `big-noon-kickoff.svg`)

## Stage 1 — commit the art + `scripts/build_brand_marks.py`
1. Stage and commit the placed files by explicit path — `git add web/public/brand web/public/leagues web/public/programs web/lib/banner-layout.json docs/design/banner` — never `git add -A` (assets/ and artifacts/ are untracked by design).
2. Write `scripts/build_brand_marks.py` (imports `derive`, `floor_l`, `dark_ready`, `trim`, `ink_area`, `resize_h`, `HF_MIN`, `HF_MAX` from `scripts/build_web_marks.py`). It rebuilds:
   - **leagues** from `assets/league-logos/{slug}.png` (+ `{slug}_dark.png` when a provider dark file exists): raw → trim → 256px `web/public/leagues/{slug}.png`; dark → provider file if present else `dark_ready(raw at 512)` → 256px `{slug}_dark.png`. Two exceptions already baked into the shipped files and to be encoded as recipes: `nascar` source is `nascar.svg` (rasterize at 512); `indycar` raw = `indycar-source.jpg` keyed off white (flood from the border, lum > 225 & chroma < 30), dark = raw with the wordmark rows (below the badge gap) whitened at HLS lightness < 0.35. Manifest rows `{slug, raw_lum, dark_lum, dark_source, aspect}`.
   - **programs** from `assets/program-logos/{slug}.png|.svg` (SVG rasterized through the existing `web/scripts/rasterize-svg.mjs`): recipes frozen from the design session — `big-noon-kickoff`: `floor_l(im, 0.55)`; `college-gameday`: RAW (the source PNG is already the sponsor-free rebuilt shield); 128px output; `hf = clamp(sqrt(TARGET/ink_area), 0.62, 1.15)` with **`TARGET` read from `web/public/marks/manifest.json`** (median of `hf²·area` over marks whose hf is strictly inside the clamp, excluding `guardians-tv`) — never recomputed from the programs themselves, so program marks weigh the same as the network suite and the frozen network manifest is never touched.
   - **tv**: `assets/brand/tv-cutout-hires.png` → 700px `web/public/brand/tv-cutout.png`.
   Flags: `--only leagues|programs|tv`, `--check` (rebuild to a temp dir and compare against the shipped files: identical pixel size and ink area within 1% → PASS; print a table; exit 1 on any FAIL). Run `--check` and paste the table into the run log. Pixel bytes may differ across machines; the ink-area tolerance is the contract.
3. Commit: `Design assets: league + program marks, TV cutout, banner layout, build_brand_marks.py`.

## Stage 2 — web: home banner, navbar banner, wordmark alignment
1. `web/app/globals.css`: append the contents of `docs/design/banner/banner-and-navbar.css` under a `/* ---- banner + navbar (design session 2026-09-02) */` header. Keep token names; do not restyle anything else.
2. `web/components/Banner.js` (server component): renders `<header class="banner">` with `<div class="bn-pc">` and `<div class="bn-mobile">`, each an inline `<svg viewBox="0 0 {w} {h}">` built from `web/lib/banner-layout.json`: defs (drop-shadow `ds`, `glow`, wordmark `wm`, subhead `sub` filters — copy them verbatim from `banner-pc.svg`; give every id a per-instance prefix so the hidden breakpoint's filters never shadow the visible one — Chromium renders NOTHING when a filter id resolves into a `display:none` subtree), sparks, the TV `<image>`, then the marks: skip `pending:true`; network height = `h*hf`, league height = `h`; `<image>` width from the PNG's aspect (read once at build time with `sharp` if present, else hardcode aspect in the JSON — add an `ar` field via `build_brand_marks.py` and prefer that). Title and subhead as `<text>` exactly as in the reference SVGs (Barlow Condensed 700 / 600, letter-spacing 2.24 / 4.8 on PC, 1.6 / 2.2 on mobile).
3. `web/components/NavBanner.js` (client, `usePathname`): the markup in `docs/design/banner/navbar.html`; active link by pathname; context slot receives `{sport, week, day}` props (render what is passed; nothing when empty; keep the standing "all times ET · Cleveland" muted tag on PC).
4. `web/app/layout.js`: home (`/`) shows `<Banner/>`; every other route shows `<NavBanner/>` instead of the old masthead (pick by pathname in a tiny client wrapper, or render both and toggle by a `data-home` attribute — your call, keep it simple). Wordmark everywhere becomes `MySports <b>TV</b>` → renders **MYSPORTS TV** with TV gold (the old "My**Sports**" masthead is retired). `metadata.title` → `MySports TV`.
5. Verify: `cd web && npm run build` clean; then screenshot `/` at 1440×900, 1024×768, 390×844 (dpr 2) and `/weeks` at 1440 and 390 with the Playwright already in `web/node_modules` → `artifacts/qa/design-2026-09-02/`. Open two of them (the 1440 home and the 390 home) and confirm: title inside the SVG, no clipped marks, phone banner ≤ 300px tall, navbar 60/50px.
6. Commit: `Web: home banner + navbar banner from banner-layout.json; wordmark MYSPORTS TV`.

## Stage 3 — programs + pending slots
**No-op as of 2026-09-02 23:10 UTC:** Cowork already processed all four downloads (`web/public/programs/` present, every mark in `banner-layout.json` has `pending:false`). Log "stage 3: nothing to do" and continue. Keep the stage in the prompt only so a future re-run of `build_brand_marks.py --check` has a home.

## Stage 4 — docs
1. `docs/design/banner.md`: composition rules (icon-widened: title band, TV center, league ring, network band; PC 1400×280 stage scaling to width, phone 390×280; leagues class raw/`_dark` 256px; programs class 128px with hf against the frozen network target; the three contrast rulings NHL/ESPN/ABC; the four-surface evaluation: charcoal, TV color bars, cap gradients).
2. `docs/app-skeleton.md`: add the Banner / NavBanner / layout routing paragraph and the `web/lib/banner-layout.json` contract.
3. Append to the top of `docs/research/changelog` (file convention as in prompt 15): `2026-09-02 design session — icon v6, league/program marks, banner + navbar`.
4. Commit `Docs: banner design + app-skeleton banner routing`, push, print the final rev-parse pair, and write `artifacts/RUN_LOG_2026-09-02-design.md` with the per-stage results and the `--check` table.

End with a 10-line report: HEAD, stages done/skipped, test count (`pytest -q` must still be 131), and anything Joe must look at in a browser.
