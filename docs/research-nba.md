# MySports Research — NBA

**Written:** 2026-08-31 (research session, Claude). Findings date-stamped to this day unless noted.
**Season in scope:** 2026–27, the NBA's 81st season. Regular season opens **Tuesday, October 20, 2026** with an NBC/Peacock tripleheader and concludes **Sunday, April 11, 2027** with all 30 teams in action. NBA Cup group play runs October 30 – November 27, 2026. Sources: https://www.nba.com/news/2026-27-nba-regular-season-schedule, https://www.sportsvideo.org/2026/08/13/espn-abc-nbc-peacock-prime-video-set-national-slates-for-year-2-of-nba-rights-deal/
**Confidence key:** **[VERIFIED]** = confirmed against a primary or near-primary source this session. **[INFERRED]** = reasoned from verified facts. **[UNVERIFIED]** = could not confirm.

---

## 0. Headline recommendation

**Use the NBA's own public CDN schedule file as the backbone and ESPN as the cross-check.** `https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json` is the file NBA.com itself renders from — a full-season, no-auth JSON document that the developer community has been consuming for years. Critically, **the NBA's schedule is fully released and published in one artifact in mid-August** for the whole season, which makes NBA the *most* deterministic of the four leagues to model. There is no flex scheduling and no coverage-map ambiguity in the NFL sense.

**Two things make the NBA harder than it first looks:**

1. **"Coast 2 Coast Tuesday" reintroduces the coverage-map problem in miniature.** NBC airs a Tuesday doubleheader — 8 p.m. ET and 11 p.m. ET — and **individual NBC affiliates choose which game to carry, or both, at their discretion.** That means "NBC" on a Tuesday is not a single answer for Cleveland; it depends on what WKYC decides. This is the NFL problem at 1/10th the scale, and it needs the same `market_coverage` machinery.
2. **The NBA Cup is a tournament inside the regular season** and the grid needs to say so, because a Cup group-play game looks identical to a regular game in every data field but is a different thing to a viewer.

**⚠️ CORRECTION APPLIED 2026-08-31, after this doc was first written.** An earlier draft of this section stated that the Cavaliers are on FanDuel Sports Network Ohio at DIRECTV channel 660. **That is wrong for 2026–27.** FanDuel Sports Network Ohio no longer exists — its operator, Main Street Sports Group, wound down in April 2026. **The Cavaliers' 2026–27 local television home is unresolved in public sources as of today.** Full detail and sources in §4, which has been rewritten. The national picture below is unaffected and remains correct: **Joe has zero gaps in the NBA national map.**

---

## 1. Schedule data source

### Recommended backbone: NBA CDN static schedule **[VERIFIED as existing and widely used; live payload UNVERIFIED — see warning]**

