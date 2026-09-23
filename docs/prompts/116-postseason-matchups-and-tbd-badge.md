# Prompt 116: Postseason games take their real teams when MLB names them, and placeholders show a TBD badge

This builds on `2485c89` (prompt 114 rev B, pushed 2026-09-23). Before starting, check two things:

- `git rev-parse --short HEAD` and `git rev-parse --short origin/main` both return `2485c89`.
- `git status --porcelain` shows only untracked `assets/` entries.

If either check fails, stop and report.

*(Numbering: 115 stays reserved for preemption, so this run is 116.)*

Written by Cowork on 2026-09-23 from a read of the tree at `2485c89` through the device bridge, a read-only SELECT through the Supabase connector, and the prompt 114 rev B crops in `assets/p114-ipad-scrim/placeholders-0929/`. **Verify every file:line before acting on it.**

**There is a deadline.** MLB's regular season ends Sunday, 2026-09-27. The first refresh after the seeds clinch is `schedule_refresh.yml`'s `37 7 * * *` run on 2026-09-28 (3:37 AM ET). Block A must be on `main` before that run, or the four Wild Card games reach Monday still showing the placeholder teams.

---

## What Cowork found

**1. The loader never updates a game's teams after the first insert.** In `pipeline/load.py:202`, the games upsert is `db.upsert("games", [game], "id", ["season", "week", "neutral_site"], tag="games")`. On conflict it updates those three columns only. `home_team_id` and `away_team_id`, set at `:196`, are written once, when the row is created. Nothing else in the pipeline writes them. Cowork searched `pipeline/`, `adapters/`, `scripts/*.py` and `db/migrations/`: the only other occurrences are reads, in `reconcile.py:44`, `:130`, `:286`, `render_feed.py:46`, `enrich_cfb.py:97-105`, and the two `backfill_*` scripts.

`docs/research/mlb-adapter-brief.md:347` says that once MLB fills in the participants, "the same `gamePk` rows update in place." For the kickoff time and the broadcasts that is true: both are written as observations, and `pipeline/reconcile.py` resolves them on every run (`load.py:225-284`). **For the teams it is not true.** When MLB replaces "AL Wild Card #2" with a real club, the adapter emits the new id (`adapters/mlb.py:325-331`, `side()`), and the loader drops it.

**2. The data as of 2026-09-23.** Four games on 2026-09-29 carry the placeholder teams. The placeholder kickoff is `07:33:00Z`, which is 3:33 AM ET.

| game | away | home |
|---|---|---|
| `mlb-849843` | `mlb-4945` NL Wild Card #2 | `mlb-4619` NL Wild Card #1 |
| `mlb-849845` | `mlb-4947` NL Wild Card #3 | `mlb-4617` NL #3 Seed |
| `mlb-849849` | `mlb-4946` AL Wild Card #3 | `mlb-4614` AL #3 Seed |
| `mlb-849851` | `mlb-4944` AL Wild Card #2 | `mlb-147` Yankees |

The Division Series, LCS and World Series games will arrive the same way as the 6-day MLB window (`schedule_refresh.yml:95-98`) reaches them.

**3. The broken image.** Placeholder ids have no logo on R2, so every `<img src={teamLogoDarkUrl(id)}>` draws the browser's broken-image icon. Cowork saw it at pixel scale in `phone-390x844__list__2-mlb-4617.png`: both teams broken, "NL Wild Card #3" at "NL #3 Seed". It also appears in `__4-mlb-4944.png`, on the away side. The call sites, found by searching `components/`, `app/` and `lib/` for `teamLogo`:

| call site | draws |
|---|---|
| `components/MatchupCard.js:108` | the list row's team logo |
| `components/MatchupCard.js:256` | the slot's favored-team mark |
| `components/GameDetail.js:182` | the detail panel's away logo |
| `components/GameDetail.js:186` | the detail panel's home logo |
| `components/MobileGrid.js:693-694` | the grid endcap art |

TBD-kickoff games do not take a grid position today, so the grid endcap is not reached by these games. Guard it anyway.

**4. The predicate already exists.** `web/lib/placeholders.js` has `isPlaceholderTeam(team)`: the `-TBD` suffix, or an MLB row named `/^(AL|NL) (#\d+ Seed|Wild Card #\d+)$/`. The game embed (`lib/queries.js:38-39`) carries `id` and `canonical_name` but not `sport`. Pass `game.sport` in. Do not widen the select.

---

## Block A: the loader follows the source for a game's teams (the deadline block)

