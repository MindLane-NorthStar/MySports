# MySports Multi-Sport Research — Cross-League Summary

**Written:** 2026-08-31. Covers all four leagues: NFL, MLB, NBA, NHL. Companion docs: `research-nfl.md`, `research-mlb.md`, `research-nba.md`, `research-nhl.md`.
**Scope note:** research-only session per the brief. No repo access, no code, no spec edits. Files are delivered as downloads for Joe to add to the Project — this session can read Project files but cannot write back to them.

---

## 1. The three findings that change the plan

### 1.1 The RSN model collapsed in Cleveland, in all three pro sports, inside 18 months

This is the biggest thing in the research and it was not on the brief's radar as a *systemic* issue — the brief asked about "Rock Entertainment Sports Network and FanDuel Sports Network developments" as a fact-finding item. The answer is bigger than a fact.

| Team | Was | Is (2026–27) |
|---|---|---|
| **Guardians** | Bally/FanDuel Sports Network Great Lakes | **MLB Local Media** — MLB produces and distributes; DTC via CLEGuardians.TV; 10 free WKYC simulcasts. **Resolved.** |
| **Blue Jackets** | FanDuel Sports Network Ohio | **NHL Productions** centralized production. **Distributor unannounced.** |
| **Cavaliers** | FanDuel Sports Network Ohio | **Rights reverted to the team.** **Carrier unannounced.** NBA plans a league-run hub for 2027–28. |

Main Street Sports Group, operator of the 15 FanDuel Sports Network RSNs, wound down in April 2026 after a DAZN rescue failed, stranding 13 NBA teams and six-to-seven NHL clubs.

**Three consequences for the build, in order of importance:**

1. **The v0.3 schema must not require a named third-party network to attach a local telecast.** Two of Joe's three pro teams currently have local rights, a production arrangement, a named on-air crew, and *no carrier*. A model that can't represent that can't represent 2026. **Recommend a `TBA` distributor state** that renders as "local broadcast — carrier TBA" rather than dropping the game.
2. **RSN and local-carrier attribution needs an explicit staleness horizon in `authority_rules` — weeks, not seasons.** I got the Cavaliers wrong on my first pass in this very batch, sourcing from DIRECTV's own website and a structured reference. Both are exactly the kind of high-rank source the authority model would trust. Both were months stale. **The correction and its lesson are recorded in `research-nba.md` §4 and its assumptions log.** This is the most valuable single output of the research and it came from an error, not a search.
3. **League-operated local media is the direction of travel.** MLB has been doing it since 2023 and is at 15 clubs; the NHL started this July with four; the NBA targets 2027–28. **Model "the local telecast" as a rights arrangement with a mutable distributor**, and expect league DTC products (CLEGuardians.TV and its successors) to become first-class entities alongside networks.

### 1.2 ESPN's undocumented API solves more of the problem than expected — verified, not assumed

I tested the live 2026 NFL endpoint during this session rather than trusting community docs. One no-auth, no-cost GET returns, per game: ISO kickoff with minute precision, venue with indoor flag, stable event and team IDs, **an `isTBDFlex` boolean**, national broadcaster with a TV-vs-streaming type discriminator, **DraftKings spread + over/under with opening and closing lines**, team hex colors, and light/dark logo URLs.

That single payload covers checklist items 1, 2 (partially), 7 and 8 for a league. **It is the reason no odds API needs buying for any of the four sports**, and it is the reason the asset work is 60–64 PNGs per league against a fetch script that already exists.

**Two honest caveats.** It is undocumented and unsupported, so ESPN can close it without notice — the same class of risk as the CFB official-source HTML adapters, but lower, since these endpoints have been stable for a decade. And ESPN's team colors drift from official brand palettes (the Ravens came back as `29126f` against an official `241773`), so seed from ESPN and hand-audit all 124 teams before first render.

### 1.3 Joe's access profile is in far better shape for the pro leagues than for college football

Total gaps across all four leagues, national coverage:

