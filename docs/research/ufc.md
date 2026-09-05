# Research — UFC (Brief 2, item 4)

**Date:** 2026-09-02. **Scope (Joe 09-02):** one card per event with a segment timeline (early prelims / prelims / main card); CBS window drawn as a partial bar; odds under `show_odds`.

## 1. Schedule data source

- **Backbone (verified fetch 09-02): Paramount+ "Sneak Peak" UFC schedule page** `paramountplus.com/sneak-peak/ufc-schedule-2026/` — static WordPress (Simply Static), server-rendered, updated ~weekly (last 08-31). Per event: name, date, venue (city), **main-card start ET/PT**, streaming, and an explicit note when there is *no* CBS simulcast. Cards/times announced 8–12 weeks out. Weakness: main-card time only; no prelim times; no stable IDs (derive `ufc-{number|fn}-{date}`).
- **Segment times:** `ufc.com/events` and per-event pages carry early-prelims/prelims/main-card times **[UNVERIFIED fetch — ufc.com is JS-heavy; test]**. ESPN's undocumented `site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard` should expose cards, bout order, and segment times (ESPN was the prior rights holder and keeps MMA data) **[UNVERIFIED — Akamai 403 from cloud 09-02; probe from Joe's machine]**.
- **CBS simulcast windows:** Paramount Press Express (`paramountpressexpress.com/cbs-entertainment/releases/`) per-event releases state exact CBS windows (UFC 326: CBS 8–10 PM ET = last hour of prelims + first hour of main card) — fetched clean earlier.
- Fallback: Sports Media Watch / MMA Fighting schedules (secondary).

Upcoming (from the P+ page 08-31): Sept 5 FN Paris main card 3 PM ET (P+ only); Sept 12 Noche UFC Glendale 5 PM; Sept 19 UFC 331 Los Angeles 9 PM; Sept 26 FN APEX 6 PM; Oct 3 UFC 332 Salt Lake 9 PM; Oct 17 FN Edmonton 8 PM; Oct 24 UFC 333 Abu Dhabi 2 PM; Nov 7 FN APEX 5 PM.

## 2. Broadcast data

- Every event: **Paramount+ (any plan)**, live and on demand, entire card. Joe has Paramount+ → available.
- Select numbered events: **CBS partial simulcast**, windowed (precedent 8–10 PM ET). Paramount+ Premium also streams the live CBS affiliate feed; Essential does not (irrelevant for Joe — DIRECTV carries CBS).
- Pre/post-shows: UFC produces "Countdown" and post-fight shows; P+ carries some; CBS carried a "This Is UFC" special. Bookend candidates **[UNVERIFIED per event]**.
- Non-Saturday events happen (White House card was a Sunday, June 14).

## 3. Rights map → Joe

Paramount+ exclusive U.S., 2026–2033 ($7.7B/7 yr); CBS simulcasts at Paramount's discretion. Joe: available; nothing to buy. Stable through 2033 — low staleness risk, unlike RSNs.

## 4. Program-model fields

`program_type = fight_card`, `sport = ufc`; `title` = "UFC 331" / "UFC Fight Night" / "Noche UFC"; `subtitle` = "Van vs. Pantoja 2" (headliner) + city; `start_at` = **early-prelims start** (card start), `segments[] = [{early_prelims, start}, {prelims, start}, {main_card, start}]`, `expected_duration_min` ≈ 300–360 from card start, `open_ended = true`; `hosts_crew[]` = broadcast team (numbered: Jon Anik + two analysts, typically Daniel Cormier/Joe Rogan for U.S. numbered events **[UNVERIFIED 2026 per event]**); `brand_mark` = UFC mark (per-event art optional). Marquee (gold sunburst): numbered events with a title fight — or all numbered events; Joe to rule.

## 5. Grid stress points

- **Length:** 5–6 hours is the longest single card in the app; at 30-minute columns that is 10–12 columns of one card. The segment timeline inside the tray (three tick marks with times) is the only way to make it scannable; without it the card is a wall.
- **Partial simulcast bar:** CBS row gets a 2-hour card labeled with the window ("UFC 331 · CBS simulcast 8–10 PM"), P+ row gets the full card; the local-feed suppression rule must **not** collapse these (they are different windows, not duplicates). New rule: duplicates are suppressed only when windows are equal.
- **Afternoon international cards** (Paris 3 PM ET, Abu Dhabi 2 PM ET) collide with CFB/NFL windows on the same viewing day — fine, different rows.
- **Card start uncertainty:** early prelims sometimes P+ only from 6 PM while the P+ page lists 9 PM main card — start_at comes from the segment source, not the P+ page.

## 6. Hosts, crews, locations — sources

| Need | Source | Fetchable? | Cadence |
|---|---|---|---|
| Event date/venue/main-card time/CBS flag | P+ Sneak Peak schedule page | **YES** | Weekly |
| Segment times, bout order | ufc.com event page; ESPN mma/ufc API | [UNVERIFIED] | At card announcement |
| CBS window | Paramount Press Express release | YES (release fetched clean 02-10) | ~4 weeks before |
| Commentary team | UFC announces broadcast teams per event on ufc.com news; P+ press | [UNVERIFIED cadence] | ~1 week before |

## 7. Betting lines (in scope — Joe 09-02)

The Odds API sport key `mma_mixed_martial_arts` lists per-bout moneylines (h2h) from U.S. books; free tier 500 req/month **[UNVERIFIED current quota — same evaluation as Brief 1 item 7]**. Card display: main-event moneyline only ("Van −180 / Pantoja +150") in the data line, matching the existing spread synthesis style. ESPN's scoreboard, if reachable, carries odds too.

## 8. Assets

UFC wordmark; optional per-event key art from the P+ page (Getty — **do not cache**; use the UFC mark only). Fighter headshots via ESPN CDN `a.espncdn.com/i/headshots/mma/players/full/{id}.png` **[UNVERIFIED]**; not needed for v1.

## 9. Schema deltas

- `programs.segments` (JSON array of named starts) — new.
- `broadcasts.window_start/window_end` — new; duplicate suppression compares windows.
- `authority_rules`: P+ page = schedule authority; Paramount Press Express = CBS-window authority; ufc.com/ESPN = segment authority.

## 10. Open questions for Joe

1. Marquee rule: all numbered events, or title fights only?
2. Does the CBS partial card show on the grid at all, given P+ carries the whole event and Joe has both? (Recommendation: yes — it is a real broadcast option and the window is the interesting fact.)
3. UFC Countdown/post-shows as bookends: only when on P+ (have) — confirm.
