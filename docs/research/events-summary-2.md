# Research Summary 2 — Events & Shows (Studio shows, WWE, AEW, UFC, NASCAR, IndyCar)

**Date:** 2026-09-02. Companion to `enhancement-register.md` (requests + decisions) and the six item docs. Every claim below is cited in the item docs; **[UNVERIFIED]** items are collected in §5.

## 1. Program-model recommendation (spec v0.5)

The six items confirm the model in the register and add three things it did not have:

1. **`segments[]`** on a program (UFC early prelims / prelims / main card) — the only way a 5–6 hour card is scannable.
2. **Broadcast windows** (`broadcasts.window_start/window_end`) — UFC on CBS is a 2-hour slice of a 6-hour event. Duplicate-feed suppression must compare windows, not just networks.
3. **Per-episode network** for weekly shows — AEW Collision aired on TBS (not TNT) on Aug 22 and moves nights monthly; NASCAR Cup rotates network families three times a season. The row is data on every episode/race, never a per-show constant.

Everything else holds: `program_type` ∈ {game, race_session, fight_card, weekly_show, special_event, studio_show}; `series` for NASCAR; `anchor_program_id` + `bookend` for studio shows; `postponed_to` for motorsport; `open_ended` durations with a fade-out right edge. No `purchasable` state (AEW PPVs excluded by decision). **Sport chips:** one per `sport` value — nascar (Cup/O'Reilly/Truck sub-filter), indycar, ufc, wwe, aew; studio shows have no chip.

## 2. Biggest risk per item

| Item | Risk | Mitigation |
|---|---|---|
| Studio shows | **No structured source anywhere.** Locations and crews live in press releases; some announced social-first. FOX Press Pass fetchability untested. | ESPN Press Room fetches clean (verified). Watch task reads press pages weekly with a model parse into `studio_show_instances` observations; press release supersedes social. Test FOX/CBS/NBC press fetch from Joe's machine before depending on them. |
| WWE | Commentary teams are **reported, not announced**, and swap around Joe Tessitore's CFB calendar. wwe.com lists "ESPN Unlimited + Netflix" for PLEs (likely international). | wwe.com is Drupal and fetches clean for schedule/venue (verified). Crew = "reported" tier or omit. Confirm PLE U.S. carriage from a U.S.-specific release. |
| AEW | **Collision moves nights and networks monthly**; WBD monthly schedule is the only authority and its origin page fetch is untested. | Parse the monthly schedule (trade republications fetch); diff against slot default; watch task catches mid-month moves. |
| UFC | Segment start times are not on the verified P+ page; ufc.com/ESPN untested. | P+ Sneak Peak page (verified, static) for events + CBS flag; Paramount Press Express for CBS windows (verified); probe ESPN `mma/ufc` from Joe's machine for segments. |
| NASCAR | The official JSON feed (`cf.nascar.com`) is not allowlisted and unverified; nascar.com schedule pages are JS-only. Rain postponements to Monday. | Jayski (NASCAR-owned, fetchable) as fallback; add `cf.nascar.com` to egress; `postponed_to` + same-day watch. |
| IndyCar | None material — all FOX, indycar.com fetches clean. Season over Sept 6. | Defer adapter to the 2027 schedule (Dec 2026). |

**Cross-cutting risk: the ESPN Akamai 403.** All `site.api.espn.com` calls, including the production NFL/NBA/CFB-scores paths, 403'd from the cloud workspace today. This is not a Brief 2 finding but it blocks verifying three candidate endpoints (`racing/*`, `mma/ufc`) and may already be breaking `schedule_refresh` on GitHub Actions. Verify the next Actions run; add a browser User-Agent to `adapters/espn.py` if needed.

## 3. Consolidated schema deltas

- `programs` supertype (register draft) + `segments` JSON + `series` + `postponed_to` + `open_ended` + `anchor_program_id` + `bookend` + `hosts_crew[]` + `brand_mark` per program (PLEs have per-event logos).
- `broadcasts.window_start/window_end`; `simulcast_linear` bool (ESPN Unlimited events with linear simulcast); duplicate suppression by equal window.
- `studio_shows` registry + `studio_show_instances` observations (source_url on every row).
- `authority_rules`: new source classes — press room (announced), trade report (reported, muted render), league JSON/HTML (schedule). Per-sport authorities: P+ page (UFC schedule), Paramount Press Express (CBS windows), wwe.com (WWE), WBD monthly (AEW), cf.nascar.com/Jayski (NASCAR), indycar.com (IndyCar), ESPN Press Room / FOX Press Pass / CBS-NBC press (studio shows).
- Duration defaults table by program type and track type.

## 4. Confirmed build order

1. **Spec v0.5 program model + migration** (additive; `games` unchanged) — Claude Code prompt.
2. **Program-card silhouette in the prototype artifact** (Joe's option a) → rendering-contract v1.7.
3. **Studio shows** — CFB now, NFL Sept 13; registry + watch-task parse. Highest visibility.
4. **WWE + AEW** — same weekly-show machinery; wwe.com parse; WBD monthly parse.
5. **UFC** — P+ page adapter + CBS windows + segments; odds moneyline.
6. **NASCAR** — Cup playoffs are the 2026 payoff (Darlington Sept 6 → Homestead Nov 8); JSON feed once allowlisted; Truck/O'Reilly ride along.
7. **IndyCar** — 2027 schedule (Dec 2026).

## 5. UNVERIFIED items to close (by owner)

**Joe's machine / Claude Code:** ESPN `racing/nascar-premier|secondary|truck`, `racing/irl`, `mma/ufc` scoreboards; `cf.nascar.com` schedule-feed JSON; FOX Sports Press Pass, CBS/NBC press, ufc.com, WBD press page fetchability; whether the Actions runner is also 403'd by ESPN.
**Watch task / next research pass:** WWE PLE U.S. carriage (ESPN vs the Netflix line on wwe.com); Sept 6 SNME YouTube simulcast; 2026 crews for FOX NASCAR, USA NASCAR, FOX IndyCar, MNF Countdown, Prime TNF, Netflix pregames; the two FOX Truck races; TNT NASCAR HBO Max simulcast; The Odds API keys for MMA/NASCAR/IndyCar and free-tier quota.

## 6. Open questions for Joe (consolidated, not blocking v0.5)

Marquee (gold sunburst) lists per sport · studio-city display when not on-site (rec: road only) · FOX NFL Kickoff vs FOX NFL Sunday as two cards (rec: two) · WWE/AEW crews "reported" tier vs omit · AEW bookends when the PPV is excluded (rec: TNT/TBS yes, HBO Max Zero Hour no) · UFC CBS partial card shown (rec: yes) · SNME as PLE-class (assumed) · IndyCar deferral to 2027 (rec: yes).
