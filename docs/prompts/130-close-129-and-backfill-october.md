# Prompt 130: close prompt 129, make a past-date refresh use its own week, and backfill October

**Filed:** 2026-10-14 by Cowork. **To run:** the morning of 2026-10-15, after the 4:00 AM refresh. **Venue:** Claude Code. **Attended:** yes. The prompt stops once, for dispatches that only Joe can make.

**This brief merges two pieces of work:** the close-out of prompt 129 at its Stop 2, and the follow-up Cowork proposed. Joe asked for them as one prompt.

## Scope (S5)

This brief may touch the following paths and nothing else:

- `adapters/es_windows.py`
- `.github/workflows/schedule_refresh.yml` (the coverage-windows step only)
- `.github/workflows/render_all.yml`
- `pipeline/render_feed.py`
- `scripts/render_day.py`
- `web/scripts/smoke.mjs` (the unknown-access list only)
- new or existing tests under `tests/` and `web/test/`
- `CLAUDE.md` (the two stale lines named in Block E)
- `docs/enhancement-register.md`, `docs/handoff-status.md`, `docs/queue.md`
- `docs/prompts/130-close-129-and-backfill-october.md` and `docs/prompts/README.md`

Anything outside this list is a stop, not a judgment call.

## Joe's decision, 2026-10-14 (record it verbatim)

At prompt 129's Stop 2, Claude Code recommended running the two anchored refreshes despite the NFL regression it had found. Cowork recommended holding them until that regression was fixed. **Joe chose to hold** and asked for the close-out and the fix to come as one prompt: *"Combine this prompt and prompt 130 into one prompt."* His ruling 6 of 2026-10-14 still stands: *"The archive is backfilled."*

---

## Part 0: close prompt 129

1. **If this chat ran prompt 129,** this brief answers its Stop 2. No dispatch happened at that stop. **If this is a new chat,** read `docs/handoff-status.md` and register §74 first, and expect prompt 129's last commit to be `8671da3`.
2. **A dev server left from prompt 129 may still be on :3000.** Stop it by its command line (rule 35). If anything was building, follow rule 36 as well.
3. **In `docs/handoff-status.md`, record that prompt 129 closed at Stop 2 without its backfill.** The backfill moves to this prompt by Joe's decision above. `acc-extra` stays on the guard's list until Block A.

**Commit:** `docs: prompt 129 closes at stop 2, and its backfill moves to prompt 130 by joe's decision`

## Block A: confirm last night's refresh, the first run with prompt 129's Block H

Prompt 129's Block H (`b1affff`) credits MLB observations to `mlb.statsapi` and closes their `espn.scoreboard` predecessors. It landed after Joe's 2026-10-14 refresh, so the 4:00 AM run on 10-15 is its first run. Cowork measured on 10-14 that all 28 active MLB observations in the window still carried `espn.scoreboard`.

Through the anon key, report each of these:

1. **Credit.** Every active MLB observation for 10-14 onward is `mlb.statsapi`. Every `espn.scoreboard` predecessor on those games has `valid_to` set by that run. No MLB game reads `authority_conflict`.
2. **MLB rows.** The broadcast rows match what Joe's 10-14 refresh produced:
   - NLCS Games 3–6 on `fs1`, `available`
   - Game 7 on `fox`, `available`
   - ALCS games on `tbs`, primary, and `trutv`, both `available`
3. **Cancellations.** Print that run's `refresh_runs.notes` `cancellations` list. If the list is not empty, check each game against statsapi.
4. **ACC Extra.** Check `401858262`: its `acc-extra` row should be `active = false`, and an `accnx` row should be active. If so, remove `acc-extra` from the guard's list in `smoke.mjs` (Joe ruled 2026-10-14 that ACC Extra is ACCNX). Smoke stays green.

**If items 1 or 2 fail, STOP and report.** The backfill must not run on a broken Block H.

**Commit:** `smoke: acc extra leaves the unknown-access list now that its row reads accnx`

## Block B: a past-date refresh uses its own week's coverage windows (queue item 24)

