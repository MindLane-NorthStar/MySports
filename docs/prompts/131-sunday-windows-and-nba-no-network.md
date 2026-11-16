# Prompt 131: Sunday's windows read EntitledSports' three-window pages again, and an NBA game with no broadcast row is unavailable

Written by Cowork on 2026-11-10 from three sources: a read of the public tree at `7758920` (= `origin/main`, the sha every November refresh reports as `github_sha 775892084964`), read-only SELECTs against `mysports`, and a WebFetch of EntitledSports' week 9 page. **Verify every file:line before acting on it.** Save this brief as `docs/prompts/131-sunday-windows-and-nba-no-network.md`.

**Stop and report if any of these fails:**

- `git rev-parse HEAD` equals `git rev-parse origin/main`, and both are `7758920`.
- `git status --porcelain` shows only untracked `assets/` entries.

**Commits: this brief overrides CLAUDE.md rule 7.** Run all five gates after each block, report them, and leave the work in the tree. Do not commit or push. Joe approves the commit after reading the report.

---

## What Joe reported (2026-11-09)

1. Every Sunday NFL game except the ones on his local channels shows a TBD cue, all day. (The cue on the card is `MARKET TBD`, not `NETWORK TBD`. These games have CBS or FOX rows. Joe's wording was loose; the cause is the same either way.)
2. NBA games with no TV network listed appear in his daily NBA schedule.

---

## Block A: Sunday's coverage windows stopped deciding games on 2026-11-01

### The measurement

Active CBS/FOX rows on Sunday-afternoon NFL games (kickoff before 7 p.m. ET), by `access_status`, read 2026-11-09:

| Sunday | available | out_of_market | unverified |
|---|---|---|---|
| 10-18 | 3 | 6 | 1 |
| 10-25 | 3 | 6 | 1 |
| **11-01** | 1 | **0** | **10** |
| **11-08** | 1 | **0** | **10** |
| **11-15** | 2 | **0** | **9** |

Through 10-25, rule 4b (`adapters/espn.py:198`, `windows_decision` at `:160-179`) decided every regional game. From 11-01, it has decided none. The one `available` row each Sunday is the Browns game, decided by rule 3 (local team, `:193`). Everything else falls to rule 6 (`:201`), UNVERIFIED, which E5 shows as `MARKET TBD`.

**It also hid two games Joe could watch.** On 11-08 Cleveland received DAL @ IND (FOX early) and GB @ NE (FOX late) on WJW 8. Both stayed `unverified`, `market_pending = true`, all day (`nfl-401873040`, `nfl-401873049`).

### The cause (REPORTED: from a WebFetch of the page text, not the raw HTML)

**EntitledSports changed its market blocks from four windows to three.** The week 9 page (updated Tue Nov 3, 12:26 PM ET) has, for Cleveland–Akron (Canton), exactly three windows:

- `CBS`: CLE Browns @ NO Saints, station text `WOIO 19 (CBS) · 1:00 PM ET`
- `FOX Early`: DAL Cowboys @ IND Colts, `WJW 8 (FOX)`
- `FOX Late`: GB Packers @ NE Patriots, `WJW 8 (FOX)`

The fetch reported that **every market block on the page has three windows**, and that the labels `CBS Early` and `CBS Late` do not appear anywhere. The network with one game per market is now labeled bare (`CBS` or `FOX`), with its kickoff time added to the station text. The doubleheader network keeps `Early` and `Late`.

**Why that fails, file and line:**

- `adapters/es_windows.py:77-79`: the `WINDOW` regex requires `(?P<net>CBS|FOX) (?P<slot>Early|Late)`. A bare `CBS` label does not match, so only two windows parse.
- `:113-114`: `len(windows) < 4 or seen != set(WINDOW_LABELS)` raises `PageError("2 window(s) parsed; four are required")`.
- Per prompt 119 the week is dropped with one log line, the file is not written, and the step exits 0. Every regional game falls to rule 6. **Nothing in `refresh_runs` records it.** Cowork searched the notes of runs 783-796: no windows result appears in any of them. That is why it went unseen for nine days.

`tests/test_es_windows.py:73` (`test_three_windows_only_is_a_page_error`) and `:155` (`test_three_windows_only_writes_nothing`) pin the old behavior. They were right for the page as it was measured on 2026-09-23. They are wrong for the page now.

**What Cowork could not check.** The cloud proxy refuses `entitledsports.com`, so Cowork has not seen the raw HTML. The class names (`mkd`, `mw`, `lw`, `mg`, `st`) and the `upd` stamp may also have changed. **Step 1 settles that before any code changes.**

### Do this

1. **Fetch the live pages and save them as fixtures.** Weeks 9 and 10 (`https://entitledsports.com/schedule/nfl/coverage-map/week-9/` and `week-10/`), with the adapter's own User-Agent. Save the Cleveland block of each under `tests/fixtures/`, following the existing week 3 and week 4 fixtures (block only, per prompt 118). **Report verbatim:** the Cleveland block's markup, each label, each station span, and whether `BLOCK`, `WINDOW` and `STAMP` still match apart from the label. If any other part of the markup changed, stop and report before going on.

2. **Read a single-network window.** Change `WINDOW` so the slot is optional: a bare `CBS` or `FOX` label is that network's **single** window.
   - Record it as `slot: "single"`. Keep the time from the station span as a separate field. Do not parse it into the slot.
   - **A valid block is exactly one of two shapes:** the four windows as before, or one network's `early` and `late` plus the other network's `single`. Anything else is still a `PageError`, with the labels it found in the message.
   - The `station` field keeps the whole span. `windows_decision`'s `call` (`espn.py:175`) splits on the first space, so `WOIO` survives the new ` · 1:00 PM ET` suffix. Assert that in a test rather than assuming it.

3. **Decide a game against a single window.** In `windows_decision` (`espn.py:160-179`): look up the exact `(network, slot)` first, as now. If there is none, use that network's `single` window **for either slot**. A network with one game in the market airs that game and no other, so every other Sunday-afternoon game on that network is `OUT_OF_MARKET`, whatever its kickoff. Name it in `src`: `... CBS single CLE @ NO`.

4. **Make the failure visible.** The step must still never fail the run (prompt 118). But when every week fails, or a week is dropped, record it where Cowork and smoke can read it. Write the adapter's per-week result into the NFL load's `refresh_runs.notes` (for example `"nfl_windows": {"9": "ok", "10": "page error: …"}`). Choose the mechanism that fits `load.py`'s existing notes and say which you chose.
   - **Out of scope:** a smoke check that turns red when a Sunday's regional games are all UNVERIFIED after Thursday. It is worth having, but the threshold is Joe's call. Name what it would take in the report and do not build it.

5. **Tests** (`tests/test_es_windows.py`, `tests/test_nfl_market_rules.py`), from the saved fixtures:
   - The week 9 fixture parses as CBS single, FOX early, FOX late, with the stamp.
   - Against that fixture, rule 4b makes CLE @ NO, DAL @ IND and GB @ NE `AVAILABLE`, and every other CBS or FOX Sunday-afternoon game `OUT_OF_MARKET`. That includes HOU @ LAC at 4:05 on CBS, which a slot-exact lookup would miss.
   - A FOX-single page decides a 4:05 FOX game against the single window.
   - The two shapes are the only valid ones. Four windows, two networks, still valid. Three windows of one network, or two singles, are page errors.
   - **Replace** `:73` and `:155`. They become: a three-window block **missing** its single window is a page error, and writes nothing.
   - **Mutation checks, each one red:** the slot made required again; the single-window fallback removed from `windows_decision`; the shape check widened to accept any three windows.

6. **Dry run, no writes:** `python -m adapters.es_windows --out <tmp> --date 2026-11-15`, then the NFL adapter for 2026-11-15 reading it. Report each Sunday-afternoon game's access and source. Expect the Browns game (HOU @ CLE, FOX) `AVAILABLE` by rule 3, and nothing left `UNVERIFIED` unless the page itself says TBD.

7. **Backfill is Joe's call, not this block's.** 11-01 and 11-08 are past, and their rows still read `unverified`. Prompt 130's `--date` dispatch can re-read them. Name the two dispatches in the report and do not run them.

---

## Block B: an NBA game with no broadcast row is unavailable (Joe's ruling, 2026-11-09)

### The ruling

Asked whether an NBA game with no listed network should keep showing, Joe chose: **"Count as unavailable."** A non-Cavaliers NBA game with zero active broadcast rows is filed under `unavailable` and hidden by default. It stays reachable from the unavailable count. If a row lands later, the game reappears with no manual step. **NFL, CFB, NHL and every other sport keep NETWORK TBD exactly as 05 §9 rules it.**

**Why the §9 premise fails for the NBA.** §9 says a game with no row has a broadcaster nobody has announced yet. For the NBA that is not so:

- Every national game was announced on 2026-08-13.
- The Cavaliers always carry a synthesized local row (`adapters/nba.py`, `_local_row`), so a Cavs game is never bare.
- A bare NBA game is therefore League Pass, or another club's local channel, or both. Joe has neither.

### The measurement

`network_status = 'tbd'`, zero rows ever, read 2026-11-09:

- **Inside ESPN's window**, one or two a day since 11-04 (none before 11-04), ten games: CHI @ NYK and TOR @ DEN (11-04), BOS @ CHA (11-06), ORL @ GSW (11-07), PHI @ CHI and MIA @ SAC (11-08), ORL @ SAC (11-10), DEN @ MEM and BOS @ TOR (11-11), TOR @ PHI (11-12).
- **Beyond it**, most of each day: 6 of 8 on 11-16, 9 of 12 on 11-18, 7 of 7 on 11-22. The two or three a day that do have rows are the nationals.
- **The reconciler is already right.** Each one is `eligible = false`, reason `no telecast observed` (`pipeline/reconcile.py:296-304`). The web layer overrides that verdict: `isNetworkTbd` (`web/lib/offservice.js:69-77`) puts the game in `tbd`, and `offServiceSummary` (`:140`) tests that before `off`.
- **The archived grid already does what Joe ruled.** `scripts/render_day.py:433-437` sends a pro game with nothing receivable to `omitted` with "no national telecast · out of market". It never calls such a game network TBA. So today the web and the archived grid disagree about these games, and this block brings the web into line.

**Why it started 11-04 is UNVERIFIED.** It is probably ESPN's scoreboard omitting some clubs' local channels. Many of the games involve TOR, CHI or SAC. Cowork cannot reach `site.api.espn.com`. Do not chase it in this block. The ruling makes the outcome right whatever the cause.

### Do this

1. **`isNetworkTbd` (`offservice.js:69-77`), the one place.** An NBA game whose teams do not include `nba-CLE`, with zero active rows, is **not** network-TBD. It falls through to `isEligible`, which reads the reconciler's `false`, and lands in `off`.
   - Do it here and nowhere else. The header (`:20-26`) says every surface imports this function, and `MobileGrid.js:61`/`:644`, `SportBand.js` and `web/app/page.js:335` all follow from it.
   - Name the ruling and its date in the header comment.
   - **Read the team ids from what `GAME_SELECT` (`web/lib/queries.js:9`) actually returns.** The embed is `home:teams!games_home_team_id_fkey(id,…)` and `away:…` at `:30-31`, so the ids arrive as `game.home.id` and `game.away.id`. `splitHidden` already reads both shapes. Check whether `home_team_id` is also selected.
2. **The favorites carve-out is unchanged** (`splitHidden`, `offservice.js:303`). A favorited team's bare game is still shown.
3. **The grid note** (`MobileGrid.js:644`, "N games not on the grid · network TBD") stops counting these games. Confirm that in `web/test/gridnote.test.mjs`.
4. **Tests** (`web/test/offservice.test.mjs`):
   - A bare non-Cavs NBA game lands in `off`, and the count line's `unavailable` segment counts it.
   - A bare Cavs game stays network-TBD.
   - A bare NFL game and a bare NHL game stay network-TBD.
   - A bare NBA game with no eligibility row is still shown (`isEligible` treats an unjudged game as eligible).
   - An NBA game with an `unknown` row stays CHANNEL ?.
   - The §9 mutual-exclusivity test still passes.
   - **Mutation checks, each one red:** the sport guard removed; the Cavs exemption removed; the guard widened to every pro sport.
5. **Docs.**
   - Add register §76, recording the ruling, the measurement and Block A.
   - Add one amendment line under `docs/feature-study/05-home-page-decisions.md` §9, pointing to §76.
   - Add the re-measured gate line in `docs/handoff-status.md` under "Repo state".
   - `WUAB` and `RESN` appear in none of it.

---

## Report

For each block, report:

- What changed, with file:line.
- The fixtures, verbatim where step A1 asks for it.
- The dry-run table.
- Each mutation, and that it went red.
- The five gates as their own commands: `pytest` (repo root), then `npm run test:unit`, `npm run smoke`, `node scripts/qa-shots.mjs` and `npm run geometry` (all from `web/`). Give the counts against the floors in `docs/handoff-status.md`, read from the file.
- `git status`, showing the work left in the tree and uncommitted.

**Out of scope, named so it is not mistaken for in scope:**

- E5 itself. `MARKET TBD` until a source decides stands; Block A restores the source.
- The FOX-late-TBD-at-kickoff question (Joe's, open).
- The windows smoke threshold (step A4).
- The 11-01 and 11-08 backfills (step A7).
- Why ESPN dropped NBA local rows on 11-04.
- `MatchupCard` (locked).
