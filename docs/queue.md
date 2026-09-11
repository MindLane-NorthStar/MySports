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
this entry are `sync_assets.py` as of `a7a3ffe`; prompt 94 moved them.)

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

**Size.** The first piece has landed — prompt 94's byte comparison. What is left is a cache for
`assets/` that `refresh` and `render` can share, and the whole-bucket question (brief 95), proved by
dispatches rather than by any local gate; the job split after that, if it is still wanted. **A
description of a problem, not an approved plan.**
