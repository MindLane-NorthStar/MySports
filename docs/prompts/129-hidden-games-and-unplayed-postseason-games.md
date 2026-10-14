# Prompt 129: games hidden by network spellings, unplayed postseason games, and Joe's access rulings

**Filed:** 2026-10-14 by Cowork. **Venue:** Claude Code. **Attended:** yes. The prompt has **two stops**, both for refresh runs that only Joe can dispatch.

**This brief replaces two drafts that never ran.** It merges an earlier prompt 129 and a planned 130, and carries Joe's rulings of 2026-10-14. It is the only brief to file.

**Deadline.** Part 1 and the first refresh must finish before NLCS Game 4 ends on Thursday night, 10-15. If the Brewers sweep that night, Game 5 can drop out of MLB's feed the same night. Block E can only cancel a game that a previous refresh already stored as a playoff game.

## Scope (S5)

This brief may touch the following paths, and only these:

- **Adapters:** `adapters/common.py`, `adapters/espn.py`, `adapters/cfbd.py`, `adapters/mlb.py`, `adapters/nba.py`, `adapters/nhl.py`. Touch only the outlet-resolution call sites and the MLB lines the blocks below name.
- **Pipeline:** `pipeline/load.py`. Touch only the source map, the claim-closing loop, the games upsert, and the new cancellation pass.
- **Data:** `data/access_profile.json`, and `data/markets.json` if Block E stores the postseason start date there. Edit both through a parser (rule 17).
- **Web:** `web/lib/offservice.js`, `web/components/SportBand.js`, `web/components/Listing.js`, `web/app/globals.css`, any other renderer that Block E's or Block G's enumeration finds, and the `/api/my-games` code if Block G reaches it.
- **Tests and fixtures:** tests under `tests/` and `web/test/`, dev-only fixture pages under `web/app/qa/`, and `web/scripts/smoke.mjs`.
- **Docs:** `docs/design/mobile_demo.html` (rule 23, Block G), `docs/rendering-contract-mobile.md`, `docs/enhancement-register.md`, `docs/handoff-status.md`, `docs/queue.md`, `docs/research/mlb-adapter-brief.md`, `docs/prompts/129-hidden-games-and-unplayed-postseason-games.md`, and `docs/prompts/README.md`.

Anything outside this list is a stop, not a judgment call.

---

## Joe's rulings, 2026-10-14

Record these verbatim in the register.

1. **An unrecognized channel shows the game, with a cue. It is never hidden.** *"show the game"*
2. **NBA TV is on Joe's services.** *"I get NBA TV"* A DIRECTV dealer page (americantv.com, updated 2026-10-02) lists NBA TV as channel 216 in CHOICE.
3. **The Blue Jackets' own channel (`CBJNHL`, `CBJHN`) is not on Joe's services.** *"Blue Jackets NOT AVAILABLE"* The club's update of 2026-10-09 names Spectrum, Prime Video and Fubo as carriers. It says DIRECTV was offered terms and has not agreed. This ruling closes queue item 18.
4. **Postponed games come off the grid, as cancelled games do.** *"Yes take them off"*
5. **The four unplayed Division Series games are closed.** *"close them"*
6. **The archive is backfilled.** *"yes"* Joe will dispatch the anchored runs at the second stop.
7. **Hulu is on Joe's services.** *"I have HULU"*
8. **Joe also confirmed four further calls.** FOX's MLB postseason is national. The ALCS card names TBS. An unplayed game reads `Cancelled`. MLB's observations are credited to MLB: *"MLB is fine to MLB"*, which Block H implements.

---

## What Joe reported, and what is actually happening

**The NLCS is in the database and hidden.** The games are stored with the right teams, times and networks. The app believes Joe cannot watch them.

**This is one case of a wider failure.** Three spelling drifts in the feeds produce access `unknown` on networks Joe has. The reconciler then marks those games `eligible = false, market_pending = false`. `web/lib/offservice.js:100` (`offServiceSummary`) files them under `off`, and D4 hides them.

