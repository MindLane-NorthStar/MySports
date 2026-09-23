# Prompt 117: Sunday's CBS and FOX games are decided by what WOIO and WJW actually air

This builds on the commit prompt 116 pushed. Before starting, check two things:

- `git rev-parse HEAD` equals `git rev-parse origin/main`, and the log's top commits are 116's.
- `git status --porcelain` shows only untracked `assets/` entries.

If either check fails, stop and report.

*(Numbering: 115 stays reserved for preemption, and 116 is the postseason and TBD-badge run. This is 117.)*

Written by Cowork on 2026-09-23 from:

- a read of the tree at `2485c89` through the device bridge;
- read-only SELECTs through the Supabase connector;
- web research, cited below.

**Verify every file:line before acting on it.** 116 touched `pipeline/load.py` and the web components, not `adapters/espn.py`, but re-read everything this brief cites.

---

## The problem, in Joe's words and in the data

Joe: *"ALL Sunday NFL broadcasts appear as visible to me on FOX or CBS — even though they're determined by local DMA and me being in the Cleveland/Akron/Canton television market."*

**The mechanism is working as designed. The data it depends on has never arrived.**

- **The adapter marks every CBS or FOX TV row "regional"** (`adapters/espn.py:203-212`, set by `REGIONAL_NETWORKS = {"CBS", "FOX"}` at `:48`). A regional row resolves in three ways only:
  1. `AVAILABLE` for a Browns game (`:206-207`);
  2. `AVAILABLE` or `OUT_OF_MARKET` from `data/market_coverage_nfl.json` (`:208-210`);
  3. otherwise, `UNVERIFIED` (`:211-212`).
- **`data/market_coverage_nfl.json` holds one week, and that week is empty.** It reads `"1": {"asOf": "2026-09-01", "source": "506sports not yet checked - week 1 maps pending", "games": {}}`. Its plan was hand entry from 506sports each week (`data/markets.json`, `nfl.coverageSource`). That entry never happened, and the weekly research watch has found 506sports blank to automated fetch five runs in a row (Project, `claude/research-watch-2026-09-23.md`, Entry 1).
- **E5 (2026-09-03) rules that an `unverified` game is always shown, never filtered,** with a "Market TBD" cue (`globals.css:2326`, `.pending-row::after`). The ruling assumed the map would self-resolve by midweek. It never did, so every CBS and FOX Sunday game stays "Market TBD" all week, every week.
- **The database confirms it.** Read-only SELECT, 2026-09-23, active `game_broadcasts` on `cbs`/`fox` for NFL:
  - Every Sunday from week 1 through week 17 has exactly **one** `available` row, the Browns, and every other CBS or FOX game is `unverified`. Week 3 (2026-09-27) has 7 on CBS, 5 on FOX and 1 available. Week 4 (2026-10-04) has 7 and 5, none available.
  - **Games that are national also come out `unverified`:** Thanksgiving (2026-11-26: one on CBS, one on FOX), Saturday 2026-12-19 (one each), and Christmas (2026-12-25, one on FOX). `:203` applies the regional rule to any CBS or FOX TV row regardless of day or time. Only Sunday-afternoon windows are regional.

## Joe's rulings, 2026-09-23

