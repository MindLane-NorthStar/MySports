# Research — IndyCar (Brief 2, item 6)

**Date:** 2026-09-02. **Scope (Joe 09-02):** race only; pre/post-race bookends; own chip. **Timing:** the 2026 season ends **Sunday, Sept 6** (Laguna Seca, FOX, pre-race 2:30 PM ET). Build against the 2027 schedule.

## 1. Schedule data source

- **Backbone (verified fetch 09-02): indycar.com** — server-rendered; the season press release carries a full Date/Venue/TV/Time table, and every page's header lists Previous/Next races with time, network logos (FOX, FS1, FOX One), and race/venue/city. `indycar.com/Schedule/{year}/{slug}` per race. Also offers **"Add to Calendar" (indycar.ecal.com)** and a **schedule PDF** — the ecal feed may be an iCal source **[UNVERIFIED]**. No public JSON API; ESPN `racing/irl` scoreboard is the structured fallback **[UNVERIFIED — 403 from cloud]**. Stable IDs: slug from the schedule URL (`Laguna-Seca`, `Milwaukee-Race1`).
- Season announced in early fall for the following year (2026 times released Dec 18, 2025) — the 2027 schedule and times should exist by Dec 2026.

## 2. Broadcast data (2026, verified)

Every race on **FOX** (17 races, 19 network windows incl. Indy 500 qualifying); simulcast on **FOX One**; practice/qualifying on FS1/FS2 (out of scope). Doubleheaders (Milwaukee Aug 29–30) exist. Pre-race shows precede select races (Arlington 30 min; season finale pre-race at 2:30) — bookends sourced from the same release. Indy 500: six-hour window from 10 AM.

## 3. Rights map → Joe

FOX multi-year (FOX Corp owns a one-third stake in IndyCar/Penske Entertainment since Aug 2025). Joe: available; FOX One duplicates FOX and is suppressed under the local-feed rule. Nothing to buy. Lowest staleness risk of any sport in the app.

## 4. Program-model fields

`program_type = race_session`, `sport = indycar`, no `series`; `title` = race name; `subtitle` = "{Circuit}, {City, ST}"; `expected_duration_min` ≈ 150 road/street, 120 short oval, 360 Indy 500; `open_ended = true`; `hosts_crew[]` (FOX booth: Will Buxton/James Hinchcliffe/Townsend Bell **[UNVERIFIED 2026]**); `brand_mark` = NTT INDYCAR SERIES logo. Marquee: Indy 500 (and finale?) — Joe to rule.

## 5. Grid stress points

- **FOX row on Sundays** in fall: IndyCar August/September races sit under NFL FOX windows — none clash in 2026 (finale Sept 6 precedes NFL Week 1) but the Nashville TBA and 2027 dates may. FOX carries one thing at a time; a race in the FOX row displaces nothing since NFL Week 1 starts Sept 13.
- **World Cup lead-ins (2026 only)** — irrelevant to the grid.
- **Rain delays** at ovals; same `postponed_to` handling as NASCAR.

## 6. Hosts, crews, locations — sources

| Need | Source | Fetchable? | Cadence |
|---|---|---|---|
| Schedule, times, TV | indycar.com season release + race pages; ecal/PDF | **YES** | Once per season; changes announced on indycar.com news |
| Booth crew | FOX Sports Press Pass IndyCar announcement (Feb) | [UNVERIFIED] | Once per season |

## 7. Betting lines (in scope): The Odds API `motorsport_indycar` outrights **[UNVERIFIED key/coverage]**; thin outside the Indy 500. Recommend Indy 500 only.

## 8. Assets: NTT INDYCAR SERIES logo (indycar.com serves `INDYCAR-Dark.png`); FOX/FS1/FOX One marks (indycar.com hosts `FOX-Pos.png`, `FS1-Pos.png`, `FOX-One-Vertical.png`) — use the network marks already cached.

## 9. Schema deltas: none beyond NASCAR's (`race_session`, `postponed_to`, duration defaults).

## 10. Open questions for Joe

1. Defer the IndyCar adapter to the 2027 schedule release (Dec 2026)? (Recommendation: yes — one race left in 2026.)
2. Marquee: Indy 500 only?