Cowork measured the damage on 2026-10-14 with read-only SELECTs against `mysports`:

- **39 games have been hidden since 2026-09-17, and 14 of them fall in the next seven viewing days.**
- Those include **Ravens at Browns on Sunday 10-18 at 1:00 PM on FOX** (`nfl-401872997`).
- They include **Ohio State at Indiana on Saturday 10-17 on FOX** (`401858488`).
- They include **NLCS Games 3–6** (`mlb-849811`, `-849810`, `-849808`, `-849806`).

Production agrees. At `my-sports-xi.vercel.app/?day=2026-10-14` the page reads *"4 broadcasts on your services · 5 TBD Show 4 not on your services"*, and neither the Brewers nor the Dodgers appear anywhere on it.

**Joe's rulings change two of the "unknown" cases as well:**

- **NBA TV:** 79 NBA games this season list it, and 76 of them are hidden today, 61 still to be played.
- **The Blue Jackets' feeds:** 82 games list `cbjnhl`.

### Cause 1: ESPN and CFBD now write `Fox`, and the game adapters match case exactly

- **When it started.** ESPN's scoreboard has shown `geoBroadcasts[].media.shortName = 'Fox'` on all nine FOX games for NFL 2026-10-18 and CFB 2026-10-17 (groups 80). `source_observations.raw_value = 'Fox'` was first written by `espn.scoreboard` at 2026-10-05 19:55Z (16 rows) and by `cfbd` at 2026-10-13 08:09Z (4 rows). Before that it was `'FOX'`.
- **How the label falls through:**
  1. `espn.py:290` and `:297` call `normalize_outlet` (`common.py:326`), which is an exact lookup.
  2. `Fox` is not in `REGIONAL_NETWORKS` (`espn.py:63`), so the six rules at `:363` never run. The Browns game lost rule 3: it flipped from `fox|regional` to `fox|national` at 2026-10-12 08:06Z.
  3. `outlet_access` (`common.py:343`) returns `UNKNOWN`, and `load.py:307` writes that as `unknown`.
  4. `slug("Fox")` is `fox`, so the stub upsert at `load.py:242-246` collides silently with the real row.
- **The fix already exists.** `canonical_outlet()` (`common.py:398-415`) makes one case-insensitive pass against the alias table and the profile, matching exactly within a known set (rule 18). Only `access_status_for()` (`:418-433`) calls it.
- **Where it is missing (rule 32).** `git grep -n "normalize_outlet("` finds these game-adapter call sites: `espn.py:290`, `:297`; `cfbd.py:161`; `mlb.py:225`; `nba.py:119`, `:250`; `nhl.py:112`, `:268`, `:321`.
- **A docstring is wrong.** `common.py:428-429` says `unknown` "is neither eligible nor off-service". That is false today: `offservice.js:69` and `:100` hide such a game. Block G makes it true in a new way.

### Cause 2: MLB's postseason labels FS1 as `FS1 / FOX ONE` and TBS as `TBS/HBO MAX`

- **The labels in the feed.** Statsapi returns `'FS1 / FOX ONE'` for gamePk 849811. The observations show four labels:

  | Label | Dates | Rows |
  |---|---|---|
  | `FS1/ FOX ONE` | 09-18 to 10-08 | 9 |
  | `FS1 / FOX ONE` | from 10-09 | 4 |
  | `FOX/ FOX ONE` | 09-17 to 10-04 | 6 |
  | `TBS/HBO MAX` | since 09-17 | 18 |

- **What the aliases cover.** `common.py:319-321` maps only `"FOX / FOX ONE"`, `"FOX / FS1"` and `"TBS (out-of-market only)"`.
- **The result.** The loader made three stub networks, `fs1-fox-one`, `fox-fox-one` and `tbs-hbo-max`, all with access `unknown`.
  - The NLCS and the NL Division Series games on FS1 are hidden.
  - The ALCS shows only because its truTV row is `available`.

