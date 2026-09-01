# MySports — MLB Adapter Brief (Milestone 8.3, pre-build)

**Written:** 2026-09-01, ~17:15 ET (claude.ai project research session, Prompt C of `claude/parallel-session-prompts.md`). Research and Project-doc only: no repo writes, no database writes, no scheduled tasks. Another session is the repo steward.
**Purpose:** everything `adapters/mlb.py` needs before code is written, at the depth of `research-nhl.md` / `research-nba.md` that preceded the NHL and NBA adapters, plus a fixture mapping table in the style the other adapters document.
**Method:** live read-only GETs against `statsapi.mlb.com` from the org workspace (the host is on the network allowlist), 2026-09-01 21:06–21:14 UTC. Roughly 3,700 games and 4,700 broadcast rows were read across the 2026 season; every raw outlet spelling below was observed in a payload, not recalled. Web research only for the facts an API cannot tell you (carriage, prices, labor).
**Confidence key:** **[VERIFIED]** = seen in a live payload or a primary source this session · **[INFERRED]** = reasoned from verified facts · **[UNVERIFIED]** = not confirmable from here.

---

## 0. Headline recommendation

**Build `adapters/mlb.py` on `statsapi.mlb.com`, and build it as a schedule-plus-broadcasts-plus-odds adapter in one call.** The MLB Stats API is open (no key, no registration, HTTP 200 from the workspace), and one `schedule` request with `hydrate=broadcasts(all),team,venue,seriesStatus,statusFlags,preGameOdds` returns, per game: stable ids, UTC first pitch, a real `startTimeTBD` flag, venue, both teams with records, **every TV and radio telecast with a national/local discriminator and a home/away feed side**, doubleheader type and game number, series position, postponement and resumption linkage, and pre-game moneyline/runline/total from two sportsbooks. That is the CFBD `/games/media` equivalent the brief hoped for, plus the odds source, in a single league-operated payload. MLB is the best-instrumented of the four pro leagues for exactly what MySports needs.

**Retraction of last session's warning.** `research-mlb.md` §1 said three fetches returned HTTP 400 and the docs site showed an Okta login, and it recommended treating the backbone as unresolved. The API is not gated. The 400s were an artifact of the research fetch tool; `statsapi.mlb.com/docs/` does sit behind Okta (developer documentation only), but the API endpoints themselves are public. A ready-to-paste changelog entry is in §13.

**What is genuinely hard about MLB is unchanged, but the API carries most of the burden:**

1. **Every game has two local feeds.** The API gives each its own row with `homeAway` and a `local_in_market` / `local_out_of_market` code. `feed_side` (spec delta from the research batch) is populated directly.
2. **National exclusives suppress the local feeds.** The API encodes this **by omission**: when Apple TV, Netflix, NBC/Peacock Sunday Night Baseball, FOX Saturday, or an ESPN-package game takes a game, the local TV rows are simply absent. `suppresses_local_feed` is therefore derived, not read, and the Milestone 2 loader's withdrawal semantics (rows absent from the newest snapshot are closed) already implement the transition. One safety rule is needed (§10.4).
3. **FOX Saturday is regional.** Two or three simultaneous 7:15 PM ET games all labeled `FOX / FOX ONE`. Cleveland receives one. This is the NFL coverage-map problem at one-fifth scale, on about 25 Saturdays a year, and it needs a `market_coverage_mlb.json` hand entry from 506sports exactly as the NFL does — except that any Saturday with a Guardians game on FOX resolves itself.
4. **Doubleheaders, postponements, and resumptions are all first-class in the payload** and each has a clean rule (§7).

**For Joe specifically:** the Guardians' local row arrives from the API as `Guardians.TV Presented by Progressive` (call sign `CLEG`) on 150 of 166 regular-season games, with `WKYC 3` as a second, over-the-air row on 10 of them. Nothing has to be synthesized, unlike the Blue Jackets' `CBJ LOCAL` row or the Cavaliers' hand-entered DAZN row. The access question is one dashboard check: whether DIRECTV CHOICE carries Guardians TV on channel 662 (§5).

**Build-order note.** The CBA expires December 1, 2026 and a lockout is widely expected to follow; the 2027 schedule was released July 16, 2026 contingent on a new agreement (§4.3). That is why MLB was ranked last in `research-summary.md`, and nothing found today changes it. But the adapter itself is now the cheapest of the four to write, and the 2026 postseason (Wild Card round begins September 29) is a live target with real national rows already in the feed. Recommendation: write the adapter for the 2026 postseason, prove it on the Guardians' September games, and let the 2027 renderer wait on the labor outcome.

---

## 1. Endpoints, auth, reachability, rate limits

### 1.1 Reachability **[VERIFIED]**

| Test (2026-09-01 21:06 UTC) | Result |
|---|---|
| `GET https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-09-01` | HTTP 200, 19 KB, 15 games. No key, no cookie, custom `User-Agent: MySports-research/1.0` accepted. |
| Same with `&hydrate=broadcasts(all),venue,team,linescore,seriesStatus,gameInfo,flags,weather,probablePitcher` | HTTP 200. |
| `startDate=2026-08-01&endDate=2026-10-05&hydrate=broadcasts(all),venue,seriesStatus,flags` | HTTP 200, 798 games in one response. |
| `teamId=114&startDate=2026-03-01&endDate=2026-10-31&hydrate=broadcasts(all)` | HTTP 200, 188 Guardians games (166 R + 22 S). |
| `startDate=2026-03-01&endDate=2026-11-15` (no hydrate) | HTTP 200, 2,869 games in one response. |
| `GET /api/v1/teams?sportId=1&season=2026` | HTTP 200, 30 teams. |
| `GET /api/v1/gameStatus`, `/api/v1/gameTypes`, `/api/v1/seasons?sportId=1&season=2027`, `/api/v1/schedule?sportId=1&hydrate=hydrations` | HTTP 200 (enumerations; see §1.4). |

Response headers: `cache-control: max-age=20, public, stale-while-revalidate=30, stale-if-error=86400`, served through Fastly (`x-served-by: cache-iad-…`, `x-cache: HIT`). **No rate-limit, retry, or quota headers of any kind.** The `copyright` field on every response reads "Use of any content on this page acknowledges agreement to the terms posted here" — see §12 Q7.

**Rate limits [UNVERIFIED as to a hard number]:** none published; none observed. The 20-second edge cache means repeated identical requests inside 20 s are served from cache anyway. Recommended posture, same as the NHL adapter: one window request per run, at most one request per second, aggressive local caching, and a `raw/` snapshot of every payload for audit (spec §7.15).

### 1.2 The schedule endpoint **[VERIFIED]**

`GET /api/v1/schedule` with:

| Parameter | Use |
|---|---|
| `sportId=1` | MLB (required; other ids are minor leagues) |
| `date=YYYY-MM-DD` **or** `startDate`/`endDate` | Buckets are keyed on **`officialDate`**, the ballpark-local calendar date, not the UTC date. A 10:10 PM ET West Coast start on Sept 23 (`gameDate` `2026-09-24T02:10:00Z`) is returned under `2026-09-23`. 191 of the 798 games in the Aug–Oct window have a UTC date that differs from `officialDate`; the bucket never disagrees with `officialDate` (0 mismatches). **This is the viewing-day cutover for free** — see §7.5. |
| `teamId=114` | Filter to a club (Guardians). Optional; the adapter should fetch the whole league and filter locally so the Around the League strip has data. |
| `gameType=R` | Optional filter. Values in §1.4. |
| `hydrate=` | Comma-separated, nested with parentheses. |

Top level: `{copyright, totalItems, totalEvents, totalGames, totalGamesInProgress, dates: [{date, totalGames, games: [...]}]}`.

**Game object, unhydrated (every key observed):** `gamePk` (int, the stable id), `gameGuid`, `link` (`/api/v1.1/game/{pk}/feed/live`), `gameType`, `season` ("2026"), `seasonDisplay`, `gameDate` (ISO-8601 UTC with `Z`), `officialDate`, `status{abstractGameState, codedGameState, detailedState, statusCode, startTimeTBD, abstractGameCode, reason?}`, `teams{away|home: {team{id,name,link}, leagueRecord{wins,losses,ties,pct}, score, splitSquad, seriesNumber, isWinner?}}`, `venue{id,name,link}`, `content{link}`, `gameNumber`, `publicFacing`, `doubleHeader` (`N`|`S`|`Y`), `gamedayType`, `tiebreaker`, `calendarEventID`, `dayNight`, `scheduledInnings`, `reverseHomeAwayStatus`, `inningBreakLength`, `gamesInSeries`, `seriesGameNumber`, `seriesDescription`, `recordSource`, `ifNecessary`, `ifNecessaryDescription`; and on some games `description` (e.g. `"Makeup of 6/14 PPD"`, `"MLB at Field of Dreams"`, `"AL Wild Card 'A' Game 1"`), `rescheduledFrom`, `rescheduledFromDate`, `rescheduleDate`, `resumeDate`, `resumedFrom`, `isTie`.

