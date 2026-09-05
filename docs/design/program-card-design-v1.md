# Program Card — Design of Record v1.0 (approved by Joe, 2026-09-03)

The second card silhouette of the design language — for every non-game program (`race_session`, `fight_card`, `weekly_show`, `special_event`, `studio_show`). Extends, never reopens, the frozen game-card language: same 74px block + 28px tray geometry, same charcoal, same Barlow Condensed, same tray conventions. Baked into the "MySports TV" prototype artifact (section "Program Cards — Design of Record v1.0"); implements as **rendering-contract v1.7** via Claude Code.

## Anatomy
- **Endcap (left):** CHARCOAL rail-tile gradient (#31363D → #1E2126), carrying the program's brand mark (series/promotion/show logo), inset, fit-boxed. Never brand-colored, never white-backed.
- **Brand bar:** 3px solid brand color along the endcap's RIGHT edge.
- **Stage wash (the signature):** MIRRORED gradient — brand color at BOTH left and right edges fading to charcoal at the center; peak opacity ~55% ("strong edges", Joe's pick over ~28% soft). Card center is always charcoal, so the title always sits on maximum contrast.
- **Title:** centered, Barlow Condensed 700, white #F2F2F0 (26px design; shrink on narrow blocks per game-card conventions).
- **Subtitle:** centered beneath, Barlow Condensed, brand color tinted 70% toward white (location for studio shows, headliner for fight cards, series · venue for races).
- **Seam:** mirrored to match the wash — charcoal at center, brand color at both ends.
- **Tray:** kickoff · venue/service left (Inter 700 12.5px); hosts/crew as a muted right-aligned run (Inter, #B4BAC0) that renders ONLY when the tray width allows — never collides, never truncates mid-name.
- Rounded card rx 9, plate #23282E, white-hairline outline per contract §3.

## Brand colors
Per-program-brand constants (not computed at render time): GameDay = **Home Depot orange #F96302** (title sponsor; Joe's ruling — replaces the mark-derived red), UFC #D40707, WWE #FD2F25, NASCAR #E60029, AEW gold #F0C850, Big Noon (TBD at implementation — derive then confirm). New brands get a constant added at onboarding, mark-derived as the starting point.

## Rulings that shape it
- **UFC renders as ONE PLAIN card** — no segment dividers/labels on the block and NO CBS partial-window overlay (Joe 2026-09-03; supersedes the register Q2 segment-timeline + partial-bar rendering). `segments[]` and `broadcasts.window_start/end` remain DATA — surfaced in the tap-open detail panel, never on the card.
- Studio-show cards carry the on-site location as the subtitle ("LIVE FROM COLUMBUS, OH"); hosts in the tray crew run, sourced from announcements per the register.
- Marks: NASCAR dark variant FIXED 2026-09-03 (black letters whitened to #F5F5F5, colored bars untouched) — written to `web/public/leagues/nascar_dark.png`, **uncommitted; must ride the next Claude Code commit**. Rail conditioning rulings: Paramount+ lightened (floor 0.62); TNT derived white on charcoal.
- All-red finding: NASCAR/UFC/WWE/GameDay brand colors all cluster red — the charcoal-center design is what keeps adjacent program cards distinguishable (the mark + subtitle differentiate); AEW gold proves the non-red path.

## For the v1.7 implementation prompt
Acceptance should verify: mirrored wash symmetry (pixel-sampled), title contrast at center, the crew-fit rule, the plain UFC card (no window artifacts), GameDay at #F96302 exactly, and the fixed NASCAR mark committed. The per-program `open_ended` column vs render_policies per-sport key reconciliation is due in the same prompt (flagged in prompt 17's report).
