# MySports Research — NFL

**Written:** 2026-08-31 (research session, Claude). All findings date-stamped to this day unless noted.
**Season in scope:** 2026 regular season, September 9, 2026 – January 10, 2027; playoffs begin January 16, 2027; Super Bowl LXI at SoFi Stadium on February 14, 2027. Source: https://en.wikipedia.org/wiki/2026_NFL_season and https://www.nfl.com/legal/flexible-scheduling-procedures
**Confidence key:** **[VERIFIED]** = confirmed against a primary or near-primary source this session. **[INFERRED]** = reasoned from verified facts, not directly stated. **[UNVERIFIED]** = could not confirm; treat as a question, not a fact.

---

## 0. Headline recommendation

Build the NFL on the **ESPN undocumented JSON API** as the schedule + broadcast + odds backbone, and on **506sports.com** as the coverage-map and announcer-crew adapter. There is no free official NFL schedule API with broadcast data; ESPN's is the only free source that carries game time, venue, stable IDs, a flex/TBD flag, national broadcaster, team colors, logo URLs, **and** point spread/total in a single response. I verified this live against the real 2026 endpoint during this session.

The single biggest architectural problem the NFL introduces is not data availability — it is that **"which network" is not a scalar for the NFL.** On a Sunday at 1:00 p.m. ET, "CBS" is not one game; it is up to eight simultaneous games, each carried on CBS in a different set of TV markets. The CFB renderer's ALT-lane rule assumes a network row carries one game per slot with rare doubling. The NFL breaks that assumption on 17 Sundays a year, and no free data source solves it — the coverage map has to be scraped and joined to the game. Details in §5 and §9.

---

## 1. Schedule data source

### Recommended backbone: ESPN undocumented JSON API **[VERIFIED — tested live 2026-08-31]**