| Gap | League | Cost to close | Recommendation |
|---|---|---|---|
| **Apple TV — Friday Night Baseball** | MLB | $12.99/mo | Joe's call. Only genuine national gap. |
| **NHL Network** | NHL | DIRECTV ULTIMATE upgrade | **No.** NHL Power Play (already owned via ESPN Unlimited) carries replays of every NHL Network game. |
| **NFL Sunday Ticket** | NFL | ~$378/season | **No.** Out-of-market only; Joe is in the Browns' market. |
| **NBCSN** | MLB, NBA | Not carried on DIRECTV | **Irrelevant.** NBCSN only simulcasts Peacock exclusives; Peacock Premium satisfies every one. |

**Everything else — every NFL, NBA and NHL national game, and all of MLB except Apple's Fridays — is already inside the profile Joe has.** And ESPN Unlimited quietly includes **NHL Power Play, 1,050+ out-of-market NHL games**, which is functionally NHL Center Ice already paid for.

---

## 2. The single biggest architectural risk, per league

| League | Biggest risk | Why it's the biggest |
|---|---|---|
| **NFL** | **The Sunday coverage map.** "CBS at 1:00" is up to eight simultaneous games, each in a different set of markets. ESPN labels them all `market: "National"`, which is true about the rights deal and false about Joe's television. | It is the only one of the four risks with **no free structured data source at all.** 506sports publishes it as map images, on a schedule, unofficially. Every other league risk is a fact I couldn't confirm; this one is a fact nobody publishes. |
| **MLB** | **The Stats API may be gating.** Three GETs to `statsapi.mlb.com/api/v1/schedule` returned HTTP 400 this session, and `statsapi.mlb.com/docs/` now presents an Okta login. | MLB's `hydrate=broadcasts(all)` is **the only true `/games/media` equivalent among the four leagues.** If it's open, MLB is the easiest league to source. If it's closed, MLB loses its one structural advantage and falls back to ESPN like everyone else. Binary, and two minutes to test. |
| **NBA** | **The Cavaliers have no local carrier.** Roughly 60 of 82 games have nowhere to render. | The national map is perfect and the schedule is fully published in August with no flex. **The league is 100% modelable and ~25% renderable.** That gap is the whole risk. |
| **NHL** | **The Blue Jackets have no local carrier either, and the season starts September 29.** Plus TNT's parent WBD is under a pending acquisition while TNT holds the 2027 Stanley Cup Final. | Same carrier problem as the NBA but on a four-week clock instead of a seven-week one, with a rights-holder ownership change layered on top. |

**The pattern:** three of four biggest risks are about *carriage and market*, not about schedules or scores. **MySports' hard problem was never getting the games. It is knowing which of them Joe can actually watch** — which is exactly the premise the product was built on, now confirmed under load.

---

## 3. Recommended build order

**My recommendation: NFL → NHL → NBA → MLB.** This deliberately inverts the brief's research order, and here is the reasoning.

**1. NFL — build first.**
- Season is live now and runs through January. Immediate feedback loop.
- Every national game is inside Joe's profile.
- The hardest problem (coverage map) forces the `market_coverage` entity to be designed properly, and **NBA Coast 2 Coast Tuesday and NFL Sunday both need it.** Solve it once, under the hardest case.
- Only 272 games a season with a weekly rhythm — small enough to hand-verify a full week during development.
- It is the sport with the most emotional payoff for a Browns household, which matters for a personal product.

**2. NHL — build second.**
- Starts September 29, so it is the next thing to go live.
- Best-instrumented league API of the four — if `where-to-watch` and `postal-lookup` do what their names suggest, they may retire a chunk of hand-built market logic.
- Introduces the `whip_around` entity (Frozen Frenzy, Oct 13) which **also unlocks NFL RedZone and Peacock's MLB whip-around show**. Another solve-once.
- The Blue Jackets carrier gap is real but the national slate (172 games) is fully published and fully accessible to Joe.

