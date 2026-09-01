# MySports — Rendering Contract (v1.4 — college football)

**Status:** Design language locked by Joe on 2026-08-31 after nine prototype iterations (v0.1 wireframe → v1.0-rc). v1.0 (2026-08-31, late) closed the four data-plumbing items open at rc: real enrichment data, the TBD section, the legend, and PNG export. **v1.1 (2026-08-31, night)** is the first visual revision after the freeze, decided by Joe from rendered option boards (silhouette A/B/C, tray 0–3, marquee 0–3): local-affiliate call letters and a new broadcast order in the rail, records moved into the name line, a fixed-size tray with weather removed, and the gold-plate marquee. **v1.2 (same night)** adds Joe's four legibility tweaks: axis labels only where games begin or end, lighter tray text, brightened streamer chips, and the week number in the title. **v1.3 (2026-08-31, late night)** is the card-unification and tray revision: every game renders at full size (streaming rows and the TBD section included), the tray becomes the pills design with vector streamer wordmarks, and the tray grows to 28px. Every change since the freeze is logged in §12. Reference implementation: `scripts/render_day.py`. Reference renders: Saturday 2026-09-05 (Week 1 — 68 games, 62 on the grid, 6 omitted: the season's stress day) and Saturday 2026-10-24 (Week 8 — 2 on the grid, 39 awaiting kickoff/network, 3 omitted: the TBD-state day).

Supersedes spec §11 wherever they conflict; spec v0.4 folds this in together with the multi-sport schema deltas (see §11). Changes to this document after v1.0 are logged in §12, not made silently.

---

## 1. Canvas

- Background: MyLife HQ dark spotlight — radial gradient centered 50% / −8%, radius 130%: `#3B3B3B 0%` → `#232323 42%` → `#1B1B1B 64%` → `#0E0E0E 100%`. (Replaces the BudgetBuddy platinum ledger gradient, evaluated and rejected: washes out team colors.)
- Time grid: 30-minute columns, `PX_PER_MIN = 3.2` (96 px per half hour). Alternating column bands `#FFFFFF @ 3.5%`; gridlines `#FFFFFF @ 10%` on the hour, `4.5%` on the half hour. **Axis labels (v1.2): only at minutes where a block begins or ends** — kickoffs and block ends, never every half hour — Inter 700 14px `#E8EAEC`, `h:mm AM/PM`, with a brighter gridline (`#FFFFFF @ 16%`) under each label; faint half-hour lines remain for rhythm. When two labels would overlap (closer than the label width + 10px) the later one moves to a second line 16px above (v1.4 staggering; the header grows 16px on such days); a kickoff still displaces a block-end label when both lines are taken. Column bands and gridlines stop at the bottom of the last network row — they never run under the TBD section or footer.
- Grid start = first kickoff's hour; grid end = last kickoff + 3.5 h, rounded up to the half hour. A day with no grid-placeable game still gets a page (six empty hours from noon) so the TBD section has somewhere to live.
- Canvas width = `LABEL_W + grid + PAD_X`, but never narrower than two full-size TBD columns (`2·PAD_X + 2·668 + 14` = 1398 px).
- Left rail: `LABEL_W = 150`. Title: Barlow Condensed 700 34px `#F2F3F4`, uppercase, **"COLLEGE FOOTBALL WEEK {N} — {WEEKDAY}, {MONTH} {D}, {YYYY}"** (v1.2). `N` is the CFBD week, except that when the week's calendar window holds two Saturdays (CFBD week 1: Aug 29 – Sep 7, 2026) the first weekend is labeled **Week 0**, matching common usage. Subtitle Inter 14px `#9aa2a8`: `all times ET · {ranking source (wk N)} · data: CFBD fixture week N + enrichment {date} · rendered {timestamp}`. When `--mock` is in force the subtitle turns gold `#F0C850` and says so; MOCK is never the default.
- Row separators: full-width `#FFFFFF @ 24%`, 1.5px, between every network row and after the last one (Joe: "soft but visible").

## 2. Network rail

