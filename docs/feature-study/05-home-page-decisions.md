# 05 — Home Page Decision Board: Rulings

**Decided:** 2026-09-03, Cowork decision session with Joe. **Status:** BINDING. Supersedes `04-home-page-memo.md` §7 wherever the two differ, and supersedes two of that memo's recommendations outright (§3 below). **Companions:** `04-home-page-memo.md` (the options), `03-enhancement-specs.md` (E1–E6), `mockups/home-page-candidates.html` (published as artifact `9a01648a-…`), desktop composition board (artifact `f7d0b1fb-…`).

---

## 1. Rulings

| ID | Decision | Ruling |
|----|----------|--------|
| **D1** | Home-page family | **Option E — time-adaptive hybrid.** Today's `/` with a first band that changes with the clock. Reopens no lock; reuses the locked listings card; degrades to Option A when the clock is unknown. |
| **D1b** | Band states | **Three, as specced.** `Tonight` (before the window) → `On now / Next up` (inside the window) → `Finals · Tomorrow` (after the last final). No "starting soon" fourth state. The band header must always state the viewing day and the clock it used, and always offer "See all today". |
| **D2** | Prime window | **Per sport-day.** `prime_window_start` per sport: NFL 13:00, CFB 12:00, all others 18:00 (local ET). The day's window opens at the earliest start among sports that actually have games that day; it closes at the last program end. Rejected the memo's global 18:00 default — it is wrong for the whole first half of a CFB Saturday and an NFL Sunday, the two days the app matters most. |
| **D3** | Live-state cadence | **Window-gated 15-minute poll on GitHub Actions now, plus an egress probe.** Ship the poll gated to the D2 window (≈900–1,750 of 2,000 free minutes/month). Add one probe stage to the deploy prompt: fetch a known-good ESPN endpoint from Vercel and from a Supabase edge function, report status codes. If 200 → v1.1 upgrades to refresh-on-open with the Actions poll dropped to a 30-minute backstop. If 403 → keep the poll unchanged. **This also closes the refresh-economics item on the handoff list.** |
| **D4** | Off-service games on listings | **Filtered by default, with a count line and a "show all" toggle.** Count line is non-negotiable and reads e.g. `62 games · 8 not on your services · ACC Network, NFL+`. Applies to **every** listing surface — the time-aware band, the sport bands, Weeks, and History — not the home page alone. |
| **D5** | Desktop composition | **Band left / grid right at ≥1,600 px; band above / grid below beneath that.** Never grid-first — that arrangement puts the time-aware band below the fold on a laptop and cancels the D1 decision. |
| **D6** | Favorites placement | **Favorites float to the top of their own sport band.** No separate pin band, no duplicated card. See §2 — the scope of this changed at decision time. |

## 2. D6 as actually decided — favorites, not a local pin

Joe's stated list is thirteen teams across five sports, so this is **not** the market-inferred Cleveland pin the memo described. It is a favorites setting, and it is filed as a stated fact rather than an inference.

| Sport | Teams |
|---|---|
| NFL | Cleveland Browns · Carolina Panthers |
| MLB | Cleveland Guardians |
| NBA | Cleveland Cavaliers |
| NHL | Columbus Blue Jackets · Vegas Golden Knights · Pittsburgh Penguins |
| CFB | Ohio State · LSU · Ole Miss · Tennessee · Ohio (Bobcats) · Fresno State |

**Cowork judgment calls made at decision time (Joe may veto either):**

1. **Ordering.** Floated rows keep chronological order among themselves; the remainder of the band keeps chronological order below them. The band never stops reading as a timeline.
2. **Marker.** The floated group is separated by a hairline rule with a faint uppercase `YOUR TEAMS` micro-label. Without it, six floated CFB cards on a Saturday read as a broken sort. **The marker lives at band level, not on the card** — deliberately, so the locked card contract (v1.6.4 + Mobile Grid Addendum v1.0) is not reopened.

**Implementation traps:**

- **"Ohio" is Ohio University (Bobcats, MAC) — a different school from Ohio State.** A name-based resolver will collapse the two. Resolve by CFBD team id and assert both rows exist and differ.
- "Tennessee" = Tennessee Volunteers (CFB), not the Titans.
- Team ids follow the existing convention: `nfl-{espnId}`, `mlb-{id}`, `nba-{TRICODE}`, `nhl-{nhlId}`, CFB keeps CFBD ints. The favorites file stores **ids**, resolved once from names with the resolution table printed in the run report for Joe to verify.
- The list is a **setting**, editable without a code change. It does not belong in the renderer.

## 3. Corrections to the memo (do not re-inherit the old numbers)

1. **D5 threshold: 1,200 px is wrong; use 1,600 px.** The grid draws at ~1,400 px natural width, and the Mobile Grid Addendum's floor analysis put network call letters below the legibility floor under 80% scale — a 1,120 px minimum grid column. With a 400 px band, a 24 px gap and 48 px page padding: `1,120 + 400 + 24 + 48 = 1,592 px`. At the memo's 1,200 px, the grid gets a ~730 px column and renders at 52% scale.
2. **D2: the memo's recommended global 18:00 window is rejected**, for the reason in the table above. The per-sport row is the honest one and was chosen with its maintenance cost named: every new sport added under v0.5 needs a `prime_window_start` row.

## 4. What this obligates

**Build regardless (from memo §5), now confirmed in scope:**

- **E1** card state model (pre / in / post with score and clock) — D1 and D3 both depend on it.
- **E3** access glyph + off-services count — D4 is E3 applied to every listing surface.
- **E4** "data as of" on listings.
- **Grid "now" marker** — vertical hairline at the current time, gold at 40%. This is a **rendering-contract v1.7** entry, not a web-app change.
- **`data/render_policies.json` gains `prime_window_start` per sport.** This is the same file the v1.7 `open_ended` vs per-sport-key reconciliation touches — **land both in the same change** or the file gets two competing shapes.

**New data files:**

- `data/favorites.json` (or an equivalent settings row) — the §2 list, ids not names.
- `prime_window_start` per sport in `data/render_policies.json`.

**Deploy prompt gains one stage:** the D3 egress probe (Vercel + Supabase edge → ESPN, status codes reported, no behavior change either way).

**Sequencing.** The home page is a **web-app** change and does not need to wait for rendering-contract v1.7; the grid now-marker is the only piece that does. E1 is the shared dependency and should land first.

## 5. Open after this board

- The D3 probe result — decides whether v1.1 moves to refresh-on-open.
- **E5 market-pending state for regional NFL windows is still unruled and is due before Sunday September 13.** It is not part of this board.
- E2/E6 derivation and the §11.9 renderer "Tonight summary line" are the same calculation. **Build it once in the web app and have v1.7 import it**, or the two drift within a month.
- Whether the `YOUR TEAMS` micro-label survives Joe seeing it rendered.
