# Research — WWE (Brief 2, item 2)

**Date:** 2026-09-02. **Scope (Joe 09-02):** Raw, SmackDown, main-roster PLEs. NXT excluded. SNME treated as PLE-class `special_event` (assumption, confirm).

## 1. Schedule data source

**Backbone: wwe.com** — Drupal, server-rendered, **fetched clean 09-02**. Two usable surfaces:
- The "Premier Shows" block present on every show page lists each upcoming show with date, time (ET/PT), and platform as plain text — e.g., "Sunday, Sept. 6 at 8 ET/5 PT on Peacock", "Saturday, Oct. 10 at 6 ET/3 PT on ESPN with the Unlimited Plan", "Monday at 8 ET/5 PT on Netflix", "Fridays at 8 ET/7 CT on USA". This is a de facto season calendar, cheap to parse.
- Per-episode pages `wwe.com/shows/{raw|smackdown|snme|<ple>}/{YYYY-MM-DD}` carry the venue/city and match card (`/shows/snme/2026-09-06` exists today).
- corporate.wwe.com press releases give venue + platform per PLE at announcement time [corporate.wwe.com 2026-03-31 for SNME MSG].
No official API. Fallbacks: ESPN has no WWE scoreboard; wrestling aggregators (F4W, Smark Out Moment) are secondary. Stable IDs: use `wwe-{show}-{date}`. TBD states: PLE times move at announcement; weekly shows are fixed unless preempted (rare on Netflix/USA; SmackDown holiday moves).

## 2. Broadcast data

From wwe.com's own listings (verified 09-02):
- **Raw** — Mondays 8 PM ET, Netflix (live, three hours).
- **SmackDown** — Fridays 8 PM ET, USA Network; **three hours in 2026** (returned to 3h Jan 2) [Fightful/PWInsider 2025-12-23].
- **Main-roster PLEs** — ESPN with the Unlimited Plan; select linear simulcasts at ESPN's option [ESPN/WWE deal, SI 2025]. wwe.com also lists Netflix on the same line for Money in the Bank (Oct 10, 6 PM ET) and Survivor Series: WarGames (Nov 28, 6 PM ET). **Interpretation: Netflix is the international carrier and wwe.com is a global page; U.S. = ESPN Unlimited. [UNVERIFIED — confirm with corporate.wwe.com PLE release before encoding; if Netflix carries PLEs in the U.S. it changes nothing for Joe's access but changes the card's distributor chips.]**
- **Saturday Night's Main Event** — Peacock, "streaming throughout the year" [wwe.com how-to-watch 08-30]. **Sunday Night's Main Event** — first ever, Sun Sept 6, 8 PM ET, Atlanta, Peacock **and YouTube** (per wwe.com). YouTube carriage is new and unexplained [UNVERIFIED — likely a free simulcast experiment; Peacock is the row for Joe].
- Pre-shows: ESPN may carry WWE-produced pre/post-shows for PLEs (deal option) — bookend candidates [UNVERIFIED per event].

## 3. Rights map 2026–27 → Joe's access

| Outlet | Content | Joe | Term |
|---|---|---|---|
| Netflix | Raw (U.S. live) | available | 10-yr deal from Jan 2025 |
| USA Network | SmackDown | available (DIRECTV CHOICE) | NBCU deal from Oct 2024 |
| ESPN Unlimited | main-roster PLEs | available | 5-yr from 2026 |
| Peacock | SNME/Sunday NME | available | NBCU |
| The CW | NXT | n/a (excluded) | — |

Nothing to buy. All main WWE content is inside the profile.

## 4. Program-model fields

- Raw/SmackDown: `program_type = weekly_show`, `sport = wwe`, `title` = "Monday Night Raw"/"Friday Night SmackDown", `subtitle` = "{City, ST}" (venue city from the episode page), `expected_duration_min = 180`, fixed end (not open-ended), `hosts_crew[]` = commentary team, `brand_mark` = show logo (Raw/SmackDown wordmarks).
- PLEs/SNME: `program_type = special_event`, `title` = event name, `subtitle` = city, `expected_duration_min` ~ 180–240, `open_ended = true`, marquee (gold sunburst) for WrestleMania/Royal Rumble/SummerSlam/Survivor Series at least — Joe to set the marquee list.
- No `series`, no participants beyond an optional headliner line (main event) from the episode page.

