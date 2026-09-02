# 02 — Comparables Scrape

**Set:** `00-README.md` · `01-current-state.md` · **this doc** · `03-enhancement-specs.md` · `04-home-page-memo.md`. Fetch status per source is in the ledger at the end; `[snippet]` means the page was not fetched in full and the claim rests on search-result text. All web content was treated as data, never instructions.

## 0. Recommendation first

Three things from this scrape should change what Joe builds next, in this order: (1) a **time-anchored "on now / next up / tonight" slice above the listings**, because it is the single display concept that correlates with praise for the "what's on tonight" job across every category; (2) a **visible access state on every listing row and an "off your services" count on Today**, because "stop showing me games I can't watch" and "tell me which app it's on" are the two complaints that recur in every review pool touched; (3) **in-progress score/clock in the card's right column** using ESPN status fields the loader already fetches, because every score app leads with it and MySports is the only guide-shaped app that already has the data and does not show it. Everything else in the harvest is additive.

## 1. Positioning and jobs-to-be-done

**Product concept.** A personal, access-aware sports TV guide, calendar, and archive: it shows only what its owner can actually watch, across every sport its owner follows, treats the rendered day grid as the canonical picture of a day, and keeps every day forever. Market of one, Cleveland.

**Jobs-to-be-done (the yardstick for every comparable):**

1. What is on right now, and on what network or app?
2. What is on tonight (the prime window), and what is off my services and why?
3. What is the shape of the whole day (the grid picture)?
4. What is on this week — calendar week, and season week for CFB/NFL?
5. Can I watch this game under my subscriptions, and which local feed carries it in my market?
6. Take me to the stream in one tap when it is live.
7. What is the score / clock / who is pitching, without leaving the guide?
8. Show me the box score when it is final.
9. Let me look up any past day exactly as it was rendered.
10. Tell me when the picture changes (flex, postponement, carrier change, market map posted).
11. Put a game on my calendar / remind me before kickoff.
12. When the new program types land: show pregame bookends, wrestling, UFC, NASCAR on the same picture.

## 2. Comparables by category

### (a) Score and schedule apps

**ESPN app / espn.com "Where to Watch"** [fetched via press releases and App Store page; feature verified]. Free; ESPN Unlimited $29.99. Launched August 2024: a searchable, day-by-day list of every event with its network/service, one-click to ESPN streams for authenticated users, links to select partners (NESN, Monumental), powered by an ESPN Stats & Information event database, reachable from every screen of the app and at espn.com/wheretowatch, personalizable by favorite teams and leagues. Display: a time-ordered list per day, event title, network chip, "Watch" button when ESPN carries it. Data MySports lacks: nothing structural — but ESPN's database is the closest thing to a national "authority" for broadcast attribution and is a candidate cross-check source. Does poorly: does not know what *you* subscribe to (every game shows), and reviews complain of clutter, re-authentication, buffering, and "hard to find content that should be obvious like live broadcasts"; Week 0 2026 outage coverage was widespread.

**Apple Sports** [App Store page + Apple newsroom + support docs; snippets]. Free, iPhone. Favorites-first scoreboard; game card with play-by-play, lineups, betting odds where available; **Live Activities** on the Lock Screen and Dynamic Island, schedulable before a game starts; widgets (small ones now, including CarPlay); one tap into the Apple TV app to watch on connected services; F1 weather per Grand Prix. Display concept worth stealing: a game card that is *state-driven* — pre (lineups/odds), in (score, clock, last play), post (final) — with the same silhouette. Does poorly: no TV-guide day picture, no channel column, team-centric schedules absent per reviews.

**theScore / Yahoo Sports / CBS Sports / FOX Sports / Bleacher Report** [snippets only]. Scores-feed landing with favorites, news, and betting slots; FOX Sports' schedule pages list "(FOX, FOX One)" per game and were the source of the NFL Week 1 slate here. None lead with a where-to-watch answer; all monetize with ads and betting placements — the anti-pattern for a market-of-one guide.

**Sofascore / FotMob / FlashScore / LiveScore / OneFootball / 365Scores** [comparison articles + Sofascore TV schedule page; snippets]. Multi-sport live-score apps; Sofascore has a "TV schedule" page listing where to watch by sport. FlashScore is cited as fastest (0.7 s latency), FotMob cleanest. Concepts: attack-momentum/heatmap depth is irrelevant here; the **"My games" pin** and per-competition notification muting are relevant. Complaints that recur in the 1-star pools: score lags the TV by 30 s, alerts you can't fully mute, ads covering the live screen.