**The defect.** The windows step (`schedule_refresh.yml:106`) runs `adapters.es_windows` with no week, so `es_windows.py:164-170` picks the week containing the real clock. For a past Sunday, rule 4b then has no windows, and regional CBS and FOX games without the Browns fall to rule 6 (UNVERIFIED). Register §74 measured what the two anchors would do:

- **10-04:** 2 available + 5 out-of-market decided CBS rows would become Market TBD, and 5 FOX rows would stay undecided.
- **10-11:** 1 available + 3 out-of-market decided CBS rows would become Market TBD, and 6 FOX rows would stay undecided.

Those games would also drop off the archived NFL grids (`render_day.py:151`, `OMIT_ACCESS`).

**EntitledSports does serve past weeks.** Cowork fetched week 5 on 2026-10-14. The page was updated Mon Oct 12, 1:26 PM ET, and shows these windows for Cleveland:

| Window | Game |
|---|---|
| CBS early | CLE@NYJ (WOIO) |
| CBS late | TBD |
| FOX early | CHI@GB |
| FOX late | SF@SEA |

**The fix.**

1. **Measure first.** Fetch week 4 and week 5 through `es_windows.parse_page` and print Cleveland's windows for each. If week 4 is not served, STOP.
2. **Give `adapters/es_windows.py` a `--date D` option.** It sets `now` to D (pick the hour and say why), and the weeks come from ESPN's calendar for that date: `weeks_from_calendar` (`:110-121`) and `default_fetch_scoreboard` (`:128-129`) already take `now`.
3. **Pass the date only on a dated dispatch.** The workflow step passes `--date` only when the dispatch named a date. **The nightly command line must not change.** Pin both shapes in `tests/test_workflows.py` (rule 28).
4. **Run a dry-run prediction. No database write and no dispatch.**
   - Build the windows for anchor 2026-10-04, run `adapters.espn --league nfl` for 10-04, and print every regional CBS and FOX row's new decision beside the decision the database holds. Do the same for 2026-10-11.
   - **Expected:** all 11 decided CBS rows stay unchanged; 10-11's undecided CBS-late row stays UNVERIFIED, because week 5's CBS late is TBD; and the 11 FOX rows receive decisions.
   - **A decided row that would change is a finding: STOP.**
5. **Tests**, each mutation-checked:
   - `--date` picks the anchor's week and the next one.
   - No `--date` behaves exactly as today.
   - The workflow passes the flag only on a dated dispatch.

**Commit:** `windows: a refresh anchored on a past date reads that week's coverage windows, so a backfill keeps sunday's decisions`

## Block C: the archived desktop grid drops cancelled and postponed games (queue item 23)

Joe's ruling 4 of 2026-10-14 says a cancelled or postponed game comes off the grid and stays in the list. Prompt 129 applied it to the mobile grid. The archived render ignores it:

- `pipeline/render_feed.py`'s `GAMES_SQL` (`:38-51`) does not select `result_status`.
- `scripts/render_day.py` has no test for either state.

**The fix.**

1. Select `result_status`, carry it through to the renderer, and skip a cancelled or postponed game before it reaches a row, beside the `OMIT_ACCESS` filter at `:412`.
2. **Rule 32.** Enumerate every path that draws an archived block, including the CFB week render, and make each one obey.
3. **Tests**, each mutation-checked:
   - A cancelled game is absent from the render feed's rows.
   - A postponed game is absent.
   - A scheduled game is present.
   - A `final` game is present.

**Commit:** `render: the archived grid draws no block for a cancelled or postponed game, as the mobile grid already does`

## Block D: render past days on demand, so the backfill reaches the archive

A dated `schedule_refresh` renders only its anchor day (`render_all.yml:45-70`, register §74). So the two anchors would re-render 10-04 and 10-11 and leave 10-03 and 10-05 through 10-12 as they were drawn. That leaves three problems:

- the four never-played games still on 10-08 to 10-10
- NLCS Games 1 and 2 missing from 10-11 and 10-12
- the NL Division Series games drawn under the stub lane name

`render_all.yml` already accepts a dispatch `date`.

**The fix.**