### Cause 3: MLB treats FOX's postseason as Saturday regional baseball, and stores postseason games as regular season

- **The regional branch has no game-type test.** `mlb.py:236` sends every FOX row down the regional branch, and `:253` lands those rows as `UNVERIFIED`. So NLCS Games 1, 2 and 7 (`mlb-849809`, `-849812`, `-849807`) show as Market TBD.
- **The source of the mistake.** `docs/research/mlb-adapter-brief.md:237` lists the LDS, the LCS, the World Series and the All-Star Game in the regional row. FOX's regional split is the regular-season Saturday window only.
- **The precedent.** Rule 0 at `espn.py:187` treats NFL playoff games as national (register §64).
- **Postseason games are stored as regular season.** The loader never writes `competition_context`, so all 20 MLB rows from 10-08 to 10-20 read `REGULAR`. `PLAYOFF` already exists in the enum.
- **Nothing reads the column today.** `git grep -n competition_context -- web pipeline adapters scripts tests` finds no hits outside fixtures.

### Cause 4: postseason games that are never played stay `scheduled`, and postponed games keep their grid block

- **Four unplayed games still read `scheduled`.** A gamePk lookup returns no `dates` for these four Division Series games:
  - `mlb-849837`, TB@NYY, 10-08
  - `mlb-849824`, SD@MIL, 10-09
  - `mlb-849821`, ATL@LAD, 10-09
  - `mlb-849836`, NYY@TB, 10-10

  Two of them were shown as watchable on truTV.
- **Why nothing closes them.**
  - The MLB adapter skips a game it does not see.
  - It does collect `tombstones` (`mlb.py:290-311`), but `git grep` finds no reader of them in `pipeline/`.
  - The loader only writes games that are in the fixture.
- **The status already exists in the schema.** `result_status` allows `cancelled` and `postponed` (migration `0007`; `common.py:448`), and the card prints the word (`format.js:212-215`, `:300`; contract v1.6.6).
- **The grid ignores both states.** `git grep -n -E "cancelled|postponed" -- web/components web/lib/gridmodel.js` finds nothing, so the grid still draws a block for a game that will not air.
- **The dates to use.** Statsapi's season record (`/api/v1/seasons/2026?sportId=1`) gives `regularSeasonEndDate 2026-09-27` and `postSeasonStartDate 2026-09-28`. For an empty date it answers `"totalGames":0,"dates":[]` (measured for 2026-11-15).

---

# PART 1: must land before Thursday night

## Block A: the case fold reaches every game adapter

1. Route every call site listed in Cause 1 through `canonical_outlet()`, or through one function built on it. In `espn.py`, the regional test at `:363` must see the canonical `FOX`. Choose the narrowest change, and say why.
2. **Before and after the change, run each touched adapter against its committed fixtures.** Print every outlet whose resolution changes. Any change beyond `Fox → FOX` is a finding.
3. Add tests and mutation-check each one by reverting to `normalize_outlet`:
   - ESPN `'Fox'` on a Sunday 1:00 game with a local team gives `FOX`, regional, `AVAILABLE`, "market: local team".
   - The same label on a Saturday CFB game gives `FOX`, national, `AVAILABLE`.
   - CFBD `'Fox'` gives the same result.
   - `'Foxx'` stays `UNKNOWN`.

**Commit:** `outlets: every game adapter folds case before it decides access, so espn's "Fox" is FOX again`

## Block B: MLB's postseason spellings

1. **Map the four spellings:**
   - `FS1 / FOX ONE` and `FS1/ FOX ONE` → `FS1`
   - `FOX/ FOX ONE` → `FOX`
   - `TBS/HBO MAX` → `TBS`
