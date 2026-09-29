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

## 1. ESPN deep links

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

## 2. The watch-link audit table, for Joe's eye

**What.** `docs/research/watch-links-2026-09-09.md` — the 34 hand-maintained watch URLs, checked.
It needs a human pass: a URL that answers 200 can still point at the wrong thing (prompt 76 found a
station link that returned a clean 200 for a different station).

**Size.** Joe's reading time; any fix is a line in `web/lib/config.js`.

## 3. Three MLB rows stuck at `scheduled` while carrying a link

**What.** `mlb-823908`, `mlb-823984`, `mlb-825038` — all viewing day 2026-09-01, kickoffs 21:38–22:10
ET, `result_status = 'scheduled'`, game link stored. Confirmed 2026-09-10. They were in progress when a
loader run wrote the link and the status never advanced; the nightly MLB step only covers yesterday
onward, so nothing will revisit them.

**Size.** Three rows out of ~3,950; a data oddity, not a code defect. Fixing it is a database write:
rule 14 (named approval), rule 6 (SELECT and paste first), and the adapter's own finals for that date
are the source — not a hand-typed score.

## 4. `boxscore_url` is now a misleading column name

**What.** Since prompt 86 it holds a PREVIEW URL before kickoff (the app labels it Preview, Live box
score, Box score). Renaming it — to something like `game_url` — reaches `web/lib/queries.js:25`, the
PostgREST select list, `pipeline/load.py`'s `SCORES_SQL` and `boxscore_url()`, migrations 0018/0019,
`web/scripts/smoke.mjs` and every test that names the field. Deliberately deferred from prompt 86 so
one block did not have three candidate causes; register §35c.

**Size.** Medium: a migration (rename, applied from the file on named approval), a coordinated code
change, and a deploy ordered so the app never selects a column that does not exist.

## 5. Monday Night Countdown's two corrections

**What.** ESPN's release (register §35b) gives Monday Night Countdown an NFL Network simulcast and a
stated 6–8 p.m. window; `data/studio_shows.json` has `simulcast: null` and `duration_min: null` for
`mnfcountdown`. **Left alone on purpose** — the bookend rule currently produces a correct show from the
default and its anchor. Taking it means a simulcast broadcast row and a duration that no longer comes
from the default.

**Size.** Small data change through the parser (rule 17), plus the loader run.

## 6. The hard-coded end dates in the nightly

**What.** `schedule_refresh.yml` generates studio shows `--through 2026-12-31` (`:226`, `:231`) while
the registry's NFL shows run to `active_to: 2027-01-03` and Monday Night Countdown to `2027-01-04` — so
the last Sunday and Monday of the regular season are missing for every NFL studio show. WWE (`:169`)
and AEW (`:188`) carry the same `2026-12-31` cliff, and NASCAR (`:115`), IndyCar (`:154`) and UFC
(`:203`) are pinned to `--year 2026`. Every one of them silently stops producing rows on 1 January.

**Size.** Small per step; the design question is whether the horizon should be computed (today + N
days) rather than typed.

## 7. Building the schedule out to April 2027

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

## 8. *(retired — closed, not missing)*

Two entries carried this number and both were closed on the day they were taken, which is this
file's convention: `3ebc4d0` filed *"Building the schedule out to April 2027"* as 8 and prompt 88
(`8f3b3c1`) moved it — it is item 7 above; `09dcf72` filed *"The working rules exist in two copies"*
as 8 and prompt 89 (`44d7d7c`) closed it with register §38, which says so in its own text. The number
is retired rather than reused. Verified by `git log -S'## 8.' -- docs/queue.md` (prompt 112).

## 9. Split the `refresh` job

**Numbered 9, not 8:** "queue item 8" already names the working-rules entry that register §38 closed and
`handoff-status.md` cites, and a reused number would make those references ambiguous.

**What.** `schedule_refresh.yml`'s `refresh` job does everything in one box: eight provider fetches, the R2
asset pull and logo push, the program adapters, the loader, two reconcilers, the resolver unit tests, the
watch-link report and the archive upload. Run #18 on 2026-09-11 overran its 20-minute ceiling and failed,
and because `render` declares `needs: refresh` (`:289`), **one overrun anywhere in the job — even in a
step that writes nothing — costs the day's grids.** Prompt 92 raised the ceiling to 35 (register §41);
that is headroom, not a fix.