1. **At `load.py:202`, add `home_team_id` and `away_team_id` to the upsert's update list.** The adapter is the authority on who plays in a given external game id. That is already true for every other identity field it emits, and a placeholder turning into a club is exactly the correction this must carry.
2. **Log every change.** Before the upsert, read the stored pair for `gid` (one SELECT, and in dry-run mode emit it as SQL, as the file does elsewhere). When either side differs, add a line to the run's `notes`: `"<gid>: home <old> -> <new>"` and/or away. That way a flip is visible in `refresh_runs` and never silent. Count the changes in `counts` under a new key.
3. **Never write a missing id.** If a side's `id` is `None` or empty, keep the stored value for that side and add a note. `str(None)` would write the literal text `"None"`. Report what the loader does with a `None` side today, because the FK stub at `:176-179` would try to insert team `"None"`.
4. **Tests in `tests/`.** Use the existing dry-run or emit mode to show the games upsert's `DO UPDATE` carries both team columns. Then load a two-step fixture: first `mlb-849851` with `mlb-4944` away, then the same game with a real club. Assert the stored away id changes and the note is written. Also add a `None`-side case.
5. **Mutation checks:** drop each team column from the update list, drop the note, and drop the `None` guard. Show each one going red, then restore it.
6. **Out of scope:** changing `reconcile.py`, the kickoff or broadcast paths (they already update), or any adapter. Delete no team rows. The seven placeholder rows stay in `teams`.

## Block B: a TBD badge where a placeholder's logo would be

**Joe's ruling, 2026-09-23: a gray "TBD" badge**, in the same box as the logo it replaces, so names stay aligned with every other card.

1. **One small component**, for example `web/components/TeamMark.js`. It renders the badge when the team is a placeholder, and the existing `<img>` otherwise. Use it at every call site in the table above, passing `{ ...team, sport: game.sport }`.
2. **Also catch a logo that fails to load.** The name pattern is deliberately narrow, and a later round's placeholder, such as a Division Series winner, will not match it. So add an `onError` on the `<img>` that swaps to the badge. **Verify this works after server rendering and hydration.** Load a page in Chromium whose logo 404s, cold, and confirm the badge shows and no broken icon is painted. If the error fires before hydration and is lost, say so and handle it; `img.complete && img.naturalWidth === 0` on mount is the usual check.
3. **The look.** A rounded box the size of the logo box at each site. The fill and text use existing neutral tokens from the token block, never retyped hex values (rule 16). The text reads `TBD` in the app's condensed face. It must fit the list logo box at 390 without clipping. Report the token names you used.
4. **Rule 23.** Check whether `docs/design/mobile_demo.html` draws a placeholder team. Cowork expects it does not. Change it only if it does, and say what you found.
5. **Pictures, in `assets/p116-tbd-badge/`.** Show the four 2026-09-29 games in LIST at 390 × 844 and at 1366 × 1024 coarse, and the detail panel for `mlb-849845` (both sides placeholders), before and after, at 1× and 4×. Also include one ordinary MLB card, byte-identical before and after, to prove real teams are untouched.
6. **Tests:** the component renders the badge for a placeholder and the `<img>` for a club, and the error path swaps to the badge. **Mutation checks** on each.

## Block C: documents

- **Register §61**, after confirming §1–§60 each appear once. Record the loader gap and the correction to `mlb-adapter-brief.md:347`, the badge ruling, and the error fallback and why it exists.
- **`docs/research/mlb-adapter-brief.md:347`:** add a dated note that team identity did not update in place until prompt 116. Leave the rest of the sentence as history.
- **`docs/handoff-status.md`:** the gate line as usual. Add an OPEN item: *confirm on 2026-09-28, after the 07:37 UTC refresh, that the four Wild Card games carry real teams, times and networks.* (Cowork will check with a read-only query.)
- **`docs/queue.md`:** add an item noting that smoke's placeholder check will turn red when Division Series placeholders load under a new name. That red is deliberate (register §60), and it needs a ruling on the new name form, not a code workaround.
- **File this brief** byte for byte as `docs/prompts/116-postseason-matchups-and-tbd-badge.md`, from `Claude outputs\prompt-116-postseason-matchups-and-tbd-badge-2026-09-23.md`. Update the README and `CLAUDE.md` counts by their own convention.

---

## Gates, commits and push

Run all five gates, each as its own command, reading the floors from `docs/handoff-status.md` under "Repo state". For each gate that moves, report which gate, by how much, and why, and move its floor row in the same keystroke.

**Commit per block (A, B, C) on green, then push `main`** under `CLAUDE.md` rule 7's default. Joe authorized pushing for this run because of the Sunday-night deadline. If any gate is red, commit nothing, push nothing, and report. Block A alone is the deadline: if Block B cannot go green, commit and push A and C, leave B's work in the tree, and say so.

After the push, wait for the Vercel production deployment to reach READY and report it. End with the undo block: the reverts in reverse order with the real SHAs and the push that would deploy them, whether anything was one-way, and whether the next scheduled refresh will run the new loader (`schedule_refresh.yml` runs from `main`; confirm that from the workflow, not from this brief).