Endpoint tested: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`
Documented (community) at https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b and https://github.com/pseudo-r/Public-ESPN-API

- **Auth model:** none. No key, no bearer token, no registration. Plain HTTP GET returning JSON. Confirmed no-auth by https://sportsapis.dev/espn-api and by direct fetch this session.
- **Rate limits:** none published. Because the API is undocumented and unsupported, the practical guidance from the community is to cache aggressively and keep volume low (https://publicapis.io/espn-sports-api). For MySports this is a non-issue: one poll per day plus a poll on flex-announcement days is enough.
- **Cost:** free.
- **Game times:** yes — ISO-8601 UTC in both `date` and `startDate`, plus a rendered ET string in `status.type.detail` (e.g. "Sun, September 13th at 1:00 PM EDT"). Kickoff minute precision is present (8:20, 8:35, 4:25).
- **Venues:** yes — `competitions[].venue` with `id`, `fullName`, `address.city/state/country`, and an `indoor` boolean. Confirmed for domestic and international venues (Melbourne Cricket Ground resolved correctly with `country: "Australia"`).
- **Stable game IDs:** yes — `event.id` (e.g. `401872656`), which is ESPN's durable event ID and also appears in the Gamecast URL. Teams have stable numeric IDs too (`t:26` = Seahawks).
- **TBD/flex state:** yes, and this is the most important single field for the NFL. Each competition carries **`status.isTBDFlex`** (boolean) and **`timeValid`** (boolean). This is the direct analogue of the CFBD `timeTBD` handling already specified in §11.2 of the build spec. **[VERIFIED — observed on every Week 1 event in the live payload.]**
- **Schedule reach:** the default scoreboard call returns the current week. Full-season pulls go through `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/events?limit=1000` (season type 2 = regular season), or the scoreboard with `?dates=YYYYMMDD` / `?seasontype=2&week=N`. Documented at https://gist.github.com/nntrn/ee26cb2a0716de0947a0a4e9a157bc1c
- **Bonus:** the same payload carries the **point spread and over/under** (see §7) and **team hex colors and logo URLs** (see §8). One call feeds four of the ten checklist items.

**The risk, stated plainly:** this API is undocumented, unsupported, and ESPN can change or close it without notice. There is no SLA and no contract. That is the price of free. It is also the same class of risk MySports already accepted for the CFB official-source HTML adapters, and it is a *lower* risk than those, because the ESPN endpoints have been stable for roughly a decade and are consumed by thousands of projects. Mitigation is the same as for CFB: cache every response, treat the local cache as the render source, and alert on schema drift rather than failing open.

### Fallback 1: NFL.com's own JSON **[UNVERIFIED]**
NFL.com runs on an internal API (`api.nfl.com`) that requires a token obtained from the site's own client bootstrap. I did not test it this session and do not recommend building on it: it is more aggressively defended than ESPN's and the token flow is fragile. Log as a fallback to investigate only if ESPN closes.

### Fallback 2: SportsDataIO (paid) **[VERIFIED as existing; pricing UNVERIFIED]**
https://sportsdata.io/nfl-api and coverage at https://sportsdata.io/developers/coverages/nfl. SportsDataIO explicitly sells NFL schedule + odds + images and offers a free trial. **Pricing is not published on the public pages I reached** — it is quote-based, and historically NFL feeds start in the several-hundred-dollars-per-month range. **[UNVERIFIED — do not budget against a number until Joe or I get a quote.]** Recommended posture: this is the "if ESPN dies and the product has paying users" answer, not a v1 line item.

### Fallback 3: MySportsFeeds **[UNVERIFIED]**
Did not reach a current pricing page this session. Historically offered a free non-commercial tier with attribution. Note it as a candidate, verify before relying on it.

**Verdict: ESPN primary, 506sports as the required companion adapter (§2), SportsDataIO as the paid escape hatch.**

---

## 2. Broadcast/media data — the CFBD `/games/media` equivalent

**Partially. ESPN gives you the national broadcaster; nobody free gives you the regional coverage map.** This is the NFL's defining data gap.

### What ESPN provides **[VERIFIED — live payload, 2026-08-31]**

Three overlapping fields per competition:

- `broadcast` — a flat string, e.g. `"FOX"`, `"CBS"`, `"NBC"`, `"Netflix"`.
- `broadcasts[]` — array of `{ market, names[] }`, e.g. `{"market":"national","names":["NBC"]}`.
- `geoBroadcasts[]` — richer: `{ type: {shortName: "TV"|"Streaming"}, market: {type: "National"|"Home"|"Away"}, media: {shortName}, lang, region }`.

`geoBroadcasts` is the field to model against, because it already distinguishes **TV vs Streaming** as a delivery type (Netflix came back as `type.shortName: "Streaming"`, NBC as `"TV"`) and already has a `market.type` dimension with Home/Away/National values. That maps almost directly onto the MySports network-vs-service distinction.

### What ESPN does *not* provide **[VERIFIED by inspection]**

Every Week 1 Sunday-1:00 game in the live payload — Buccaneers@Bengals on FOX, Saints@Lions on FOX, Jets@Titans on CBS, Ravens@Colts on CBS, Falcons@Steelers on FOX — is labeled `market: "National"`. That is **wrong in the sense MySports cares about.** Those five games are all on "national" networks but each airs in only a slice of the country. ESPN's `market` field means "this is a network-level rights deal," not "this airs in your ZIP code." **If MySports renders ESPN's `market` value naively, Joe's Cleveland grid will show five simultaneous CBS/FOX games he cannot all watch, and the access engine will be silently wrong.**

### The fix: 506sports.com **[VERIFIED as a source; scraping terms UNVERIFIED]**

https://506sports.com/nfl.php?wk={week}&yr=2026 — one page per week, predictable URL, with per-game coverage maps plus the CBS EARLY / CBS LATE / FOX EARLY / FOX LATE bucketing and the national windows named explicitly. The Week 1 page confirms the structure: national broadcasts listed by day and network, then the regional games grouped by network and window (https://506sports.com/nfl.php?wk=1&yr=2026).

Three things to know before building against it:

1. **It is one person's site, published on a schedule.** Week N maps post the Wednesday before. Preliminary maps are behind a $2/month Patreon (https://506sports.com/). Final maps are free and public.
2. **It self-describes as unofficial.** "All listings and maps are unofficial and subject to change" (https://506sports.com/nfl/). For the source-authority model this means 506sports should be an **observation**, never a fact, and should lose to any official network press release on conflict.
3. **The maps are images.** The market-by-market assignment is rendered as a map graphic; the *text* listing names the game, the network, the window, and the announcers, but the actual ZIP-to-game mapping is visual. **[INFERRED]** For Joe's single-market use case this does not matter: MySports needs only "which game does Cleveland get," which the announcer/listing text plus the Browns' own game resolves for the Browns, but not automatically for the other Cleveland-market game. See §10, open question 3.

### Also useful
- **NFL Network broadcasts are blacked out in areas where the game is on a local station** (https://506sports.com/nfl.php?wk=p3&yr=2026). This is a real access rule MySports must encode, not a footnote.
- Sports Media Watch maintains a per-team and per-season TV schedule page (https://www.sportsmediawatch.com/tv-schedules/nfl-tv-schedule/, Cleveland at https://www.sportsmediawatch.com/tv-schedules/nfl-tv-schedule/cleveland-browns/) — good for cross-checking national windows, not structured enough to parse.

---

## 3. National TV rights map, 2026–27

### The deal structure
The 11-year agreements signed in 2021 with Amazon, CBS, ESPN/ABC, FOX and NBC run through the 2033 season, with the league holding an opt-out after the 2029 season (https://www.pressreader.com/usa/east-bay-times/20210319/281925955779953; opt-out confirmed at https://www.thewrap.com/industry-news/deals-ma/espn-nfl-network-acquisition-closes/). **This is stable through the life of MySports v1.**

### The 2026 change that matters most: ESPN now owns NFL Network **[VERIFIED]**

On January 31, 2026, ESPN closed its acquisition of NFL Network, the pay-TV distribution rights to NFL RedZone, and NFL Fantasy, in exchange for a 10% equity stake in ESPN. Disney now holds 72%, Hearst 18%, NFL 10%. Confirmed in Disney's own 10-Q: https://www.sec.gov/Archives/edgar/data/0001744489/000174448926000037/dis-20260328.htm and reported at https://www.sportspro.com/news/broadcast-ott/espn-nfl-media-network-redzone-takeover-completed-february-2026/

Consequences for the access engine:
- **NFL Network is being integrated into ESPN's DTC service (ESPN Unlimited) starting with the 2026 season** (https://www.thewrap.com/industry-news/deals-ma/espn-nfl-network-acquisition-closes/ and https://whatsondisneyplus.com/disneys-espn-closes-deal-to-acquire-nfl-network-and-other-media-assets/). Joe has ESPN Unlimited via DIRECTV. **[INFERRED]** NFL Network games are therefore likely accessible to Joe *through the ESPN app* even if his linear tier does not carry channel 212. This needs confirming in-app — see §10.
- **NFL RedZone is distributed by ESPN to pay-TV providers starting with the 2026 season**, and remains available direct-to-consumer through NFL+ Premium (https://deadline.com/2026/02/nfl-espn-disney-close-deal-1236705021/).
- MySports should model NFL Network as an **ESPN-family network** for authority purposes going forward, not as a league-owned one.

### Outlet-by-outlet map against Joe's access profile

Nine platforms carry NFL games in 2026: CBS, FOX, ESPN, ABC, NBC, Peacock, Prime Video, Netflix, NFL Network (https://www.sportsmediawatch.com/tv-schedules/nfl-tv-schedule/).

| Outlet | Package / windows | Exclusive or simulcast | Joe's access |
|---|---|---|---|
| **CBS** | AFC Sunday afternoon package, 1:00 and 4:25 ET; 100+ regular-season games; Thanksgiving early game (Bears–Lions) | Regional, simulcast on Paramount+ | **Available** (DIRECTV + Paramount+) |
| **FOX** | NFC Sunday afternoon package, 1:00 / 4:05 / 4:25 ET; first NFL tripleheader in over a decade; Thanksgiving Eagles–Cowboys; Christmas Rams–Seahawks | Regional, simulcast on Fox One | **Available** (DIRECTV). Fox One not needed. |
| **NBC** | Sunday Night Football, 18 games; Kickoff Game Wed Sept 9 (Patriots at Seahawks); Thanksgiving nightcap Bills–Chiefs; a Week 17 Saturday game | National, simulcast on Peacock | **Available** (DIRECTV + Peacock Premium) |
| **Peacock** | All NBC games, plus at least one Peacock-exclusive regular-season game | Exclusive for that one game | **Available** (Peacock Premium). Price rose to **$12.99/mo** effective Aug 18, 2026 for new subs / Sept 17 for existing (https://fandomwire.com/streaming-price-hikes-2026-ranked-netflix-apple-tv-peacock/) |
| **ESPN** | 17 Monday Night Football games; ESPN's largest NFL portfolio ever; first-ever ESPN Super Bowl, Feb 14, 2027 (https://www.sportsvideo.org/2026/05/15/nfl-broadcast-schedule-roundup-breaking-down-cbs-espn-fox-nbc-netflix-and-prime-lineups/) | 7 ESPN-exclusive MNF games; 10 simulcast on ABC (https://www.cabletv.com/sports/watch-nfl) | **Available** (DIRECTV + ESPN Unlimited) |
| **ABC** | 10 MNF simulcasts + select exclusives | Simulcast | **Available** |
| **NFL Network** | 5 International Series games in 2026 (https://www.cabletv.com/sports/watch-nfl); blacked out where a local station has the game | Exclusive within its windows | **Probably available — needs confirming.** See §10 Q1. |
| **Prime Video** | Thursday Night Football (weekly, from Week 2 — Week 1 Thursday is Netflix's Melbourne game); Black Friday Football; a Christmas Eve game | **Exclusive** — no linear simulcast except in the two teams' local markets | **Available** (Prime Video) |
| **Netflix** | 5 games in 2026 under a 4-year extension through 2029–30: Week 1 Rams–49ers from Melbourne (Sept 10); Thanksgiving Eve Packers at Rams (Nov 25) — the NFL's first-ever Thanksgiving Eve game; Christmas Day doubleheader (Packers–Bears 1:00 ET, Bills–Broncos 4:30 ET); a Week 18 finale; plus NFL Honors (https://www.sportsvideo.org/2026/05/15/nfl-broadcast-schedule-roundup-breaking-down-cbs-espn-fox-nbc-netflix-and-prime-lineups/) | **Exclusive** | **Available** (Netflix) |
| **NFL Sunday Ticket (YouTube / YouTube TV)** | All out-of-market Sunday afternoon games, 160+ per season | Exclusive; not sold by DIRECTV to residential customers since 2023 (https://localcableprovider.com/directv-channel-lineup-guide/) | **NOT available — would require a new subscription.** See §4. |
| **NFL+ / NFL+ Premium** | Mobile/tablet only for live local + primetime; Premium adds RedZone DTC. Premium **$14.99/mo or $99.99/yr** (https://comparesubscriptions.com/live-tv/best-way-to-watch-nfl-2026) | — | Not held. Not recommended: mobile-only live video makes it useless for a living-room TV grid. |

**Net for Joe: every nationally distributed 2026 NFL game is inside his existing profile, with one exception (out-of-market Sunday afternoon games) and one to confirm (NFL Network).** That is a materially better starting position than college football.

### Streaming price reference, current as of 2026-08-31
Useful only for the "needs-new-subscription" labels in the access engine; all from https://fandomwire.com/streaming-price-hikes-2026-ranked-netflix-apple-tv-peacock/ and https://www.nerdwallet.com/finance/learn/how-to-watch-football-without-cable — ESPN Unlimited **$31.99/mo** ($319.99/yr) as of Aug 20, 2026; ESPN Select $13.99; Peacock Select $8.99 / Premium $12.99 / Premium Plus $19.99; Paramount+ Essential $8.99 / Premium $13.99 (raised Jan 15, 2026); Fox One $19.99; Prime Video standalone $8.99.

---

## 4. Regional rights — the Cleveland market

The NFL has no RSN. The regional problem is the **coverage map** and the **out-of-market** problem.

### Cleveland affiliates
- **CBS = WOIO (channel 19)**, Shaker Heights, owned by Gray Media **[VERIFIED]** (https://en.wikipedia.org/wiki/WOIO). This is the station that carries the AFC package, i.e. most Browns games.
- **ABC = WEWS (channel 5)** — also the Browns' preseason TV home **[VERIFIED]** (https://en.wikipedia.org/wiki/List_of_Cleveland_Browns_broadcasters, corroborated by https://www.sportsmediawatch.com/tv-schedules/nfl-tv-schedule/cleveland-browns/).
- **NBC = WKYC (channel 3)**, **FOX = WJW (channel 8)**, **CW = WBNX (channel 55)** — **[INFERRED, high confidence]**, long-standing assignments not re-verified against a primary source this session. Flag for a 5-minute confirmation before these get hard-coded.

For MySports v1 the call letters are cosmetic — Joe watches "CBS" on DIRECTV channel 19 regardless. **Recommendation: store the affiliate call sign as an optional display attribute on the market, not as a separate network entity.** It is the kind of detail that looks great in a footer tray and costs nothing to carry.

### The coverage-map problem, concretely

On a typical Sunday, Cleveland receives **exactly one** CBS game at 1:00, **one** FOX game at 1:00, and then one of each in the late window (or a single game if CBS/FOX has a singleheader that week). The other six-to-eight games happening simultaneously are on those same networks in other markets and are **invisible in Cleveland**. This is the single most important access rule in the NFL model, and it is the one ESPN's data does not express (§2).

Because Cleveland is a Browns market:
- Browns games are on CBS locally whenever they are an AFC-package game **[INFERRED from the CBS = AFC package structure]**, on FOX when the Browns visit an NFC home team, and on whichever national outlet holds the window otherwise.
- The Browns game is *always* available locally over the air, including when the game is a Prime Video or Netflix exclusive — the league requires an over-the-air simulcast in the two competing teams' markets. Confirmed in principle by the Deadline comment thread's uncontested statement of the rule and by NFL practice; **[UNVERIFIED as to the exact 2026 contract language]**, but the behavior is stable and well documented across seasons.

### Out-of-market: NFL Sunday Ticket
- **Exclusive to YouTube and YouTube TV. Not sold by DIRECTV to residential customers.** (https://localcableprovider.com/directv-channel-lineup-guide/ and https://nflplayoffpass.com/directv-stream-nfl/ — the latter notes DIRECTV still sells it commercially to bars.)
- **Pricing, 2026:** roughly **$378 for the season** at standard rate, or about **$192 for the season** for YouTube TV subscribers (https://nflplayoffpass.com/directv-stream-nfl/). A separate Yahoo guide quotes an installment structure of **$99.49/month for the first three months, $114.49/month thereafter** for buyers who qualify for the initial discount (https://sports.yahoo.com/nfl/article/how-to-watch-every-football-game-of-the-2026-27-nfl-season-015500642.html). These two are not reconcilable from public pages; **[UNVERIFIED]** treat $378 season / $192 with YouTube TV as the load-bearing figure and the monthly numbers as an installment plan.
- **Requires YouTube TV or a YouTube purchase, which Joe does not have.** RedZone is an add-on to Sunday Ticket.
- **Recommendation: do not buy it, and model out-of-market Sunday afternoon games as UNAVAILABLE.** For a Browns household in Cleveland this is the correct default. Sunday Ticket exists to serve displaced fans; Joe is not one.

### DIRECTV CHOICE and NFL Network — an unresolved conflict **[UNVERIFIED]**
Two sources disagree:
- DIRECTV's own July 29, 2026 streaming channel-lineup PDF shows NFL Network at channel 212 with marks against CHOICE, ULTIMATE and PREMIER — but the same page carries the note "= CHANNEL AVAILABLE WHEN SPORTS PACK IS ADDED TO THIS PACKAGE," so the marks are ambiguous (https://www.directv.com/dtvassets/sales/directv/upper_funnel/directv/channel-lineup/DIRECTV-via-Internet-ACQ-Packages-Channel-Lineup.pdf).
- A third-party 2026 guide states plainly that on DIRECTV streaming, "NFL Network comes with the Sports Pack or MySports" (https://nflplayoffpass.com/directv-stream-nfl/), which would put it *outside* Joe's profile since he has no Sports Pack.
- Two other guides state CHOICE includes NFL Network (https://www.cabletv.com/directv/channel-lineup/choice, https://localcableprovider.com/directv-channel-lineup-guide/).

NFL RedZone (channel 211) appears in **PREMIER only** on the DIRECTV PDF, consistent across sources. Joe does not have it linearly.

This matters for exactly 5 games in 2026 (the International Series games on NFL Network). Resolution path in §10.

---

## 5. Grid-model stress points

### 5.1 Sunday 1:00 p.m. stacking — the one that breaks the renderer

**The problem.** At 1:00 ET on a normal Sunday, CBS and FOX between them carry up to 10–11 games. In the MySports grid there is one CBS row and one FOX row. The v0.3 rendering contract's rule — "simultaneous same-network games → second lane + ALT tag" — produces a five-lane CBS row. That is not a TV guide; it is a spreadsheet accident. It also renders games Joe cannot watch, which violates the product's founding premise.

**Proposed treatment — the market filter is the answer, not a layout trick.**

1. **Default view is market-filtered.** For each (network, time slot) pair, resolve the *one* game that airs in Joe's market via the coverage map, and render only that game in the network row. One lane. Same silhouette as CFB. Nothing about the frozen design language changes.
2. **Add a distinct "Out of Market" strip below the grid**, not inside it — a compact horizontal list of the other simultaneous CBS/FOX games with a muted treatment and an "OOM" chip, so the day is *legible* without being *watchable*. This preserves the "what else is happening" value without lying about access.
3. **When the coverage map is unavailable** (map not yet posted; Week N+1 and beyond), render the network row with a **"REGIONAL — market TBD"** state rather than guessing. This is the direct analogue of the §11.2 TBD gating rule already in the spec, applied to market instead of time. Reuse the mechanism; do not invent a second one.
4. **Retire the ALT-lane rule for NFL.** Keep it for CFB where it works (two genuinely national simultaneous games). Make lane behavior a per-sport render policy, not a global one.

**The single-header case.** Some weeks CBS or FOX has a singleheader — only a late game, or only an early game. The grid must not assume both windows are populated. **[VERIFIED as a real pattern]**: FOX has "the first NFL tripleheader in more than a decade" in 2026, which is the inverse case — three FOX windows in one day (https://www.sportsvideo.org/2026/05/15/nfl-broadcast-schedule-roundup-breaking-down-cbs-espn-fox-nbc-netflix-and-prime-lineups/).

### 5.2 Flex scheduling — a first-class temporal state, not an edge case

**[VERIFIED — NFL's own procedures page, https://www.nfl.com/legal/flexible-scheduling-procedures]**

- Sunday Night Football: flexible up to twice in Weeks 5–10, and any week in Weeks 11–17.
- Monday Night Football: flexible any week in Weeks 12–17.
- Thursday Night Football: flexible up to twice, Weeks 13–17.
- Only Sunday afternoon games (or games listed TBD) can move into a primetime slot; the displaced primetime game moves to Sunday afternoon.
- Sunday afternoon games can also move between 1:00, 4:05 and 4:25 ET.
- **Notice periods:** 12 days for SNF Weeks 5–13 and all MNF flexes; **6 days** for SNF Weeks 14–17 and for all of Week 18; **21 days** for TNF Weeks 13–17 (shortened from 28 by owner vote in 2025 — https://www.cbssports.com/nfl/news/nfl-could-be-changing-flex-scheduling-rules-for-thursday-night-games-heres-what-you-need-to-know).
- **Week 18 is entirely unassigned** until the conclusion of Week 17. Saturday, Sunday afternoon and Sunday night slots are all announced at once (https://www.nfl.com/_amp/2026-flexible-scheduling-procedures-and-scheduling-for-week-18).
- Tentatively scheduled primetime games "will generally be listed at 8:20 p.m. ET" — i.e. **a placeholder time that looks like a real time.** This is exactly the trap the CFB TBD rule was written to catch.
- CBS and FOX can each protect one game per week from being flexed (https://en.wikipedia.org/wiki/Flexible_scheduling_(sports)).

**Proposed treatment.** Model a per-game `schedule_certainty` enum: `FINAL` / `FLEX_PENDING` / `TBD`. Compute it from `isTBDFlex` plus the week number plus today's date against the notice-period table above. Render `FLEX_PENDING` games with a visible marker in the footer tray — the design language already has a muted footer register, so this costs nothing new. **The renderer must never present a tentatively-scheduled 8:20 game as a settled fact**, and it must re-poll on notice-period boundary days (T−21, T−12, T−6) rather than on a fixed weekly cadence.

### 5.3 Block duration
NFL games run about 3 hours 5 minutes wall clock. **Recommend a 3.5-hour (7-column) default block for `sport = nfl`**, versus CFB's longer blocks. Late-window games starting at 4:25 will overlap the 8:20 primetime start under a 4-hour assumption and produce false truncation on the network row. The existing truncate-at-next-game rule handles the collision correctly either way, but the default matters for the last game of the night, where there is nothing to truncate against.

### 5.4 Simulcast and duplication
Three duplication patterns the CFB model has not seen:
- **ABC/ESPN MNF simulcast** — 10 of 17 games. Same game, two network rows. The existing `simulcast_rules` from Phase 3A applies directly.
- **Broadcast + streaming pairs** — CBS/Paramount+, NBC/Peacock, FOX/Fox One. These are not simulcasts in the CFB sense; they are the same rights holder on two delivery surfaces. **Recommendation: model these as a single game with multiple `delivery_surfaces`, and render the streaming surface only as a chip in the footer tray**, never as its own grid row. ESPN's `geoBroadcasts[].type.shortName` ("TV" vs "Streaming") gives you this distinction for free.
- **Local over-the-air simulcast of a streaming exclusive** — Prime Video and Netflix games appear on a local station in the two teams' markets. For Cleveland this fires only on Browns games. It is a market-conditional duplication and belongs in the coverage-map layer, not the national rights layer.

---

## 6. Announcer crews

- **506sports is the best source and it is the same scrape you are already doing for coverage maps.** The weekly NFL page lists announcers per game alongside the network and window, and the site notes listings "will be updated as more stations and commentators are confirmed" (https://506sports.com/nfl.php?wk=p3&yr=2026). There is also a historical archive: "The 506 Archive has announcer listings for thousands of national sports broadcasts across all sports going back to the early days of television" (https://506sports.com/).
- **Practical consequence:** crew data is *late-binding*. It firms up during the week. The render-hash selective-regeneration design already handles this — a crew change should dirty the footer tray and nothing else.
- **Secondary:** Awful Announcing and Sports Media Watch publish weekly network assignment posts; both are aggregators and should sit below 506sports in the authority order. **[INFERRED]**
- **Network press rooms** (CBS Sports, FOX Sports, NBC Sports, ESPN Press Room) publish crew assignments in weekly releases and are the true primary source, but they are unstructured HTML press releases — the same maintenance cost center flagged as standing risk #1 in the handoff doc. **Recommendation: do not build press-room adapters for crews in v1.** Scrape 506sports, mark crew as an observation, accept it.

---

## 7. Betting lines

**Recommendation: do not buy an odds API for the NFL. ESPN's scoreboard already carries it.** **[VERIFIED — live payload]**

Every scheduled 2026 NFL event in the live response carried a populated `odds[]` array from DraftKings with:
- `spread` (signed float, e.g. `-3.5`) and `details` (e.g. `"SEA -3.5"`)
- `overUnder` (float, e.g. `44.5`)
- `pointSpread.home/away.open` and `.close` with line and price
- `total.over/under.open` and `.close`
- `moneyline.home/away.open` and `.close`
- explicit `favorite` / `underdog` flags on each team

That is spread + total + movement, free, no key, in the same call that already returns the schedule. For a footer-tray display of "SEA -3.5, O/U 44.5" this is complete and over-specified.

**One caveat.** The payload is wrapped in DraftKings/ESPN BET affiliate links and carries a mandatory responsible-gambling disclaimer string. **Recommendation: extract only the numeric fields; do not render the affiliate links; and put a short "lines via DraftKings" attribution in the legend.** **[INFERRED]** Rendering deep-links to a sportsbook inside a personal TV guide adds legal surface for zero benefit.

**Note the spec conflict, unchanged from CFB.** Build spec §21 lists betting lines as a v1 NON-GOAL. Joe asked for point spread in the footer tray on 2026-08-31. That contradiction is still open and now applies to four more leagues. **This doc assumes spread will be approved** and specifies accordingly; if it is not, the field is simply not read.

**If a dedicated odds API is ever wanted:**
- **The Odds API** (the-odds-api.com) free tier: 500 **credits**/month, where cost = markets × regions per call and historical calls cost 10×. Roughly 83 typical multi-market live calls per month (https://oddspapi.io/blog/the-odds-api-free-tier-limits/). Workable for a once-daily single-market/single-region NFL pull; tight for four leagues.
- Alternatives with free tiers exist (SportsGameOdds, SharpAPI, OddsPapi) but every comparison page I found is published *by* one of the competitors, so the numbers are marketing. **[UNVERIFIED]** Do not select one on the strength of a rival's blog post.

---

## 8. Assets

### Team logos — the ESPN CDN pattern works **[VERIFIED]**
The brief asked whether `a.espncdn.com/i/teamlogos/{league}/500/{abbr}.png` resolves. The live payload confirms the family:
- `https://a.espncdn.com/i/teamlogos/nfl/500/scoreboard/{abbr}.png` — the scoreboard variant ESPN itself serves (e.g. `.../nfl/500/scoreboard/sea.png`)
- `https://a.espncdn.com/i/teamlogos/nfl/500/{abbr}.png` — the plain 500px variant
- `https://a.espncdn.com/i/teamlogos/leagues/500-dark/nfl.png` — confirms a **`500-dark`** sibling directory exists for dark backgrounds, which is exactly what the frozen dark-spotlight design language needs.

