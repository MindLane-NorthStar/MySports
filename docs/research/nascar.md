# Research — NASCAR (Brief 2, item 5)

**Date:** 2026-09-02. **Scope (Joe 09-02):** one `nascar` sport with `series` ∈ {cup, oreilly, truck}; race only (no practice/qualifying); pre/post-race bookends; odds under `show_odds`; own chip with series sub-filter.

## 1. Schedule data source

- **Candidate backbone: NASCAR's own JSON feeds** at `cf.nascar.com/cacher/{year}/{series_id}/schedule-feed.json` (series_id 1 = Cup, 2 = O'Reilly, 3 = Truck) — no auth, includes race name, track, date/time, TV network, and a stable `race_id`; the same host serves live `race_list_basic.json` and results **[UNVERIFIED this session — host not allowlisted in the cloud workspace; well known in the NASCAR data community; probe from Joe's machine and add `cf.nascar.com` to the egress allowlist]**.
- **nascar.com schedule pages** are JS-rendered ("Loading race information…") — **not fetchable**. **nascar.com/tv-schedule** (weekly listings incl. pre/post-race shows, re-airs) fetch status **[UNVERIFIED]**.
- **ESPN undocumented:** `site.api.espn.com/apis/site/v2/sports/racing/{nascar-premier|nascar-secondary|nascar-truck}/scoreboard` — expected to carry race, venue, broadcaster, status **[UNVERIFIED — Akamai 403 from cloud]**.
- **Secondary:** Jayski (NASCAR-owned; per-series schedule pages with times/TV; fetchable HTML, updated in season), Sports Media Watch NASCAR TV schedule, Yahoo/Sporting News season pages.
- Season-level authority: NASCAR press release "start times and networks for 2026 national series races" (nascar.com/news-media, 2025-11-12) — fetchable article.

## 2. Broadcast data (2026, verified)

- **Cup (38 pts races + Clash):** FOX Sports (Feb–May, FOX/FS1) → **Prime Video** (5 races from Coca-Cola 600 May 24) → **TNT Sports** (5 races from Sonoma June 28; HBO Max simulcast **[UNVERIFIED]**) → **USA Sports** (14 races Aug 9 Iowa → Nov 8 Homestead; four on **NBC + Peacock**: Daytona Aug 29, Talladega Oct 25, Martinsville Nov 1, Homestead Nov 8; ten on USA Network) [nascar.com 2025-11-12; NBC/Yahoo Aug 2026].
- **O'Reilly Auto Parts Series:** all races on **The CW** [nascar.com 2025-11-12].
- **Truck Series:** all but two on **FS1**, two on FOX; season Feb 13 – Nov 6 [Yahoo/Sporting News; Wikipedia 2026 season]. The two FOX races **[UNVERIFIED which]**.
- **Bookends:** USA Sports Pre-Race (30 min) and Post-Race (30 min, open-ended) on USA around each Cup race [nascar.com tv-schedule]; FOX "NASCAR RaceDay" (Feb–May); Prime/TNT pre/post shows **[UNVERIFIED]**; Truck/O'Reilly pre-race **[UNVERIFIED]**.
- Practice/qualifying (out of scope): truTV/HBO Max in the USA window, FS1/FS2 in the FOX window, Prime/TNT in theirs.

## 3. Rights map → Joe

| Outlet | Series | Joe |
|---|---|---|
| FOX / FS1 | Cup Feb–May; Truck; ARCA | available (FS2 excluded — no Truck races there) |
| Prime Video | Cup 5 races | available |
| TNT Sports (+HBO Max) | Cup 5 races | available |
| USA Network / NBC / Peacock | Cup Aug–Nov | available |
| The CW | O'Reilly Series | available |

Seven-year deals (2025–2031). Every race in all three series is inside Joe's profile. Remaining 2026 Cup: Darlington Sept 6 (USA, 5 PM ET, Southern 500) through Homestead Nov 8.

## 4. Program-model fields

`program_type = race_session`, `sport = nascar`, `series`; `title` = race name (sponsor names change yearly — store `race_name` + `track`), `subtitle` = "{Track}, {City, ST}"; `start_at` = green-flag broadcast start; `expected_duration_min` by track type (superspeedway 210, intermediate 200, short track 180, road course 170; Coca-Cola 600 ~270) with `open_ended = true` (cautions, rain delays, red flags); `headliners[]` = optional (pole sitter, points leader — skip in v1); `hosts_crew[]` = booth (FOX: Mike Joy/Clint Bowyer/Kevin Harvick; Prime/TNT: Adam Alexander/Dale Earnhardt Jr./Steve Letarte; USA: Rick Allen/Jeff Burton/Steve Letarte — **all [UNVERIFIED 2026]**); `brand_mark` = series logo (Cup / O'Reilly / Craftsman Truck), plus the network's NASCAR package mark optional. Marquee: Daytona 500, Coca-Cola 600, Southern 500, Brickyard 400, playoff races, championship — Joe to rule.

## 5. Grid stress points

- **Rain delays and postponements** to Monday are common (Daytona/Talladega especially) — needs a `postponed_to` state and a re-render trigger; the existing `schedule_certainty` field covers the flag, the watch task must catch the move.
- **Row rotation:** Cup changes network family three times a season; the row is per-race data, not per-sport config (same rule as AEW).
- **Three series in one weekend** at one track (Fri Truck FS1, Sat O'Reilly CW, Sun Cup USA) — series sub-filter chips must be able to show all three at once (default all).
- **USA row density:** Pre-Race 30 min + race 3–4 h + Post-Race 30 min + SmackDown (Fri) — Saturday/Sunday clean; no clash with WWE.
- **Stage breaks:** irrelevant to the grid; History view could show stage winners later (not v1).

## 6. Hosts, crews, locations — sources

| Need | Source | Fetchable? | Cadence |
|---|---|---|---|
| Schedule, track, time, network | cf.nascar.com JSON feed; NASCAR PR (Nov); Jayski | JSON [UNVERIFIED]; Jayski YES | Season + weekly |
| Weekly TV listings incl. bookends | nascar.com/tv-schedule | [UNVERIFIED] | Weekly (Mon) |
| Booth crews | FOX Sports Press Pass (Feb), NBC Sports Pressbox (Aug), Prime/TNT press releases | [UNVERIFIED] | Once per window |
| Postponements | NASCAR press/X, Jayski | Jayski YES | Same day |

Track/city is inherent in the schedule (every race is "on-site"); no separate location source needed.

## 7. Betting lines (in scope)

The Odds API sport key `motorsport_nascar_cup` (outrights: race winner odds) **[UNVERIFIED key name and free-tier coverage]**; display = top 3 favorites' odds in the data line ("Larson +500 · Byron +600 · Hamlin +700"). O'Reilly/Truck outrights are thin at U.S. books — Cup only in v1.

## 8. Assets

Series logos (NASCAR Cup Series, NASCAR O'Reilly Auto Parts Series — new 2026 mark, NASCAR Craftsman Truck Series) from nascar.com press kit; network NASCAR package marks (FOX NASCAR, NASCAR on Prime, NASCAR on TNT, NASCAR on USA/NBC, NASCAR on The CW) optional. Driver headshots not needed v1. Track logos: skip.

## 9. Schema deltas

- `programs.series` (text) — new, indexed with `sport`.
- `programs.postponed_to` (timestamptz nullable) + rerender on change.
- Per-track duration defaults table (`data/nascar_track_types.json`) or a `track_type` field.
- `networks`: HBO Max as a TNT simulcast lane (may already exist from AEW work); The CW row exists (NXT-era? verify).

## 10. Open questions for Joe

1. Marquee list for gold sunburst.
2. Show Truck/O'Reilly races with pre-race bookends when they exist, or Cup bookends only? (Recommendation: whatever the TV listing carries; do not invent bookends.)
3. Add `cf.nascar.com` to the cloud egress allowlist so the JSON feed can be verified.
