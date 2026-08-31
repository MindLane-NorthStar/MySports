# CFB TV Grid Agent — Source Authority & Reconciliation

**Version:** 0.1  
**Research date:** 2026-08-31  
**Status:** Architecture approved for incorporation into Build Spec v0.2  
**Purpose:** Define how the autonomous agent chooses canonical schedule facts when structured providers, conferences, networks, schools, and aggregators disagree.

---

## 1. Executive Decision

The agent must **not** use a flat source-priority list and must **not** use majority/source voting.

The authoritative answer depends on:

1. **which field** is being decided,
2. **who controls the media rights** for that game,
3. whether an observation is **definite or tentative**,
4. the observation's **authority role**,
5. the official publication/update sequence.

The structured provider (provisionally CFBD) is the discovery and normalization backbone, not the unquestioned source of truth.

---

## 2. Why This Is Necessary

A live 2026 Week 1 example already demonstrates the problem.

### Toledo at Michigan State — Friday, September 4, 2026

Official Big Ten:

```text
8:00 PM ET
FS1
```

Official MAC:

```text
8:00 PM ET
FS1
```

Official FOX:

```text
8:00 PM ET
FS1
```

A current NCAA.com Week 1 schedule:

```text
8:00 PM ET
ESPNU
```

The correct autonomous behavior is **FS1**, because the Big Ten/FOX rights-controlling evidence outranks a general official aggregator.

The NCAA observation is still valuable and should be stored as conflicting evidence.

This example becomes a permanent reconciliation regression fixture.

---

## 3. Rights-Controller Resolution

### 3.1 Standard non-neutral game

Default:

```text
rights controller = home team conference/media-rights system
```

The host's rights context controls unless a special-event contract explicitly says otherwise.

### 3.2 Independent home game

Default:

```text
rights controller = independent school + contracted broadcaster
```

Example:

```text
Notre Dame home game -> Notre Dame/NBC rights context
```

### 3.3 Neutral-site / special event

Default:

```text
rights controller = event organizer or designated media rights holder
```

Do not infer rights solely from either participant's conference.

### 3.4 Postseason

Use:

```text
postseason body/event organizer + designated broadcaster
```

Examples include conference championships, bowls, and CFP events.

---

## 4. Observation Authority Roles

Every observation must be normalized to one role:

| Role | Meaning |
| --- | --- |
| `rights_controller` | Conference, event, or entity that controls the relevant media assignment |
| `broadcaster` | Network/streamer carrying or producing the telecast |
| `host_school` | Official athletics source for the home/host team |
| `visitor_school` | Official athletics source for visiting team |
| `structured_provider` | CFBD or future structured sports-data feed |
| `official_aggregator` | General official schedule source such as NCAA.com |
| `secondary_aggregator` | Reputable third-party schedule site or media listing |

The same organization may play different roles depending on the game and field.

---

## 5. Claim Certainty

Normalize schedule claims to:

| Certainty | Example |
| --- | --- |
| `definite` | `7:30 PM ET — NBC` |
| `window` | `Noon or 3:30 PM` |
| `choice_set` | `FOX or FS1` |
| `flex` | `Friday/Saturday flex` |
| `tbd` | `TBD` |

Tentative values are not discarded. They remain evidence and may appear in the TBD section, but they are not treated as precise placement coordinates until resolved.

---

## 6. Field-Specific Authority Matrix

### 6.1 Date

```text
rights controller / event organizer
> broadcaster when explicitly scheduling the event
> host school
> visitor school
> structured provider
> official aggregator
> secondary aggregator
```

### 6.2 Kickoff

```text
rights controller
> broadcaster
> host school
> visitor school
> structured provider
> official aggregator
> secondary aggregator
```

### 6.3 Primary network

```text
rights controller
> broadcaster
> host school
> visitor school
> structured provider
> official aggregator
> secondary aggregator
```

### 6.4 Streaming outlet / simulcast

```text
broadcaster or streaming service
> rights controller
> host school
> visitor school
> structured provider
> official aggregator
```

