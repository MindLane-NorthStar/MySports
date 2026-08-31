# MySports Research — Changelog

**Purpose:** the four league research docs and the summary were written on 2026-08-31 against sources current that day. Several load-bearing facts were *awaiting announcement* at the time of writing. This file records what changed and when, rather than editing the research docs in place — the same discipline as `canonical_decisions` in the build spec, applied to the research layer.

**Convention:** newest entries at the top. Each entry names the doc and section affected, the old claim, the new claim, and the source URL with a date.

---

## Open items being tracked

These are the things most likely to change. Each one, when it resolves, should get an entry above rather than a silent edit to the source doc.

| # | Item | Doc / section | Status as of 2026-08-31 |
|---|---|---|---|
| 1 | **Cavaliers 2026–27 local carrier** | `research-nba.md` §4, §10 Q2 | **Unannounced.** Rights reverted to the team after Main Street Sports wound down in April 2026. Season opens Oct 20. |
| 2 | **Blue Jackets 2026–27 local carrier** | `research-nhl.md` §4, §10 Q2 | **Unannounced.** NHL Productions handles production; distribution "to be announced at a later date" (July 2026). Season opens Sept 29. |
| 3 | **MLB Stats API access** | `research-mlb.md` §1, §10 Q1 | **Unresolved.** Three GETs returned HTTP 400; `statsapi.mlb.com/docs/` shows an Okta login. Cause not distinguished. |
| 4 | **NBA CDN schedule file — `broadcasters` fields** | `research-nba.md` §2, §10 Q1 | **Unverified.** Fetch refused by bot detection; a browser may behave differently. |
| 5 | **NHL API `where-to-watch` / `postal-lookup` behavior** | `research-nhl.md` §2, §10 Q1 | **Unverified.** Could not reach any `api-web.nhle.com` URL this session. Potentially the highest-value endpoints found. |
| 6 | **NFL Network in DIRECTV CHOICE** | `research-nfl.md` §4, §10 Q1 | **Sources conflict.** Also check whether it now appears inside the ESPN app, since ESPN acquired NFL Network in January 2026. |
| 7 | **MLB labor situation** | `research-mlb.md` §10 Q6; `research-summary.md` §3 | **Unverified.** CBA expires after the 2026 season; a lockout was described as expected when the 2026–28 media deals were signed. Drives the recommended build order. |
| 8 | **Warner Bros. Discovery acquisition** | `research-nhl.md` §0, §8 | **Pending as of August 2026.** TNT holds the 2027 Stanley Cup Final. A rights-holder ownership change would affect network identity and marks. |
| 9 | **NBA centralized RSN hub** | `research-nba.md` §4 | Targeted for **2027–28**. Would likely supersede whatever bridge arrangement the Cavaliers make for 2026–27. |
| 10 | **NBA TV 2026–27 game schedule** | `research-nba.md` §2 | Announced separately and later than the main national schedule. Model as late-binding. |

---

## Entries

### 2026-08-31 — Initial research batch published
Five docs written: `research-nfl.md`, `research-mlb.md`, `research-nba.md`, `research-nhl.md`, `research-summary.md`. Covers the ten-point checklist from `claude/multisport-research-brief.md` for all four leagues.

### 2026-08-31 — Correction: Cavaliers local carrier (self-corrected within the batch)
- **Doc:** `research-nba.md` §0, §4, §8, §10
- **Old claim:** Cavaliers on FanDuel Sports Network Ohio, DIRECTV channel 660, CHOICE tier — sourced from https://www.directv.com/insider/fanduel-sports-network-ohio/ (Feb 2026) and https://en.wikipedia.org/wiki/2026%E2%80%9327_Cleveland_Cavaliers_season
- **New claim:** FanDuel Sports Network Ohio is defunct. Main Street Sports Group wound down operations April 2026. Cavaliers' 2026–27 carrier is unannounced.
- **Source:** https://en.wikipedia.org/wiki/Main_Street_Sports_Group; https://awfulannouncing.com/local-networks/main-street-sports-group-shuttering-13-nba-teams-local-tv.html; https://sports.yahoo.com/articles/fanduel-sports-network-begins-process-161529707.html
- **How it was caught:** surfaced during NHL research, where the same corporate collapse is the central story.
- **Rule change earned:** RSN and local-carrier attribution needs an explicit staleness horizon in `authority_rules` — measured in weeks, not seasons — and must be re-verified at every season boundary regardless of source rank. Both sources that produced the error are the kind the authority model would rank highly.