**3. NBA — build third.**
- Starts October 20. Fully published schedule, no flex, stable weekly network rhythm — **the easiest renderer of the four.**
- Blocked only by the Cavaliers carrier question, which may resolve on its own before you get there.
- Christmas Day 2026 (five straight ABC/ESPN games, noon to 1 a.m.) is the best hero render on any of the four calendars and a natural design milestone.

**4. MLB — build last, and here is the uncomfortable reason.**
- MLB's **CBA expires after the 2026 season and a lockout was described as expected** at the time the 2026–28 media deals were signed. **[UNVERIFIED as to current status — I have not checked whether anything changed.]**
- Building MLB next means potentially building a renderer with nothing to render in spring 2027.
- MLB is also the highest-volume, highest-duplication league (15 games/day × home and away feeds), so it is the most work for the most uncertain payoff.
- The counter-argument, which is real: MLB has the best media data if the Stats API is open, and Guardians local coverage is the most *resolved* of Joe's three pro teams. If the labor situation clears, MLB moves up.

**One dissent worth stating against my own recommendation:** if the point of the next phase is to prove the *multi-sport* architecture rather than ship a league, **build NFL and NHL simultaneously in November**, when CFB, NFL, NHL and NBA all run on the same Saturday. A single day with four sports on one grid is the actual product thesis, and no single-league build tests it.

---

## 4. Consolidated schema deltas

Grouped by whether they block rendering. Every one traces to a specific league finding; league doc and section noted.

### Blocking — the renderer produces wrong output without these

| Delta | Shape | Driven by |
|---|---|---|
| **`market_coverage`** | `(game_id, network_id, market_id, is_primary)` | NFL Sunday regional split (`nfl` §5.1); NBA Coast 2 Coast affiliate discretion (`nba` §5.1) |
| **`schedule_certainty`** on game | `FINAL \| FLEX_PENDING \| TBD \| TBD_FOLLOWS` + `flex_decision_deadline` | NFL flex windows (`nfl` §5.2); MLB same-admission doubleheaders (`mlb` §5.3) |
| **`carriage_certainty`** on the broadcast relation | adds `AFFILIATE_DISCRETION` — the *game* is certain, its *carriage* is not | NBA Coast 2 Coast (`nba` §5.1) |
| **`feed_side`** on the broadcast relation | `HOME \| AWAY \| NATIONAL` | MLB dual local telecasts (`mlb` §2, §9); NHL Power Play's selectable home/away commentary (`nhl` §3) |
| **`suppresses_local_feed`** on national broadcasts | boolean | National exclusives *remove* the local row rather than adding one — MLB (`mlb` §4), NBA (`nba` §4) |
| **`delivery_surface`** on the broadcast relation | `LINEAR \| STREAMING` | CBS→Paramount+, NBC→Peacock, FOX→Fox One must not become separate grid rows (`nfl` §5.4). ESPN's `geoBroadcasts[].type` populates it for free. |
| **`distributor` nullable + `TBA` state** on local rights | must tolerate "unknown" | Cavaliers and Blue Jackets, right now (`nba` §4, `nhl` §4, §9) |
| **`doubleheader_game_number`** on game | int, nullable | MLB (`mlb` §5.3) |

### Needed — correctness or honesty suffers without these