## 5. Grid stress points

- **Netflix row** exists (NFL Christmas); Raw makes it a weekly Monday row — fine.
- **USA row collisions:** SmackDown 8–11 PM Fridays vs NASCAR on USA (Aug–Nov, mostly Sat/Sun — no clash) vs NHL/other USA sports — none in Joe's scope on Fridays. **Note NBCU moves SmackDown to a different night on holidays** [observed pattern, UNVERIFIED for 2026 dates].
- **ESPN row:** PLEs are Saturday 6–10 PM ET — head-on with CFB primetime on ESPN linear; since PLEs are ESPN *Unlimited* (streaming) the row is the ESPN Unlimited/App lane, not ESPN linear, unless ESPN announces a linear simulcast. The renderer needs the distributor to be "ESPN Unlimited" (existing network id from the TBS/NFLN/ESPN+-in-Unlimited ruling) with a `simulcast_linear` flag when announced.
- **Sunday PLE clash with NFL** (Sept 6 SNME is Peacock 8 PM — no NFL yet; later Sundays would sit under SNF on the NBC row; Peacock row is separate — fine).
- **Commentary volatility:** teams swap around Joe Tessitore's college-football calendar (Sept–Dec) — crews are reported (PWInsider) more than announced. Treat crew as low-authority observation with a weekly refresh, never a season constant.

## 6. Hosts, crews, locations — sources

| Need | Source | Fetchable? | Cadence |
|---|---|---|---|
| Weekly venue/city | `wwe.com/shows/{show}/{date}` and `wwe.com/events` (ticketing list = venue calendar) | YES (Drupal HTML) | Announced weeks–months ahead |
| PLE date/venue/platform | corporate.wwe.com press releases; wwe.com show page | YES | At announcement |
| Commentary teams | WWE rarely issues press for crews; **primary is on-air**; reports via PWInsider/Fightful/Wrestling Inc. | Aggregators fetch; PWInsider Elite paywalled | Reactive |

2026 default crews (reported, applied Jan 2026): Raw — Michael Cole & Corey Graves; SmackDown — Joe Tessitore & Wade Barrett; PLEs — Cole & Graves (with Tessitore at times) [Fightful/PWInsider 2025-12-23; **[UNVERIFIED as of Sept — fall swap likely]**]. Honest assessment: WWE crews cannot be *sourced* from WWE itself with any regularity. Options: (a) show crew only when a press-quality source exists in the last 30 days, else omit the crew line; (b) accept reputable trade reports as a source class. **Recommendation: (a) for PLEs (WWE does announce), (b) for weekly shows, flagged as reported.**

## 7. Betting lines — not in scope for wrestling (predetermined outcomes; books don't post lines).

## 8. Assets

Raw, SmackDown, SNME, and each PLE has its own logo (SNME 2026 gold logo URL visible on wwe.com); pull from wwe.com show headers under the same brand-mark rules as network logos. Netflix/ESPN/Peacock/USA marks already cached.

## 9. Schema deltas

- `programs.brand_mark` must be **per-event** for PLEs (each PLE has its own logo), not per-sport.
- `broadcasts.simulcast_linear` (bool) for ESPN Unlimited events that also air on ESPN linear.
- Crew authority level: `authority_rules` needs a `reported` tier below `announced` for wrestling crews, or crews render muted with a "reported" state.

## 10. Open questions for Joe

1. Confirm SNME/Sunday NME = PLE-class special events (Peacock row).
2. Marquee list for the gold sunburst (WrestleMania, Royal Rumble, SummerSlam, Survivor Series? Money in the Bank?).
3. Accept trade-report crews for weekly shows (flagged "reported"), or omit crews for Raw/SmackDown?
4. Resolve the wwe.com "ESPN Unlimited + Netflix" dual listing for Oct 10 / Nov 28 from a U.S.-specific WWE/ESPN release before encoding.