**League-native apps — NHL, NFL, MLB, NBA** [App Store pages; snippets]. NHL app 2025-26 added a **"How to Watch" module per game** ("where to stream, tune in or follow along") and opt-in Live Activities for any/all teams; MLB app's Gameday is the box-score destination MySports already links to; NFL app is an NFL+ funnel with blackout caveats. Concept: a per-game "how to watch" block with all outlets is the model for the detail panel's broadcast list — MySports already has it.

**Google sports cards** [not fetched]. Search-result knowledge cards show today's games with a network line; not evaluable beyond that.

### (b) TV and streaming guides

**On TV Tonight / "TV & Streaming Guide America"** [App Store page; snippet]. Free EPG apps since 2014: 24-hour grid across channels, users hide channels they don't get, **"On Now" highlights**, and a **"Tonight" button that jumps to prime time**. This is the closest ancestor of MySports' access filter (hide channels you don't have) applied to a general EPG.

**Live Sport TV Listing Guide (Gregor Jutrisa)** [App Store page; snippet]. Free, 4.4★/30. Refine by channel, sport, team, date, and **time of day (morning / afternoon / evening)**; "My Sports" and "My Channels" filters; **add a game to Calendar or set a notification**; home-screen widgets showing only My Sports / My Channels; 80+ countries. Small, one-developer, and structurally the nearest thing to MySports in the store.

**LiveSportsOnTV.com + app** [site + App Store; snippets]. Free. "Instantly see what's live and where to watch it"; favorites build a personal schedule; notifications before kickoff; "How to watch" guides per league; explicitly frames itself around "a working broadcast destination, not commentary." Display: date-tabbed list grouped by sport, each row time · matchup · channel logos. Does poorly: national-only, no market feeds, no access profile.

**Streamline — "The Sports Fan's TV Guide"** [App Store; snippet]. Free, iPhone. "What's on today, tonight, and upcoming," 200+ streaming platforms, watchlist, social "what others are watching." Its copy is the exact job statement; execution unverified.

**Sports Media Watch — "Sports on TV Today"** [site; snippet]. Daily text list by sport with a compact broadcast notation: `12:40 pm — Padres vs. Reds (MLBN Alt., MLB.TV, MLB Extra Innings | A Padres.TV | H Reds.TV)` — national outlets, then **A** away feed, **H** home feed. Also the weekly CFB/NFL schedule pages. This notation is the best compact expression of "national vs local feed" seen anywhere and maps directly onto `feed_side`.

**506sports** [homepage; snippet]. NFL coverage maps (Week 1 maps post Wednesday, September 9), blackout asterisks, MLBN-alt notes, and the **506 Archive of announcer listings** going back decades. Already a planned MySports source for `market_coverage_nfl`; the archive is a free crew source for national broadcasts.

**NCAA.com TV schedule** [fetched]. Plain weekly list with ranks, times, and networks, updated Tuesday; the CFB specimen slate for this study came from it.

**Fubo (FanView, MultiView)** [Fubo news pages, comparisons; snippets]. Sports-first vMVPD; grid guide, sports sections, MultiView up to four streams (Apple TV/Roku), FanView live stats and social feed overlaid on the broadcast. Concept: **multiview of what is on now** is the TV-side version of "on now"; MySports' equivalent is a deep link to each stream, not a player.

**YouTube TV (Key Plays, Multiview, Stats View, Fantasy View)** [comparisons; snippets]. **Key Plays** = a timeline of highlights inside a live broadcast to jump to; Multiview server-rendered; "Add to Library" records every game a followed team plays. Concept: "key plays" is a catch-up affordance MySports cannot build without video, but a **last-play / last-score line on the card** is its data shadow.

**DIRECTV Stream, Hulu + Live TV, Sling** [DIRECTV Insider; Consumer Reports; snippets]. Conventional EPGs. Consumer Reports' key line: the DirecTV guide lists only the games shown on its own service — precisely the blind spot MySports exists to remove.

**Apple TV app sports tab, Roku Sports zone, Fire TV sports row, Samsung TV Plus** [TechCrunch/Deadline/Tom's Guide; snippets]. Platform hubs that aggregate "live and upcoming" across apps with a "watch on" chooser (Apple TV, DIRECTV, FOX Sports, Fubo, Paramount+, Peacock, Prime Video, Sling, TNT…); Roku's poll: 61% of users asked for a centralized sports location; the recurring analysis: these hubs still can't see RSN rights. Concept: the **per-game "watch on" chooser** listing every service that carries it — MySports' detail panel already does this with the access verdict.

**JustWatch / Reelgood** [reviews; snippets]. Where-to-watch for film/TV with "my services" filters, watchlists, price comparison; Reelgood has stopped TV-app development. Sports coverage is thin; the **"my services" filter as a first-run setup** is the transferable idea.

**whereisthegame.com, anyandallsports.com, sportsgamestoday.com** [snippets]. SEO-driven "what sports are on tonight" pages: sport-grouped daily lists with channel and streaming columns and week-by-week CFB calendars (whereisthegame lists all 931 CFB games). Useful as cross-checks; no access model.

**TVGuide.com app** [snippet]. Watchlist + "New Tonight"; sports listings generic.

### (c) Niche and community tools

**Home Assistant TeamTracker + TeamTracker Card** [GitHub READMEs; snippets]. A sensor per team whose state is **PRE / IN / POST / BYE / NOT_FOUND**, with attributes for score, clock, period, possession, **last play**, TV network, odds, venue, records, and logos, refreshed every 10 minutes and every 5 seconds in-game; the card has distinct **pre / in / post layouts** of the same silhouette. Uses the ESPN scoreboard API MySports already calls. This is the cleanest statement of the state model MySports' card should adopt.

**Team ICS calendars (Stanza / sync2cal, ECAL, team sites, Google "interesting calendars," SchedJoules)** [Celtics download page, guides; snippets]. Every league's teams publish webcal feeds that update roughly daily with time changes and results; Google Calendar bundles per-team calendars. Concept: MySports can **emit** an ICS of "my watchable games" — cheap, and the only way to get the app onto a phone calendar without an app.

**Discord/Telegram schedule bots (ProTVGuide, SportsListingsBot)** [snippets]. Post daily schedules with where-to-watch into channels. Concept: a daily push of tonight's slate; for market-of-one this is a notification, not a bot.

**GitHub: `espn_scraper`, `iptv-sports-epg` (XMLTV for event-per-day sports channels), ESPN hidden-API gists, sportsdataverse, MLB-StatsAPI** [READMEs; snippets]. Confirm the ESPN scoreboard endpoints, document `summary?event=` for box scores and injuries, and show XMLTV as a possible export format. `iptv-sports-epg` is a reminder that ESPN+ event names carry only a start time and an *estimated* duration — the same open-ended-block problem the register raised for UFC and races.

**Alexa / Google Assistant sports skills** [not fetched]. Not evaluable; noted as out of scope for a display study.

**Reddit game threads / r/cordcutters wikis** [not fetched; two-strikes on search-snippet-only sources]. The complaint themes appear identically in Consumer Reports and the Substack comments cited below.

## 3. Review and complaint mining

Attributed paraphrases; no quote exceeds a phrase.

- **"Where is that game again?"** — Consumer Reports (April 2026): following one MLB team now takes ten networks and at least four paid subscriptions; the DirecTV guide only lists games on its own service; announcers and on-screen stat layouts differ by network and fans miss the familiar ones; year-to-year changes (Amazon moving from Fridays to Wednesdays) break habits. [fetched]
- **"The game I want is on an app I don't have"** — commenter on a Substack piece about finding live sports; the same thread praises anyone who tries to fix the fragmentation. [snippet]
- **Roku's own poll:** 61% wanted a centralized sports location; Tom's Guide's analysis: hubs can't fix RSN blind spots. [snippet]
- **ESPN app (App Store, Google Play, Trustpilot):** re-authentication every time, 5–45 s to start playback, ads on every highlight, "hard to find live broadcasts," portrait mode hides the box score of the game you're watching, Week 0 crash. [snippets]
- **Apple Sports (App Store):** can't choose which game is the priority Live Activity; wants team-centric schedules; wants a 30-minute-before notification. [snippet]
- **Score apps generally (Unstar, footyapps):** score lags the TV so goal alerts arrive after the roar; notifications can't be muted per competition; ads at the worst moment. [snippets]
- **Senate Commerce staff memo (streaming):** "no one place to look to figure out where to watch"; RSN carriage still varies even with three subscriptions. [snippet]

The recurring unmet needs, in frequency order: (1) one place that knows *my* services; (2) tell me which app/channel and take me there; (3) don't show me what I can't watch, but tell me it exists; (4) don't make me hunt for what is live right now; (5) keep the familiar presentation (announcers, stat layout); (6) remind me before kickoff.

## 4. Feature matrix

Legend: ● has it · ◐ partial · — no. MySports column: **B** built, **S** specced, **N** not built.

| Capability | ESPN WtW | Apple Sports | LiveSportsOnTV | Live Sport TV Guide | On TV Tonight | YouTube TV | Fubo | Roku hub | TeamTracker | Team ICS | SMW daily | **MySports** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Day list, all sports, with network | ● | ◐ | ● | ● | ● | ● | ● | ● | — | — | ● | **B** |
| Filters to *my* services | — | ◐ (Apple TV connected apps) | — | ● (My Channels) | ● (hide channels) | n/a | n/a | ◐ | — | — | — | **B** |
| Off-service games counted, not hidden | — | — | — | — | — | — | — | — | — | — | — | **B** (grid only) |
| Market/local feed shown (A/H feed) | ◐ | — | — | — | ◐ | ● (your ZIP) | ● | — | — | — | ● | **B** |
| "On now" slice | ◐ | ● | ● | ◐ | ● | ● | ● | ● | ● (IN) | — | — | **N** |
| "Tonight"/prime jump | — | — | — | ● (time of day) | ● (Tonight btn) | — | — | — | — | — | — | **N** |
| Day grid picture | — | — | — | — | ● (EPG) | ● | ● | — | — | — | — | **B** |
| Week views (calendar + season) | — | ◐ | ◐ | ◐ | — | — | — | — | — | ● | ◐ | **B** |
| Deep link to stream | ● (ESPN + partners) | ● (Apple TV app) | ◐ | — | ◐ | ● | ● | ● | — | — | — | **B** |
| In-progress score + clock | ● | ● | — | — | — | ● | ● | ◐ | ● | — | — | **N** |
| Last play / key plays | ◐ | ● | — | — | — | ● | ◐ | — | ● | — | — | **N** |
| Pre/in/post state model | ◐ | ● | — | — | — | — | — | — | ● | — | — | **N** |
| Odds | ● | ● | — | — | — | — | ◐ | — | ● | — | — | **B** |
| Probables / lineups | ● | ● | — | — | — | — | — | — | ◐ | — | — | **B** (probables) |
| Box score link when final | ● | ● | — | — | — | — | — | — | — | ◐ | — | **B** |
| Archive of past days | — | — | — | — | — | — | — | — | — | — | — | **B** (unique) |
| Add to calendar / reminder | — | ● (Live Activity) | ● | ● | — | ● (DVR) | ● | — | — | ● | — | **N** |
| Push before kickoff / change alerts | ● | ● | ● | ● | — | ● | ● | — | ● (HA) | — | — | **N** |
| Announcer crew | — | — | — | — | — | — | — | — | — | — | ◐ | **N** |
| Multiview | — | — | — | — | — | ● | ● | — | — | — | — | out of scope |
| Non-game programs (studio, wrestling, UFC, racing) | ● | ● | ● | ● | ● | ● | ● | ● | ◐ | — | ● | **S** (v0.5) |
| "Data as of" timestamp | — | ● (live) | — | — | — | — | — | — | ● | — | — | **B** (grid), **N** (listings) |

## 5. Harvest list (candidates for Phase 3)

Each with its source comparable(s). Consolidation, scoring, and specs are in `03-enhancement-specs.md`.

| # | Candidate | From |
|---|---|---|
| H1 | "On now" slice at the top of Today: live games with score, clock/period, network mark, deep link; then "next up" | Apple Sports, On TV Tonight, LiveSportsOnTV, Roku hub, TeamTracker IN state |
| H2 | "Tonight" snapshot: prime-window games, access-aware, with an off-services count and reasons | On TV Tonight "Tonight" button, Live Sport TV Guide time-of-day filter, SMW daily |
| H3 | Pre / in / post card state model — same silhouette, different right column | TeamTracker card, Apple Sports game card |
| H4 | In-progress score and clock in the card's right column | every score app; ESPN scoreboard `status` |
| H5 | Last play / last scoring play line (data shadow of Key Plays) | YouTube TV Key Plays, TeamTracker `last_play` |
| H6 | Visible access state on every listing row + "N off your services" count on Today | On TV Tonight hide-channels, Consumer Reports complaint, JustWatch "my services" |
| H7 | A/H feed notation for locals (`national | A away-feed | H home-feed`) | Sports Media Watch |
| H8 | Market-pending state for NFL regional windows until 506 maps land | 506sports, FOX Sports "six regional games" |
| H9 | "Data as of" line on listings + refresh countdown inside windows | TeamTracker `last_update`, PC grid |
| H10 | Local-teams pin (Browns/Guardians/Cavs/CBJ/Buckeyes first) | Apple Sports favorites, LiveSportsOnTV favorites |
| H11 | ICS feed of watchable games (subscribe from phone calendar) | Stanza/ECAL, Google interesting calendars, Live Sport TV Guide add-to-calendar |
| H12 | Kickoff reminders / change alerts (flex, postponement, carrier change) | Apple Sports Live Activities, LiveSportsOnTV notifications, ProTVGuide |
| H13 | Announcer crew line in detail panel (and tray, later) | 506 Archive, Consumer Reports "familiar announcers" |
| H14 | "Watch on" chooser listing every carrying service with access verdict, ordered by Joe's preference | Roku/Apple TV hubs, NHL app How to Watch |
| H15 | Injury / lineup status in the detail panel | Apple Sports lineups, ESPN summary endpoint |
| H16 | Empty-state copy: "nothing on your services tonight; next watchable game is …" | LiveSportsOnTV, Streamline |
| H17 | Week view: Cleveland-teams row pinned above the columns | LiveSportsOnTV favorites |
| H18 | History grouped by day with the day's grid thumbnail | (unique to MySports; no comparable groups by archived render) |
| H19 | XMLTV export of the day for a TV-side EPG | iptv-sports-epg |
| H20 | Home-screen widget / Lock Screen live activity | Apple Sports, Live Sport TV Guide widgets |
| H21 | Multiview launcher (open two streams) | Fubo, YouTube TV — out of scope, noted |
| H22 | Notification muting per sport | FotMob/Sofascore complaints |
| H23 | Weather chip on outdoor games | ESPN, Apple Sports F1 — decided against in contract §3; challenge only |

## 6. Data-source discoveries (judged from the Actions runner, not this sandbox)

| Source | What it adds | Runner feasibility | Egress / cost |
|---|---|---|---|
| ESPN scoreboard `status.type.state` (pre/in/post), `displayClock`, `period`, `situation.lastPlay` | H1, H3, H4, H5 | Already fetched by the NFL/NBA/CFB adapters; add columns, no new call | none; 15-min in-window polling = ~2–4 min of Actions per poll-hour |
| ESPN `summary?event={id}` | injuries, leaders, win probability | one call per game of interest; unverified from runner | site.api.espn.com already allowed |
| MLB statsapi `linescore`, `probablePitcher(note)`, `decisions` | in-game inning/outs, starters, W/L pitchers | already used | none |
| NHL api-web `score/now`, `gamecenter` | clock, period | already used | none |
| 506sports weekly maps + 506 Archive | NFL market coverage; announcer crews for national broadcasts | HTML fetch, weekly | 506sports.com egress add |
| Team ICS feeds (team sites, Stanza) | cross-check of time changes | daily | per-team hosts; low value given adapters |
| ESPN Where to Watch (espn.com/wheretowatch) | national broadcast attribution cross-check | JS-heavy page; unverified | espn.com; low priority |
| Network press rooms (espnpressroom, foxsports presspass, nbcsports pressbox) | crews, GameDay/Big Noon sites | weekly watch task (already planned for v0.5) | already in research watch |
| XMLTV / ICS **outputs** | H11, H19 | trivial to emit from the renderer's data | R2 public bucket |

## 7. Fetch-status ledger

Fetched in full: ncaa.com CFB TV schedule; foxsports.com NFL Week 1 schedule; consumerreports.org "Why It's So Hard to Find Sports on TV" (April 8, 2026); site.api.espn.com CFB scoreboard (via WebFetch only; 403 from bash). Snippet-only `[NOT FETCHED — from search snippets]`: espnpressroom.com and Hollywood Reporter (Where to Watch launch); apple.com newsroom, support.apple.com, MacRumors (Apple Sports); apps.apple.com pages for Apple Sports, ESPN, NHL, NFL, Streamline, Live Sport TV Listing Guide, LiveSportsOnTV, TV & Streaming Guide America, Victory+; play.google.com ESPN; trustpilot/pissedconsumer ESPN; footyapps, tikitaka, unstar (score-app comparisons); fubo.tv news, reviews.org, tommyguide, evoca (YouTube TV vs Fubo); techcrunch/deadline/tomsguide (Roku, Apple TV, Fire TV); tidbits/techhive (JustWatch, Reelgood); github.com READMEs (ha-teamtracker, ha-teamtracker-card, espn_scraper, iptv-sports-epg, nntrn gist); nba.com Celtics calendar page, dan.valeena.dev sports calendar guide, phonearena, techcrunch (Google calendars); protvguide.com, telegramic.org; sportsmediawatch.com (Sports on TV Today, CFB schedule); 506sports.com; whereisthegame.com, anyandallsports.com, sportsgamestoday.com; directv.com insider; hubintel.substack.com comments; commerce.senate.gov memo; sportsvideo.org, nexstar.tv (CW schedule). Not attempted: Reddit threads (search returned none directly), Alexa/Google skills, Gracenote/Zap2it, Awful Announcing schedule page (search surfaced only the Wikipedia entry), Prime Video sports hub, Samsung TV Plus.