`gameDate` accepts `adapters.common.parse_iso` as-is (trailing `Z`). **No `week` concept exists**; the fixture's `week` should be `null` for MLB, as the NHL and NBA fixtures presumably already do.

### 1.3 Hydrations the adapter needs **[VERIFIED — each tested]**

| Hydration | Adds | Notes |
|---|---|---|
| `broadcasts(all)` | `broadcasts[]` on each game — TV, AM, FM rows. Row shape in §2.1. | `broadcasts` (without `(all)`) returned the identical row set on 2026-09-02 (33 TV / 40 AM / 17 FM both ways) plus a `tags` key; community docs describing the bare form as "national only" are stale. Use `broadcasts(all)`; drop AM/FM rows in the adapter. |
| `team` | Expands `teams.*.team` to the full team object: `abbreviation`, `teamName`, `locationName`, `franchiseName`, `clubName`, `shortName`, `fileCode`, `teamCode`, `league{id,name}`, `division{id,name}`, `venue{id,name}`, `springLeague`. | Saves a join to the teams file at fixture time, but the teams file is still needed for colors and logos (§6). |
| `venue` | Expands `venue` to `{id, name, link, active, season}`. | Name only — no city/state in this hydration. Adequate for the fixture's `venue` string. |
| `seriesStatus` | `{gameNumber, totalGames, isTied, isOver, wins, losses, winningTeam, losingTeam, description, shortDescription, result, shortName, abbreviation}` | Footer-tray content ("Game 2 of 3"). `seriesGameNumber` / `gamesInSeries` on the bare game object cover the basic case without it. |
| `statusFlags` | Booleans: `isAllStarGame, isCancelled, isClassicDoubleHeader, isSplitTicketDoubleHeader, isNonDoubleHeaderTBD, isCompletedEarly, isDelayed, isDoubleHeader, isExhibition, isFinal, isForfeit, isGameOver, isInstantReplay, isLive, isManagerChallenge, isPostponed, isPreview, isSpring, isSuspended, isSuspendedOnDate, isSuspendedResumptionOnDate, isTBD, isTieBreaker, isUmpireReview, isWarmup, isPostSeason, isPostSeasonReady, isWildCard, isDivisionSeries, isChampionshopSeries (sic), isWorldSeries, isPreGameDelay, isInGameDelay` | The cleanest source for §7's rules. Note the upstream typo `isChampionshopSeries`; read it exactly. |
| `preGameOdds` | `preGameOdds[]`: per provider `{provider{id,name}, lastUpdated, totalOdds{over, under, totalRuns}, teamOdds[{homeTeam, teamId, moneyline, runline, runlineValue}]}` — providers observed: **BetMGM** (id 2) and **FanDuel** (id 1). FanDuel rows also carry `eventUrl`, `moneylineUrl`, `runlineUrl`, `url` deep links. | Values are strings (`"-143"`, `"+1.5"`, `"9.5"`). **Retires the ESPN dependency for MLB odds.** Strip the deep links (same guidance as the research batch gave for ESPN's DraftKings block). |
| `linescore` | Inning-by-inning state for live/final games. | Only needed if the renderer ever draws the `open_ended` trailing edge from live state; not needed for the fixture. |
| `flags` | No-hitter / perfect-game flags. | Not needed. |
| `probablePitcher`, `weather`, `gameInfo`, `lineups`, `decisions` | Available; not needed for the grid. | |

The full valid list from `hydrate=hydrations` (89 entries) is in the appendix. Hashing that list at each run is a cheap schema-drift alarm, as `research-mlb.md` suggested.

**Recommended adapter call:**

```
/api/v1/schedule?sportId=1&startDate={D}&endDate={D+6}
  &hydrate=broadcasts(all),team,venue,seriesStatus,statusFlags,preGameOdds
```

One request per 7-day window, matching `adapters/nhl.py`'s window convention. Measured size: ~100 KB per day hydrated. Spring training (`gameType=S`) should be excluded by the adapter, not by the query, so that the raw snapshot stays complete.

### 1.4 Enumerations **[VERIFIED — `/api/v1/gameTypes`, `/api/v1/gameStatus`]**

`gameType`: `S` Spring Training · `R` Regular Season · `F` Wild Card · `D` Division Series · `L` League Championship Series · `W` World Series · `C` Championship · `P` Postseason · `A` All-Star Game · `I` Intrasquad · `E` Exhibition. The 2026 schedule holds R 2,458 · S 321 · E 36 · D 20 · L 14 · F 12 · W 7 · A 1.

`status.statusCode` is a two-character code whose **first letter is the family** and second letter the reason (Rain, Snow, Wet Grounds, Venue, Fog, Cold, Air Quality, Wind, Inclement Weather, Power, Lightning, Emergency, Tragedy, Ceremony, Mercy, Tied, …). Families that matter to the adapter:

| First letter | Family | `abstractGameState` | Adapter treatment |
|---|---|---|---|
| `S` | Scheduled | Preview | normal |
| `P` | Pre-Game / Delayed Start: … | Preview | normal; `PR`… = pre-game delay (render normally, footer note optional) |
| `I`, `M`, `N` | In Progress / Delayed / Manager challenge / Umpire review | Live | normal (live) |
| `F`, `O` | Final / Game Over / Completed Early: … / Final: Tied | Final | normal; `FR` = called for rain (seen 7×), `FT` = tie (seen 16×, spring) |
| `D` | Postponed: … | Final | **tombstone** — see §7.2 |
| `C` | Cancelled: … | Final | tombstone, no makeup |
| `T`, `U` | Suspended: … | Live | **suspended** — see §7.3 |
| `Q`, `R` | Forfeit | Final | normal |
| `X`, `W` | Unknown / Writing | Other | log and skip |

2026 census to date: F 2,393 · S 402 · DR 17 · FT 16 · P 12 · DI 9 · FR 7 · FM 5 · FO 4 · CR 2 · CG 1 · DD 1. **No suspended game has occurred in 2026 as of today**, so §7.3 is specified from the enumeration and the documented fields, not from an observed payload — marked accordingly.

### 1.5 Season dates **[VERIFIED — `/api/v1/seasons`]**

2026: regular season 2026-03-25 → 2026-09-27; postseason 2026-09-28 → 2026-10-31. 2027 (already in the API): spring 2027-02-20 → 03-24; regular season **2027-03-25** → 2027-09-26; All-Star 2027-07-13; postseason 2027-09-27 → 10-31. Wikipedia's 2027 season page says the regular season "would begin on March 24" with a standalone night game (https://en.wikipedia.org/wiki/2027_Major_League_Baseball_season) — a one-day discrepancy with the API's `regularSeasonStartDate`, consistent with an Opening Night the API counts as a preseason-dated special. **[UNVERIFIED which is right; irrelevant until 2027 games exist.]**

---

## 2. Broadcast rows — the shape and what the codes mean

### 2.1 Row shape **[VERIFIED — every key observed]**

```json
{
 "id": 6218,
 "name": "Guardians.TV Presented by Progressive",
 "type": "TV",                       // TV | AM | FM
 "language": "en",                   // en | es | fr
 "isNational": false,
 "callSign": "CLEG",
 "homeAway": "home",                 // home | away — the FEED SIDE
 "availability": {"availabilityId": 1, "availabilityCode": "local_in_market", "availabilityText": "Local (In Market)"},
 "availableForStreaming": true,
 "mvpdAuthRequired": false,
 "freeGame": false, "freeGameStatus": false,
 "postGameShow": true,
 "mediaId": "…", "gameDateBroadcastGuid": "…", "broadcastDate": "2026-09-18",
 "mediaState": {"mediaStateCode": "MEDIA_OFF"},   // MEDIA_OFF | MEDIA_ON | MEDIA_ARCHIVE
 "videoResolution": {"code": "FHD", …}, "colorSpace": {"code": "SDR", …}
}
```

`broadcasts.id` is a **stable outlet id** (782 = WKYC 3, 6218 = Guardians.TV, 2742 = NBCSCA) — better than the name for the alias table's `source_key`, since sponsor suffixes change ("Guardians.TV Presented by Progressive" is the same outlet id season to season, presumably). **[INFERRED — id stability across seasons not verifiable from one season.]**

### 2.2 `availability.availabilityCode` **[VERIFIED — full census of 4,737 rows, Aug 1–Oct 5]**

| Code | Text | Seen on | Meaning (inferred from which outlets carry it) |
|---|---|---|---|
| `national` | National | 190 TV, 40 AM | National package row. Local rows **may** coexist (TBS Tuesdays, MLB Network) or may be absent (FOX Saturday, ESPN package, Peacock/NBCSN Sunday Leadoff). |
| `exclusive` | Exclusive | 44 TV | National **exclusive**: Apple TV, Netflix, NBC/Peacock Sunday Night Baseball, some Peacock/NBCSN. **No local TV rows exist on these games** (22 of 22 checked). |
| `local_in_market` | Local (In Market) | 1,060 TV, 7 AM | A club feed that has an **in-market streaming product** (all MLB-produced `Club.TV` feeds, plus MASN, SNY, NBCS BA/CA/P, SportsNet LA, Detroit SportsNet…). |
| `local_out_of_market` | Local (Out of Market) | 465 TV, 2,093 AM, 838 FM | A club feed available on MLB.TV only outside its territory (NESN, YES, Marquee, CHSN, SNP, SCHN, Rangers Sports Network, Sportsnet/SN1/TVA, and — importantly — **over-the-air simulcasts such as `WKYC 3`**). |

**Read this as a streaming-rights code, not a viewer-access code.** `WKYC 3` is `local_out_of_market` because the WKYC feed is not part of any in-market streaming product — yet it is the one Guardians telecast every Cleveland household with an antenna can watch free. The adapter must **not** map `availabilityCode` to `access`; access comes from `data/access_profile.json` and `data/local_rights.json` as in the other adapters. `availabilityCode` populates `market` (national vs local) and feeds the footer ("streams on CLEGuardians.TV").

### 2.3 National rows come in pairs **[VERIFIED]**

Every national or exclusive outlet appears **twice** per game — one row `homeAway: "home"`, one `"away"`, same `name` — with `availableForStreaming` true on exactly one of them. This is the API's way of saying the national feed is served to both markets. The adapter must **dedupe national rows by (`name`) and emit one media row with `feed_side: NATIONAL`**; otherwise every FOX game becomes two FOX rows and the reconciler's LINEAR-beats-STREAMING tie-break has nothing to break.

### 2.4 Suppression by omission **[VERIFIED — the most important structural finding]**

| National outlet on the game | Local TV rows present? | Interpretation |
|---|---|---|
| `Apple TV`, `Netflix`, `NBC/Peacock` (`exclusive`), `Peacock/NBCSN` (`exclusive`) | **No** (22/22) | Exclusive; local feed does not exist |
| `FOX / FOX ONE`, `FOX / FS1` (Saturday 7:15 ET) | **No** (checked Aug 1, 8, 15, Sep 5, 26) | FOX Saturday is exclusive to FOX platforms |
| `ESPN/ESPN App`, `ABC/ESPN App` | **No** | ESPN's 30-game package is exclusive |
| `Peacock / NBCSN Extra`, `Peacock/NBCSN` (`national`) | **No** (Sunday Leadoff) | Exclusive to NBCU platforms; MLB.TV blacked out per NBCU's own terms |
| `TBS`, `TruTV` (Tuesday) | **Yes** — both club feeds present | TBS is blacked out in the two clubs' markets; locals carry there |
| `MLB Network` / `MLBN` | **Yes** — both club feeds present (9/9) | MLBN blacked out in the two markets ("MLBN alt" in 506sports terms) |
| `FS1` (non-Saturday, e.g. Aug 1 Twins @ Mariners) | **Yes** | FS1 national with locals intact |

So: **`suppresses_local_feed` is true exactly when a game has national rows and zero local TV rows.** The adapter should compute and emit it per game (a fixture-level boolean, additive), and the loader's existing behavior — a broadcast row absent from the newest snapshot gets `valid_to` set and `game_broadcasts.active` flips — handles a late pickup (ESPN adds a game and the club feeds vanish) with no new code. The guard in §10.4 keeps a failed hydration from being mistaken for a league-wide suppression.

The one anomaly: **`TBS (out-of-market only)`** appeared once (Sept 8, Astros @ Phillies) as a second TBS row alongside a plain `TBS` national row, with both club feeds present. Treat it as an alias of TBS with the blackout note; do not create a second network.

### 2.5 Radio rows

`AM`/`FM` rows are 63% of all rows. Drop them in the adapter. If a radio chip is ever wanted in the footer tray, the Guardians' rows are `Guardians Radio Network` (`CLE Radio`), `WTAM 1100` (`WTAM`) and `WMMS 100.7` (`WMMS`), all `homeAway: home`. Spanish-language rows exist for other clubs (`language: "es"`).

---

## 3. Raw outlet spellings, verbatim — for the steward's alias table

Every string below is the `name` field exactly as the API returned it (call sign in parentheses where it differs). The steward maps these into `adapters/common.py` / `pipeline/bootstrap.py` aliases; canonical names in the repo include ESPN, ESPN2, Fox, FS1, TBS, truTV, Apple TV, MLB Network (MLB Network deliberately **not** in the access profile).

### 3.1 National (all `isNational: true`)

| Raw `name` | `callSign` | Code seen | Canonical target (proposed) | Joe |
|---|---|---|---|---|
| `FOX / FOX ONE` | `FOX` | national | Fox (streaming chip: Fox One) | available |
| `FOX / FS1` | `FOX/FS1` | national | Fox, with an FS1 regional alternate (see §8.1) | available either way |
| `FS1` | `FS1` | national | FS1 | available |
| `TBS` | `TBS` | national | TBS | available (decision 6) |
| `TBS (out-of-market only)` | `TBS` | national | TBS, blackout note | available (Cleveland is out-of-market unless CLE plays) |
| `TruTV` | `TruTV` | national | truTV | available |
| `HBO Max` | `HBO Max` | national | HBO Max (postseason simulcast of TBS/truTV) | available |
| `ESPN/ESPN App` | `ESPN` | national | ESPN (streaming chip: ESPN Unlimited) | available |
| `ABC/ESPN App` | `ABC` | national | ABC | available |
| `MLB Network` **and** `MLBN` (two spellings) | `MLBN` | national | MLB Network | **not in profile** (Joe's decision; §12 Q5) |
| `NBC/Peacock` | `NBC` | national **and** exclusive | NBC (streaming chip: Peacock) | available |
| `Peacock/NBCSN` | `Peacock` | national **and** exclusive | Peacock (NBCSN simulcast not on DIRECTV) | available (Peacock Premium) |
| `Peacock / NBCSN Extra` | `Peacock` | national | Peacock | available |
| `Apple TV` | `Apple TV` | exclusive | Apple TV | available (decision 4) |
| `Netflix` | `Netflix` | exclusive | Netflix | available |

Not seen in 2026 payloads: any `MLB.TV Free Game` row (`freeGame` was false on all 4,737 rows), any `Prime Video` national row (Prime appears only as a Yankees local row, below), any `ESPN2`.

### 3.2 Guardians-side local rows

| Raw `name` | `callSign` | Code | Games (2026 R) | Canonical target (proposed) |
|---|---|---|---|---|
| `Guardians.TV Presented by Progressive` | `CLEG` | local_in_market | 150 | **Guardians TV** (linear, DIRECTV 662) with streaming chip **CLEGuardians.TV** — see §5.3 for the surface decision |
| `WKYC 3` | `WKYC 3` | local_out_of_market | 10 (Apr 3, Apr 17, May 15, May 29, Jun 9, Jun 26, Jul 3, Aug 4, Aug 14, **Sep 18**) | WKYC 3 (already a network row for NFL/NBC; add an MLB rail entry) |

All ten WKYC games also carry the Guardians.TV row — a true simulcast pair, so the LINEAR-beats-STREAMING candidate rule seats them on WKYC 3 if Guardians TV is modeled as streaming, or the rail order decides if both are linear.

### 3.3 Opponent-side local TV rows seen on Guardians games (all `OUT_OF_MARKET` for Joe)

`Detroit SportsNet` (DSN) · `Royals.TV` (ROYL) · `Twins.TV Presented by Progressive` (MNNT) · `Chicago Sports Network` (CHSN) · `MASN` · `ABTV, presented by Pechanga Resort Casino` (ABTV — Angels) · `NBCSCA` · `Reds.TV` (CINR) · `Mariners.TV` (SEAM) · `NESN` · `Rays.TV` (RAYS) · `Space City Home Network` (SCHN) · `SportsNet Pittsburgh` (SNP) · `YES` · `Brewers.TV Presented by Potawatomi Sportsbook` (BREW) · `Cardinals.TV Presented by bet365` (CARD) · `Marlins.TV presented by Werner, Hoffman, Greig & Garcia` (MIAM) · `Marquee Sports Network` (MARQ) · `NBCS BA` (NBCSBA) · `NBCSP` · `Nationals.TV` (NATS) · `Padres.TV Presented by UC San Diego Health` (SDPA) · `Rangers Sports Network, presented by Progressive` (RSN) · `Rockies.TV` (COLR) · `SN1` · `SNY` · `SportsNet LA` (SNLA) · `Sportsnet` · `Amazon Prime Video` (AmazonPV — Yankees in-market games) · `BravesVision` (BravesVsn) · `DBACKS.TV` (ARID) · `FOX9 KMSP` · `Gray Media` · `KCOP 13` · `KFMB 8.1 (CBS)` · `TV Azteca` · `TVA Sports` (`TVA (Fr)`).

Two alias-table cautions: (a) **`RSN`** is the Rangers' call sign, not the generic abbreviation — do not let a regex treat it as "regional sports network"; (b) `Gray Media` is a bare-corporate name for an OTA simulcast (appeared on a Royals game) — the same partner that carries Cavaliers and Blue Jackets simulcasts.

### 3.4 ESPN's spellings for the same outlets (fallback source only) **[VERIFIED — ESPN MLB scoreboard 2026-09-02]**

ESPN's `geoBroadcasts[].media.shortName` uses **different strings**: `CLEGuardians.TV` (not "Guardians.TV Presented by Progressive"), `Tigers.TV` (where MLB says `Detroit SportsNet`), `MLB Net`, `ESPN Unlmtd`, `NBC Sports CA`, `NBC Sports Phil`, `NBC Sports BA`, `Marquee Sports Net`, `Angels.TV` (where MLB says `ABTV…`). ESPN also attaches an `MLB.TV` `National`/`Streaming` row to **every** game, which is noise for the grid. If the ESPN fallback is ever used, its outlet names need their own alias rows; do not assume the two sources agree.

---

## 4. National package outlets, 2026–2028, mapped to Joe

### 4.1 The deals **[VERIFIED — primary sources]**

MLB's three-year agreements with ESPN, NBCUniversal and Netflix cover **2026–2028** (https://espnpressroom.com/press-release/espn-major-league-baseball-reach-innovative-new-agreement-featuring-significant-collection-of-national-and-local-rights/; https://www.sportsvideo.org/2025/11/19/mlb-media-rights-shakeup-espn-mlb-strike-new-rights-deal-to-bring-30-national-games-to-linear-mlb-tv-exclusively-to-espn-app/). FOX/FS1, TBS/truTV and Apple TV continue their existing arrangements through 2028. **2027 is therefore the same outlet map as 2026**, subject to the labor situation (§4.3).

| Outlet | Package (as observed in the 2026 feed) | Exclusive? | Joe |
|---|---|---|---|
| ESPN / ABC (+ ESPN App) | 30-game weeknight package (summer-weighted), Memorial Day, second-half opener, Little League Classic | Yes — no local rows | Available (DIRECTV + ESPN Unlimited) |
| NBC / Peacock | Sunday Night Baseball; Opening Day and Labor Day primetime; Wild Card Series | Yes — no local rows | Available (NBC + Peacock Premium) |
| Peacock / NBCSN | Sunday Leadoff (late-morning Sundays), Peacock "Extra" games, the July 5 all-Peacock day | Yes — no local rows | Available via Peacock; NBCSN is not on DIRECTV and does not matter |
| FOX / Fox One | Saturday 7:15 PM ET window (2–3 regional games), All-Star Game, LDS/LCS/World Series | Yes — no local rows; **regional** | Available, subject to the coverage map (§8.1) |
| FS1 | Overflow national games; part of FOX Saturday regional splits | Sometimes (locals present on non-Saturday FS1 games) | Available |
| TBS / truTV / HBO Max | Tuesday nights; Division Series and LCS (HBO Max simulcasts postseason) | No — locals coexist; blacked out in the two markets | Available (decision 6 confirmed TBS) |
| MLB Network | Nightly national selections, "MLBN alt" | No — locals coexist; blacked out in the two markets | **Not in profile** — 9 games in the Aug–Oct window; see §12 Q5 |
| Apple TV | Friday Night Baseball doubleheaders (14 games in the window) | Yes — no local rows | Available (decision 4) |
| Netflix | Opening Night, Home Run Derby, Field of Dreams (Aug 13) | Yes | Available |

**Net: Joe's profile covers every national MLB game except MLB Network's, which is a deliberate exclusion, not a gap.** This is better than `research-mlb.md` reported (Apple was then modeled as not held; decision 4 flipped it).

### 4.2 Guardians' national count, API vs press release **[VERIFIED]**

The club's February release listed 13 national games (NBC 1, Peacock 3, FOX 5, FS1 3, TBS 1) (https://www.mlb.com/guardians/news/guardians-partner-with-mlb-for-2026-guardians-tv-broadcasts). The API today shows **16 games without a local row** — FOX 5, FS1 4, **Apple TV 4, ESPN 3**, Peacock 3, NBC 1, TBS 1 (plus one MLBN game with locals intact). Apple and ESPN assignments were made after the release. Lesson for `authority_rules`: for MLB, **the schedule API outranks the club press release on national assignments**; the release is a one-time crew and carriage source only.

### 4.3 Labor risk **[VERIFIED as of today]**

The CBA expires at 11:59 PM ET on December 1, 2026; a lockout is expected to follow and could threaten the 2027 season (https://www.sportico.com/law/analysis/2026/mlb-lockout-looming-legal-issues-1234937370/; https://sports.yahoo.com/articles/why-mlb-lockout-almost-guaranteed-090522471.html). MLB released the 2027 schedule on July 16, 2026, contingent on a new CBA (https://en.wikipedia.org/wiki/2027_Major_League_Baseball_season). Nothing in this brief depends on 2027 games existing; the adapter should treat `season=2027` rows the way it treats any other, and the render policy should not assume Opening Day.

---

## 5. Guardians local rights and blackout semantics for a Cleveland viewer

### 5.1 The arrangement **[VERIFIED]**

MLB produces and distributes Guardians local games for the second straight season under the "Guardians TV" name; Guardians TV airs 150+ regular-season games, WKYC carries 10 free simulcasts (11 counting the April 12 NBC game); crew is Matt Underwood, Rick Manning, Andre Knott, with Chris Gimenez, Al Pawlowski, Cayleigh Griffin, Cody Allen, Austin Jackson and Ben Broussard contributing (https://www.mlb.com/guardians/news/cleguardians-tv-2026-season; https://www.mlb.com/guardians/news/guardians-partner-with-mlb-for-2026-guardians-tv-broadcasts). The API's 150 `Guardians.TV` rows and 10 `WKYC 3` rows match the release exactly.

ESPN holds exclusive local in-market **streaming** rights for six clubs including the Guardians from 2026, but "in 2026, the games will be available to purchase and stream on MLB platforms" — i.e. CLEGuardians.TV, not the ESPN app, this season (ESPN press room, above). The Guardians are one of 22 clubs with blackout-free in-market streaming, and one of the MLB-produced set marked `^` in MLB's own guide (https://mlb.com/news/how-to-watch-mlb-games).

### 5.2 How Joe receives it

| Surface | What | Status |
|---|---|---|
| **DIRECTV channel 662** | "Guardians TV" linear channel; DIRECTV's own page says CLEGuardians.TV "can be accessed through DIRECTV on channel 662 (streaming, satellite)" (https://www.directv.com/insider/cleveland-guardians-schedule/, May 2026) | **[UNVERIFIED for the CHOICE tier]** — Joe tunes to 662 (§12 Q1) |
| **WKYC 3** (NBC, OTA / DIRECTV 3) | 10 simulcasts; the API lists them | Available |
| **CLEGuardians.TV** (MLB app / MLB.com) | In-market DTC, no blackouts except national exclusives; **$99.99/season, $19.99/month; $199.99 bundled with MLB.TV**; 7-day trial (https://www.mlb.com/guardians/news/cleguardians-tv-2026-season); Sports Media Watch lists $20/$100 (https://www.sportsmediawatch.com/tv-schedules/mlb-tv-schedule/cleveland-guardians/) | Not held; only needed if 662 is not in CHOICE |
| MLB.TV (via ESPN) | Out-of-market only; **Guardians games are blacked out in-market on MLB.TV** and require CLEGuardians.TV | Not needed |

Guardians home television territory: Ohio except Cincinnati, northeast Kentucky, northwest Pennsylvania, southwest New York (https://www.cabletv.com/mlb/watch-cleveland-guardians) **[secondary source]**. Cleveland is inside it, which is what makes MLB.TV useless and CLEGuardians.TV/662 necessary.

### 5.3 Modeling decision for the steward: surface of the Guardians TV row

The same feed reaches Joe two ways — a linear channel (DIRECTV 662) and a streaming app (CLEGuardians.TV). Recommendation: model **Guardians TV as `delivery_surface: LINEAR`** in `networks_services` (type linear cable, like an RSN), with CLEGuardians.TV as its streaming chip — the CBS→Paramount+ pattern from spec decision 3.2 — and register it as **CONFIRMED** in `data/local_rights.json` under `mlb.CLE` with `outlet "Guardians TV"`, `surface "tv"`, `label "Guardians TV (MLB Local Media) · CLEGuardians.TV"`. If Joe reports 662 absent from CHOICE, flip the surface to `web` and mark CLEGuardians.TV as a needs-subscription service at $99.99/season; nothing else changes. Either way, **no synthesized local row is needed** — the API supplies it — so the `TBA_NO_RIGHTS_HOLDER` path from the NHL adapter does not apply to MLB.

The 10 WKYC games become a genuine LINEAR + LINEAR simulcast (WKYC 3 and Guardians TV). Rail order decides the seat; the recommendation is WKYC 3 first (free OTA), matching how WUAB 43 was ordered for the Cavaliers.

### 5.4 Blackout rules to encode (all observable in the feed)

1. **National exclusive → local feed does not exist.** Encoded by omission (§2.4). Apple, Netflix, NBC/Peacock SNB, FOX Saturday, ESPN package, Peacock Leadoff.
2. **TBS Tuesday and MLB Network → blacked out in the two clubs' markets; local feeds carry there.** For Joe: TBS is available except on the (one) Guardians TBS game, where Guardians TV carries it instead — check the Guardians TBS game's rows when it comes up (§12 Q6). MLBN is outside the profile regardless.
3. **MLB.TV → blacked out in-market.** Irrelevant to the grid (Joe does not hold it), but the `local_out_of_market` code on opponent feeds is exactly this rule.
4. **Opponent local feeds → OUT_OF_MARKET.** A Rockies.TV row on a Guardians game is evidence (the reconciler may even choose it as canonical primary on a non-national game — see §11.2) but never seats a game for Joe.

---

## 6. Teams, ids, colors, logos

### 6.1 Team list **[VERIFIED — `/api/v1/teams?sportId=1&season=2026`, 30 teams]**

Fields: `id`, `name` ("Cleveland Guardians"), `teamName` ("Guardians"), `locationName` ("Cleveland"), `shortName` ("Cleveland"), `franchiseName`, `clubName`, `abbreviation` ("CLE"), `teamCode`/`fileCode` ("cle"), `league{id,name}` (103 American League), `division{id,name}` (202 American League Central), `venue{id,name}` (5, Progressive Field), `springLeague`, `springVenue`, `firstYearOfPlay`, `active`.

**Id namespace: `mlb-{statsapi id}`** — `mlb-114` for the Guardians, `mlb-824383` for a game (`gamePk`). This follows the repo convention and the NHL pattern (`nhl-{nhlId}`) rather than the NBA tricode pattern, because `gamePk` and team `id` are the API's own durable keys and the ESPN fallback (which uses different numeric ids — Guardians are ESPN `5`) can be joined by abbreviation.

MLB abbreviations: `ATH ATL AZ BAL BOS CHC CIN CLE COL CWS DET HOU KC LAA LAD MIA MIL MIN NYM NYY PHI PIT SD SEA SF STL TB TEX TOR WSH`. **Two differ from ESPN:** MLB `AZ` = ESPN `ARI`; MLB `CWS` = ESPN `CHW`. All 30 `displayName`s match MLB `name` exactly (including the Athletics' bare "Athletics"), so a name join needs no map at all.

### 6.2 Colors **[VERIFIED — ESPN teams endpoint]**

ESPN `color` / `alternateColor` for all 30, e.g. CLE `002b5c` / `e31937`, DET `0a2240`, PIT `000000`, SF `000000`. Same audit warning as the other leagues: ESPN's palette is tuned for ESPN's UI (three clubs come back pure black as primary). The MLB Stats API exposes no colors. Seed from ESPN, hand-audit 30 against club brand pages, store the audited value as fact.

### 6.3 Logos **[VERIFIED — fetched]**

| URL | Result |
|---|---|
| `https://a.espncdn.com/i/teamlogos/mlb/500/cle.png` | 200, 25.9 KB |
| `https://a.espncdn.com/i/teamlogos/mlb/500-dark/cle.png` | 200, 24.2 KB |
| `https://a.espncdn.com/i/teamlogos/mlb/500/scoreboard/cle.png` | 200 |
| `.../mlb/500/ari.png` | 200 — **ESPN abbreviation in the path** (`az.png` is 404) |
| `.../mlb/500/chw.png` and `.../mlb/500/cws.png` | both 200 but **different files** (76 KB vs 32 KB) — take the URL from ESPN's `teams[].logos[].href` rather than constructing it |
| `https://www.mlbstatic.com/team-logos/114.svg` (MLB's own SVG) | **403 `host_not_allowed`** — `www.mlbstatic.com` is not on the org allowlist. Not needed; note for Joe only if SVG marks are ever wanted (§12 Q8). |

ESPN's teams payload also lists per-team `guid/…/logos/primary_logo_on_black_color.png` etc. — a dark-background variant family. Fetch through `adapters/espn.py`'s existing logo routine with `league=mlb`; expect `assets/logos/mlb-{id}.png` × 30, matching the R2 namespace `logos/{sport}-{id}.png`.

**ESPN edge note [VERIFIED]:** `site.api.espn.com` returned **403 Access Denied** to a custom `User-Agent: MySports-research/1.0` and to a bare `Mozilla/5.0`, but 200 to `python-requests/2.32`. `adapters/espn.py` already works live, so whatever UA it sends is fine — just do not "tidy" it into a product string.

---

## 7. Doubleheaders, postponements, suspensions, postseason placeholders, and the viewing day

### 7.1 Doubleheaders **[VERIFIED — 6 `Y` and 38 `S` in 2026]**

| `doubleHeader` | Meaning | Game 2 in the payload | Fixture treatment |
|---|---|---|---|
| `N` | single game | — | normal |
| `S` | **split** (separate admissions) | own `gamePk`, `gameNumber: 2`, **real** `gameDate` (e.g. Sept 4: G1 `18:10Z` = 2:10 PM ET, G2 `23:15Z` = 7:15 PM ET), `startTimeTBD: false` | two ordinary games; carry `doubleheader_game_number` |
| `Y` | **classic** (single admission) | own `gamePk`, `gameNumber: 2`, **`startTimeTBD: true`**, `gameDate` = game 1 + 5 minutes (a placeholder: Apr 5 G1 `17:10Z`, G2 `17:15Z`) | game 2 → `startTimeTBD: true`, `schedule_certainty: TBD_FOLLOWS`, label "follows Game 1"; **never render the +5 min placeholder as a time** |

`statusFlags.isClassicDoubleHeader` / `isSplitTicketDoubleHeader` say the same thing as booleans. **Fixture for the build: the Sept 4 Guardians split doubleheader** — G1 (`mlb-824424`, makeup of June 14) on Guardians TV + Detroit SportsNet at 2:10 PM ET, G2 (`mlb-824387`) on **Apple TV exclusive** at 7:15 PM ET with no local rows. One day exercises `S`, a reschedule, a national exclusive, and the local row in a single render.

### 7.2 Postponements **[VERIFIED — 27 in 2026]**

A postponed game appears **twice** in the schedule: (1) under its original `officialDate` with `statusCode` `D*`, `detailedState "Postponed: Rain"`, and `rescheduleDate` pointing forward; (2) under the makeup date with the **same `gamePk`**, `rescheduledFrom` / `rescheduledFromDate` pointing back, often `description "Makeup of 6/14 PPD"`, and frequently as game 1 of a doubleheader. Example: `824460` — Apr 4 tombstone `DR` → Apr 5 `doubleHeader Y, gameNumber 2, startTimeTBD true`.

Adapter rule: **emit the makeup row; do not emit the `D*`/`C*` tombstone as a game** (it has no telecast and no first pitch). Emit it instead into the validation report ("postponed: {pk} {date} → {rescheduleDate}") so the steward can see it.

**Loader delta (blocking — §11.1):** the game id does not change but its date moves by days or months. The Milestone 2 loader writes game identity columns "only on insert"; if `viewing_day` / `date` is among them, a postponed game stays parked on its original day forever. The reconciler already owns `canonical_kickoff_at`; `viewing_day` must follow it.

### 7.3 Suspended games **[enumeration VERIFIED; payload shape UNVERIFIED — none in 2026 yet]**

Status families `T*` and `U*` (`abstractGameState "Live"`, `detailedState "Suspended: Rain"`), with `resumeDate` on the suspended row and `resumedFrom` on the resumption-date row (same `gamePk`), plus `statusFlags.isSuspended`, `isSuspendedOnDate`, `isSuspendedResumptionOnDate`. The resumption is typically played before that day's regularly scheduled game, with the schedule listing a real resumption time. Adapter rule, to be confirmed against the first real case: emit the resumption-date row as a game with `label "resumed from {resumedFrom date}"`, `schedule_certainty FINAL` if a time is present, `TBD_FOLLOWS` if `startTimeTBD`; treat the original-date row as a tombstone once `resumeDate` is set. **Log the first observed suspended game in the changelog and re-verify.**

### 7.4 Postseason placeholders **[VERIFIED]**

Wild Card (`F`), Division Series (`D`), LCS (`L`) and World Series (`W`) games already exist with placeholder participants (`"AL Wild Card #2" @ "AL Wild Card #1"`, team ids that are not clubs), placeholder venues (`AL Stadium`), `startTimeTBD: true`, and a placeholder `gameDate` of **`07:33:00Z` = 3:33 AM ET**, `ifNecessary` flags, and national rows already attached (Wild Card on NBC/Peacock — 5 `exclusive` rows; LDS on TBS / truTV / HBO Max). Adapter rule: postseason games whose team ids are not in the teams file → emit with `startTimeTBD: true`, teams as the placeholder names, `schedule_certainty TBD`, and the national row; the renderer's TBD section handles them. Once MLB fills in participants and times (Sept 27–28), the same `gamePk` rows update in place.

### 7.5 The 03:00 ET viewing-day cutover **[VERIFIED]**

The API already buckets by `officialDate`, the ballpark-local date, and no 2026 regular-season game starts later than `02:40Z` (10:40 PM EDT). So **`officialDate` equals the ET viewing day for every regular-season game**, and `date=` queries return the viewing day directly — no cutover arithmetic in the adapter. The only rows past 03:00 ET are the postseason `07:33Z` placeholders, which are `startTimeTBD` and never rendered as times. Keep the spec's 03:00 ET rule as the renderer-side invariant (it is what makes a 10:10 PM ET Guardians-in-Seattle game stay on its day, ending ~1:15 AM); MLB simply never violates it.

Fixture consequence: the adapter's `dayFilter` and `window` should be expressed in `officialDate` terms, and `startDate` stays the true UTC instant.

### 7.6 Special-event games **[VERIFIED]**

`description` carries `"MLB at Field of Dreams"` (Aug 13, venue "Field of Dreams", Netflix) and `"MLB Little League Classic in Williamsport, PA"` (Aug 23, "Journey Bank Ballpark", ESPN). Neutral site is detectable as `venue.id != home team's venue.id`; `reverseHomeAwayStatus` was false on every 2026 game. Map to `neutralSite: true` and feed `competition_context` / the gold-sunburst marquee.

---

## 8. Grid-model stress points specific to the feed

### 8.1 FOX Saturday is regional **[VERIFIED]**

| Date | Simultaneous `FOX / FOX ONE` games at 7:15 PM ET |
|---|---|
| Aug 1 | ARI @ CLE · NYY @ CHC |
| Aug 8 | DET @ SF · BAL @ TEX · CLE @ CWS |
| Aug 15 | BOS @ PIT · ARI @ ATL · MIL @ LAD |
| Sep 5 | ARI @ HOU · NYY @ SD |
| Sep 26 | TB @ PHI · BAL @ NYY |

Cleveland receives exactly one. The API does not say which. Rule set, mirroring `data/market_coverage_nfl.json`:

1. If a Guardians game is in the FOX window → Cleveland gets it (`AVAILABLE`, `carriageCertainty CONFIRMED`, market `local`-equivalent). Resolves Aug 1 and Aug 8 automatically.
2. Otherwise → each FOX-window game is `market: regional`, `access: UNVERIFIED`, until a `data/market_coverage_mlb.json` entry names the Cleveland game (506sports posts MLB-on-FOX listings; Joe reads it as he does the NFL map). Unentered games go off-grid with the stated reason "Cleveland assignment not entered", exactly like NFL regional games today.
3. `FOX / FS1` rows (2 games in the window) mean "FOX in some markets, FS1 in others." Joe has both, so access is `AVAILABLE` either way, but the rail seat is unknown → treat as FOX with `carriageCertainty UNVERIFIED` pending the coverage entry.

Remaining 2026 FOX Saturdays with no Guardians game: Sep 5, Sep 26 (Sep 12 and 19 have no FOX games in the feed). Two hand entries for the rest of the season.

### 8.2 Volume, and the Around the League strip

Sept 1 has 15 games and 33 TV rows. After the access filter, Joe's grid for a typical Tuesday is: Guardians TV (1), TBS (1, if not a Guardians game), and nothing else. The Around the League strip (contract §11.8) gets the other 13 with the stated reason "no national telecast · out of market" — the same reason string the NHL render uses today. Block duration per spec: 180 min, `open_ended` true for `mlb`.

### 8.3 Sunday Leadoff and the July 5 roadblock

`Peacock / NBCSN Extra` and `Peacock/NBCSN` (`national` code) mark Sunday Leadoff games: late-morning first pitch (e.g. Jul 5 `18:00Z` = 2:00 PM ET, Jul 26 `16:15Z` = 12:15 PM ET), no local rows. On July 5, 2026 every game was a Peacock exclusive — a day when the grid is one Peacock row with 15 sequential games, the MLB analogue of the NBA Christmas quintupleheader. Worth keeping as a 2027 hero-render candidate if the season happens.

### 8.4 Records come free

`teams.home.leagueRecord.{wins,losses}` is on every schedule row, unhydrated. The fixture's `records` block (`"W-L"`) can be populated for MLB from day one — the other pro fixtures leave it empty in preseason.

---

## 9. Proposed fixture mapping table (API field → fixture key)

Target shape: the common fixture `{"validation": {...}, "games": [...]}` documented in `adapters/common.py` and mirrored by `pipeline/render_feed.py`. MLB-only keys are additive and marked ★; nothing existing changes meaning.

### 9.1 `validation` envelope

| Fixture key | Value |
|---|---|
| `source` | `"mlb-statsapi"` |
| `sport` | `"mlb"` |
| `season` / `year` | `season` from the payload (int) |
| `dayFilter` | the `officialDate` rendered (`--date`) |
| `window` | `{start: startDate, end: endDate}` in `officialDate` terms (7-day window like `adapters/nhl.py`) |
| `localTeams` | `["mlb-114"]` from `data/markets.json` / `data/local_rights.json` |
| `endpoint`, `hydrate` ★ | the exact request, for audit |
| `hydrationsHash` ★ | SHA-256 of the `hydrate=hydrations` list (drift alarm) |
| `generatedAt` | UTC now |
| `postponed` ★, `cancelled` ★, `suspended` ★ | tombstone lists `[{id, officialDate, rescheduleDate|resumeDate, reason}]` |
| `broadcastRowsSeen` ★ | count of TV rows before filtering (the §10.4 guard) |

### 9.2 `games[]`

| Fixture key | API source | Rule |
|---|---|---|
| `id` | `gamePk` | `"mlb-{gamePk}"` |
| `season` | `season` | int |
| `week` | — | `null` |
| `startDate` | `gameDate` | as-is (UTC, `Z`) |
| `startTimeET` | `gameDate` | `adapters.common.et_display`; **omit/blank when `startTimeTBD`** |
| `startTimeTBD` | `status.startTimeTBD` **or** (`doubleHeader == "Y"` and `gameNumber == 2`) **or** `statusFlags.isTBD` **or** placeholder participants (§7.4) | boolean |
| `scheduleCertainty` ★ | derived | `FINAL` · `TBD_FOLLOWS` (classic DH game 2, or `resumedFrom` set with TBD) · `TBD` (postseason placeholder, `isNonDoubleHeaderTBD`) |
| `neutralSite` | `venue.id` vs home team's `venue.id` (teams file) or `reverseHomeAwayStatus` | boolean |
| `venue` | `venue.name` (hydrated) | string |
| `home` / `away` | `teams.home` / `teams.away` (hydrated `team`) | `id "mlb-{team.id}"`, `team = teamName` ("Guardians"), `teamFull = name`, `location = locationName`, `abbreviation`, `conference = null`, `classification = "mlb"`; ★ `league = league.name`, `division = division.name` |
| `records` | `teams.*.leagueRecord` | `{"home": "W-L", "away": "W-L"}` (available unhydrated) |
| `gameType` ★ | `gameType` | `R F D L W A` (adapter drops `S E I`) |
| `competitionContext` ★ | `gameType` + `seriesDescription` + `description` | `REGULAR` · `WILD_CARD` · `DIVISION_SERIES` · `LCS` · `WORLD_SERIES` · `ALL_STAR` · special events by `description` |
| `doubleHeader` ★ / `doubleheaderGameNumber` ★ | `doubleHeader`, `gameNumber` | `N|S|Y`; int (null when `N`) |
| `seriesGameNumber` ★ / `gamesInSeries` ★ | same names | ints |
| `dayNight` ★ | `dayNight` | `day|night` |
| `status` ★ | `status.statusCode`, `detailedState`, `reason` | pass through |
| `rescheduledFrom` ★ / `resumedFrom` ★ | same names | ISO or null |
| `description` ★ | `description` | string or null |
| `suppressesLocalFeed` ★ | derived | `true` when ≥1 national/exclusive TV row and 0 local TV rows |
| `odds` | `preGameOdds[]` — prefer FanDuel (id 1), else BetMGM (id 2) | `provider = provider.name`; `spread = float(home teamOdds.runline)` (home-relative, same sign convention as ESPN/CFBD: home `+1.5` ⇒ away favored); `overUnder = float(totalOdds.totalRuns)`; `moneylineHome/Away = int(teamOdds[homeTeam].moneyline)`; `fetchedAt = lastUpdated`. **Strip every `*Url` field.** Omit when absent. |

### 9.3 `media[]` — one row per **TV** broadcast after dedupe

| Fixture key | API source | Rule |
|---|---|---|
| (filter) | `broadcasts[].type` | keep `TV` only |
| (dedupe) | `name`, `availability.availabilityCode` | national/exclusive rows: collapse the home/away pair to one row |
| `outlet` | `name` → alias table (`adapters/common.py`) | canonical name; **unknown names fail the run with the raw string in the report** (no silent passthrough) |
| `outletSourceId` ★ | `broadcasts[].id` | int — the stable outlet id (782 = WKYC 3) |
| `mediaType` | canonical outlet's `delivery_surface` | `"tv"` for linear (Fox, FS1, TBS, truTV, ESPN, ABC, NBC, MLBN, WKYC 3, Guardians TV per §5.3, opponent RSNs), `"web"` for Apple TV, Netflix, Peacock, HBO Max, Amazon Prime Video, opponent `Club.TV` DTC-only feeds |
| `market` | `availabilityCode` + rail rules | `"national"` for `national`/`exclusive`; `"regional"` for FOX-window rows (§8.1) unless a local team plays; `"local"` for `local_*` rows |
| `feedSide` ★ | `homeAway` | `HOME` / `AWAY` for local rows; `NATIONAL` for the deduped national row |
| `access` | `data/access_profile.json` + `data/local_rights.json` + `data/market_coverage_mlb.json` | `AVAILABLE` (profile outlets; Guardians TV/WKYC per local_rights); `OUT_OF_MARKET` (opponent local feeds); `UNVERIFIED` (FOX regional without a coverage entry); `UNAVAILABLE` (MLB Network, NBCSN if it ever appears alone) |
| `carriageCertainty` | derived | `CONFIRMED` for API rows; `UNVERIFIED` for FOX regional pending entry; `TBA_*` never applies to MLB |
| `label` | canonical + sponsor-stripped `name` | e.g. `"Guardians TV (MLB Local Media) · CLEGuardians.TV"`, `"Fox Saturday Baseball"`, `"Apple TV Friday Night Baseball"` |
| `streamingAvailability` ★ | `availabilityCode`, `availableForStreaming` | pass through for the footer chip |
| `isStartTimeTBD` / `startTime` | game's values | as the other adapters |
| `source` | — | `"mlb-statsapi"` |

Rows dropped: all `AM`/`FM`; any `TV` row whose `language` is not `en` **only if** an English row for the same feed side exists (Spanish simulcasts should not create a second lane). `mediaState` is ignored.

---

## 10. Adapter design notes

1. **CLI**, matching the run sheet: `python -m adapters.mlb --date 2026-09-04` (7-day window from that date, like NHL), `--from-file` offline replay of a saved raw payload, `--all-logos`, `--teams` to refresh `artifacts/validation/mlb_2026_teams.json` from `/api/v1/teams?sportId=1&season={year}` joined to ESPN colors/logos by abbreviation with the two-entry map `{ARI: AZ, CHW: CWS}`. Outputs `artifacts/validation/mlb_{year}_{date}_fixture.json`, `_raw.json`, `_report.md` per the other adapters.
2. **Windows certification items** (protocol): `gameDate` parses without `%-` directives; every `open()` carries `encoding="utf-8"`; the only non-ASCII in the payload is in Spanish radio names (dropped) and the Marlins' sponsor line (ASCII); console stays ASCII (`·` in the summary line already goes through the shared reconfigure).
3. **Season switch:** `season` comes from the payload, not the clock; postseason rows carry `season "2026"` in October.
4. **Fail-closed guard for suppression by omission.** If a response contains games but **zero TV broadcast rows across the whole window**, or a hydration key is missing from every game, treat the run as a fetch failure: write the raw snapshot, write the report, **do not write the fixture**, exit non-zero. Otherwise the loader would close every active broadcast row in the window (§2.4) on the strength of a partial response. A per-game check is not needed — individual games legitimately have zero TV rows only when they are tombstones or postseason placeholders.
5. **Tombstones** (`D*`, `C*`) and `S`/`E` game types go to the report, not the fixture.
6. **National-row dedupe** before alias lookup, so the alias table sees one `FOX / FOX ONE` per game.
7. **Cross-check on request:** `--verify-espn` runs the ESPN MLB scoreboard for the same date and diffs game count and national outlet per game (after both alias tables). Not part of the scheduled run.

---

## 11. Schema and pipeline deltas surfaced by the feed

| # | Delta | Where | Blocking? |
|---|---|---|---|
| 11.1 | **`games.viewing_day` / date must move when a game is rescheduled** (same id, new `officialDate`). Today the loader writes identity columns only on insert; the reconciler resolves `kickoff_at` but nothing moves the day. Proposal: derive `viewing_day` in the reconciler from `canonical_kickoff_at_et` (03:00 ET rule) and let `pipeline/reconcile.py` write it alongside `canonical_kickoff_*`. | `pipeline/reconcile.py`, migration | **Yes** — 27 postponements this season, every one a game that would render on the wrong day |
| 11.2 | **Canonical primary on a two-local-feed game.** With no national row, the top-authority source offers two linear-equivalent local outlets. Proposal: `authority_rules` tie-break `feed_side HOME` over `AWAY` (mirrors the NHL Power Play "home feed" default and how listings guides print MLB games). Rail order then breaks ties within a side. | `data/authority_rules.json` | Yes for MLB, harmless elsewhere |
| 11.3 | **`feed_side` on `game_broadcasts`** is already in the spec deltas; MLB is the first adapter to populate it on every local row. Confirm the enum has `HOME | AWAY | NATIONAL`. | schema (spec 7.x) | Already planned |
| 11.4 | **`schedule_certainty` gains `TBD_FOLLOWS`** (classic DH game 2, suspended-game resumptions). | enum | Yes for the 6 classic DHs a year |
| 11.5 | **`doubleheader_game_number`, `series_game_number`, `games_in_series`, `competition_context`** on games. | schema | Footer content; low risk |
| 11.6 | **`market_coverage_mlb.json`** (FOX Saturday) — same shape as the NFL file, keyed by `officialDate` + FOX window. | data | Yes for non-Guardians FOX Saturdays |
| 11.7 | **Alias table**: the §3 spellings, with `broadcasts[].id` as a secondary key so sponsor-suffix drift does not break the join. | `adapters/common.py`, `pipeline/bootstrap.py` | Yes |
| 11.8 | **`networks_services` additions**: Guardians TV (linear, MLB Local Media), CLEGuardians.TV (streaming chip), Fox One (chip), Apple TV (already, decision 4), Netflix, HBO Max (already), MLB Network (unavailable), Peacock (already), plus opponent RSNs and Club.TV feeds as `out_of_market` services (~35 rows; they are evidence, not rails). | bootstrap | Yes |
| 11.9 | **Row order `mlb` rail**: WKYC 3 → Guardians TV → Fox → FS1 → TBS → truTV → ESPN → ABC → NBC → Peacock → Apple TV → Netflix → HBO Max; local group has no `CARRIER TBA` plate. | `data/row_order.json` | Yes |
| 11.10 | **Odds source for MLB is the schedule payload**, provider FanDuel/BetMGM, not ESPN/DraftKings. `game_odds.provider` will carry two new values; `primary_line_type = MONEYLINE` for `mlb` per the research batch. | `data/render_policies.json`, seed | Yes |

---

## 12. Open questions for Joe and the steward

**Joe (dashboard / receiver checks — each under a minute):**

1. **Is Guardians TV on your DIRECTV CHOICE lineup?** Turn on the receiver, tune to **662**. If the Guardians game is there, the local row is `AVAILABLE` at no cost and §5.3's LINEAR modeling stands. If not, CLEGuardians.TV is $99.99/season and the row becomes a needs-subscription streaming service. *Assumption until answered:* modeled as available on 662.
2. **MLB Network stays out of the profile?** It is in DIRECTV CHOICE, and you probably receive it; the brief says it is deliberately excluded. That costs roughly one national game a week plus the postseason "MLBN alt" cases. No action needed if the exclusion is intentional — just confirming it is a decision, not an omission.
3. **Do you want the 2026 postseason rendered?** Wild Card round starts September 29 (NBC/Peacock), LDS October 3 (TBS/truTV/HBO Max, FOX/FS1). The API already has the placeholder games. It is the only reason to build the MLB adapter this month rather than next spring.

**Steward (decisions before code):**

4. **Approve 11.1** (viewing day follows canonical kickoff). This is the one delta that touches Milestone 2 code; everything else is additive.
5. **Approve the Guardians TV surface** (§5.3): LINEAR with a CLEGuardians.TV chip, pending Q1.
6. **Guardians on TBS**: find the one Guardians TBS game in the feed and confirm whether its Guardians TV row is present (blackout means Cleveland watches the local feed, not TBS). Defines the blackout_rule row for TBS.
7. **Terms of use.** Every response carries a copyright/terms notice. This is a personal, non-commercial, market-of-one tool with cached, low-volume reads — the same posture as the NHL and ESPN sources — but it is Joe's call to accept, and I am not a lawyer.
8. **MLB's own SVG marks** (`www.mlbstatic.com`) would need Joe to add the host to Admin settings → Capabilities → Network Access. Not needed for v1; ESPN PNGs are in hand.
9. **Suspended-game shape** (§7.3) is specified from the enumeration, not an observed payload. Log the first real one.

---

## 13. Ready-to-paste changelog entry (`docs/research/research-changelog.md` format)

- **2026-09-01 — `docs/research/research-mlb.md` §1, §10 Q1; `research-summary.md` §2, §5 Tier 1 Q1.**
  **Old claim:** the MLB Stats API may be gating — three GETs returned HTTP 400 and the docs site shows an Okta login; treat the MLB backbone as unresolved and ESPN as the safe fallback.
  **New claim:** `statsapi.mlb.com/api/v1/*` is open — HTTP 200, no key, custom user agents accepted, from the org workspace on 2026-09-01 21:06 UTC; `hydrate=broadcasts(all)` returns national and local TV rows with `homeAway` feed side and an `availabilityCode`; `hydrate=preGameOdds` returns BetMGM/FanDuel lines. The earlier 400s were an artifact of the research session's fetch tool, and the Okta wall covers only `/docs/`. Sources: live payloads saved this session (`schedule?sportId=1&date=2026-09-01`, `…&hydrate=broadcasts(all)`, `/api/v1/schedule?sportId=1&hydrate=hydrations`), 2026-09-01.
- **2026-09-01 — `docs/research/research-mlb.md` §3 (Apple TV).** **Old claim:** Apple TV Friday Night Baseball is the one national gap; modeled as not held. **New claim:** superseded by product decision 4 (Apple TV: subscribe, available); the feed shows 4 Guardians games on Apple TV in 2026 (Mar 27, May 8, Jun 5, Sep 4). Source: live payload, `teamId=114`, 2026-09-01.
- **2026-09-01 — `docs/research/research-mlb.md` §4 (Guardians national count).** **Old claim:** 13 Guardians national games (club release, Feb 2026). **New claim:** 16 games with no local row per the API (adds Apple TV 4, ESPN 3; FS1 4 not 3); the API outranks the club release for national assignments. Sources: live payload; https://www.mlb.com/guardians/news/guardians-partner-with-mlb-for-2026-guardians-tv-broadcasts.

---

## Assumptions log (decisions made without Joe)

- **Wrote to `/mnt/user-data/outputs/claude/` for Joe to add to the Project**, as the earlier research session did; this session reads Project files but cannot write to them.
- **Chose `mlb-{statsapi id}` over an ESPN-id or tricode namespace** without asking, because the brief stated the convention and because `gamePk` is the only durable game key across postponements (§7.2).
- **Treated `availabilityCode` as a streaming-rights code rather than a viewer-access code** on the strength of the WKYC 3 case; if MLB's own semantics differ, the fixture still carries the raw code (`streamingAvailability`) so nothing is lost.
- **Recommended LINEAR for Guardians TV** before Joe confirms channel 662, because DIRECTV's own page names the channel and CHOICE is the RSN tier; §5.3 says how to flip it.
- **Did not probe the ESPN fallback beyond one scoreboard day**, since the primary is proven and ESPN's MLB spellings are recorded (§3.4) for the alias table if ever needed.
- **Did not test `radioBroadcasts` or `game(content(media(epg)))`** — both are listed hydrations; neither is needed for the grid.
- **Kept the labor risk in the brief but not in the adapter design.** The adapter reads whatever season the payload carries; a lockout produces an empty schedule, not a code path.

## Appendix A — verbatim Guardians game excerpt (2026-09-18, Athletics @ Guardians)

```json
{"gamePk": 824383, "gameDate": "2026-09-18T23:10:00Z", "officialDate": "2026-09-18", "gameType": "R",
 "doubleHeader": "N", "gameNumber": 1, "seriesGameNumber": 1, "gamesInSeries": 3, "dayNight": "night",
 "status": {"abstractGameState": "Preview", "codedGameState": "S", "detailedState": "Scheduled", "statusCode": "S", "startTimeTBD": false},
 "teams": {"away": {"team": {"id": 133, "name": "Athletics"}, "leagueRecord": {"wins": 53, "losses": 85, "pct": ".384"}},
           "home": {"team": {"id": 114, "name": "Cleveland Guardians"}, "leagueRecord": {"wins": 69, "losses": 68, "pct": ".504"}}},
 "venue": {"id": 5, "name": "Progressive Field"},
 "broadcasts": [
  {"id": 2742, "name": "NBCSCA", "type": "TV", "isNational": false, "callSign": "NBCSCA", "homeAway": "away",
   "availability": {"availabilityCode": "local_in_market", "availabilityText": "Local (In Market)"}, "availableForStreaming": true},
  {"id": 6218, "name": "Guardians.TV Presented by Progressive", "type": "TV", "isNational": false, "callSign": "CLEG", "homeAway": "home",
   "availability": {"availabilityCode": "local_in_market", "availabilityText": "Local (In Market)"}, "availableForStreaming": true},
  {"id": 782, "name": "WKYC 3", "type": "TV", "isNational": false, "callSign": "WKYC 3", "homeAway": "home",
   "availability": {"availabilityCode": "local_out_of_market", "availabilityText": "Local (Out of Market)"}, "availableForStreaming": false}
 ]}
```

Expected fixture media for this game: `WKYC 3` (tv, local, HOME, AVAILABLE, CONFIRMED) · `Guardians TV` (tv, local, HOME, AVAILABLE, CONFIRMED) · `NBCSCA` (tv, local, AWAY, OUT_OF_MARKET). Expected reconciler primary: WKYC 3 (rail order among two linear local rows). Expected grid: one card on the WKYC 3 row, Guardians TV chip in the footer.

## Appendix B — valid `schedule` hydrations (89, from `hydrate=hydrations`, 2026-09-01)

`team`, `tickets`, `game(content)`, `game(content(all))`, `game(content(media(all)))`, `game(content(editorial(all)))`, `game(content(highlights(all)))`, `game(content(editorial(preview)))`, `game(content(editorial(recap)))`, `game(content(editorial(articles)))`, `game(content(editorial(wrap)))`, `game(content(media(epg)))`, `game(content(media(milestones)))`, `game(content(highlights(scoreboard)))`, `game(content(highlights(scoreboardPreview)))`, `game(content(highlights(highlights)))`, `game(content(highlights(gamecenter)))`, `game(content(highlights(milestone)))`, `game(content(highlights(live)))`, `game(content(media(featured)))`, `game(content(summary))`, `game(content(gamenotes))`, `game(tickets)`, `game(atBatTickets)`, `game(promotions)`, `game(atBatPromotions)`, `game(sponsorships)`, `linescore`, `decisions`, `scoringplays`, `broadcasts`, `broadcasts(all)`, `radioBroadcasts`, `metadata`, `seriesStatus`, `event(performers)`, `event(promotions)`, `event(timezone)`, `event(tickets)`, `event(venue)`, `event(designations)`, `event(game)`, `event(status)`, `venue`, `weather`, `gameInfo`, `officials`, `probableOfficials`, `trackingVersion`, `coachingVideo`, `team(leaders)`, `team(leaders(showOnPreview))`, `probablePitcher(all)`, `probablePitcher`, `probablePitcher(showOnPreview)`, `review`, `event(sport)`, `event(league)`, `event(division)`, `linescore(positions)`, `linescore(matchup)`, `linescore(runners)`, `lineups`, `liveLookin`, `flags`, `alerts`, `previousPlay`, `homeRuns`, `xrefId`, `person`, `stats`, `probablePitcher(note)`, `gameId`, `story`, `ruleSettings`, `absChallenge`, `acsChallenge`, `statusFlags`, `weatherForecast`, `preGameOdds`, `uniforms`.

## Appendix C — probe inventory (this session, read-only GETs)

| # | Request | Purpose |
|---|---|---|
| 1 | `schedule?sportId=1&date=2026-09-01` | reachability, bare game shape |
| 2 | `schedule?…date=2026-09-01&hydrate=broadcasts(all),venue,team,linescore,seriesStatus,gameInfo,flags,weather,probablePitcher` | hydrated shape; broadcast row census (15 games) |
| 3 | `schedule?…startDate=2026-08-01&endDate=2026-10-05&hydrate=broadcasts(all),venue,seriesStatus,flags` | national outlet spellings, availability census, DH/TBD/postseason edge cases (798 games) |
| 4 | `schedule?…teamId=114&startDate=2026-03-01&endDate=2026-10-31&hydrate=broadcasts(all)` | Guardians outlet census (188 games) |
| 5 | `schedule?…startDate=2026-03-01&endDate=2026-11-15` | league status/DH census (2,869 games) |
| 6 | `gameStatus`, `gameTypes`, `schedule?hydrate=hydrations`, `seasons?season=2026|2027` | enumerations |
| 7 | `schedule?…date=2026-09-02&hydrate=preGameOdds,statusFlags,event(timezone)`; `…hydrate=broadcasts` vs `broadcasts(all)` | odds shape; hydration equivalence |
| 8 | `teams?sportId=1&season=2026`; ESPN `baseball/mlb/teams`, `baseball/mlb/scoreboard?dates=20260902`; six logo URLs | ids, colors, logos, fallback shape |
