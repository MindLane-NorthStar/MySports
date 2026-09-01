# MySports — Build Specification

*(v0.1–v0.3 were titled "CFB TV Grid Agent — Build Specification"; renamed at v0.4 when the multi-sport scope became normative. File lineage: `CFB_TV_GRID_AGENT_BUILD_SPEC_v0.1–v0.3.md`.)*

**Version:** 0.4  
**Status:** Living specification / Phase 3B complete (rendering contract v1.4, enrichment live) / multi-sport decisions made  
**Primary use case:** Personal, private use — one viewer, Cleveland market  
**Target implementation:** Python ingestion + rendering, PostgreSQL, GitHub Actions, Next.js/Vercel  
**Primary artifact:** Searchable web application with deterministic daily TV-grid graphics for college football and — in the order NFL + NHL, NBA, MLB — the four major pro leagues, with downloadable PNG files

**Phase 2 research completed:** 2026-08-31  
**Phase 3A validation completed:** 2026-08-31 — `artifacts/validation/` (Week 1 + Week 8 fixtures)  
**Phase 3B rendering completed:** 2026-08-31 → 2026-09-01 — `docs/rendering-contract.md` **v1.4**, `scripts/render_day.py`, `scripts/probe_enrichment.py` (live CFBD rankings / lines / records / weather)  
**Multi-sport research completed:** 2026-08-31 — `docs/research/` (NFL, MLB, NBA, NHL, summary, changelog) and `docs/multisport-plan-v0.4-draft.md` (Tier 1 API checks, schema deltas, six product decisions)  
**Companion documents:** `CFB_TV_GRID_AGENT_SOURCE_AUTHORITY_v0.1.md`, `docs/rendering-contract.md`, `docs/multisport-plan-v0.4-draft.md`, `data/row_order.json`, `data/rivalries.json`

---

## 1. Purpose

Build an automated system that maintains a season-long database of games — FBS college football first, then the NFL, NHL, NBA and MLB — continuously updates kickoff times, television/streaming assignments, rankings, odds, broadcast crews and selected metadata, and automatically generates a polished TV-grid graphic for every calendar day containing at least one qualifying game. One grid per day carries every sport in season that day; the sport is a dimension of the data, not a separate product (§3.12).

The system must be reliable enough to run without human approval during the regular update cycle.

The final product will be a private Vercel-hosted website that:

- displays a TV grid for each day/week,
- supports search by team and week,
- shows the current canonical schedule,
- provides a downloadable high-resolution PNG for each daily grid,
- retains schedule-change history,
- automatically regenerates graphics when render-relevant data changes.

---

## 2. Product Objective

The desired visual model is based on a TV-guide style grid:

