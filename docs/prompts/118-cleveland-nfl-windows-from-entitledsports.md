# Prompt 118: The free source decides Cleveland's CBS and FOX windows, and Schedules Direct stays dormant

This builds on `296f43b` (prompt 117). Before starting, confirm:

- `git rev-parse --short HEAD` and `git rev-parse --short origin/main` both return `296f43b`.
- `git status --porcelain` shows only untracked `assets/` entries.

If either check fails, stop and report.

Written by Cowork on 2026-09-23 from a read of the tree at `296f43b` and web research cited below. **Verify every file:line before acting on it.**

---

## Joe's ruling, 2026-09-23

**No paid data.** Joe did not buy Schedules Direct and will not. Cowork had folded its cost into a source choice instead of asking about it separately, and that was Cowork's error, not Joe's decision. The free listings sites are ruled out on their terms: TV Passport's terms of service forbid *"any data mining, data gathering, scraping or extraction method"* and storing their content in any database (<https://www.tvpassport.com/tos>).

**The source is EntitledSports' weekly NFL coverage pages.**

- **Where the data lives.** `https://entitledsports.com/schedule/nfl/coverage-map/week-<N>/` names, for each market, the game in each of four windows: **CBS Early, FOX Early, CBS Late and FOX Late**. Each window carries the market's station: WOIO 19 (CBS) and WJW 8 (FOX) for Cleveland–Akron (Canton).
- **Robots and terms.** Its robots.txt disallows `/api/`, `/v1/`, `/details/`, `/metadata/`, `/hub/`, `/coverage/`, `/conferences/` and `/regular-season-`, and does **not** disallow `/schedule/` (<https://entitledsports.com/robots.txt>, read 2026-09-23). Cowork found no terms page (`/terms` returns 404). Treat it as unofficial.
- **Week 3**, updated "Mon Sep 21, 1:52 PM ET", reads for Cleveland: CBS Early "CIN Bengals @ PIT Steelers", FOX Early "CAR Panthers @ CLE Browns", CBS Late "TBD", FOX Late "TBD".
- **Week 4** already exists, with all four Cleveland windows "TBD" and "updated Sun Sep 13, 10:22 PM ET".
- **Its limits.** It is unofficial, it names no source, the late windows often stay TBD until midweek, and a redesign breaks the reader. Every one of those limits fails safe: the game stays `UNVERIFIED`, which is E5's "Market TBD", and E5 stands.

**Schedules Direct stays in the tree, dormant.** `adapters/sd_listings.py`, its workflow step and rules 4 and 5 remain. Without the `SD_*` secrets the step already writes nothing (prompt 117, register §62), so there is nothing to remove. If Joe ever buys it, it takes precedence as the stronger source.

---

## Block A: the window reader

1. **Write a new module, for example `adapters/es_windows.py`, using `adapters/common.py`'s HTTP helper.** Send an honest User-Agent that names the project. Fetch at most two pages per run: the NFL week containing today (Eastern time) and the next one. **Measure how to get the week number, don't guess it.** Derive it from what the tree already knows: the ESPN adapter's week numbers, or `games.week` for NFL through PostgREST. The database has week 3 on 2026-09-27 and week 4 on 2026-10-04. Say which method you used.
2. **Fetch the two live pages now and parse against their real markup.** Cowork could read these pages only as converted text, because its shells are blocked from the host, so the HTML shape is yours to measure. Parse only the Cleveland–Akron (Canton) block. For each of the four windows, emit the network, early or late, the station, and either the two teams (abbreviation plus nickname, as printed) or `TBD`. Also emit the page's "updated" timestamp.
3. **Recognize only the forms seen.** Any other text in a window, such as a "no game" or "national" marker, is recorded verbatim and becomes `TBD`, with a note in the output. Never guess it into a decision.
4. **Output.** Write one JSON file to `--out`. A failure of any kind (HTTP error, timeout, Cleveland block not found, zero windows parsed) produces one log line, no file, and exit 0. **A page that parses to a block with fewer than four windows counts as a failure.**
5. **Fixtures.** Committed fixtures are **hand-trimmed to the Cleveland block's markup only**, with the week 3 and week 4 content above. Do not commit a copy of their full page to a public repo.

## Block B: rule 4b in `adapters/espn.py`

`decide_regional` (`adapters/espn.py:126-139`) gains one rule. Nothing else in the order changes.

1. National window: unchanged.
2. Hand entry: unchanged.
3. Browns: unchanged.
4. Station listings (Schedules Direct): unchanged, and **when present they win**.
5. **New rule 4b.** Read the EntitledSports windows file from `MYSPORTS_NFL_WINDOWS`.
   - **The row's window** is early when kickoff is before 3:00 PM ET on the Sunday, and late otherwise.
   - **Named teams that match the game** (by nickname, the same `_names_match` at `:80`): `AVAILABLE`.
   - **Named teams that differ:** `OUT_OF_MARKET`.
   - **`TBD`, an unrecognized marker, or no file:** fall through to the next rule.
   - The source string reads like `"entitledsports week 3 (updated Mon Sep 21 1:52 PM ET): WOIO CBS early CIN @ PIT"`.
6. `UNVERIFIED`: unchanged, and its source now says that neither source decided the game.

Update the module docstring (`:17-26`) to list the rules as they now run.

## Block C: the workflow

- **Add one step to `.github/workflows/schedule_refresh.yml`** beside the Schedules Direct step (`:73-82`), before the NFL step. Pass `MYSPORTS_NFL_WINDOWS` the same way `MYSPORTS_NFL_LISTINGS` is passed (`:80-81` and `:85-86`).
- **No secrets.** No Actions expression inside `run` (rule 28). Update `tests/test_workflows.py`.
- **Rename the Schedules Direct step** to say it is dormant without secrets. Keep its behavior.

## Tests

- **Rule 4b decisions:**
  - week 3: CIN @ PIT on the CBS early window is `AVAILABLE`, and every other CBS early game is `OUT_OF_MARKET`;
  - the late windows fall through to `UNVERIFIED`;
  - week 4: every game falls through;
  - the early/late cut at 3:00 PM ET, tested at 1:00, 4:05 and 4:25 kickoffs;
  - the two-team cities.
- **Precedence:** listings beat windows, and a hand entry beats both.
- **Failure paths:** a garbled block, three windows only, an HTTP 500, and a missing Cleveland block each produce no file and exit 0.
- **Mutation checks:** move the 3:00 PM cut, match by city, let `TBD` decide `OUT_OF_MARKET`, drop the four-window check, and put windows ahead of listings. Show each one go red, then restore.
- **One live check is allowed in this run:** your Block A fetch of weeks 3 and 4, which the fixtures come from. **No other network call from the suite**; the existing guard that fails any test reaching `http_json` stays.

## Block D: documents

- **Register §63** (first confirm §1–§62 each appear exactly once). Record:
  - Joe's no-paid-data ruling, and the fact that the $35 was never his decision;
  - why TV Passport and the other free guides are out;
  - the EntitledSports source and its limits, with the robots reading and its date;
  - rule 4b and the precedence;
  - Schedules Direct as dormant.
- **`data/markets.json` `nfl.coverageSource`:** name the EntitledSports pages first, the dormant Schedules Direct option second, and the override file third.
- **`docs/deployment-contract.md`:** mark the three `SD_*` secrets optional and unset by Joe's ruling.
- **`docs/handoff-status.md`:**
  - replace prompt 117's OPEN item (live Schedules Direct verification) with a new one: *after the next scheduled refresh, Cowork reads the week 3 and week 4 CBS/FOX statuses and the windows file's notes*;
  - record the gates as usual.
- **`docs/queue.md`:** add an item noting that if EntitledSports goes stale or changes shape, the fallback is Market TBD, and the options are Joe's to choose (hand entry, or buying Schedules Direct).
- **File this brief** byte for byte as `docs/prompts/118-cleveland-nfl-windows-from-entitledsports.md` from `Claude outputs\`. Update the counts by their own convention.

## Out of scope

- The display.
- E5.
- Removing any Schedules Direct code.
- Any other sport.
- Any database write outside the refresh path.

## Gates, commits and push

Run all five gates, each as its own command. Read the floors from `docs/handoff-status.md` under "Repo state". For each gate that moves, report which gate, by how much, and why, and move its floor row in the same keystroke.

**Commit per block on green, then push `main`** (rule 7). Report the Vercel deployment. The refresh applies the new rule on its next scheduled run (07:37 or 11:37 UTC). **Do not dispatch the workflow; Joe decides that.**

End with the undo block: the reverts with real SHAs and the push that deploys them, what was one-way, and a secret-gate result on the added lines.
