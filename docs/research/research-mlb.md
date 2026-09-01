# MySports Research — MLB

**Written:** 2026-08-31 (research session, Claude). Findings date-stamped to this day unless noted.
**Season in scope:** 2026 regular season (Opening Night March 25, Opening Day March 26, 2026), currently in progress at time of writing.
**Confidence key:** **[VERIFIED]** = confirmed against a primary or near-primary source this session. **[INFERRED]** = reasoned from verified facts. **[UNVERIFIED]** = could not confirm.

---

## 0. Headline recommendation

**Build MLB on the MLB Stats API (`statsapi.mlb.com`) if it is reachable from Joe's machine, and on ESPN's MLB endpoints if it is not.** The Stats API is MLB's own, free, and — uniquely among the four leagues — it exposes **per-game national *and* regional broadcaster data natively**. That is the CFBD `/games/media` equivalent, and no other league has one. If it works, MLB is the *easiest* of the four leagues to source, not the hardest.

I could not complete a live test this session; see §1 for exactly what happened and why it matters.

**The hard part of MLB is not data — it is volume and duplication.** Roughly 15 games a day, every day, for six months. Every one of those games exists twice: once as a local telecast on the home team's feed and once on the visitors' feed, plus a third time whenever a national package takes it exclusively. A naive render of an MLB Tuesday produces a 30-row grid of games Joe cannot watch, with the one he *can* watch buried in it. The design problem is subtraction, not layout.

**And the Cleveland situation is unusually good.** The Guardians are one of six clubs whose local broadcasts MLB itself now produces, which means blackout-free in-market streaming through a $100/season DTC product and 10 free over-the-air simulcasts on WKYC. Joe likely already has Guardians TV on DIRECTV channel 662.

---

## 1. Schedule data source

### Preferred backbone: MLB Stats API **[VERIFIED as existing and documented; live access UNVERIFIED — see the warning below]**

