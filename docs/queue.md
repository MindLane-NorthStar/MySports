# The queue — real work that has not started

**What this is.** A briefing for someone who has not read the conversation that produced it: each
entry says what the work is, why it matters, where in the tree it starts, and roughly how big it is.
**It is not a TODO list and nothing here is approved** — an entry is a description of a problem, and
the decision to take it on is Joe's. Filed by prompt 87 on 2026-09-10; every entry was checked against
the tree or the database that day, and says so where the evidence is a measurement.

**Working rule 30 applies with force:** every "missing", "not started" or "no X" below is a
timestamp. Check the thing itself before acting on an entry, and correct the entry in the same commit
as the work.

`docs/handoff-status.md` stays the authority for state, gates and open items; this file only holds
work that is understood and not begun. When an entry is taken, delete it here and record the work
there.

---

## 1. NFL games off Sunday are never refreshed on the day they are played

**What.** The nightly `schedule_refresh.yml` fetches NFL for exactly two dates
(`.github/workflows/schedule_refresh.yml:54-57`): yesterday, for the finals, and
`t + timedelta((6 - t.weekday()) % 7)`, the coming Sunday. A game on any other day is in neither on
the day it is played. **Measured 2026-09-10:** Thursday `nfl-401872657` (kickoff 20:35 ET) and Monday
`nfl-401872931` (20:15 ET) are the only two games of week 1 without a stored game link; all fifteen
Sunday games have one. **Monday is the same hole as Thursday** — on a Monday the coming Sunday is six
days away and "yesterday" is Sunday, so Monday Night Football is fetched only on Tuesday, after it has
finished. Saturday games in December will fall in it too.

**Why it matters.** Those games carry whatever kickoff time and status the last full load wrote, and
the loader never writes their score while they are on. The client-side live overlay
(`web/lib/livescores.js`) masks some of it on the day, but the stored row is stale.

**The real question is a design call, not a two-date patch:** whether NFL should get the rolling
7-day window NBA and MLB already have (`schedule_refresh.yml:62-71`). Block B of prompt 87 backfills
the missing LINKS; it does not fix this.

**Size.** Small to change, medium to verify: one workflow step, plus a dispatched run to confirm the
adapter's date handling (rule 5: run the workflow, never re-run; rule 28: `tests/test_workflows.py`
guards the YAML).

## 2. ESPN deep links

**What.** Make ESPN watch links open the ESPN app on the game rather than a web page.
`docs/research/universal-links-aasa-2026-09-07.md` records what 23 services claim in their
apple-app-site-association files: `www.espn.com` claims `/*/game/_/gameId/*` and the database holds
those ids, but there is **no general `/watch` claim**, so the ceiling is the app opened on the game,
not on a stream.

**Why it is easier now.** On 2026-09-10 Joe tapped the MLB.TV link from inside the installed app and
the MLB app opened (`docs/research/mlb-tv-tap-test.md`): a `target="_blank"` link from the PWA does
hand off to a claimed app. That was the open risk.

**Where it starts.** `web/lib/config.js`'s `WATCH` map and `watchUrl()`, and `WatchLink` in
`web/components/GameDetail.js`. Prompt 81's MLB.TV work (`mlbAppUrl`) is the pattern.
`handoff-status.md`'s two `### OPEN — THE STREAMING…` entries carry the same item.

**Size.** Medium, and it ends in a tap on Joe's phone that no gate can stand in for.

## 3. The watch-link audit table, for Joe's eye

**What.** `docs/research/watch-links-2026-09-09.md` — the 34 hand-maintained watch URLs, checked.
It needs a human pass: a URL that answers 200 can still point at the wrong thing (prompt 76 found a
station link that returned a clean 200 for a different station).

**Size.** Joe's reading time; any fix is a line in `web/lib/config.js`.

## 4. Three MLB rows stuck at `scheduled` while carrying a link

**What.** `mlb-823908`, `mlb-823984`, `mlb-825038` — all viewing day 2026-09-01, kickoffs 21:38–22:10
ET, `result_status = 'scheduled'`, game link stored. Confirmed 2026-09-10. They were in progress when a
loader run wrote the link and the status never advanced; the nightly MLB step only covers yesterday
onward, so nothing will revisit them.

**Size.** Three rows out of ~3,950; a data oddity, not a code defect. Fixing it is a database write:
rule 14 (named approval), rule 6 (SELECT and paste first), and the adapter's own finals for that date
are the source — not a hand-typed score.

