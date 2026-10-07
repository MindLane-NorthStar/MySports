# Prompt 128: An out-of-market NHL game names ESPN+, and the Blue Jackets' Prime Video add-on is not on Joe's services

This builds on `7b11fb1` (prompt 127). **Stop and report if any of these checks fails:**

- `git rev-parse HEAD` equals `git rev-parse origin/main`, and both are `7b11fb1`.
- `git status --porcelain` shows only untracked `assets/` entries.
- `python scripts/remove_codex_agents_md.py` exits 0.

**One piece of housekeeping first.** Cowork's first `git status` on 2026-10-06 ran without `--no-optional-locks` (rule 11) and left a zero-byte lock, which Cowork renamed to `.git/cowork-stale-lock-2026-10-06.tmp`. If that file exists and is zero bytes, delete it and say so. If it exists and is not zero bytes, leave it and report.

Written by Cowork on 2026-10-06 from five sources: Joe's report and rulings in the session; a read of the tree at `7b11fb1`; the league's schedule endpoint, fetched that evening for the whole season; production's `/api/my-games`; and a run of the tree's own `build_fixture()` on the ten-game file staged beside this brief. **Cowork could not read the database** (its proxy refuses the Supabase host), so anything below about a database row is read from code and says so. **Verify every file:line before acting on it.**

---

## What Joe saw

The Golden Knights show as a broadcast he cannot get. Production's `/api/my-games`, fetched 2026-10-06 23:56 UTC, named `KING` with `markUrl: null` for VGK @ SEA that night (`nhl-2026020051`). Joe holds ESPN Unlimited, which includes NHL Power Play, the league's out-of-market games on the ESPN app.

## What Joe ruled, 2026-10-06

1. **The working rule, in his words:** "surface ESPN+ as the broadcast provider for ALL NHL games that are not airing on one of the other primary national broadcast providers (ESPN, ABC, TBS, TNT)."
2. **"NHL Network games are NOT on my services."**
3. **"Columbus Blue Jackets amazon prime broadcasts are an extra paid tier so those broadcasts need to be marked as blacked out for me (unavailable)."**
   - **This reverses a recorded ruling.** `data/local_rights.json`, `nhl.CBJ.decision`, reads "Joe 2026-09-09: treat Prime Video as AVAILABLE (subscribing)". Cowork named the contradiction to Joe; the conversation wins, and the file keeps the old ruling as history.
   - `Prime Video` itself stays under `available` in `data/access_profile.json`. Only the Blue Jackets' row changes.
4. **Rollout.** This brief ships code and data. The nightly refresh then flips the next seven days, Cowork checks production, and Joe dispatches one forward season load. **Neither of those two later steps is this brief's work.**

## What Cowork found

**Why it happens.** `adapters/nhl.py:211-226` turns the league's `tvBroadcasts` into media rows, and `:220-224` marks every local feed that is not the market team's as `OUT_OF_MARKET`. Nothing adds the out-of-market package. Searched: `git grep -n -i "power play\|outOfMarket"` over the tree outside `docs/` finds nothing.

**How big it is.** Derived from the league feed on 2026-10-06, 28 weekly calls from 2026-09-28 to 2027-04-05: 1,344 games, every one `gameType` 2. These are counts from the feed, not published figures.

| class | games | what the adapter emits at `7b11fb1` | after this brief |
|---|---|---|---|
| a US row on ESPN or ABC | 53 | available | same |
| a US row on TNT, truTV, HBO Max | 71 + 1 Blue Jackets | available | same |
| ESPN+, Hulu, Disney+ national exclusive | 46 + 1 Blue Jackets | available | same |
| NHL Network national row | 17 | `NHLN`, access `UNKNOWN` | `NHL Network`, `UNAVAILABLE` |
| Blue Jackets, no national row | 82 | Prime Video, `AVAILABLE` | Prime Video, `UNAVAILABLE` |
| no Blue Jackets, US local feeds only | 1,017 | every row `OUT_OF_MARKET` | plus one ESPN+ row |
| no Blue Jackets, no US row at all | 56 | no rows | one ESPN+ row |

- **"A US national row" and Joe's list select the same games.** The US outlets the feed carries with market `N` are ESPN, ABC, TNT, truTV, HBO MAX, ESPN+, HULU, Disney+ and NHLN, and no other. A game has a row on one of them exactly when it has any US national row: 189 games either way.
- **So the package goes to 1,073 games**: 66 of the Golden Knights' 84 and 60 of the Penguins' 84.