**[INFERRED]** `https://a.espncdn.com/i/teamlogos/nfl/500-dark/{abbr}.png` should therefore resolve for teams as well. **This mirrors the light/dark pairing already built for the 372 CFB logos** — the fetch script pattern from `scripts/fetch_team_assets.py` should port with a league parameter and near-zero new logic. Abbreviations come from `team.abbreviation` in the same payload (SEA, NE, LAR, SF, CIN, TB, DET, NO, NYJ, TEN, BAL, IND, PIT, ATL, CHI, CAR…), so no manual mapping table is needed.

**32 teams, light + dark = 64 PNGs.** Trivial next to the 372 already cached.

### Team colors — use ESPN's, but audit them **[VERIFIED with a caveat]**
Every team object carries `color` and `alternateColor` as bare hex (Seahawks `002a5c` / `69be28`; Bengals `fb4f14` / `000000`; Steelers `000000` / `ffb612`). This feeds the team-color bands and gradient endcaps directly.

**The caveat is real.** The Baltimore Ravens came back as `29126f` — a purple, but not the Ravens' official purple (`241773`). ESPN's palette is tuned for ESPN's own UI contrast, not for brand fidelity. **Recommendation: seed from ESPN, then hand-audit all 32 against the teams' official brand pages before the first render, and store the audited value as the fact with the ESPN value as an observation.** The WCAG ink-selection logic already built for CFB applies unchanged. **[INFERRED]** Budget an hour.

