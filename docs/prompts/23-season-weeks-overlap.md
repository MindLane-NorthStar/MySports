# Claude Code — Prompt 23: season load, the Weeks page, and the overlap rule

**Venue:** Claude Code in VS Code, laptop, `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports`.
**Mode:** unattended rails. Self-committing stages. Retry once, then log-and-skip.

**This prompt loads data. Joe pre-authorizes the season bootstrap** — additive inserts only, backup first, no destructive statement, SELECT-and-paste before anything that removes or rewrites a row. No migration.

**Cite repo paths only.** Prompt 22 named `claude/src/mobile_demo.html` as an authority; that is a Claude *project* document and is not in this repo. Every authority named below is a real file you can open. If a prompt ever names a path that does not exist, say so and verify against the in-repo sources instead — exactly as you did.

---

## Preconditions

1. Branch `main`; `git rev-parse --short HEAD` == `e826d23`.
2. `python -m unittest discover tests` → **191 OK (skipped=1)**; `cd web && npm run test:unit` → **98/98**; `npm run smoke` → **30/30**.
3. **The tree may carry modified `docs/` files** — Cowork updates `docs/handoff-status.md` and `docs/feature-study/05-home-page-decisions.md` after each run. That is expected, not a precondition failure. **Stage 1 commits them.**

## Working rules (binding)

1. Certify Python for Windows: no `%`-strftime, explicit `encoding=`, ASCII console output.
2. Secret gate every commit, ADDED lines only: `git diff -U0 --cached | grep "^+"`. Never `findstr`.
3. Stage by explicit path; never `git add -A`.
4. Each stage commits and pushes on its own; report the `rev-parse` pair.
5. **Run-workflow-never-Re-run** when dispatching Actions.
6. **Do not run `npm ci`**; `next build` fails locally on the apostrophe in `Joe's Projects`. Use `next dev`.
7. `npm run test:unit` is `node --test "test/**/*.test.mjs"` — quoted glob.
8. **Never edit a source file with a bare repeated string replace.** Prompt 22 corrupted `web/lib/offservice.js` that way, and prompt 20 corrupted `data/render_policies.json`. Use line-anchored surgery or a parser, and assert only the intended region changed.
9. Name every bend in the judgment log.

---

## Stage 1 — Land the pending docs

Commit whatever `docs/` files Cowork has modified since `e826d23`. Stage those paths alone.

Commit: `docs: session records through prompt 22`. Push, report the pair.

## Stage 2 — Teach `bootstrap_season.yml` to load a season, then DISPATCH IT AND MOVE ON

**`.github/workflows/bootstrap_season.yml` does not load a season.** Its CFB step runs `adapters.cfbd --week 1 --teams` and its NFL step runs `adapters.espn --league nfl --teams-only` — teams and logos only — then loads whatever fixtures happen to be on disk. **That is why only CFB weeks 1 and 8 and NFL week 1 exist.** Both adapters already accept `--week` (`adapters/cfbd.py:117`, `adapters/espn.py:271`), so this is a workflow change.

1. Add `workflow_dispatch` inputs `cfb_weeks` (default `1-15`) and `nfl_weeks` (default `1-18`); loop the game fetch over each range, **regular season only** (`--season-type regular` for CFBD). Keep it **manual-dispatch only**.
2. **A week returning zero games is logged and skipped, never fatal** — the bound is a guess and the loop must survive overshooting it.
3. Leave the teams/logos step, `pipeline.bootstrap`, `pipeline.load --all` and `pipeline.reconcile --all` as they are.
4. **Do not change `schedule_refresh.yml`.** The daily stays scoped to the current CFB week and the coming NFL Sunday. **Confirm this explicitly in the report.**
5. `reconcile --all` will now walk roughly 1,200 games against a 30-minute timeout. Raise the timeout if needed; report actual wall-clock. If it still times out, split by sport rather than reconciling less.
6. **Back up first** and paste the confirmation. Record row counts **before**: `games`, `game_broadcasts`, `viewer_game_eligibility`, and the distinct `(sport, season, week)` list.
7. Commit the workflow change, then **dispatch** `bootstrap_season` with `season=2026`, `sports=cfb,nfl`.
8. **Do not wait for it.** Go straight to Stage 3. Stages 3–5 are code changes that do not depend on the data; Stage 6 collects the result at the end. This is the whole point of running it now.

Commit: `feat(ci): bootstrap_season loads a season's games, not just teams`. Push, report the pair.

## Stage 3 — The overlap rule (Joe's ruling, all sports, all days)

**Today:** two programs on the same network whose blocks overlap force a second lane row (`lane_policy: alt_lane`). A 12:30 kickoff and a 3:30 kickoff, each given a 210-minute block, overlap by 30 minutes — and that alone generates a whole extra row.

**Joe's rule:** when two programs on the same network row overlap, **split the difference**. Shrink the earlier one's end and the later one's start by **half the overlap each**, so they meet at the overlap's midpoint and sit side by side in one row. In his example — 12:30 ending 4:00 and 3:30 ending 7:00 — both become 3:45, and the boundary is drawn there.

