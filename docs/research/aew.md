# Research — AEW (Brief 2, item 3)

**Date:** 2026-09-02. **Scope (Joe 09-02):** Dynamite and Collision (and included bookends: Countdown specials, Tailgate shows). **PPVs excluded** (purchasable, $39.99 on HBO Max).

## 1. Schedule data source

No API. Best primary: **Warner Bros. Discovery's monthly HBO Max programming schedule**, which lists every AEW airing with date, time, network, and specials (July and September 2026 schedules confirmed via trade reports; WBD press site `press.wbd.com` is the origin **[UNVERIFIED fetch — trade sites republish it within a day]**). Second: AEW's own X account and allelitewrestling.com news posts announce venues weeks ahead (e.g., Dynamite **Cleveland, OH, Wed Oct 14**). Third: tbs.com/tnt.com show pages (fetchable HTML, show-level slot only). Aggregators (PWTorch TV reports) confirm after the fact which network actually aired an episode. Stable IDs: `aew-{dynamite|collision}-{date}`.

## 2. Broadcast data (verified 2026)

- **Dynamite** — Wednesdays 8–10 PM ET, **TBS + HBO Max** simulcast, live [tbs.com; WBD].
- **Collision** — Saturdays 8–10 PM ET, **TNT + HBO Max**, often taped Wednesday and aired Saturday; **preempted or moved repeatedly** (July 2 and July 30 → Thursdays; All Out week Sept 23 → one hour at 10 PM Wed after Dynamite; Aug 22 episode aired on **TBS**, not TNT, per PWTorch) — the network and night are both variable.
- **Specials included with subscription** (bookend candidates): "Countdown to {PPV}" (30–60 min after Collision/Dynamite; e.g., Sept 23 11 PM), "Collision: Tailgate to All Out" (TNT, Sat Sept 26 7 PM), "Zero Hour" PPV pre-shows on HBO Max (July 26 6–7 PM). These are on TNT/TBS/HBO Max — all in Joe's profile — so they are in scope as bookends even though the PPV itself is excluded.
- HBO Max is a simulcast of the linear feed: under the local-feed suppression rule, show the **linear row** (TBS/TNT) and chip HBO Max, not both rows.

## 3. Rights map → Joe

| Outlet | Content | Joe |
|---|---|---|
| TBS | Dynamite | available |
| TNT | Collision, Tailgate specials | available |
| HBO Max | simulcasts, Countdown/Zero Hour, PPV (purchase) | available (PPV excluded by decision) |

WBD–AEW rights deal runs through 2029 [allelitewrestling.com 2025-09-03 references the ~6-year relationship; term end **[UNVERIFIED]**].

## 4. Program-model fields

`program_type = weekly_show`, `sport = aew`; `title` Dynamite/Collision; `subtitle` = city (from AEW announcements); `expected_duration_min` 120 default, **override from the monthly schedule** (60-minute Collision editions, 3-hour specials); `hosts_crew[]` commentary; `brand_mark` show logo. Countdown/Tailgate/Zero Hour: `studio_show` bookends with `anchor_program_id` → the Dynamite/Collision or (excluded) PPV; when the anchor is an excluded PPV, the bookend still renders on its own row with no anchor card — decide whether that is desirable (see §10).

## 5. Grid stress points

- **TNT row conflicts:** Collision 8–10 PM Saturdays vs TNT's NHL (Saturday nights in season) and NBA — this is *why* Collision moves. The monthly WBD schedule is the authority; the slot default is not.
- **Network swap within a show** (Collision on TBS Aug 22): the row is data-driven per episode, never fixed per show.
- **Preemption detection:** diff the monthly WBD schedule against the slot default each month; mid-month changes surface via AEW's X account and trade sites — add to the Wednesday watch task.
- Taped shows: Collision "recorded Wed, aired Sat" — the grid shows air time; no live/tape flag needed for v1.

## 6. Hosts, crews, locations — sources

| Need | Source | Fetchable? | Cadence |
|---|---|---|---|
| Monthly airings, times, specials | WBD monthly HBO Max schedule (press.wbd.com) | [UNVERIFIED]; trade republications (PWMania, Rajah, eWrestling) fetch | Monthly, ~1 week before month start |
| Venue/city | AEW X posts and allelitewrestling.com news; PWTorch reports carry venue per episode | allelitewrestling.com yes; X no | Weeks ahead |
| Commentary | AEW does not announce crews; PWTorch TV reports list "Commentators:" per episode (after air) | yes | After each show |

2026 crews as reported: Dynamite — Excalibur, Tony Schiavone, Paul Wight; Collision — Tony Schiavone with Nigel McGuinness or Ian Riccaboni or Excalibur, rotating [PWTorch Aug 2026]. Same honesty as WWE: crews are reported, not announced; recommend a "reported" tier or omit for AEW.

## 7. Betting lines — n/a.

## 8. Assets

Dynamite, Collision, Countdown, Tailgate marks from tbs.com/tnt.com/hbomax.com page art; TBS/TNT/HBO Max marks already cached.

## 9. Schema deltas

- Per-episode `network_id` (not per-show) — already true for broadcasts; confirm the `weekly_show` loader writes a broadcast per episode.
- `programs.expected_duration_min` override per episode from the monthly schedule.
- Bookend with an **excluded** anchor (Countdown to All Out when All Out is excluded) — needs an `anchor_excluded` handling rule.

## 10. Open questions for Joe

1. Show Countdown/Tailgate/Zero Hour bookends when the PPV itself is excluded? (Recommendation: yes for Tailgate/Countdown on TNT/TBS — they are free TV — and no for Zero Hour on HBO Max, which only exists to sell the PPV.)
2. Crew line for AEW: "reported" tier or omit?
3. Dynamite in Cleveland Oct 14 — marquee/gold sunburst for local-venue shows?