## 5. `boxscore_url` is now a misleading column name

**What.** Since prompt 86 it holds a PREVIEW URL before kickoff (the app labels it Preview, Live box
score, Box score). Renaming it — to something like `game_url` — reaches `web/lib/queries.js:25`, the
PostgREST select list, `pipeline/load.py`'s `SCORES_SQL` and `boxscore_url()`, migrations 0018/0019,
`web/scripts/smoke.mjs` and every test that names the field. Deliberately deferred from prompt 86 so
one block did not have three candidate causes; register §35c.

**Size.** Medium: a migration (rename, applied from the file on named approval), a coordinated code
change, and a deploy ordered so the app never selects a column that does not exist.

## 6. Monday Night Countdown's two corrections

**What.** ESPN's release (register §35b) gives Monday Night Countdown an NFL Network simulcast and a
stated 6–8 p.m. window; `data/studio_shows.json` has `simulcast: null` and `duration_min: null` for
`mnfcountdown`. **Left alone on purpose** — the bookend rule currently produces a correct show from the
default and its anchor. Taking it means a simulcast broadcast row and a duration that no longer comes
from the default.

**Size.** Small data change through the parser (rule 17), plus the loader run.

## 7. The hard-coded end dates in the nightly

**What.** `schedule_refresh.yml` generates studio shows `--through 2026-12-31` (`:212`, `:217`) while
the registry's NFL shows run to `active_to: 2027-01-03` and Monday Night Countdown to `2027-01-04` — so
the last Sunday and Monday of the regular season are missing for every NFL studio show. WWE (`:155`)
and AEW (`:174`) carry the same `2026-12-31` cliff, and NASCAR (`:101`), IndyCar (`:140`) and UFC
(`:189`) are pinned to `--year 2026`. Every one of them silently stops producing rows on 1 January.

**Size.** Small per step; the design question is whether the horizon should be computed (today + N
days) rather than typed.

## 8. Building the schedule out to April 2027

**What.** Joe's stated goal: a calendar that reaches the end of the NBA and NHL regular seasons.
**The vehicle exists** — `.github/workflows/bootstrap_season.yml` takes `nfl_weeks`, `nhl_from` /
`nhl_to` and `nba_from` / `nba_to` (`:9-15`). Three things to settle first:

- **The nightly's forward horizon is a week at most for every sport**, so a season loaded once goes
  stale on reschedules unless something re-reads it.
- **Schedule and broadcast are different problems.** NBA and NHL publish full seasons, but national TV
  assignments cover only part of them and the NFL flexes windows on ~12 days' notice, so most of a
  season-long calendar would carry no channel and render "Not yet confirmed" (the NETWORK TBD state,
  `05-home-page-decisions.md` §9). That is correct behaviour, and a lot of it.
- **UFC cannot be built that far at all**: the source announces cards 8–12 weeks out.

**Size.** Large, and mostly decisions.

---

## DECISION WAITING ON JOE — the writer credential in `.env`

**Two documents disagree, and neither is a leak.**

- **`CLAUDE.md` working rule 14** says: *"There is still no direct Postgres connection and no writer
  credential in the repo, in `.env`, or in any prompt — the connector holds it."*
- **`.env` contains a live `mysports_writer` connection string** (checked 2026-09-10 by counting the
  line, never printing it), and **`docs/deployment-contract.md:142`** is the instruction that told Joe
  to put it there ("Local `.env`. Add the five lines: `SUPABASE_DB_URL=...`").
- **`.gitignore:1-2`** covers `.env` and `.env.*`, so it cannot be committed. Nothing is exposed; the
  rule and the file simply disagree.

**The two ways to resolve it:**

1. **Remove it from `.env`.** Rule 14 becomes true as written. The cost: nothing on the laptop can
   write to the database any more — local loader runs (`python -m pipeline.load_studio_shows` without
   `--emit-sql`, `scripts/apply_migration.py`) stop working, and every write goes through the nightly
   Action or the Supabase connector. In practice that is already how every write since rule 14's
   revision has been made.
2. **Keep it, and amend rule 14** to say the credential exists locally for the pipeline's own use and
   that a Claude Code session never uses it. The cost: the rule gets longer and relies on discipline
   rather than absence.

**Nothing has been changed.** Neither document was edited and `.env` was not touched; prompt 86 and
87 made no direct connection with it.
