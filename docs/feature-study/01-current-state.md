# 01 — Current State: MySports TV as it stands on September 2, 2026

**Study set:** `00-README.md` (index, run log, assumptions) · **this doc** · `02-comparables.md` · `03-enhancement-specs.md` · `04-home-page-memo.md`. Written unattended for Joe; evaluated from the project docs plus reconstructed prototypes rendered in this sandbox (see §7 for what that means).

## 0. The one-paragraph verdict

The data spine and the archival grid are ahead of the product. What Joe has is a correct, market-of-one answer to "which games exist today, on which network, with which access state" and a locked, distinctive design language to draw it in. What Joe does not yet have is a *front door that answers the couch question in one glance*: the Today page opens on a full-day listing sorted by kickoff, so at 7:40 PM on a Saturday the first screen is noon games that ended three hours ago, no game is marked "on now," the off-profile games are simply absent rather than counted, and nothing tells Joe that the 7:30 games are one scroll away. The comparables in `02-comparables.md` show that the apps people praise for "what's on tonight" all lead with a time-anchored, access-aware slice, and that is the gap this study is about.

## 1. Purpose statement and objectives hierarchy

MySports TV is a personal ("market-of-one," Cleveland) master sports calendar, television grid, and archive. Its promise in Joe's words: *every game, every channel, one place*. Its distinctive move, which no comparable makes, is that it renders only what its owner can actually watch under a declared access profile (DIRECTV CHOICE + ESPN Unlimited, Peacock Premium, Prime Video, Netflix, Paramount+), and it treats the rendered day grid as the canonical, immutable picture of a day.

The objectives, in the order the docs rank them:

1. **Today, all sports** — what is on this viewing day (3:00 AM ET cutover), across CFB, NFL, NHL, NBA, MLB.
2. **Today, one sport** — the same day filtered by sport chip.
3. **A week** — two-week model: calendar week (ISO Monday–Sunday over viewing day, all sports) and season week (provider week label for CFB/NFL, date span derived from the games). Week views are listings, never grids.
4. **Channel and access** — which network or stream carries each game and whether Joe can watch it: `included` / `unavailable`, with the omitted-games pill as the only place an off-service game is acknowledged.
5. **Live → stream** — a curated WATCH map to the carrying service's live page, with the DIRECTV Stream guide as fallback.
6. **Final → box score** — History lists finals newest first; card links to `boxscore_url` in a new tab.
7. **Archive** — `generated_grids` registry; every day's SVG kept in R2 and viewable from History and from Today when one exists.

Approved but not built: a `programs` supertype (spec v0.5) carrying NASCAR, UFC, IndyCar, WWE, AEW, and network pregame/postgame bookend shows (enhancement-register §7–§9).

## 2. User journeys, written concretely

**Thursday 7:40 PM, couch.** Joe opens the app on his phone. It is September 3: Guardians finished at 1:10 PM (Guardians TV), Red Sox–Orioles and Brewers–Cubs are on FOX at 7:15, Colorado–Georgia Tech is on ESPN at 8:00, Arkansas-Pine Bluff–Missouri on SEC Network at 8:00. What he wants: the four things airing or about to air, each with its network mark, and one tap to the stream. What he gets today: the full day listing from 1:10 PM, sorted by time, no "on now" marker, no score on the Guardians final unless he scrolls into History. Grade: the information is present; the answer is not.

**Saturday 9:30 AM, planning a CFB day.** Joe wants the day's shape: the noon slate, the 3:30 window, the prime-time games, and which ones are on ABC/CBS/FOX/NBC versus the ESPN family. The archival grid is exactly this picture, and on desktop it renders above the listings once it exists. On mobile the grid is a "Grid ↓" jump chip below the listings (Joe's ruling, prompt 15). Grade: good on desktop when the grid has rendered; on mobile the listings-first rule means the planning picture is a jump away, which is correct for the evening case and slightly wrong for the morning case. This is the tension the home-page memo resolves with a time-adaptive default.

**NFL Sunday.** The market filter decides the 1:00 and 4:25 windows (WOIO 19 / CBS, WJW 8 / FOX), SNF on WKYC 3 / NBC. Until 506sports posts the Week 1 maps on September 9, the regional FOX/CBS games are `market-pending`. The app currently has no visual state for "market-pending" — a game is either on a row or omitted. Grade: a real gap for the two days a week that matter most in the fall.