### Network logos
Already solved. The 2026 NFL outlet set — CBS, FOX, NBC, ABC, ESPN, NFL Network, Peacock, Prime Video, Netflix — overlaps heavily with the CFB network set already being fetched by `scripts/fetch_network_logos.py`. **New marks needed: NFL Network, Peacock, Prime Video, Netflix, and (if Joe wants completeness) NFL RedZone and Fox One.** Same Wikimedia Commons approach, same drift risk flagged as standing risk #4.

### Nothing else needed
Venues come with the schedule payload. Headshots are irrelevant to a TV grid. No new asset class.

---

## 9. Schema deltas against v0.3

Ordered by how much of the build they block.

1. **`market_coverage` entity — blocking.** The v0.3 schema has no way to say "this game airs on this network in these markets." Minimum viable shape for Joe's single-market case: `(game_id, network_id, market_id, is_primary)` with `market_id` initially a single row for Cleveland. Designing it as a full DMA table now costs little and avoids a migration when the product serves anyone else.
2. **`schedule_certainty` on game — blocking.** Enum `FINAL | FLEX_PENDING | TBD`, plus `flex_decision_deadline` (a date). Without this the grid confidently shows wrong primetime matchups for six weeks of the season.
3. **`delivery_surface` on the broadcast relation — blocking for correct rendering.** Distinguishes linear TV from the rights-holder's own streaming app (CBS→Paramount+, NBC→Peacock, FOX→Fox One) so those never become their own grid rows. ESPN's `geoBroadcasts[].type` populates it.
4. **`blackout_rule` on the broadcast relation — needed.** At minimum an enum covering the NFL Network case ("blacked out where a local station carries the game"). Applies again to MLB/NBA/NHL RSNs, so build it once here.
5. **Per-sport render policy — needed.** `block_duration_minutes` and `lane_policy` (`alt_lane` vs `market_filter`) as attributes of the sport, not constants in the renderer.
6. **`week` as a first-class scheduling unit.** CFB has it; confirm the v0.3 model carries it generically rather than as a CFB-specific column, since MLB/NBA/NHL will want `series` and `game_number` in the same slot. **[INFERRED — I have not read the v0.3 schema this session; the brief forbids repo access.]**
7. **`odds` fields on game.** `spread`, `total`, `odds_source`, `odds_fetched_at`. Only if Joe approves the §21 exception.
8. **`affiliate_call_sign`** as an optional display attribute on `(network, market)`. Cosmetic, cheap, and makes the footer tray feel local.

