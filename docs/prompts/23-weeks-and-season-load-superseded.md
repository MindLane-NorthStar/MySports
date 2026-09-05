# Claude Code — Prompt 23: full season load and the Weeks page

**Venue:** Claude Code in VS Code, laptop, `C:\Users\jlull\Joe's Projects\Apps - Personal\MySports`.
**Mode:** unattended rails. Self-committing stages. Retry once, then log-and-skip.

**This prompt loads data. Joe pre-authorizes the season bootstrap**, under the standing rules: **additive inserts only**, backup first, no destructive statement, SELECT-and-paste before anything that removes or rewrites a row. No migration.

**Run prompt 22 first** — it repairs the listings card, the Guardians TV mark and the desktop grid, and its shared banner-gap fix also closes Joe's first Weeks finding.

---

## Preconditions

1. Branch `main`; working tree clean apart from untracked `assets/` and `artifacts/`.
2. **Prompt 22 is merged and pushed.** Record its HEAD in the report.
3. Python, `test:unit` and `smoke` counts all at prompt 22's reported values.

## Working rules (binding)

1. Certify Python for Windows: no `%`-strftime, explicit `encoding=`, ASCII console output.
2. Secret gate every commit, ADDED lines only: `git diff -U0 --cached | grep "^+"`. Never `findstr`.
3. Stage by explicit path; never `git add -A`.
4. Each stage commits and pushes on its own; report the `rev-parse` pair.
5. **Run-workflow-never-Re-run** when dispatching Actions.
6. **Do not run `npm ci`**; `next build` fails locally on the apostrophe in `Joe's Projects`. Use `next dev`.
7. `npm run test:unit` is `node --test "test/**/*.test.mjs"` — quoted glob.
8. Name every bend in the judgment log.

---

## Stage 1 — Teach `bootstrap_season.yml` to load a season's games

**`.github/workflows/bootstrap_season.yml` does not currently load a season.** Its CFB step runs `adapters.cfbd --week 1 --teams` and its NFL step runs `adapters.espn --league nfl --teams-only` — teams and logos only. Then "Load every fixture on disk" loads whatever happens to be there. **That is why only CFB weeks 1 and 8 and NFL week 1 exist in the database.**

Both adapters already accept `--week` (`adapters/cfbd.py:117`, `adapters/espn.py:271`), so this is a workflow change, not adapter work.

1. Add two `workflow_dispatch` inputs — `cfb_weeks` (default `1-15`) and `nfl_weeks` (default `1-18`) — and loop the game fetch over each range, **regular season only** (`--season-type regular` for CFBD). Keep the workflow **manual-dispatch only**.
2. **A week that returns zero games is logged and skipped, never fatal** — season lengths vary and the bound is a guess, so the loop must survive overshooting it. Report which weeks actually returned games.
3. Keep the existing teams/logos step, `pipeline.bootstrap`, `pipeline.load --all` and `pipeline.reconcile --all` as they are.
4. **Do not change `schedule_refresh.yml`.** The daily refresh stays scoped to the current CFB week and the coming NFL Sunday; a full-season load is a one-time bootstrap, not a daily cost. **Confirm this explicitly in the report.**
5. `timeout-minutes` is currently 30 and `reconcile --all` will now walk roughly 1,200 games. Raise it if needed and **report the actual wall-clock duration**; if it still times out, split the run by sport rather than trimming what it reconciles.

Commit: `feat(ci): bootstrap_season loads a season's games, not just teams`. Push, report the pair.

## Stage 2 — Run it

1. **Back up first**, per the standing rule, and paste the confirmation.
2. Record row counts **before**: `games`, `game_broadcasts`, `viewer_game_eligibility`, and the distinct `(sport, season, week)` list.
3. Dispatch `bootstrap_season` with `season=2026`, `sports=cfb,nfl`. **Run workflow — never Re-run.**
4. Record the same counts **after**, plus the new distinct week list, and the duration.
5. **Sanity gate — HARD STOP if any holds:** CFB comes back with fewer than 10 distinct weeks; NFL with fewer than 15; any pre-existing row count *decreases*; or `viewer_game_eligibility` does not grow to cover the new games.
6. Note in the report that the orphan **CFB week 8** is no longer an orphan once its neighbours load — no cleanup needed, and none should be attempted.