**Checking a score mid-game.** Scores are loader-written provider facts and refresh every 15 minutes inside game windows. The listings card shows `SCHED` / `FINAL` in the right column and odds when a line exists; an in-progress score has no slot in the locked card. Grade: the 15-minute refresh is adequate for the couch, but the card cannot show the score it has.

**Looking up last week's game.** History → search "Guardians" → card → box score. Grade: works; the raw URL is never shown, which is right.

**A night with nothing in the profile.** Say a Wednesday in early October with only an Apple TV Friday-style exclusive or an out-of-market RSN game. Today shows an empty band; the omitted pill on the grid (when a grid exists) says "N NOT ON YOUR SERVICES · outlets." Grade: honest but cold; the comparables handle this with "next up" and "on your services tomorrow."

## 3. Feature inventory

| Feature | Status | Where it lives | Source doc |
|---|---|---|---|
| Today listing (date strip + sport chips + rows) | built, web v0.2 | `/` | prompt 12 §5, prompt 13/14 |
| Archived grid above/below listings when one exists | built | `/` (desktop above; mobile "Grid ↓" chip) | prompt 15 stage 3 |
| Listings-first on mobile, every view | built (fix round) | `/`, `/weeks`, `/history` | prompt 15 stage 3, handoff |
| Locked listings card (hug @, tier shrink, right-column odds/SCHED/FINAL, 2/3-height normalized network marks) | built | listings everywhere | session snapshot, handoff |
| Mobile grid M1–M13 (80% scale, per-day compression, hard-cut gaps, 69pt pinned rail, gold hour axis, pinch-zoom) | built | grid section on mobile | mobile-grid-addendum |
| Weeks: calendar mode | built | `/weeks` | prompt 12 |
| Weeks: season mode (CFB/NFL week label, derived span) | built | `/weeks` | prompt 12 |
| History with search and box-score link | built | `/history` | prompt 12 |
| Detail panel (broadcast list with access, odds, records, venue, deep link, box score) | built | detail panel | prompt 13/14, M11 |
| Odds under `show_odds` toggle (moneyline + O/U, favored logo) | built | card right column, detail | register §7 Q9 |
| Ranks / records / rivalry columns loader-written; marquee gold plate | built (prompt 15 stage 4) | grid, cards | handoff |
| MLB probables with season stats | built | card line 3, detail | snapshot |
| Standings / records for 4 leagues | built | card line 2 | handoff |
| Curated WATCH map + DIRECTV Stream fallback | built | detail panel | mobile demo `WATCH` |
| Scheduled refresh on GitHub Actions, daily; 15-min in-window polling | daily proven; in-window planned | pipeline | handoff, deployment contract |
| Archival SVG renderer v1.6.x, registry, R2 | built | renderer | handoff |
| Multi-sport day layout (§11.9 Option 4 two-band) | specced, decision pending views v2 from Sept 5 renders | renderer | multisport-layout-options |
| `programs` supertype, migration 0009 | approved, not built | DB, spec v0.5 | register §7–§10 |
| Program card silhouette | decided (prototype-first), not designed | prototype artifact | register §9 Q8 |
| Studio/pregame bookends, WWE/AEW, UFC, NASCAR, IndyCar | approved, not built, in that order | programs | research-summary-2 |
| Vercel deploy | not done; blocks phone-in-hand use | web | handoff next steps |
| Banner (PC + mobile), icon re-set, new sport marks | queued design session | header | handoff |
| In-progress score / clock on card | not built, no slot | card | this study |
| "On now" / "next up" states | not built | — | this study |
| Market-pending state for regional NFL windows | not built | — | this study |
| Purchasable content (AEW PPV) | decided not built | — | register §7 Q3 |
| NXT, halftime and daily talk shows | decided not built | — | register §7 Q4, Q7 |
| Practice/qualifying sessions (motorsport) | decided not built | — | register §7 Q2 |
| Accounts, favorites, notifications | out of v1 scope (market-of-one) | — | deployment contract D4 |

## 4. Data inventory

*The table below is confirmed from docs. The read-only DB check that could not run in the study's venue (see `00-README.md` A-02) **has now run**, from the laptop on 2026-09-02; its results are the sub-table beneath, and they supersede the docs wherever the two disagree.*

