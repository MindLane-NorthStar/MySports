# MySports Research — Changelog

**Purpose:** the four league research docs and the summary were written on 2026-08-31 against sources current that day. Several load-bearing facts were *awaiting announcement* at the time of writing. This file records what changed and when, rather than editing the research docs in place — the same discipline as `canonical_decisions` in the build spec, applied to the research layer.

**Convention:** newest entries at the top. Each entry names the doc and section affected, the old claim, the new claim, and the source URL with a date.

---

## 2026-10-06 — NHL: the out-of-market package, NHL Network, and where the Blue Jackets air (prompt 128)

- **VERIFIED (league, NHL.com, 2026-08-26, "ESPN announces national TV schedule for 2026-27 season").**
  "NHL Power Play on the ESPN App returns with 1,050+ out-of-market games", available "with an ESPN
  Unlimited plan subscription or pay TV authentication". The same release says replays of every game on
  ABC, ESPN, NHL Network and TNT are on NHL Power Play.
  https://www.nhl.com/news/espn-announces-national-tv-schedule-for-2026-27-season
- **VERIFIED (ESPN's own page, read 2026-10-06).** "Access over 1,050+ out-of-market NHL games from every
  team, all season long. Now part of both ESPN Unlimited and Select packages. Blackouts and restrictions
  apply." https://plus.espn.com/nhl
- **REPORTED, not verified: an NHL Network game is blacked out live on ESPN+.** Broadpeak, 2023-10-03:
  "When the NHL Network has a match, ESPN+ is blacked out." idarb, 2026-08-04: replays of TNT, NHL Network
  or locally blacked-out games "are typically held back for 24 hours". No current primary source says it
  outright. Joe's ruling of 2026-10-06 (NHL Network is not on his services) settles what the app shows
  either way, and supersedes research-nhl.md's assumption that these render as available on delay.
  https://www.broadpeak.io/more-clarity-on-nhl-blackout-rules/
  https://idarb.com/2026/08/04/nhl-in-market-out-of-market-blackout-map/
- **VERIFIED (league API, 2026-10-06).** `postal-lookup` for the market's ZIP returns the Columbus Blue
  Jackets and no other club, so the Penguins are out of market for Joe and the Blue Jackets are not.
- **VERIFIED as to what the club's pages name; INFERRED as to DIRECTV.** The Blue Jackets' releases of
  2026-09-23 and 2026-09-28 name Spectrum TV, Fubo and Prime Video as carriers of Blue Jackets Hockey
  Network and say negotiations with additional cable and satellite providers continue. DIRECTV is not
  named in either. That DIRECTV does not carry it is an inference from its absence, not a statement.
  https://www.nhl.com/bluejackets/news/blue-jackets-coming-to-spectrum-tv
  https://www.nhl.com/bluejackets/news/blue-jackets-games-to-air-on-fubo
- **Joe, 2026-10-06:** the Blue Jackets' Prime Video broadcasts are an extra paid tier he does not hold.
  This reverses his 2026-09-09 ruling recorded in `data/local_rights.json`.
- **DERIVED from the league's schedule endpoint, 2026-10-06, 1,344 regular-season games:** 189 carry a US
  national row (53 ESPN or ABC, 72 TNT family, 47 ESPN+/Hulu/Disney+ exclusives, 17 NHL Network); 82 are
  Blue Jackets games with no national row; 1,073 are neither, and take the ESPN+ row. All 17 NHL Network
  games fall on or before 2026-11-01, so more will be named.
- **A limit on the quotations above.** Cowork read these pages through a fetch tool that extracts text
  with a small model. The NHL.com and ESPN lines were asked for verbatim; re-open the page before quoting
  any of them further.

## 2026-09-16 — Cavaliers OTA simulcast: the schedule is ANNOUNCED, and the outlet is per game

- **Doc:** supersedes the 2026-09-01 entry's "partner and schedule will be communicated at a later
  date" and closes that entry's **standing watch**, which asked the weekly research task to surface
  newly announced simulcast dates for hand entry.
- **Old claim:** 15 free-plus-OTA games, partner and schedule pending; WUAB 43 hand-entered on Joe's
  authority; `nba.CLE.simulcasts.games` empty.
- **New claim:** WOIO/WUAB announced the full fifteen-game schedule on 2026-09-15. **The package is
  split across two stations, which the old one-`outlet` encoding could not express: nine games on
  WOIO only, two on WUAB 43 only, four on both.** WOIO is CBS's Cleveland station, so it is NOT an
  `access_profile.json` entry — it resolves as CBS. The article describes the package as "a simulcast
  of the games available for free in front of the Cavaliers on DAZN paid subscription paywall
  offering"; Joe confirms it is the complete list, not a first tranche.
- **Source:** https://www.cleveland19.com/2026/09/15/cleveland-cavaliers-games-return-free-over-the-air-television-19-news/
  (2026-09-15). **Two corrections on Joe's authority:** the article prints "Cleveland and Phoenix" for
  February 14, which is Phoenix AT Cleveland, and "Cleveland at DC", which is WAS.
- **Encoded (prompt 104):** `data/local_rights.json → nba.CLE.simulcasts` - `outlet` moves ONTO each
  game as `outlets: [...]`, the old package-level field is kept under `superseded`, and each entry is
  `{date, opponent, side, outlets}`. **All fifteen match a loaded game today**, verified against the
  database by ET `viewing_day` + opponent id. DAL, DET and CHA each appear twice, so the tricode alone
  is not a key. Two composite marks were built for the list view, `cbs-dazn` and `cbs-wuab-43`.
- **Still open:** no broadcast row is emitted from this data yet - `adapters/nba.py` deliberately
  emits none, and how a simulcast row renders (one row or two, the access resolution for WOIO,
  preemption, the rail) is prompt 105's. The privacy gate in `docs/handoff-status.md` is Joe's to
  rule on and is untouched here.

## 2026-09-05 — Programs go live: every events & shows source probed from Joe's laptop

The eleven events & shows documents were dropped into the repo (prompt 48 stage 0) and every source
they name was fetched **once**, with the project UA, from Joe's machine. This is the pass
`docs/research/events-and-shows-handoff-2026-09-02.md` §5 asked for and could not do.

### Reachability, measured

| source | status | bytes | note |
|---|---|---|---|
| `espnpressroom.com/us/press-releases/` | **200** | 227,752 | the index; individual releases resolve from it |
| ESPN Press Room — the GameDay Week 1 release | **200** | 171,987 | carries the site, the window, the networks **and the announced nine-member 2026 crew** |
| `espnpressroom.com/us/college-gameday/` | **200** | 172,972 | its one table is a **historical January bowl table**, not the weekly Date/Site/Game table §6 described |
| `wwe.com/shows/raw`, `/smackdown`, `/events`, `/shows/snme/2026-09-06` | **200** | 417k / 428k / 227k / 135k | the "Premier Shows" block is exactly the season calendar §1 promised |
| `paramountplus.com/sneak-peak/ufc-schedule-2026/` | **200** | 175,596 | static, labelled lines, nine upcoming cards |
| `paramountpressexpress.com/cbs-sports/`, `/cbs-entertainment/releases/` | **200** | 100k / 119k | **zero** UFC/CBS sentences today |
| `indycar.com/Schedule`, `/Schedule/2026` | **200** | 361,003 / 125,231 | the ROOT page carries all 18 2026 races; the per-year page carries only the last and next |
| `site.api.espn.com` `racing/irl`, `mma/ufc`, `racing/nascar-premier` | **200** | 5,965 / 43,583 / — | **the Akamai 403 is closed from this laptop.** Prompt 47 already established the project UA gets 200 |
| `cf.nascar.com/cacher/2026/1/race_list_basic.json` | **200** | 101,874 | no allowlisting needed from here |
| `foxsports.com/presspass`, `/latest-news`, `/latest-news/weekly-schedule` | **200** | 225k / 149k / 99k | **fetch-clean but CONTENT-EMPTY** — zero tables and zero occurrences of "Big Noon" on all three, because the page is JS-rendered |
| `allelitewrestling.com/` | **200** | 1,408,338 | states both AEW slots verbatim |
| `press.wbd.com/us/` | **403 → 200** | 118 → 153,344 | the 403 was **transient**; on the retry it answered 200 and carries **no AEW content at its root** |
| `pwmania.com`, `ewrestlingnews.com` | **200** | 342k / 799k | **no monthly HBO Max schedule republished today** |
| `tbs.com`, `tntdrama.com` | **403** | — | both refuse |
| `nbcsportspressbox.com` | **DNS failure** | — | `getaddrinfo failed` from this network |
| `ufc.com/events` | **SSL CERTIFICATE_VERIFY_FAILED** | — | not a block; a certificate chain this client will not accept |
| `jayski.com/nascar-cup-series-schedule/` | **403** | — | the root `jayski.com` answers 200 |

`allelitewrestling.com`'s sub-paths returned **429** under rapid probing. Slowed down and not retried
harder, per `adapters/common.py`'s own rule about 429.

### What the sources said that the documents did not

- **cf.nascar.com publishes NAIVE EASTERN timestamps.** Every 2026 race loaded four hours early.
  Established against ESPN's `racing/nascar-premier` on six races: five agree with the Eastern
  reading to the minute, **including the Nov 8 finale, which is in EST**, so it is a wall clock and
  not a fixed offset. The **DAYTONA 500** is a one-hour SOURCE DISAGREEMENT (cf 14:30 ET, ESPN 13:30
  ET) and is recorded as one rather than chased.
- **ESPN's `racing/irl` calendar is not the race time.** `leagues[0].calendar[].startDate` runs a
  fixed **three hours later** than ESPN's own `events[].date` for the same race, on 15 of 18 entries.
  Verifying against the calendar reported all 18 IndyCar races as wrong and would have "corrected" a
  correct adapter into a season-wide three-hour error.
- **indycar.com's card time is the BROADCAST start, ESPN's is the green flag.** Four races differ,
  and two of the gaps are pre-race shows the research doc names by name ("Arlington 30 min", the
  Indy 500's "six-hour window from 10 AM"). The page wins: a TV grid draws what a viewer tunes to.
- **indycar.com lists BOTH Milwaukee races on Aug 30**, where the research doc says "Aug 29–30" and
  ESPN's calendar puts race 1 on Aug 29. Recorded, not reconciled.
- **The wwe.com dual listing is real.** Oct 10 and Nov 28 each appear TWICE in the Premier Shows
  block — once on "ESPN with the Unlimited Plan" and once on "Netflix" — exactly as
  `docs/research/wwe.md` §2 flagged. ESPN Unlimited only is loaded.
- **The Paramount+ page has gained a card** since the research was written: Oct 10, Allen vs. Duncan.
  Nine upcoming, where the doc listed eight.
- **No 2026 UFC card flags a CBS simulcast**, and the page says so outright on the Sept 5 card.

### Runner-side findings (dispatched run 33994233255, `refresh` job green)

- The **moved-twin guard fired on all 98 NASCAR races** and logged
  `MOVED-TWIN SKIPPED 98 row(s)`. Without it that step would have inserted 98 second copies of the
  2026 season, because the corrected time is a different natural key.
- IndyCar 18, WWE 36, AEW 35, UFC 9, studio 109 — all loaded, all `access: available`, no fetch or
  load failure on any of the six new steps.
- **AEW logged no DRIFT line**, so allelitewrestling.com still agrees with the slot file.
- **No ESPN 403 on the runner**, consistent with prompt 47.

### Watch-task additions this pass justifies

- **The WBD monthly HBO Max schedule.** It is the only authority for Collision's night and network
  and was unreachable in every form tried. AEW is on the slot default until it is found.
- **Big Noon Kickoff's site and crew.** FOX Press Pass is JS-rendered; a human read is the only path.
- **The weekly GameDay release.** One release is one week; the site is `tba` for every week whose
  release is not recorded.
- **The wwe.com dual listing**, from a U.S.-specific WWE or ESPN release.
- **UFC segment times** (ufc.com or ESPN `mma/ufc`) and **the CBS window** (Press Express), neither of
  which had anything to give today.


## 2026-09-02 — Design session: icon v6, league/program marks, banner + navbar
- **Deliverables filed:** `docs/design/banner.md` (composition, mark classes, contrast rulings), `docs/design/banner/` (the two static reference SVGs, the CSS, the navbar markup), `web/lib/banner-layout.json` (both breakpoints), `scripts/build_brand_marks.py` (rebuilds all three mark classes; `--check` diffs against what is committed).
- **App icon:** v6-B chosen, shipped as `web/public/brand/app-icon-mysports-tv.png` (1024). v5 and v6-A retired/rejected, kept untracked under `assets/brand/`.
- **New art:** 10 leagues x raw + `_dark` at 256px (`web/public/leagues/`), 2 programs at 128px (`web/public/programs/`), the 700px TV cutout (`web/public/brand/`). Sources stay untracked under `assets/`, matching the network suite's split.
- **Program `hf` is normalized against the FROZEN NETWORK TARGET (11734), read from `web/public/marks/manifest.json` and never recomputed** — a program logo sits beside network marks, so it must weigh what they weigh; normalizing the two programs against each other would have made them weigh the same as each other instead. The network manifest is not written by the program build.
- **Two league recipes are not a plain PNG:** NASCAR builds from `nascar.svg`; IndyCar keys white off its JPEG by flooding inward from the border (a global brightness test also deletes the white *inside* the badge), and its dark variant whitens only the wordmark rows below the badge gap.
- **Three contrast rulings (NHL / ESPN / ABC):** lift a mark only when its darkness is an accident, never when it is the design. NHL reads by its rim; ESPN's colour is its identity; ABC's black is background, and `dark_ready` would invert it into the white plate the no-plate rule forbids.
- **Web:** home `/` gets `<Banner/>` (server component, inline SVG per breakpoint, drawn from the layout JSON); `/weeks` and `/history` get `<NavBanner/>`. Wordmark is now `MYSPORTS TV`; the old masthead is retired; `metadata.title` is `MySports TV`.
- **Known miss:** `build_brand_marks.py --check` reports 22/23 PASS. `programs/big-noon-kickoff.png` as committed carries ~1.1% more ink than a faithful re-rasterization of its SVG at any height (converges to 10490 by 3072px against 10609 shipped), so the chain that produced it could not be recovered. Dimensions match, so the banner layout is unaffected; the committed file was left alone rather than widening the check's 1% tolerance to hide it.

## 2026-09-02 — Brief 2: Events & Shows (Chat architecture session)
- **Requests recorded** (enhancement-register.md): NASCAR (3 series), UFC, IndyCar, WWE, AEW, studio/pregame shows.
- **Decisions (Joe):** programs supertype approved; individual sport chips; race only; UFC one card + segment timeline; purchasable content excluded (AEW PPV out); studio = pre/post bookends; hosts/locations sourced not curated; one nascar sport + series; WWE = Raw/SmackDown/PLEs, NXT out; design pass option (a) prototype-first; UFC/NASCAR odds under show_odds.
- **Correction logged:** register initially re-flagged the §21 betting-lines contradiction; it was resolved 08-31 (`show_odds`) and odds already render (prompt 13). Failure mode: memory carried a stale open item past its resolution. Rule: check handoff-status "SIX DECISIONS" before re-raising any decision.
- **Verified fetch-clean sources:** espnpressroom.com (GameDay site table), wwe.com (Drupal; Premier Shows block = calendar), paramountplus.com Sneak Peak UFC schedule (static WP), paramountpressexpress.com (CBS windows), indycar.com (season table). **JS-blank:** espn.com stories, nascar.com schedule pages.
- **Rights verified:** UFC P+ exclusive through 2033 + CBS partial windows; WWE Raw Netflix / SmackDown USA (3h) / PLEs ESPN Unlimited / SNME Peacock; AEW Dynamite TBS+HBO Max, Collision TNT+HBO Max (volatile), PPV $39.99 purchase; NASCAR Cup FOX→Prime→TNT→USA/NBC(+Peacock ×4), O'Reilly CW, Truck FS1 (2 FOX); IndyCar all FOX.
- **New standing gotcha:** ESPN `site.api.espn.com` returned Akamai 403 for ALL endpoints (incl. NFL) from the cloud workspace 09-02. Verify Actions runner; consider browser UA in adapters/espn.py.
- **Watch-task additions proposed:** GameDay/Big Noon site releases (weekly); AEW monthly WBD schedule + mid-month moves; WWE PLE carriage confirmation; NASCAR postponements.
- **Deliverables:** research-studio-shows.md, research-wwe.md, research-aew.md, research-ufc.md, research-nascar.md, research-indycar.md, research-summary-2.md, research-brief-2-events-and-shows.md, enhancement-register.md (v0.1 + decisions §7–§9).

### 2026-09-01 (evening) — Tier 1 refresh: CBJ still TBA (Prime Video is a REPORT), Cavs OTA partner resolution, Guardians/ESPN 2027, NFL Wk1, ESPN Unlimited price
Full entries with sources: `claude/research-refresh-2026-09-01.md` in the claude.ai project (parallel research session). The load-bearing points:
- **CBJ (Entry 1):** no carrier announced as of 2026-09-01; `TBA_NO_RIGHTS_HOLDER` holds. SBJ (08-31) REPORTS the four NHL-Productions clubs "could" join the Stars on Prime Video — the NHL declined comment; RUMOR until the club or league names a platform. Firmed up: NHL Productions produces (07-21 release), all games are TV/radio simulcasts with Mears/Shelley (07-29 release; crew known before carrier), several CBJ start times changed ~08-24 (the reconciler's kickoff supersession is the check). Watch daily until the Oct 1 opener. If Prime proves true, expect TWO local rows (streaming + a linear partner) per the Kraken/Hurricanes shape.
- **Cavs OTA simulcast (Entry 2):** the 09-01 release confirms DAZN/RESN/pricing and 15 free-plus-OTA games but says partner and schedule "will be communicated at a later date"; no public source names WUAB 43 for 2026-27 (prior seasons only). **Steward resolution after review with Joe (2026-09-01): the WUAB 43 encoding STANDS as hand-entered data on Joe's authority — the hand-entry channel is the designed authority for local carriage (`hand_entered`, score 90). The public announcement remains a watch item, and no WUAB row is emitted until dated simulcast games are hand-entered (none yet).** The research session's demote recommendation is preserved in the project doc for the record.
- **Guardians (Entry 3):** 2026 on MLB Local Media (CLEGuardians.TV DTC, no in-market blackout; WKYC 10 free simulcasts; 2025 pay-TV list incl. DIRECTV 662). ESPN holds exclusive local in-market STREAMING rights for the MLB-produced clubs from its 2026-06-08 agreement — the likely 2027 shape is CLEGuardians.TV inside the ESPN App; whether DIRECTV's ESPN Unlimited entitlement covers it is OPEN and decides the 2027 local-row access. Model 2027 as needs-verification.
- **NFL Wk1 (Entry 4):** SNF DAL@NYG 8:20 NBC and MNF DEN@KC 8:15 ESPN confirmed; kickoff is WEDNESDAY Sept 9 NE@SEA (NBC/Peacock) and Thursday Sept 10 SF-LAR on NETFLIX from Melbourne — verify the `--week 1` fixture window includes Wed/Thu games. No flex mechanism before Week 5.
- **Access (Entry 5):** ESPN Unlimited $29.99→$31.99/mo on 2026-09-17 (cost note only); NBA national packaging unchanged (ESPN App/Peacock/Prime; NBA TV schedule TBA — expect a few NBA-TV-only games in Around the League). OPEN: NBCSN (relaunched) appears as an NBA/MLB outlet in league materials — DIRECTV CHOICE carriage unresearched; decide whether it needs an access row.

### 2026-09-01 — Cavaliers: DAZN CONFIRMED (team press release); RESN production; 15 OTA simulcasts on WUAB 43
- **Doc:** `research-nba.md` §4, §10 Q2 (supersedes the 2026-08-31 "reported, nothing announced" entry)
- **Old claim:** carrier unannounced; SBJ/Hoops Rumors "linked"/"expected" DAZN.
- **New claim:** the Cavaliers announced a multi-year partnership with DAZN starting with the 2026-27 season, preseason included: DAZN streams every regular-season game not selected exclusively for national broadcast (ESPN/ABC, NBC/Peacock, Prime Video), production moves in-house to Rock Entertainment Sports Network (RESN, master portal brand), and 15 games per season are free on DAZN and simulcast over the air; the simulcast partner and schedule "will be communicated at a later date" — Joe identifies the OTA partner as WUAB 43. Subscriptions $19.99–$24.99/month or $119.99–$139.99/year. On-air team unchanged (John Michael, Brad Daugherty, Serena Winters, Cayleigh Griffin).
- **Sources:** team press release 2026-09-01 (cavs.com/dazn, dazn.com/cavaliers), supplied by Joe.
- **Product decision 7 (Joe, 2026-09-01):** model DAZN as *available* — he is subscribing (Apple TV pattern, decision 4). Encoded in `data/access_profile.json`, `data/local_rights.json` (nba.CLE status CONFIRMED → outlet DAZN, surface web, label "Cavaliers on DAZN (RESN)"; `simulcasts` block for WUAB 43 with hand-entered games matched by ET date + opponent tricode), `data/row_order.json` (nba: DAZN heads the streaming lanes; WUAB 43 joins the broadcast rail without station keys so the call-letters band is suppressed; station order rule WOIO 19 → WUAB 43 → WBNX 55), `adapters/nba.py` (CONFIRMED carrier row + simulcast rows in both sources), rail-tile marks `assets/network-logos/{dazn,wuab-43}.png` composed by `scripts/make_lockups.py` (RESN | DAZN side by side; Cleveland's 43 over an equal-width RESN | DAZN row — layouts approved by Joe against true-size previews).
- **Standing watch:** the weekly research task must check cavs.com/dazn and RESN/WUAB announcements for newly announced simulcast dates and surface them for hand entry into `local_rights.json → nba.CLE.simulcasts.games` (entries `{"date": "YYYY-MM-DD", "opponent": "TRICODE"}`). CBJ remains TBA_NO_RIGHTS_HOLDER — unchanged.

## Open items being tracked

These are the things most likely to change. Each one, when it resolves, should get an entry above rather than a silent edit to the source doc.

| # | Item | Doc / section | Status as of 2026-08-31 (evening, Tier 1 pass) |
|---|---|---|---|
| 1 | **Cavaliers 2026–27 local carrier** | `research-nba.md` §4, §10 Q2 | **Still unannounced.** SBJ (via Akron Beacon Journal, Jul 29) links the rights to DAZN; Hoops Rumors (Jul) says DAZN is *expected* to stream at least seven teams' local games. Nothing signed or announced by the team as of Aug 31. The league's own schedule file shows CLE with no local TV broadcaster — but so do 28 of 30 teams (see entry below), so that field is not evidence either way. Season opens Oct 22 at PHI (ESPN). |
| 2 | **Blue Jackets 2026–27 local carrier** | `research-nhl.md` §4, §10 Q2 | **Still unannounced.** Club confirmed Jul 30 that TV and radio will be one simulcast feed (Mears/Shelley) and that "television distribution plans have not yet been finalized." Sports Media Watch's CBJ page (updated Aug 30) reads "Local broadcasts TBD." NHL API shows zero H/A market rows for CBJ. **First regular-season game is Oct 1 vs BUF** (the Sept 29 date in the research is the league opener, not Columbus's). |
| 3 | **MLB Stats API access** | `research-mlb.md` §1, §10 Q1 | **RESOLVED — OPEN.** See entry. |
| 4 | **NBA CDN schedule file — `broadcasters` fields** | `research-nba.md` §2, §10 Q1 | **RESOLVED — loads, has broadcasters, but local TV is late-binding.** See entry. |
| 5 | **NHL API `where-to-watch` / `postal-lookup` behavior** | `research-nhl.md` §2, §10 Q1 | **PARTIALLY RESOLVED.** `postal-lookup` works and is a territory map, not a carriage resolver; `where-to-watch` 404s at every path tried. See entry. |
| 6 | **NFL Network in DIRECTV CHOICE** | `research-nfl.md` §4, §10 Q1 | Sources conflict. Joe to confirm (Tier 3 Q12). Unchanged. |
| 7 | **MLB labor situation** | `research-mlb.md` §10 Q6; `research-summary.md` §3 | Unverified. Not checked in this pass. |
| 8 | **Warner Bros. Discovery acquisition** | `research-nhl.md` §0, §8 | Pending as of August 2026. Not checked in this pass. |
| 9 | **NBA centralized RSN hub** | `research-nba.md` §4 | Targeted for 2027–28. Unchanged. |
| 10 | **NBA TV 2026–27 game schedule** | `research-nba.md` §2 | The league file carries 66 national games labeled `TBD` (broadcaster not yet assigned) — consistent with NBA TV/late-assigned windows. Model as late-binding. |
| 11 | **NBA local TV fields populate late** *(new)* | `research-nba.md` §2 | As of Aug 31 only BKN (`DAZN (YES)`) and MIA (`WPLG Local 10`) have local TV rows in the league file. Re-check weekly through October; the fill date is itself a finding worth recording. |
| 12 | **NHL local TV fields populate late** *(new)* | `research-nhl.md` §2 | Frozen Frenzy (Oct 13): 14 of 16 games have an empty `tvBroadcasts` array, including markets with settled RSNs (NYR, PHI, PIT). Same re-check cadence as #11. |

---

## Entries

### 2026-08-31 (evening) — Tier 1 check: MLB Stats API is OPEN, with broadcasts
- **Doc:** `research-mlb.md` §1, §10 Q1; `research-summary.md` §2 (MLB biggest risk)
- **Old claim:** three GETs to `statsapi.mlb.com/api/v1/schedule` returned HTTP 400 and the docs site shows an Okta login; access unresolved.
- **New claim:** `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-09-01&hydrate=broadcasts(all)` returns JSON beginning `"copyright"`, 15 games, and every game carries a `broadcasts` array with `name, type, language, isNational, callSign, homeAway, availability, mediaState, freeGame, availableForStreaming, mvpdAuthRequired, freeGameStatus` and more. The Guardians–Blue Jays game lists **"Guardians.TV Presented by Progressive" (TV)** and **WTAM 1100** (radio).
- **Consequence:** MLB keeps its structural advantage — the only league with a true `/games/media` equivalent, and the DTC product (Guardians.TV) is already a first-class broadcast row with a `homeAway` side. The Aug 31 400s were most likely a transient or a malformed query, not gating. **The MLB "binary risk" in `research-summary.md` §2 resolves to the good branch.**
- **Source:** the endpoint itself, fetched 2026-08-31 ≈ 7:00 PM ET.

### 2026-08-31 (evening) — Tier 1 check: NBA CDN schedule file loads (from nba.com only) and carries broadcasters
- **Doc:** `research-nba.md` §2, §10 Q1
- **Old claim:** fetch refused by bot detection; `broadcasters` presence unverified.
- **New claim:** `https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json` is Akamai-blocked when requested directly (403 "Access Denied" from a bare browser tab too), but loads (HTTP 200, 4.2 MB) when fetched from a page on `nba.com` — i.e., it needs a same-site Referer/Origin. Contents: `seasonYear 2026-27`, 1,273 games (pre + regular), 25 week names, per-game `broadcasters` with nine arrays: `nationalBroadcasters, nationalRadioBroadcasters, nationalOttBroadcasters, homeTvBroadcasters, homeRadioBroadcasters, homeOttBroadcasters, awayTvBroadcasters, awayRadioBroadcasters, awayOttBroadcasters`. Each entry has `broadcasterScope (natl/home/away), broadcasterMedia (tv/radio/ott), broadcasterId, broadcasterDisplay, broadcasterAbbreviation, broadcasterVideoLink, broadcasterTeamId`. National tallies for the regular season: Peacock 99, NBC 69, Prime Video 67, ESPN 62, NBC Sports Network 30, ABC 21, Telemundo 10, **TBD 66**. Seven games have a TBD tip time. Christmas Day is five straight ABC/ESPN games (SAS@NYK 12:00, MIA@BOS 2:30, PHI@LAL 5:00, OKC@MIN 8:00, DEN@GSW 10:30 ET) as the research predicted.
- **Caveat that matters:** `gameTimeEst` is a time-only field carried on a dummy date (`1900-01-01T12:00:00Z`); use `gameDateTimeEst`/`gameDateTimeUTC` for placement.
- **Consequence for the adapter:** fetch with a `Referer: https://www.nba.com/schedule` header (or through a headless page on nba.com). Local TV rows are **late-binding** — see next entry — so a missing `homeTvBroadcasters` must map to `carriage_certainty = UNANNOUNCED`, never to "no local telecast."
- **Source:** the file itself, fetched via the desktop browser pane from `nba.com/schedule` 2026-08-31 ≈ 7:05 PM ET.

### 2026-08-31 (evening) — Finding: league schedule files do not carry local TV yet (NBA and NHL)
- **Doc:** `research-nba.md` §2, §4; `research-nhl.md` §2, §4; `research-summary.md` §1.1
- **Claim:** In the NBA file, 28 of 30 teams have **no** `homeTvBroadcasters`/`awayTvBroadcasters` rows for any regular-season game; only BKN (`DAZN (YES)`, 79 games) and MIA (`WPLG Local 10`, 66 games) are populated. In the NHL API, 14 of 16 Frozen Frenzy games (Oct 13) have an empty `tvBroadcasts` array, and CBJ's full-season schedule has H/A market rows for zero games (national rows only: ESPN+, Hulu, Disney+ once each).
- **Why it matters:** this reframes the Cavaliers/Blue Jackets "no carrier" finding. The empty fields are the league files' normal August state, not confirmation that no deal exists. The two Ohio teams are still unannounced per the press (entries above), but the *data* can't tell us that yet for anyone. **The `TBA` distributor state recommended in `research-summary.md` §1.1 is therefore needed for every team in August, not just Cleveland and Columbus** — and the ingest must record the date each team's local rows first appear.
- **Note on the BKN row:** `DAZN (YES)` suggests the YES Network is being distributed through DAZN in 2026–27. That is consistent with the July reports of DAZN as an aggregator for orphaned RSNs and is worth a line in `research-nba.md` §4 when the picture firms up.
- **Source:** same fetches as above.

### 2026-08-31 (evening) — Tier 1 check: NHL API is up; `postal-lookup` is a territory map; `where-to-watch` not found
- **Doc:** `research-nhl.md` §2, §10 Q1
- **Old claim:** could not reach any `api-web.nhle.com` URL; `where-to-watch` and `postal-lookup` potentially the highest-value endpoints in the batch.
- **New claim:** `https://api-web.nhle.com/v1/schedule/2026-10-13` returns 16 games with keys `id, season, gameType, venue, neutralSite, startTimeUTC, easternUTCOffset, venueUTCOffset, venueTimezone, gameState, gameScheduleState, tvBroadcasts[], awayTeam, homeTeam, periodDescriptor, ticketsLink, gameCenterLink`; `tvBroadcasts` entries are `{id, market (H/A/N), countryCode, network, sequenceNumber}`. Frozen Frenzy staggering (15-minute starts 6:00 PM–11:00 PM ET) is fully encoded — the `whip_around` entity can be built from real data now. `https://api-web.nhle.com/v1/postal-lookup/44101` returns `[{stateProvince: "OH", networkType: "Outer", county: "Cuyahoga", teamName: {default: "Pittsburgh Penguins"}}, {… "Columbus Blue Jackets" …}]` — Cleveland is in the **outer** broadcast territory of both PIT and CBJ. No broadcaster names, no team IDs, no blackout dates. `where-to-watch` returns 404 at `/v1/where-to-watch` and `/v1/where-to-watch?include=all`.
- **Consequence:** `postal-lookup` is exactly the territory half of `market_coverage` for the NHL (in-market vs out-of-market by ZIP), which is what drives NHL Power Play blackouts. It does **not** name a carrier, so it retires the *territory* lookup but not the *carriage* lookup. `where-to-watch` should be dropped from the plan unless a working path turns up.
- **Source:** the endpoints, fetched 2026-08-31 ≈ 7:00 PM ET. The full-season CBJ tally came through a summarizing fetch and its game count (43 regular) is almost certainly truncated; re-count with a raw fetch before citing.

### 2026-08-31 (evening) — Blue Jackets: TV/radio simulcast confirmed, distributor still unnamed; opener is Oct 1
- **Doc:** `research-nhl.md` §4, §10 Q2; `research-summary.md` §2
- **Old claim:** season starts September 29; distributor "to be announced."
- **New claim:** Sports Video Group (Jul 30, 2026): all games will be simulcast across TV and radio with one feed (Steve Mears PxP, Jody Shelley analyst, Dylan Tyrer host); "Television distribution plans have not yet been finalized." Sports Media Watch's CBJ page, updated Aug 30, 2026: "Local broadcasts TBD." The club's **first regular-season game is Oct 1 vs Buffalo** (Oct 3 vs Utah, Oct 9 vs Pittsburgh, Oct 10 at St. Louis, Oct 13 at Florida). Sept 29 is the league's opening night, not Columbus's.
- **Sources:** https://www.sportsvideo.org/2026/07/30/columbus-blue-jackets-to-simulcast-tv-and-radio-broadcasts-beginning-2026-27/ ; https://www.sportsmediawatch.com/tv-schedules/nhl-tv-schedule/columbus-blue-jackets/ ; the nhl.com article URL in the research now 404s (site restructure) — do not cite it.

### 2026-08-31 (evening) — Cavaliers: DAZN reported, nothing announced; opener Oct 22 at PHI
- **Doc:** `research-nba.md` §4, §10 Q2
- **Old claim:** carrier unannounced; check nba.com/cavaliers/news or Crain's.
- **New claim:** still unannounced. Sports Business Journal (relayed by Akron Beacon Journal/Yahoo, Jul 29, 2026) "linked" the Cavaliers' local rights to DAZN alongside MEM, SAS, IND and MIN; Hoops Rumors (Jul 2026) reports DAZN *expected* to stream local broadcasts for at least seven teams. The team's Aug 13 schedule release lists national games only (4 NBC/Peacock, 4 Peacock-exclusive, 6 ESPN, 3 Prime Video; 17 national in total) and Yahoo notes "no word on local TV/streaming." Opener: Oct 22 at Philadelphia on ESPN.
- **Sources:** https://sports.yahoo.com/articles/report-links-cavaliers-local-tv-185044010.html ; https://www.hoopsrumors.com/2026/07/dazn-expected-to-stream-local-broadcasts-for-at-least-seven-nba-teams-in-2026-27.html ; https://sports.yahoo.com/articles/cavs-schedule-17-national-tv-192004850.html ; https://www.wfmj.com/sports/local-sports/cleveland-cavaliers-announce-2026-27-schedule/article_b585d9c0-2ce9-4c00-a463-0b822e8a100f.html

### 2026-08-31 — Initial research batch published
Five docs written: `research-nfl.md`, `research-mlb.md`, `research-nba.md`, `research-nhl.md`, `research-summary.md`. Covers the ten-point checklist from `claude/multisport-research-brief.md` for all four leagues.

### 2026-08-31 — Correction: Cavaliers local carrier (self-corrected within the batch)
- **Doc:** `research-nba.md` §0, §4, §8, §10
- **Old claim:** Cavaliers on FanDuel Sports Network Ohio, DIRECTV channel 660, CHOICE tier — sourced from https://www.directv.com/insider/fanduel-sports-network-ohio/ (Feb 2026) and https://en.wikipedia.org/wiki/2026%E2%80%9327_Cleveland_Cavaliers_season
- **New claim:** FanDuel Sports Network Ohio is defunct. Main Street Sports Group wound down operations April 2026. Cavaliers' 2026–27 carrier is unannounced.
- **Source:** https://en.wikipedia.org/wiki/Main_Street_Sports_Group; https://awfulannouncing.com/local-networks/main-street-sports-group-shuttering-13-nba-teams-local-tv.html; https://sports.yahoo.com/articles/fanduel-sports-network-begins-process-161529707.html
- **How it was caught:** surfaced during NHL research, where the same corporate collapse is the central story.
- **Rule change earned:** RSN and local-carrier attribution needs an explicit staleness horizon in `authority_rules` — measured in weeks, not seasons — and must be re-verified at every season boundary regardless of source rank. Both sources that produced the error are the kind the authority model would rank highly.

## 2026-09-05 — source reachability, verified live (prompt 47 stage 0)

Every probe below is one real fetch from this laptop with the project User-Agent from
`adapters/common.py`, unless the row says otherwise.

| source | status | bytes |
|---|---|---|
| `cf.nascar.com/cacher/2026/{1,2,3}/race_list_basic.json` | **200 / 200 / 200** | 101,874 / 77,452 / 60,847 |
| ESPN `racing/nascar-premier` scoreboard | **200** | 11,581 |
| ESPN `racing/irl` scoreboard | **200** | 5,965 |
| ESPN `mma/ufc` scoreboard | **200** | 39,736 |
| ESPN core API, NHL + NBA 2026-27 regular-season bounds | **200** | — |
| `api-web.nhle.com/v1/schedule/…` | **intermittent** — 200 on ~2 of 6, TLS reset otherwise; UA-independent | — |
| `indycar.com/Schedule` | **200** | 362,110 |
| `espnpressroom.com/us/` | **200** | 169,814 |
| `foxsports.com/presspass/` | **200** | 225,632 |
| `paramountplus.com` | **200** | 404,949 |
| `paramountpressexpress.com` | **200** | 68,294 |
| `wwe.com/schedule` | **404** | — |
| `allelitewrestling.com/aew-schedule` | **404** | — |
| `press.wbd.com/us/` | **403** | — |

**The ESPN 403 in prompt 46's report was a User-Agent artifact, not Akamai.** Same URL, same second,
three UAs: the project UA returned **200**, no UA returned **200**, and the ad-hoc
`MySportsTV/0.2 (+https://my-sports-xi.vercel.app; contact …)` that prompt 46 invented for its probe
returned **403**. Register §6's standing rule — never send a browser UA to ESPN — is unaffected and
still right; what is corrected is the claim that the laptop itself is blocked. It is not.

**No 403s on the GitHub runner either**, across ~371 ESPN and NHL date fetches in
`bootstrap_season` run 33981953084.

**The three 404/403 rows are not conclusions about those sources.** They are the obvious paths, tried
without the verified deep URLs, because `research-wwe.md`, `research-aew.md` and the WBD schedule URL
they cite are not in this repository. They say nothing about whether the real endpoints are
fetch-clean.