1. **The source is the Cleveland stations' own TV listings**, read through **Schedules Direct**: the official Gracenote guide data for personal, open-source use, US$35 a year. Its JSON API is documented at <https://github.com/SchedulesDirect/JSON-Service/wiki/API-20141201>, and it carries about 20 days of US listings (<https://www.schedulesdirect.org/faq>).
   - The terms allow *"individual use only and exclusively to Open Source software."* **Joe confirms the MySports repo is public.**
   - A station listing is what actually airs on Joe's channels. It also answers the question no coverage map does: **"there is no late game here."** Cowork checked WJW 8's listing for Sunday 2026-09-27 (<https://www.tvpassport.com/tv-listings/stations/fox-wjw-cleveland-oh/217/2026-09-27>). It shows "NFL Football Carolina Panthers vs. Cleveland Browns" at 1:00 PM, "NFL on FOX Postgame" at 4:00 PM, and "Doc" at 4:30 PM, so FOX has no late game in Cleveland that day. The research watch had called that window "unreadable" and said its sources contradicted each other.
2. **E5 stands.** Until a station listing decides a game, the game stays `unverified` ("Market TBD"). With real data flowing, that lasts a day or three, not all week.

---

## Block A: the listings client

1. **A new adapter module**, for example `adapters/sd_listings.py`, using the adapters' existing HTTP helper in `adapters/common.py` (its bounded retry policy is at `:121` onward). **Add no new dependency** unless the helper cannot do a JSON POST, and if it cannot, say so.
2. **Authenticate.** Call `POST https://json.schedulesdirect.org/20141201/token` with `{"username", "password"}`, where the password is sent as its lowercase SHA-1 hex digest. Credentials come from the environment only: `SD_USERNAME`, `SD_PASSWORD`, `SD_POSTAL_CODE`.
3. **Choose the lineup.**
   - Call `GET /headends?country=USA&postalcode=$SD_POSTAL_CODE` and pick the antenna (over-the-air) lineup. Its id has the form `USA-OTA-<postal>`. WOIO and WJW carry the same network feed over the air as on DIRECTV.
   - If the account does not have that lineup yet, add it once with `PUT /lineups/{id}`. The API allows 6 adds per 24 hours, so never add on a run where the lineup is already present.
   - **The postal code and the lineup id never appear in logs, notes, fixtures or any committed file.** Joe's postal code is a personal identifier.
4. **Find the stations.** Call `GET /lineups/{id}` and find the station ids by callsign from a new, committed map in `data/markets.json` under `nfl`: `"affiliates": {"CBS": "WOIO", "FOX": "WJW"}`. The callsigns are public. The station ids are looked up at run time, never committed.
5. **Fetch the schedules and programs.**
   - `POST /schedules` for both stations, for yesterday through today + 13 days (Eastern viewing days).
   - `POST /programs` for the program ids those schedules name. The request volume is small, so no cache is needed across runs, but honor the MD5 guidance within a run: never fetch a program id twice.
6. **Output.** Write one JSON file to the path given as `--out`. It lists every airing on each station: start (UTC), duration, `titles[].title120`, `episodeTitle150`, and any team names the program metadata carries. Mark each airing as an NFL game, where the title is an NFL game title (for example "NFL Football"), or as not a game. Include no credentials, postal code or lineup id.
7. **Failure never fails the refresh.** Missing secrets, a 4xx or 5xx response, or a timeout logs one line and writes no output file, and the step exits 0. Downstream then behaves exactly as today.

## Block B: the classification

**`adapters/espn.py`** reads the listings file from `MYSPORTS_NFL_LISTINGS` when it is set and the file exists. When it is absent, behavior is exactly today's plus rule 1 below.

A CBS or FOX TV row is decided by the first rule that applies:

1. **The game is not in a Sunday afternoon window** (kickoff outside Sunday 12:00–17:00 ET; this covers Thanksgiving, Christmas, Saturdays, international mornings and prime time): **national**. It is `AVAILABLE`, with `market="national"` and source `"national window"`. This rule is independent of listings.
2. **A hand entry exists in `market_coverage_nfl.json`:** it wins, unchanged. That file becomes a manual override. Update its `_about` to say so.
3. **A Browns game:** `AVAILABLE`, unchanged (`:206-207`).
4. **The affiliate for the row's network (WOIO for CBS, WJW for FOX) has an NFL-game airing** whose start is within ±30 minutes of kickoff:
   - **Same two teams** (match on team nickname, so the Los Angeles and New York pairs resolve; accept "at", "vs." and "@" forms): `AVAILABLE`, source `"listings: WJW 2026-09-27 1:00 PM"`.
   - **A different game:** `OUT_OF_MARKET`, source naming the game the station carries.
   - **An NFL-game airing with no team names:** `UNVERIFIED` (E5).
5. **Listings exist for that station and date, but no NFL-game airing starts within ±30 minutes of kickoff** (the WJW 4:25 case): `OUT_OF_MARKET`, source `"listings: WJW carries no game in this window"`.
6. **Otherwise** (no listings for that date, or the step failed): `UNVERIFIED`, as today.

Record the rule that decided each row in its `source` so the detail panel and the database both show why.

## Block C: the workflow

- **In `.github/workflows/schedule_refresh.yml`**, add one step before the NFL step (the step named `NFL (ESPN) — yesterday, today and the next 6 viewing days …`). It runs the client with `--out "$RUNNER_TEMP/nfl_listings.json"` and exports `MYSPORTS_NFL_LISTINGS` for the NFL step.
- Add `SD_USERNAME`, `SD_PASSWORD` and `SD_POSTAL_CODE` to the job's `env` from `secrets.*`, the same way `CFBD_API_KEY` is passed.
- **Working rule 28:** no Actions expression inside any `run:` block. Update `tests/test_workflows.py` for the new step and keep all its guards passing.
- The workflow's header says it is "inert until the repository secrets exist." Keep that true for the new step.

## Tests, all offline

- **Fixtures.** Build them in the shape of the API docs, from the real WJW 2026-09-27 sequence above, plus WOIO carrying CIN at PIT at 1:00 PM (single source, but fine for a fixture), plus one airing titled "NFL Football" with no episode title.
- **Assert the six rules** at the unit level, including:
  - the two-team cities: LAR vs. LAC, and NYG vs. NYJ;
  - a Thanksgiving CBS game coming out national with no listings;
  - a hand override beating listings;
  - a failed client leaving today's behavior.
- **Assert** that the client never writes the postal code or lineup id into its output or log lines.
- **Mutation checks:** drop the ±30-minute bound, match on city instead of nickname, remove rule 1, remove rule 5, swap the rule order of 2 and 4, and let the client exit non-zero on a 5xx. Show each one going red, then restore it.
- **No live Schedules Direct call in this run.** There are no credentials on this machine. Say plainly what that leaves unproven.

## Block D: documents

- **Register §62** (after confirming §1–§61 each appear once). Record:
  - the mechanism and why E5 never self-resolved;
  - Joe's source ruling and the SD terms, with the public repo;
  - the six rules;
  - the national-window fix;
  - that E5 stands.
- **`data/markets.json`:** update `nfl.coverageSource` to name the listings and the override file.
- **`docs/handoff-status.md`:**
  - the gate line;
  - an OPEN item: *live verification after Joe adds the three secrets and dispatches the workflow. Cowork reads week 4 (2026-10-04) statuses.*
- **`docs/deployment-contract.md`:** add the three new secrets beside the existing ones, by name only.
- **File this brief** byte for byte as `docs/prompts/117-cleveland-nfl-assignment-from-station-listings.md`, from `Claude outputs\`, and update the counts by their own convention.

---

## Explicitly out of scope

- The display. E5, the "Market TBD" cue, filter-by-default and the count line stay as they are. Once rows resolve, they do the filtering Joe asked for.
- NBC, ESPN, ABC, Prime Video and Netflix rows, which are national and untouched.
- Any other sport.
- Any database write outside the normal refresh path.

## Gates, commits and push

Run all five gates, each as its own command, with the floors read from `docs/handoff-status.md` under "Repo state". For each gate that moves, report which gate, by how much, and why, and move its floor row in the same keystroke.

**Commit per block (A, B, C, D) on green, then push `main`** under `CLAUDE.md` rule 7. With no secrets set, production changes in one way only: rule 1 marks the national CBS/FOX games available. Report the Vercel deployment state after the push.

End with the undo block: the reverts in reverse order with the real SHAs, whether anything was one-way, and confirmation that no credential, postal code or lineup id appears anywhere in the diff. Run the secret gate on the added lines.