| Per-game fact | Known? | Provider / cadence |
|---|---|---|
| Schedule (start, venue, week, `startTimeTBD`) | yes | CFBD (CFB), ESPN scoreboard (NFL/NBA/CFB), NHL api-web, MLB statsapi; daily on Actions, laptop for ad hoc |
| Broadcasts, market, access state (`viewer_game_eligibility`) | yes | adapters + reconciliation; `authority_rules`; local carriers hand-verified (never sourced in-app) |
| Scores, result_status, box score URL | yes | loader-written provider facts; 15-min in-window (planned economics) |
| Standings, records | yes | standings job; NBA = conference rank |
| Ranks (AP / CFP), rivalry tier | yes (CFB); pro ranks null by design | weekly Tuesday enrichment |
| MLB probables + season stats | yes | statsapi |
| Odds (spread, ML, O/U, favorite) | yes | ESPN scoreboard `odds` (DraftKings), under `show_odds` |
| Team colors, logos, `_dark` variants | yes | R2 `logos/`, marks manifest |
| In-progress clock, period, last play | **no** | ESPN `status.displayClock/period` is in the same scoreboard call already fetched |
| Broadcast crew / announcers | **no** | none; 506sports archive and network press rooms exist |
| Injuries, lineups | **no** | ESPN summary endpoints exist (unverified for the runner) |
| Weather | fetched by ESPN, deliberately not shown | contract §3 |
| Market coverage maps (NFL) | planned | 506sports, ~Sept 8–9 weekly |
| Program data (shows, sessions, cards) | none yet | v0.5 |

### Verified 2026-09-02 (read-only)

Five SELECT-only queries run from the laptop against `SUPABASE_DB_URL` via psycopg, in a
`read_only=True` transaction (server-side `transaction_read_only = on`), rolled back at the end.
No DDL, no writes, nothing under migration 0009.

**(a) Schema `mysports` — 29 base tables, 6,936 rows.** The 22 non-empty tables are below. The seven empty
ones are `assets`, `broadcast_crews`, `carriage_status`, `market_coverage`, `rankings`,
`whip_around_broadcasts` and `whip_around_games` — each corresponds to a feature the study lists as
not-yet-built or not-yet-in-season; this check counted them but did not investigate why.

| Table | Rows | | Table | Rows |
|---|---:|---|---|---:|
| `teams` | 808 | | `game_broadcasts` | 442 |
| `source_observations` | 844 | | `games` | 375 |
| `canonical_decisions` | 2,726 | | `viewer_game_eligibility` | 375 |
| `source_snapshots` | 238 | | `canonical_change_history` | 305 |
| `venues` | 198 | | `team_records` | 154 |
| `viewer_services` | 88 | | `networks_services` | 87 |
| `conferences` | 83 | | `game_odds` | 74 |
| `refresh_runs` | 55 | | `rivalries` | 48 |
| `generated_grids` | 15 | | `sources` | 10 |
| `render_policies` | 5 | | `team_territories` | 4 |
| `markets` | 1 | | `viewer_profiles` | 1 |

**(b) `viewing_day` 2026-09-05 — 83 games, two sports.** Every game has at least one broadcast row and
exactly one `viewer_game_eligibility` row; there are no gaps to explain.

| Sport | Games | With broadcast | Broadcast rows | Eligible | Not eligible | No eligibility row |
|---|---:|---:|---:|---:|---:|---:|
| cfb | 68 | 68 | 73 | 62 | 6 | 0 |
| mlb | 15 | 15 | 28 | 1 | 14 | 0 |

Broadcast rows by access state — the MLB column is the out-of-market story the study describes, in numbers:

| Sport | `access_status` | Rows |
|---|---|---:|
| cfb | `available` | 66 |
| cfb | `unavailable` | 7 |
| mlb | `out_of_market` | 25 |
| mlb | `unverified` | 2 |
| mlb | `available` | 1 |

**(c) `team_records` — 154 rows, 124 distinct teams, 2 seasons.** Newest `as_of` = **2026-09-02** (today).
The table has **no `updated_at` column**; per 0003 its freshness column is `as_of` (a date), so that is what
was read. By source: `espn.standings` 62, `nhl.standings` 32, `espn.scoreboard` 30, `mlb-statsapi` 30.

