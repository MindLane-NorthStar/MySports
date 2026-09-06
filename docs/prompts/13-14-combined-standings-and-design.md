# MySports — Combined Unattended Run: Prompt 13 + Prompt 14 + Spec Audit (2026-09-02)

You are working in the MySports repo (C:\Users\jlull\Joe's Projects\Apps - Personal\MySports), branch main. Joe is away; run ALL stages in succession WITHOUT waiting for approvals. Rules of engagement for this run:

- **Rails:** each stage ends with its own commit + push (rev-parse pair identical) before the next begins. If a step fails, fix and retry ONCE; a second failure → log it, SKIP that item (not the stage) if the stage can still meaningfully complete, else skip the stage, and continue. Keep a running judgment log; every skip appears in the final report.
- **Hard stops only for:** the secret gate matching anything; a DB operation behaving destructively or hitting an unexpected FK; git push rejection you cannot fast-forward. On a hard stop, write `artifacts/RUN_STOPPED.md` with the state and stop.
- Never print any value from `.env`. Secret gate before every commit: staged diff contains no `CFBD_API_KEY=`, `SUPABASE_DB_URL=postgresql://mysports_writer`, or `R2_SECRET_ACCESS_KEY=` values. Nothing under `assets/`, `artifacts/`, `.env`, `node_modules/` staged EXCEPT the explicitly permitted `web/public/marks/` and `web/public/fonts/` outputs in Stage 3.
- **Joe's explicit authorizations for this run (2026-09-02):** apply migration 0008 live unattended (backups first); install Playwright + Chromium on this machine for the audit stage.
- Windows Python conventions as always (no `%-` strftime, `encoding=` on open(), ASCII console).

Precondition: `git status --short` clean apart from `?? db/migrations/0008_standings_and_probables.sql` and always-untracked asset dirs; `python -m unittest discover tests` = 88 green. Log both.

---
## STAGE 1 — Data: standings, probable pitchers, display names, Sox fix (= prompt 13 v4)

### 1.1 Migration 0008
Backups: `python scripts/backup_table.py team_records` and `... games` (log counts). Read the migration. `apply_migration.py --dry-run` (run verification selects separately), then APPLY LIVE (authorized). `db/README.md` ledger entry.

### 1.2 `pipeline/standings.py`
One module, all four pro leagues, upserting `team_records` (key `(team_id, season, as_of)`, as_of = today ET; wins/losses/ties/ot_losses/points/division_rank/games_back as provided, null where not). Conventions of `pipeline/` (stdlib HTTP via adapters.common, Windows-portable, ASCII, never print DSN). CLI `python -m pipeline.standings [--league ...] [--from-file ...]`; save raw snapshots.
Endpoints (verify shapes live; report divergences): MLB `statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=2026` (division rank, GB; key `mlb-{team.id}`). NHL `api-web.nhle.com/v1/standings/now` (W/L/OTL, points, divisionSequence; ids via the NHL↔ESPN map in adapters/nhl.py; catch + retry once on the Windows connection reset). NBA `site.api.espn.com/apis/v2/sports/basketball/nba/standings` — **store CONFERENCE rank in division_rank (Joe's ruling); document the NBA semantics in db/README.md**; key `nba-{TRICODE}`; preseason shapes reported honestly. NFL `site.api.espn.com/apis/v2/sports/football/nfl/standings` (W/L/T, division rank; key `nfl-{espnId}`). Fail-honest per league: a failing league is skipped with a warning; others commit.

### 1.3 Probable pitchers
`adapters/mlb.py`: add `probablePitcher` to schedule hydration + one batched `GET /api/v1/people?personIds=<list>&hydrate=stats(group=[pitching],type=[season])`; each game's fixture gains `"probables": {"away": "F. Lastname (W-L, ERA)", "home": ...}` (display-ready string; name alone when stats missing; null-safe when absent — common >2 days out and doubleheader game 2). `pipeline/load.py`: write `probable_home/away_pitcher` null-safe (null never erases; a changed name overwrites). Tests: ≥4 (parse, absent→null, loader null-safety both directions).

### 1.4 Display names — `teams.display_name`
Fetch ESPN college-football teams for groups 80 AND 81 (`limit=500`) via `site.api.espn.com/.../college-football/teams`; match by ESPN id where possible, else normalized school name; write `display_name = shortDisplayName` where it DIFFERS from `short_name`; pro sports stay null; unmatched listed and left null, never guessed. Log the FULL diff list for Joe's later review. Spot-assert: LIU, NC A&T, San Jose State get short forms; Georgia State stays spelled out.

### 1.5 MLB short names — "Sox" is not a team
`teams` rows mlb-111 and mlb-145 both store `short_name='Sox'`. Fix the bootstrap field in adapters/mlb.py to statsapi **`teamName`** (verify live: ids 111 → "Red Sox", 145 → "White Sox"). Audit ALL 30: log a table of team_id | current short_name | teamName; update every differing row (report extras rather than silently fixing). Test asserting 111/145 mapping from a saved payload.

### 1.6 Workflow + acceptance + commit
`schedule_refresh.yml`: daily standings step after adapter fetches; YAML parses. Acceptance: `python -m pipeline.standings` (log console + per-league counts + the CLE Guardians row); `python -m adapters.mlb --date 2026-09-04` re-fetch (probables in fixture; log the CLE lines) and `--date 2026-09-03` (3 games with named pitchers + stats); `python -m pipeline.load --all --workflow claude-code` then re-load unchanged (null-safety proven); `python -m pipeline.reconcile --workflow claude-code` (standings/probables must not wake it beyond normally-changed games); suite 92+ green; renderer regression `render_day.py --sport mlb --date 2026-09-04 --fixture artifacts/validation/mlb_2026_2026-09-04_fixture.json` count line unchanged (`3 on grid · 0 TBA · 13 omitted`).
Stage exactly: migration, db/README.md, pipeline/standings.py, pipeline/load.py, adapters/mlb.py, adapters/README.md (probables note), tests, workflow. Commit `Standings + probable pitchers + display names + MLB short_name fix (prompt 13)` with the acceptance summary + attribution. Push.

---
## STAGE 2 — Contract amendment v1.5 (= prompt 14 Part A)

Create `docs/rendering-contract-mobile.md` with EXACTLY this content, and add to `docs/rendering-contract.md` §12: `- **v1.5 (2026-09-02):** Mobile Grid Addendum v1.0 adopted as a sibling document (docs/rendering-contract-mobile.md) — mobile presentation rules for every sport and view; the PC/archival grid is unchanged.`

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

Commit alone: `Rendering contract v1.5: Mobile Grid Addendum v1.0 (sibling doc)` + attribution. Push.

---
## STAGE 3 — Web app design application (= prompt 14 Part B)

### 3.1 Tokens + fonts
`web/` globals: charcoal spotlight radial (#3B3B3B 0% → #232323 42% → #1B1B1B 64% → #0E0E0E 100%), panel #23262B / #31363D→#1E2126, line #3A3F47/#2B2F35, ink #F2F2F0, dim #9AA0A8, faint #6A7078, gold #F0C850, gold-dim #8A7530; `color-scheme: dark`. Copy BarlowCondensed-Bold/SemiBold + Inter-Regular/SemiBold/Bold from `assets/fonts/` to `web/public/fonts/` (OFL — committing is fine); self-hosted `@font-face`; display = Barlow Condensed, body = Inter.

### 3.2 `scripts/build_web_marks.py` → `web/public/marks/` + `manifest.json` (outputs committed)
Helpers, exactly: `derive` (gray spread<46 luminance-inverted ONLY when gray mean lum < 128 — never darken a light mark); `floor_l(im, f=0.5)` (HLS floor, l' = f + l*0.25); `whiten_dark(im, cut)` (visible px with lightness<cut → 245,245,245); `alpha_harden(solid=180, mult=1.35, fringe_cut=140)` (body opaque, dark low-alpha fringe removed); `with_suffix` (white '+' beside, or letterspaced subline below, per the PC contract convention); `dark_ready` = raw if colored_fraction>0.08 else derive, then floor_l(0.5) if weighted lum<95.
Recipe table (Joe-approved 2026-09-02; everything else → dark_ready): Apple TV → alpha_harden(raw). Big Ten Network → whiten_dark(0.32). Prime Video → whiten_dark(0.35). NBC, Peacock → derive. ESPNU → RAW. FS1 → floor_l(0.58). Disney+ → floor_l(derive(svg raster), 0.5). HBO Max → derive(svg raster) [white wordmark]. Paramount+ → svg raster RAW. SEC Network → svg raster. SEC Network+ → with_suffix(svg raster,'+'). ESPN+ → with_suffix(floor_l(png,0.5),'+'). ESPN Unlimited → with_suffix(floor_l(png,0.5), subline 'UNLIMITED'). Guardians TV / MLB Network → dark_ready of the brand composites.
Normalization: trim padding; ink area = visible px × (100/h)²; target = suite-wide median; hf = clamp(sqrt(target/area), 0.62, 1.15); override Guardians TV = 1.25. Manifest `{slug, hf}`; log the full manifest.

### 3.3 Team logos, two contexts
Publish `logos/{id}_dark.png` conditioned variants (guarded derive + floor_l(0.5)) beside the raw `logos/{id}.png` in R2 (extend the sync; idempotent; log count). Grid caps use RAW; charcoal-floating contexts use `_dark`.

### 3.4 Listings views (Today + Weeks) — the LOCKED card, all sports
Left time column (gold, ET). Duel line: away tcol, "@" HUGGING the gap (content-flow between away name's last character and home logo — NOT an aligned column), home tcol. tcol line 1: `_dark` logo + name 15px, tiered shrink (12.5px >13 chars, 11px >19) before truncation, `display_name → short_name` fallback. Line 2: record + standing from team_records (NBA = CONFERENCE rank; OMIT the line entirely when absent). Line 3 (MLB): probable "F. Lastname (W-L, ERA)" / "Starter TBA". Grey network text under EVERY matchup; for access-profile networks ADDITIONALLY the processed mark at 2/3 of the 3-line height × its manifest hf, vertically centered on line 2. Right slot: favored team `_dark` logo + moneyline over O/U when a line exists, else Sched/Final. Two-week model on the weeks route.

### 3.5 Mobile grid — implement Stage 2's addendum EXACTLY (M1–M13)
App-side component from the day feed. Computed per-day PX (measure with the self-hosted fonts), 80% presentation, hard-cut seams, 69pt rail `position: sticky; left: 0` surviving pan AND pinch-zoom (CSS-transform canvas), gold Barlow Condensed shorthand hour labels, viewport-width TBD cards, full-size streaming lanes + quick-nav, narrow-day header stacking, tap → detail panel, finals → box-score URL. Blocks = full contract anatomy (RAW cap logos on tint 0.86→0.58 gradients, hairlines, centered names + rank + record run with the contract fit order, seam gradient, tray kickoff · venue + pills with right-to-left drop, marquee gold plate).

### 3.6 Detail panel + refresh
Matchup header w/ logos; full broadcast list with access flags; odds w/ book; records/standings; MLB probables; venue; watch deep links (curated WATCH map + DirecTV Stream fallback `https://stream.directv.com`); box score for finals. Revalidate/poll 900s during game windows; "data as of" from feed generatedAt.

### 3.7 Acceptance + commit
`npm run build` clean. Extend `web/smoke.mjs`: standings rows for 4 leagues (or honest preseason nulls); a probable renders for tomorrow's slate; LIU + Georgia State display-name behavior; Red Sox ≠ White Sox. `python scripts/build_web_marks.py` manifest logged. Unit tests green; renderer regression line unchanged. Stage: `web/` (incl. marks + fonts), `scripts/build_web_marks.py`, sync change, tests. Secret gate. Commit `Web app v0.2: locked design system applied — listings cards, mobile grid per Addendum v1.0, marks pipeline` + attribution. Push.

---
## STAGE 4 — Spec audit and correct (rendered verification; Playwright authorized)

1. `cd web && npm install -D playwright && npx playwright install chromium` (authorized; if install fails twice, fall back to DOM/code-level audit and say so). Start the app locally (`npm run build && npm run start` or dev).
2. Screenshot EVERY view at 390×844 (mobile, deviceScaleFactor 2) AND 1440×900 (desktop): Today (each sport section), Weeks, History, the grid view (desktop archival display AND the mobile grid component), a game detail panel (scheduled game with odds + probables, and a final if one exists). Save all to `artifacts/qa/2026-09-02/` (untracked — listed in the report for Joe's review).
3. Audit AGAINST THE SPECS — `docs/rendering-contract.md`, `docs/rendering-contract-mobile.md` (Stage 2), and the listings rules in §3.4 above. Check at minimum, view by view:
   - **Network logos:** appear ONLY for access-profile networks in listings (grey text for all); correct processed appearance per the recipe table (B1G/Prime whitened text, NBC/Peacock derived white, Paramount+/SEC/HBO Max from SVG, ESPNU raw, Apple TV solid not milky, '+' visible on ESPN+/SEC+); sizes follow manifest hf at 2/3 line-2-centered; NO white backing card behind ANY logo anywhere; rail marks fit-boxed in 69pt tiles with call letters.
   - **Grid matchup formatting (desktop + mobile):** cap endcaps with RAW logos on tint gradients; names centered, uppercase, rank before name ("@ 4 ALABAMA"), record run at 60%/82% opacity; hairlines; seam gradient; tray = kickoff · venue left, pills right with the drop order; marquee gold plate when criteria met.
   - **Mobile grid specifics:** 80% presentation; hour-only GOLD UPPERCASE shorthand labels (NOON · 1PM), no other axis labels; hard-cut seam when a ≥60-min gap exists that day; rail stays fixed while scrolling (script a horizontal scroll, re-screenshot, assert rail still at x=0); computed PX means no name wraps to a second line anywhere.
   - **List view formatting:** hug @ (not column-aligned); tier shrink before truncation; record/standing line OMITTED (not blank) where absent; MLB pitcher line present/TBA; NBA shows conference rank; Red Sox / White Sox correct; display names (LIU short, Georgia State long); odds slot favored logo + moneyline + O/U.
4. For every failure: FIX it (conformance corrections only — where the spec is ambiguous, log the question for Joe instead of inventing a rule), re-screenshot, re-verify. Two strikes per item then log-and-skip.
5. Final commit of corrections: `Spec audit corrections (Stage 4)` + attribution; push. Rev-parse pair.

## FINAL REPORT
One consolidated report: per-stage commit hashes; migration + backup counts; standings per-league counts + the Guardians row; probables samples; the FULL display-name diff list; the 30-row Sox audit; marks manifest; smoke + test counts; renderer regression line; the audit checklist with PASS/FIXED/SKIPPED per item and the judgment log; paths of all QA screenshots; anything awaiting Joe's ruling.
