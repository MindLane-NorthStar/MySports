# MySports — Multi-Sport Plan and Schema Deltas for Spec v0.4 (DRAFT)

**Written:** 2026-08-31 (evening), immediately after the Tier 1 checks in `research/research-changelog.md`.
**Inputs:** `research/research-summary.md` §1–§5, the four league docs, the Tier 1 fetch results, and `rendering-contract.md` v1.0.
**Status:** all six decisions in §4 are made (Joe, 2026-08-31). This document is now the input to spec v0.4; nothing here is in the spec until v0.4 is cut.

---

## 1. What the Tier 1 checks changed

| Check | Outcome | What it decides |
|---|---|---|
| MLB Stats API | **Open**, `hydrate=broadcasts(all)` works, Guardians.TV is a broadcast row | MLB gets a native media adapter; ESPN is fallback only. MLB's "binary risk" is gone. |
| NBA CDN schedule file | **Loads** (needs a same-site Referer), full `broadcasters` block, 1,273 games | NBA adapter reads the league file directly; ESPN fills odds/colors. |
| NHL API | **Up.** Schedule + `tvBroadcasts` work; `postal-lookup` is a ZIP → team-territory map; `where-to-watch` does not exist at any tried path | NHL adapter reads `api-web.nhle.com`; territory (blackout) side of `market_coverage` comes free; carriage side does not. |
| Cavaliers carrier | Unannounced; DAZN reported (SBJ, Jul 29) | `TBA` distributor state is required, not optional. |
| Blue Jackets carrier | Unannounced; TV/radio simulcast confirmed; opener **Oct 1** | Same. NHL is the first league that will render with a `TBA` local row. |
| **Unplanned finding** | NBA and NHL league files carry **no local TV rows for almost any team** in August | Local carriage must be ingested as *late-binding* with a first-seen date. Empty ≠ none. |

The finding in the last row is the important one. It means the "carrier problem" in `research-summary.md` §2 is partly a **timing** problem for every team, and only a **rights** problem for Cleveland and Columbus. The schema below treats those as two different states.

## 2. Per-league data backbone (recommended)

One primary adapter per league for schedule + media, ESPN's unofficial API as the shared enrichment layer (odds, colors, light/dark logos, `isTBDFlex`), and official press pages as the authority for crews and disputes — the same three-layer shape the CFB spec already has.

| League | Schedule + media primary | Enrichment | Authority for local carriage | Notes |
|---|---|---|---|---|
| **CFB** | CFBD (`/games`, `/games/media`) | CFBD (`/rankings`, `/lines`, `/records`, `/games/weather`) — live as of Phase 3B | Conference/network press pages (spec §9) | Unchanged. |
| **NFL** | ESPN scoreboard/schedule API | ESPN (odds, `isTBDFlex`) | 506sports map images → hand-entered `market_coverage` for **Cleveland only** (market-of-one) | Only league with no structured local source. |
| **NHL** | `api-web.nhle.com/v1/schedule/{date}` + `club-schedule-season` | ESPN (odds) | `postal-lookup/{zip}` for territory; team/league press for carrier | Frozen Frenzy encoded natively → build `whip_around` here first. |
| **NBA** | `cdn.nba.com …/scheduleLeagueV2.json` (fetch with `Referer: https://www.nba.com/schedule`) | ESPN (odds) | League file's `homeTvBroadcasters` once populated; team press until then | Watch for the fill date; `TBD` national rows (66) are NBA TV/late windows. |
| **MLB** | `statsapi.mlb.com/api/v1/schedule?…&hydrate=broadcasts(all)` | ESPN (odds); Stats API for weather/probables later | The `broadcasts` rows themselves (`homeAway`, `mvpdAuthRequired`, `freeGame`) | Best media data of the five. Labor risk unchanged. |

**Build order — recommendation unchanged from the research: NFL → NHL → NBA → MLB**, with one amendment. Because the NHL's Oct 1 CBJ opener is the first date a `TBA` local row must render, and the NHL API is the cleanest of the four, **start the NHL adapter in the same week as the NFL's `market_coverage` work** rather than strictly after it. The two problems are complementary (NFL forces the market model; NHL forces the TBA/late-binding model) and neither blocks the other.

## 3. Schema deltas for spec v0.4

Written against the §7 table names. "B" = blocking (renderer is wrong without it), "N" = needed (correctness or honesty suffers), "C" = cosmetic/convenience.