**The evidence — the cost is the R2 pull, twice** (prompt 93, register §42). Every successful run read —
#15, #16 and #17, 2026-09-10/11, `gh run view --log` — prints this in `refresh`'s "Pull asset cache
from R2" step (`schedule_refresh.yml:45`, `sync_assets.py --pull`):

```
bucket mysports-assets: 1625 objects; local cache: 5 files
  unchanged 5 · local-only/changed 0 · bucket-only 1620
pulled 1620 file(s) <- mysports-assets
```

**and `render` prints the same three lines and pulls the same 1,620 again** (`render_all.yml:33`, the
same `--pull`) — seven to eight more minutes a night. The five that are not pulled are the five fonts
git tracks under `assets/fonts/`; `git ls-files assets/` is the check, and it returns 5.

**Why nothing prevents it.** `actions/cache` appears nowhere in `schedule_refresh.yml`; `cache: pip` at
`:35` is the only cache and it covers pip's wheels. A checkout materializes only the five fonts.
`sync_assets.py:60-72` `local_files()` returns only what is on disk, `:312-314` puts every remote key
that is not in that map on the pull list, and `:336-346` downloads them one at a time. (Line numbers in
this entry are `sync_assets.py` as of `a7a3ffe`; prompts 94 and 95 both moved them.)

**The push's second cost.** `--push --prefix logos/ --make-dark` (`schedule_refresh.yml:253`) compares
sizes at `sync_assets.py:308` and, when they match, calls `remote_sha()` (`:92-96`) — a `head_object`
per file — and the size always matches for a file pulled minutes earlier. Measured in the same runs:
`bucket mysports-assets: 1533 objects; local cache: 1533 files (prefix logos/)`, `unchanged 1533`,
`pushed 0`. That is 1,533 sequential round trips to learn nothing changed.

