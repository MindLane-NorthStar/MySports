# Prompt 132: four access rulings, the Blue Jackets' WUAB 43 simulcasts, and the Sunday-windows smoke check

Written by Cowork on 2026-11-16 from three sources: a read of the public tree at `e0c303f` (= `origin/main` after prompt 131's three commits), read-only SELECTs against `mysports` (2026-11-14 and 2026-11-16), and Joe's rulings in conversation, quoted and dated below. **Verify every file:line before acting on it.** Save this brief as `docs/prompts/132-rulings-cbj-wuab-ota-and-windows-smoke.md`.

**Stop and report if any of these fails:**

- `git rev-parse HEAD` equals `git rev-parse origin/main`, and both are `e0c303f`.
- `git status --porcelain` shows only untracked `assets/` entries.

**Commits: run all five gates once on the final tree, report them, and leave the work in the tree. Do not commit or push.** Joe approves the commit after reading the report. **This run is expected to end with all five gates green** — it clears both data reds that prompt 131 shipped over under the recorded one-time S4 override (handoff-status). If any gate is still red at the end, that is a finding to report, not a reason for another override.

---

## Context

Prompt 131 pushed on 2026-11-16 over two data reds: smoke 33/35 (checks f and h) and geometry (the 2026-09-03 MLB span). Both were measured as pre-existing on the previous HEAD. This prompt carries the rulings that clear them, plus two additions Joe asked for on 2026-11-16: the Blue Jackets' over-the-air simulcasts on WUAB 43, and the Sunday-windows smoke check that 131's step A4 named and did not build.

---

## Block A: four access rulings

### A1. `dazn-cle` is available — Joe, 2026-11-14: "I have DAZN via DirecTV - i get all games on DAZN"

- **The measurement (read 2026-11-14):** 11 active `game_broadcasts` rows on service `dazn-cle` ("DAZN CLE"), every one a Cavaliers game, 2026-10-24 through 2026-11-20, several `is_primary`, all `access_status = 'unknown'`. Smoke (h) (`web/scripts/smoke.mjs:289-317`) is red on the ones inside its 7-day window.
- **The ruling is already half-recorded:** `data/local_rights.json` `nba.CLE` carries decision 7 — "Joe 2026-09-01: treat DAZN as AVAILABLE (subscribing)". `dazn-cle` is a new feed spelling of the same thing. Follow the spelling-ruling precedent of commit `d646d20` ("acc extra" → accnx): map the spelling so its rows classify available, wherever that mechanism lives. Verify whether `DAZN` is in `data/access_profile.json`'s `available` list and keep the mechanism consistent with how the plain `dazn` service already classifies.
- **Scope guard:** `dazn-cle` only. The sibling services `dazn-yes`, `dazn-mem`, `dazn-ind`, `dazn-min`, `dazn-sas` are other markets' in-market products, already ruled, and out of scope.
- **Tests:** a `dazn-cle` row classifies available; a `dazn-mem` row does not change. **Mutation, red:** the spelling mapping removed.

### A2. The Blue Jackets' channel is available — Joe, 2026-11-16: "yes i get bluejackets too"

- **This supersedes a recorded ruling — do not treat it as drift.** `data/access_profile.json`'s `_about` records Joe's 2026-10-14 ruling (prompt 129, register §74): CBJNHL and CBJHN are not on his services ("Blue Jackets NOT AVAILABLE"). That ruling predates the fact that changed it: on **2026-10-24** the NHL and DirecTV announced a multiyear deal putting the Blue Jackets Hockey Network on DirecTV (channel 660 streaming, 660-1 satellite, Choice package or higher), and Joe's provider is **DIRECTV CHOICE** (same `_about`). Joe confirmed on 2026-11-16 that he receives it.
- **Do:** move `CBJNHL` and `CBJHN` to available in `data/access_profile.json`, updating the `_about` note to record the supersession with Joe's date and the 10-24 deal. Update the `nhl.CBJ` narrative in `data/local_rights.json` the same way.
- **Unchanged, on purpose:** the CBJ **Prime Video** row stays UNAVAILABLE — Joe's 2026-10-06 decision (extra paid tier) stands; he watches through the DirecTV channel, not Prime. The already-available `cbj-local` row: verify what it is before touching anything, and leave it as it stands.
- **Also rule `wwho`** (read 2026-11-14: one `unknown` row, WWHO on the 11-12 TBL @ CBJ game): WWHO is CW Columbus, not receivable in Cleveland — **out_of_market**.
- **The measurement (read 2026-11-14):** CBJ games through 11-19 carry `cbjhn`/`cbjnhl` unavailable with Prime Video primary; from 11-21 they carry `cbjnhl` primary at `unknown` plus `cbj-local` available. After this block, verify in a dry read that a CBJ game resolves to an available channel row.
- **Tests:** a `cbjnhl` row classifies available; the CBJ Prime Video row stays unavailable; a `wwho` row classifies out_of_market. **Mutation, red:** the CBJNHL/CBJHN availability reverted.

### A3. `eradm` — decode first, then rule; do not rule it blind

- **The measurement (read 2026-11-14):** 26+ active `eradm` ("ERADM", typed linear_cable) rows since 2026-09-05, every one `feed_side = 'NATIONAL'`, mostly non-primary, spanning marquee CFB (ALA @ LSU, UGA @ MISS, TEX @ LSU) and NBA (PHI @ CLE 11-06 **primary**, GSW @ SAS 11-13 primary). The pattern reads like a national radio feed — **INFERRED, not a ruling.** It aged out of smoke (h)'s current window but will return.
- **Step 1, decode:** fetch the raw ESPN media entry for one carrying game (CFB `401856885` TEX @ LSU or NBA `nba-401909302` GSW @ SAS) and report verbatim what ERADM is.
- **Step 2, rule per the decode:** if it is a radio feed, handle it the way the codebase already handles non-TV feeds — check for an existing radio precedent before inventing one; exclusion at the adapter or a named entry with reason on smoke (h)'s list (`smoke.mjs:294-295` says every name carries its reason) are the two shapes to choose between. If the decode says it is anything other than radio, **stop and report before encoding** — Joe rules on what it actually is.
- **Tests:** per the chosen mechanism, with one mutation red.

### A4. "TB/CLE" is a placeholder — clears smoke (f)

- **The measurement (read 2026-11-14):** team `mlb-21` has `canonical_name`, `short_name`, and `abbreviation` all exactly "TB/CLE". Smoke (f) is red because `web/lib/placeholders.js` (prompt 114 rev B, Joe's 2026-09-23 ruling, per the header comment at `smoke.mjs:227`) does not recognize the slash spelling.
- **Do:** extend `isPlaceholderTeam` to recognize the slash form — two team abbreviations joined by `/` — as a placeholder, with a `placeholderReason` naming it. Keep the rule narrow: two all-caps tokens of 2-3 letters around one slash, not any string containing a slash.
- **Tests:** "TB/CLE" is a placeholder; a real name containing a slash-free spelling is untouched; smoke (f) green. **Mutation, red:** the slash rule removed.

---

## Block B: the Blue Jackets' ten WUAB 43 simulcasts — Joe, 2026-11-16: "select Bluejackets games are available on WUAB 43 in Cleveland - these should surface in MySportsTV and show WUAB 43 as the broadcaster"

- **The slate (team announcement, 2026-11-02, nhl.com/bluejackets/news/cbj-on-cw — "Cleveland (WUAB, MyNet, 43.1)"):** ten BJHN games simulcast over the air, all 7:00 PM ET except Feb 8 at 7:30:

  | # | Date | Game |
  |---|---|---|
  | 1 | Thu 2026-11-05 | vs DAL |
  | 2 | Thu 2026-11-12 | vs TBL |
  | 3 | Mon 2026-11-30 | at PIT |
  | 4 | Mon 2026-12-07 | at TBL |
  | 5 | Thu 2027-01-07 | at NJD |
  | 6 | Thu 2027-01-21 | vs CGY |
  | 7 | Mon 2027-02-08 | at TOR (7:30) |
  | 8 | Thu 2027-02-11 | vs OTT |
  | 9 | Mon 2027-03-01 | vs CAR |
  | 10 | Mon 2027-03-22 | at PIT |

  Encode **all ten, the two past games included**, so the archive reads true when the 11-01/11-08-style backfills reach those dates.
- **The pattern to follow is the Cavaliers', not a new invention.** `adapters/nba.py:90-110` (`_simulcast_rows`, prompt 106, Joe 2026-09-16: one row per outlet; the label keeps the station) reads the hand-entered `simulcasts` block in `data/local_rights.json` `nba.CLE`. The NHL adapter reads `local_rights.json` carriage at `adapters/nhl.py:246` but **verify whether it has any simulcast mechanism** — if not, port the NBA pattern rather than widening it in place. Add a `simulcasts` block under `nhl.CBJ` with the ten dated games, hand-entered, sourced to the team announcement with its date, matching the structure `nba.CLE.simulcasts` uses.
- **The station is an existing network, not a new one.** `wuab-43` already has marks and plumbing (`web/lib/marks.js`, `web/public/marks/manifest.json`, `scripts/build_web_marks.py`). Verify the exact service id in `networks_services` (register §76-era data shows "WUAB-only games use the existing `wuab-43`") and point the rows at it. Access: **available** — it is a free over-the-air channel already in the access profile's world. The card shows WUAB 43 as the broadcaster, exactly as the Cavaliers' OTA cards do.
- **Matching:** match the ten games by date and opponent against the schedule rows already in the database, report the matched game ids, and **stop and report if any of the ten fails to match exactly one game**.
- **Tests** (a `test_cbj_simulcast` following `tests/test_cavs_simulcast.py`): the ten rows mint against a fixture; a CBJ game not on the list gets no WUAB row; the label keeps the station. **Mutation, red:** the simulcast list emptied or the station row dropped.
- **Dry run:** the adapter for 2026-11-30 (the next OTA date), showing the WUAB row minted available alongside the now-available channel row from A2.

---

## Block C: the Sunday-windows smoke check — 131's step A4 out-of-scope item, Joe approved 2026-11-16, threshold Thursday

- **The check:** for the coming Sunday, if **every** Sunday-afternoon CBS/FOX regional game (kickoff before 7 PM ET, national windows excluded) is still `unverified` **and** the current ET day is Thursday or later, smoke goes red. The maps post Tuesday or Wednesday; by Thursday an all-unverified Sunday means the windows source failed again, which is exactly the state that went unseen for nine days before prompt 131.
- Build it as smoke check (i) alongside (h)'s shape (`smoke.mjs:289` onward): a PostgREST read like the others. When red, include the latest `refresh_runs.notes` `nfl_windows` entry (prompt 131's instrumentation) in the message if that read is cheap, so the red names its cause.
- It must be green on a Monday-to-Wednesday all-unverified Sunday (the maps are not out yet), and green when at least one regional game is decided.
- **Tests:** red on a Thursday with an all-unverified Sunday; green on a Tuesday with the same data; green on a Thursday with one decided game. **Mutations, each red:** the weekday threshold removed; the check widened to any-unverified instead of all-unverified.

---

## Block D: docs

- **Register §77**: the four rulings and the slate, each with Joe's words and dates (A1 2026-11-14; A2, B, C 2026-11-16; A3's decode result); the supersession of §74's CBJ-access line, with a one-line pointer amendment under §74 itself, following the §9→§76 amendment pattern.
- **`data/access_profile.json` `_about`** updated as A2 says.
- **CLAUDE.md line 26's stale clause** (flagged in 131's follow-up report): the "no second copy" list stops at "103-112 and 113 rev C" — recount and correct it (129, 130, 131 and now 132 also have none).
- **`docs/handoff-status.md`**: the re-measured gate line under "Repo state", expected all green, noting that the S4 override's two reds are cleared; the prompts README row for 132.
- The station name appears in data and docs here by the existing prompt-104/§76 pattern. The standing rule about never naming the two **listing sources** is untouched — nothing in this brief adds any listing source, and none appears in anything you write.

