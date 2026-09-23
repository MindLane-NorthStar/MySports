# Prompt 119: Each week's page stands alone, and playoff games are national

This builds on `5dc2087` (prompt 118). Before starting, confirm:

- `git rev-parse --short HEAD` and `git rev-parse --short origin/main` both return `5dc2087`.
- `git status --porcelain` shows only untracked `assets/` entries.

If either check fails, stop and report.

**Verify every file:line before acting on it.** Cowork read the tree at `5dc2087` on 2026-09-23.

---

## Joe's rulings, 2026-09-23

**1. Each week's page is judged on its own.** Prompt 118's report flagged that a failed next-week fetch suppresses the current week as well. `adapters/es_windows.py:148-159` wraps the week list and `build(weeks, …)` in one `try`, so any exception writes no file. Cowork's brief asked for exactly that ("a failure of any kind"), and it was wrong for this case. In the season's last regular week, the next page does not exist.

- Fetch and parse each week independently.
- A week that fails (HTTP error, block missing, fewer than four windows) is left out, with one note naming the week and the reason.
- Write the file whenever at least one week succeeds.
- Write no file only when every week fails, which is today's behavior.
- The log line reports each week's result.

**2. NFL playoff games are national.** Rule 1, `sunday_afternoon_window` at `adapters/espn.py:70-78`, looks only at day and hour. A Wild Card, Divisional or Conference Championship game on CBS or FOX on a Sunday afternoon would fall into the regional rules and show "Market TBD". Every playoff game airs nationally. `decide_regional` (`:166-176`) must return national for any postseason game before any other rule, so a hand entry cannot override it either.

- **Measure how the adapter can know a game is postseason. Do not assume.** Candidates are the ESPN event's `season.type` (3 is postseason), the scoreboard's `leagues[0].season.type`, and the `season_type` parameter of `fetch_scoreboard` (`:241-248`). Check which one is actually present on events in the committed fixtures, and whether the date-based fetches in the refresh (`--date`) return postseason events with it. Say what you found.
- Record the source as `"national window (postseason)"`.
- **Out of scope:** loading playoff games. If the refresh does not load them today, say so and add a queue item. Do not change the fetch.

## Tests and mutations

- **Rule 1:** a current week that parses plus a next week that 404s writes a file carrying the current week and one note. Both failing writes no file. **Replace** 118's test that pins "a 404 on next week writes nothing", and say that you replaced it and why.
- **Rule 2:**
  - a postseason CBS game at Sunday 1:00 PM ET is `AVAILABLE`, national;
  - a postseason FOX game at 4:30 PM ET is the same, even with a hand entry saying `cleveland: false`;
  - a regular-season game at the same times is unchanged.
- **Mutations:**
  - put the try back around both weeks;
  - drop the postseason check;
  - move it after rule 2.

  Show each one going red, then restore it.

## Documents

- **Register §64**, after confirming §1–§63 each appear exactly once. Record both rulings, and correct §63 where it describes the all-or-nothing write.
- **`docs/handoff-status.md`:** update the gate line.
- **File this brief** byte for byte as `docs/prompts/119-windows-per-week-and-playoffs-national.md` from `Claude outputs\`, and update the counts by their own convention.

## Gates, commits and push

Run all five gates, each as its own command. Read the floors from `docs/handoff-status.md` under "Repo state". For each gate that moves, report which gate, by how much, and why, and move its floor row in the same keystroke.

**Commit on green, then push `main`** under rule 7, and report the Vercel deployment. **Do not dispatch the workflow**, because Joe is running it himself. End with the undo block: the revert commands with the real SHAs, what was one-way, and the secret gate on the added lines.
