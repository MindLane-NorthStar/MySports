# CFB TV Grid Agent — Build Specification

**Version:** 0.3  
**Status:** Living specification / Phase 3A CFBD live validation complete  
**Primary use case:** Personal, private use  
**Target implementation:** Python ingestion + rendering, PostgreSQL, GitHub Actions, Next.js/Vercel  
**Primary artifact:** Searchable web application with deterministic daily college-football TV grid graphics and downloadable PNG files

**Phase 2 research completed:** 2026-08-31  
**Companion document:** `CFB_TV_GRID_AGENT_SOURCE_AUTHORITY_v0.1.md`  
**Phase 3A validation completed:** 2026-08-31 — artifacts in `artifacts/validation/` (`cfbd_2026_week1_report.md`, `cfbd_2026_week1_fixture.json`)

---

## 1. Purpose

Build an automated system that maintains a season-long database of FBS college football games, continuously updates kickoff times, television/streaming assignments, rankings, broadcast crews, and selected metadata, and automatically generates a polished TV-grid graphic for every calendar day containing at least one qualifying game.

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

- **Rows:** linear television networks or grouped streaming platforms.
- **Columns:** Eastern Time in 30-minute increments.
- **Game blocks:** fixed 3.5-hour duration.
- **Primary placement:** each game appears once on its primary telecast row.
- **Streaming availability:** secondary streaming outlets appear as badges within the same game block.
- **TBD games:** displayed in a dedicated TBD section until assigned a time/network.
- **Concurrent streaming games:** handled through dynamic sub-lanes under the applicable streaming service.

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

Current known exclusions:

- **CBS Sports Network**
- **FS2**

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
- Game-block duration: **3.5 hours**
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

- service logo appears once for the group where practical,
- lane count is calculated dynamically,
- row height expands automatically,
- lane allocation must be deterministic.

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

Rivalry metadata must come from a maintained metadata source and must not be inferred dynamically from model output.

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
external_primary_id
season
week
game_date
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

primary_network_id
network_status
network_certainty

ranking_system
home_rank
away_rank

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

---

### 7.4 `game_streams`

Supports one-to-many streaming availability.

```text
id
game_id
service_id
stream_type
is_primary
requires_auth
access_status
source_observation_id
```

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
name
team_a_id
team_b_id
trophy_name
display_label
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
- Saturday 2026-09-05 carries **68 FBS-involving games, 18 on ESPN+**, with **nine ESPN+ kickoffs at 7:00 PM ET simultaneously**. With 3.5-hour blocks, the ESPN+ group needs roughly 12–13 concurrent lanes at peak; the §3.5 dynamic-lane design must remain legible at that density or define an explicit overflow policy.

---

### 8.7 Canonical outlet-normalization table (v1, from live Week 1 data)

Every outlet label observed in the 2026 Week 1 media feed, with its canonical mapping and access classification under the §3.2 profile:

| CFBD raw label(s) | Canonical service | Type | Access |
| --- | --- | --- | --- |
| ABC | ABC | linear_broadcast | available |
| CBS | CBS | linear_broadcast | available |
| FOX | FOX | linear_broadcast | available |
| NBC | NBC | linear_broadcast | available |
| CW, The CW Network | The CW | linear_broadcast | available |
| ESPN | ESPN | linear_cable | available |
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
```

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

### 11.2 Grid Geometry

The exact pixel dimensions will be finalized in the rendering contract.

Core rules:

```text
row = primary network/service
column interval = 30 minutes
game width = 3.5 hours
```

Seven 30-minute units represent one game block.

For arbitrary kickoff minute:

```text
x = grid_start_x + minutes_since_grid_start * pixels_per_minute
```

Do not snap to a 30-minute boundary.

---

### 11.3 Network Ordering

Initial sort concept:

1. national broadcast networks
2. major national cable sports networks
3. conference networks
4. secondary linear networks
5. streaming-exclusive services

Exact ordering remains to be finalized.

Rows with no qualifying games for that day should generally be omitted from the final graphic unless needed for layout consistency.

---

### 11.4 Game Block Anatomy

Preferred content hierarchy:

```text
[ranking badge] team logo  TEAM
                      vs / at