**NHL Network names its games in batches.** All 17 are dated 2026-11-01 or earlier. More will be named, and each will come out of the 1,073. **A game losing its ESPN+ row is therefore the ordinary path, not an edge case.**

**Three facts about the pipeline that decide the design.**

1. **Which source a row's claim is filed under, and when old claims close.**
   - `pipeline/load.py:317-319` files a row under `data/local_rights` only when its `source` starts with that string. Every other row is filed under the fixture's own source, `nhl.schedule`.
   - `pipeline/load.py:324-331` closes a source's old broadcast claims on a game only when that same source made a broadcast claim on the game in this load (`:326`).
   - `:332` then turns a `game_broadcasts` row inactive when no open claim names its service.
2. **Which row becomes primary.** `pipeline/resolver.py:149-174` builds one candidate per source. Within a source it ranks linear before streaming, then a national feed before a local one, then rail order (`:162-165`). `pipeline/reconcile.py:195` reads the feed from the claim: market `national` is `NATIONAL`, anything else is `HOME`. Across sources, `league_api` outranks `hand_entered` for `primary_network` (`data/authority_rules.json:20`).
3. **The verdict.** `pipeline/reconcile.py:281-289` makes a game eligible on any active row whose access is `available` and whose blackout rule is not `OUT_OF_MARKET`, and names streaming rows in `eligible_via_service_ids`.

**So the package row is filed under the league's source, with market `national`. That is a compromise, chosen on purpose.** The league did not say "ESPN+" about these games; the row is derived from the league's rows by a rule. Filed this way:

- it closes by the existing mechanism the day the league adds a national row, with no loader change;
- on a game with a linear local row the primary network does not move (linear outranks streaming);
- on a game whose only other US row is another club's Prime Video stream, it becomes the primary, so the card names ESPN+. That is 17 games tonight; the first is MTL @ DAL, 2026-10-29.

Filed under any other source, it would be a second candidate, the league's Prime Video row would win primary, and the old claim would never close. The row's `source` string names the rule. `load.py:319-320` passes that string to `observe()` (`:281`) as the claim's key, and `observe()` writes it to `source_observations.source_url_or_key`, so the evidence trail can tell a derived row from a league row. **If a working rule or a contract forbids this attribution, stop and report; do not pick another.**

**The web needs no code change, by Cowork's reading.**

- `web/lib/cardbroadcast.js:51-64`: the pick on these games is a local linear row with no mark, so the card names the first service in the verdict that has an active row and a mark. `espn-plus` is in `web/public/marks/manifest.json`. `web/components/MobileGrid.js:148` chooses the lane with the same function.
- A Blue Jackets game is not eligible, so the verdict names nothing and the pick stands: `cbjnhl`, no mark. The unavailable Prime Video row cannot lend its mark, because only a service the verdict names can replace the pick.
- `web/lib/offservice.js:271-284`: a favourite's game is never hidden. The Blue Jackets are `nhl-29` in `data/favorites.json`, so their games stay on the page, dimmed.