- **Base:** `https://statsapi.mlb.com/api/v1/` — MLB's own public statistics API, the same one that powers MLB.com.
- **Auth model:** historically none. No key, no registration for the read endpoints.
- **Cost:** free.
- **Key endpoint:** `/api/v1/schedule?sportId=1&date=YYYY-MM-DD&hydrate=broadcasts(all),venue,team`
- **Fields available** (per the community wrapper's documented schema at https://github.com/toddrob99/MLB-StatsAPI/wiki/Function:-schedule):
  - `game_id` / `gamePk` — the primary key, stable and durable
  - `game_datetime` — UTC timestamp, with an explicit warning in the docs that truncating the time can roll a late game onto the next date (relevant: MySports renders in ET, and a 10:10 p.m. ET West Coast start is already the next UTC day)
  - `game_type` — Preseason / Regular season / Postseason, enumerable via the `meta` endpoint
  - `status` — Scheduled / Warmup / In Progress / Final, also enumerable
  - team IDs and names for home and away
  - **`national_broadcasts`** — a list of stations/services carrying a national broadcast, including the "MLB.TV Free Game" designation
  - venue via hydration
- **Hydration is self-documenting.** Calling any endpoint with `{'hydrate':'hydrations'}` returns the list of valid hydrations for that endpoint (https://github.com/toddrob99/MLB-StatsAPI/blob/master/statsapi/__init__.py). That is a genuinely useful property for a schema-drift alarm: hash the hydration list and alert when it changes.
- **Doubleheaders and series:** `gamePk` is per-game, and the schedule payload carries doubleheader and series metadata natively. The wrapper exposes `include_series_status`. **[INFERRED]** — the field names for game number within a doubleheader need confirming against a live payload.

### ⚠️ The live-access warning **[VERIFIED behavior, cause UNVERIFIED]**

**Three separate GET requests to `statsapi.mlb.com/api/v1/schedule` from this session returned HTTP 400,** including a bare `?sportId=1&date=2026-08-21` with no hydration at all. Separately, both `https://statsapi.mlb.com/` and `https://statsapi.mlb.com/docs/` now present an **Okta login screen** ("API Documentation · Login with Okta · Forgot Password · Register").

Two readings, and I cannot distinguish them from here:
1. **Benign:** my fetcher's user-agent or header profile is being rejected, and the API is fine from a normal client. The community wrappers (`MLB-StatsAPI`, `pymlb-statsapi`) are actively maintained and `pymlb-statsapi` sources its schemas from `beta-statsapi.mlb.com/docs/` (https://pymlb-statsapi.readthedocs.io/), which suggests the API is still open.
2. **Material:** MLB has begun gating the Stats API behind registration, consistent with the league taking control of local media rights and monetizing distribution.

**This is the single most important thing to test before writing any MLB code, and it takes two minutes.** Test procedure is in §10, question 1. Until it is answered, treat the MLB backbone as **unresolved**, with the ESPN fallback below as the safe assumption.

### Fallback: ESPN MLB endpoints **[VERIFIED by pattern; MLB-specific payload UNVERIFIED]**
`https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard`, with `?dates=YYYYMMDD` (https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b, https://github.com/pseudo-r/Public-ESPN-API). Same no-auth, no-cost, undocumented profile as the NFL endpoint I did verify in detail (see `research-nfl.md` §1). **[INFERRED]** the field structure is identical across sports — `broadcasts`, `geoBroadcasts`, `odds`, `venue`, team `color`/`alternateColor`, logo URLs — because ESPN uses one schema across leagues.

**The trade-off is explicit:** ESPN's `geoBroadcasts` will give national broadcaster reliably and regional broadcaster inconsistently; MLB's own API gives both. If the Stats API is open, use it and keep ESPN for odds. If it is gated, use ESPN and accept that RSN attribution becomes a manual mapping table (30 teams, one row each, changes once a year — genuinely not a hardship).

### Paid options
- **SportsDataIO MLB** — https://sportsdata.io/mlb-api. Free trial, quote-based pricing. **[UNVERIFIED]**
- **Sportradar MLB v8** — explicitly advertises "League Schedule – Complete schedule information for a given season, including venue **and broadcast info**" (https://developer.sportradar.com/baseball/reference/mlb-overview). This is the most directly on-target paid product I found for any of the four leagues. Pricing not public; Sportradar is enterprise-tier and almost certainly the most expensive option here. **[UNVERIFIED]** Note it and move on.

---

## 2. Broadcast/media data

**MLB is the only one of the four leagues with a real `/games/media` equivalent** — assuming §1's access question resolves favorably.

- `hydrate=broadcasts(all)` on the schedule endpoint is the mechanism. The `all` argument is what pulls regional/local broadcasters in addition to national ones. Broadcasts come back typed (TV vs radio, national vs local, home-feed vs away-feed). **[INFERRED from the hydration name and the wrapper's `national_broadcasts` field, which exists specifically because the unhydrated call returns only national.]**
- **The home/away feed distinction is the thing that matters most for MySports.** Every MLB game has two independent local telecasts with different networks, different announcers, and different rights. Joe can watch the Guardians feed; he cannot watch the Rockies feed of the same game. If the model treats "broadcast" as a single-valued attribute of a game, MLB is unrenderable. See §9.
- **Fallback if hydration is unavailable:** 506sports publishes MLB listings on its home page with a documented notation — games marked with `*` are blacked out in the two teams' local areas, and "for certain MLB Network broadcasts, an alternate game will air in these areas; these are listed below as 'MLBN alt'" (https://506sports.com/). That "MLBN alt" concept is a real rendering case: **one network row, two different games, split by market.** It is the MLB version of the NFL coverage-map problem, at much smaller scale.
- **Team-level primary source:** MLB.com publishes each club's broadcast arrangements in team news. The Guardians' 2026 announcement (https://www.mlb.com/guardians/news/guardians-partner-with-mlb-for-2026-guardians-tv-broadcasts) is a model of what is available: national game counts by network, the WKYC simulcast count, the radio network, and the on-air crew, all in one place. **Recommendation: for a one-team product, a once-a-season read of the home club's announcement is worth more than any adapter.**

---

## 3. National TV rights map, 2026–28

### The shakeup, verified

MLB signed **three-year agreements with ESPN, NBCUniversal and Netflix covering the 2026–2028 seasons**, announced November 19, 2025 (https://www.mlb.com/news/mlb-sunday-night-baseball-to-debut-on-nbc-and-peacock; https://www.espn.com/mlb/story/_/id/47026249/espn-mlb-reach-new-3-year-media-agreement). The three deals average nearly $800 million a year: ESPN $550M, NBC $200M, Netflix $50M (ESPN). FOX, TBS/Turner and Apple TV kept their existing arrangements.

**What moved:**
- **Sunday Night Baseball left ESPN after 35 years and went to NBC/Peacock.** ESPN had carried it since 1990.
- **ESPN lost the Home Run Derby and the Wild Card round**, and gained a new 30-game national package plus **exclusive rights to MLB.TV** and **exclusive local in-market streaming rights for six clubs — including the Guardians** (https://www.sportsvideo.org/2025/11/19/mlb-media-rights-shakeup-overview-espn-nbcu-and-netflix-inks-three-year-deals/; https://www.bleedcubbieblue.com/baseball-news/201840/mlb-tv-national-rights-nbc-espn-netflix).
- **Netflix entered baseball**: Opening Night (Yankees at Giants, March 25, 2026), the Home Run Derby, and the Field of Dreams game (Twins–Phillies, Dyersville, August 13).
- **NBCSN was relaunched as a cable network** and is now a linear home for MLB, NBA, Big Ten and Notre Dame football, and Premier League (https://www.cabletv.com/news/nbc-sports-network-relaunch-explained).

### Outlet map against Joe's access profile

| Outlet | Package / windows | Exclusive? | Joe's access |
|---|---|---|---|
| **NBC** | Sunday Night Baseball (20 NBC games in 2026, incl. two Opening Day games and a Labor Day showcase); Opening Day and Labor Day primetime; MLB Draft and Futures Game | National exclusive in its windows | **Available** |
| **Peacock** | All SNB; **MLB Sunday Leadoff — 18 games**, late-morning starts, 17 Peacock/NBCSN exclusive + 1 NBC simulcast; a Sunday-afternoon whip-around show; the July 5 "Roadblock" where **all 15 games that day are exclusively on Peacock/NBC** | **Exclusive.** Sunday Leadoff games are blacked out on MLB.TV and MLB Extra Innings (https://www.cabletv.com/sports/watch-mlb-sunday-leadoff) | **Available** (Peacock Premium, now $12.99/mo) |
| **NBCSN** | Simulcasts of Peacock-exclusive regular-season and postseason MLB games; most SNB games (https://www.mlb.com/news/mlb-sunday-night-baseball-to-debut-on-nbc-and-peacock) | Simulcast of Peacock | **Probably NOT carried on DIRECTV — and it does not matter.** As of January 2026 only Xfinity had added NBCSN, with DIRECTV listed as a "potentially later in 2026" (https://www.cabletv.com/sports/what-channel-is-nbcsn). Because NBCSN duplicates Peacock, Joe loses nothing. **Model NBCSN as unavailable and let Peacock satisfy the game.** |
| **ESPN** | New 30-game national package; **exclusive home of MLB.TV**; exclusive in-market streaming for 6 clubs incl. Guardians | Exclusive in its windows | **Available** (ESPN Unlimited via DIRECTV) |
| **FOX** | Saturday games; All-Star Game; Division Series, LCS, World Series | National | **Available** |
| **FS1** | Regular-season overflow (3 Guardians games in 2026) | National | **Available** |
| **TBS** | Tuesday night games; Division Series and LCS | National | **Available** (Joe has TNT/truTV; TBS is the Turner sports channel in the same tier) — **[INFERRED, verify]** Joe's profile lists TNT and truTV but not TBS by name. TBS is standard on DIRECTV CHOICE. See §10 Q4. |
| **Apple TV** | Friday Night Baseball doubleheaders, weekly | **Exclusive** — no linear alternative | **NOT held. Would require a new subscription: Apple TV at $12.99/mo** (https://www.tomsguide.com/entertainment/streaming/what-streaming-costs-in-2026-the-price-of-netflix-disney-plus-max-and-more) |
| **Netflix** | Opening Night; Home Run Derby; Field of Dreams game; one special-event game per year | **Exclusive** | **Available** |
| **MLB Network** | Nightly national games; "MLBN alt" market-split games | National, with local blackouts | **Available** — MLB Network is included in DIRECTV CHOICE (https://www.allconnect.com/providers/directv/choice) |
| **MLB.TV** | All out-of-market games | Now sold through ESPN | Not held; not needed in-market (see §4) |

**Net for Joe: one real gap — Apple TV's Friday Night Baseball.** Everything else in the 2026 national map is already inside his profile. That is a single $12.99/month decision covering roughly one game per week that involves the Guardians only occasionally.

---

## 4. Regional rights — Cleveland / Guardians

This is the best-documented and most favorable regional situation of the four leagues, and it is worth understanding precisely because it is unusual.

### What happened to Bally Sports Great Lakes
**MLB itself now produces and distributes local Guardians games.** The club's own announcement is unambiguous: "MLB will both produce and distribute local Guardians games in 2026" (https://sports.yahoo.com/articles/cleveland-guardians-mlb-announce-streaming-112827590.html, reporting MLB's Feb 10, 2026 announcement; club release at https://www.mlb.com/guardians/news/guardians-partner-with-mlb-for-2026-guardians-tv-broadcasts). The Guardians were one of five clubs in this arrangement in 2025 — with the Padres, Diamondbacks, Twins and Rockies — joined by the Mariners for 2026 (https://www.bleedcubbieblue.com/baseball-news/201840/mlb-tv-national-rights-nbc-espn-netflix).

**There is no Rock Entertainment Sports Network involvement in Guardians baseball.** RESN is the Cavaliers/Monsters vehicle (covered in `research-nba.md`); the Guardians went to MLB Local Media instead. **[VERIFIED by absence — every 2026 Guardians broadcast source names MLB/Guardians TV, none names RESN.]** FanDuel Sports Network Ohio does not carry the Guardians either — and as of April 2026 it does not carry anything, having shut down along with the rest of the Main Street Sports RSNs (see `research-nba.md` §4 and `research-nhl.md` §4). **The Guardians' 2025 move to MLB Local Media, which looked at the time like a one-club oddity, turns out to have been the earliest of three Cleveland-market exits from the RSN model.**

### How Joe watches the Guardians
1. **Linear, via DIRECTV — "Guardians TV," channel 662.** A dedicated Guardians channel exists on DIRECTV (https://www.cabletv.com/mlb/watch-cleveland-guardians). The club says it "anticipates a similar mix of cable and third-party providers to carry Guardians TV this season as in 2025" and tells fans to verify with their provider. **[INFERRED, high confidence]** Joe's DIRECTV CHOICE tier is the RSN-inclusive tier, so this should be in his lineup. Confirm — §10 Q2.
2. **Over the air, free — WKYC (NBC 3) carries 10 local simulcasts**, plus an 11th game on April 12 when the Guardians were on NBC's Sunday Night Baseball (https://www.mlb.com/guardians/news/guardians-partner-with-mlb-for-2026-guardians-tv-broadcasts).
3. **Direct-to-consumer — CLEGuardians.TV.** In-market streaming with **no blackouts**. Priced at **$20/month or $100/season** (https://www.sportsmediawatch.com/tv-schedules/mlb-tv-schedule/cleveland-guardians/); MLB was promoting a **$54.99** rest-of-season rate in August 2026 (https://www.mlb.com/news/cleguardians-tv-2026-season). Bundles with MLB.TV at a stated 20% saving. Spring Training games for MLB-produced clubs stream free with an MLB.com account.
4. **YouTube TV does not carry CLEGuardians.TV** — irrelevant to Joe, but worth noting as a carriage-gap pattern **[UNVERIFIED, single third-party source]** (https://sportsbrackets.net/2026/03/31/2026-cleveland-guardians-schedule-results-tv-guide-and-printable-pdf/).

### Blackout rules to encode
- **MLB.TV is blacked out in-market.** An in-market Cleveland viewer cannot use MLB.TV for Guardians games; that is what CLEGuardians.TV exists to replace.
- **National exclusives black out the local feed.** Sunday Leadoff games are blacked out on MLB.TV and Extra Innings. When ESPN, Netflix, Apple or the Peacock exclusives take a game, the local telecast does not exist for that game. **This is a suppression rule, not a duplication rule** — the access engine must remove the local row, not add a second one.
- **MLB Network's national game is blacked out in the two teams' markets**, with an "MLBN alt" game substituted (https://506sports.com/).

### Guardians national exposure, 2026
13 games nationally: **NBC 1, Peacock 3, FOX 5, FS1 3, TBS 1** (club release, above). Small enough that a hand-maintained override table would work if automation proves fragile.

---

## 5. Grid-model stress points

### 5.1 Volume — ~15 games a day, 180 days a year

**The problem.** A Tuesday in June has 15 games, most starting inside a 3-hour window (7:05, 7:07, 7:10, 7:15, 7:40, 8:10, 9:40, 10:10 ET). Each has a home feed and an away feed. That is up to 30 telecasts. The CFB grid was built for a Saturday with tens of games spread across a 14-hour day on ~23 distinct network rows. An MLB Tuesday is *denser in time* and *narrower in networks*.

**Proposed treatment:**
1. **Access-filter before layout, hard.** The grid should render only telecasts Joe can actually receive. For Cleveland that is: Guardians TV (one game), the national game(s) of the night, and MLB Network's game if not blacked out. **A typical Tuesday reduces from 30 telecasts to 2–4 rows.** This is the product working as designed, and it is the single strongest argument for the access-profile architecture.
2. **Add a collapsed "Around the League" strip** — a one-line-per-game compact list of the other games with score/status but no grid geometry, below the grid. Same pattern proposed for NFL out-of-market games. One component, two leagues.
3. **Do not attempt a 30-row grid, even behind a toggle.** It is not a TV guide at that point.

### 5.2 Game length vs fixed blocks

MLB has no clock. Nine-inning games run roughly 2h35m–3h under the pitch timer, extra-inning games run indefinitely, and rain delays are unbounded.

**Proposal: `block_duration_minutes = 180` for `sport = mlb`** — three hours, six columns. Then two refinements:
- **Render the block as open-ended, not truncated.** The design language's docked footer tray can carry a subtle "→" or "LIVE" state on the trailing edge for an in-progress game past its nominal end. Baseball's honest answer is "until it's over," and pretending otherwise is worse than admitting it.
- **The truncate-at-next-game rule mostly does not fire for MLB**, because a network row rarely has a second game the same night. Where it does — MLB Network, FS1 doubleheaders — it works unchanged.

### 5.3 Doubleheaders

Two flavors, and they render differently:
- **Split doubleheader** — two separate admissions, e.g. 1:10 and 7:10. These are two independent games in two grid slots and need no special handling beyond correct `gamePk` distinctness.
- **Traditional/day-night same-admission doubleheader** — game 2 starts ~30–45 minutes after game 1 ends, so **game 2 has no scheduled start time worth trusting.** This is a TBD state with a different cause than the NFL's flex. **Recommendation: reuse the `schedule_certainty` enum from the NFL work and add a `TBD_FOLLOWS` value meaning "starts after the preceding game concludes."** Render game 2 with a start-time placeholder and an explicit "approx." marker rather than a fake clock time. This is exactly the failure mode the CFB §11.2 rule was written to prevent (midnight-ET placeholder presented as fact).
- MLB also assigns a **doubleheader game number** per game. Capture it; it belongs in the footer tray ("Game 2 of 2").

### 5.4 Home-feed / away-feed duplication

Covered in §2 and §9. The one-sentence version: **for MLB, `broadcast` is a many-to-one relation with a `feed_side` discriminator (`home` | `away` | `national`), and the access filter must select at most one.**

### 5.5 West Coast late starts
10:10 p.m. ET first pitches push past midnight ET, and a Guardians game in Seattle ends around 1:15 a.m. ET. **The grid's day boundary must be a *viewing* day, not a calendar day** — recommend a 3:00 a.m. ET cutover so a late West Coast game stays on the day it started. This will matter more for NBA and NHL; solve it here. Note the MLB Stats API docs already flag the inverse trap: truncating the UTC timestamp puts a late game on the *next* date.

---

## 6. Announcer crews

- **The club's own release is the best source for the home feed.** Matt Underwood, Rick Manning and Andre Knott are the 2026 Guardians TV crew; Tom Hamilton and Jim Rosenhaus continue on WTAM 1100 radio (https://www.mlb.com/guardians/news/guardians-partner-with-mlb-for-2026-guardians-tv-broadcasts). For a local feed the crew is essentially constant all season, so this is a once-a-year fact, not a feed.
- **National crews are announced per-package and are also near-constant.** NBC's Sunday Night Baseball crew for 2026: Bob Costas (host), Jason Benetti (play-by-play), Ahmed Fareed (Sunday Night Leadoff host), with Clayton Kershaw, Joey Votto and Anthony Rizzo as analysts (https://sports.yahoo.com/articles/sunday-night-baseball-schedule-2026-045002911.html).
- **506sports carries per-game MLB announcer listings** on its home page alongside the blackout notation (https://506sports.com/), same as for NFL.

**Recommendation: for MLB, model announcer crews as an attribute of the *broadcast package*, not of the game.** A per-game scrape is overkill when 162 Guardians telecasts share one crew. Store `crew` on `(network, season, package)` with per-game overrides, and the maintenance cost drops to near zero. This is a genuine per-sport modeling difference from the NFL, where crews genuinely rotate weekly.

---

## 7. Betting lines

**Same recommendation as NFL: take them from ESPN's scoreboard payload and buy nothing.** **[INFERRED — verified in detail on the NFL endpoint; ESPN uses one schema across sports.]** The NFL payload carried a fully populated DraftKings `odds[]` block with `spread`, `overUnder`, opening and closing lines, and moneyline, on every scheduled game.

Two MLB-specific notes:
- **Baseball's primary line is the moneyline, not the spread.** The "run line" is a near-constant ±1.5, which makes it nearly meaningless as a display element. **Recommendation: for `sport = mlb`, render moneyline and total in the footer tray, not spread.** This is a per-sport render policy, not a data problem — ESPN gives you all three.
- Same caveat as NFL: strip the DraftKings affiliate deep-links, keep the numbers, attribute in the legend.

**If a dedicated odds API is ever needed:** The Odds API's free tier is 500 credits/month where cost = markets × regions per call (https://oddspapi.io/blog/the-odds-api-free-tier-limits/). For MLB specifically this is *worse* than for other leagues — 15 games a day for 180 days is a lot of polling. Another argument for riding ESPN.

---

## 8. Assets

- **Logos: `https://a.espncdn.com/i/teamlogos/mlb/500/{abbr}.png`, with a `500-dark` sibling.** **[INFERRED from the verified NFL pattern]** — the NFL payload confirmed `a.espncdn.com/i/teamlogos/nfl/500/{abbr}.png`, `.../nfl/500/scoreboard/{abbr}.png`, and the existence of a `500-dark` directory. The path is league-parameterized. **30 teams × light/dark = 60 PNGs.**
- **A complication the other leagues don't have: MLB clubs have alternate and city-connect identities**, and MLB's own broadcasts use them. **Recommendation: ignore alternates for v1.** The frozen design language uses a single full-height logo endcap per team; introducing conditional identities is a v2 conversation.
- **Colors:** ESPN's `color` / `alternateColor` hex fields, same as NFL, with the same warning — ESPN's palette is tuned for ESPN's UI and drifts from official brand values (the Ravens came back as `29126f` against an official `241773`). **Audit all 30 against club brand pages before first render.**
- **Network marks needed beyond the existing cache:** NBCSN (new mark, relaunched network — expect Wikimedia drift), MLB Network, TBS, Apple TV, FS1, plus Peacock and Netflix already needed for NFL. **NBCSN is the highest-risk fetch** because the relaunched network's logo is new and Wikimedia's title may not have caught up. Flag it explicitly to the fetch script's miss-reporting.
- **A per-team "Guardians TV" style mark.** MLB-produced club feeds have their own branding (CLEGuardians.TV logo, credited to MLB in Sports Media Watch's asset line). For a one-team product this is one asset and it makes the grid look right. Worth grabbing by hand.

---

## 9. Schema deltas against v0.3 (beyond the NFL deltas)

The NFL doc already proposes `market_coverage`, `schedule_certainty`, `delivery_surface`, `blackout_rule`, per-sport render policy, and odds fields. MLB adds:

1. **`feed_side` on the broadcast relation — blocking.** Enum `HOME | AWAY | NATIONAL`. Without it the model cannot express that a single game has two simultaneous, differently-rightsed local telecasts. This is MLB's defining structural difference and it has no CFB analogue.
2. **`doubleheader_game_number` on game — blocking.** Integer, null for single games. Plus the `TBD_FOLLOWS` value on `schedule_certainty` (§5.3).
3. **`series_id` and `series_game_number`.** MLB is played in 2–4 game series and the series is a meaningful unit to a viewer ("game 2 of 3 in Colorado"). Cheap to carry, good footer-tray content, and NHL/NBA playoffs will want the same field.
4. **`suppresses_local_feed` on the national-broadcast relation — blocking for correctness.** The national-exclusive blackout is a *removal* rule, not an addition rule (§4). If the engine models national and local broadcasts as independent, an exclusive Peacock game renders as three rows.
5. **`open_ended` boolean on the render block.** Clock-less sports. Applies to MLB only among the four.
6. **`viewing_day_cutover` on the render policy.** Recommend 03:00 ET globally, not per-sport, but define it now (§5.5).
7. **Extend `network` with a `carriage_status` per provider.** NBCSN is the case that forces this: a real, national, rights-holding network that Joe's provider does not carry. Today that would have to be modeled as an absence; it should be a fact with a reason, so the UI can say "on NBCSN — not in your DIRECTV lineup" rather than silently dropping the game.

---

## 10. Open questions for Joe

1. **Test whether the MLB Stats API is still openly reachable — highest priority item in this doc.** Everything in §1 and §2 hinges on it, and my three attempts from this session all returned HTTP 400 while the docs site now shows an Okta login.
   Exact test, to run in a browser on your machine:
   1. Open a new browser tab.
   2. Paste this URL into the address bar exactly: `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-09-01`
   3. Press Enter.
   4. If you see a wall of JSON text starting with `{"copyright":`, the API is open and MLB is the backbone. If you see an error page, a login prompt, or a page saying 400 or 403, it is gated and ESPN is the backbone.
   5. Then try this second URL, which is the one that actually matters: `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-09-01&hydrate=broadcasts(all)`
   6. Search that page (Ctrl+F) for the word `broadcasts`. If it appears with network names under it, the media-data problem for MLB is solved.
   *Assumption made in the meantime:* this doc specifies both paths and recommends the Stats API conditionally.

2. **Confirm Guardians TV is in your DIRECTV lineup (try channel 662).** If it is, MLB local coverage costs you nothing extra. If it is not, CLEGuardians.TV is $100/season.
   *Assumption made:* modeled as available on DIRECTV.

3. **Apple TV for Friday Night Baseball — yes or no?** $12.99/month, exclusive, no linear alternative, roughly one game a week league-wide with the Guardians appearing occasionally. This is the only genuine national-coverage gap MLB creates for you.
   *Assumption made:* modeled as **not held**, so Friday Apple games render as unavailable. Easy to flip.

4. **Confirm TBS is in your DIRECTV lineup.** Your access profile lists TNT and truTV but not TBS. TBS carries Tuesday-night MLB plus the Division Series and LCS. It is standard on CHOICE, so this is almost certainly an omission from the profile rather than a real gap — but the access engine will suppress every Tuesday national game if the profile is taken literally.
   *Assumption made:* treated as available; flag if wrong.

5. **How should the "Around the League" strip behave for a 15-game night?** Same question as the NFL out-of-market strip, and I'd build one component for both. My recommendation: collapsed by default, expandable, no grid geometry, muted register.
   *Assumption made:* one shared component, collapsed by default.

6. **Be aware of the labor risk.** MLB's current CBA expires after the 2026 season and reporting at the time the media deals were signed described a lockout as expected (https://www.si.com/mlb/dodgers/onsi/news/mlb-expanding-digital-presence-new-media-rights-contracts-espn-netflix-nbc-universal-01kgdc0statw). **[UNVERIFIED as to current status]** — I have not checked whether anything has changed since. This does not affect the 2026 build, but it is a real argument for **not** making MLB the second league you build after CFB, since a work stoppage would leave that effort with nothing to render in 2027. Sequencing recommendation is in `research-summary.md`.

---

## Assumptions log

- **Treated the Stats API question as unresolved rather than guessing.** I could have written this doc as though `statsapi.mlb.com` works, since every community wrapper assumes it does. Three failed fetches plus an Okta login on the docs site is enough signal that I would rather flag it than have you build on it and find out later.
- **Recommended a per-package crew model for MLB** against the per-game model used for NFL, on the grounds that 162 games sharing one crew makes per-game scraping pure cost.
- **Recommended moneyline over spread for MLB display**, departing from the NFL treatment, because the ±1.5 run line carries almost no information.
- **Excluded Rock Entertainment Sports Network from MLB entirely.** The brief flagged RESN as something to watch for; it belongs to the Cavaliers, not the Guardians, and I found no source connecting it to 2026 Guardians broadcasts.
- **Did not verify the DIRECTV channel-662 claim against DIRECTV's own lineup**, relying on a single third-party source. It is a two-second check on Joe's own receiver, which is a better use of the verification than another search.