2. **Prefer normalizing the spacing around `/`** before the exact lookup, and normalize the alias keys the same way. The feed has already used two spacings of the same label.
3. **Constraints.** Every existing slash alias still resolves (`ESPN/ESPN App`, `ABC/ESPN App`, `NBC/Peacock`, `Peacock/NBCSN`, `Peacock / NBCSN Extra`). Nothing becomes a substring or fuzzy match.
4. Add tests for each spelling, for every pre-existing slash alias, and for a `build_media` NLCS-shaped game that emits one NATIONAL `FS1` row. Mutation-check each one.
5. **The ALCS card should name TBS (Joe's confirmation).** Report the broadcast it names and how many grid lanes it gets (prompt 106).

**Commit:** `mlb: the postseason's "FS1 / FOX ONE" and "TBS/HBO MAX" are FS1 and TBS`

## Block C: an MLB postseason game is national on FOX, and is stored as a playoff game

1. **Gate the regional branch.** `mlb.py:236` becomes regular-season only (`gameType == "R"`). Correct `mlb-adapter-brief.md:237` in the same commit.
2. **Write `competition_context`.** Store `PLAYOFF` for `gameType` F, D, L and W, and `REGULAR` for R.
   - The fixture already carries `gameType` (`mlb.py:358`).
   - Add the column to the games upsert, on both insert and update.
   - A fixture that does not supply the column leaves it alone (`preserve=`). The NFL half of queue item 14 stays queued.
3. **Tests**, each mutation-checked:
   - An `L` game on `FOX / FOX ONE` with no Guardians gives `FOX`, national, `AVAILABLE`.
   - An `R` Saturday 7:15 game is still `UNVERIFIED` regional.
   - An `A` game is national.
   - An `L` game loads with `PLAYOFF`, and an NFL game keeps its stored value.
   - `tests/test_eligibility_follows_access.py:289` stays green.

**Commit:** `mlb: a fox postseason game is national and is stored as a playoff game`

## Block D: Joe's access rulings (2, 3 and 7)

1. **Edit `data/access_profile.json` through a parser** (rule 17), and assert that only the intended keys changed:
   - Add `NBA TV` and `Hulu` to `available`.
   - Add the Blue Jackets' two feed labels to `unavailable`.
   - Correct `_about`, which still lists Hulu and NBA TV as "unstated".
2. **Use the label form the adapters actually emit, not the slug (rule 31).** Measure those strings from the committed fixtures, from `networks_services.canonical_name` (`CBJNHL`, `CBJHN`, `NBA TV`, `Hulu`), or from both. Name the search you ran.
3. **`data/local_rights.json`'s `nhl.CBJ` Prime Video entry is unchanged.**
4. **Check whether anything that decides eligibility reads `viewer_services`.** It is seeded from the profile by `pipeline/bootstrap.py:74`. Cite file and line either way. If eligibility does depend on it, stop and report: refreshing that table is a database write.
5. **Tests:**
   - `NBA TV` and `Hulu` resolve to `AVAILABLE`.
   - `CBJNHL` and `CBJHN` resolve to `UNAVAILABLE`.
   - An NBA TV game with an out-of-market local feed becomes eligible.
   - A Blue Jackets local game with only those feeds and the Prime row resolves to `off`, not `unknown`.
6. Close queue item 18 in Block I.

**Commit:** `access: nba tv and hulu are on joe's services, and the blue jackets' own channel is not, by his 2026-10-14 rulings`

## Block E: a postseason game the feed drops is cancelled, and a cancelled or postponed game leaves the grid

1. **The loader pass.** For each MLB fixture the run loads, cancel any game in `mysports.games` that meets all of these:
   - `sport = 'mlb'`, and `result_status = 'scheduled'`
   - it is a postseason game: either `competition_context = 'PLAYOFF'`, or its date falls on or after the postseason start date
   - it carries the fixture's date (name the column you match, `game_date` or `viewing_day`, and why)
   - it appears in neither the fixture's games nor its tombstones

   Set `result_status = 'cancelled'`, never delete (rule 6), and write one line per game to `refresh_runs.notes` (the prompt 116 pattern).
   - Take the postseason start date (2026-09-28) either from a hand-entered `data/markets.json` key with its source or from statsapi's seasons endpoint. Say which you chose.
   - The date clause is what reaches the four Division Series games (Joe's ruling 5). They will never be written as `PLAYOFF`, because they left the feed before Block C existed.
2. **Fail closed, and prove it before writing.** Read `load_raw_or_fetch` and `mlb.py`'s `main`, then show what a failed fetch produces.
   - A failed fetch never cancels anything.
   - A successful day with zero games does cancel: that is the case where both series ended, 10-19.
   - If you cannot tell those two apart, stop and report.
3. **Reappearance restores the game.** A cancelled game that the feed lists again returns to `scheduled` through `SCORES_SQL` (`load.py:111-116`), because `"Preview"` maps to `scheduled` (`common.py:450-455`). Pin this with a test.
4. **Cancelled and postponed games leave the grid; the list keeps them** (Joe's ruling 4). The card already prints the word under v1.6.6. A game in either state draws no grid block, lane or row.
   - Enumerate every renderer that draws grid blocks (rule 32): `git grep` the class, the component and the condition. `Listing.js:196` (`gridGames`) builds the mobile grid's set.
   - If `docs/design/mobile_demo.html` draws a grid from a set that could contain such a game, rule 23 applies.
5. **Tests**, each mutation-checked:
   - An absent PLAYOFF game is cancelled, and the note is written.
   - An absent game dated after the postseason start is cancelled even when it is tagged `REGULAR`.
   - An absent regular-season game, and an absent `final` game, are left untouched.
   - A failed fetch cancels nothing, and a successful empty day cancels.
   - A reappearing game is restored.
   - Neither postponed nor cancelled games are in the grid set, and both stay in the list.
   - Add a qa-shots check on a dev-only fixture page, following prompt 124's pattern (`web/app/qa/tbd/`).

**Commit:** `mlb: a postseason game the feed drops is cancelled, and a cancelled or postponed game leaves the grid`

## Block F: the guard (STOP 1)

Prompt 128's gates passed on 2026-10-06 while ESPN's `Fox` rows were already in the database.

1. **Add a smoke check.** Every active `game_broadcasts` row on the next 7 ET viewing days with `access_status = 'unknown'` must sit on a service named in an explicit list in `smoke.mjs`, and each name must carry its reason.
   - Bound the read (rule 19) and pin its call site in `web/test/restcap.test.mjs`.
   - After Joe's rulings, the list holds only `acc-extra` and `eradm`, if they are still in the window. Re-measure both.
2. **Expect red, and show it.** Until a refresh rewrites the rows, the check is red on exactly `fox`, `fs1-fox-one`, `tbs-hbo-max`, `nba-tv`, `cbjnhl`, `cbjhn` and `hulu`. Anything else that turns red is a finding.
3. **Mutation checks.** Removing a list entry turns the check red. So does an injected `unknown` row on a service that is not listed.
4. **STOP 1.**
   - Blocks A–E are committed and pushed. Block F is written and run but **not committed**.
   - Report the rows that are red. **Do not dispatch the workflow (S2).**
   - Joe dispatches `schedule_refresh` with no date and says "continue". Then rerun all five gates; Block F commits only when all five are green.
5. **After that refresh, confirm through the anon key and report each of these:**
   - `nfl-401872997` has an active `fox` row with access `available`.
   - `mlb-849810` has an active `fs1` row with access `available`, and it is eligible.
   - `mlb-849809` and `mlb-849812` carry `fox` with access `available`.
   - The ALCS games carry an active `tbs` row.
   - Every MLB game from 10-13 to 10-20 reads `PLAYOFF`.
   - NBA TV games in the window are eligible.
   - `cbjnhl` and `cbjhn` rows read `unavailable`.
   - The old stub rows read `active = false` (`load.py:332`).
   - The run's notes show **zero** cancellations. Any cancellation in this run is a finding.

**Commit (after Joe says continue):** `smoke: an unknown-access broadcast on an unlisted service goes red, so a feed's new spelling cannot hide a game quietly`

---

# PART 2: after Stop 1

## Block G: an unrecognized channel shows the game, with a cue (Joe's ruling 1)

1. **Add a fifth state.** A game is *unrecognized* when all of these hold:
   - it is not eligible
   - it is not market-pending
   - it is not network-TBD
   - at least one of its active broadcast rows has `access_status = 'unknown'`

   This is a structural fact read from the broadcast rows, as `isNetworkTbd` already is. It is not a second eligibility rule (`offservice.js:1-26`).
   - **Where it is tested.** Test it in `offServiceSummary` before `off`, keeping the existing order and carve-outs.
   - **The comment block.** Update `offservice.js`'s header to describe the new state.
2. **What an unrecognized game does on screen:**
   - **Toggle:** it is never hidden by D4's control.
   - **Badge:** its card carries the cue **`CHANNEL ?`**. Build it the way the `MARKET TBD` and `NETWORK TBD` cues are built: a row-wrapper class in `SportBand.js:91-95` with the text in `globals.css`. `MatchupCard` is locked and must not be touched.
   - **Count line:** it is counted inside the `TBD` segment as a display sum, beside pending and network-TBD (`countLines`).
   - **Grid:** it is drawn under the network name the feed used.
   - **Width:** measure that the cue fits at 390px exactly as the other two do.
3. **Rule 32.** Enumerate every surface that uses the buckets, including `PageCount.js`, `/api/my-games` and the week view, and make each one obey. Rule 23: `docs/design/mobile_demo.html` gains the cue in the same commit. Record the new state in `docs/rendering-contract-mobile.md`.
4. **Correct `common.py:428-429`** to describe what now happens.
5. **Tests and qa-shots**, each mutation-checked:
   - The new bucket's predicate, and its order against the other four.
   - The game is never hidden.
   - The TBD sum includes it.
   - The grid includes it.
   - The cue renders at 390px on a dev-only fixture page.

**Commit:** `listing: a game on a channel nobody has ruled on is shown with a channel ? cue, never hidden`

## Block H: MLB's observations are credited to MLB (Joe's confirmation)

1. **Add the missing source entries.** `pipeline/load.py:35` gains `"mlb-statsapi": "mlb.statsapi"` in `SOURCE_ID`, and `SOURCE_META` gains `("league_api", 80)`, which matches the existing `sources` row.
   - **What is broken today.** Every MLB observation since 2026-09-01 is attributed to `espn.scoreboard`: 843 broadcast rows in all. The `:175` fallback is the cause.
2. **The legacy claims must close.** The loop at `load.py:325-326` closes only claims whose source is in `seen_now`. If the id switches without a fix, every `espn.scoreboard` claim on an MLB game stays active forever. The stub rows would stay active, and the old kickoff claims would compete with the new ones.
   - When an MLB fixture loads, treat that game's active `espn.scoreboard` claims as the predecessor of `mlb.statsapi`. Close them under the same rules as the current source's claims, including `kickoff_at` supersession at `:288-290`.
   - Only games the run loads are touched. History outside the window keeps its claims.
3. **Rule 32.** `git grep -n "espn.scoreboard"` across `pipeline/`, `adapters/`, `web/` and `tests/`, and say which hits assume MLB claims carry that id.
4. **Tests**, each mutation-checked:
   - A game holding an `espn.scoreboard` `fs1-fox-one` claim loads an `mlb.statsapi` `fs1` claim. The legacy claim closes, and `fs1-fox-one` goes inactive.
   - A legacy kickoff claim is superseded.
   - The reconciled state of an unchanged game is identical before and after the switch, with no `authority_conflict`.
   - A non-MLB game's `espn.scoreboard` claims are untouched.

**Commit:** `load: mlb observations are credited to the mlb stats api, and its espn-labeled predecessors close`

## Block I: the record, and the backfill report (STOP 2)

1. **`docs/enhancement-register.md` §74.** Record:
   - Joe's eight rulings, verbatim.
   - The four causes and their measurements.
   - The counts: 39 games hidden since 09-17, and 14 in the window.
   - That `canonical_outlet` existed but was not reached (rule 32).
   - The postseason-national rule, following §64.
   - The cancellation pass and its fail-closed proof.
   - The grid rule.
   - The fifth listing state.
   - The source switch.
2. **`docs/handoff-status.md`.** Add the Repo state line, and an open item for **device confirmation (rule 25)** on Joe's phone:
   - Sunday's Browns card shows FOX as watchable.
   - An NLCS card names FS1, and the ALCS card names TBS.
   - An NBA TV game is listed as watchable.
   - When a series ends early, its unplayed games read `Cancelled` in the list and are absent from the grid.
3. **`docs/queue.md`.**
   - Close item 18 (ruled).
   - Amend item 14: the MLB half is done, and the NFL half remains.
   - Queue nothing new unless the run finds something.
4. **The backfill report (Joe's ruling 6).** Read `schedule_refresh.yml` and report, per sport, exactly which past viewing days a dispatch with the `date` input rewrites. Then list everything such a dispatch writes **outside** that window:
   - standings (which file under today's ET date: `pipeline/standings.py:95`, `:355`)
   - the CFB week
   - programs and studio shows through 2026-12-31
   - any R2 upload (S7)
   - any render

   **Propose the anchor dates** that cover MLB 10-03 to 10-12 (which includes the four unplayed games), NFL 10-04 and 10-11, and CFB 10-10. Cowork expects 2026-10-04 and 2026-10-11, but confirm against the workflow; the CFB week is computed from the date (`:74`). If any dispatch would write outside its window in a way that is not harmless, say so plainly, and recommend against that run.
5. **File this brief** byte-identical to `docs/prompts/129-hidden-games-and-unplayed-postseason-games.md`, and update the README, including a provenance line saying it merges two unrun drafts.
6. **STOP 2.** Commit and push Blocks G, H and I, then report.
   - Joe dispatches the anchored runs one at a time, and only if the report clears them.
   - When he says "continue", confirm and report each of these through the anon key:
     - The four Division Series games read `cancelled`.
     - The NL Division Series games on FS1 (10-03 to 10-07) are eligible.
     - The 10-04 and 10-11 NFL FOX games, and the 10-10 CFB FOX games, carry `fox` with the right access.
     - The MLB observations in those windows are `mlb.statsapi`, and their `espn.scoreboard` predecessors are closed.
     - No MLB game reads `authority_conflict`.
   - Record the result in `docs/handoff-status.md`, and commit with `docs: the archive is backfilled 10-03 to 10-18 and the four unplayed division series games are cancelled`.

---

## Not in scope, deliberately

- **No database write and no workflow dispatch by this session (S2).** Every write in this prompt happens in a refresh that Joe dispatches.
- **Games before 10-03 keep their old rows.** By Joe's ruling 6 the backfill covers October only.
- **If `npm run geometry` moves, that is a finding, not a re-pin.**

## Gates and committing

Run all five gates as their own commands before every commit. Read the floors from `docs/handoff-status.md` under "Repo state", and report all five against them.

Blocks A–E and G–I self-commit and push under rule 7, with the stop list unwaived. Blocks F and I follow their stops.

End with the undo block. It must state:

- the real SHAs, newest first
- which stages were one-way: none in the code, because the only writes are the refreshes Joe dispatches. Say which rows each dispatch changed.
- the Vercel result