### 6.5 Broadcast crew

```text
network first-party press room / game release
> official network programming/commentator page
> rights controller
> host-school game-week notes
> visitor-school game-week notes
> reputable secondary source
```

### 6.6 Ranking

```text
AP period  -> Associated Press
CFP period -> official College Football Playoff ranking
```

A structured provider may cache/transport the ranking but does not redefine it.

### 6.7 Neutral-site / postseason classification

```text
event organizer / NCAA / CFP / controlling conference
> participating schools
> structured provider
```

Context determines which governing source is applicable.

---

## 7. Deterministic Resolution Algorithm

For each game field:

```text
observations = active normalized observations for game/field

rights_context = resolve_rights_context(game)

for observation in observations:
    assign authority_role
    assign certainty
    assign publication/update metadata
    mark stale/superseded observations

candidates = current observations

winner_pool = highest applicable authority role

if one coherent winning claim:
    accept it

elif same-role conflict can be resolved by explicit newer official publication:
    accept newer official claim

elif definitive official claim supersedes earlier tentative official claim:
    accept definitive claim

else:
    if last_known_good exists:
        retain last_known_good
        decision_status = retained_last_known_good
    else:
        no canonical guess
        canonical_state = authority_conflict
        decision_status = unresolved_conflict

write canonical_decisions record

if canonical value changed:
    write canonical_change_history
    mark affected day render-dirty
```

---

## 8. Prohibited Behaviors

The resolver must never:

- use “latest fetched” as the sole authority rule,
- let three low-authority sources outvote one rights-controlling source,
- erase a canonical assignment because an official webpage failed to parse,
- convert a tentative `FOX or FS1` into a definitive FOX assignment,
- infer a missing network from historical tendencies,
- ask an LLM to choose among conflicting schedule facts without deterministic source rules.

---

## 9. Conference Source Matrix — 2026

### ACC

**Official authority:** TheACC.com

2026 official announcement states that additional game times and TV designations are released through **12-day or six-day** selection and posted to official ACC platforms.

Operational use:

- ACC-controlled home game kickoff/network: `rights_controller`
- road game hosted by another league: corroborative only

Primary source:
https://theacc.com/news/2026/5/27/acc-sets-stage-for-2026-football-season-with-early-tv-kickoff-announcements.aspx

---

### Big Ten

**Official authority:** BigTen.org

The Big Ten's 2026 early-season release was issued in collaboration with FOX Sports, CBS Sports, NBC Sports and BTN, and says unannounced times/network designations follow the **12-/6-day in-season selection process**.

It explicitly lists:

```text
Toledo at Michigan State
8:00 PM ET
FS1
```

Primary source:
https://bigten.org/fb/article/60083/

---

### Big 12

**Official authority:** Big12Sports.com

The 2026 opening selections identify ESPN, FOX and TNT-family assignments and state that the remainder will be announced on **12-day or six-day notice**.

Primary source:
https://big12sports.com/news/2026/5/27/big-12-announces-opening-slate-of-football-tv-selections.aspx

---

### SEC

**Official authority:** SECSports.com + ESPN/SEC official releases

The SEC's 2026 broadcast schedule and ESPN windows should control SEC-home assignments under the current media package.

Primary sources:
https://www.secsports.com/2026-sec-football-broadcast-schedule
https://www.secsports.com/news/2026/06/espn-announces-remaining-windows-for-2026-sec-football-season

---

### American Conference

**Official authority:** TheAmerican.org

The conference states most remaining 2026 kickoff and television designations will be released weekly through the **12-day selection process**, with the most current schedule at TheAmerican.org.

Primary source:
https://theamerican.org/news/2026/5/27/american-conference-announces-selected-television-designations-kickoff-times-for-2026-football-schedule.aspx

Important entitlement consequence:

- many Army/Navy-related games use CBS Sports Network,
- those games are excluded for this viewer unless another independently accessible telecast/stream exists.

---

### Conference USA

**Official authority:** ConferenceUSA.com