**Threshold (Joe's ruling): overlaps of 60 minutes or less split. More than 60 minutes generates the second row**, as today.

Implementation requirements:

- **Pairwise only.** Where three or more programs on one network mutually overlap, fall back to lanes — a network airs one thing at a time, so a three-way overlap means the block estimates are wrong and squeezing three chips would hide that. *(Cowork's call; flagged for Joe's veto.)*
- **Minimum chip width guard.** If splitting would leave either chip under **60 minutes** of rendered width, fall back to a second row instead. A squeezed chip that cannot show its matchup is worse than an extra row. Report how often this fires on the Sept 5 and Sept 13 slates.
- **The adjustment is presentational only.** It changes the rendered block, never `canonical_kickoff_at_utc`, never `block_minutes`, never anything written to the database. The detail panel still shows real times.
- **This is a rendering-contract change.** Document it in **`docs/rendering-contract.md`** and **`docs/rendering-contract-mobile.md`**, with the changelog entry at the top of each per the file convention, and bump the contract tag.
- **It must land in BOTH renderers** — `scripts/render_day.py` (the archived PC grid) and `web/components/MobileGrid.js` / `web/lib/gridmodel.js` (the live phone grid) — because the two are separate implementations of one design. **Pin them together with shared fixtures**: a small set of overlap cases (no overlap, 15 min, 30 min, 60 min, 61 min, three-way, and one that trips the width guard) asserted to produce identical placement in both. Put the fixtures where both test suites can read them, alongside `tests/fixtures/`.

Commit: `feat(grid): overlapping programs split the difference up to 60 minutes (both renderers)`. Push, report the pair.

## Stage 4 — The Weeks page

In `web/app/weeks/page.js`:

1. **Delete the `<p className="sub">` explainer** under the "Weeks" heading.
2. **Season week block:** keep the date range; delete `(derived from the games)`; delete the whole `N games · N days` line.
3. **Calendar week block:** same trim — keep the date range, delete the `N games · <sports>` line. *(Cowork's call: Joe named the season view, but leaving one verbose and one terse reads as a bug. Flagged for veto.)*
4. **Labels.** `WeekPicker`'s season label does `SPORT_LABEL[w.sport].split(' ')[0]`, which is why it reads "College wk 1". It must read **`CFB Week 1`** and **`NFL Week 1`**.
5. **Replace the chip row with one chip-styled control that opens a native `<select>`**, grouped by sport with `<optgroup>`, so it stays one line at every width. Keep the chip's visual language for the trigger.
6. **The URL stays the source of truth** — changing the select navigates to `/weeks?view=season&w=<key>`, so `?w=` deep links and browser back/forward keep working.
7. **Default to the current week when `?w=` is absent.** It currently defaults to `all[0]`, which is why you land on CFB Week 1. In order: the entry whose span contains today's **ET viewing day**; if several, the one whose **start is latest**; if none contains today, the **next upcoming**; if none upcoming, the **most recent past**.
8. **Apply the same current-week default to the calendar view.** *(Cowork's call; flagged for veto.)*
9. Unit tests for all four branches of the default rule, including the real overlap case — CFB week 1 spans Aug 29 – Sep 7 while NFL week 1 begins inside it.
10. Keep the control accessible: a real labelled `<select>`, keyboard operable.

Commit: `feat(web): week dropdown grouped by sport, defaulting to the current week`. Push, report the pair.

## Stage 5 — Collect the season load

1. Record row counts **after** and the new distinct `(sport, season, week)` list, plus the run's wall-clock duration and which weeks returned games.
2. **Sanity gate — HARD STOP if any holds:** CFB has fewer than 10 distinct weeks; NFL has fewer than 15; any pre-existing row count *decreased*; `viewer_game_eligibility` did not grow to cover the new games.
3. Note that the orphan **CFB week 8** stops being an orphan once its neighbours load — no cleanup, and none should be attempted.
4. Re-run the Stage 4 default-week test against the now-full week list and confirm the page lands on the correct current week.

## Stage 6 — QA and report

Capture `/weeks?view=season`, `/weeks?view=calendar`, and `/?day=2026-09-05&sport=cfb` at **390, 1024 and 1440 px** into `artifacts/qa/2026-09-03-weeks/`, plus the qa-shots set. Keep the 8 behavioural assertions green. **Look at the shots** and say what is still wrong.

Report: rev-parse pair and commit chain; Stage 2's confirmation that the daily refresh is unchanged; **Stage 3's overlap fixtures and how often the width guard fired**; the rendered CFB Week 1 block after the trim; **which week the page defaults to and why**; **Stage 5's before/after counts, full week list, duration and sanity-gate verdict**; test counts; what the shots show; and the judgment log.

## Hard stops

1. Secret gate trips, or a push is rejected.
2. Stage 5's sanity gate fires.
3. Any row count decreases, or any destructive statement is required.
4. The season load would change `schedule_refresh.yml`'s daily scope.
5. The two renderers cannot be made to agree on the overlap fixtures.

## Out of scope — prompt 24 owns these

- **The logo two-state audit and rule**, and **porting the PC renderer's chip treatment into the mobile grid.** Prompt 22's Stage 4 measured the colour path as intact end to end (Brewers band = `rgb(19,38,67)`), so the problem is that a dark primary tinted for the band lands too close to the charcoal ground to read — a treatment question, not a plumbing bug. That belongs with the logo audit.
- **The mobile page reorder** (YOUR TEAMS → grid → rest of list) — deliberately sequenced *after* the grid is worth promoting.
- The `@` trailing to the end of line 1 when the duel wraps at 390 px, and the 78 px time column (the reference stacks the time over "ET"; this app renders them inline, costing 20% of a 390 px card's width). Both are mobile-pass items for 24.
- E10 empty-state copy, the grid "now" marker, loader enum-hardening, and the `unverified` documentation note — all ride rendering-contract v1.7.
