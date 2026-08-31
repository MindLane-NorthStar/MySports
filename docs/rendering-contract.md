# MySports — Rendering Contract (DRAFT v1.0-rc)

**Status:** Design language locked by Joe on 2026-08-31 after nine prototype iterations (v0.1 wireframe → v1.0-rc). Remaining items before freeze are data plumbing, not design (see §9). Reference implementation: `scripts/render_day.py`. Reference render: Saturday 2026-09-05 (68 games, 62 viewer-eligible — the season's stress day).

Supersedes spec §11 wherever they conflict; spec v0.4 will fold this in.

---

## 1. Canvas

- Background: MyLife HQ dark spotlight — radial gradient centered 50% / −8%, radius 130%: `#3B3B3B 0%` → `#232323 42%` → `#1B1B1B 64%` → `#0E0E0E 100%`. (Replaces the BudgetBuddy platinum ledger gradient, evaluated and rejected: washes out team colors.)
- Time grid: 30-minute columns, `PX_PER_MIN = 3.2` (96 px per half hour). Alternating column bands `#FFFFFF @ 3.5%`; gridlines `#FFFFFF @ 10%` on the hour, `4.5%` on the half hour. Axis labels Inter 600 13px `#9aa2a8`.
- Grid start = first kickoff's hour; grid end = last kickoff + 3.5 h, rounded up to the half hour.
- Left rail: `LABEL_W = 150`. Title: Barlow Condensed 700 34px `#F2F3F4`, uppercase, "COLLEGE FOOTBALL — {WEEKDAY}, {MONTH} {D}, {YYYY}". Subtitle Inter 14px `#9aa2a8`.
- Row separators: full-width `#FFFFFF @ 24%`, 1.5px, between every network row (Joe: "soft but visible").

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
- **Tray** (inside the silhouette, below the block): 2.5px seam gradient away-color → home-color across the top; **primary** text left, Inter 700 12.5px `#F2F3F4`: `{kickoff} · {venue}`; then **streamer chips** (dark-adapted marks on `#31363D` tiles, 13px tall, "*" after rule-derived simulcasts); **secondary** text right-aligned, Inter 10px `#848C93`: crew · spread/O-U · records · weather · rivalry/trophy, auto-shrunk (min 7.5).
- **ALT tag** (simultaneous same-network game, second lane): white pill "ALT" at top-left of the block, right of the away cap.
- **Truncation:** a block ends where the next distinct kickoff on the same linear network begins (TV-guide convention); linear rows stay one lane except for genuine simultaneity.
- **Marquee ("big game") treatment:** criteria = both teams ranked (rivalry/CFP flags to be added). Gold outline + double gold glow (σ 5 @ 80%, σ 14 @ 45%) + radial sunburst ellipse behind the card (rx = w/2 + 42, ry = h/2 + 34; gold 0 → 28% @ 78% → 0).

## 4. Game card — streaming groups (ESPN+, etc.)

Same language at reduced scale: `ST_BLOCK 36` + `ST_TRAY 16` + gap 6 = `ST_H 58`. Mini caps (36 square, same gradient rule), Barlow 13.5px names (min 9), 1.5px outline @ 42%, 1.8px seam, tray = `{kickoff} · {venue}` only, Inter 700 9.5px. Full lanes, never capped — completeness wins; lanes packed first-fit by start time with fixed 3.5 h blocks (no truncation on streaming).

## 5. Eligibility and normalization (render-time inputs)

Outlet aliases and access classification per spec §8.7; simulcast derivation per §8.8 (`CBS→Paramount+`, `NBC→Peacock`, `TNT→HBO Max`, `ESPN/ABC→Disney+`); duplicate (game, service, mediaType) rows deduped; games whose only outlets are unavailable are excluded from the grid (kept in DB). `startTimeTBD` games never take a grid position (§11.2 gating rule) — see §9.

## 6. Typography

- Barlow Condensed 700 — titles, team names. Inter 400/700 — everything else. Both OFL; TTFs in `assets/fonts/`. SVG references by family name; the PNG rasterizer's host must have them installed.

## 7. Assets

- Team logos: `assets/logos/{teamId}.png` (+ `_dark` variants, currently unused), thumbnailed to 64px in memory; colors from `cfbd_2026_teams.json`. Non-FBS opponents required (48 of 186 fixture teams).
- Network marks: `assets/network-logos/{slug}.png`, 21 slugs; dark variants derived at render time.

## 8. Output

- Canonical artifact: SVG. PNG via cairosvg at scale 1.0 (≈2862×2770 for the stress day); export resolution for download is an open item (§9).

## 9. Open before freeze (data, not design)

1. Real data replacing MOCK: AP/CFP rankings, spreads + O/U (`/lines`), team records, weather, rivalry/trophy names.
2. TBD section below the grid, rendered from the Week 8 fixture (36 time-TBD games; four TBD/media states).
3. Legend block (rank source, `*` derived simulcast, ALT, gold rim, TBD states).
4. PNG export dimensions / retina factor; font embedding strategy for the web app.
5. Multi-sport generalization: per-sport block duration, NFL regional stacking, MLB density (see `docs/research/`).
