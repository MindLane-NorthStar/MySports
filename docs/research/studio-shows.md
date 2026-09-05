# Research — Studio / Pregame / Postgame Shows (Brief 2, item 1)

**Date:** 2026-09-02. **Scope (Joe 09-02):** pregame + postgame bookends on the game's network, for every sport MySports carries. No halftime, no daily talk shows. Hosts, crews, and on-site locations must be **sourced from public announcements**, never hand-curated.

## 1. Schedule data source

There is no API. Studio shows are not in any league schedule feed (CFBD, ESPN scoreboard, statsapi, NHL, NBA). The schedule is derivable from three facts per show: a **fixed weekly slot** (network, weekday, start, duration), an **anchor** (the game window it bookends), and **exceptions** (three-hour specials, holiday moves, on-site weeks). Recommended backbone: a versioned `data/studio_shows/{sport}.json` registry of slots **populated from the sources in §6, with the source URL stored on every field** (satisfies "sourced, not curated" — the file is a cache of public facts, not Joe's opinion). Fallback: none needed for slots; they change at season boundaries only.

Verified 2026 slots:
- **College GameDay** — Sat 9:00 AM ET, three hours, ESPN + ESPNU simulcast, on the road every week; site announced by ESPN Press Room [espnpressroom.com release 2026-05-12, table of Date/Site/Game]. 2025 pattern: destination named on Saturday night via TV/social, press release Monday–Tuesday; later-season picks come "on a shorter cycle."
- **Big Noon Kickoff** — Sat 10:00 AM ET, two hours, FOX (FS1 simulcast some weeks), on the road; three-hour specials at 9:00 AM select weeks [foxsports.com Press Pass 2026-05-27; foxsports.com BNK experience page]. Week 1 Bloomington, Week 2 Ann Arbor, Nov 28 Columbus three-hour special — named in the **schedule** release, not a weekly release.
- **FOX NFL Kickoff** — Sun 11:00 AM ET, one hour, FOX; **FOX NFL Sunday** — Sun 12:00 PM ET, one hour, FOX, LA studio [foxsports.com Press Pass 2026-08-04].
- **The NFL Today** — Sun 12:00 PM ET, CBS, NYC studio; 2026 cast changes (Russell Wilson, Kyle Long in; Jonathan Jones out; Tony Romo on leave as game analyst) [Wikipedia 2026 NFL season, citing CBS — **[UNVERIFIED against CBS press]**].
- **Football Night in America** — Sun 7:00 PM ET, NBC/Peacock, studio; 2026: Dungy and Simms out, Mike Tomlin in [same source — **[UNVERIFIED against NBC press]**].
- **Monday Night Countdown** — Mon 6:00 PM ET, ESPN, on-site at the MNF venue most weeks **[UNVERIFIED for 2026 roster]**.
- **Prime Video TNF pregame** — Thu ~7:00 PM ET, Prime Video, on-site **[UNVERIFIED for 2026 roster]**.
- **Netflix NFL pregames** — five games in 2026 (Melbourne Week 1 Thu Sept 10; Thanksgiving Eve; Christmas doubleheader; +1) [Sports Media Watch NFL TV schedule 09-02]; NBC produces the Melbourne game [SVG Behind the Mic 08-18]; pregame format **[UNVERIFIED]**.
- NASCAR pre/post-race (FOX NASCAR RaceDay; USA Sports Pre-Race/Post-Race 30 min each side of the race) [Yahoo/NASCAR weekly listings 08-2026]. UFC/WWE/AEW bookends are covered in their own docs.

## 2. Broadcast data

Studio shows carry the **same distributor as the anchor game window** by construction, with two simulcast wrinkles: GameDay on ESPN + ESPNU (both in Joe's profile), BNK on FOX + FS1 some weeks. Access resolution is inherited from the network row; no new access states.

## 3. Rights map

Not applicable — studio shows have no rights separate from the network's game package. Access: every show above is on a network in Joe's profile. Netflix pregames require Netflix (have).

## 4. Program-model fields

`program_type = studio_show`; `sport` = the sport covered; `title` = show name; `subtitle` = "Live from {City, ST}" when `on_site`, else network studio city (optional, muted); `hosts_crew[]` from the season roster source; `anchor_program_id` → the game window (for FOX NFL Sunday: the 1:00 slate, not one game); `expected_duration_min` fixed per slot; `brand_mark` = show logo; `graphic_package` = network skin token (the same charcoal card, with the network's accent as the endcap band). Postgame bookends: same record with `bookend = post` and a start pinned to the anchor's expected end (open-ended; renderer fades the right edge).

## 5. Grid stress points

- **Row collisions:** GameDay 9–12 on ESPN overlaps noon CFB kickoffs by zero, but ESPNU 9–12 preempts nothing; BNK 10–12 on FOX precedes Big Noon Saturday cleanly. NFL Sunday: FOX row shows Kickoff 11–12, FOX NFL Sunday 12–1, then the 1:00 game — a full row with no gaps; that is the intended look.
- **On-site same city as a game:** GameDay in Austin while Texas hosts Ohio State (Sept 12) — the studio card's subtitle duplicates the game's venue city; acceptable, do not dedupe.
- **Three-hour specials** shift start by one hour (BNK 9:00) — must come from the source, not the slot default.
- **Postgame open-endedness:** anchor end is uncertain (OT, doubleheaders); render as a short fade block, never a hard 60-minute box.
- **Midnight rollover:** West Coast postgame shows can cross 12:00 AM ET — the day engine already handles late NBA/NHL games; same rule.

## 6. Hosts, crews, locations — sources and fetchability (the hard part)

| Source | What it gives | Fetchable by script? | Cadence |
|---|---|---|---|
| ESPN Press Room `espnpressroom.com/us/press-releases/…` | GameDay site + game per week (HTML table); season roster; MNF Countdown roster | **YES — server-rendered, fetched clean 09-02** | Season roster May; weekly site release Mon–Tue (2025 pattern), sometimes only social first |
| espn.com "Where is College GameDay" running story | Same, one page all season | **NO — JS-rendered, blank to fetch** | — |
| FOX Sports Press Pass `foxsports.com/stories/presspass/…` | BNK sites named inside schedule releases; full CFB roster (08-29) and NFL roster (08-04) incl. FOX NFL Kickoff/Sunday hosts | **[UNVERIFIED — not fetched this session; foxsports.com is a JS-heavy site, test from Joe's machine]** | Roster once per season; sites in schedule releases (bulk, weeks 1–3 + marquee), remainder weekly |
| foxsports.com/shows/big-noon-kickoff/about | Current BNK cast | [UNVERIFIED fetch] | Static |
| CBS: Paramount Press Express `paramountpressexpress.com/cbs-sports/` | The NFL Today roster; CBS CFB studio | [UNVERIFIED fetch; the CBS-Entertainment side fetched clean earlier for UFC 326] | Once per season (Aug) |
| NBC Sports Pressbox `nbcsportspressbox.com` | FNIA roster; NASCAR on USA studio | [UNVERIFIED fetch] | Once per season |
| Prime Video / Netflix press (aboutamazon.com, about.netflix.com) | TNF and Netflix pregame hosts | [UNVERIFIED fetch] | Once per season |
| Wikipedia "2026 NFL season", "College GameDay" | Aggregated roster changes with citations | Fetches clean; **secondary — use only to find the primary** | Continuous |

Parse strategy: press releases are prose; extract with a small Claude API call per page (the existing `research-watch` task already uses model reads) into `{show, date, site_city, site_state, anchor_game, hosts[]}` with the source URL, then diff against the registry. This is the same "watch task reads a page Joe can't script" pattern already blessed for 506sports.

**Where no fetchable source exists:** none found for the *daily* GameDay site change if ESPN announces only on social; the press release follows within ~2 days, which is inside the Wednesday watch cadence for a Saturday show. Netflix pregame hosts: no source found yet **[UNVERIFIED]**.

## 7. Betting lines — n/a for studio shows.

## 8. Assets

Show logos (GameDay, BNK, FOX NFL Sunday, The NFL Today, FNIA, MNF Countdown, TNF, NASCAR RaceDay): network press kits/Wikipedia media; treat like network marks (raw brand art on charcoal, `derive_dark_mark` for monochrome). Host headshots: not needed for v1 (names only in the tray).

## 9. Schema deltas (vs draft `programs` supertype)

- `studio_shows` registry table (or JSON in `data/`): `show_id`, `sport`, `network_id`, `weekday`, `start_et`, `duration_min`, `bookend` (pre/post), `default_on_site` bool, `studio_city`, `brand_mark`, `source_url`.
- `studio_show_instances`: `show_id`, `viewing_day`, `start_et` override, `duration_min` override, `on_site` bool, `site_city`, `site_state`, `anchor_program_id`, `hosts[]` override, `source_url`, `observed_at` — **observations**, reconciled like broadcasts, so a later press release supersedes a social-first note.
- `programs.hosts_crew[]` and `programs.anchor_program_id` as in the register draft.

## 10. Open questions for Joe

1. Does the studio card show the network's studio city when not on-site (e.g., "Los Angeles" for FOX NFL Sunday), or only when on the road? (Recommendation: road only — studio city is noise.)
2. Postgame bookends are open-ended; OK to render them as a fade block that can be pushed by the anchor's actual end?
3. FOX NFL Kickoff (11 AM) plus FOX NFL Sunday (12 PM) — one card or two? (Recommendation: two; they are different shows with different hosts.)
4. FOX Sports Press Pass fetchability must be tested from your machine before the watch task depends on it.