1. **Add a `days` dispatch input to `render_all.yml`.** The default is 1. It renders D through D+days−1, each day through the existing loop. The `workflow_call` path that the nightly uses must behave exactly as today. Pin that in `tests/test_workflows.py`.
2. **Render a past Saturday's CFB from its own week.** For a Saturday in the past, the CFB branch (`:61-68`) must render the week the database gives that Saturday, not `--latest-week`. Otherwise a render of 10-10 overwrites that day's archive with a later week's slate. The nightly keeps `--latest-week` for today.
3. **Timeout.** Read the duration of recent `render_all` runs (`gh run list --workflow render_all.yml`), estimate a 10-day render, and set the timeout or a cap on `days` so the run fits. Report the numbers.
4. **Do not change the concurrency group.** It is `mysports-render` with `cancel-in-progress: true`, so a second render cancels the first. Say this plainly in the stop message.

**Commit:** `render: a dispatch can render a range of past days, and a past saturday renders its own cfb week`

## Block E: CLAUDE.md's two stale lines

Correct the "Read first" table's prompt-archive line (it still says "135 briefs covering 01–128") and its register range (it still says "§1–§73"). Count both from the tree after this brief is filed (rule 30). Touch nothing else in `CLAUDE.md`.

**Commit:** fold this into Block F's commit.

## Block F: the record, then STOP for the backfill

1. **Register §75.** Record:
   - Joe's decision, verbatim
   - Block H's first run, from Block A
   - the windows fix and its dry-run table
   - the archived-grid rule
   - the render range

   **Close queue items 23 and 24.** File this brief byte-identical to `docs/prompts/130-close-129-and-backfill-october.md` and update the README. Commit and push.
2. **STOP.** Give Joe the exact dispatch list.
   - **Cowork expects three dispatches,** one at a time, each finishing before the next starts:
     1. `schedule_refresh`, date `2026-10-04`. Wait for its refresh **and** its render job.
     2. `schedule_refresh`, date `2026-10-11`. Same wait.
     3. `render_all`, date `2026-10-03`, days `10`. This re-renders 10-03 through 10-12 from the corrected rows.
   - **Confirm or correct that list against the workflows.** If Block D's timeout analysis says 10 days will not fit in one run, split the render into two dispatches.
   - **Do not dispatch (S2).**
3. **After Joe says "continue," report each of these through the anon key:**
   - The four Division Series games (`mlb-849837`, `-849824`, `-849821`, `-849836`) read `cancelled`.
   - The cancellation notes name exactly those four.
   - The NL Division Series games on FS1 (10-03 to 10-07) carry `fs1`, `available`, and `PLAYOFF`.
   - `mlb-849809` and `mlb-849812` carry `fox`, `available`, and `PLAYOFF`.
   - The 10-04 and 10-11 NFL regional rows match Block B's dry run, and none of the 11 decided CBS rows has moved.
   - The 10-10 CFB FOX games carry `fox`, `available`.
   - MLB observations in both windows are `mlb.statsapi`, and their predecessors are closed.
   - No `authority_conflict` appears anywhere.
4. **Look at the pictures.** Fetch these published archived grids and open them at pixel scale:
   - MLB 10-08: TB@NYY is absent
   - MLB 10-11: NLCS Game 1 is on FOX
   - NFL 10-04: the FOX games are present

   Name the URLs you opened. A passing query and a correct picture are different claims.
5. **Record the result in `docs/handoff-status.md`.** Add an open item for **device confirmation (rule 25):** on Joe's phone, 10-08 shows no Rays–Yankees Game 4, and 10-11 shows NLCS Game 1 on FOX as watchable. Commit with `docs: the archive is backfilled 10-03 to 10-12 and the four unplayed division series games are cancelled`.

---

## Not in scope, deliberately

- **No database write and no dispatch by this session (S2).** Every write here happens in a run Joe dispatches.
- **September stays as it is.** Joe's backfill ruling covers October only.
- **No other `CLAUDE.md` edits** beyond the two lines in Block E.

## Gates and committing

Run all five gates as their own commands before every commit. Read the floors from `docs/handoff-status.md` under "Repo state", and report all five against them.

Every block self-commits and pushes under rule 7, with the stop list unwaived. Block F follows its own stop.

End with the undo block:

- the real SHAs, newest first
- the one-way stages: none in the code, but the three dispatches rewrote past rows and archived grids, and the report must say which ones
- the Vercel result