### 3.1 `games` (§7.3)

| Field | Type | Tier | Why |
|---|---|---|---|
| `sport` | enum `cfb,nfl,nhl,nba,mlb` | already approved (§8.8 item 5) | — |
| `schedule_certainty` | enum `FINAL, FLEX_PENDING, TBD, TBD_FOLLOWS` | B | NFL flex; MLB doubleheader game 2. Replaces the kickoff half of `canonical_state`. |
| `flex_decision_deadline` | timestamp, nullable | B | NFL 12-day / 6-day windows. |
| `doubleheader_game_number` | int, nullable | B | MLB. |
| `competition_context` | enum `REGULAR, CUP_GROUP, CUP_KNOCKOUT, PLAY_IN, PLAYOFF, EXHIBITION` | N | NBA Cup, Winter Classic, Stadium Series. Bowl/CFP flags stay for CFB. |
| `series_id`, `series_game_number` | text, int, nullable | N | MLB series; NHL/NBA playoff series (`ifNecessary` in NBA file maps here). |
| `viewing_day` | date | N | Computed with a 03:00 ET cutover so a 10:30 PM PT tip stays on the right grid. |

`canonical_state` keeps `authority_conflict`; its TBD values move to `schedule_certainty` + `network_status`.

### 3.2 `game_streams` → rename to `game_broadcasts` (§7.4)

The table already models one game → many outlets. It needs to carry linear TV too, not just streaming, and four attributes the research found.

| Field | Type | Tier | Why |
|---|---|---|---|
| `delivery_surface` | enum `LINEAR, STREAMING` | B | CBS→Paramount+, NBC→Peacock must not be separate grid rows. ESPN's `geoBroadcasts[].type` and NBA's `broadcasterMedia` populate it for free. |
| `feed_side` | enum `HOME, AWAY, NATIONAL` | B | MLB dual telecasts (`homeAway`), NBA `broadcasterScope`, NHL `market H/A/N`. All three leagues hand it over. |
| `carriage_certainty` | enum `CONFIRMED, AFFILIATE_DISCRETION, UNANNOUNCED, TBA_NO_RIGHTS_HOLDER` | B | `UNANNOUNCED` = league file hasn't filled yet (28 NBA teams today). `TBA_NO_RIGHTS_HOLDER` = rights exist, no distributor (CLE, CBJ). Render both as "local broadcast — carrier TBA"; only the second is news. |
| `suppresses_local_feed` | bool | B | National exclusives remove the local row (MLB, NBA). |
| `blackout_rule` | enum `NONE, IN_MARKET, OUT_OF_MARKET, NATIONAL_EXCLUSIVE` | N | NFL Network, MLB.TV, NHL Power Play. |
| `first_seen_at` | timestamp | N | When the row first appeared in the source. Late-binding local rows make this the most useful audit field in the table. |
| `service_id` | stays; **nullable** when `carriage_certainty` ∈ {`UNANNOUNCED`, `TBA_NO_RIGHTS_HOLDER`} | B | A local telecast with no named carrier must be representable. |

### 3.3 New: `market_coverage`

`(game_id, network_id, market_id, is_primary, source_observation_id)`. **Market-of-one for v1**: a single `markets` row for Cleveland (DMA 510), ZIP list optional. NHL `postal-lookup` results feed a sibling `team_territories (team_id, market_id, network_type IN ('Inner','Outer'))` so in/out-of-market can be derived without hand entry. NFL rows are hand-entered weekly from 506sports until a structured source appears. **DECISION 1 — market-of-one or general DMA support?** Recommendation: market-of-one.

### 3.4 New: `whip_around_broadcasts`

`(id, sport, network_id, starts_at, ends_at, title)` + `whip_around_games (whip_around_id, game_id)`. Covers NHL Frozen Frenzy (Oct 13, encoded in the API now), NFL RedZone, Peacock MLB whip-around, NBC Gold Zone. Renders as one block spanning its window on the network's row, with the covered games listed in the tray.

### 3.5 New: `carriage_status`

`(network_id, provider_id, status, effective_from, effective_to, source)` — provider = DIRECTV CHOICE, ESPN Unlimited, etc. Lets the footer say "on NBCSN — not in your DIRECTV lineup" instead of silently dropping the game. Replaces the render-time `UNAVAILABLE` set in `render_day.py`.

### 3.6 `rankings` (§7.6) and odds