- Each network row shows its official mark, **full height**, on a faded-charcoal tile (`#31363D → #1E2126` vertical, rx 10, tile height = min(row height − 6, 100), centered on the first lane). No white chips.
- **Local affiliates (v1.1):** broadcast-network rows carry the viewer's over-the-air station above the mark — `{CALL LETTERS} {CHANNEL}` (e.g., `WKYC 3`), Inter 700 10px `#C9CED3`, letter-spacing 1.4, centered in a 13px band at the top of the tile; the mark centers in the remaining space. Wide marks (FOX, CBS, CW, all cable/conference) keep their v1.0 size; square marks (NBC, abc) lose ≈6% height. Stations are data (`data/row_order.json`), not code.
- Marks are the Wikimedia/Wikipedia PNGs fetched by `scripts/fetch_network_logos.py`, **dark-adapted in memory** by `derive_dark_mark()`: grayscale pixels (channel spread < 46) get luminance-inverted; saturated pixels keep brand color; if the mark's mean luminance is still < 80, invert HLS lightness on every pixel (hue preserved). Zero per-network tuning.
- Composite suffixes for shared wordmarks: ESPN+ → ESPN mark + "+", ESPN Unlimited → mark + "UNL", SEC Network+ → mark + "+". White text, Inter 700.
- **Row order (v1.1, Joe 2026-08-31 — supersedes spec §11.3):** read from `data/row_order.json` (keyed by sport; `cfb` today). Broadcast in Cleveland dial order: **NBC (WKYC 3), ABC (WEWS 5), FOX (WJW 8), CBS (WOIO 19), The CW (WBNX 55)** · cable: ESPN, ESPN2, ESPNU, FS1, TNT, USA Network · conference: Big Ten Network, ACC Network, SEC Network · streaming groups: ESPN+, ESPN Unlimited, SEC Network+, Peacock, HBO Max. Rows with no eligible game are omitted. Reordering is a JSON edit, never a code change.

## 3. Game card — linear rows (the "silhouette")

Geometry per lane: `BLOCK_H 74` + `TRAY_H 28` + gap 8 = `ROW_H 110` (v1.3; was 24/106). Block width = display duration × 3.2 − 4. **One card for every game** — linear rows, streaming rows and the TBD section all draw this card via `draw_card()`; the §4 mini card is retired.