**The defect on the same line.** `:312-314` decides what to pull **by key alone**, so a local file that
exists is never re-downloaded however far its bytes have drifted from the bucket, and the next `--push`
compares sizes and shas, finds them different, and republishes the stale bytes over the newer object.
Art reverts, silently. It is invisible on the runner today, whose cache holds nothing but the five
tracked fonts, and live on any machine that keeps an `assets/`. A warm cache is exactly the condition
that would have turned it nightly, which is why caching could not ship first. **That precondition is now
met: prompt 94 fixed it** (register §43) — both directions compare bytes, using the ETag the listing
already returns, so a cached file that has drifted is pulled again, a key that differs on both sides is
a reported CONFLICT, and the push's 1,533 round trips become zero. **What remains:** caching `assets/`,
and deciding whether the nightly should pull the whole bucket at all — of its 101.5 MB, `logos/` is 88.7,
and `grids/` (50 objects, 10.2 MB) sits outside `FOLDERS` (register §43's prefix table).

**The tail-step cut is demoted, not deleted.** Unit tests (resolver) (`:265`), Watch links (`:267`)
and Archive fixtures + raw payloads (`:281`) cost 0.5–2 minutes between them: **the split was never
where the time was.** What it still buys is failure isolation — `render` declares `needs: refresh`
(`:289-290`), so a slow archive, which is where run #18's kill landed, costs the day's grids. With
prompt 92's 35-minute ceiling and a cached `assets/`, the split becomes a robustness decision rather
than a deadline.

**Why it is pressing.** Queue item 7 — the schedule built out to April 2027 — grows the loader's input
and the asset cache, which are exactly the steps that have been growing.

**Size.** The first piece has landed — prompt 94's byte comparison, and its push saving is measured in
production (2m53s → 0m02s, register §44). Prompt 95 added the publish guard, which is a safety change and
not a speed one. **What remains is the cache and the render-side pull:** a cache for `assets/` that
`refresh` and `render` can share, and whether either should pull the whole bucket at all (brief 96),
proved by dispatches rather than by any local gate; the job split after that, if it is still wanted. **A
description of a problem, not an approved plan.**

## 10. A `latest_team_records` view, so the week reads 210 rows instead of 2,820

**What.** `standingsFor` (`web/lib/queries.js`) reads every `team_records` row for a page's clubs and
seasons and lets `indexStandings` keep the newest `as_of` per `(team, season)`. The table keeps one
row per club per day, so the week view read 2,820 rows on 2026-09-22 to use 210 of them — and until
prompt 109 it read only the first 1,000 (register §54). It pages now, three round trips for a week,
and that is correct at any row count. The better shape is a view — `distinct on (team_id, season)
… order by team_id, season, as_of desc` — exposed to anon under the same RLS, so the read is one
round trip of exactly the rows the page uses, and `indexStandings` becomes a formality.

**Why not yet.** It is DDL: a file in `db/migrations/`, applied through the connector under rule 14's
four conditions, and S2 makes it Joe's approval and nobody else's. Nothing is bleeding — the paged
read is correct — so this is a cost-and-tidiness change, not a fix.

**Where it starts.** `db/migrations/0003_games.sql:150` (the table and its unique key
`(team_id, season, as_of)`), `web/lib/queries.js` `standingsFor`, `web/lib/standings.js`
`indexStandings`, and `web/test/restcap.test.mjs`, whose `standingsFor` assertion pins the paged read
and would be rewritten to pin the view. **Size:** one migration, one query, one test, an afternoon.
**A description, not an approved plan.**

## 11. The grid endcap paints a logo that was scored against a band it no longer paints

> **OPTION (b) IS DONE — prompt 113, Joe's ruling 2026-09-22.** `scripts/build_cap_table.py` scores a
> ruled team's two files on the flat band from `data/grid_colors_pro.json`, and `web/lib/cap-table.json`
> is regenerated: 13 raw→dark (the Padres and the Rams among them), 25 dark→raw (24 ties between
> byte-identical files, and the Rockets), 27 tint labels to 1.0, and seven unruled college rows whose
> `_dark` files were rebuilt after the study — all kept, all pictured under `assets/p113-cap-regen/`.
> Register §58. **The item stays open for the rim-only class below**, where a file swap does not help;
> the options for those are still (c) and (d), and they are Joe's.
>
> **A correction to the paragraph below (prompt 113):** it said the Blues and the Flames "reach neither
> 50% on either file" and "need new art or a band change". At true size and at 4× both read well — the
> Blues' (`nhl-19`, 24% interior) and the Flames' (`nhl-20`, 28%) gold elements carry the mark — while
> the Rays (`mlb-139`, 25%) did not read and prompt 113 fixes it by the file swap. **The interior-share
> figure produces false positives:** it ranks by the share of contrasting ink, but legibility depends on
> whether a coherent shape survives, and a gold outline on navy is a coherent shape. It stays a rejected
> proposal, not a metric.

**What.** Joe, on the device, 2026-09-22: on the GRID the Padres mark renders brown on brown and the
Rams mark dark on dark, both illegible. **Measured (prompt 112, `assets/p112-dark-band-logos/`,
untracked): the cause is not the one the handoff or the brief proposed.** The grid's endcap art comes
from `capFor()` (`web/lib/gridmodel.js`) reading `web/lib/cap-table.json`, and `MobileGrid.js`
`capArt()` maps the row's `art` to the raw file, the `_dark` file or the `_cap` file — not from
`logo_conditioning.json`'s `team_dark_variants()` (a charcoal-context tool) and not from
`team_cap_art()` (reached by exactly one team's `art: 'cap'`). Those two are ruled out; do not
re-tread them.

**The table's score was taken on the wrong surface.** `scripts/build_cap_table.py` scores every logo
against `band_for(primary, secondary)["band"]` — the RULE's band from the database colours. Prompt
66 then made every ruled team paint the band Joe chose in `data/grid_colors_pro.json`, and for
**80 of the 124 ruled teams that band is a different colour**. The Padres' rule band is gold
`#ffc425`, where the brown-and-gold raw file scores `edge_crisp` 1.000; Joe's ruled band is brown
`#2f241d`, where the same file scores **0.000** and the `_dark` file 1.000. The Rams: rule band gold
`#ffd100` (raw 1.000); ruled navy `#003594` (raw **0.000**, dark 1.000). The table's 1.000 was never
a rim-versus-interior artefact — it was a true score on a band the block stopped painting. Re-run on
the painted band, the table's `edge_crisp` reproduces for only **38 of 124** ruled rows (98 of 124 on
the rule's own surface), and the script's own dark-margin rule would flip **13 of the 94 raw-art
teams to `_dark`** — Dodgers, Padres, Rays, Reds, Royals, Twins, Yankees, Jazz, Chargers, Rams,
Giants, Jets, Lightning. The "1.000 locks out the dark file" arithmetic is true and is not what
happened here.

**A second, smaller class is real and the instrument cannot see it.** `edge_crisp` measures the
2-device-px outer rim at 1.5:1 (`build_cap_table.py:17-20`) and says nothing about the interior
mass. Cowork's proposed figures — the share of ALL ink pixels clearing 1.5:1, and the median ratio
of the ink mass — rank the 94 raw-art teams with the Rams 1st-worst and the Padres 4th, but those two
are explained by the surface error above. The teams the rim measure misses are the ones with a bright
rim and a dark body on a dark band: Colts (`edge_crisp` 1.000, interior 29%), Guardians (1.000, 35%),
Red Sox (1.000, 39%), Sabres, Brewers, Commanders, Braves, Pacers — and for those, **the `_dark` file
scores the same interior**, so a file swap does not help; the Blues and the Flames reach neither 50%
on either file. Those need new art or a band change. The figures are a proposal, not a decided metric.

**This is the loose end `gridmodel.js` `capFor()` already names, at its true size.** That comment
says 16 of 42 dark-art teams were scored against a *tinted* surface that prompt 66 changed. The
measurement says the surface moved under every ruled row, tinted or flat, because the band itself
moved — same mechanism, wider scope. Cowork's brief asked that the two not be conflated; on the
evidence they are one thing.

**Why not yet.** The art a ruled team paints is Joe's ruling (prompts 66 and 69, register §21-era).
Every fix is a re-ruling he makes by eye from the pictures: (a) a per-team re-ruling of `art` for
the 13; (b) regenerating the cap table against the RULED band — one flag on `build_cap_table.py` to
read `grid_colors_pro.json` — which also changes `web/test/captable.test.mjs`'s study-match test and
its 170/28/84/25 counts, and `gridcolors.test.mjs`'s "the cap ART is left as the cap table measured
it"; (c) a second, interior measure added to the table build for the rim-only class; (d) new art or
a band change for the teams neither file serves. **None of these is chosen.** `tests/test_cap_table.py`
pins only the table's shape and the margin constant, and would not object to any of them.

**Where it starts.** `scripts/build_cap_table.py:96-111` (`band_for`) and `:169-190` (`decide`),
`web/lib/gridmodel.js` `capFor()` and its prompt-66 comment, `web/components/MobileGrid.js:691`
(`capArt`), `data/grid_colors_pro.json`, `web/lib/cap-table.json`, and the three tests named above.
**Size.** Small once ruled — a flag, a regeneration, a test update — but the ruling is per team and
by eye. **A description of a problem, not an approved plan.**

## 12. Smoke will go red when the LCS placeholders load, and that red is deliberate

**What.** `web/lib/placeholders.js` exempts a `-TBD` id or an MLB row named in one of the three forms
MLB has published — `AL|NL #N Seed`, `AL|NL Wild Card #N`, and since 2026-09-28 `AL|NL N/M Winner` —
and nothing else, by ruling (register §60). **The Division Series half of this item happened on
2026-09-28:** the rows loaded as "AL 3/6 Winner" and the like, smoke went red at 32/33 during prompt
123's gate run, and Joe ruled the form in the same day. When the 6-day MLB window reaches the LCS and
World Series rows, their placeholder names will be a form nobody has ruled on yet, and `smoke.mjs`'s
*"the only unruled pro rows are TBD placeholders"* will go red naming them.

**That is the check working.** It needs a ruling on the new name form — widen the pattern to the
form as published, or rule the row something else — **not a code workaround** that guesses the
form ahead of time. Whoever hits it: read the names off the smoke detail, put the form in front of
Joe, add it to the pattern with its own test, and record the ruling as a dated line under §60.

**Where it starts.** `web/lib/placeholders.js`, `web/test/placeholders.test.mjs`, `web/scripts/smoke.mjs`.
**Size.** Small once ruled. **A description of a problem, not an approved plan.**

## 13. If EntitledSports goes stale or changes shape, the grid falls back to Market TBD — and the options are Joe's

**What.** Since prompt 118 (register §63) a CBS/FOX Sunday-afternoon row is decided by EntitledSports'
weekly coverage page, an unofficial site that names no source. Three things can go wrong, and each
one fails the same way: the page stops updating (the late windows stay TBD all week, or a week's page
never appears), the markup changes (the reader finds no Cleveland block or fewer than four windows and
writes nothing), or the site goes away. In every case rule 4b falls through, the game is `UNVERIFIED`,
and the card shows "Market TBD" — E5, which is the design, not a fault. Nothing goes red: the
windows step logs one line and exits 0, so the tell is the source strings on the CBS/FOX rows going
back to "neither the station listing nor the coverage window decided this game", or the step's log
saying `0 of 8 windows named` on a Saturday.

**The options, all Joe's to choose.** (a) A hand entry in `data/market_coverage_nfl.json` for the
week — it beats every source and takes one line per game. (b) Buying Schedules Direct: the client,
its workflow step and rules 4–5 are in the tree dormant, and adding the three `SD_*` secrets turns
them on with no code change; Joe ruled no paid data on 2026-09-23 and this item does not re-raise
it, only records that the switch exists. (c) Another free source, which would need its own terms
read and its own reader. Not an option: guessing a window from the network name, which is what
ESPN's "National" flag amounts to and what §62 stopped.

**Where it starts.** `adapters/es_windows.py` (the reader and its `PageError`s), `adapters/espn.py`
`windows_decision`, `tests/fixtures/es_week3_cleveland.html` (the markup as it was). **Size.** Small
if a hand entry; a session if the markup changed. **A description of a problem, not an approved plan.**

## 14. Playoff games load with the Wild Card round as `week 1` and `competition_context` REGULAR

**What.** Prompt 119 measured (register §64) that the nightly's date-based ESPN fetch returns
postseason games — the 2026-01-11 Wild Card Sunday came back with three events, each
`season.type 3`, slug `post-season` — and nothing in `build_nfl_fixture` or `pipeline/load.py` filters
them, so they load like any other game. Two things about how they load are wrong and harmless
today: ESPN's postseason `week.number` restarts at 1 (Wild Card 1, Divisional 2, Championship 3,
Super Bowl 5), so a January game lands in `games.week = 1` beside September's week 1; and the loader
never sets `competition_context`, so the row keeps the table default `REGULAR`. The CBS/FOX access
decision is unaffected (rule 0 fires on the event's `season.type` before the week is consulted), and
`market_coverage_nfl.json` is keyed by week so a hand entry could collide, but rule 0 makes one moot.

**What it would take.** Read `season.type` in the fixture builder and write a postseason marker the
loader carries into `competition_context` (the enum exists since `0003_games.sql`), and decide what
`week` means for a playoff game — ESPN's round number, or a continuation (19–22). Also whether the
renderers group by week anywhere that would show a Wild Card game under "week 1".

**Where it starts.** `adapters/espn.py` `build_nfl_fixture` (`"week": ev.week.number`), `pipeline/load.py:240-250`,
`db/migrations/0003_games.sql` (`competition_context`). **Size.** Small to medium; needs a ruling on
week numbering first. **A description of a problem, not an approved plan.**

## 15. *(closed 2026-09-29 by prompt 124 — register §67)*

This item was *"qa-shots' TBD-badge check reads live placeholders, and they are running out."* The
check read live postseason rows, and it went red twice as the seeds and series resolved: on
2026-09-25 and on 2026-09-28. The second time it was moved from 2026-09-29 to 2026-10-03, which would
have gone red too once the Wild Card series finished. It took the durable option this item named. It
now loads `/qa/tbd`, a dev-only page that renders the real components with fixture rows, and counts
them exactly, so who is still playing can no longer turn it red. The Yankees' 404 check moved with it.
Smoke still reads live rows on purpose; item 12 stands. The number is retired rather than reused, as
item 8's is.

## 16. Eligibility freshness smoke check (prompt 123 Block B), to be added after the first production run confirms fresh rows

**What.** Register §66: from 2026-09-05 until prompt 123, a change in a game's access reached
`game_broadcasts` and never reached `viewer_game_eligibility`, which is the table the app reads. Nothing
went red. Joe found it by watching "Market TBD" sit on decided NFL games all Sunday. Prompt 123 fixed
the reconciler. This check is the tripwire that would have caught it: **for the next 7 viewing days'
games, no eligibility row may be more than 26 hours older than the newest `last_seen_at` among that
game's broadcast rows.** The refresh runs twice a day and now re-judges every game it touches in the
same run, so a fresh pipeline passes with a day of slack. A day of failed reconciles, or a
regression of §66, trips it.

**The query**, as SQL for a read-only connector check (ET viewing days; `current_date` on the
server is UTC, so substitute the ET date near midnight):

```sql
select g.id, g.sport, e.computed_at, max(b.last_seen_at) as newest_seen
from mysports.games g
join mysports.game_broadcasts b on b.game_id = g.id
left join mysports.viewer_game_eligibility e on e.game_id = g.id and e.viewer_profile_id = 1
where g.viewing_day between date '2026-09-28' and date '2026-10-04'
group by g.id, g.sport, e.computed_at
having e.computed_at is null or e.computed_at < max(b.last_seen_at) - interval '26 hours';
```

In `web/scripts/smoke.mjs` it is two `restAll()` reads: the week's games by `viewing_day`, their
broadcast rows by `game_id=in.(…)`, and their eligibility rows the same way. The comparison is done in
JS. Rule 19's cap guard (`web/test/restcap.test.mjs`) will make each read state how it is bounded.

**Today's count**, read through PostgREST with the anon key on 2026-09-28, after the 08:01 UTC
dispatched refresh and before prompt 123 deployed: **34 games fail (NHL 18, NFL 16)**. They are out of
86 with broadcast rows, among the 135 games on 2026-09-28 to 2026-10-04. That is why the check was
not added in the same run: it would be red on live data until the first refresh after the push, and
a red gate is never committed over.

**When.** After Cowork's OPEN item in `docs/handoff-status.md` confirms the first production refresh
after prompt 123 left `computed_at` fresh for the next 7 days' games. The count should then be 0.
**That precondition was met on 2026-09-29** (prompt 121 rev B, register §68). The first refresh after
the push logged `eligibility_only` 819 and `eligibility_changes` 14. This query, re-read through
PostgREST for viewing days 2026-09-29 to 10-05, returns **0** of 146 games. **The item can now be
built**; whether and when is Joe's call.
**Where it starts.** `web/scripts/smoke.mjs`, `web/lib/rest.js` (`restAll`). **Size.** Small. **A
description of a problem, not an approved plan.**

## 17. The refresh's `validation-*` artifact is public now, and it duplicates the private archive

**What.** `schedule_refresh.yml` keeps the day's fixtures and raw provider payloads twice:

- `:341-342`, "Archive fixtures + raw payloads (private bucket)", pushes `artifacts/validation` to
  the private `mysports-data` bucket under `fixtures/<date>/`.
- `:343-348` uploads the same directory as a GitHub Actions artifact named `validation-<date>`, kept
  for 14 days, `if: always()`.

While the repo was private, only Joe could reach the artifact. **Since 2026-09-29 the repo is public
(register §68), and any signed-in GitHub user can download it.** It carries the raw payloads the
adapters fetched: league and network schedules, and the coverage-page extracts. GitHub masks secrets
in logs, but it does not scan artifacts, and Cowork's gitleaks pass covered the repo, not the
artifacts. **Whether any fixture file could carry a credential has not been checked.** That is the
first thing to read before deciding.

**The trade.** The artifact is the one copy readable without R2 credentials. It survives a run whose
R2 push failed, because of `if: always()`, which the bucket copy does not. It is handy for reading a
failed run from the Actions page. Against that, it is a second public copy of provider responses whose
terms were read for fetching, not for republishing. **Whether to keep it, narrow it (for example,
`if: failure()` only), or remove it is Joe's call.** Prompt 121 made no change, by its scope.

**Where it starts.** `.github/workflows/schedule_refresh.yml:343-348`; `scripts/sync_assets.py
--push-data` for the private copy. **Size.** Small once ruled: one step edited or removed, and
`tests/test_workflows.py` re-run. **A description of a problem, not an approved plan.**
