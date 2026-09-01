# MySports — Rendering Contract (v1.0 — FROZEN for college football)

**Status:** Design language locked by Joe on 2026-08-31 after nine prototype iterations (v0.1 wireframe → v1.0-rc). v1.0 (2026-08-31, late) closes the four data-plumbing items that were open at rc: real enrichment data, the TBD section, the legend, and PNG export. Reference implementation: `scripts/render_day.py`. Reference renders: Saturday 2026-09-05 (Week 1 — 68 games, 62 on the grid, 6 omitted: the season's stress day) and Saturday 2026-10-24 (Week 8 — 2 on the grid, 39 awaiting kickoff/network, 3 omitted: the TBD-state day).

Supersedes spec §11 wherever they conflict; spec v0.4 folds this in together with the multi-sport schema deltas (see §11). Changes to this document after v1.0 are logged in §12, not made silently.

---

## 1. Canvas

- Background: MyLife HQ dark spotlight — radial gradient centered 50% / −8%, radius 130%: `#3B3B3B 0%` → `#232323 42%` → `#1B1B1B 64%` → `#0E0E0E 100%`. (Replaces the BudgetBuddy platinum ledger gradient, evaluated and rejected: washes out team colors.)
- Time grid: 30-minute columns, `PX_PER_MIN = 3.2` (96 px per half hour). Alternating column bands `#FFFFFF @ 3.5%`; gridlines `#FFFFFF @ 10%` on the hour, `4.5%` on the half hour. Axis labels Inter 600 13px `#9aa2a8`. Column bands and gridlines stop at the bottom of the last network row — they never run under the TBD section or footer.
- Grid start = first kickoff's hour; grid end = last kickoff + 3.5 h, rounded up to the half hour. A day with no grid-placeable game still gets a page (six empty hours from noon) so the TBD section has somewhere to live.
- Canvas width = `LABEL_W + grid + PAD_X`, but never narrower than the header plus three TBD columns (`2·PAD_X + 3·320 + 2·14 + LABEL_W` = 1186 px).
- Left rail: `LABEL_W = 150`. Title: Barlow Condensed 700 34px `#F2F3F4`, uppercase, "COLLEGE FOOTBALL — {WEEKDAY}, {MONTH} {D}, {YYYY}". Subtitle Inter 14px `#9aa2a8`: `all times ET · {ranking source (wk N)} · data: CFBD fixture week N + enrichment {date} · rendered {timestamp}`. When `--mock` is in force the subtitle turns gold `#F0C850` and says so; MOCK is never the default.
- Row separators: full-width `#FFFFFF @ 24%`, 1.5px, between every network row and after the last one (Joe: "soft but visible").

## 2. Network rail

- Each network row shows its official mark, **full height**, on a faded-charcoal tile (`#31363D → #1E2126` vertical, rx 10, tile height = min(row height − 8, 96)). No white chips.
- Marks are the Wikimedia/Wikipedia PNGs fetched by `scripts/fetch_network_logos.py`, **dark-adapted in memory** by `derive_dark_mark()`: grayscale pixels (channel spread < 46) get luminance-inverted; saturated pixels keep brand color; if the mark's mean luminance is still < 80, invert HLS lightness on every pixel (hue preserved). Zero per-network tuning.
- Composite suffixes for shared wordmarks: ESPN+ → ESPN mark + "+", ESPN Unlimited → mark + "UNL", SEC Network+ → mark + "+". White text, Inter 700.
- Row order (§11.3 of spec, confirmed): ABC, CBS, FOX, NBC, The CW · ESPN, ESPN2, ESPNU, FS1, TNT, USA Network · Big Ten Network, ACC Network, SEC Network · then streaming groups (ESPN+, ESPN Unlimited, SEC Network+, Peacock, HBO Max). Rows with no eligible game are omitted.

## 3. Game card — linear rows (the "silhouette")

Geometry per lane: `BLOCK_H 74` + `TRAY_H 24` + gap 8 = `ROW_H 106`. Block width = display duration × 3.2 − 4.

- **One silhouette:** a single rounded card (rx 9, fill `#23282E`, drop shadow) holds block + tray. Outline is drawn as a **top layer** over everything: 2.5px `#FFFFFF @ 55%`; marquee games 3.5px `#F0C850 @ 100%`.
- **Team bands:** top half = away primary color, bottom half = home primary color (CFBD `color`), hairline `#FFFFFF @ 70%` between them. Ink per band by computed WCAG contrast (white vs `#101214`, whichever is higher); if neither reaches 4.0:1, darken the band ×0.82 repeatedly until white passes.
- **Endcaps:** away logo fills the full block height at the LEFT end, home logo at the RIGHT end (`CAP = 74` square). Cap background = vertical gradient of the team color tinted toward white: `tint(0.86)` top → `tint(0.58)` bottom (softened from 0.80/0.38 at Joe's request). Solid team-color caps were rejected: same-color logos vanish. Logo inset 7px; hairline separator to the band.
- **Names:** Barlow Condensed 700, uppercase, centered in the span between caps, 26px, auto-shrunk to fit (min 14). Away line: `{rank} TEAM`; home line: `@ {rank} TEAM` — the "@" always precedes the rank. Rank is the bare number (no "#").
- **Tray** (inside the silhouette, below the block): 2.5px seam gradient away-color → home-color across the top; **primary** text left, Inter 700 12.5px `#F2F3F4`: `{kickoff} · {venue}`; then **streamer chips** (dark-adapted marks on `#31363D` tiles, 13px tall, "*" after rule-derived simulcasts); **secondary** text right-aligned, Inter 10px `#848C93`, in this fixed order: `spread · O/U` → `records` → `weather` → `rivalry/trophy name`, joined by " · ", auto-shrunk (min 7.5). Any part with no data is simply absent — never a placeholder. Broadcast crews are not in the tray in v1.0 (no structured source; spec §3.8 keeps them on the official-release adapter path).
- **ALT tag** (simultaneous same-network game, second lane): white pill "ALT" at top-left of the block, right of the away cap.
- **Truncation:** a block ends where the next distinct kickoff on the same linear network begins (TV-guide convention); linear rows stay one lane except for genuine simultaneity.
- **Marquee ("big game") treatment:** criteria = both teams ranked in the authoritative poll **or** a tier-1 rivalry (§7). Gold outline + double gold glow (σ 5 @ 80%, σ 14 @ 45%) + radial sunburst ellipse behind the card (rx = w/2 + 42, ry = h/2 + 34; gold 0 → 28% @ 78% → 0). CFP-round flags join the criteria when postseason data exists.

## 4. Game card — streaming groups (ESPN+, etc.)

Same language at reduced scale: `ST_BLOCK 36` + `ST_TRAY 16` + gap 6 = `ST_H 58`. Mini caps (36 square, same gradient rule), Barlow 13.5px names (min 9) with the same rank rule, 1.5px outline @ 42%, 1.8px seam, tray = `{kickoff} · {venue}` only, Inter 700 9.5px. Full lanes, never capped — completeness wins; lanes packed first-fit by start time with fixed 3.5 h blocks (no truncation on streaming). This mini card is one shared function (`mini_card`) and is reused verbatim by the TBD section.

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
| `lines` | `/lines?year&week&seasonType` | One line per game; sportsbook preference DraftKings → ESPN Bet → Bovada → consensus → first available. Display = CFBD `formattedSpread` + ` · O/U {overUnder}`. Spec §21 amended 2026-08-31: spreads and O/U are in v1 scope. |
| `records` | `/records?year` | Season record to date, shown as `{ABBR} {W-L} · {ABBR} {W-L}` using CFBD `abbreviation`. Suppressed when both sides are 0-0 (season openers). |
| `weather` | `/games/weather?year&week&seasonType` | `{temp}°F · {condition} · Wind {mph} mph` (wind shown at ≥ 5 mph; "Indoors" replaces the outdoor parts). Endpoint may be Patreon-tier gated — a 401/403 is recorded in the report and the tray simply carries no weather. Units assumed imperial; the report prints the observed temperature range so a Celsius feed is obvious on first run. |

## 7. Rivalries

`data/rivalries.json` — curated, ~48 entries, team strings match CFBD `school` exactly. `tier 1` = national marquee (gold rim regardless of rankings: Iron Bowl, The Game, Red River, Army–Navy, …); `tier 2` = trophy game (name in the tray only: Cy-Hawk, Paul Bunyan's Axe, Wagon Wheel, …). Edit the file; the renderer reads it directly. This is the v1 form of spec §7.13 `rivalries`.

## 8. Legend (spec §11.7)

One row of glyph + label pairs, Inter 600 11px `#9aa2a8` uppercase, letter-spacing 0.3. Right-aligned in the header band (centerline y = 44) when it fits beside the title; on narrow days it flows under the subtitle from the left and wraps, pushing the grid down 24px per extra line. Items, in order:

1. Barlow "12" → `{RANKING SOURCE} · WEEK {N}` (or `RANKS: NONE LOADED` / `RANKS: MOCK`)
2. Gold-rimmed charcoal swatch with glow → `BIG GAME · BOTH RANKED OR TIER-1 RIVALRY`
3. "*" → `STREAMING SIMULCAST BY RULE`
4. White ALT pill → `SECOND GAME, SAME NETWORK, SAME SLOT`
5. Charcoal "TBA" tile → `{n} KICKOFF/NETWORK TBA · LISTED BELOW GRID` (only when the TBD section exists)
6. Charcoal tile with a diagonal slash → `{n} NOT ON YOUR SERVICES · OMITTED` (only when something was omitted)

## 9. TBD section (spec §3.6, §11.6)

Below the last network row, after a 30px gap. Title Barlow 700 22px `KICKOFF OR NETWORK TBA — {n} GAMES`; caption Inter 12px muted explaining that the date is confirmed and a game moves onto the grid the day it is assigned. Three groups in fixed order, each with an Inter 600 11.5px uppercase label + count and a hairline rule:

1. `KICKOFF SET · NETWORK TBA` — tray text `{kickoff} · TV TBA`, sorted by kickoff.
2. `NETWORK SET · KICKOFF TBA` — tray text `KICKOFF TBA · {outlet(s)}` with ` (not carried)` appended when every listed outlet is unavailable to the viewer.
3. `KICKOFF AND NETWORK TBA` — tray text `KICKOFF AND TV TBA`.

Groups 2–3 sort by home conference, then home team (assignments are announced per conference, so the eye finds them that way). Cards are the §4 mini card at a fixed 320 × 52, 14px gutters, columns = floor((W − 2·PAD_X + 14) / 334), row pitch 62. Rank numbers appear in the names when a ranking snapshot exists; the tray's right slot carries the rivalry name, else the spread if one exists. The empty grid is never faked: a TBD game has no grid geometry at all.

## 10. Footer

One Inter 11px `#848C93` line under everything: `{n} games on the grid · {n} awaiting kickoff/network · {n} not on your services and omitted ({outlets}) · kept in the database; nothing is deleted`. The omitted clause is the only place the viewer learns a game exists that the grid will never show — it must not be dropped.

## 11. Typography, assets, output

- Barlow Condensed 700 — titles, team names. Inter 400/600/700 — everything else. Both OFL; TTFs in `assets/fonts/`. SVG references by family name; the PNG rasterizer's host must have them installed (Windows: install the five TTFs; cairosvg required).
- Team logos: `assets/logos/{teamId}.png` (+ `_dark` variants, currently unused), thumbnailed to 64px in memory; colors and abbreviations from `cfbd_2026_teams.json`. Non-FBS opponents required (48 of 186 fixture teams).
- Network marks: `assets/network-logos/{slug}.png`, 21 slugs; dark variants derived at render time.
- **Output:** canonical artifact is the SVG (`artifacts/rendering/grid_{date}.svg`, all raster assets embedded as data URIs, so it is self-contained). `--png` rasterizes a proof at `--scale` (default 1.0; 2862 × 2796 for the Week 1 stress day). `--export` rasterizes the **download PNG at `EXPORT_SCALE = 2.0`** to `grid_{date}@2x.png` (≈ 5724 × 5592 for the stress day) — a fixed device-pixel ratio rather than a fixed width, so every day's export has identical stroke weights and type sizes on a retina display. Web-app font embedding stays an app-layer concern (self-hosted `@font-face` from `assets/fonts/`); the SVG contract does not embed fonts.
- CLI: `--week N` sets the fixture, raw-games, and enrichment paths in one flag; each can still be overridden.

## 12. Change log

- **v1.0 (2026-08-31):** enrichment inputs (§6) replace MOCK; `--mock` becomes opt-in; rivalry seed (§7); legend (§8); TBD section (§9); footer (§10); export at @2x (§11); eligibility buckets made explicit (§5); tray secondary order fixed; marquee criteria extended to tier-1 rivalries. Multi-sport generalization (per-sport block duration, NFL regional stacking, MLB density, `viewing_day_cutover`) is deliberately **not** in this contract — it is a per-sport render policy in the schema deltas (`docs/research/`), and this document is the CFB instance of it.
- **v1.0-rc (2026-08-31):** design locked; data plumbing open.