[ranking badge] team logo  TEAM

Kickoff
Streaming badges
Broadcast crew
Rivalry / championship indicator
```

Actual orientation may be horizontal or compact depending on block dimensions.

Required priorities:

1. teams
2. kickoff
3. logos
4. rankings
5. streaming badge(s)
6. broadcast crew
7. rivalry/championship metadata

---

### 11.5 Color-Coded Blocks

Game blocks should use official school colors in a consistent and legible way.

Potential strategies to test:

- split-color background,
- neutral card with team-color bands,
- gradient avoided unless readability remains excellent.

Accessibility rules:

- enforce sufficient text contrast,
- define light/dark text switching,
- never rely solely on color to convey meaning.

---

### 11.6 TBD Section

The TBD section should be located below the time grid.

Suggested fields:

```text
Matchup
Known date
Known time, if available
Known network, if available
Status
```

TBD section should support multiple categories if visually useful:

- Time TBD
- Network TBD
- Time + Network TBD

Final presentation to be determined during rendering prototype.

---

### 11.7 Legend

Include a compact legend for:

- ranking source
- rivalry marker
- conference championship marker
- bowl/CFP marker
- streaming badge meaning
- TBD state if necessary

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

### Milestone 3 — Renderer Prototype

Deliverables:

- one real 2026 day rendered to SVG
- PNG conversion
- team logos/colors
- network logos
- 30-minute grid
- 3.5-hour blocks
- TBD section
- dynamic streaming lanes

Acceptance:

- no game-block overlaps,
- arbitrary kickoff minutes render correctly,
- SVG and PNG agree visually,
- graphic remains readable at target download size.

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

### 20.4 Rendering Contract — REQUIRED

Finalize:

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

### 20.7 Mid-season TBD probe — REQUIRED before Milestone 2 acceptance

Week 1 contained zero TBD games, so the §3.6 TBD states remain unexercised against live data. Run `scripts/validate_cfbd_week1.py --week 8` (three API calls) to capture games still awaiting 12-day/6-day selections, and confirm that `startTimeTBD` flags and absent/partial network rows behave as modeled.

---

## 21. Explicit Non-Goals for v1

Unless later added:

- live scores
- betting lines
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
- [ ] rendering contract is frozen
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

---

## 24. Open Product Decisions

These remain unresolved as of v0.1:

- exact grid canvas dimensions
- exact network row order
- exact font family
- exact visual treatment of school colors
- whether SVG should also be user-downloadable
- whether recent change history should be visible on the public/private front end
- exact update times on Monday/Wednesday/Friday
- final PostgreSQL provider
- final object-storage provider
- final validation of authority adapters against live pages
- final validation of announcer parsers
- final logo licensing/asset strategy for private use
- final strategy for conference realignment/history across seasons

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

**Phase 3B — Rendering Contract** (Phase 3A completed in this version)

Immediate sequence:

1. run the §20.7 mid-season TBD probe;
2. design and prototype the SVG rendering contract using Saturday 2026-09-05 as the stress day (68 games, 18 on ESPN+, nine simultaneous 7:00 PM kickoffs);
3. prototype official-source adapters for Big Ten, ESPN, FOX, and NBC;
4. freeze authority rules as `authority_rules_v1`;
5. finalize the deployment contract — candidate providers already connected to Joe's Claude workspace: Supabase (PostgreSQL), Cloudflare R2 (object storage), Vercel (hosting);
6. update this specification to v1.0 for the Claude Code build handoff.

### Claude Code readiness after Phase 3

After the authenticated data probe and renderer contract are complete, the project should be close to the **v1.0 Claude Code handoff**. Deployment-provider selection and final acceptance criteria can then be completed without materially changing the domain architecture.

