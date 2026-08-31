# CFB TV Grid Agent — Build Specification

**Version:** 0.1  
**Status:** Living specification / pre-build design  
**Primary use case:** Personal, private use  
**Target implementation:** Python ingestion + rendering, PostgreSQL, GitHub Actions, Next.js/Vercel  
**Primary artifact:** Searchable web application with deterministic daily college-football TV grid graphics and downloadable PNG files

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

canonical_kickoff_at_utc
canonical_kickoff_at_et
kickoff_status

primary_network_id
network_status

ranking_system
home_rank
away_rank

rivalry_id
is_rivalry
is_conference_championship
is_bowl
is_cfp
is_national_championship

viewer_eligible

created_at
updated_at
last_verified_at
```

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
field_name
raw_value
normalized_value
source_url_or_key
source_priority
authority_class
valid_from
```

---

### 7.10 `canonical_change_history`

```text
id
game_id
field_name
old_value
new_value
changed_at
decision_reason
winning_source_observation_id
conflicting_observation_ids
```

---

### 7.11 `generated_grids`

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

### 7.12 `rivalries`

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

### 7.13 `assets`

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

## 8. Primary Structured Data Provider

### Provisional selection

**CollegeFootballData (CFBD)**

Initial plan:

- use free tier during development,
- use Tier 1 if production usage requires it,
- measure actual API consumption before paying,
- do not purchase any API before live testing.

CFBD is currently treated as the **structured backbone**, not the unquestioned final authority.

The system architecture must allow the structured provider to be replaced later without rewriting the entire application.

Implement through a provider interface such as:

```python
class ScheduleProvider:
    fetch_season(...)
    fetch_week(...)
    fetch_media(...)
    fetch_rankings(...)
    fetch_teams(...)
```

---

## 9. Source Authority and Reconciliation

### 9.1 Status

**NOT YET FINALIZED**

This is the primary research phase immediately following v0.1.

A single global source hierarchy must **not** be used.

Authority should be field-specific.

---

### 9.2 Provisional Authority Model

#### Kickoff time

Likely priority:

1. controlling conference / rights-holder official announcement
2. official network announcement
3. official home-school athletics schedule
4. official visiting-school athletics schedule
5. structured sports-data provider
6. reputable schedule aggregator

#### Primary network

Likely priority:

1. controlling conference / rights-holder selection
2. official network announcement
3. official school schedule
4. structured sports-data provider
5. reputable schedule aggregator

#### Streaming simulcast

Likely priority:

1. official rights-holder / streaming-service announcement
2. official network schedule
3. official conference announcement
4. structured sports-data provider

#### Broadcast crew

Likely priority:

1. official network press release / press room
2. official network programming schedule
3. conference official source
4. reputable secondary source

#### Rankings

Authoritative only:

- AP for AP period
- official CFP ranking source once CFP rankings begin

---

### 9.3 Conflict Rule

Fully automatic must never mean “guess.”

If a lower-authority source conflicts with a currently verified higher-authority source:

- retain the higher-authority canonical value,
- store the conflicting observation,
- log the conflict,
- do not regenerate unless the canonical value changes.

If a higher-authority source later changes:

- update canonical value,
- write change history,
- regenerate affected artifacts.

---

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

## 20. Research Backlog Before v1.0 Freeze

The following must be completed before the full Claude Code production handoff.

### 20.1 CFBD Live Validation

Test against a real 2026 week.

Verify:

- complete FBS coverage
- game IDs
- kickoff times
- TBD flags
- primary networks
- streaming outlets
- update latency
- media representation
- team metadata
- ranking coverage

---

### 20.2 Official Source Matrix

Create a maintained source matrix for:

- ACC
- Big Ten
- Big 12
- SEC
- Pac-12
- AAC
- Sun Belt
- MAC
- Mountain West
- Conference USA
- FBS Independents

And for:

- ESPN/ABC
- FOX
- CBS
- NBC
- TNT/truTV/HBO Max
- The CW
- USA
- Peacock
- Paramount+
- ESPN ecosystem

For each source identify:

- schedule URL/API/feed
- machine readability
- field authority
- update frequency
- announcer availability
- failure modes

---

### 20.3 Final Authority Matrix

Define deterministic rules by field:

- date
- kickoff
- primary network
- streaming simulcast
- announcer crew
- ranking
- neutral site
- postseason classification

---

### 20.4 Rendering Contract

Finalize:

- SVG width/height
- margins
- row heights
- network-logo column width
- time-axis start/end
- typography
- font sizes
- logo sizes
- block padding
- line limits
- crew overflow rules
- colors
- legend
- TBD layout
- PNG export dimensions

---

### 20.5 Deployment Contract

Finalize:

- database provider
- object storage
- Vercel environment
- GitHub Actions secrets
- cron times
- observability
- backup strategy
- migration tooling

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

- [ ] CFBD has been live-tested against at least one real 2026 week
- [ ] official source matrix is complete
- [ ] field-specific authority matrix is finalized
- [ ] conflict-resolution behavior is deterministic
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
- final authoritative source hierarchy
- final announcer-source matrix
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

**Phase 2 — Source Authority & Reconciliation Research**

Immediate next tasks:

1. live-test CFBD against a selected 2026 week,
2. build the official conference/network source matrix,
3. measure discrepancies and update latency,
4. define field-specific authority rules,
5. codify conflict-resolution logic,
6. update this specification to v0.2.

---

**End of CFB TV Grid Agent Build Specification v0.1**