- **One silhouette:** a single rounded card (rx 9, fill `#23282E`, drop shadow) holds block + tray. Outline is drawn as a **top layer** over everything: 2.5px `#FFFFFF @ 55%`; marquee games 3.5px `#F0C850 @ 100%`. (v1.1: silhouette option A re-confirmed by Joe over a bezel and a quiet-rim variant; both remain selectable via `--style silhouette=` for comparison only.)
- **Team bands:** top half = away primary color, bottom half = home primary color (CFBD `color`), hairline `#FFFFFF @ 70%` between them. Ink per band by computed WCAG contrast (white vs `#101214`, whichever is higher); if neither reaches 4.0:1, darken the band ×0.82 repeatedly until white passes.
- **Endcaps:** away logo fills the full block height at the LEFT end, home logo at the RIGHT end (`CAP = 74` square). Cap background = vertical gradient of the team color tinted toward white: `tint(0.86)` top → `tint(0.58)` bottom (softened from 0.80/0.38 at Joe's request). Solid team-color caps were rejected: same-color logos vanish. Logo inset 7px; hairline separator to the band.
- **Names:** Barlow Condensed 700, uppercase, 26px, centered as a group in the span between caps. Away line: `{rank} TEAM`; home line: `@ {rank} TEAM` — the "@" always precedes the rank. Rank is the bare number (no "#").
- **Record run (v1.1):** the team's record follows the name on the same baseline as a secondary run at 60% size and 82% ink opacity: `25 BAYLOR (1-0)`; when both teams share a conference it becomes `(4-1, 2-0 BIG 12)` using the abbreviation map (AAC, CUSA, MAC, MW, SBC; power conferences as named). Suppressed until the team has played (never `(0-0)`). Fit order when the span is narrow: shrink the whole line to 18px to keep the record → drop the record → shrink the name alone (min 14). Records left the tray for this line.
- **Tray** (inside the silhouette, below the block) — **v1.3 "pills" design.** 2.5px seam gradient away-color → home-color across the top; all tray content is centered on the line below the seam (`ty + 2.5 + (28 − 2.5)/2`) so nothing touches it. Left: **primary** text, Inter 700 12.5px `#F2F3F4`: `{kickoff} · {venue}` (TBD cards: the state text instead of the kickoff). Right, reading inward from the right edge: **streamer chip(s)** → **spread pill** → **O/U pill** → **rivalry pill**. Pills are 19px tall, rx 3.5, fill `#2E333A` with a 16% white hairline (`#4A4020` on a marquee plate), text Inter 600 11px `#B4BAC0`; the rivalry pill is gold on `#3A3218` (`#F0C850` text and stroke). The spread pill leads with the **favorite's logo on a 16px team-tinted disc** (the endcap gradient, `tint(0.86)` → `tint(0.58)`) followed by the bare number (`-27.5`) — the school name is gone from the tray because the logo carries it. Pills drop right-to-left by priority (spread, O/U, rivalry) when the card is too narrow; nothing ever shrinks. Weather is not shown (v1.2). Records live in the name line (v1.1).
- **Streamer chips:** 16px-tall marks on 21px `#31363D` tiles (chip background A, confirmed over no-tile and light-tile variants), right-most in the tray, "*" after rule-derived simulcasts. **Marks are vector wordmarks** (`assets/network-logos/{slug}.svg`, horizontal lockups from Wikimedia Commons: HBO Max May-2025 horizontal, Paramount+ script wordmark, Peacock 2026, ESPN+, Disney+ 2024 — the last has no horizontal form and stays the weakest chip by design) nested inline as `<svg>` elements, never as `<image>` data URIs (cairosvg renders some of those blank). Recolor rule applied to the SVG source text: grayscale hex → luminance-inverted; saturated hex → HLS lightness raised to ≥ 0.80, hue kept; fill-less paths get `#E8EAEC`; ids are prefixed per slug so marks can repeat in one document. PNG marks remain the fallback via `derive_chip_mark`.
- **ALT tag** (simultaneous same-network game, second lane): white pill "ALT" at top-left of the block, right of the away cap.
- **Truncation:** a block ends where the next distinct kickoff on the same linear network begins (TV-guide convention); linear rows stay one lane except for genuine simultaneity.
- **Marquee treatment (v1.1 — "gold plate"):** criteria unchanged = both teams ranked in the authoritative poll **or** a tier-1 rivalry (§7); CFP-round flags join when postseason data exists. Treatment lives entirely inside the card: plate fill `#3A3218` (instead of `#23282E`), tray seam solid gold, secondary tray text `#F0C850`, 3.5px `#F0C850` rim with a single σ5 gold glow, and a gold `MARQUEE` pill (64 × 16, Inter 700 9.5px `#2A2410`, letter-spacing 0.6) beside the away cap — after the ALT pill when both are present. **The v1.0 sunburst ellipse and σ14 outer glow are retired:** they bled ≈34px into adjacent rows and read as a smear at 1×. The retired variants (`sunburst`, `halo`, `tag`) remain selectable via `--style marquee=` for comparison only.

## 4. Streaming rows and the TBD section (same card)

**v1.3 (Joe, 2026-08-31): every game renders at the same size.** Streaming groups (ESPN+, ESPN Unlimited, SEC Network+, Peacock, HBO Max) use the §3 card in full — full lanes, never capped, packed first-fit by start time with fixed 3.5-hour blocks (no truncation, no ALT marking); completeness wins over height (the stress day's ESPN+ row is 16 lanes). The TBD section (§9) uses the same card at exactly one block width (`210 × 3.2 − 4 = 668px`), so a TBD card is a grid card without a grid position. The v1.0 half-scale mini card (`ST_BLOCK 36`) is retired; a smaller card for a future mobile view would be a new contract item, not a revival.

## 5. Eligibility and normalization (render-time inputs)

Outlet aliases and access classification per spec §8.7; simulcast derivation per §8.8 (`CBS→Paramount+`, `NBC→Peacock`, `TNT→HBO Max`, `ESPN/ABC→Disney+`); duplicate (game, service, mediaType) rows deduped. Every game on the date lands in exactly one of four buckets, evaluated in this order:

1. `startTimeTBD = true` → **TBD section**, state `time_tbd` (a network is known) or `time_and_network_tbd` (no media row). §11.2 gating: the midnight placeholder never touches the grid, whatever the media rows say.
2. kickoff known, no media row at all → **TBD section**, state `network_tbd`.
3. kickoff known, media rows exist, but every outlet is in the viewer's UNAVAILABLE set → **omitted** from the page (kept in the DB), counted in the legend and footer with the outlet names.
4. otherwise → **grid**, on its primary row (first ROW_ORDER linear outlet, else first available streaming outlet).

## 6. Enrichment inputs (replaces every MOCK)

`scripts/probe_enrichment.py --week N` writes `artifacts/validation/cfbd_2026_week{N}_enrichment.json` (plus a report) from four CFBD endpoints; the renderer reads it when present and renders honestly without it (no ranks, no lines — and the subtitle/legend say "none loaded"). Every block is optional.

| Block | Endpoint | Rule |
|---|---|---|
| `ranking` | `/rankings?year&week&seasonType` | Spec §3.7: use **Playoff Committee Rankings** if that poll exists for the week, else **AP Top 25**. Never the Coaches Poll. Lookup by `teamId` first, `school` second. Source and poll week are stamped in the subtitle and legend. |
| `lines` | `/lines?year&week&seasonType` | One line per game; sportsbook preference DraftKings (CFBD emits both `DraftKings` and `Draft Kings`) → ESPN Bet → Bovada → consensus → first available. Display = CFBD `formattedSpread` + ` · O/U {overUnder}`. Spec §21 amended 2026-08-31: spreads and O/U are in v1 scope. |
| `records` | `/records?year` | Overall (`total`) and conference (`conferenceGames`) records to date plus the team's conference name. Rendered in the **name line** (§3 record run), never in the tray. Suppressed for a team at 0-0. |
| `weather` | `/games/weather?year&week&seasonType` | `{temp}°F · {condition} · Wind {mph} mph` (wind shown at ≥ 5 mph; "Indoors" replaces the outdoor parts). **Captured but not rendered on the day grid** (v1.1); available to the web app. First live run 2026-08-31: HTTP 200, 384 rows for Week 1, temperatures 56.5–105.8 → Fahrenheit confirmed. |

## 7. Rivalries

`data/rivalries.json` — curated, ~48 entries, team strings match CFBD `school` exactly. `tier 1` = national marquee (gold rim regardless of rankings: Iron Bowl, The Game, Red River, Army–Navy, …); `tier 2` = trophy game (name in the tray only: Cy-Hawk, Paul Bunyan's Axe, Wagon Wheel, …). Edit the file; the renderer reads it directly. This is the v1 form of spec §7.13 `rivalries`.

## 8. Legend (spec §11.7)

One row of glyph + label pairs, Inter 600 11px `#9aa2a8` uppercase, letter-spacing 0.3. Right-aligned in the header band (centerline y = 44) when it fits beside the title; on narrow days it flows under the subtitle from the left and wraps, pushing the grid down 24px per extra line. Items, in order:

1. Barlow "12" → `{RANKING SOURCE} · WEEK {N}` (or `RANKS: NONE LOADED` / `RANKS: MOCK`)
2. Gold-rimmed dark-gold swatch → `MARQUEE · BOTH RANKED OR TIER-1 RIVALRY`
3. "*" → `STREAMING SIMULCAST BY RULE`
4. White ALT pill → `SECOND GAME, SAME NETWORK, SAME SLOT`
5. Charcoal "TBA" tile → `{n} KICKOFF/NETWORK TBA · LISTED BELOW GRID` (only when the TBD section exists)
6. Charcoal tile with a diagonal slash → `{n} NOT ON YOUR SERVICES · OMITTED` (only when something was omitted)

## 9. TBD section (spec §3.6, §11.6)

Below the last network row, after a 30px gap. Title Barlow 700 22px `KICKOFF OR NETWORK TBA — {n} GAMES`; caption Inter 12px muted explaining that the date is confirmed and a game moves onto the grid the day it is assigned. Three groups in fixed order, each with an Inter 600 11.5px uppercase label + count and a hairline rule:

1. `KICKOFF SET · NETWORK TBA` — tray text `{kickoff} · TV TBA`, sorted by kickoff.
2. `NETWORK SET · KICKOFF TBA` — tray text `KICKOFF TBA · {outlet(s)}` with ` (not carried)` appended when every listed outlet is unavailable to the viewer.
3. `KICKOFF AND NETWORK TBA` — tray text `KICKOFF AND TV TBA`.

Groups 2–3 sort by home conference, then home team (assignments are announced per conference, so the eye finds them that way). Cards are the §3 card at 668 × 102 (one 3.5-hour block), 14px gutters, columns = floor((W − 2·PAD_X + 14) / 682), row pitch = `ROW_H`; the page is never narrower than two columns. Rank numbers and record runs appear when data exists; the tray carries the same pills as a grid card. The empty grid is never faked: a TBD game has no grid geometry at all.

## 10. Footer

**v1.4 status bar** under everything, 34px: pills in the tray's language — `{n} ON THE GRID` (white), `{n} KICKOFF / NETWORK TBA` (TBA tile glyph, when any), `{n} NOT ON YOUR SERVICES · {outlets}` (slash glyph, muted, when any) — followed by muted 10.5px text: `every game is kept in the database — nothing is deleted · {data provenance}`. The omitted pill is the only place the viewer learns a game exists that the grid will never show — it must not be dropped. Spec v0.4 replaces it for the pro leagues with the "Around the League" strip (decision 3).

## 11. Typography, assets, output

- Barlow Condensed 700 — titles, team names. Inter 400/600/700 — everything else. Both OFL; TTFs in `assets/fonts/`. SVG references by family name; the PNG rasterizer's host must have them installed (Windows: install the five TTFs; cairosvg required).
- Team logos: `assets/logos/{teamId}.png` (+ `_dark` variants, currently unused), thumbnailed to 64px in memory; colors and abbreviations from `cfbd_2026_teams.json`. Non-FBS opponents required (48 of 186 fixture teams).
- Network marks: `assets/network-logos/{slug}.png`, 21 slugs (rail); dark variants derived at render time. Tray chips prefer `assets/network-logos/{slug}.svg` when present (five today). Rail rows listed in `RAIL_SVG` (v1.4: `sec-network`, the 2024 lockup) nest their SVG as designed, without recolor. `scripts/fetch_network_logos.py` v3 downloads all six; `--force-svg` refreshes.
- **Output:** canonical artifact is the SVG (`artifacts/rendering/grid_{date}.svg`, all raster assets embedded as data URIs, so it is self-contained). `--png` rasterizes a proof at `--scale` (default 1.0; 2862 × 2796 for the Week 1 stress day). `--export` rasterizes the **download PNG at `EXPORT_SCALE = 2.0`** to `grid_{date}@2x.png` (≈ 5724 × 5592 for the stress day) — a fixed device-pixel ratio rather than a fixed width, so every day's export has identical stroke weights and type sizes on a retina display. Web-app font embedding stays an app-layer concern (self-hosted `@font-face` from `assets/fonts/`); the SVG contract does not embed fonts.
- CLI: `--week N` sets the fixture, raw-games, and enrichment paths in one flag; each can still be overridden. `--style key=value` (repeatable) switches design variants for comparison boards: `silhouette=outline|bezel|quiet`, `tray=pills|single|cells|chipsright`, `marquee=plate|tag|halo|sunburst`, `weather=on|off`, `records=name|tray`, `chipbg=tile|none|light`, `favlogo=disc|plain|invert`, `trayh=28|24`. The v1.3 defaults are `outline / pills / plate / off / name / tile / disc / 28`; anything else is a comparison, not the contract.
- Text measurement uses the repo TTFs through PIL when present (`assets/fonts/`), so fit decisions are exact; it falls back to per-glyph heuristics if the fonts are missing.

## 12. Change log

- **v1.4 (2026-09-01, after midnight — the leftovers):** (a) axis-label staggering onto a second line (§1); (b) SEC Network 2024 vector lockup in the rail via `RAIL_SVG` (§11); (c) footer becomes a status bar of pills (§10); (d) `.gitattributes` pins LF for text files (repo hygiene, not rendering).

- **v1.3 (2026-08-31, late night — Joe's picks from three more boards):** (a) One card for every game: streaming rows and TBD cards at full size (§3, §4, §9); page min width 1398. (b) Tray = pills: favorite-logo-on-disc spread pill, O/U pill, gold rivalry pill, chips right-most (§3). (c) Vector streamer wordmarks nested inline, text-level recolor rule, HBO Max/Paramount+/Peacock/ESPN+/Disney+ (§3, §11; fetch script v3). (d) Tray 24 → 28px, `ROW_H` 106 → 110; content centered below the seam after Joe flagged chips crowding it (§3). (e) Chip background A and favorite-logo disc B confirmed over alternatives; lightness inversion rejected for team logos.

> **History note (2026-08-31):** the v1.1 → v1.2 changes are split across three commits whose messages understate or overstate their diffs — `318c831` ("Design v1.1") already contains the v1.2 renderer and contract text, `491b6dc` carries the Windows-portable time formatting, and `9862fce` ("Design v1.2") contains only the probe's UTF-8 console fix. Cause: Cowork wrote files to the repo while a Claude Code prompt was still staging. The tree is correct at every step; the history simply does not bisect on "when did v1.2 land." Recorded here rather than rewriting pushed history. Rule adopted: Cowork does not write to the repo while a Claude Code prompt is in flight.

- **v1.2 (2026-08-31, night):** (a) Time axis labels only at block starts/ends, Inter 700 14px `#E8EAEC`, collision rule (§1). (b) Title carries the week number; Week 0 rule for the two-Saturday opening window (§1). (c) Tray secondary text `#848C93` → `#B4BAC0`, weight 600 (§3). (d) Streamer chips: `derive_chip_mark` lightness floor 0.80, chip mark 14px (§3).

- **v1.1 (2026-08-31, night — Joe's picks from rendered option boards):** (a) Rail: broadcast rows reordered to Cleveland dial order NBC · ABC · FOX · CBS · CW with local call letters above each mark (§2); row order and stations moved to `data/row_order.json`. (b) Records moved from the tray into the name line as a 60% secondary run, conference record only for conference games, suppressed at 0-0 (§3). (c) Tray secondary text fixed at 10px with priority dropping instead of shrinking; weather removed from the tray after measurement (§3, §6). (d) Marquee: sunburst + σ14 glow retired for the gold plate + MARQUEE tag (§3); legend item relabeled (§8). (e) Silhouette A re-confirmed over bezel/quiet-rim variants. (f) Probe: conference records captured; `Draft Kings` provider alias. (g) Exact text measurement via the repo fonts (§11).

- **v1.0 (2026-08-31):** enrichment inputs (§6) replace MOCK; `--mock` becomes opt-in; rivalry seed (§7); legend (§8); TBD section (§9); footer (§10); export at @2x (§11); eligibility buckets made explicit (§5); tray secondary order fixed; marquee criteria extended to tier-1 rivalries. Multi-sport generalization (per-sport block duration, NFL regional stacking, MLB density, `viewing_day_cutover`) is deliberately **not** in this contract — it is a per-sport render policy in the schema deltas (`docs/research/`), and this document is the CFB instance of it.
- **v1.0-rc (2026-08-31):** design locked; data plumbing open.