---

## Report

For each block: what changed with file:line; A3's verbatim decode; B's ten matched game ids and the dry run; each mutation and that it went red; the five gates as their own commands (`pytest` from the repo root; `npm run test:unit`, `npm run smoke`, `node scripts/qa-shots.mjs`, `npm run geometry` from `web/`) against the floors read from `docs/handoff-status.md`; `git status` showing the work left in the tree.

**Also in Block D's gate work:** re-pin geometry's 2026-09-03 MLB span — `web/scripts/geometry.mjs:227` `SPANS` carries 396.4; the day now reads 393.85 from the season's final MLB records (queue item 19). Joe approved the re-pin on 2026-11-16. Follow the precedent in the comment at `geometry.mjs:215` (the 10-05 re-pin, proved side by side): prove the delta is the data by the same side-by-side before moving the number, and record the move in the comment with today's date and this prompt number.

**Out of scope, named so it is not mistaken for in scope:**

- The 11-01 and 11-08 backfill dispatches (they ran on 2026-11-16 and succeeded).
- E5 and the FOX-late-TBD-at-kickoff question (Joe's, open).
- The CBJ Prime Video row (stays unavailable by the 2026-10-06 decision).
- The `dazn-yes`/`dazn-mem`/`dazn-ind`/`dazn-min`/`dazn-sas` services.
- Why ESPN lists ERADM on those games (decode and rule it; do not chase its history).
- `MatchupCard` (locked).