CUSA's 2026 release states that games appear on CBS Sports Network and ESPN-family outlets and that ESPN-platform games remain subject to the **12-day selection process**.

Primary source:
https://conferenceusa.com/news/2026/5/27/fb-cusa-announces-broadcast-schedule-for-2026-football-season.aspx

Viewer consequence:

- CBSSN-only games are excluded.

---

### MAC

**Official authority:** GetSomeMACtion.com

The official 2026 release provides Week 1 network assignments and serves as corroborating evidence for road games as well.

It lists:

```text
Toledo at Michigan State
8:00 PM ET
FS1
```

Primary source:
https://getsomemaction.com/news/2026/5/27/mac-announces-kickoff-times-broadcasting-schedule-for-2026-football-season.aspx

---

### Sun Belt

**Official authority:** SunBeltSports.org + ESPN partnership releases

The official 2026 update says all other games not already selected fall into the traditional **12-day selection process**.

It also demonstrates multi-platform modeling, including:

```text
Coastal Carolina at West Virginia
TNT / HBO Max
```

Primary source:
https://sunbeltsports.org/news/2026/5/27/sun-belt-espn-announce-updates-to-2026-football-schedule.aspx

---

### Mountain West

**Official authority:** TheMW.com

The conference states CBS Sports, FOX Sports and CW Sports conduct the selection procedure that determines network outlets and kickoff times.

Primary source:
https://themw.com/news/2026/6/4/mw-announces-2026-football-schedule.aspx

Viewer consequence:

- FS2-only and CBSSN-only games are excluded,
- CW/FOX/FS1 games remain eligible,
- exact assignment should be read from the latest official MW selection/weekly release.

---

### Pac-12

**Official authority:** Pac-12.com

The new 2026 Pac-12 media structure is especially useful for testing the streaming model.

Officially documented patterns include:

```text
CBS -> Paramount+ simulcast
The CW -> ESPN App for ESPN Unlimited on applicable Pac-12 broadcasts
```

Pac-12-controlled home rights are distributed among CBS Sports, USA Sports and The CW; road nonconference games fall under the host conference's agreements.

Primary source:
https://pac-12.com/news/2026/5/26/pac-12s-2026-football-broadcast-schedule-and-kickoff-times-announced.aspx

---

### FBS Independents

Use a game-specific rights context.

Examples:

```text
Notre Dame home -> Notre Dame / NBC official sources
Independent road game -> host's conference/rightsholder
Neutral event -> event rights holder
```

Do not build a single “Independents network rule.”

---

## 10. Network / Broadcast Crew Source Matrix

### ESPN family

Includes:

- ABC
- ESPN
- ESPN2
- ESPNU
- ESPN+
- ACC Network
- SEC Network
- authenticated ESPN ecosystem products

**Primary crew authority:** ESPN Press Room

The official 2026-27 commentator schedule provides date, time, game/commentators and where to watch.

Source:
https://espnpressroom.com/2026-27-espn-college-football-commentators-schedule/

---

### FOX / FS1

**Primary crew/network authority:** FOX Sports Press Pass / official FOX college-football schedule.

FOX's 2026 release gives game-specific crews, including the Toledo-Michigan State FS1 crew.

Source:
https://www.foxsports.com/stories/presspass/fox-sports-unveils-star-studded-2026-college-football-roster

---

### Big Ten Network

Use Big Ten/BTN official sources for BTN assignments and talent.

For network-selection conflicts involving Big Ten-controlled games, Big Ten + applicable rights holder outrank general aggregators.

---

### NBC / Peacock

**Primary crew/network authority:** NBC Sports Pressbox.

NBC's official 2026 announcer release provides named Big Ten and Notre Dame teams and confirms NBC/Peacock assignments.

Source:
https://www.nbcsports.com/pressbox/press-releases/nbc-sports-names-college-football-announce-teams-as-season-kicks-off-with-no-14-usc-trojans-hosting-san-jose-state-aug-29-on-nbc-and-peacock

---

### CBS / Paramount+

**Primary authority:** Paramount Press Express / CBS Sports official releases.