`poll_type` gains nothing (AP/CFP stay CFB-only). **DECISION 2 — betting lines.** Spec §21 lists them as a v1 non-goal; the Phase 3B tray shows them (Joe, 2026-08-31), and the CFBD/ESPN feeds deliver them at zero cost. Recommendation: strike "betting lines" from §21 and add `game_odds (game_id, provider, spread, total, home_moneyline, away_moneyline, fetched_at)` with a per-render `show_odds` switch. Per-sport primary line: spread for CFB/NFL/NBA, moneyline for MLB/NHL.

### 3.7 New: `render_policies` (per sport)

| sport | block_minutes | lane_policy | primary_line | open_ended | viewing_day_cutover |
|---|---|---|---|---|---|
| cfb | 210 | `alt_lane` | spread | no | 03:00 ET |
| nfl | 210 | `market_filter` | spread | no | 03:00 ET |
| nhl | 150 | `market_filter` | moneyline | playoffs only | 03:00 ET |
| nba | 150 | `market_filter` | spread | no | 03:00 ET |
| mlb | 180 | `market_filter` | moneyline | yes | 03:00 ET |

`alt_lane` is retired for the pro leagues; `market_filter` shows only the game Joe's market receives and routes the rest to the collapsed "Around the League" strip (**DECISION 3** — strip vs. hide; recommendation: strip).

### 3.8 `authority_rules` staleness (§9.13)

Add `staleness_horizon_days` per field class: local carriage = **14**, national windows = 60, schedules = season. Re-verify local carriage at every season boundary regardless of source rank. This is the rule the Cavaliers error earned.

## 4. Decisions — DECIDED by Joe, 2026-08-31 (late night)

| # | Question | Decision | Consequence for spec v0.4 |
|---|---|---|---|
| 1 | Coverage-map fidelity | **Market-of-one: Cleveland (DMA 510)** | One `markets` row; `market_coverage` hand-entered weekly for NFL from 506sports; `team_territories` from NHL `postal-lookup`. Schema wide enough to add markets later. |
| 2 | Betting lines | **In scope, with a display switch** | Strike "betting lines" from §21; add `game_odds (game_id, provider, spread, total, home_moneyline, away_moneyline, fetched_at)`; `show_odds` per render; primary line spread (CFB/NFL/NBA), moneyline (MLB/NHL). Already live in the CFB tray (v1.3 pills). |
| 3 | Non-accessible games | **Collapsed "Around the League" strip** below the grid | One component for all four leagues; muted register, no grid geometry, expandable in the web app. Replaces the CFB-era "omitted" footer count as the primary honesty surface. |
| 4 | Apple TV (Friday Night Baseball) | **Joe will subscribe — model as AVAILABLE** | Apple TV joins `viewer_services`; Friday MLB games render on an Apple TV streaming row. No national gap remains across the four pro leagues. |
| 5 | Build order | **NFL + NHL in parallel → NBA → MLB** | NFL forces `market_coverage`; NHL (CBJ opener Oct 1) forces `carriage_certainty = TBA` and late-binding local rows. Acceptance tests: an NFL Sunday in November; the Oct 1 CBJ opener with a TBA local row. |
| 6 | Tier 3 confirmations | **TBS: in DIRECTV lineup. NFL Network: available (DIRECTV 212 / ESPN app). ESPN+ content: inside ESPN Unlimited.** Call signs confirmed by the rail order (WKYC 3, WEWS 5, WJW 8, WOIO 19, WBNX 55). | Add TBS and NFL Network as `available` in §3.2; treat ESPN+ exclusives as covered by ESPN Unlimited + Disney+; affiliate call signs seeded in `data/row_order.json`. |

Earlier the same evening, from rendered option boards: contract v1.3 (one full-size card for every game, pills tray, vector streamer wordmarks, 28px tray, gold-plate marquee, Cleveland dial order in the rail) — see `rendering-contract.md` §12.

## 5. Recommended next session

Cut **spec v0.4**: fold `rendering-contract.md` v1.0 into §11, apply §3 above to §7, amend §21 per Decision 2, and update §22's gate ("rendering contract frozen" → checked). Then the first multi-sport code: an `adapters/` folder with `cfbd.py` (extracted from the validation scripts), `nhl.py` and `espn.py`, each writing the same sanitized fixture shape the renderer already reads — so the Oct 1 Blue Jackets opener can be rendered with a `TBA` local row as the acceptance test.