---

## 10. Open questions for Joe

1. **Does your DIRECTV CHOICE lineup actually carry NFL Network (channel 212)?** Sources conflict (§4). This is a 30-second check: turn on the receiver and tune to 212. It affects 5 games in 2026 (the International Series). Separately, since ESPN now owns NFL Network and is folding it into ESPN Unlimited for the 2026 season, **check whether NFL Network appears inside your ESPN app** — if it does, the linear question is moot and the answer is "available."
   *Assumption made in the meantime:* NFL Network is modeled as **available via ESPN Unlimited**, with a flag to flip if that turns out to be wrong.

2. **Do you want out-of-market Sunday afternoon games rendered at all?** My recommendation is the muted "Out of Market" strip below the grid (§5.1) rather than either hiding them entirely or putting them in the network rows. It preserves the day's shape without implying you can watch them. Say the word if you'd rather they vanish completely.
   *Assumption made:* build the strip; make it a toggle.

3. **How much coverage-map fidelity do you actually want?** For a Cleveland-only viewer, "which CBS game do I get" is answerable from the Browns game plus one lookup. Building a full DMA-to-game map from 506sports' image maps is a genuinely hard scraping problem for near-zero personal benefit. My strong recommendation is **market-of-one**: hard-code Cleveland, resolve the two regional slots per Sunday by hand-checkable rule, and defer general DMA support to a version that has other users.
   *Assumption made:* market-of-one for v1, with the schema built wide enough to grow (§9.1).