Use game-specific network/crew releases where available.

Pac-12 official sources can independently confirm Paramount+ simulcasts for Pac-12 CBS games.

---

### TNT / truTV / HBO Max

**Primary authority:** TNT Sports / Warner Bros. Discovery Sports press room.

Fallback for a game-specific crew:

1. official WBD/TNT release,
2. official host school game-week notes,
3. other participant official notes.

---

### The CW

**Primary crew authority:** CW Press.

The CW officially announced 2026 broadcast-team rosters for ACC, Mountain West and Pac-12 coverage.

Source:
https://www.cwtvpr.com/the-cw/releases/?view=102123-the-cw-network-sets-broadcast-teams-for-2026-acc-mountain-west-and-pac-12-college-football-season

---

### USA Sports

**Primary authority:** USA Sports / Versant official press room.

Use for Pac-12 games carried by USA and game-specific commentator assignments.

---

## 11. Streaming Modeling

Store linear and streaming availability separately.

Example canonical representation:

```json
{
  "primary_network": "CBS",
  "streams": [
    {
      "service": "Paramount+",
      "relationship": "simulcast",
      "viewer_accessible": true
    }
  ]
}
```

Rendering:

```text
CBS row
[game block] [Paramount+ badge]
```

Do not duplicate the game on a Paramount+ row.

For ESPN+-exclusive games:

```text
primary_network = null
primary_service = ESPN+
render_group = ESPN+
```

Dynamic lanes handle concurrency.

---

## 12. Viewer Entitlement Rules

Current profile:

### Available

- ABC
- CBS
- FOX
- NBC
- The CW
- ESPN
- ESPN2
- ESPNU
- FS1
- BTN
- ACCN
- SECN
- USA
- TNT
- truTV
- ESPN Unlimited / ESPN ecosystem
- Peacock Premium
- Paramount+
- HBO Max
- Amazon Prime Video

### Unavailable

- CBS Sports Network
- FS2

Eligibility:

```text
eligible =
    accessible(primary linear outlet)
    OR accessible(any authorized streaming path)
```

A CBSSN-only or FS2-only game is omitted.

A game with an inaccessible primary outlet but a separately authorized accessible stream remains eligible.

Streaming badges shown on the graphic must also be viewer-filtered.

---

## 13. Official Source Adapter Contract

Each official-web source adapter must perform:

```text
FETCH
  -> save status/headers
SNAPSHOT
  -> save raw content or auditable extract
HASH
  -> detect unchanged document
PARSE
  -> parser_version
NORMALIZE
  -> teams, date, time, network, stream, crew
VALIDATE
  -> row counts, known fields, anomaly thresholds
EMIT OBSERVATIONS
```

### Mandatory fail-safe behavior

If parse output unexpectedly falls to zero or a known table disappears:

```text
adapter status = degraded
canonical data = unchanged
warning = logged
```

Never translate parser failure into a schedule deletion.

---

## 14. Source Snapshot Requirements

Store:

```text
source
URL/key
fetched_at
HTTP status
content hash
content type
parser version
parse status
snapshot storage pointer
```

These snapshots are operational evidence, not public site content.

---

## 15. Publication/Freshness Rules

Prefer:

```text
explicit source updated_at
> explicit source published_at
> source document version/change
> fetch time
```

Fetch time alone must never elevate a lower-authority source.

---

## 16. Canonical Decision Audit

Every resolver run should be able to answer:

```text
Which observations were considered?
Which source role won?
Which rule version was used?
Was the winning claim definite or tentative?
Were conflicts rejected?
Why was last-known-good retained?
Did the canonical value change?
Which day grid was marked dirty?
```

Recommended table:

```text
canonical_decisions
```

Separate this from `canonical_change_history`, since decisions should be auditable even when the canonical value does not change.

---

## 17. CFBD Validation Status

### Confirmed from current docs

CFBD documents:

- `/games`
- `/games/media`
- `/calendar`
- `/scoreboard`
- team/conference endpoints
- bearer authentication

The `/games/media` response includes:

```text
id
season
week
startTime
isStartTimeTBD
homeTeam
awayTeam
mediaType
outlet
```

Media types include:

```text
tv
radio
web
ppv
mobile
```

### Current pricing

As researched 2026-08-31:

```text
Free:   $0/month  -> 1,000 calls
Tier 1: $1/month  -> 5,000 calls
Tier 2: $5/month  -> 30,000 calls
Tier 3: $10/month -> 75,000 calls + GraphQL
```

The project should start Free.

### Still required

An authenticated call has **not** been fabricated or assumed.

To finish the validation we need to securely run a real request using a free CFBD bearer key and compare the result against official Week 1 sources.

The key must be stored as:

```text
CFBD_API_KEY
```

and never pasted into source code, committed to Git, or exposed in the browser.

---

## 18. Week 1 Validation Fixture

Recommended initial date range:

```text
2026-09-03 through 2026-09-07
```

Must specifically test:

- ordinary linear game,
- ESPN+ exclusive,
- NBC + Peacock,
- CBS + Paramount+,
- TNT + HBO Max,
- non-half-hour kickoff,
- conflicting source assignment,
- excluded-network game,
- FBS vs FCS opponent handling.

Mandatory conflict fixture:

```text
Toledo @ Michigan State
2026-09-04
8:00 PM ET
canonical network = FS1
```

---

## 19. Phase 2 Conclusion

The source/reconciliation architecture is mature enough to proceed.

### Frozen concepts

- field-specific authority
- rights-context determination
- observation roles
- certainty states
- no source voting
- fail-closed parsing
- last-known-good preservation
- unresolved conflict state
- decision audit records
- official network press rooms for crews
- CFBD as structured backbone, not authority

### Remaining pre-build validation

1. authenticated CFBD Week 1 probe,
2. official adapter proof-of-concept,
3. rendering contract,
4. deployment-provider selection.

---

## 20. Research Source Index

Primary official sources used for this v0.1 authority design:

- CollegeFootballData API documentation: https://apinext.collegefootballdata.com/api/games
- CollegeFootballData API tiers: https://collegefootballdata.com/api-tiers
- CollegeFootballData key/security/terms: https://collegefootballdata.com/key
- ACC: https://theacc.com/news/2026/5/27/acc-sets-stage-for-2026-football-season-with-early-tv-kickoff-announcements.aspx
- Big Ten: https://bigten.org/fb/article/60083/
- Big 12: https://big12sports.com/news/2026/5/27/big-12-announces-opening-slate-of-football-tv-selections.aspx
- SEC: https://www.secsports.com/2026-sec-football-broadcast-schedule
- American: https://theamerican.org/news/2026/5/27/american-conference-announces-selected-television-designations-kickoff-times-for-2026-football-schedule.aspx
- Conference USA: https://conferenceusa.com/news/2026/5/27/fb-cusa-announces-broadcast-schedule-for-2026-football-season.aspx
- MAC: https://getsomemaction.com/news/2026/5/27/mac-announces-kickoff-times-broadcasting-schedule-for-2026-football-season.aspx
- Sun Belt: https://sunbeltsports.org/news/2026/5/27/sun-belt-espn-announce-updates-to-2026-football-schedule.aspx
- Mountain West: https://themw.com/news/2026/6/4/mw-announces-2026-football-schedule.aspx
- Pac-12: https://pac-12.com/news/2026/5/26/pac-12s-2026-football-broadcast-schedule-and-kickoff-times-announced.aspx
- ESPN Press Room: https://espnpressroom.com/2026-27-espn-college-football-commentators-schedule/
- FOX Sports: https://www.foxsports.com/stories/presspass/fox-sports-unveils-star-studded-2026-college-football-roster
- NBC Sports Pressbox: https://www.nbcsports.com/pressbox/
- CW Press: https://www.cwtvpr.com/
- NCAA Week 1 comparison source: https://www.ncaa.com/news/football/article/2026-08-24/college-football-schedule-when-does-2026-college-football-season-start

---

**End of Source Authority & Reconciliation v0.1**
