# MySports Research — NHL

**Written:** 2026-08-31 (research session, Claude). Findings date-stamped to this day unless noted.
**Season in scope:** 2026–27, the NHL's 110th season of operation. **84-game regular season — the first 84-game schedule since 1993–94.** Opening night **Tuesday, September 29, 2026** (tied for the league's earliest-ever start), regular season through early April 2027. Sources: https://en.wikipedia.org/wiki/2026%E2%80%9327_NHL_season, https://www.nhl.com/news/2026-2027-national-tv-schedule-announced, https://www.sportsmediawatch.com/tv-schedules/nhl-tv-schedule-america-canada/
**Confidence key:** **[VERIFIED]** / **[INFERRED]** / **[UNVERIFIED]** as in the other league docs.

---

## 0. Headline recommendation

**Build the NHL on `api-web.nhle.com` — and note that it appears to be the best-instrumented league API of the four for exactly what MySports needs.** Community references document not just schedule and scores but a **TV schedule endpoint, a betting-odds endpoint, a `where-to-watch` endpoint, and a `postal-lookup` endpoint** (https://fastrhockey.sportsdataverse.org/reference/nhl_web.html; https://github.com/pseudo-r/Public-NHL-API). A postal-code lookup on a league API is, if it does what its name suggests, a *native blackout-and-market resolver* — the thing every other league forced us to build by hand.

**Two things make the NHL urgent and one makes it risky.**

- **Urgent:** the season starts **September 29, 2026 — roughly four weeks from today.** Of the four leagues, this is the only one whose season has not yet begun and is about to. If Joe wants a second sport live in the grid this calendar year, the NHL is the one with a natural on-ramp.
- **Urgent and unresolved:** the **Blue Jackets' local broadcast home for 2026–27 does not publicly exist yet.** FanDuel Sports Network Ohio is dead. The NHL is producing Columbus's local telecasts in-house, and as of the July 2026 announcements, **"distribution details are still being worked out and will be announced at a later date."** Nobody — including the club — has said what channel or service Joe would watch a Blue Jackets game on this season.
- **Risky:** TNT Sports holds the 2027 Stanley Cup Final "for the final time in the current NHL media rights deal," and as of August 2026 the proposed acquisition of TNT's parent Warner Bros. Discovery was still pending (https://www.sportsmediawatch.com/tv-schedules/nhl-tv-schedule-america-canada/). A network row's owner changing mid-build is a real scenario.

**The good news for Joe specifically: he already owns the best NHL package available.** ESPN Unlimited includes **NHL Power Play — 1,050+ out-of-market games** on the ESPN App. That is functionally NHL Center Ice, already paid for.

---

## 1. Schedule data source

### Recommended backbone: NHL Web API (`api-web.nhle.com/v1/`) **[VERIFIED as documented and actively used; live payload UNVERIFIED — could not fetch this session]**

- **Base URL:** `https://api-web.nhle.com/v1/`. A second base, `https://api.nhle.com/stats/rest`, serves the statistical side. Both are documented by the community reference at https://github.com/Zmalski/NHL-API-Reference.
- **Auth model:** none documented. Public endpoints, plain GET.
- **Cost:** free.
- **Relevant endpoints** (per https://fastrhockey.sportsdataverse.org/reference/nhl_web.html and https://github.com/pseudo-r/Public-NHL-API):
  - **Schedule** — league, season, monthly and weekly variants. Season format is `YYYYYYYY` (e.g. `20262027`); game type `2` = regular season, `3` = playoffs.
  - **Scoreboard / scores** — live and daily state
  - **`gamecenter/{id}/play-by-play`** and boxscore
  - **TV schedule** — a named endpoint under Games
  - **Betting odds** — a named endpoint under Games
  - **`where-to-watch`** — a named endpoint
  - **`postal-lookup`** — a named endpoint
  - **`partner-game`**, `smartlinks`, `meta`, `location`
- **Maturity:** the current API version dates from 2023 (https://medium.com/@vtashlikovich/nhl-api-what-data-is-exposed-and-how-to-analyse-it-with-python-745fcd6838c2), is wrapped by multiple actively maintained libraries (`nhl-api-py` updated March 2026 per https://www.sportsfirst.net/sportsapi/nhl-api; `fastRhockey`; the Public-NHL-API Django service), and has an automated documentation project covering 500+ endpoints (https://github.com/dfleis/nhl-api-docs). This is the healthiest community ecosystem of the four leagues.

### ⚠️ Verification gap **[stated plainly]**
**I could not fetch any `api-web.nhle.com` URL this session** — my fetch tool refused URLs that had not appeared verbatim in a prior search result, and none did. So every endpoint claim above is from community documentation, not from a payload I saw. The two claims that matter most and are least certain: **that the TV-schedule endpoint carries per-game broadcaster data, and what `postal-lookup` actually does.** Test procedure in §10, question 1.

### Fallback: ESPN NHL endpoints **[VERIFIED by pattern]**
`https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard`. One documented quirk worth carrying forward: **NHL standings require `/apis/v2/` rather than `/apis/site/v2/`**, which returns a stub (https://github.com/pseudo-r/Public-ESPN-API). Schedule and scoreboard use the normal path. Same no-auth, no-cost, odds-included profile verified in detail on the NFL endpoint.

**Recommendation: NHL API primary, ESPN secondary for odds and as drift alarm** — same posture as the NBA, and for the same reason: the league is the better authority on its own broadcasts.

---

## 2. Broadcast/media data

**Best-case: the NHL API answers this natively.** A `where-to-watch` endpoint plus a per-game TV-schedule endpoint plus a `postal-lookup` is, on its face, exactly the CFBD `/games/media` equivalent *plus* the market-resolution layer that the NFL forced us to scrape from 506sports. **[UNVERIFIED — this is the single highest-value thing to confirm about the NHL.]**

**Worst-case fallback, and it is not bad:** the national schedule is published in full by the league and its partners at season release. The NHL's own announcement enumerates the ESPN and TNT slates game-by-game (https://www.nhl.com/news/2026-2027-national-tv-schedule-announced; ESPN's own at https://www.nhl.com/news/espn-announces-national-tv-schedule-for-2026-27-season). At 172 national games it is a once-a-season capture.

**The regional side is the problem**, and it is a problem of *fact*, not of data plumbing: **nobody knows yet where Blue Jackets games will be** (§4).

---

## 3. National TV rights map, 2026–27

### The slate **[VERIFIED — league announcement]**
**172 national games** across two rights holders (https://www.nhl.com/news/2026-2027-national-tv-schedule-announced):

**ESPN — 100 exclusive games**
- **53 on ESPN and ABC** — broken out by an independent tally as **15 ABC + 38 ESPN** (https://www.yardbarker.com/nhl/articles/nhls_national_television_schedule_reveals_troubling_dependence_on_familiar_teams/s1_13132_44226697) **[secondary source]**
- **47 on ESPN+, Disney+ and Hulu** — streaming-exclusive
- Marquee: opening-night tripleheader Sept. 29 (Panthers–Hurricanes 5:00, Rangers–Bruins 8:00, Blackhawks–Golden Knights 10:30, all ESPN); **NHL Frozen Frenzy on Oct. 13, all 32 teams in action in one night**; ABC Hockey Saturday, consecutive Saturdays from Feb. 20 to March 20; the 2027 Honda NHL All-Star Weekend (Skills Feb. 5, 7:00 p.m. ET on ESPN; All-Star Game Feb. 6, 3:00 p.m. ET on ABC) returning after a two-year hiatus; the Navy Federal NHL Stadium Series (Stars vs. Golden Knights at AT&T Stadium, Feb. 20, 8:00 p.m. ET)
- **ESPN also carries the first three rounds of the 2027 Stanley Cup Playoffs**

**TNT Sports — 72 regular-season games**
- Across TNT, TBS and truTV (https://en.wikipedia.org/wiki/2026%E2%80%9327_NHL_season), streaming on HBO Max
- Weeknight presence all season; Sunday afternoon games from Feb. 21 to March 21 and again April 4
- **The 2026 Tim Hortons Heritage Classic and the NHL Discover Winter Classic**; a "Thanksgiving Showdown" doubleheader on Black Friday; a doubleheader Sept. 30 to open (Penguins at Flyers 7:30, Kings at Avalanche 10:00)
- **The 2027 Stanley Cup Final**
- One scheduling oddity worth noting for the renderer: **TNT airs a primetime game on Sunday, March 21, 2027, colliding with the March Madness Round of 32** — and March Madness expands from 68 to 76 teams this season, which may reshuffle the Turner networks' basketball windows (https://awfulannouncing.com/nhl/2026-2027-national-tv-schedule-tnt-sports-espn-abc-hulu-disney-plus.html). **[This is a cross-sport network-row collision, which is a rendering case MySports has not yet had to handle.]**

**NHL Network** also carries games (https://en.wikipedia.org/wiki/2026%E2%80%9327_NHL_season).

### Outlet map against Joe's access profile

| Outlet | Joe's access | Notes |
|---|---|---|
| **ESPN / ESPN2** | **Available** | DIRECTV + ESPN Unlimited |
| **ABC** | **Available** | 15 games, mostly Saturdays from late February |
| **ESPN+ / Disney+ / Hulu** | **Available for ESPN+ and Disney+**; Hulu not in profile | 47 streaming exclusives. ESPN Unlimited covers these. **[INFERRED]** — the ESPN DTC restructuring means "ESPN+" content sits inside ESPN Unlimited; verify in-app. |
| **TNT / TBS / truTV** | **Available** — TNT and truTV are in Joe's profile; TBS is standard on DIRECTV CHOICE | Same TBS confirmation question raised in the MLB doc |
| **HBO Max** | **Available** | Streams TNT's NHL games |
| **NHL Network** | **NOT in DIRECTV CHOICE — it is in ULTIMATE.** The DIRECTV lineup PDF places NHL Network at channel 215 in the ULTIMATE and PREMIER tiers, not CHOICE (https://www.directv.com/dtvassets/sales/directv/upper_funnel/directv/channel-lineup/DIRECTV-via-Internet-ACQ-Packages-Channel-Lineup.pdf) | **This is Joe's one real NHL national gap.** See §10. |
| **NHL Power Play (ESPN App)** | **Available and already paid for** | **1,050+ out-of-market games**, included with an ESPN Unlimited subscription or pay-TV authentication (https://www.nhl.com/news/espn-announces-national-tv-schedule-for-2026-27-season) |

**Net for Joe: one gap — NHL Network — and it is small.** Everything else, including the entire out-of-market package, is already inside his profile.

### NHL Power Play is architecturally important, not just a nice perk
Two properties matter to the renderer:
1. **It offers a choice of home-team or away-team commentary streams** for each game (https://www.nhl.com/news/espn-announces-national-tv-schedule-for-2026-27-season). That is the MLB `feed_side` problem appearing again, in a league where it is *user-selectable* rather than market-determined.
2. **It carries replays of every regular-season and playoff game from ABC, ESPN, NHL Network and TNT.** So the NHL Network gap above is partly closed on a delayed basis — Joe cannot watch an NHL Network game live, but he can watch it after.

---

## 4. Regional rights — Columbus Blue Jackets, viewed from Cleveland

### The thing that changed, and it is big **[VERIFIED]**

**FanDuel Sports Network Ohio no longer exists.** Main Street Sports Group — the post-bankruptcy successor to Diamond Sports Group, operator of the 15 FanDuel Sports Network RSNs — **wound down operations in April 2026** after a DAZN acquisition fell through (https://en.wikipedia.org/wiki/Main_Street_Sports_Group; https://awfulannouncing.com/local-networks/main-street-sports-group-shuttering-13-nba-teams-local-tv.html). It "went out of business at the conclusion of this past season" (https://www.espn.com/nhl/story/_/id/49419342/nhl-produce-games-hurricanes-blue-jackets-wild-blues). Main Street's collapse left **13 NBA teams and six-to-seven NHL clubs without a local broadcast home.**

**⚠️ This invalidates a claim made in `research-nba.md` §4 of this same research batch.** That doc, written earlier today, states the Cavaliers are on FanDuel Sports Network Ohio at DIRECTV channel 660. That was sourced from DIRECTV's own site and from Wikipedia's 2026–27 Cavaliers page, both of which are stale. **Corrections have been applied to the NBA doc; see its §4 and its assumptions log.** I am flagging it here too because it is the kind of error that quietly poisons an access engine, and because it is a good argument for the source-authority model treating *any* RSN attribution as an observation with a short shelf life.

### What replaces it for Columbus **[VERIFIED as to production; UNVERIFIED as to distribution]**

On **July 21, 2026**, the NHL announced that **NHL Productions will provide centralized production for the local broadcasts of the Carolina Hurricanes, Columbus Blue Jackets, Minnesota Wild and St. Louis Blues beginning with the 2026–27 season**, with additional clubs possible before opening night (https://www.nhl.com/news/nhl-unveils-new-centralized-production-for-club-regional-broadcasts). Former MLB Network president **Rob McGlarry** joined as general manager of local media to run it (https://www.sportsvideo.org/2026/07/21/nhl-launches-new-centralized-production-for-club-regional-broadcasts-with-four-teams-aboard-to-start/).

**But production is not distribution, and distribution is the open question.** The Blue Jackets' own release confirmed the arrangement and said **"distribution details are still being worked out and will be announced at a later date"** (https://thehockeywriters.com/blue-jackets-join-nhl-centralized-production-for-2026-27-regional-broadcasts/). Reporting from the same week: "Availability, channel locations and a direct-to-consumer option will be announced before the start of the season" (https://www.ginohard.com/nhl-local-broadcasts-four-teams-2026-27/).

**As of 2026-08-31, four weeks before puck drop, I found no announcement of where Blue Jackets games will actually air.** That is a finding, not a research failure — but it should be re-checked, because it may well have been announced in the days since my most recent reliable information.

### What we do know
- **The crew is continuous:** Steve Mears (TV play-by-play), Jody Shelley (analyst) and Bob McElligott (radio play-by-play) are all returning **[reported via The Athletic, relayed secondhand — UNVERIFIED]** (https://forums.hfboards.com/threads/cbj-on-tv-for-2026-and-beyond.3034802/). Mears and Shelley are confirmed as the incumbent pairing (https://en.wikipedia.org/wiki/List_of_Columbus_Blue_Jackets_broadcasters).
- **There is a free-over-the-air precedent to expect a repeat of.** In 2025–26 the Blue Jackets, FanDuel Sports Network, CW Columbus and Gray Media simulcast **six games** on CW Columbus plus Gray stations in **Cleveland**, Cincinnati, Dayton, Charleston/Huntington, Lexington and Louisville — carried on Spectrum, DIRECTV, DIRECTV Stream, YouTube TV, Dish and Breezeline, and additionally on **Prime Video and Pluto TV** (https://www.nhl.com/bluejackets/news/blue-jackets-fanduel-simulcasts-cw-columbus-gray-media). Gray Media owns WOIO and WUAB in Cleveland and now runs RESN — **the same partner set that carries the Cavaliers' free simulcasts.** **[INFERRED]** A Gray/RESN distribution deal for Blue Jackets games in 2026–27 is a plausible outcome, and Joe would receive it over the air.
- **Cleveland is inside Blue Jackets territory.** FanDuel Sports Network Ohio's broadcast area covered all of Ohio plus Indiana, Kentucky, northwest Pennsylvania, West Virginia and southwest New York (https://en.wikipedia.org/wiki/FanDuel_Sports_Network_Ohio), and CBJ games aired statewide. **[INFERRED]** Consequence: **Blue Jackets games are blacked out on NHL Power Play for Joe**, because he is in-market. The one team he most plausibly follows is the one team the out-of-market package won't give him.
- The old RSN had a known Columbus-market conflict pattern — Blue Jackets and Cavaliers games colliding across the Cleveland and Cincinnati subfeeds (https://en.wikipedia.org/wiki/FanDuel_Sports_Network_Ohio). That conflict is now moot but it is a reminder that RSN feeds are not one thing.

### Elsewhere, for context on where this is all heading
- **Detroit Red Wings → Detroit SportsNet**, run by team owners Ilitch Sports + Entertainment (https://www.espn.com/nhl/story/_/id/49419342/nhl-produce-games-hurricanes-blue-jackets-wild-blues).
- **Carolina plans to produce its own broadcasts** and partner for distribution, with the how and where undetermined (https://www.wral.com/sports/carolina-hurricanes-television-network-distribution-nhl-regional-networks-july-2026/).
- **MLB has been doing centralized local production since 2023 and is at 15 teams this season; the NBA expects a centralized streaming hub for 2027–28** (https://www.espn.com/nhl/story/_/id/49419342/nhl-produce-games-hurricanes-blue-jackets-wild-blues).

**The strategic read for MySports: the RSN era is ending across all three of Joe's pro-league local teams within a two-year window.** Guardians already moved to MLB Local Media. Blue Jackets just moved to NHL Productions. Cavaliers are in limbo pending an NBA centralized hub in 2027–28. **The schema must not assume a stable, named, third-party RSN entity exists for a team.** It must model "the local telecast" as a rights arrangement whose distributor is a mutable attribute — possibly a league DTC product, possibly a broadcast station, possibly both.

---

## 5. Grid-model stress points

### 5.1 Density and West Coast late starts
A full NHL night is 10–14 games, most at 7:00–8:00 p.m. ET with 9:00, 10:00 and 10:30 p.m. ET Western starts. Very similar to the NBA in shape.
- **Access filtering does the work again.** Joe's night: the Blue Jackets game (once distribution is known) plus the ESPN or TNT national game. **Two rows.** Everything else goes into the shared collapsed "Around the League" strip proposed for the other three leagues.
- **The 3:00 a.m. ET viewing-day cutover is required**, same as NBA.

### 5.2 Frozen Frenzy — the densest single night in North American sport
**October 13, 2026: all 32 teams in action, on ESPN platforms**, with a whip-around presentation. Sixteen simultaneous games on one rights holder.

**Recommendation: treat Frozen Frenzy as a named `event_night` with its own render template**, not as sixteen rows the grid tries to lay out. A single wide "NHL FROZEN FRENZY — 16 games, whip-around on ESPN" block with the participating teams as a logo strip is both honest and better-looking than any grid could be. **This is the NHL's version of the NFL RedZone problem: a whip-around show is one telecast covering many games**, and the data model has no way to say that today. See §9.

### 5.3 Block duration
NHL games run about 2 hours 30 minutes wall clock. **Recommend `block_duration_minutes = 150` for `sport = nhl`** — same as NBA, and for the same doubleheader-collision reason (TNT and ESPN both run back-to-back games on a single network row).

### 5.4 Overtime and shootouts
Regular-season games can end in regulation, overtime or a shootout; playoff games have unlimited sudden-death overtime and have run past three extra periods. **Same `open_ended` boolean recommended for MLB applies to NHL playoff games only.** Regular-season variance is small enough that the fixed block holds.

### 5.5 The cross-sport network collision
TNT's Sunday, March 21, 2027 NHL primetime game sits inside the March Madness window that TNT/TBS/truTV normally fill (§3). **The MySports grid is per-day and multi-sport by design, so this is not a bug — it is the first case where two of Joe's sports genuinely compete for one network row.** The renderer needs a rule for it. Recommendation: the network row is the row; two games from different sports in the same slot on the same network is a **contradiction that should surface as a data-quality alert**, because one of the two listings is wrong. Do not silently pick one.

### 5.6 84 games, and what it does to the calendar
The expansion from 82 to 84 games plus the September 29 start means a longer, denser season with more back-to-backs. **[INFERRED]** No structural render consequence, but it does mean the NHL overlaps the CFB season, the NFL season, the tail of MLB and all of the NBA. **The NHL is the league that makes MySports genuinely multi-sport on a single day**, which is worth knowing when choosing what to build second.

---

## 6. Announcer crews

- **Local:** Steve Mears / Jody Shelley on TV, Bob McElligott on radio — continuous from prior seasons **[UNVERIFIED for 2026–27 as noted in §4]**. Same per-package modeling recommendation as MLB and NBA: one crew across ~80 telecasts, so store the crew on the broadcast package with per-game overrides.
- **National:** ESPN and TNT publish per-game assignments; 506sports' archive covers national NHL broadcasts (https://506sports.com/).
- **A note on the centralized-production change:** NHL Productions is taking over studio and game production for Columbus, which means the **studio and sideline personnel may change even though the game crew doesn't**. Reporting flagged uncertainty for FanDuel-paid figures like studio host Brian Giesenschlag and reporter Dave Maetzold **[UNVERIFIED, secondhand]**. If the footer tray shows crews, expect churn in the non-game roles this season.

---

## 7. Betting lines

**Two free options, and for once the league itself may be one of them.**

1. **NHL API betting-odds endpoint** — listed under Games in the community reference (https://github.com/pseudo-r/Public-NHL-API). **[UNVERIFIED]** If it works, this is the cleanest possible source: one API, schedule and odds together, league-operated.
2. **ESPN scoreboard `odds[]`** — the DraftKings block verified in detail on the NFL endpoint, available cross-sport. This is the safe answer.

**Hockey-specific display note:** like baseball, hockey's spread is a near-constant ±1.5 ("puck line"), so **moneyline and total are the informative fields.** Same per-sport render policy as MLB: render moneyline + total, not spread. That is now two leagues on each side of the spread/moneyline split, which argues for making it an explicit `primary_line_type` attribute on sport rather than a special case.

**No purchase warranted.**

---

## 8. Assets

- **Logos:** `https://a.espncdn.com/i/teamlogos/nhl/500/{abbr}.png` with a `500-dark` sibling **[INFERRED from the verified NFL pattern]**. **32 teams × light/dark = 64 PNGs.** The NHL also serves its own team logos from `assets.nhle.com` **[UNVERIFIED]**; prefer the ESPN path since the fetch script already handles it.
- **Colors:** ESPN `color` / `alternateColor`, with the same mandatory hand-audit. NHL brand palettes are unusually distinctive (Golden Knights gold, Kraken ice blue) and ESPN drift will be visible.
- **Network marks beyond the existing cache:** NHL Network, TBS, truTV, HBO Max. TNT is presumably already fetched for CFB. **If the WBD acquisition completes, TNT/TBS/truTV marks may all change** — flag them for annual re-fetch rather than one-time.
- **The Blue Jackets' local distributor mark cannot be fetched because it does not exist yet.** Leave a null and a TODO.
- **Event marks:** Winter Classic, Heritage Classic, Stadium Series and Frozen Frenzy all have distinctive league branding, and the frozen design language's gold-sunburst marquee treatment plus a `competition_context` label (proposed in `research-nba.md` §9) covers them without new assets.

---

## 9. Schema deltas against v0.3 (beyond NFL, MLB and NBA deltas)

1. **`whip_around` broadcast type — new, and needed by two leagues.** A telecast that covers many games rather than one (NHL Frozen Frenzy on ESPN, NFL RedZone, Peacock's MLB Sunday whip-around show, NBC's Gold Zone). The current model has no way to express "one broadcast, N games." Minimum shape: a broadcast row with a `covers_games[]` set instead of a single `game_id`, and a render policy that draws it as a single wide block. **[This is the only genuinely new *entity shape* the NHL introduces.]**
2. **`primary_line_type` on sport** — `SPREAD` (NFL, NBA) vs `MONEYLINE` (MLB, NHL). Cleaner than four per-sport special cases in the renderer.
3. **`open_ended` scoped to game type, not just sport** — NHL playoff games are unbounded; NHL regular-season games are not. MLB is unbounded always. So the flag belongs on `(sport, game_type)`.
4. **`distributor` as a mutable, nullable attribute of the local-rights arrangement — and it must tolerate being unknown.** The Blue Jackets are the proof case: the rights exist, the production is arranged, the crew is named, and the distributor is genuinely unknown four weeks out. If the schema requires a network to attach a local telecast, the NHL cannot be modeled at all right now. **Recommend a `TBA` distributor state that renders as "local broadcast — carrier TBA" rather than as an absent game.**
5. **Cross-sport slot-collision detection** on `(network, date, time_slot)` — surfaces the TNT March 21 case as a data-quality alert rather than a silent wrong answer (§5.5).

---

## 10. Open questions for Joe

1. **Test the NHL API and, specifically, find out what `postal-lookup` and `where-to-watch` do.** If they resolve broadcaster by ZIP code, they are the single most valuable endpoints found across all four leagues and they would retire a large chunk of hand-built market logic.
   Exact test, in a browser:
   1. Paste `https://api-web.nhle.com/v1/schedule/2026-09-29` and press Enter. JSON means the API is open.
   2. Then Ctrl+F for `tvBroadcasts` or `broadcast`. If broadcaster names appear per game, §2 is solved.
   3. Then try `https://api-web.nhle.com/v1/where-to-watch` and `https://api-web.nhle.com/v1/postal-lookup/44115` (44115 is a downtown Cleveland ZIP). Report whatever comes back, including errors — an error tells us the endpoint path is wrong, which is still information.
   *Assumption made:* the doc specifies both the NHL-API path and the ESPN fallback.

2. **Where will Blue Jackets games actually be?** Unannounced as of my information. Worth a look at https://www.nhl.com/bluejackets/multimedia/tv-broadcast or the club's news page — it may have landed in the last few weeks. **This is the one fact that determines whether the NHL is buildable for you at all this season**, because without it the local row has no carrier.
   *Assumption made:* modeled as `TBA` with a Gray Media / RESN over-the-air outcome as the most likely single scenario, based on the 2025–26 six-game simulcast precedent.

3. **NHL Network is not in your CHOICE tier — do you care?** It is in DIRECTV ULTIMATE (channel 215). NHL Power Play on the ESPN App, which you already have, carries replays of every NHL Network game. My recommendation is no: the gap is live-only, partial, and closed on delay by something you already pay for.
   *Assumption made:* not upgrading; NHL Network games render as "available on delay via ESPN App."

4. **Confirm ESPN+ content is inside your ESPN Unlimited subscription.** 47 of the NHL's 100 ESPN-platform games are ESPN+/Disney+/Hulu exclusives. You have ESPN Unlimited and Disney+, so this should be covered twice over, but the ESPN DTC restructuring has made the ESPN+ / ESPN Unlimited relationship genuinely confusing and it is worth one look in the app.
   *Assumption made:* covered.

5. **TBS confirmation** — same question raised in the MLB doc. TNT Sports' 72 NHL games are spread across TNT, TBS and truTV. Your profile lists TNT and truTV but not TBS.
   *Assumption made:* available on CHOICE.

6. **Sequencing.** The NHL season starts September 29 — about four weeks out. If you want a second sport rendering live this fall, the NHL and the NFL are both live, and the NHL is the smaller build. My full sequencing recommendation is in `research-summary.md`.

---

## Assumptions log

- **Corrected the NBA doc rather than leaving two of my own documents contradicting each other.** The Main Street Sports collapse surfaced during NHL research and invalidated a claim I had already written about the Cavaliers. Corrections applied; the error and its cause are recorded in both docs.
- **Treated the DIRECTV lineup PDF as authoritative for NHL Network's tier placement** (ULTIMATE, not CHOICE), even though the same PDF was ambiguous about NFL Network. The NHL Network row is unambiguous in a way the NFL Network row is not.
- **Inferred that Cleveland is inside Blue Jackets home television territory** from FanDuel Sports Network Ohio's stated statewide broadcast area. This has a real consequence — it means NHL Power Play blacks out the one team Joe is closest to — so it should be confirmed once distribution is announced.
- **Did not verify the returning-crew report**, which reached me only through a message-board quotation of an Athletic story. Named as secondhand.
- **Proposed the `whip_around` entity on the strength of four separate real cases** (Frozen Frenzy, RedZone, Peacock's MLB whip-around, Gold Zone) rather than the NHL case alone, because a schema addition needs more justification than one league's one night.