4. **The §21 betting-lines contradiction is now four leagues wide.** ESPN hands you spread and total for free in the same call as the schedule; there is no acquisition cost and no new dependency. The only question is whether the spec's non-goal stands. This needs a yes or no before the multi-sport renderer is written, not after.
   *Assumption made:* proceeding as if approved; the field is read but a single flag suppresses render.

5. **NFL Sunday Ticket: confirming you don't want it.** $378/season standard, ~$192 with YouTube TV, and it requires a YouTube TV or YouTube account you don't have. For a Browns household in the Browns market it buys you other teams' games. I've modeled it as **not held**.
   *Assumption made:* not purchasing.

6. **Verify three Cleveland affiliate call signs** (WKYC/NBC, WJW/FOX, WBNX/CW). High confidence, not primary-sourced this session. Cosmetic only.

---

## Assumptions log (decisions I made without you)

- **Wrote to `/mnt/user-data/outputs/claude/` rather than directly into the Project.** This research session can read Project files but cannot write back to them; the files are delivered as downloads for you to add to the Project. Filenames match the brief exactly.
- **Chose ESPN over any paid API** without pricing SportsDataIO, on the grounds that a free source that satisfies every requirement makes the paid comparison moot until it breaks.
- **Chose to test the live ESPN endpoint** rather than trust community documentation, which is why §1, §2, §7 and §8 are marked VERIFIED rather than inferred. Everything in those sections about field names is from the actual 2026 payload.
- **Declined to recommend an odds API** despite the brief asking me to evaluate The Odds API's free tier — evaluated it (§7), then recommended against needing it. The evaluation is there if the ESPN dependency ever has to go.
- **Treated one search result as unreliable and excluded it** — an "alibaba.com/product-insights" page purporting to describe Cleveland Browns broadcast arrangements. It is machine-generated content with fabricated-looking specifics (invented Nielsen citations, a claimed WOIO/WKYC shared-services agreement). Nothing from it is used here.