- **Rows:** linear television networks (in the viewer's local dial order, with affiliate call letters) or grouped streaming platforms — order and stations are data (`data/row_order.json`).
- **Columns:** Eastern Time in 30-minute increments; axis labels only where a block begins or ends.
- **Game blocks:** fixed duration per sport (`render_policies.block_minutes`: CFB/NFL 210, MLB 180, NBA/NHL 150).
- **One card:** every game — linear row, streaming lane, or TBD section — renders at the same full size (contract v1.3). Team-color bands, endcap logos, rank and record in the name line; a tray with kickoff · venue, streamer chips, and pills for the line, O/U and rivalry.
- **Primary placement:** each game appears once on its primary telecast row; simulcasts appear as chips within the card.
- **TBD games:** full-size cards in a dedicated section below the grid until assigned a time/network.
- **Concurrent streaming games:** dynamic lanes under the applicable streaming service, never capped.
- **Non-accessible games (pro leagues):** a collapsed "Around the League" strip below the grid (decision 3, §3.12).

The graphic must be deterministic and programmatically rendered. Generative-image models must **not** be used for the final schedule rendering.

---

## 3. Locked Requirements

### 3.1 Game Scope

Include:

- FBS games available to a national viewer,
- only if the user can access the applicable linear network or streaming service,
- special-day games on any calendar day, not only Thursday–Saturday,
- one generated graphic for **every calendar day containing at least one qualifying game**.

Exclude:

- games available only on **CBS Sports Network**,
- games available only on **FS2**,
- games available only through services the user does not subscribe to,
- games unavailable nationally to the user under the configured access rules.

The master database should still retain the complete FBS schedule, including games that are not renderable under the user’s current access profile.

---

### 3.2 User Access Profile

Current known access:

- ABC
- CBS
- FOX
- NBC
- The CW
- ESPN
- ESPN2
- ESPNU
- FS1
- Big Ten Network
- ACC Network
- SEC Network
- USA Network
- TNT
- truTV
- ESPN Unlimited / ESPN ecosystem access through DIRECTV
- Peacock Premium
- Paramount+
- HBO Max
- Amazon Prime Video
- Netflix
- Disney+
- SEC Network+ / ACCNX / ESPN3 (authenticated via DIRECTV — confirmed 2026-08-31)
- **TBS** (DIRECTV lineup — confirmed by Joe 2026-08-31; carries MLB Tuesdays/postseason and part of TNT Sports' NHL slate)
- **NFL Network** (DIRECTV ch. 212 and/or inside the ESPN app — confirmed 2026-08-31)
- **ESPN+ content inside ESPN Unlimited** (confirmed 2026-08-31; NHL ESPN+/Hulu exclusives are double-covered with Disney+)
- **Apple TV** (Friday Night Baseball — Joe will subscribe; modeled as **available**, decision 4, 2026-08-31)

Local over-the-air affiliates (Cleveland DMA 510), rendered in the rail above each network mark (contract §2):

- WKYC 3 (NBC) · WEWS 5 (ABC) · WJW 8 (FOX) · WOIO 19 (CBS) · WBNX 55 (The CW)

Current known exclusions:

- **CBS Sports Network**
- **FS2**
- **NBCSN** (not carried on DIRECTV; irrelevant in practice — it only simulcasts Peacock exclusives)
- **NHL Network** (not held; NHL Power Play via ESPN Unlimited carries replays)
- **NFL Sunday Ticket** (not held; out-of-market only)

Provider:

- **DIRECTV CHOICE**
- No DIRECTV Sports Pack

Important rule:

> Viewer eligibility must be determined at the **game-access level**, not merely the primary-network level.

If a game’s primary network is inaccessible but the same telecast has an independently authorized stream the user can access, the game may still qualify for inclusion.

---

### 3.3 Time and Layout

- Canonical display timezone: **Eastern Time**
- Labeling convention: **ET**, not hard-coded EST/EDT
- Grid interval: **30 minutes**
- Game-block duration: **per sport** via `render_policies` (§7.19): CFB and NFL 3.5 h, MLB 3 h (open-ended), NBA and NHL 2.5 h
- Viewing-day cutover: **03:00 ET** — a 10:30 PM PT tip stays on the grid of the day it started (`games.viewing_day`)
- Kickoff times that are not on a 30-minute boundary (for example, 4:15 PM) must be positioned proportionally within the grid.
- The renderer must not round a 15-minute kickoff to the nearest 30-minute boundary.

---

### 3.4 Primary Row + Streaming Badge Rule

A simulcast must appear only once on the grid.

Examples:

- CBS + Paramount+ → render on **CBS** row with a **Paramount+** badge
- NBC + Peacock → render on **NBC** row with a **Peacock** badge
- TNT + HBO Max → render on **TNT** row with an **HBO Max** badge

Streaming-exclusive games should render on the streaming platform’s own row or row-group.

---

### 3.5 Dynamic Streaming Lanes

Streaming platforms may carry multiple games simultaneously.

The renderer must create the minimum number of sub-lanes required to prevent overlap.

Example:

```text
ESPN+
  Lane 1  [Game A----------------]          [Game D-------------]
  Lane 2  [Game B----------------]          [Game E-------------]
  Lane 3  [Game C----------------]
```

Requirements:

- service logo appears once for the group (centered on the first lane),
- lane count is calculated dynamically and is **never capped** — completeness wins over height (the 2026-09-05 stress day is 16 ESPN+ lanes),
- every lane uses the same full-size card as a linear row (contract v1.3; the half-scale card is retired),
- lane allocation is first-fit by start time with fixed per-sport blocks and no truncation; deterministic.

Pro leagues use `lane_policy = market_filter` instead (§3.12): only the game the viewer's market receives renders on the network row; the rest go to the Around the League strip. `alt_lane` (two genuinely national games sharing a network and slot) stays CFB-only.

---

### 3.6 TBD Handling

Games with incomplete assignments must remain visible.

TBD section behavior:

- game exists in season database from the start,
- game remains in a dedicated **TBD / TIME OR TV TBD** section if kickoff and/or primary network are unresolved,
- once the scheduled update pipeline obtains sufficient canonical information, the game automatically moves from the TBD section into its assigned network/time position,
- this movement must trigger regeneration of the affected daily graphic.

Possible statuses:

- `date_known_time_tbd`
- `time_known_network_tbd`
- `network_known_time_tbd`
- `time_and_network_tbd`
- `fully_assigned`

---

### 3.7 Rankings

Ranking rule:

1. Use **AP Top 25** until an official CFP ranking exists for that football week.
2. Use **CFP rankings** thereafter.
3. Do not switch based only on a hard-coded date.
4. Store the ranking source and poll date with each weekly ranking snapshot.

Displayed ranking badges:

- display only if team is ranked in the currently authoritative ranking system,
- ranking number should visually precede or accompany the team identity,
- ranking badge must be legible at PNG download resolution.

---

### 3.8 Broadcast Teams

When officially assigned and available, include:

- play-by-play
- analyst
- sideline reporter

Display all three **space permitting**.

Overflow rules must be deterministic and defined in the rendering contract.

Suggested priority:

1. Play-by-play
2. Analyst
3. Sideline reporter

If space is insufficient:

- use smaller secondary typography down to a defined minimum,
- then drop sideline reporter first,
- then use abbreviated crew presentation if necessary,
- never allow text to overflow the game block.

Broadcast-crew changes are render-relevant and must trigger graphic regeneration.

**v0.4 status:** no structured crew source exists for any league; crews come only from official-release adapters (§9.10, §20.2). The v1.4 tray therefore carries no crew line. When crews arrive they render in the web app's card detail first; adding them to the PNG tray is a contract change with a measured density study, not an assumption.

---

### 3.9 Team and Network Branding

Use:

- official or high-quality authoritative team logos,
- official school colors,
- official network/service logos,
- consistent typography,
- consistent image sizing and padding.

Branding assets must be cached locally or in object storage and referenced through stable IDs.

Do not scrape the same logos repeatedly during each scheduled run.

---

### 3.10 Rivalry and Championship Indicators

Game blocks should support visual indicators for:

- rivalry games,
- conference championship games,
- bowl games,
- College Football Playoff games,
- national championship.

The graphic should include a small legend.

Rivalry metadata must come from a maintained metadata source and must not be inferred dynamically from model output. v0.4 source: `data/rivalries.json` (48 entries), each with `tier` — **tier 1** = national marquee (gold-plate treatment regardless of rankings: Iron Bowl, The Game, Red River, Army–Navy, …); **tier 2** = trophy game (name in the tray's gold rivalry pill only).

**Marquee criterion (contract §3):** both teams ranked in the authoritative poll **or** a tier-1 rivalry; CFP-round flags join when postseason data exists.

---

### 3.11 Betting Lines (added v0.4 — decision 2, 2026-08-31)

Point spread and over/under are **in scope for v1**, with a per-render display switch (`show_odds`). Rationale: CFBD `/lines` and ESPN's schedule payloads deliver spread, total and moneyline in the same call as the schedule — zero acquisition cost, no new dependency — and the line is already on the grid (contract v1.3 pills: favorite's logo + spread, O/U). Rules:

- one line per game, sportsbook preference DraftKings (both spellings CFBD emits) → ESPN Bet → Bovada → consensus;
- primary line per sport (`render_policies.primary_line`): spread for CFB, NFL, NBA; moneyline for MLB, NHL;
- store provider and `fetched_at`; lines are observations, never canonical facts;
- "betting lines" is struck from §21.

---

### 3.12 Multi-Sport Scope, Market, and Build Order (added v0.4 — decisions 1, 3, 5, 2026-08-31)

- **Sports:** `cfb`, `nfl`, `nhl`, `nba`, `mlb` (`games.sport`, §8.8 item 5). One daily grid carries every sport in season.
- **Build order:** **NFL and NHL in parallel**, then NBA, then MLB. NFL forces the market-coverage model; the NHL (Blue Jackets opener Oct 1, 2026, cleanest league API) forces the TBA / late-binding local-carriage model. Acceptance tests: an NFL Sunday in November with CBS/FOX regional splits and a flex-pending primetime game; the Oct 1 CBJ opener rendered with a `TBA` local row.
- **Market-of-one:** the viewer's market is **Cleveland (DMA 510)** and only Cleveland. `markets` holds one row; `market_coverage` is hand-entered weekly for the NFL from 506sports until a structured source appears; NHL territory comes from the league's `postal-lookup` API. The schema is wide enough to add markets later; no general DMA support is built.
- **Non-accessible games** (NFL out-of-market, MLB's 15-game nights, NBA/NHL out-of-market, anything on a service not held): rendered in one collapsed **"Around the League" strip** below the grid — muted register, no grid geometry, expandable in the web app, one component for all four leagues. Nothing is hidden; nothing is deleted.
- **Late-binding local carriage:** league schedule files carry no local TV rows for almost any team in August (28 of 30 NBA teams; 14 of 16 Frozen Frenzy NHL games as of 2026-08-31). An empty local slot is `carriage_certainty = UNANNOUNCED`, never "no telecast"; `TBA_NO_RIGHTS_HOLDER` is reserved for teams with rights and no distributor (Cavaliers, Blue Jackets). Both render as "local broadcast — carrier TBA".
- **Per-league data backbone** (`docs/multisport-plan-v0.4-draft.md` §2): CFB — CFBD; NFL — ESPN API; NHL — `api-web.nhle.com`; NBA — `cdn.nba.com` schedule file (fetched with an nba.com Referer); MLB — `statsapi.mlb.com` with `hydrate=broadcasts(all)`. ESPN's API is the shared enrichment layer (odds, colors, light/dark logos, `isTBDFlex`).

---

## 4. Update Schedule

Automated production refreshes:

- **Monday**
- **Wednesday**
- **Friday**

All times to be configured in Eastern Time.

One shared update pipeline should be triggered on each scheduled day rather than maintaining three separate implementations.

Recommended workflow name:

```text
schedule_refresh
```

---

## 5. Refresh Pipeline

Each scheduled run should execute:

```text
1. Fetch primary structured schedule data
2. Fetch official-source observations for relevant games/weeks
3. Normalize team/network/service identities
4. Compare observations with current canonical database
5. Resolve conflicts according to field-specific authority rules
6. Update canonical game records
7. Update rankings
8. Update broadcast crews
9. Update rivalry/championship metadata if necessary
10. Recalculate viewer eligibility
11. Write change-history records
12. Recalculate render hashes
13. Regenerate only affected day graphics
14. Convert SVG to high-resolution PNG
15. Publish/update web assets
16. Log run status, conflicts, and failures
```

No human approval step is required during a normal run.

---

## 6. Data Architecture

### 6.1 Principle: Facts vs. Observations

The system must separate:

- **source observations**
- **canonical values**

Example:

```text
OBSERVATIONS

Source A: 3:30 PM / CBS
Source B: 7:30 PM / NBC
Source C: 7:30 PM / NBC

CANONICAL

7:30 PM / NBC
```

The canonical record is not overwritten simply because the latest API response differs.

---

## 7. Provisional Core Schema

The exact production DDL remains to be finalized, but the following entities are required.

### 7.1 `teams`

```text
id
canonical_name
short_name
abbreviation
conference_id
fbs_status
primary_color
secondary_color
logo_asset_id
active_from
active_to
```

---

### 7.2 `conferences`

```text
id
name
abbreviation
logo_asset_id
active_from
active_to
```

---

### 7.3 `games`

```text
id
sport                          -- cfb | nfl | nhl | nba | mlb  (v0.4)
external_primary_id
season
week
game_date
viewing_day                    -- game_date shifted by the 03:00 ET cutover (v0.4)
home_team_id
away_team_id
neutral_site
venue_id

rights_controller_type
rights_controller_id
rights_context_reason

canonical_kickoff_at_utc
canonical_kickoff_at_et
kickoff_status
kickoff_certainty
schedule_certainty             -- FINAL | FLEX_PENDING | TBD | TBD_FOLLOWS  (v0.4: NFL flex, MLB doubleheaders)
flex_decision_deadline         -- nullable (v0.4)
doubleheader_game_number       -- nullable int (v0.4, MLB)
competition_context            -- REGULAR | CUP_GROUP | CUP_KNOCKOUT | PLAY_IN | PLAYOFF | EXHIBITION (v0.4)
series_id                      -- nullable (v0.4: MLB series, playoff series)
series_game_number             -- nullable (v0.4)

primary_network_id
network_status
network_certainty

ranking_system
home_rank
away_rank
home_record                    -- W-L(-T) to date (v0.4; conference record via team_records)
away_record

rivalry_id
is_rivalry
is_conference_championship
is_bowl
is_cfp
is_national_championship

canonical_state

created_at
updated_at
last_verified_at
```

`viewer_eligible` should **not** be treated as a permanent fact intrinsic to a game. Viewer eligibility is derived from the canonical assignment plus the configured entitlement profile. It may be computed at query time or materialized in a separate eligibility table/cache.

`rights_controller_type` initially supports:

- `conference`
- `network_or_rights_holder`
- `independent_school`
- `event_organizer`
- `postseason_body`
- `unknown`

`canonical_state` initially supports:

- `fully_assigned`
- `time_tbd`
- `network_tbd`
- `time_and_network_tbd`
- `authority_conflict`

v0.4: the TBD values remain the CFB-facing summary; the pro leagues' finer states live in `schedule_certainty` (kickoff axis) and `game_broadcasts.carriage_certainty` (network axis). `canonical_state` is derived from those two, never edited directly.

---

### 7.4 `game_broadcasts` (renamed from `game_streams` in v0.4)

One row per (game, outlet, feed). Carries linear TV as well as streaming, so the grid row and its chips come from the same table.

```text
id
game_id
service_id                     -- nullable when carriage_certainty is UNANNOUNCED or TBA_NO_RIGHTS_HOLDER
delivery_surface               -- LINEAR | STREAMING   (CBS→Paramount+ is one telecast on two surfaces, not two rows)
feed_side                      -- HOME | AWAY | NATIONAL (MLB dual telecasts, NBA broadcasterScope, NHL market H/A/N)
is_primary
requires_auth
access_status
carriage_certainty             -- CONFIRMED | AFFILIATE_DISCRETION | UNANNOUNCED | TBA_NO_RIGHTS_HOLDER
suppresses_local_feed          -- national exclusives remove the local row (MLB, NBA)
blackout_rule                  -- NONE | IN_MARKET | OUT_OF_MARKET | NATIONAL_EXCLUSIVE
first_seen_at                  -- when this row first appeared in any source (late-binding audit)
source_observation_id
```

Whip-around shows (NHL Frozen Frenzy, NFL RedZone, Peacock's MLB whip-around, NBC Gold Zone) are not rows here — see §7.18.

---

### 7.5 `broadcast_crews`

```text
id
game_id
play_by_play
analyst
sideline_reporter
other_personnel_json
source_observation_id
verified_at
```

---

### 7.6 `rankings`

```text
id
season
week
poll_type
poll_date
team_id
rank
points
source_observation_id
```

`poll_type` initially supports:

- `AP`
- `CFP`

---

### 7.7 `viewer_services`

```text
id
service_id
access_status
access_method
notes
effective_from
effective_to
```

Access status should support:

- `available`
- `unavailable`
- `verify`
- `conditional`

---

### 7.8 `networks_services`

```text
id
canonical_name
short_name
type
logo_asset_id
default_sort_order
supports_concurrent_streams
```

`type` examples:

- `linear_broadcast`
- `linear_cable`
- `streaming`
- `authenticated_stream`
- `hybrid`

---

### 7.9 `source_observations`

```text
id
source_id
game_id
observed_at
published_at
updated_at

field_name
raw_value
normalized_value
raw_label

authority_role
authority_score
claim_certainty

source_url_or_key
source_document_hash
extraction_method
parser_version

valid_from
valid_to
```

`authority_role` initially supports:

- `rights_controller`
- `broadcaster`
- `host_school`
- `visitor_school`
- `structured_provider`
- `official_aggregator`
- `secondary_aggregator`

`claim_certainty` initially supports:

- `definite`
- `window`
- `choice_set`
- `flex`
- `tbd`

---

### 7.10 `canonical_decisions`

Every canonicalization pass should retain the rule evaluation that produced the winning fact, including cases where no canonical value changed.

```text
id
game_id
field_name
decided_at
rule_version
rights_context
winning_source_observation_id
considered_observation_ids
rejected_observation_ids
decision_reason
result_value
result_certainty
decision_status
```

`decision_status` supports:

- `accepted`
- `retained_last_known_good`
- `unresolved_conflict`
- `no_change`

---

### 7.11 `canonical_change_history`

```text
id
game_id
field_name
old_value
new_value
changed_at
canonical_decision_id
decision_reason
winning_source_observation_id
conflicting_observation_ids
```

---

### 7.12 `generated_grids`

```text
id
season
week
game_date
render_hash
svg_asset_url
png_asset_url
generated_at
generator_version
```

---

### 7.13 `rivalries`

```text
id
sport
name
team_a_id
team_b_id
trophy_name
display_label
tier                           -- 1 national marquee | 2 trophy game (v0.4; seeded from data/rivalries.json)
active
```

---

### 7.14 `assets`

```text
id
asset_type
canonical_name
source
source_url
storage_url
content_hash
width
height
updated_at
```

---

### 7.15 `source_snapshots`

Official-source adapters should retain a raw evidence snapshot sufficient for debugging parser failures and auditing schedule changes.

```text
id
source_id
fetched_at
source_url
http_status
content_hash
content_type
storage_url
parser_version
parse_status
error_message
```

Raw snapshots must be retained server-side and never treated as public application content.

---

### 7.16 `viewer_game_eligibility` (optional materialized cache)

If runtime computation is not performant enough, materialize the entitlement result separately from the game fact.

```text
game_id
viewer_profile_id
eligible
eligible_via_network_id
eligible_via_service_ids
reason
computed_at
entitlement_version
```

---

### 7.17 `markets`, `market_coverage`, `team_territories` (v0.4 — decision 1)

```text
markets:           id, name, dma_code, zip_list_json, is_viewer_market
market_coverage:   game_id, network_id, market_id, is_primary, source_observation_id
team_territories:  team_id, market_id, network_type   -- 'Inner' | 'Outer' (from NHL postal-lookup; hand-entered elsewhere)
```

v1 holds exactly one `markets` row (Cleveland, DMA 510, `is_viewer_market = true`). `market_coverage` answers "which of CBS's eight 1:00 PM games does Cleveland get"; for the NFL it is hand-entered weekly from 506sports; for the NBA it comes from the league file's affiliate rows once they populate.

---

### 7.18 `whip_around_broadcasts` / `whip_around_games` (v0.4)

```text
whip_around_broadcasts: id, sport, network_id, starts_at, ends_at, title, source_observation_id
whip_around_games:      whip_around_id, game_id
```

Renders as one block spanning its window on the network's row, the covered games listed in the tray. Cases: NHL Frozen Frenzy (Oct 13, 2026 — fully encoded in the NHL API today), NFL RedZone, Peacock MLB whip-around, NBC Gold Zone.

---

### 7.19 `render_policies` (v0.4 — per sport)

| sport | block_minutes | lane_policy | primary_line | open_ended | viewing_day_cutover |
|---|---|---|---|---|---|
| cfb | 210 | `alt_lane` | spread | no | 03:00 ET |
| nfl | 210 | `market_filter` | spread | no | 03:00 ET |
| nhl | 150 | `market_filter` | moneyline | playoffs only | 03:00 ET |
| nba | 150 | `market_filter` | spread | no | 03:00 ET |
| mlb | 180 | `market_filter` | moneyline | yes | 03:00 ET |

---

### 7.20 `carriage_status` (v0.4)

```text
network_id, provider_id, status, effective_from, effective_to, source
```

Provider = DIRECTV CHOICE, ESPN Unlimited, Peacock Premium, Apple TV, … Replaces the render-time `UNAVAILABLE` set in `render_day.py`, and lets the Around the League strip say "on NBCSN — not in your DIRECTV lineup" as a stated fact.

---

### 7.21 `game_odds` (v0.4 — decision 2)

```text
game_id, provider, spread, total, home_moneyline, away_moneyline, spread_open, total_open, fetched_at
```

Observations, not canonical facts; one displayed line per game chosen by the §3.11 provider preference.

---

### 7.22 `team_records` (v0.4)

```text
team_id, season, as_of, wins, losses, ties, conf_wins, conf_losses, conf_ties
```

Season-to-date snapshots (CFBD `/records`; ESPN team records for the pro leagues). The name line shows `(W-L)` and adds `, cW-cL CONF` only for conference games; suppressed at 0-0.

---

### 7.23 Product decision register (v0.4)

`canonical_decisions` (§7.10) records data decisions per game. Product decisions are recorded here, in the spec, so the reasoning survives:

| Date | Decision | Where it lands |
|---|---|---|
| 2026-08-31 | Add the `sport` dimension now | §8.8 item 5, §7.3 |
| 2026-08-31 | Rendering contract v1.0 frozen; v1.1–v1.4 revised by decision boards (silhouette A, records in the name line, fixed-size tray without weather, gold-plate marquee, Cleveland dial order with call letters, one full-size card for every game, pills tray with favorite-logo disc and vector streamer wordmarks, 28px tray, staggered axis labels, status-bar footer) | `docs/rendering-contract.md` §12 |
| 2026-08-31 | Market-of-one: Cleveland | §3.12, §7.17 |
| 2026-08-31 | Betting lines in scope with a display switch | §3.11, §7.21, §21 |
| 2026-08-31 | Non-accessible games → collapsed "Around the League" strip | §3.12, §11.8 |
| 2026-08-31 | Apple TV (Friday Night Baseball): subscribe, model as available | §3.2 |
| 2026-08-31 | Build order NFL + NHL in parallel → NBA → MLB | §3.12, §18 Milestone 8 |
| 2026-08-31 | Tier 3 confirmations: TBS, NFL Network, ESPN+ inside ESPN Unlimited; affiliate call signs | §3.2 |

---

## 8. Primary Structured Data Provider

### 8.1 Provisional selection

**CollegeFootballData (CFBD)** remains the provisional structured backbone.

It is explicitly **not** the final authority for schedule changes. Its role is to provide efficient structured discovery, stable identifiers, season/week data, media observations, team metadata, and other normalization inputs.

### 8.2 Confirmed API capabilities from current documentation

The documented REST API includes:

- `/games`
- `/games/media`
- `/calendar`
- `/scoreboard`
- `/teams`
- `/teams/fbs`
- `/conferences`
- rankings/polls endpoints elsewhere in the API surface

`/games/media` is especially relevant because it exposes:

```text
game id
season
week
startTime
isStartTimeTBD
homeTeam
awayTeam
mediaType
outlet
```

Supported media types include:

```text
tv
radio
web
ppv
mobile
```

This is compatible with the project’s need to separate linear TV from authenticated or direct-to-consumer streaming observations.

### 8.3 Authentication

CFBD requires bearer-token authentication.

Production rules:

- environment variable name: `CFBD_API_KEY`
- never embed the key in the Next.js browser bundle
- never commit the key to Git
- GitHub Actions must use an encrypted repository/environment secret
- local development should use `.env` or equivalent ignored configuration
- API calls should be performed server-side or from scheduled ingestion jobs

### 8.4 Current pricing and expected project fit

As researched on 2026-08-31:

| Tier | Monthly price | Calls/month | Project assessment |
| --- | ---: | ---: | --- |
| Free | $0 | 1,000 | Preferred initial development and possibly sufficient production tier |
| Tier 1 | $1 | 5,000 | Very inexpensive production headroom |
| Tier 2 | $5 | 30,000 | More than enough for this project |
| Tier 3 | $10 | 75,000 | Unnecessary unless GraphQL/live features become useful |

Because the agent can make **bulk season/week requests** three times per week rather than chatty per-game requests, the expected call volume is very low. The project should begin on Free and upgrade only after measured usage demonstrates a need.

### 8.5 Provider abstraction

CFBD must be behind a provider interface so the structured backbone can later be replaced or augmented without rewriting the domain model.

```python
class ScheduleProvider:
    fetch_season(...)
    fetch_week(...)
    fetch_media(...)
    fetch_rankings(...)
    fetch_teams(...)
```

### 8.6 Live-validation status — COMPLETE (Phase 3A, 2026-08-31)

Authenticated validation ran against 2026 Week 1 (`/calendar`, `/games`, `/games/media`; three API calls). Free tier remains sufficient.

Confirmed:

- 455 total Week 1 game rows; **99 FBS-involving games** (51 FBS-FBS, 48 FBS-FCS); zero FBS games missing a media row.
- Stable numeric game IDs (Toledo @ Michigan State = `401858429`).
- **Kickoff precision preserved exactly.** Five non-half-hour kickoffs observed (12:45, 3:45, 4:15 ×2, 7:45 PM ET), including the Northern Illinois @ Iowa 4:15 PM test case. No rounding.
- `/games/media` emits multiple rows per game (8 games in Week 1) with `mediaType` separating `tv` from `web`.
- Media `startTime` agreed with `/games` `startDate` on all 109 joined rows.
- Toledo @ Michigan State reports `tv:FS1`, agreeing with the official rights-controller assignment. The NCAA.com `ESPNU` conflict did not propagate into CFBD (see §20.3 note).

Gaps and quirks:

1. **Simulcast under-reporting.** Only 8 of 99 games carried more than one media row. The lone CBS game had no Paramount+ row and only one Peacock row appeared all week, while ESPN/ABC games did carry Disney+ rows and the TNT game carried HBO Max. CFBD media rows cannot be the sole source of streaming simulcasts; §8.8 adds rule-based simulcast derivation.
2. **Duplicate outlet labels.** `CW` and `The CW Network` appear as separate `tv` rows on the same game (three games). Normalization must dedupe identical (game, canonical service, media type) rows after aliasing.
3. **Abbreviated/nonstandard labels.** `USA Net`, `ESPN Unlmtd`, `MW+`, `UConn+`, `Disney+`, `SECN+`, `CBSSN`, `BTN` all require aliasing (§8.7).
4. **TBD behavior unvalidated.** Week 1 contained zero `startTimeTBD` games and zero TBD media rows — expected for an opener. The §3.6 TBD lifecycle remains untested against live data; §20.7 adds a required mid-season probe.
5. **2026 realignment already reflected** (e.g., North Dakota State listed as FBS / Mountain West). Conference metadata appears current; cross-season realignment strategy (§24) remains open.

Live eligibility fixtures found in Week 1:

- Duquesne @ Air Force (`web:MW+` only) and Lafayette @ UConn (`web:UConn+` only): stream-only games on inaccessible services → not viewer-eligible, retained in database.
- Five CBSSN-only games → excluded per §3.1.

Renderer stress facts for the Phase 3B contract:

- "Week 1" spans **six calendar dates** (Aug 29 – Sep 7), including a Monday game.
- Saturday 2026-09-05 carries **68 FBS-involving games, 18 on ESPN+**, with **nine ESPN+ kickoffs at 7:00 PM ET simultaneously**. Rendered outcome (contract v1.4): 62 games on the grid, 6 omitted (CBSSN, MW+, UConn+), ESPN+ in 16 full-size lanes, page 2862 × 3864 px. Completeness won over height (§3.5).

---

### 8.7 Canonical outlet-normalization table (v1, from live Week 1 data)

Every outlet label observed in the 2026 Week 1 and Week 8 media feeds, with its canonical mapping and access classification under the §3.2 profile:

| CFBD raw label(s) | Canonical service | Type | Access |
| --- | --- | --- | --- |
| ABC | ABC | linear_broadcast | available |
| CBS | CBS | linear_broadcast | available |
| FOX | FOX | linear_broadcast | available |
| NBC | NBC | linear_broadcast | available |
| CW, The CW Network | The CW | linear_broadcast | available |
| ESPN | ESPN | linear_cable | available |
| ESPN2 | ESPN2 | linear_cable | available |
| ESPNU | ESPNU | linear_cable | available |
| FS1 | FS1 | linear_cable | available |
| TNT | TNT | linear_cable | available |
| USA Net | USA Network | linear_cable | available |
| BTN | Big Ten Network | linear_cable | available |
| ACC Network | ACC Network | linear_cable | available |
| SEC Network | SEC Network | linear_cable | available |
| CBSSN | CBS Sports Network | linear_cable | **unavailable** |
| ESPN+ | ESPN+ | streaming | available |
| ESPN Unlmtd | ESPN Unlimited | streaming | available (via DIRECTV) |
| Peacock | Peacock | streaming | available |
| HBO Max | HBO Max | streaming | available |
| Disney+ | Disney+ | streaming | available |
| SECN+ | SEC Network+ | authenticated_stream | available (DIRECTV auth) |
| MW+ | MW+ (Mountain West) | streaming | **unavailable** |
| UConn+ | UConn+ | streaming | **unavailable** |

Labels not in this table fail closed: classified UNKNOWN, excluded from rendering, logged for human review, never guessed.

---

### 8.8 Validation-driven schema and pipeline deltas

1. **New table `outlet_aliases`** — `raw_label` (unique per provider), `service_id`, `first_seen_at`, `review_status`. Normalization is data, not code; new labels land as UNKNOWN pending review.
2. **Post-normalization dedupe** of identical (`game_id`, `service_id`, `media_type`) rows (required by the CW duplication).
3. **New table `simulcast_rules`** — linear `service_id` ⇒ implied streaming `service_id`, `effective_from`/`effective_to`, `rule_source`. Derives CBS ⇒ Paramount+, NBC ⇒ Peacock, TNT ⇒ HBO Max, and ESPN/ABC ⇒ Disney+ when CFBD omits them.
4. Derived simulcast rows are tagged (`extraction_method = 'simulcast_rule'`) and never outrank a directly observed row from any source.
5. **Add a `sport` dimension now** (`games.sport`, teams scoped by sport, networks shared) — MySports is intended to expand beyond college football, and retrofitting after Milestone 1 would touch every table. Default `cfb` for v1. Confirmed by Joe 2026-08-31.

## 9. Source Authority and Reconciliation

### 9.1 Phase 2 status

**Authority architecture is now substantially defined.**

The remaining validation work is not whether the system needs source authority rules; it does. The remaining work is validating each adapter and measuring CFBD latency/coverage.

A **single global source hierarchy is prohibited**.

Authority is determined by:

1. the field being resolved,
2. who controls the media rights for that game,
3. whether a claim is definitive or tentative,
4. the source’s authority role,
5. publication/update time when authority roles are otherwise equal.

---

### 9.2 Rights-context resolution

Before resolving kickoff/network claims, determine the game’s controlling rights context.

#### Non-neutral-site game

Default assumption:

```text
rights_controller = home team's conference/media-rights system
```

This may be overridden by an explicit special-event agreement.

#### Independent home game

```text
rights_controller = independent school + contracted rights holder
```

Example: Notre Dame home rights are validated through Notre Dame/NBC official sources.

#### Neutral-site or special event

```text
rights_controller = event organizer or explicitly designated rights holder
```

#### Postseason

Use the controlling postseason body/event plus its official broadcaster.

The road team’s conference remains valuable corroboration but does not automatically control the telecast.

---

### 9.3 Authority-role taxonomy

Every normalized observation receives one of the following roles:

```text
rights_controller
broadcaster
host_school
visitor_school
structured_provider
official_aggregator
secondary_aggregator
```

This is more meaningful than a simple numeric source rank because the same source can be authoritative for one game/field and merely corroborative for another.

---

### 9.4 Field-specific canonicalization matrix

#### Game date

1. rights controller / event organizer
2. broadcaster when explicitly scheduling the event
3. host school
4. visitor school
5. structured provider
6. official aggregator
7. secondary aggregator

#### Kickoff time

1. rights controller
2. broadcaster
3. host school
4. visitor school
5. structured provider
6. official aggregator
7. secondary aggregator

#### Primary television network

1. rights controller
2. broadcaster
3. host school
4. visitor school
5. structured provider
6. official aggregator
7. secondary aggregator

#### Streaming simulcast / streaming-exclusive service

1. broadcaster or streaming service
2. rights controller
3. host school
4. visitor school
5. structured provider
6. official aggregator

#### Broadcast crew

1. official network press room / game-specific programming release
2. official network schedule or commentator page
3. rights controller
4. host-school game-week notes
5. visitor-school game-week notes
6. reputable secondary source

#### Rankings

Canonical authority:

```text
AP period  -> Associated Press ranking
CFP period -> official College Football Playoff ranking
```

CFBD may transport/cache ranking data, but the ranking identity is defined by the AP/CFP source.

#### Neutral-site classification / postseason classification

Use the appropriate event organizer, NCAA/CFP/conference authority, then schools, then structured provider.

---

### 9.5 Claim certainty

An observation is not only a value; it also has a certainty state.

```text
definite
window
choice_set
flex
tbd
```

Examples:

```text
7:30 PM ET / NBC            -> definite
12:00 or 3:30 PM ET         -> window
FOX or FS1                  -> choice_set
Friday/Saturday flex        -> flex
TBD                         -> tbd
```

A later definitive official assignment supersedes an earlier tentative window/choice claim from the same controlling rights context.

Tentative assignments should remain visible in the database and may optionally be shown in the TBD section, but they must not be rendered as a definitive grid placement.

---

### 9.6 Conflict-resolution algorithm

For each canonical field:

```text
1. Collect active observations.
2. Normalize values and certainty.
3. Determine rights context.
4. Assign authority roles.
5. Remove observations that are stale/superseded by the same source.
6. Prefer higher authority role appropriate to that field.
7. At the same authority role, prefer a newer explicit publication/update.
8. Prefer a definite claim over an older tentative claim when the source is equally authoritative.
9. If top-authority evidence still conflicts:
      a. retain last-known-good canonical value if one exists;
      b. mark the decision as unresolved;
      c. log all conflicting observations.
10. If no last-known-good value exists:
      a. canonical state = authority_conflict;
      b. do not guess;
      c. keep the game in the TBD/conflict area.
11. Write a canonical_decisions record for the evaluation.
12. Write canonical_change_history only if the canonical value changes.
```

### 9.7 Source voting is prohibited

Multiple lower-authority sources must **not** outvote one controlling source.

Example:

```text
Official Big Ten: FS1
Official FOX:     FS1
MAC:              FS1
NCAA.com:         ESPNU
```

Canonical value:

```text
FS1
```

The NCAA observation is retained as a conflict/evidence item rather than allowed to overwrite the rights-controlling assignment.

---

### 9.8 Real 2026 conflict test: Toledo at Michigan State

Research on 2026-08-31 surfaced a useful production test case for Friday, September 4:

- the official Big Ten early-season release lists **Toledo at Michigan State — 8:00 PM ET — FS1**;
- the official MAC release independently lists **FS1**;
- FOX’s official 2026 coverage also lists the game on **FS1** and names the broadcast crew;
- a current NCAA.com Week 1 schedule lists **ESPNU**.

This is the exact type of disagreement the agent must solve autonomously.

Expected canonical decision:

```text
kickoff: 8:00 PM ET
network: FS1
decision: official rights-controller + broadcaster evidence overrides official aggregator
```

The conflicting NCAA observation remains stored for audit purposes.

---

### 9.9 Official conference source matrix

The following official conference sources are approved as Tier-A evidence for games they control.

| Conference | Official source | 2026 selection behavior / operational note | Authority role |
| --- | --- | --- | --- |
| ACC | theACC.com football TV/kickoff releases and composite schedule | Early selections published; remaining assignments use 12-day or 6-day process | rights_controller |
| Big Ten | BigTen.org football TV releases | First weeks/select games announced jointly with FOX/CBS/NBC/BTN; remaining assignments use 12-/6-day process | rights_controller |
| Big 12 | Big12Sports.com TV-selection releases | Remaining TV selections published on 12-day or 6-day notice | rights_controller |
| SEC | SECSports.com broadcast schedule + ESPN/SEC releases | ESPN family controls conference media package; official SEC schedule/windows are primary evidence | rights_controller |
| American | TheAmerican.org TV-designation releases | Most remaining designations announced weekly via 12-day process | rights_controller |
| Conference USA | ConferenceUSA.com broadcast releases | ESPN-platform games remain subject to 12-day selections; CBS Sports Network also carries many league games | rights_controller |
| MAC | GetSomeMACtion.com TV releases | Remaining times/networks typically selected 12 days prior | rights_controller |
| Sun Belt | SunBeltSports.org + ESPN schedule releases | Most other games use traditional 12-day process | rights_controller |
| Mountain West | TheMW.com schedule/weekly TV releases | CBS Sports, FOX Sports and CW Sports participate in selection procedure | rights_controller |
| Pac-12 | Pac-12.com broadcast schedule | 2026 home slate controlled across CBS Sports, USA Sports and The CW; road nonconference games follow host conference rights | rights_controller |
| FBS Independents | School-specific official schedule + contracted broadcaster | Resolve home rights by school/contract; road rights belong to host context | rights_controller / host_school |

Adapters should be written per source rather than assuming one conference-page DOM.

---

### 9.10 Official network / announcer source matrix

| Network family | Preferred official source | Primary use |
| --- | --- | --- |
| ESPN / ABC / ESPN2 / ESPNU / ESPN+ / ACCN / SECN | ESPN Press Room college-football commentator schedule and game releases | broadcast crews, ESPN-family network/stream confirmation |
| FOX / FS1 | FOX Sports Press Pass and official FOX college-football schedule | crews, FOX/FS1 assignments |
| Big Ten Network | Big Ten/BTN official broadcaster and schedule releases | BTN crews and assignments |
| NBC / Peacock | NBC Sports Pressbox | crews, NBC/Peacock assignments |
| CBS / Paramount+ | Paramount Press Express / CBS Sports official releases | CBS crews, Paramount+ simulcast confirmation |
| TNT / truTV / HBO Max | TNT Sports / WBD Sports press room | crews and TNT-family streaming confirmation |
| The CW | CW Press | commentator teams and CW schedule confirmation |
| USA Sports | Versant/USA Sports press room | Pac-12/USA crews and schedule confirmation |

For broadcast crew data, network first-party press rooms outrank schedule aggregators.

---

### 9.11 Streaming interpretation rules

Streaming is modeled independently from the primary network.

Known 2026 patterns that the system must support include:

```text
CBS + Paramount+
NBC + Peacock
TNT + HBO Max
The CW + ESPN App / ESPN Unlimited for applicable Pac-12 games
ESPN-family linear + authenticated ESPN app where rights permit
```

Database behavior:

- retain all observed legitimate streams;
- mark the primary linear outlet separately;
- render only streaming badges that the configured viewer can actually access;
- if a stream is the only accessible path, the game is still viewer-eligible.

---

### 9.12 Official-source ingestion requirements

Most conference/network authority sources are official HTML schedule/news pages rather than stable documented APIs.

Each adapter must:

```text
fetch
snapshot
hash
parse
normalize
validate
emit observations
```

Requirements:

- retain a raw server-side snapshot or normalized evidence extract;
- store `source_document_hash`;
- store parser version;
- fail closed on parsing anomalies;
- never interpret an empty parse as “all assignments were removed”;
- never wipe last-known-good canonical data because a website changed its DOM;
- log parser failures separately from legitimate schedule changes.

Where an official structured JSON feed is available and stable, prefer it over HTML parsing.

---

### 9.13 Freshness and staleness rules

A source observation should not become authoritative merely because it was fetched later.

Use, in order:

1. explicit `updated_at` supplied by source,
2. explicit `published_at`,
3. document version/change evidence,
4. fetch timestamp only as a last-resort transport timestamp.

For recurring official selection pages, new releases should supersede older releases from the same authority role for the same field/game.

**Staleness horizon (v0.4).** Every field class carries `staleness_horizon_days` in `authority_rules`: **local carriage = 14 days**, national windows = 60, schedules = season. Local-carrier attribution must be re-verified at every season boundary regardless of source rank — the Cavaliers/FanDuel Sports Network Ohio error (`docs/research/research-changelog.md`) came from two high-rank sources that were months stale.

---

### 9.14 Failure-safe behavior

If a top-authority source becomes unreachable:

- keep the last-known-good canonical value;
- continue ingesting other observations;
- do not downgrade canonical authority merely because the top source is temporarily unavailable;
- retry on later scheduled run;
- surface warning in run log.

If an official page becomes unparseable:

- retain its last valid observations,
- mark adapter degraded,
- do not infer mass deletions.

---

### 9.15 Authority-rule versioning

Canonical decisions must store a `rule_version`.

Example:

```text
authority_rules_v1
```

This allows later reprocessing/auditing if the source strategy changes.

---

### 9.16 Current Phase 2 conclusion

The core reconciliation architecture is ready to freeze for v1 unless live CFBD validation reveals a field/model gap.

The principal remaining work is:

1. authenticated CFBD week validation,
2. adapter proof-of-concept against several official sources,
3. rendering contract,
4. deployment/provider selection.

## 10. Viewer Eligibility Engine

Eligibility should be calculated after canonical network/stream assignments are resolved.

Pseudo-rule:

```text
eligible =
    accessible(primary_network)
    OR any(accessible(streaming_option))
```

The engine must distinguish:

- channel access,
- app access,
- provider authentication,
- standalone subscription,
- exclusive stream,
- simulcast stream.

Current explicit exclusions:

```text
CBS Sports Network = unavailable
FS2 = unavailable
NBCSN = unavailable (not carried)
NHL Network = unavailable (not held)
```

v0.4: eligibility for the pro leagues also consults `market_coverage` (is this the feed Cleveland receives?) and `game_broadcasts.blackout_rule`; a game that is not eligible is not dropped — it routes to the Around the League strip (§11.8).

---

## 11. Rendering System

### 11.1 Rendering Technology

Preferred approach:

- generate **SVG** as the canonical visual artifact,
- convert SVG → high-resolution **PNG**,
- render SVG directly in the web application where appropriate.

Reasons:

- deterministic geometry,
- crisp typography,
- sharp logos,
- scalable output,
- simpler regression testing,
- easier future style changes.

---

### 11.2 The Rendering Contract is normative

`docs/rendering-contract.md` **v1.4** (frozen at v1.0 on 2026-08-31; v1.1–v1.4 revised the same night from rendered option boards) is the normative definition of the daily grid. Where this section and the contract differ, the contract wins. Summary of what it fixes:

- **Canvas:** dark spotlight background; 30-minute columns at `PX_PER_MIN = 3.2`; grid from the first kickoff's hour to the last block end; axis labels only where a block begins or ends (staggered onto a second line on collision); title "COLLEGE FOOTBALL WEEK N — Weekday, Month D, YYYY" with a Week 0 rule for the two-Saturday opening window; legend in the header band; status-bar footer of pills (on grid / TBA / omitted with outlet names).
- **Rail:** each network's mark on a charcoal tile, dark-adapted at render time; broadcast rows in Cleveland dial order with affiliate call letters above the mark; order and stations in `data/row_order.json` (per sport).
- **Card (one for every game):** `BLOCK_H 74 + TRAY_H 28 + gap 8 = ROW_H 110`; team-color bands with WCAG-checked ink; endcap logos on team-tinted gradient caps; Barlow Condensed names with rank and a 60% record run; a tray with kickoff · venue, streamer chips (vector wordmarks nested inline), a spread pill led by the favorite's logo on a tinted disc, an O/U pill and a gold rivalry pill; pills drop by priority, nothing shrinks. Marquee games get a gold plate, gold rim and MARQUEE tag.
- **Streaming lanes and TBD:** same card, full size; lanes uncapped; TBD cards one block wide below the grid in three states.
- **Output:** SVG canonical; PNG proof at 1×; download export at 2×.

**TBD gating rule (normative, unchanged).** When `startTimeTBD` is true the kickoff timestamp is never used for placement — CFBD encodes time-TBD as midnight ET (§20.7); the game routes to the TBD section; the date half still assigns the day.

---

### 11.3 Network Ordering

Data, not code: `data/row_order.json`, keyed by sport. CFB (Joe, 2026-08-31): **NBC (WKYC 3), ABC (WEWS 5), FOX (WJW 8), CBS (WOIO 19), The CW (WBNX 55)** · ESPN, ESPN2, ESPNU, FS1, TNT, USA Network · Big Ten Network, ACC Network, SEC Network · streaming groups ESPN+, ESPN Unlimited, SEC Network+, Peacock, HBO Max. Rows with no qualifying game are omitted. Pro-league lists are added to the same file (NFL Network, NBA TV, MLB Network, TBS, Prime Video, Apple TV, NHL/NBA/MLB league DTC apps).

---

### 11.4 Game Card Anatomy

Contract §3. Content priority when space is short: team names → rank → record run → kickoff · venue → spread pill → O/U pill → rivalry pill → streamer chips. Broadcast crews are not on the v1 card (§3.8).

---

### 11.5 Color-Coded Blocks

Contract §3: away color top band, home color bottom band, hairline between; ink chosen by computed contrast (white vs near-black, ≥ 4.0:1, darkening the band until it passes); endcap caps tinted toward white so same-color logos never vanish. Never rely on color alone: rank, record and marquee state are always also text or a tag.

---

### 11.6 TBD Section

Contract §9: below the grid, full-size cards, three groups in fixed order — kickoff set / network TBA, network set / kickoff TBA, both TBA — sorted by home conference then home team; the tray's primary slot carries the state text, the pills carry the line and rivalry if known.

---

### 11.7 Legend

Contract §8: rank source and week; marquee swatch; `*` derived simulcast; ALT pill; TBA tile with count; omitted tile with count.

---

### 11.8 Around the League strip (v0.4 — decision 3)

For the pro leagues, every game on the viewing day that is not on the grid — out-of-market feeds Cleveland does not receive, games on services not held, blacked-out games — renders in one collapsed strip below the TBD section: muted register, one line per game (`away @ home · time · outlet · reason`), no grid geometry, expandable in the web app. The reason is a stated fact from `carriage_status` / `market_coverage` / `blackout_rule`, never a guess. This replaces the CFB-era "omitted" footer count as the primary honesty surface; the footer pill remains.

---

### 11.9 Per-sport render policy

`render_policies` (§7.19) drives block duration, lane policy, primary line, open-endedness and the viewing-day cutover. The renderer takes the policy from the game's sport; a single day may mix sports and therefore block widths. Title and week label are per sport; on a multi-sport day the title is the date alone and each sport's rows are grouped under a sport header (design pending — the first multi-sport render is the NFL + NHL acceptance test, §3.12).

---

## 12. Render Hash

Each daily grid must calculate a hash from render-relevant data only.

Suggested fields:

```text
game ids
kickoff times
primary networks
streaming badges
ranks
team branding version
network branding version
broadcast crews
rivalry flags
championship flags
TBD state
layout configuration version
```

If:

```text
new_render_hash == stored_render_hash
```

then:

```text
skip regeneration
```

If different:

```text
regenerate SVG
regenerate PNG
publish new assets
update generated_grids
```

---

## 13. Web Application

### 13.1 Hosting

Preferred:

- **Next.js**
- **Vercel**

---

### 13.2 Primary Views

#### Home / Current Week

- current CFB week
- available daily grids
- most recently updated timestamp
- recent schedule changes

#### Week View

Example:

```text
2026
Week 7

Tuesday
Wednesday
Thursday
Friday
Saturday
Sunday
```

Only days with qualifying games require a grid card.

#### Team Search

Search by:

- school name
- abbreviation
- alias

Results show the team’s season schedule with:

- opponent
- date
- kickoff ET
- network
- streaming
- ranking if relevant
- link to applicable daily grid

#### Grid Detail

- web-rendered SVG
- updated timestamp
- download PNG button
- optional download SVG
- game list below graphic
- change history for that day

---

### 13.3 Search Requirements

Minimum:

- search by team
- browse/search by season and week

Potential future:

- network
- conference
- ranking
- rivalry
- date

---

## 14. Storage

Recommended separation:

- PostgreSQL for structured data
- object storage for logos and generated SVG/PNG artifacts

Potential providers:

- Neon PostgreSQL
- Vercel Postgres-equivalent
- Vercel Blob
- Cloudflare R2

Final provider selection remains open.

---

## 15. Automation / Deployment

### 15.1 GitHub Actions

Preferred for scheduled background work.

Expected workflows:

```text
bootstrap_season.yml
schedule_refresh.yml
render_all.yml
deploy_or_sync.yml
```

Production `schedule_refresh.yml` should run Monday, Wednesday, Friday.

Manual dispatch should also be supported.

---

### 15.2 Failure Behavior

If data refresh fails:

- do not delete existing canonical data,
- do not publish an empty schedule,
- preserve last-known-good graphic,
- log failure,
- expose run status in admin/logging layer.

If one enrichment source fails:

- continue pipeline where safe,
- retain last-known-good enrichment data,
- only fail the entire run if schedule integrity is compromised.

---

## 16. Logging and Auditability

Every scheduled run should record:

```text
run_id
started_at
completed_at
status
providers_called
games_checked
games_changed
conflicts_found
graphics_regenerated
errors
warnings
```

The system should preserve enough detail to answer:

- What changed?
- When did it change?
- Which source caused the canonical change?
- Which graphic was regenerated?
- Why did the renderer regenerate?

---

## 17. Season Bootstrap

At the start of each season:

1. fetch complete FBS season schedule,
2. normalize teams,
3. create all game records,
4. populate known dates/times/networks,
5. classify unresolved games into TBD states,
6. populate initial rankings if available,
7. cache required team/network assets,
8. calculate viewer eligibility,
9. generate all currently renderable days.

The season schedule is the persistent foundation. Refresh jobs update this foundation rather than rebuilding the entire database from scratch.

---

## 18. Build Milestones

### Milestone 1 — Data Foundation

Deliverables:

- repository initialized
- environment configuration
- PostgreSQL schema
- CFBD provider integration
- team normalization
- complete 2026 FBS season bootstrap
- basic CLI diagnostics

Acceptance:

- complete expected FBS schedule can be loaded,
- every game receives a stable internal ID,
- TBD states are preserved,
- rerunning bootstrap is idempotent.

---

### Milestone 2 — Observation + Reconciliation Engine

Deliverables:

- source-observation tables
- canonical-field resolver
- authority configuration
- conflict logging
- canonical change history

Acceptance:

- conflicting observations do not blindly overwrite canonical data,
- deterministic source rules produce repeatable results,
- canonical changes create history records.

---

### Milestone 3 — Renderer Prototype — **COMPLETE as a prototype (2026-09-01, contract v1.4)**

Delivered in `scripts/render_day.py` against the Week 1 and Week 8 fixtures: SVG + PNG, team and network branding, 30-minute grid, per-sport blocks, TBD section, uncapped streaming lanes, live enrichment (rankings, lines, records). Acceptance met on the 2026-09-05 stress day and the 2026-10-24 TBD day; Windows-portable (Claude Code runs it). What remains for the production renderer is porting the prototype onto the database (Milestones 1–2) rather than the fixture files, and the multi-sport day layout (§11.9).

---

### Milestone 4 — Web Application

Deliverables:

- Vercel-hosted Next.js app
- week browser
- team search
- daily grid detail page
- PNG download

Acceptance:

- user can locate any included team game,
- user can browse any generated week/day,
- latest graphic displays without manual upload.

---

### Milestone 5 — Automation

Deliverables:

- Monday/Wednesday/Friday GitHub Actions
- refresh pipeline
- render hash
- changed-day selective regeneration
- automated publish/sync

Acceptance:

- unchanged schedules do not regenerate graphics,
- changed games regenerate only affected day artifacts,
- failures preserve last-known-good outputs.

---

### Milestone 6 — Enrichment

Deliverables:

- AP → CFP ranking switch
- announcer ingestion
- rivalry metadata
- championship/bowl/CFP metadata
- streaming badges

Acceptance:

- ranking source switches automatically when official CFP ranking exists,
- broadcast crew appears when available,
- metadata changes trigger regeneration.

---

### Milestone 7 — Production Hardening

Deliverables:

- integration tests
- reconciliation tests
- renderer snapshot tests
- retry/backoff
- run logging
- schema migrations
- deployment documentation
- recovery procedure

Acceptance:

- system survives individual-source outages safely,
- canonical data is auditable,
- repeated scheduled runs are idempotent.

---

### Milestone 8 — Multi-Sport (v0.4 — decision 5)

Deliverables, in order:

1. **NFL + NHL adapters in parallel** (`adapters/espn.py`, `adapters/nhl.py`; `adapters/cfbd.py` extracted from the validation scripts), each writing the sanitized fixture shape the renderer already reads; `markets`/`market_coverage` (Cleveland) and `game_broadcasts.carriage_certainty` populated; the Around the League strip.
2. **NBA** (`adapters/nba.py` — league schedule file with an nba.com Referer; `TBD` national rows late-binding).
3. **MLB** (`adapters/mlb.py` — Stats API with `hydrate=broadcasts(all)`; Apple TV row; open-ended blocks; doubleheaders).

Acceptance:

- Oct 1, 2026 Blue Jackets opener renders with a `TBA` local row and the correct national row;
- an NFL Sunday in November renders CBS/FOX regional splits for Cleveland only, a flex-pending primetime game, and an Around the League strip;
- a November Saturday renders CFB + NFL + NHL + NBA on one grid without geometry collisions;
- Christmas Day 2026 (five ABC/ESPN NBA games) renders as the hero day.

---

## 19. Testing Strategy

Required test categories:

### Unit Tests

- time-to-x-coordinate conversion
- 3.5-hour width
- arbitrary-minute kickoff placement
- lane allocation
- viewer eligibility
- ranking-source selection
- render-hash stability
- network/service normalization

### Reconciliation Tests

Fixtures for:

- lower-authority disagreement
- higher-authority correction
- network change
- kickoff change
- stream-only alternative
- unknown → known transition
- crew assignment change

### Rendering Tests

- snapshot representative day
- no overlap
- no text overflow
- dynamic lane expansion
- TBD section
- ranked vs unranked games
- rivalry/championship indicators

### End-to-End

- ingest → canonicalize → render → publish
- unchanged run
- single-game network change
- TBD assignment resolution

---

## 20. Pre-v1.0 Validation Backlog

Phase 2 source-authority research has substantially completed the conceptual source matrix and conflict architecture. The remaining work is validation and implementation-oriented research.

### 20.1 Authenticated CFBD live validation — COMPLETE (2026-08-31)

Validated against 2026 Week 1. Results, the outlet-normalization table, and schema deltas: §8.6–§8.8. Fixture saved at `artifacts/validation/cfbd_2026_week1_fixture.json` (promote to `tests/fixtures/` at Milestone 1).

Not yet validated by this probe: the TBD lifecycle (zero TBD games existed in Week 1 — see §20.7) and update latency after an official change (requires observing a live mid-season schedule change).

---

### 20.2 Official adapter proof-of-concept — REQUIRED

Implement or prototype parsers against at least:

- one major conference source (Big Ten recommended),
- one ESPN Press Room page,
- one FOX Press Pass page,
- one NBC Sports Pressbox page.

Required validation:

- raw snapshot retention,
- deterministic extraction,
- parser-version tagging,
- behavior when page structure changes,
- no mass deletion on parser failure.

---

### 20.3 Conflict regression fixture — REQUIRED

Use **Toledo at Michigan State, September 4, 2026** as an authority test fixture.

Expected result:

```text
8:00 PM ET
FS1
```

The test should include a conflicting lower-authority `ESPNU` observation and prove that the canonical resolver chooses FS1.

Live note (2026-08-31): CFBD itself already reports FS1 for this game, so the conflicting `ESPNU` observation must be injected synthetically into the test fixture rather than harvested from CFBD.

---

### 20.4 Rendering Contract — COMPLETE (2026-08-31 → 2026-09-01, `docs/rendering-contract.md` v1.4)

Everything below is fixed in the contract; crew overflow rules are deferred with crews themselves (§3.8). Original checklist retained for the record:

- SVG width/height,
- margins,
- row heights,
- network-logo column width,
- time-axis start/end,
- typography,
- font sizes,
- logo sizes,
- block padding,
- line limits,
- crew overflow rules,
- school-color treatment,
- legend,
- TBD/conflict layout,
- dynamic streaming lanes,
- PNG export dimensions.

A real 2026 day should be used for the prototype.

---

### 20.5 Deployment Contract — REQUIRED

Finalize:

- PostgreSQL provider,
- object storage,
- Vercel environment,
- GitHub Actions secrets,
- schedule-refresh clock times,
- observability,
- backup strategy,
- migration tooling.

---

### 20.6 Remaining source-detail work — NON-BLOCKING UNLESS A GAP APPEARS

Continue to catalog:

- exact FBS-independent home-rights sources,
- any network-specific weekly crew page that is easier to parse than press releases,
- official branding asset source/caching strategy,
- postseason source adapters.

These do not block the renderer prototype.

### 20.7 Mid-season TBD probe — COMPLETE (2026-08-31, Week 8)

56 FBS-involving games. Findings:

- **Time-TBD and network-TBD are independent axes**, exactly as §3.6 models. All four combinations occur live: 17 games fully assigned with media, 35 time-TBD with no media row, 1 time-TBD **with** a media row (Hawai'i @ Northern Illinois: `web:MW+`, `isStartTimeTBD: true`), and 3 games with confirmed kickoffs but no media row at all (e.g., LSU @ Auburn, 12:00 PM ET, network unassigned → `time_known_network_tbd`).
- **CFBD's TBD encoding:** `startDate` is set to midnight ET on the game date with `startTimeTBD = true`. The **date half remains authoritative** for day placement; the time half is a placeholder.
- **Renderer hazard confirmed:** consuming `startDate` without gating on `startTimeTBD` would silently place 35 games in a midnight column. The gating rule is now normative in §11.2.
- Unknown labels (MW+, The CW Network, USA Net) were a subset of Week 1's; ESPN2 was newly observed and added to §8.7. The `CW`/`The CW Network` duplication reproduces mid-season.

Fixture saved at `artifacts/validation/cfbd_2026_week8_fixture.json` — the reconciliation and TBD-transition tests (§19) should use Week 8 as the TBD-state fixture and Week 1 as the fully-assigned fixture.

---

## 21. Explicit Non-Goals for v1

Unless later added:

- live scores
- ~~betting lines~~ — **struck v0.4** (decision 2; §3.11)
- game predictions
- player statistics
- fantasy data
- ticketing
- public multi-user accounts
- public commercial distribution
- social-media auto-posting
- mobile native application

---

## 22. Claude Code Handoff Gate

Do **not** hand this spec to Claude Code for full production implementation until all of the following are true:

- [x] CFBD has been live-tested against at least one real 2026 week (Week 1, 2026-08-31)
- [x] official source matrix is substantially complete
- [x] field-specific authority matrix is defined
- [x] conflict-resolution behavior is deterministic
- [x] rendering contract is frozen (v1.0 on 2026-08-31; revised to v1.4 by decision boards the same night)
- [ ] target database/storage providers are selected
- [ ] environment-variable contract is defined
- [ ] milestone acceptance tests are finalized
- [ ] Build Specification reaches **v1.0**

Claude Code may be used earlier for isolated prototypes if desired, especially:

- CFBD ingestion spike
- SVG renderer spike
- schema migration prototype
- Next.js UI shell

but not yet for an unsupervised end-to-end production build.

---

## 23. Proposed Repository Structure

```text
cfb-tv-grid/
├─ apps/
│  └─ web/
│     ├─ app/
│     ├─ components/
│     ├─ lib/
│     └─ public/
│
├─ services/
│  ├─ ingest/
│  │  ├─ providers/
│  │  ├─ normalize/
│  │  ├─ reconcile/
│  │  └─ rankings/
│  │
│  ├─ enrich/
│  │  ├─ announcers/
│  │  ├─ rivalries/
│  │  └─ branding/
│  │
│  └─ render/
│     ├─ layout/
│     ├─ svg/
│     ├─ png/
│     └─ templates/
│
├─ packages/
│  ├─ db/
│  ├─ domain/
│  └─ shared/
│
├─ scripts/
│  ├─ bootstrap_season.py
│  ├─ refresh_schedule.py
│  ├─ render_day.py
│  └─ verify_week.py
│
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  ├─ reconciliation/
│  └─ rendering/
│
├─ migrations/
├─ assets/
├─ docs/
│  ├─ source-authority.md
│  ├─ rendering-contract.md
│  └─ operations.md
│
├─ .github/
│  └─ workflows/
│     ├─ schedule_refresh.yml
│     └─ render_all.yml
│
├─ .env.example
├─ README.md
└─ CFB_TV_GRID_AGENT_BUILD_SPEC.md
```

This structure is provisional and may be adjusted after the deployment contract is finalized.

**Actual repository at v0.4** (`MindLane-NorthStar/MySports`, branch `main`): `scripts/` (`render_day.py`, `probe_enrichment.py`, `validate_cfbd_week1.py`, `fetch_team_assets.py`, `fetch_network_logos.py`), `data/` (`row_order.json`, `rivalries.json`), `docs/` (`rendering-contract.md`, `multisport-plan-v0.4-draft.md`, `research/`), `assets/` (fonts tracked; `logos/` and `network-logos/` untracked pending the asset-storage decision), `artifacts/` (untracked, regenerable). Next additions: `adapters/`, `tests/fixtures/` (promote the Week 1 / Week 8 fixtures), `.github/workflows/`.

---

## 24. Open Product Decisions

Resolved by v0.4 (see §7.23): grid dimensions, row order, font family, school-color treatment, betting lines, market model, non-accessible-game treatment, build order, Apple TV, TBS/NFL Network/ESPN+ access.

Still open:

- whether SVG should also be user-downloadable (recommendation: yes — it is the canonical artifact)
- whether recent change history should be visible on the front end
- exact update times on Monday/Wednesday/Friday
- final PostgreSQL provider (candidate: Supabase, connected)
- final object-storage provider and **asset storage for logos** (candidate: Cloudflare R2, connected) — blocks tracking `assets/logos` and `assets/network-logos`
- final validation of authority adapters against live pages (§20.2)
- final validation of announcer parsers
- final logo licensing/asset strategy for private use
- final strategy for conference realignment/history across seasons
- multi-sport day layout: sport headers vs. interleaved rows (§11.9)
- Cavaliers and Blue Jackets 2026–27 local carriers (awaiting announcement; changelog items 1–2)
- MLB labor situation ahead of 2027 (changelog item 7)

---

## 25. Definition of v1 Success

The first production-ready version is successful when:

1. the 2026 FBS season exists in the database,
2. every qualifying user-accessible game appears on the correct daily grid,
3. CBS Sports Network- and FS2-only games are excluded,
4. kickoff/network updates are detected automatically,
5. conflicts are resolved deterministically without human approval,
6. Monday/Wednesday/Friday runs update the canonical schedule,
7. only changed daily graphics are regenerated,
8. each graphic includes official-looking branding, rankings, streaming badges, and broadcast crews when available,
9. TBD games remain visible until assigned,
10. every day with a qualifying game has a downloadable PNG,
11. the Vercel site supports team and week search,
12. last-known-good outputs survive source failures,
13. all canonical changes remain auditable.

---

## 26. Next Workstream

**Phase 4 — Multi-sport adapters and the deployment contract** (Phase 3B completed in this version)

Immediate sequence:

1. `adapters/` — `cfbd.py` (extract from the validation scripts), `nhl.py`, `espn.py` (NFL) — each emitting the sanitized fixture shape `render_day.py` already reads, so the renderer keeps working while the database is built;
2. render the **Oct 1, 2026 Blue Jackets opener** with a `TBA` local row (first NHL acceptance test) and one September NFL Sunday for Cleveland (first `market_coverage` test);
3. prototype official-source adapters for Big Ten, ESPN, FOX, and NBC (§20.2) and freeze `authority_rules_v1` with the staleness horizon (§9.13);
4. finalize the deployment contract (§20.5) — Supabase, Cloudflare R2, Vercel are connected; the asset-storage decision unblocks tracking logos;
5. update this specification to v1.0 for the Claude Code build handoff.

### Claude Code readiness after Phase 4

Two of the nine §22 gates remain unmet that materially affect the build: providers/environment (deployment contract) and finalized acceptance tests. The domain architecture is stable — the multi-sport research produced roughly a dozen additive relations, not a rethink (§7.17–7.22).

---

## 27. Version History

- **v0.4 (2026-09-01):** renamed to MySports; multi-sport scope, market-of-one, Around the League strip, betting lines in scope, Apple TV/TBS/NFL Network in the access profile, build order (§3.11–3.12); schema deltas (§7.3, §7.4 → `game_broadcasts`, §7.17–7.22); product decision register (§7.23); staleness horizon (§9.13); rendering contract v1.4 made normative and summarized (§11); Milestone 3 complete, Milestone 8 added (§18); §20.4 complete; §21 amended; §22 rendering gate ticked; §24 pruned; §26 → Phase 4.
- **v0.3 (2026-08-31):** Phase 3A CFBD live validation (Week 1 + Week 8), outlet normalization table, simulcast rules, `sport` dimension, TBD gating rule.
- **v0.2 / v0.1 (2026-08-31):** source authority model; initial build specification.