- **URL:** `https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json` (https://lightrun.com/answers/swar-nba_api-getting-nba-schedule). Season-numbered variants exist — `scheduleLeagueV2_1.json`, `_9.json` etc. — which appear to be historical snapshots (https://github.com/swar/nba_api/issues/665, https://write.corbpie.com/using-the-nba-schedule-api-with-php/).
- **Auth model:** none. It is a static CDN asset.
- **Cost:** free.
- **Coverage:** the **entire season in one file** — preseason and regular season — structured as `leagueSchedule.gameDates[].games[]`. Contributors describe it as "a treasure trove of schedule data" and the endpoint NBA.com's own schedule page consumes (https://github.com/swar/nba_api/issues/665).
- **Why this beats a per-day API for MySports:** the NBA publishes the complete national broadcast schedule at release (August 13, 2026 for 2026–27) and it does not flex. One daily fetch of one file gives you the whole season, and the render-hash selective-regeneration design will simply see no change on most days. That is close to ideal.
- **Alternative NBA-owned source:** `https://data.nba.com/data/10s/v2015/json/mobile_teams/nba/{season}/league/00_full_schedule_week_tbds.json`, the older mobile feed, whose filename explicitly contains `week_tbds` — suggesting it carries TBD-week handling (https://lightrun.com/answers/swar-nba_api-getting-nba-schedule). Tooling and docs at https://github.com/rlabausa/nba-schedule-data.
- **Live-data companion:** `https://cdn.nba.com/static/json/liveData/` for in-progress state.

### ⚠️ Verification warning **[VERIFIED behavior]**
**My attempt to fetch the CDN file this session was refused by bot detection.** That is a fetcher-level block, not evidence the endpoint is closed — a normal browser or a scripted request with a standard user-agent is a different case entirely. But it means **I have not personally confirmed the broadcaster fields**, which is the load-bearing claim in §2. Test procedure in §10, question 1.

### Fallback: ESPN NBA endpoints **[VERIFIED by pattern]**
`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard`, with `?dates=YYYYMMDD` (https://github.com/pseudo-r/Public-ESPN-API). Same no-auth profile as the NFL endpoint verified in detail in `research-nfl.md` §1: `broadcasts`, `geoBroadcasts` with a `market.type` of National/Home/Away, `odds` with spread and total, `venue`, team hex colors, logo URLs.

**Recommendation: use both, and use them for different things.** NBA CDN for the authoritative schedule and broadcast assignments (it is the league's own data); ESPN for odds and as the schema-drift alarm. If the two disagree on a broadcaster, the league file wins — that is a clean, defensible `authority_rules` entry.

### Others noted, not recommended
- **`stats.nba.com`** — the historical/statistical API, wrapped by `swar/nba_api`. Aggressively rate-limited and header-sensitive; it is a stats API, not a schedule API. Not the right tool.
- **API-Sports (API-NBA)** — https://api-sports.io/documentation/nba/v2. Freemium with a daily-request cap. **[UNVERIFIED]** pricing. Reasonable third fallback.
- **SportsDataIO NBA** — paid, quote-based. **[UNVERIFIED]**

---

## 2. Broadcast/media data

**The NBA CDN schedule file is expected to carry per-game broadcaster data natively, including national, home-feed and away-feed television.** **[UNVERIFIED — strongly expected]** The `scheduleLeagueV2` game object is documented by the community as carrying a `broadcasters` structure segmented by scope (national TV, national OTT/radio, home TV, away TV). I could not confirm the exact field names this session because of the bot block, and I am flagging that rather than asserting it.

**What is certain, from the league's own release** (https://www.nba.com/news/2026-27-nba-regular-season-schedule): the NBA publishes, at schedule release, a **complete list of national TV games and a complete list of League Pass games**, day-by-day and team-by-team. Even in the worst case where the JSON has no broadcaster field, the national assignment is published as structured tabular data on NBA.com and is small enough (~240 games) to be captured once per season.

**The regional/local side** is not in any national feed. For a one-team product the *rule* is trivial — every Cavaliers game not on a national broadcast is on the club's local carrier — but as of today **that carrier is unknown** (§4). The rule is one line; the value it points at is currently null.

**Secondary sources:**
- Sports Media Watch maintains a 2026–27 NBA TV schedule and a service-by-service carriage breakdown that is unusually well-suited to the access-profile model — it explicitly enumerates what each distributor carries (https://www.sportsmediawatch.com/tv-schedules/nba-tv-schedule/).
- **NBA TV's game schedule is announced separately and later** than the main national schedule (https://www.sportsvideo.org/2026/08/13/espn-abc-nbc-peacock-prime-video-set-national-slates-for-year-2-of-nba-rights-deal/). Model NBA TV assignments as late-binding.

---

## 3. National TV rights map, 2026–27

### Structure
2026–27 is **year 2 of 11-year agreements with Disney (ABC/ESPN), NBCUniversal (NBC/Peacock/NBCSN) and Amazon (Prime Video)**, which began in 2025–26 (https://www.nba.com/news/how-to-watch-games-2026-27-season; https://en.wikipedia.org/wiki/NBA_on_television). **TNT is out.** Nearly **240 games** are on national TV or streaming (https://sports.yahoo.com/articles/nba-national-tv-streaming-schedule-221120259.html).

### The weekly pattern — genuinely useful for the renderer
Straight from the league (https://www.nba.com/news/2026-27-nba-regular-season-schedule):

| Night | National outlet |
|---|---|
| Monday | **Peacock** (Peacock NBA Monday), simulcast on NBCSN |
| Tuesday | **NBC / Peacock** — "Coast 2 Coast Tuesday" doubleheader, 8 p.m. ET and 11 p.m. ET |
| Wednesday | **ESPN** (doubleheaders) |
| Thursday | **Prime Video** |
| Friday | **Prime Video and ESPN** |
| Saturday | **Prime Video** afternoon, **ABC** night |
| Sunday | **ABC** afternoon, **NBC / Peacock** night (Sunday Night Basketball, from Jan. 24, 2027) |

**This is a rendering gift.** A stable weekly network rhythm means the grid's network rows are predictable by day of week, which makes layout decisions cacheable and makes anomalies (Christmas, Presidents' Day, MLK Day) visually meaningful rather than noise.

### Package sizes and marquee dates
- **NBC/Peacock: 100 regular-season games.** Three weekly windows: Sunday Night Basketball (from Jan. 24, 2027), Peacock NBA Monday (from Oct. 26), Coast 2 Coast Tuesday (from Oct. 27). Plus a "Holiday Hoops" collection in late December, the **first-ever Presidents' Day quadrupleheader (Feb. 15, 2027)**, the second annual MLK Day slate (Jan. 18, 2027), and seven Sunday Night Basketball doubleheaders. Telemundo carries 10 Sunday Night Basketball games and the All-Star Game.
- **ABC/ESPN: 80 regular-season games**, including the **five-game Christmas Day slate (Friday, Dec. 25, 2026: 12:00, 2:30, 5:00, 8:00 and 10:30 p.m. ET, all ABC/ESPN)**. ESPN platforms are the exclusive home of the NBA Finals on ABC and the 2027 Western Conference Finals, plus first- and second-round playoff games.
- **Prime Video:** Thursday and Friday nights, Saturday afternoons.
- **NBA TV:** schedule TBA.

### Outlet map against Joe's access profile

| Outlet | Joe's access | Notes |
|---|---|---|
| **ABC** | **Available** | Broadcast, WEWS 5 locally |
| **ESPN** | **Available** | DIRECTV + ESPN Unlimited. All ABC/ESPN games also on the ESPN App. |
| **NBC** | **Available** | Broadcast, WKYC 3 locally — but see the Coast 2 Coast caveat in §5.1 |
| **Peacock** | **Available** (Peacock Premium, $12.99/mo) | All NBCU games stream here, including the Monday exclusives |
| **NBCSN** | **Likely NOT carried on DIRECTV — and it does not matter.** As of January 2026 only Xfinity had added the relaunched NBCSN; DIRECTV was listed as "potentially later in 2026" (https://www.cabletv.com/sports/what-channel-is-nbcsn) | NBCSN only simulcasts Peacock exclusives, so Peacock satisfies every NBCSN game |
| **Prime Video** | **Available** | Thursday/Friday/Saturday-afternoon games |
| **Disney+** | **Available** | Occasional ESPN simulcasts (https://www.sportsmediawatch.com/tv-schedules/nba-tv-schedule/) |
| **NBA TV** | **Available** — NBA TV is included in DIRECTV CHOICE (https://www.cabletv.com/directv/channel-lineup/choice, https://sportsnaut.com/streaming/how-to-watch-bally-sports-ohio) | Schedule TBA |
| **NBA League Pass** | Not held; **not needed in-market for Cavs** | Out-of-market only; available as a DIRECTV add-on and a Prime Video add-on |

**Net for Joe: zero gaps in the NBA national map.** Every 2026–27 national NBA game is inside his existing profile. This is the cleanest of the four leagues.

---

## 4. Regional rights — Cleveland / Cavaliers

### The RSN is gone. The replacement is unannounced. **[VERIFIED]**

**Main Street Sports Group — post-bankruptcy successor to Diamond Sports, operator of the 15 FanDuel Sports Network RSNs including FanDuel Sports Network Ohio — wound down operations in April 2026** after a DAZN rescue acquisition failed to materialize (https://en.wikipedia.org/wiki/Main_Street_Sports_Group). Its shutdown left **13 NBA teams without a local broadcast home for 2026–27: the Hawks, Hornets, Cavaliers, Pistons, Pacers, Clippers, Grizzlies, Heat, Bucks, Timberwolves, Thunder, Magic and Spurs** (https://awfulannouncing.com/local-networks/main-street-sports-group-shuttering-13-nba-teams-local-tv.html).

Local reporting tracked it in real time: Main Street notified Ohio it would close its downtown Cleveland office and lay off 27 employees effective April 14, two days after the Cavaliers' regular season ended, meaning **"the Cavs' local TV rights ... will revert to the team"** (https://sports.yahoo.com/articles/fanduel-sports-network-begins-process-161529707.html). Crain's Cleveland Business covered the Cavaliers "exploring TV options after FanDuel network shutdown" in March (https://www.crainscleveland.com/sports-recreation/ccl-cavs-broadcast-future-20260306/).

**As of 2026-08-31 — seven weeks before opening night — I found no announcement of where Cavaliers games will air in 2026–27.**

### Two stale sources to distrust, and why it matters
- **DIRECTV's own site still describes FanDuel Sports Network Ohio as channel 660, CHOICE and above** (https://www.directv.com/insider/fanduel-sports-network-ohio/, dated February 2026). Carrier channel-lineup pages lag reality by months.
- **Wikipedia's 2026–27 Cavaliers season page still lists "FanDuel Sports Network Ohio"** as the local television (https://en.wikipedia.org/wiki/2026%E2%80%9327_Cleveland_Cavaliers_season) — almost certainly carried forward unedited from the prior season's infobox.

**Both of those sources are the kind MySports' authority model would rank highly** — an operator's own site and a structured reference. Both are wrong. **Recommendation: RSN and local-carrier attribution should have an explicit staleness horizon in `authority_rules` — measured in weeks, not seasons — and should be re-verified at every season boundary regardless of source rank.** This is a concrete rule change earned by a concrete mistake, and it is the most useful thing in this section.

### The most likely outcome **[INFERRED, not verified]**
The reporting names the plausible landing spots: **RESN or WUAB**, "which is more likely than WOIO because of network agreements," and describes any such move as potentially "a one-year bridge" (https://sports.yahoo.com/articles/fanduel-sports-network-begins-process-161529707.html). The strategic context: **the NBA wants to launch a league-run national regional sports network for the 2027–28 season**, which Main Street's collapse makes more likely by handing the league rights to up to 20 teams (same source; the 2027–28 centralized-hub target is corroborated at https://www.espn.com/nhl/story/_/id/49419342/nhl-produce-games-hurricanes-blue-jackets-wild-blues).

So the shape of the answer is probably: **a Gray Media over-the-air arrangement in 2026–27 as a bridge, folding into an NBA-operated product in 2027–28.** Gray already owns WOIO, WUAB and co-manages RESN, and already carries the Cavaliers' five simulcast games (below). **[This is inference, clearly labeled. Do not build against it.]**

### The RESN precedent, which still holds and is now more relevant **[VERIFIED for 2025–26]**
The Cavaliers, RESN, Gray Media and FanDuel Sports Network simulcast **five Cavaliers games per season** free to air (https://watchrocksports.com/cavs-simulcast-games). Where they appeared:
- **Free over the air on channel 22.1** (WOHZ-CD) and **on Cleveland's 43 (WUAB)**
- **DIRECTV channel 43** (WUAB)
- Spectrum 979; Columbus WDEM 17.1; Cincinnati 19.3

RESN is owned by Gray Media as part of Gray Broadcast Sports Networks and co-managed by Rock Entertainment Group (Dan Gilbert); it launched August 23, 2024 and carries the Cleveland Charge, Cleveland Monsters, Lake Erie Crushers and high-school sports (https://en.wikipedia.org/wiki/Rock_Entertainment_Sports_Network). **If Gray becomes the Cavaliers' primary carrier, this infrastructure is what it would run on.**

### Rendering consequence, unchanged
When one game lands on multiple Joe-receivable outlets simultaneously — as the five simulcast games did across FanDuel, WUAB/43 and RESN 22.1 — that is a **duplication-suppression case** and the cleanest available test fixture for the `simulcast_rules` logic. **Recommend keeping one of these games as the NBA simulcast regression test even though the specific carriers will change.**


### Blackouts
- NBA League Pass blacks out in-market games. Irrelevant to Joe in-market.
- National exclusives (Peacock Monday, Prime Thursday/Friday) **suppress the local RSN telecast**, same suppression-not-duplication rule as MLB (§9 of `research-mlb.md`). **[INFERRED]** — the NBA's national-exclusivity structure works this way, but I did not find an explicit 2026–27 statement of it.

---

## 5. Grid-model stress points

### 5.1 Coast 2 Coast Tuesday — the affiliate-discretion problem

**This is the NBA's version of the NFL coverage map, and it is easy to miss.**

NBC airs two games on Tuesday nights: the first at 8 p.m. ET on stations in the Eastern and Central zones, the second at 8 p.m. PT (11 p.m. ET) on Mountain and Pacific stations (https://en.wikipedia.org/wiki/NBA_on_television). But for 2026–27 the league states that **"during most weeks NBC affiliates will have the option to show the 8 p.m. ET game, the 11 p.m. ET contest, or both Tuesday games at their discretion"** (https://en.wikipedia.org/wiki/2026%E2%80%9327_NBA_season).

**So "is this game on NBC in Cleveland?" is a question about WKYC's programming decision, not about the league schedule.** No national data source will answer it.

**Proposed treatment:**
1. **Default assumption: WKYC carries the 8 p.m. ET game.** **[INFERRED]** Eastern-zone affiliates take the Eastern-window game; that is the design of the package.
2. **Render the 11 p.m. ET game as `NBC — affiliate option`** with a distinct, muted marker in the footer tray, not as a confirmed row and not as absent. This is a third certainty state alongside `FINAL` and `FLEX_PENDING`: call it **`AFFILIATE_DISCRETION`**.
3. **Peacock resolves it anyway.** Both Coast 2 Coast games stream on Peacock regardless of what WKYC does. So the honest render is: NBC row shows the 8 p.m. game; the 11 p.m. game appears on the Peacock row with an "also NBC in some markets" note. **The access engine is correct either way, which is the point of building it.**
4. Reuse the same `market_coverage` entity proposed for the NFL. Do not build a second mechanism.

### 5.2 Density and West Coast late starts
A full NBA night is 8–13 games, mostly 7:00–10:30 p.m. ET, with 10:00 and 10:30 p.m. ET West Coast starts running to roughly 1:00 a.m. ET. Less dense than MLB, more compressed than the NFL.

- **Access filtering does most of the work again.** For Joe, a typical night is: the Cavaliers game on whatever the local carrier turns out to be, plus that night's one or two national games. **Two to four rows, not thirteen.**
- **Same "Around the League" collapsed strip** as proposed for NFL and MLB. Third league, same component.
- **The 3:00 a.m. ET viewing-day cutover proposed in `research-mlb.md` §5.5 is required here**, not optional. A 10:30 p.m. ET tip on the West Coast ends after midnight ET on most NBA nights, several times a week, all season.

### 5.3 Block duration
NBA games run about 2 hours 15 minutes wall clock; nationally televised games run slightly longer. **Recommend `block_duration_minutes = 150` (2.5 hours, five columns) for `sport = nba`.** This matters because ESPN Wednesday and NBC Tuesday doubleheaders are back-to-back on one network row, and a 3-hour default would produce a false overlap between the 8:00 and 10:30 games. The truncate-at-next-game rule then handles the real collision correctly.

### 5.4 The NBA Cup — a tournament hiding inside the schedule
Group play is **60 games, Oct. 30 – Nov. 27, 2026**, followed by knockout rounds (https://www.nba.com/news/2026-27-nba-regular-season-schedule). Cup group-play games are also regular-season games and are indistinguishable in the schedule data from ordinary games unless flagged.

**Recommendation: carry a `competition_context` attribute on game** — values like `REGULAR`, `CUP_GROUP`, `CUP_KNOCKOUT`, `PLAY_IN`, `PLAYOFF_R1`. The frozen design language already has a **gold sunburst for marquee games**; NBA Cup games are exactly the case that treatment exists for. This also gives NHL and MLB somewhere to put "Winter Classic" and "Field of Dreams."

### 5.5 Holiday quadrupleheaders and quintupleheaders
Christmas Day 2026 is **five consecutive ABC/ESPN games** from noon to past 1 a.m. ET. Presidents' Day 2027 is the first-ever NBA quadrupleheader on NBC. MLK Day is a four-game all-day slate.

**This is the ALT-lane rule's best case, not its worst.** Five sequential games on one network row is exactly what truncate-at-next-game was designed for — it should render beautifully as a continuous ABC/ESPN band across the day. **Recommend using Christmas Day 2026 as the NBA hero render** for the v0.5+ design work. It will look spectacular in the frozen dark-broadcast language and it stress-tests the day-boundary logic at the same time.

---

## 6. Announcer crews

- **Cavaliers local crew, most recent confirmed (2025–26):** John Michael (play-by-play), Brad Daugherty (analyst), Serena Winters (sideline); Cayleigh Griffin hosts *Cavaliers Live* pre/post with Austin Carr for home games, Winters hosts on the road (https://watchrocksports.com/news/cleveland-cavaliers-announce-2025-26-local-broadcast-schedule; https://en.wikipedia.org/wiki/List_of_Cleveland_Cavaliers_broadcasters). **[2026–27 UNVERIFIED]** — the crew is team-employed rather than network-employed, which is why the NHL's equivalent crews survived the same RSN collapse intact (`research-nhl.md` §4). Expect continuity in the game crew and churn in studio roles.
- **Same modeling recommendation as MLB: crew belongs on the broadcast package, not the game.** The Cavaliers' local crew is constant across ~77 telecasts. Per-game scraping would be pure waste.
- **National crews** rotate. 506sports' archive covers national NBA broadcasts (https://506sports.com/), and the network press rooms publish weekly assignments. Same authority order as NFL: club release > network press room > 506sports > aggregators.
- **Practical note:** the Cavaliers publish a full local broadcast schedule with the crew as a single annual announcement (https://watchrocksports.com/news/cleveland-cavaliers-announce-2025-26-local-broadcast-schedule). **One read per season replaces an entire adapter.**

---

## 7. Betting lines

**Same as NFL and MLB: take spread and total from ESPN's scoreboard payload.** **[INFERRED from the NFL payload verified in detail]** — the `odds[]` block with DraftKings `spread`, `overUnder`, opening/closing lines and moneyline is part of ESPN's cross-sport schema.

NBA-specific note: **the point spread is the meaningful line for basketball**, unlike baseball. Render spread + total in the footer tray, matching the NFL treatment. Same guidance on stripping affiliate deep-links and attributing in the legend.

**No odds API purchase warranted.** For completeness: The Odds API free tier is 500 credits/month with cost = markets × regions per call (https://oddspapi.io/blog/the-odds-api-free-tier-limits/); at ~10 games a night for six months this is not viable free, which is another point for the ESPN route.

---

## 8. Assets

- **Logos: `https://a.espncdn.com/i/teamlogos/nba/500/{abbr}.png` with a `500-dark` sibling.** **[INFERRED from the verified NFL pattern]** — the NFL payload confirmed the league-parameterized path and the existence of `500-dark`. **30 teams × light/dark = 60 PNGs.**
  - Alternative: the NBA's own CDN serves team logos at `https://cdn.nba.com/logos/nba/{teamId}/...` **[UNVERIFIED]**. The ESPN path is already proven and the fetch script already exists; prefer it.
- **Colors:** ESPN `color` / `alternateColor` hex, with the same audit warning as the other leagues — ESPN's palette drifts from official brand values. 30 teams, one hour of hand-checking.
- **Network marks beyond the existing cache:** NBCSN (new relaunched mark — flag as high-risk for the Wikimedia fetch, same as MLB) and NBA TV.
- **Do NOT fetch a FanDuel Sports Network Ohio mark.** The network is defunct (§4). This is a live illustration of standing risk #4 in the handoff doc — Wikimedia titles drift with rebrands — with a sharper edge: **sometimes the network doesn't rebrand, it dies.** The fetch script's miss-reporting should distinguish "logo not found" from "network no longer exists," because the second is a data-model event, not a fetch failure.
- **The Cavaliers' 2026–27 local carrier mark cannot be fetched because the carrier is unannounced.** Leave a null and a TODO.
- **RESN's mark** — likely needed regardless of how the local rights land, since Gray/RESN carries the simulcast games and is a plausible primary carrier. Small, local, probably not on Wikimedia. **[INFERRED]** Grab by hand from https://watchrocksports.com.

---

## 9. Schema deltas against v0.3 (beyond NFL and MLB deltas)

1. **`AFFILIATE_DISCRETION` as a value on `schedule_certainty`** (or better, on the broadcast relation rather than the game — the *game* is certain, its *carriage* is not). Coast 2 Coast Tuesday is the driver (§5.1). **[This is a genuinely new state that neither CFB nor NFL nor MLB requires.]**
2. **`competition_context` on game** — `REGULAR | CUP_GROUP | CUP_KNOCKOUT | PLAY_IN | PLAYOFF` (§5.4). Feeds the gold-sunburst marquee treatment.
3. **`simulcast_group` needs to support 3+ members.** The Cavaliers/RESN arrangement put one game on the RSN, WUAB/43 and RESN 22.1 simultaneously (§4). If the Phase 3A `simulcast_rules` work assumed pairs, it needs widening — and the Blue Jackets' 2025–26 six-game simulcast went wider still, across a CW station plus Gray stations in six markets plus Prime Video plus Pluto TV (`research-nhl.md` §4).
4. **`carriage_status` per (network, provider)** — first proposed in the MLB doc for NBCSN; the NBA reinforces it, since NBCSN carries NBA Mondays too.
5. Everything else the NBA needs is already covered by the NFL and MLB deltas: `market_coverage`, `delivery_surface`, `blackout_rule`, `suppresses_local_feed`, per-sport `block_duration_minutes`, `viewing_day_cutover`.

**Observation worth flagging:** three leagues in, the schema deltas are converging rather than diverging. `market_coverage`, `schedule_certainty`, `delivery_surface` and `suppresses_local_feed` cover the NFL, MLB and NBA between them. That is a good sign for the multi-sport model — it suggests the v0.3 design was close, and the gaps are a handful of relations rather than a rethink.

---

## 10. Open questions for Joe

1. **Confirm the NBA CDN schedule file is reachable and carries broadcaster data.** My fetch was refused by bot detection, so §2's central claim is unverified.
   Exact test:
   1. Open a browser tab.
   2. Paste: `https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json`
   3. Press Enter. It is a large file; give it a few seconds.
   4. If JSON loads, press Ctrl+F and search for the word `broadcasters`.
   5. If `broadcasters` appears, tell me — the NBA media-data problem is solved and no scraping is needed.
   6. If the file will not load in a browser, it is worth one Claude Code prompt to fetch it with a normal user-agent; browsers and scripts get treated differently by CDNs.
   *Assumption made:* the file works and carries broadcasters; the ESPN fallback is specified in case it doesn't.

2. **Find out where Cavaliers games will air this season — this is now an open fact, not a confirmation.** FanDuel Sports Network Ohio is dead and the replacement is unannounced as of my information. It may well have landed in the weeks since; check https://www.nba.com/cavaliers/news or Crain's Cleveland. **Until this is known, the NBA local row has no carrier and the league is not fully buildable** — the national map is fine, but roughly 60 of 82 Cavaliers games have nowhere to render.
   *Assumption made:* modeled as `TBA` (the same state proposed for the Blue Jackets in `research-nhl.md` §9), with a Gray Media / RESN over-the-air bridge as the most likely single outcome. **Do not build against that guess.**

3. **When a Cavaliers game is simulcast on multiple outlets you receive, do you want one row or several?** My recommendation is one row with a small "also free OTA on 22.1" chip in the footer tray — showing the same game three times is exactly the noise the grid exists to remove. But the free-to-air ones are worth surfacing somehow.
   *Assumption made:* folded, with a footer chip.

4. **How should NBA Cup games look?** I'm proposing the existing gold-sunburst marquee treatment plus a "NBA CUP — GROUP" label in the footer tray. That reuses frozen design language rather than adding to it.
   *Assumption made:* reuse the sunburst.

5. **Christmas Day 2026 as the NBA hero render.** Five straight ABC/ESPN games, noon to 1 a.m. It is the best-looking day on the NBA calendar and it stress-tests the day-boundary rule. I'd build the NBA renderer against it rather than a generic Tuesday.
   *Assumption made:* using it as the reference render.

---

## Assumptions log

- **Chose the NBA's own CDN file over ESPN as primary**, reversing the NFL recommendation, because the NBA publishes its own complete season schedule as a static artifact and the league is the better authority for its own broadcast assignments. ESPN stays as odds source and drift alarm.
- **Assumed WKYC takes the 8 p.m. ET Coast 2 Coast game.** Eastern-zone affiliates taking the Eastern-window game is the package's design intent, but it is an inference and the league explicitly gives affiliates discretion. The proposed `AFFILIATE_DISCRETION` state exists so this assumption is visible in the UI rather than buried in code.
- **Did not chase NBA TV's schedule** because it has not been announced for 2026–27. Modeled as late-binding.
- **I got the Cavaliers' local carrier wrong on the first pass and corrected it.** The first draft of §4 said FanDuel Sports Network Ohio, DIRECTV channel 660, sourced from DIRECTV's own site and Wikipedia's 2026–27 Cavaliers page. Both are stale; the network shut down in April 2026. I caught it while researching the NHL, where the same corporate collapse is the central story. The correction is applied in §0, §4, §8 and §10, and the episode produced the most useful recommendation in this doc — a staleness horizon on RSN attribution in `authority_rules` (§4). Recording it rather than quietly fixing it, because the failure mode matters more than the fact.
- **Did not verify that national exclusives suppress the local RSN feed for the NBA.** It is how the NFL, MLB and every prior NBA deal have worked, and the alternative would produce visible double-coverage that nobody has reported. Flagged as INFERRED in §4.