**The baseline, measured.** `build_fixture()` at `7b11fb1` on the ten-game file (Cowork ran it in the bridge's Linux shell; it wrote nothing to the tree):

| game | rows today | rows after this brief |
|---|---|---|
| `2026020048` NYI @ NYR | ESPN `AVAILABLE` national | unchanged |
| `2026020051` VGK @ SEA | Prime Video, KING, KONG, SCRIPPS, all `OUT_OF_MARKET` local | plus the ESPN+ row |
| `2026020068` PIT @ CBJ | CBJNHL and CBJHN `UNKNOWN`; SN-PIT `OUT_OF_MARKET`; Prime Video `AVAILABLE` local | Prime Video becomes `UNAVAILABLE`; no ESPN+ row |
| `2026020110` PHI @ DET | ESPN+ `AVAILABLE`, Hulu `UNKNOWN`, Disney+ `AVAILABLE`, all national | unchanged, and exactly one ESPN+ row |
| `2026020176` TOR @ EDM | no rows | the ESPN+ row alone |
| `2026020199` PHI @ WSH | TNT, truTV, HBO Max national; NBCSP+ `OUT_OF_MARKET` | unchanged |
| `2026020209` MTL @ DAL | Prime Video `OUT_OF_MARKET` local | plus the ESPN+ row |
| `2026020214` NJD @ VGK | NHLN `UNKNOWN` national; MSGSN, SCRIPPS `OUT_OF_MARKET` | NHL Network `UNAVAILABLE`; no ESPN+ row |
| `2026020289` FLA @ CBJ | ESPN+, Hulu, Disney+ national; Prime Video `AVAILABLE` local | Prime Video becomes `UNAVAILABLE`; exactly one ESPN+ row |
| `2026021319` PHI @ CBJ | TNT, truTV, HBO Max; NBCSP+; Prime Video `AVAILABLE` local | Prime Video becomes `UNAVAILABLE`; no ESPN+ row |

On the tracked `tests/fixtures/nhl_schedule_raw.json` (47 games, captured 2026-09-01, before the league listed local feeds): 38 games have no rows, 7 have a national row and 2 are Blue Jackets games. After this brief the 38 carry the ESPN+ row alone.

**`NHLN` is not `NHL Network` to the adapter.** Measured: `normalize_outlet("NHLN")` returns `NHLN` and `outlet_access` answers `UNKNOWN`; `NHL Network` answers `UNAVAILABLE` (`data/access_profile.json:42`). Searched: `git grep -n "NHLN\|NHL Network" -- ':!docs/'` finds that one line.

**What Cowork did not check.**

- The database, as said above.
- Any picture. No gate and no dev page can show the new rows before a refresh loads them.
- The archived desktop grid. See Block C step 3 and the queue entry in Block D.

---

## The rule, as data

`data/markets.json`, under `nhl`, gains one key. The rule is this object; deleting it turns the rule off.

```json
"outOfMarketPackage": {
  "outlet": "ESPN+",
  "label": "NHL Power Play on ESPN+",
  "gameTypes": ["regular"],
  "asOf": "2026-10-06",
  "source": "NHL.com, 2026-08-26, 'ESPN announces national TV schedule for 2026-27 season': NHL Power Play on the ESPN App carries 1,050+ out-of-market games with an ESPN Unlimited plan subscription.",
  "decision": "Joe 2026-10-06: 'surface ESPN+ as the broadcast provider for ALL NHL games that are not airing on one of the other primary national broadcast providers (ESPN, ABC, TBS, TNT)'; 'NHL Network games are NOT on my services.' The market team is excluded because the package blacks out in-market games."
}
```

A game takes one row for `outlet` when **all** of these hold:

1. the key exists and has both `outlet` and `gameTypes`; anything less adds no row;
2. the game's type, as `GAME_TYPE` labels it (`adapters/nhl.py:60`), is in `gameTypes`;
3. neither club's abbreviation is in `localTeams`;
4. no media row built from the league's list has market `national`, **whatever its outlet**. This is deliberately wider than a list of names. A national outlet nobody has seen yet withholds the row, because telling Joe he can watch what he cannot is the worse error (`adapters/common.py:387-399` says the same);
5. the game has no row for that outlet already.

The row: `mediaType` `web`; market `national`; certainty `CONFIRMED`; `source` exactly `data/markets.json nhl.outOfMarketPackage`; the label from the entry; and **access from `outlet_access()` against the profile, never a literal**.

## Block A: the adapter and the two data files

1. **`data/markets.json`**: add the key above, and say in `_about` that it exists and what turns it off. Rule 17: through a parser, and show that nothing else in the file changed. **Do not print the file's `postalCode` in a report or a commit message.**
2. **The rule in `adapters/nhl.py`**, as one pure function that the tests can call: game type, the two abbreviations, the rows built so far, the local set and the entry in, yes or no out. Call it in `build_fixture()` after the league's rows are built and before the "no US broadcast rows" note at `:258`.
3. **A local-rights entry can state its own access.**
   - One function in `adapters/common.py`, called from both confirmed-carrier branches: `adapters/nhl.py:248-253` and `adapters/nba.py:60-65`. A field only one of the two honours is the defect `nhl.py:236-243` describes.
   - `access` is `AVAILABLE` or `UNAVAILABLE` and wins when present. Absent, the profile decides, exactly as today. Any other value answers `UNKNOWN` and prints a warning that names the team and the value.
   - `data/local_rights.json`, `nhl.CBJ`, through a parser:
     - add `"access": "UNAVAILABLE"`;
     - set `label` to `Blue Jackets on Prime Video (add-on subscription)` and `asOf` to `2026-10-06`;
     - move the present `decision` string, verbatim, to a new `previousDecision`;
     - set `decision` to Joe's sentence in ruling 3, quoted, followed by: "Prime Video itself stays available in data/access_profile.json; only this row is not."
     - leave `status`, `outlet`, `surface`, `source` and `superseded` as they are.
   - Describe `access` in that file's `_about`. `nba.CLE` has no `access` key and must emit exactly what it emits today.
4. **`"NHLN": "NHL Network"`** in `OUTLET_ALIASES` (`adapters/common.py:290`).
5. **Keep `report_md()` true.** `adapters/nhl.py:310` counts games with any national row as "with a US national row", which would start counting the package row. Count the league's rows only, and print the package count beside it. Block C reads those two numbers.
6. **Keep the prose true.** `adapters/nhl.py:11-16` describes the local row as `access AVAILABLE`; the comment at `:245-247` says the profile decides. Correct what this change makes false, here and in `adapters/README.md` if anything there is now wrong.

**Do not touch** `pipeline/`, `web/lib`, `web/components`, `scripts/render_day.py`, `data/access_profile.json` or `data/row_order.json`. If the design cannot work without one of them, stop and report.

## Block B: the tests

**The fixture.** Copy `Claude outputs\prompt-128-fixture-nhl-schedule-shapes-2026-10-06.json` to `tests/fixtures/nhl_schedule_shapes_2026-10-06.json` with `shutil.copyfile`. It is 27,677 bytes, LF, ASCII, sha256 `1675053dbcf89536f91cd4fcf6eb608fc6bcba998240a00bbd690b4a1a029e98`. Confirm the hash after the copy. `tests/fixtures/*` is `-text` (rule 29), and `tests/test_fixture_bytes.py` will hold it to that.

**Python, in a new `tests/test_nhl_out_of_market.py`:**

- **The ten games**, each asserted against the "after" column above: outlets, access, market, and the package row's `source` and label.
- **The tracked 47-game file**: exactly 38 games carry exactly one row, the package row; the 7 national games are unchanged; the 2 Blue Jackets games carry one Prime Video row with access `UNAVAILABLE`.
- **Game type**: a copy of VGK @ SEA with `gameType` 1, and one with 3, takes no package row.
- **The switch**: with `outOfMarketPackage` absent, no game in either file takes the row.
- **The profile decides**: with `ESPN+` listed under `unavailable`, the package row's access is `UNAVAILABLE`. Removing it from `available` is not enough and is not the test: `adapters/common.py:348` answers `AVAILABLE` for any outlet whose name contains `espn+`.
- **The local-rights function**: `AVAILABLE`, `UNAVAILABLE`, absent, and a misspelled value. And the real `data/local_rights.json`: every `access` in it is one of the two allowed values.
- **The reconciler, through its own functions** (`tests/test_reconcile.py:92-94` shows the shape):
  - `primary_candidates` on MTL @ DAL's two claims names `espn-plus`;
  - on VGK @ SEA's claims it names a linear local row, the same one it names without the package row;
  - `telecast_verdict` on VGK @ SEA's rows is eligible with `eligible_via_service_ids == ["espn-plus"]`;
  - on PIT @ CBJ's rows and on NJD @ VGK's rows it is not eligible.
- **The row retires, and an access change reaches the verdict.** Use the SQLite harness in `tests/test_eligibility_follows_access.py` by importing it; do not copy it.
  - Load VGK @ SEA, then load a copy that has gained a US row with market `N` on `NHLN`. The `espn-plus` row on that game is inactive and the game is not eligible.
  - Load PIT @ CBJ as the tree emits it at `7b11fb1` (Prime Video `AVAILABLE`), then as this brief emits it. The row's `access_status` is `unavailable` and the game is not eligible.
  - `Harness.load()` (`:189`) takes a sport and a list of game dicts, so `build_fixture()`'s own games can be passed straight in. If the harness lacks a table or a function, extend the harness, not the test.
  - **If it still cannot load these games after two attempts, stop and say which statement or table it lacks.** Do not replace this with a test that mirrors the SQL.

**Web, added to `web/test/cardbroadcast.test.mjs`, rows in `GAME_SELECT`'s shape. Tests only; no file under `web/lib` or `web/components` changes.**

- VGK @ SEA's rows, `king` primary, verdict naming `espn-plus`: the card names `espn-plus`.
- MTL @ DAL's rows, `espn-plus` primary: the card names `espn-plus`, not `prime-video`.
- PIT @ CBJ's rows, `cbjnhl` primary, `prime-video` unavailable, not eligible: the card names `cbjnhl` and `cardMark().url` is null.

**Mutation checks. Each must go red; restore each file byte for byte and say so.**

1. Drop condition 4 (the national row).
2. Drop condition 3 (the market team).
3. Drop condition 2 (the game type).
4. Make the local-rights function ignore `access`.
5. Change the package row's `source` to begin with `data/local_rights`. The retirement test must fail. This is the check that the attribution is doing the work this brief says it does.
6. In `cardBroadcast()`, delete the branch that reads the verdict; then, separately, let it name any row with a mark when the pick has none.

**If an existing assertion has to change, name the test and say why in one sentence.** Cowork expects none: `tests/test_nhl_odds.py` and `tests/test_scores.py` read the 47-game file for odds and scores, not media.

## Block C: measure against the live feed, with no database

Rule 1 first. These commands fetch from the league and write only under `artifacts/` and `assets/`, both untracked. **Nothing here loads, reconciles or dispatches anything.**

1. `python -m adapters.nhl --date 2026-10-07 --no-logos`. From the report, give the window's games by class. On 2026-10-06 the window 10-07 to 10-13 held 53 games: 40 that take the package row, 5 with another national row, 5 on NHL Network and 3 Blue Jackets games.
   - **If your numbers differ, name the games that moved.** A game that moved to NHL Network since is the system working.
   - List every outlet seen with market `N`. One that is not in "How big it is" above is a finding; report it.
2. `python -m adapters.nhl --date 2026-11-28 --no-logos`. On 2026-10-06 that window held 49 games, 42 taking the row, and 2026-11-28 itself had 13, all 13 taking it.
3. **Look at the archived grid, as a measurement and not a gate.** Render two days from those fixtures into `assets/p128-nhl-out-of-market/`:
   - `python scripts/render_day.py --sport nhl --date 2026-11-28 --fixture artifacts/validation/nhl_2026_2026-11-28_fixture.json --png --out assets/p128-nhl-out-of-market`
   - the same for `--date 2026-10-09` with the `2026-10-07` fixture.
   - Report each run's summary line and each file's path. For 2026-10-09 say where PIT @ CBJ landed: on the grid in a row, in the "around the league" strip, or nowhere. For 2026-11-28 say how many lanes the ESPN+ row took.
   - If `--png` fails, drop it and keep the SVG. **If a render does not run in two attempts, report the error and move on.**
   - **Do not edit `scripts/render_day.py`.** Cowork's reading, not run: the loop at `:408-414` drops a row only when its access is `OUT_OF_MARKET` or `UNVERIFIED` (`:412-413`), and `:425` then takes the first web outlet that is not in the four-name set at `:137`. So the Blue Jackets' `UNAVAILABLE` Prime Video row would be taken as primary, and `Prime Video` is not in the NHL rail's streaming list (`data/row_order.json`), from which `:518` builds the streaming rows. If that reading is right, the game is counted as on the grid and drawn in no row.

## Block D: the record

- **Register: the next free section, expected §72.** First confirm §1–§71 each appear exactly once. Record:
  - Joe's three rulings in his words, and that ruling 3 reverses the 2026-09-09 one;
  - the table above; the rule and its five conditions; why condition 4 is wider than Joe's list and selects the same games today;
  - why the row is filed under the league's source, as the compromise it is;
  - that NHL Network names games in batches, so rows retire as a matter of course;
  - what Block C measured.
- **Rule 32, the places that say whether Joe can watch a game.** Cowork's list: the list card's mark and the mobile grid's lane (`web/lib/cardbroadcast.js`); the page's hidden split and count (`web/lib/offservice.js`); the detail panel (`web/components/GameDetail.js`); `/api/my-games` (`web/lib/mygames.js`); and the archived grid (`scripts/render_day.py`, fed by `pipeline/render_feed.py`). Search for any other with `git grep` on the condition, not the concept, and say what you searched. For each place, the register says whether it obeys these rulings, and for the archived grid what Block C found.
- **`docs/handoff-status.md`:**
  - the gate line, with floors moved in the same keystroke and the reason;
  - a dated note beside the item at `:103-106` ("OPEN: 80 Blue Jackets games…"): by Joe's 2026-10-06 ruling those games take a Prime Video row that is `unavailable`, and their cards keep showing no mark by ruling, not by defect. Correct it in the file's own style; do not delete the history.
- **`docs/queue.md`, each a description of a problem and not an approved plan:**
  - **Item 18, a dated correction (rule 30).** Its "What the app shows today" no longer holds once the refresh runs. With no accessible row on a Blue Jackets game the detail panel will print the status word for each feed, so `cbjnhl` and `cbjhn` will read "Unknown" (`GameDetail.js:34`). The club's pages of 2026-09-23 and 2026-09-28 name Spectrum TV, Fubo and Prime Video as carriers and say talks with other cable and satellite providers continue; DIRECTV is not named. The ruling is still Joe's.
  - **New: the archived grid reads a row's access only for `OUT_OF_MARKET` and `UNVERIFIED`.** `scripts/render_day.py:137` is a hard-coded list of four names that no longer matches `data/access_profile.json`. Give what Block C measured. `docs/rendering-contract.md:52` already says "first available streaming outlet".
  - **New: the Blue Jackets' local row is added to national exclusives.** `adapters/nhl.py:228-230` has no national-exclusive test; `adapters/nba.py:182-192` has one. Two games carry a local row they should not: FLA @ CBJ on 2026-11-10 and PHI @ CBJ on 2027-04-08. It does not change either verdict.
- **`docs/research/research-changelog.md`:** add the entry in the appendix below, verbatim, placed by the file's own convention.
- **File this brief** byte for byte as `docs/prompts/128-nhl-out-of-market-on-espn-plus.md`, copied from `Claude outputs\prompt-128-nhl-out-of-market-on-espn-plus-2026-10-06.md`. Update `docs/prompts/README.md` and the counts by their own convention.

## Paths this brief may touch (S5)

- `adapters/nhl.py`, `adapters/nba.py`, `adapters/common.py`, and `adapters/README.md` only where this change makes it false
- `data/markets.json`, `data/local_rights.json`
- `tests/test_nhl_out_of_market.py` and `tests/fixtures/nhl_schedule_shapes_2026-10-06.json`, both new
- `tests/test_eligibility_follows_access.py`, only if its SQLite harness needs a table or a function to load these games, and never its assertions
- `web/test/cardbroadcast.test.mjs`
- `docs/enhancement-register.md`, `docs/handoff-status.md`, `docs/queue.md`, `docs/research/research-changelog.md`, `docs/prompts/128-nhl-out-of-market-on-espn-plus.md`, `docs/prompts/README.md`
- untracked only: `artifacts/`, `assets/p128-nhl-out-of-market/`, and the one file under `.git/` named at the top

## Out of scope

- Any database write, and any workflow dispatch. **Do not run `bootstrap_season` or `schedule_refresh`.**
- `scripts/render_day.py`, `pipeline/`, and every file under `web/` except the one test file.
- `data/access_profile.json`. `ESPN+` is already under `available` and `NHL Network` under `unavailable`. Whether `CBJNHL` and `CBJHN` belong under `unavailable` is queue item 18 and Joe's ruling.
- The two Blue Jackets national exclusives' extra local row.
- Past games. Nothing here re-fetches a day before the refresh's own window.

## Gates, commit, push

- Run the script first, then all five gates, each as its own command, against the floors in `docs/handoff-status.md` under "Repo state".
  - `pytest` and `test:unit` rise by the tests this brief adds.
  - `smoke`, `qa-shots` and `geometry` read the live database or the dev server, and neither has changed when this runs. **If one of them moves, stop and report it. Do not edit a hard stop.**
- **Two commits, then push `main`** (rule 7): Blocks A and B together, then Block D. Block C leaves nothing tracked. Report the Vercel deployment.
- End with the undo block: the real SHAs, newest first; anything one-way; and the secret gate on the added lines.
- **Say in the report that nothing a user can see changes until the next refresh loads the rows** (rule 25). Cowork checks production after that refresh.

---

## Appendix: the research changelog entry

```
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
```