**(d) MLB probables, `viewing_day` 2026-09-05 — 15 games.** Home-side probable on 7, away-side probable on 7,
**both sides on only 3**. So the pitching matchup line 0008 was added for can be drawn in full on 3 of 15 cards
for that Saturday; a one-sided fallback is a real design case, not a hypothetical.

**(e) `generated_grids` — 15 rows, newest `generated_at` 2026-09-02 20:05:50 UTC.** Twelve distinct
(sport, day) pairs spanning 2026-08-29 to 2026-10-28:

| Sport | Day | Rows | Newest `generated_at` (UTC) | On grid / TBD / omitted |
|---|---|---:|---|---|
| nba | 2026-10-28 | 3 | 2026-09-02 03:49:25 | 3 / 0 / 9 |
| cfb | 2026-10-24 | 1 | 2026-09-02 00:37:42 | — |
| cfb | 2026-10-01 | 1 | 2026-09-02 00:37:42 | — |
| nhl | 2026-10-01 | 1 | 2026-09-02 00:37:42 | — |
| mlb | 2026-09-18 | 1 | 2026-09-02 00:37:42 | — |
| cfb | 2026-09-13 | 1 | 2026-09-02 00:37:42 | — |
| nfl | 2026-09-13 | 1 | 2026-09-02 00:37:42 | — |
| cfb | 2026-09-06 | 1 | 2026-09-02 00:37:42 | — |
| cfb | 2026-09-05 | 1 | 2026-09-02 00:37:42 | — |
| mlb | 2026-09-04 | 2 | 2026-09-02 01:05:24 | 3 / 0 / 13 |
| mlb | 2026-09-02 | 1 | 2026-09-02 20:05:50 | 2 / 0 / 13 |
| cfb | 2026-08-29 | 1 | 2026-09-02 00:37:42 | — |

The dashed rows are grids registered before `games_on_grid`/`games_tbd`/`games_omitted` were being written,
so the null is a history artifact rather than a missing render.

**Freshness gotchas that shape every candidate:** RSN attribution has a weeks-level staleness horizon (Cavaliers, Blue Jackets carriers unannounced); ESPN's API is Akamai-blocked from cloud workspaces but fine from the Actions runner; wrestling and GameDay/Big Noon sites move weekly.

## 5. Design language summary (the locks, in one place)

- **Icon:** v5 lock (text re-set in app fonts queued, deliberately reopened).
- **Banner:** parked; separate session. Header for this study's mockups = wordmark + "Every Game. Every Channel. One Place."
- **Palette:** page `#1B1B1B` radial → `#0E0E0E`; panel `#31363D` → `#1E2126`; ink `#F2F2F0`; dim `#9AA0A8`; gold `#F0C850`. Type: Barlow Condensed 700 for titles/team names, Inter for everything else.
- **Logo contexts (M12):** RAW inside cap endcaps and light tint plates; derive + lightness-floor chain on charcoal (cards, odds slot). Network marks: locked per-network recipe table + frozen ink-area normalization factors (clamp 0.62–1.15) in card contexts; `derive_dark_mark` in the rail; ABC raw.
- **Listings card anatomy (the one card):** time column (gold, "ET" small) · two-column duel under-teams (line 1 logo + name with tier shrink 15 → 12.5 → 11 px before ellipsis; line 2 record + standing; line 3 MLB probable "F. Lastname (W-L, ERA)") · "@" hugs the gap · grey network text under the matchup · network mark at 2/3 height centered on line 2 for access-profile networks · right column = favored logo + moneyline over O/U, else `SCHED` / `FINAL` · team-color seam along the bottom.
- **Mobile grid M1–M13:** 80% scale; per-day, per-sport max compression; ≥60-minute gaps hard-cut with a dashed seam; 69pt pinned rail; hour-only gold uppercase axis labels (Style B); pinch-zoom; TBD cards at ~57%; streaming lanes uncapped with a jump-to-network row; header/legend/footer stack; empty rows omitted; tap → detail panel; everything else identical to the PC contract.
- **PC/archival grid:** contract v1.4–v1.6.4 as extracted in `cfb-grid-design-extract.md` (3.2 px/min, 150 rail, 74+28+8 row, bands, caps, record run, pills tray with drop priority, ALT tag, marquee gold plate, omitted pill mandatory).
- **Display-name rule:** ESPN `shortDisplayName` accepted as-is; Red Sox / White Sox / Blue Jays fixes applied.
- **Row identity:** CFB rows are network names; NFL/NBA rows are call-sign rows (`WOIO 19 / CBS`); §11.9 D2 pending.
- **Decided against:** weather on cards; sunburst/halo; smaller card revival on PC; hand-maintained merged rail orders; purchasable content; NXT; daily talk shows.