| Delta | Shape | Driven by |
|---|---|---|
| **`whip_around` broadcast type** | broadcast row with `covers_games[]` instead of one `game_id` | NHL Frozen Frenzy, NFL RedZone, Peacock MLB whip-around, NBC Gold Zone (`nhl` §5.2, §9) — four real cases |
| **`blackout_rule`** on the broadcast relation | enum | NFL Network local blackout (`nfl` §2); MLB.TV in-market and national-exclusive blackouts (`mlb` §4); MLBN alt (`mlb` §2) |
| **`carriage_status`** per (network, provider) | so "on NBCSN — not in your DIRECTV lineup" is a stated fact, not a silent drop | NBCSN across MLB and NBA (`mlb` §9, `nba` §9) |
| **per-sport render policy** | `block_duration_minutes`, `lane_policy`, `primary_line_type`, `open_ended` | See §5 below |
| **`competition_context`** on game | `REGULAR \| CUP_GROUP \| CUP_KNOCKOUT \| PLAY_IN \| PLAYOFF` | NBA Cup (`nba` §5.4); also carries Winter Classic, Field of Dreams, Stadium Series |
| **`viewing_day_cutover`** on render policy | recommend 03:00 ET globally | MLB and NBA/NHL West Coast late starts (`mlb` §5.5, `nba` §5.2, `nhl` §5.1) |
| **`simulcast_group` supporting 3+ members** | widen from pairs | Cavaliers/RESN 3-way; Blue Jackets 2025–26 simulcast spanned a CW station + Gray stations in six markets + Prime Video + Pluto TV (`nba` §9, `nhl` §4) |
| **`series_id` / `series_game_number`** | | MLB series, NHL/NBA playoff series (`mlb` §9) |
| **cross-sport slot-collision detection** | alert on duplicate `(network, date, time_slot)` | TNT's NHL game inside the March Madness window, March 21, 2027 (`nhl` §5.5) — surfaces a data error instead of silently picking one |
| **`odds` fields** | `spread`, `total`, `moneyline`, `odds_source`, `odds_fetched_at` | All four leagues, free via ESPN — **pending the §21 decision** |
| **`affiliate_call_sign`** | optional display attribute on (network, market) | Cosmetic; makes the footer tray feel local (`nfl` §4) |

### Per-sport render policy values, recommended

| Sport | Block duration | Lane policy | Primary line | Open-ended |
|---|---|---|---|---|
| `cfb` | existing | `alt_lane` | spread | no |
| `nfl` | **210 min** | **`market_filter`** | spread | no |
| `mlb` | **180 min** | `market_filter` | **moneyline** | **yes** |
| `nba` | **150 min** | `market_filter` | spread | no |
| `nhl` | **150 min** | `market_filter` | **moneyline** | playoffs only |

**The `alt_lane` rule should be retired for all four pro leagues.** It works for CFB, where two genuinely national games occasionally share a network and slot. It does not survive contact with an NFL Sunday. Make lane behavior a per-sport policy rather than a global constant.

### One structural observation
**The deltas converged rather than multiplied.** Four leagues produced roughly a dozen blocking additions, and `market_coverage`, `schedule_certainty`, `delivery_surface`, `feed_side` and `suppresses_local_feed` cover most of it between them. That is evidence the v0.3 design was close and the multi-sport extension is a handful of relations, not a rethink.

---

## 5. Consolidated open questions for Joe

### Tier 1 — blocks work, and each takes under five minutes

1. **Is the MLB Stats API still open?** Paste `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-09-01` into a browser. JSON starting `{"copyright":` means open. Then try the same URL with `&hydrate=broadcasts(all)` appended and Ctrl+F for `broadcasts`. **Determines whether MLB has native media data or falls back to ESPN.** (`mlb` §10 Q1 has the full step-by-step.)
2. **Does the NBA CDN schedule file load, and does it contain `broadcasters`?** Paste `https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json`, wait, Ctrl+F for `broadcasters`. My fetch was refused by bot detection; a browser is a different client. (`nba` §10 Q1.)
3. **Does the NHL API respond, and what do `where-to-watch` and `postal-lookup` return?** Start with `https://api-web.nhle.com/v1/schedule/2026-09-29`. **Potentially the highest-value endpoints found in this entire research batch** — a league-native ZIP-to-broadcaster resolver would retire a lot of hand-built logic. (`nhl` §10 Q1.)
4. **Where will Cavaliers games air in 2026–27?** Unannounced as of my information; check nba.com/cavaliers/news or Crain's Cleveland. (`nba` §10 Q2.)
5. **Where will Blue Jackets games air in 2026–27?** Unannounced as of July 2026; check nhl.com/bluejackets/multimedia/tv-broadcast. **Season starts September 29.** (`nhl` §10 Q2.)