Commit only what the run changed in the repo (fixtures are gitignored, so this may be a no-op commit — say so if it is). Report the pair.

## Stage 3 — Weeks page: cut the explanation and the derivation metadata

In `web/app/weeks/page.js`:

1. **Delete the `<p className="sub">` explainer** under the "Weeks" heading — the two-sentence paragraph about calendar versus season weeks. The distinction is carried by the View control; it does not need prose.
2. In the **season** week block: keep the date range, **delete `(derived from the games)`** and **delete the whole `N games · N days` line**.
3. In the **calendar** week block: apply the same trim — keep the date range, **delete the `N games · <sports>` line**. *(Cowork's call: Joe named the season view, but leaving one view verbose and the other terse reads as a bug. Flagged for his veto.)*
4. Nothing else on the page changes in this stage.

Commit: `feat(web): trim the Weeks page to the heading, the picker and the date range`. Push, report the pair.

## Stage 4 — The week picker

**Joe's ruling:** *"Lets do a dropdown from the chip — of all the weeks, BUT make the default view the current week."*

1. **Labels.** `WeekPicker`'s season label currently does `SPORT_LABEL[w.sport].split(' ')[0]`, which is why it reads "College wk 1". It must read **`CFB Week 1`** and **`NFL Week 1`** — the sport's short code, the word "Week", the number.
2. **Replace the chip row with one chip-styled control that opens a native `<select>`**, so it stays one line at every width and never wraps. Group the options with `<optgroup>` by sport. Keep the existing chip's visual language for the trigger.
3. **The URL stays the source of truth.** Changing the select navigates to `/weeks?view=season&w=<key>`, so `?w=` deep links, browser back/forward and the existing keys all keep working exactly as they do now.
4. **Default to the current week when `?w=` is absent** — today it defaults to `all[0]`, which is why you land on CFB Week 1. The rule, in order:
   1. the entry whose span contains today's **ET viewing day**;
   2. if more than one qualifies, the one whose **start is latest**;
   3. if none contains today, the **next upcoming** entry;
   4. if none is upcoming, the **most recent past** entry.
5. **Apply the same current-week default to the calendar view**, which also lands on `all[0]` today. *(Cowork's call; flagged for veto.)*
6. Unit tests for the default-selection rule covering all four branches, including the overlap case (CFB week 1 spans Aug 29 – Sep 7 while NFL week 1 begins inside it).
7. Keep the control accessible: a real labelled `<select>`, keyboard operable, with the current selection announced.

Commit: `feat(web): week dropdown grouped by sport, defaulting to the current week`. Push, report the pair.

## Stage 5 — QA and report

Capture `/weeks?view=season` and `/weeks?view=calendar` at **390, 1024 and 1440 px** into `artifacts/qa/2026-09-03-weeks/`, plus the qa-shots set. Keep the 8 behavioural assertions green. **Look at the shots** and say what is still wrong.

Report: prompt 22's HEAD and this prompt's rev-parse pair and commit chain; **Stage 1's confirmation that the daily refresh is unchanged**; **Stage 2's before/after row counts, the full new week list, the duration, and the sanity-gate verdict**; the rendered week block for CFB Week 1 after the trim; **which week the page defaults to and why**; test counts; what the shots show; and the judgment log.

## Hard stops

1. Secret gate trips, or a push is rejected.
2. Stage 2's sanity gate fires.
3. Any row count decreases, or any destructive statement is required.
4. The season load would change `schedule_refresh.yml`'s daily scope.
5. Prompt 22 has not been merged.

## Out of scope

- The time-adaptive band, the "See all today" escape and the ≥1,600 px composition — **prompt 24**.
- Postseason weeks: bowls, the CFP and the NFL playoffs. **Regular season only** (Joe's ruling); postseason lands when the provider labels real brackets.
- E10 empty-state copy, the grid "now" marker, the loader enum-hardening, and the `unverified` documentation note — all ride rendering-contract v1.7.