## 6. Remaining build, in the decided order, and open decisions

Order: phone-in-hand QA → **Vercel deploy** (project, publishable env vars, deployment protection) and refresh economics → prompt 16 (v0.5 `programs` + migration 0009) → program-card silhouette in the prototype → studio bookends (CFB now, NFL Sept 13) → WWE/AEW → UFC → NASCAR (playoffs through Nov 8) → IndyCar (2027).

Open decisions carried from the docs: §11.9 D1–D4 (layout family, row identity, cross-sport collision, height ceiling) pending views v2 from the Sept 5 renders; logo full vs 2/3 height (2/3 shipped as the working lock); individual vs grouped chips for racing/wrestling; SNME classification; CBJ carrier watch (~Sept 15); egress add for `cf.nascar.com`.

## 7. Honest weaknesses, with screenshot evidence

Screenshots are in `artifacts/qa/feature-study/`. They come from the project's own templates (`app_template.html`, `mobile_demo.html`) reassembled in this sandbox with real September 3/5/13 data, because the published artifacts and R2 were not reachable here. Reconstruction artifacts — missing league icons in the chips, missing header TV art, no network marks, no archived SVG, 24-hour times in the demo — are **not** findings and are called out where they appear.

1. **The first screen fails the 7:40 PM couch test.** `01_desktop_today_all_sep5.png` and `07_mobile_main_today.png`: the page opens on 60 games ("45 games · listing") beginning with the noon slate. There is no "on now," no "next up," no time anchor. On mobile the 7:30 games are roughly six screens down. This is the study's central finding and the subject of `04-home-page-memo.md`.
2. **Access state is invisible on the listing row.** Every row shows a network name and a `SCHEDULED` pill; nothing distinguishes a game Joe can watch from one that was filtered out, and the off-profile games are silently absent on Today (the omitted-games pill exists only on the grid). A first-time user would assume the list is complete. `08_mobile_demo_cards.png` shows the same on the locked card: an out-of-market MLB game on NBCS BA sits in "Tonight" with `SCHED` and no access cue.
3. **Finals and live scores have no home on Today.** The card's right column is odds / `SCHED` / `FINAL`; the Guardians' 1:10 PM final on September 3 shows no score until History. In-progress games cannot show a score or clock at all.
4. **Sport chips are the only navigation, and they are icons without labels** (the reconstruction shows broken icons; in the real artifact they are league logos). Five icon chips plus ALL is fine for Joe, hostile for anyone else — logged for the multi-user appendix, not as a v1 fix.
5. **Weeks is a dense seven-column wall on desktop and a long single column on mobile** (`04_desktop_weeks_calendar.png`, `05_desktop_weeks_season.png`): chips carry abbreviation, time, network, and score, with no access cue and no "this week's Cleveland games first" anchor. It does its job; it does not invite planning.
6. **History is a flat newest-first list** (`06_desktop_history.png`): search works, but there is no grouping by day or sport, and finals from the same day interleave across sports.
7. **Market-pending has no state.** NFL Sunday regional windows before the 506 maps land are either shown as if certain or omitted. `03b_desktop_today_sep13_nfl.png` shows the reconstruction rendering all 13 games with a network but no certainty cue.
8. **The detail sheet is the app's best surface and the least discoverable** (`09_mobile_demo_detail_sheet.png`): probables, odds, "How to watch" with AVAILABLE/CHECK ACCESS, and the deep link are all there, one tap deep, with no affordance on the card that a tap does anything.
9. **The grid overlay on mobile is a modal with Fit/2×/3.5× buttons** (`10_mobile_demo_grid_overlay.png`), which predates the M6 pinch-zoom ruling; the production grid should not have zoom buttons at all.
10. **Nothing tells Joe when the data was last refreshed** on the listings surfaces (the PC grid has a "data as of" line). For a 15-minute in-window cadence that timestamp is the difference between trust and doubt.