### Tier 2 — decisions only you can make

6. **The §21 betting-lines contradiction, now four leagues wide.** Spec §21 lists betting lines as a v1 non-goal; you asked for point spread in the footer tray on 2026-08-31. ESPN hands over spread, total and moneyline free in the same call as the schedule — **there is no acquisition cost and no new dependency, so the only question is whether the non-goal stands.** Needs a yes or no before the multi-sport renderer is written. All four docs assume approved with a suppression flag.
7. **Apple TV for MLB Friday Night Baseball — $12.99/month?** The only genuine national-coverage gap across all four leagues. Modeled as not held.
8. **Coverage-map fidelity: market-of-one, or general DMA support?** My strong recommendation is market-of-one for v1 — hard-code Cleveland, build the schema wide enough to grow. Building a general DMA map from 506sports' image maps is a hard scraping problem for near-zero personal benefit. (`nfl` §10 Q3.)
9. **How should out-of-market and non-accessible games appear?** I've proposed one shared collapsed "Around the League" strip below the grid — muted register, no grid geometry, expandable — serving NFL out-of-market, MLB's 15-game nights, and NBA/NHL density. One component, four leagues. Alternative is to hide them entirely.
10. **Build order.** My recommendation is NFL → NHL → NBA → MLB (§3), with the MLB labor situation as the deciding factor and a real dissent in favor of building NFL+NHL together in November to test the multi-sport thesis directly.

### Tier 3 — quick confirmations

11. **Is TBS in your DIRECTV lineup?** Your profile lists TNT and truTV but not TBS. TBS carries MLB Tuesdays, the MLB Division Series and LCS, and part of TNT Sports' 72-game NHL slate. Almost certainly a profile omission rather than a real gap, but taken literally the access engine suppresses all of it.
12. **Does your DIRECTV CHOICE lineup carry NFL Network (channel 212)?** Sources conflict. Since ESPN now owns NFL Network and is folding it into ESPN Unlimited for the 2026 season, **also check whether it appears inside your ESPN app** — if so the linear question is moot. Affects 5 games.
13. **Confirm ESPN+ content sits inside your ESPN Unlimited subscription.** 47 of the NHL's 100 ESPN-platform games are ESPN+/Disney+/Hulu exclusives. You have both ESPN Unlimited and Disney+, so this should be double-covered, but the ESPN DTC restructuring has made the relationship genuinely confusing.
14. **Verify three Cleveland affiliate call signs** — WKYC/NBC 3, WJW/FOX 8, WBNX/CW 55. High confidence, not primary-sourced. Cosmetic only.

---

## 6. What I'd do next, if it were my call

**Before any code:** run Tier 1. Five browser paste-and-check operations, under fifteen minutes total, and they determine the data backbone for three of the four leagues and whether two of them are renderable at all this season.

**Then, one focused decision session on the §21 betting-lines contradiction and the market-of-one question.** Both are cheap to decide and expensive to defer — they shape the schema, and the schema is the next artifact.

**Then build the NFL,** because it is live, fully accessible to you, and its coverage-map problem forces the `market_coverage` design that the NBA also needs. Use a real Sunday in November as the acceptance test: it will have CBS and FOX regional splits, a flex-pending primetime game, an out-of-market strip, and — if the NHL lands alongside it — a genuinely multi-sport grid.

**One organizational note, offered as steward rather than researcher:** these four league docs plus this summary will not stay accurate. Three of the eleven "biggest risk" and "open question" items are literally *awaiting an announcement*. Recommend a short `claude/research-changelog.md` in the Project that records what changed and when, rather than editing these docs in place — the same discipline as `canonical_decisions` in the build spec, applied to the research layer. The Cavaliers error in `research-nba.md` is preserved rather than erased for the same reason: **the failure mode was more instructive than the fact.**
