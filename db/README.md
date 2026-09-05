# db/migrations

Source of truth for the `mysports` schema (deployment contract v1.0, D10). Files are applied in order to Supabase project
`ztnppejmdwmhqstqsfks` as migrations named `mysports_NNNN_<name>` — by Cowork through the Supabase connector
(`apply_migration`) or by Claude Code with `psql "$SUPABASE_DB_URL" -f db/migrations/NNNN_name.sql` — and the Supabase
migration history records the same names.

| File | Status | Contents |
|---|---|---|
| 0001_schema_and_roles.sql | applied 2026-09-01 | schema `mysports`, roles `mysports_owner` / `mysports_writer`, default privileges |
| 0002_reference_tables.sql | applied 2026-09-01 09:20 ET | 20 enums; sources, assets, networks_services, viewer_profiles, viewer_services, carriage_status, markets, conferences, teams, venues, team_territories, render_policies, rivalries |
| 0003_games.sql | applied 2026-09-01 09:20 ET | games, game_broadcasts, broadcast_crews, rankings, market_coverage, whip_around_*, game_odds, team_records |
| 0004_observations_and_runs.sql | applied 2026-09-01 09:20 ET | source_snapshots, source_observations, canonical_decisions, canonical_change_history, generated_grids, viewer_game_eligibility, refresh_runs, updated_at trigger |
| 0005_rls_and_seed.sql | applied 2026-09-01 09:20 ET | RLS on every table (anon read; snapshots/observations/refresh_runs private); seed: market cleveland, viewer profile, render_policies, sources |
| 0006_reconciliation.sql | applied 2026-09-01 ~14:35 ET (Claude Code, scripts/apply_migration.py, after CSV backup + rolled-back dry run; Supabase history row `mysports_0006_reconciliation` added by Cowork) | Milestone 2: `source_observations.last_seen_at` / `seen_count`, `sources.rights_scope`, `game_broadcasts.active`; one-time collapse of duplicate observation rows (1,914 → 408, seen_count preserves the count), same-source supersession (`valid_to`), re-attribution of feed outlets that Milestone 1 credited to `data/local_rights`; two indexes |
| 0007_final_scores.sql | applied 2026-09-02 | `games` gains `home_score`, `away_score`, `result_status` (checked: scheduled/in_progress/final/postponed/cancelled), `boxscore_url`, `completed_at` — all nullable, additive; `grant select, insert on generated_grids` + sequence usage to `mysports_writer`. **Scores are loader-written provider facts, not reconciled observations** — one structured provider per sport reports objective post-game results, so spec §9.6 deliberately does not apply and the reconciler never reads or writes these columns. |
| 0008_standings_and_probables.sql | applied 2026-09-02 ~13:35 ET (Claude Code, `scripts/apply_migration.py`, after CSV backups of `team_records` (30 rows) and `games` (295 rows) and a rolled-back dry run) | `team_records` gains `ot_losses`, `points`, `division_rank`, `games_back`; `games` gains `probable_home_pitcher` / `probable_away_pitcher`; `teams` gains `display_name`. All nullable, additive, no row rewritten - counts identical before and after (team_records 30, games 295, teams 808, 29 tables). Standings and probables are **loader-written provider facts, not reconciled observations** - same reasoning as 0007's scores. |
| 0009_programs_supertype.sql | applied 2026-09-02 ~19:50 ET (Claude Code, `scripts/apply_migration.py`, after CSV backups of `games` (375 rows) and `game_broadcasts` (442 rows) and a rolled-back dry run) | Spec v0.5 §P, the **programs supertype**. `sport` enum gains `nascar`, `indycar`, `ufc`, `wwe`, `aew`; new enums `program_type` (game/race_session/fight_card/weekly_show/special_event/studio_show) and `source_tier` (announced/reported); new tables `programs`, `studio_shows`, `studio_show_instances` (all three empty, RLS on, `anon_read`); `games` gains nullable FK `program_id`; `game_broadcasts` gains `window_start`, `window_end`, `simulcast_linear`. **Additive only** - nothing dropped, narrowed or retyped, no existing row touched: 375 games and 442 broadcast rows before and after, `access_status` unchanged at 7 values. Architecture only; the app and grids behave identically. |
| 0010_market_pending.sql | applied 2026-09-03 ~00:45 ET (Claude Code, `scripts/apply_migration.py`, after a CSV backup of `viewer_game_eligibility` (375 rows) and a rolled-back dry run) | E5 (`docs/feature-study/05-home-page-decisions.md` §8). `viewer_game_eligibility` gains **`market_pending boolean`**, nullable with NO default so "never computed" stays distinguishable from "computed false". **Additive only** - one column, nothing dropped or rewritten, 375 rows before and after. Backfilled in the same change: 375 computed, 0 null, **15 pending**. |
| 0011_division_seed.sql | applied 2026-09-04 (Claude Code, `scripts/apply_migration.py`, after a rolled-back dry run that reported **pre-existing=14, inserted=0, assigned=0**) | The division / conference seed for NFL, NHL and NBA, **reconciling the repo with a write Cowork had already applied through the Supabase connector** (10 conference rows, 94 teams). 14 `conferences` rows - 8 NFL divisions, 4 NHL divisions, 2 NBA **conferences** - and the 94 `teams.conference_id` assignments that go with them. Fully idempotent: `on conflict (id) do nothing` on the insert, `where conference_id is null` on the assignment, which is what kept MLB's 6 divisions and CFB's 73 conferences untouched. Applying it to the live database is a **no-op** (counts identical before and after: 93 conferences; cfb 684/684, mlb 30/30, nba 30/30, nfl 32/32, nhl 32/32 assigned); applying it to a fresh database reproduces the same state. **NBA is seeded at conference level on purpose** - see 0008: `division_rank` holds ESPN's conference `playoffSeed` (1..15), so `nba-eastern-conference` / `nba-western-conference` are the rows that seed actually indexes into.

Applied state after 0005 (verified through the connector): 29 tables in `mysports`, all owned by `mysports_owner`, RLS on all 29, `anon_read` on 26 (not on source_snapshots, source_observations, refresh_runs), 20 enums, seed rows: 1 market, 1 viewer profile, 5 render policies, 10 sources; `public` still 36 tables. Migration history: mysports_0001 … mysports_0006.

Dry-run result for 0006 (rolled back): observations 1,914 → 408 rows (sum of `seen_count` = 1,914, nothing lost), 398 open, 10 closed (all ten point at the alias outlets removed on 2026-09-01), 0 kickoff claims superseded, 237 games with exactly one open kickoff claim, CLE @ JAX's CBS claim re-attributed to `espn.scoreboard`, 0 inactive broadcast rows.

Rules: every file starts with `set role mysports_owner; set search_path = mysports;` and ends with `reset role;`; nothing is
ever created in `public`; new tables get RLS + an `anon_read` policy in the same file that creates them. Before a migration
that rewrites existing rows (0006), take a `pg_dump --schema=mysports -t mysports.<table>` of the affected table.

---

## 0010: what market_pending means, and why it is nullable

**The column answers "is this game ineligible only because nobody has published the map yet?"** On NFL
Sunday 2026-09-13 the app said *11 not on your services - on FOX and CBS*, networks Joe has. The count
was not wrong about how many he can watch, but it asserted a certainty the data did not have:
`market_coverage` was empty, because the 506sports regional maps do not publish until roughly the
Monday before. Those games were not unavailable; they were **not assigned yet** - and the same state
recurs every Monday-to-Wednesday of the season.

**Three shapes distinguish "unknown" from "unavailable" in this data**, and only the first is a gap:

| `access_status` | with | means |
|---|---|---|
| `unverified` | `blackout_rule = NONE`, viewer market | regional window, **no map entry yet** - UNKNOWN |
| `out_of_market` | `blackout_rule = OUT_OF_MARKET` | decided: the map (or the league) says no |
| `unavailable` | `market_id` null | decided: a service the viewer does not subscribe to |

The rule reads `access_status = 'unverified'` rather than a list of call letters, because the adapters
already write exactly that at the point where a game sits in a regional window with no entry
(`adapters/espn.py`'s NFL regional path, `adapters/mlb.py`'s). A hardcoded FOX/CBS list would be a
second, weaker copy of the same fact, and would miss the next network that starts splitting regionally.
The set lives in `data/authority_rules.json` under `eligibility.market_pending_access`, beside
`eligible_access`, so it is tunable without a commit.

**NULLABLE ON PURPOSE.** `null` = never computed, `false` = computed and not pending, `true` = pending.
A `default false` would have silently asserted "computed, not pending" for all 375 pre-existing rows and
made the backfill unverifiable. The backfill turned every null into a real verdict; the nullability is
what let that be checked afterwards.

**Self-resolving.** Once the map loads into `market_coverage`, a row exists for that (game, network,
viewer market), the reconciler re-decides, and the game becomes eligible or genuinely out-of-market with
no manual step. `market_pending` is computed in `pipeline/reconcile.py` beside `eligible` - one
implementation, never a second one in the app.

Verdicts at backfill (2026-09-03): 09-13 **11 of 11** ineligible pending (the maps genuinely have not
published), 09-05 2 of 20, 09-03 2 of 8, and 0 on 09-02, 09-04, 10-01 and 10-28. The rule discriminates
rather than blanket-labelling, which was the acceptance condition.


## 0009: the two semantics that are easy to get wrong

**A NULL broadcast window means the row carries the WHOLE program. Null is "all of it", not "unknown".**
That is precisely what makes every pre-0009 `game_broadcasts` row correct and unchanged with no backfill —
all 442 of them are null-window, and all 442 still mean exactly what they meant before. The columns exist
because CBS carries *part* of some UFC events, which the v0.4 model could not express at all.

Its consequence, which is the actual bug this prevents: **duplicate-feed suppression must compare windows.**
Two broadcast rows for the same program on the same service are duplicates only when their windows also
coincide. A suppression rule written against the old implicit whole-program assumption will silently collapse
a CBS window into its parent streaming row and lose the fact that the two carry different parts of the event.

**There is no `purchasable` access state, and that is a decision, not an omission.** Joe ruled on 2026-09-02
that purchasable content is out of scope: the grid answers "what can I watch", not "what could I buy", so
putting a $39.99 AEW PPV on it would invert the product's purpose. `access_status` is therefore untouched by
0009 and still has its original seven values. AEW's scope is Dynamite/Collision plus specials *included with*
a subscription the viewer already has. If this is ever revisited it needs a Joe decision, not a migration.

Two smaller notes on 0009, both deliberate:

* The `programs_series_ck` constraint compares `sport::text = 'nascar'` rather than the enum literal.
  PostgreSQL forbids *using* a new enum value in the same transaction that added it, and
  `scripts/apply_migration.py` runs the whole file in one transaction. Casting to text compares two strings
  and never references the enum value, so the constraint is identical in effect and the migration stays a
  single atomic file. (Verified on PG 17.6 by dry run before applying.)
* `programs` gets the same `set_updated_at()` trigger `games` has carried since 0004. That is `updated_at`
  maintenance only. The shadow-row logic — creating and updating a game's program row — lives in
  `pipeline/load.py`, in code that runs, never in a trigger.


## Backups and the recovery drill (deployment contract §6)

`python scripts/backup_table.py TABLE [TABLE ...]` dumps `mysports.<table>` to
`artifacts/backups/{table}_{UTC timestamp}.csv` over the writer DSN (psycopg `COPY ... TO STDOUT`).
`python scripts/sync_assets.py --push-data <dir> --prefix backups/<stamp>/` copies them offsite to the
**private** `mysports-data` bucket (never the public asset base — verified 404 there).

`python scripts/recovery_drill.py TABLE [TABLE ...]` proves a backup actually restores **without
touching the live table**. For each table, inside a single session:

```
create temp table drill_{table} (like mysports.{table} including all)
copy drill_{table} from the newest artifacts/backups/{table}_*.csv
assert count(drill) == count(live)
assert (drill except live) and (live except drill) are both empty     -- exact content, not just a count
```

Temp tables live in a per-session `pg_temp` schema, are invisible to every other connection, and
vanish on disconnect. Nothing in the `mysports` schema is created, altered or deleted. **A backup
that has not round-tripped is a backup you do not have.**

### Drill log

| Date | Tables backed up (rows) | Drilled | Result |
|---|---|---|---|
| 2026-09-02 04:06 UTC (Claude Code, overnight run) | games 295 · game_broadcasts 285 · networks_services 85 · teams 808 · canonical_decisions 2,566 · generated_grids 14 · viewer_game_eligibility 295 | `games`, `game_broadcasts` | **PASS.** games: 295 restored = 295 live, content exact. game_broadcasts: 285 restored = 285 live, content exact. Live row counts unchanged afterwards; zero surviving `drill*` tables; 29 tables still in `mysports`. All seven CSVs pushed to `mysports-data/backups/2026-09-02T040653Z/` (7 objects, `games` CSV verified byte-identical on read-back). |

The drill covers `games` and `game_broadcasts` — the two tables the pipeline rewrites most and the
two whose loss would be hardest to reconstruct. The other five are backed up and pushed offsite but
not yet drilled; `recovery_drill.py` takes any table name, so extending the drill is a one-line
change when there is reason to.

---

## What the standings columns mean, per league (0008)

`pipeline/standings.py` writes one `team_records` row per club per ET day, filling only the fields that
league actually publishes. **A column left null means the league does not publish it, not that the value
is zero.**

| league | wins/losses | ties | ot_losses | points | division_rank | games_back | source |
|---|---|---|---|---|---|---|---|
| mlb | yes | yes (always 0) | - | - | division rank | yes | `mlb-statsapi` |
| nhl | yes | yes | yes (W-L-OTL) | yes | `divisionSequence` | - | `nhl.standings` |
| nba | yes | yes (always 0) | - | - | **CONFERENCE seed** | conference GB | `espn.standings` |
| nfl | yes | yes | - | - | division rank | division GB | `espn.standings` |

**NBA `division_rank` holds the CONFERENCE rank** (Joe's ruling, 2026-09-02). The NBA is organized,
seeded and displayed by conference, so ESPN's `playoffSeed` (1..15 within the conference) is the number
the app shows and the number a Cleveland fan means by "where are the Cavs". The column keeps its shared
name across leagues; only the NBA's meaning differs, and the listings card labels it accordingly. Because
of this the NBA request deliberately does **not** pass `level=3`: at that level ESPN groups by division
and `gamesBehind` becomes DIVISION games back, which would disagree with the conference seed stored
beside it. NFL keeps `level=3` precisely because it does want division grouping.

**Which season a table belongs to is decided by the provider, never by the calendar.** `season` is always
the season's START year (2026 = 2026-27 for NHL/NBA). MLB `season` and NHL `seasonId` state it outright.
ESPN is asked for a season by name and the label is read back off `season.displayName`, because it serves
the PREVIOUS season's final table under the UPCOMING season's label: on 2026-09-02 the NBA response was
labelled "2026-27" while carrying the completed 2025-26 standings (82 games played, clinch indicators),
and `?season=2027` was empty. Filing that table under 2026 would have shown a 60-22 record for a club
that has not played a game. NFL additionally passes `seasontype=2`, because the bare call returns
**preseason** records in September (BUF 3-0 on 2026-09-02); the regular-season table is honestly 0-0, and
`division_rank` stays null while nobody has played, since ESPN's ordering of an all-0-0 division is
arbitrary rather than a standing.

## teams.display_name (0008)

The media-standard short form, populated for college football only from ESPN's `shortDisplayName`, and
written **only where it differs from `short_name`** - null means the app falls back to `short_name`. Pro
sports stay null. Populated by `pipeline.bootstrap` from `artifacts/validation/cfb_espn_teams.json`
(`python -m adapters.espn --league cfb --teams-only`), matched by ESPN id first (CFBD ids ARE ESPN ids)
and then by normalized school name; a school ESPN does not carry is left null and listed, never guessed.

As of 2026-09-02: 227 of 684 written, 16 unmatched, 0 for pro teams. Two things for Joe to look at, both
recorded rather than worked around:

* ESPN's `shortDisplayName` is a **fixed-width** field, so schools outside FBS/FCS get vowel-dropped
  truncations ("Franklin Pierce" -> "Frnklin Pierce", "UT Permian Basin" -> "UT Prmian Basn"). Every one
  of those is a D2/D3 program that never reaches a grid; the 80 FBS/FCS entries are all clean and genuinely
  media-standard (UMass, Pitt, FAU, FIU, MTSU, ETSU, NC A&T, SC State, Penn, Jax State, Coastal).
* ESPN does **not** supply two of the spot-check answers the rule assumed: LIU is `Long Island`, not
  `LIU`, and Georgia State is abbreviated to `Georgia St` rather than staying spelled out. Neither was
  overridden by hand - the rule as written is what ran.


---

## 0011: the four NHL rows that already existed, and the assignment that went missing

Cowork sent 14 conference rows and **10 inserted**. The four that were already there are the NHL
divisions - `nhl-atlantic`, `nhl-metropolitan`, `nhl-central`, `nhl-pacific` - and they are **not stale
rows from a failed attempt**. Each now carries eight clubs. Nothing in this migration deletes or renames
them, and nothing should.

**Where they came from.** `pipeline/bootstrap.py`'s `teams_and_conferences()` mints a conference id as
`f"{sport}-{slug(conference)}"` straight from the per-team `conference` field of
`artifacts/validation/<sport>_2026_teams.json`. The NHL provider publishes those four names as its
DIVISIONS (`adapters/nhl.py` `fetch_standings_teams()` -> `divisionName`, 8 clubs each, verified live),
so a bootstrap run over a teams file that still carried them produced exactly these four ids.

**When.** `track_commit_timestamp` is off on this project, so there is no commit clock to read. The rows'
`xmin` is **9260**, which brackets cleanly between two dated `refresh_runs` rows - 9254 at
`2026-09-01 22:46:54Z` and 9268 at `2026-09-01 23:22:17Z`. So they were written in that 35-minute window
on 2026-09-01, **before** the MLB conference seed (xmin 9344) and the CFB seed (9344-9517), and long
before Cowork's insert (xmin 9693, just after a `schedule_refresh` at `2026-09-04 14:43:54Z`). The four
NHL rows are the oldest conference rows in the table.

**Why the assignment went missing while the rows survived - and the live risk this leaves.**
`adapters/nhl.py` builds its teams file with `standings = None if offline else _safe(fetch_standings_teams)`,
and `_safe` swallows any exception and returns `None`. When that happens `div_by` is empty, every team
gets `conference: null`, and the file is written anyway. The current
`artifacts/validation/nhl_2026_teams.json` (2026-09-01 20:32 local, i.e. **after** the window above) is
exactly that file: `conference` is null on all 32 teams, and so is `nhlConference`.

`teams_and_conferences()` lists `conference_id` among its upsert's update columns, so the next bootstrap
run wrote those nulls **back over** the NHL assignments - while leaving the conference rows themselves in
place, because nothing deletes a conference. That is the entire story: rows without teams from
2026-09-01 to Cowork's re-assignment on 2026-09-04.

**It can happen again.** A single transient NHL API failure during a `--teams-only` run will regenerate
the file with null conferences and wipe all 32 assignments a second time. The durable fix is for
`build_teams` to refuse to write a teams file whose conferences are entirely null (or for the upsert to
stop nulling a populated `conference_id`), and that is a `pipeline/` change, deliberately out of scope
here. Recorded rather than worked around.


---

## The twelve stale MLB rows, and why the plan for them was wrong (2026-09-04)

Twelve `games` rows sat at `result_status = 'in_progress'` with kickoffs on 2026-09-01 - days past any
possible finish. Prompt 35 shipped the display guard (`isStaleLive`, 8 hours, renders `Final pending`)
and held the database write for Joe. He approved it as a split: the rows carrying a plausible score
would be flipped to `final`, and the rows reading 0 - 0 would be re-fetched instead, because flipping
those would freeze a wrong 0-0 into the record permanently.

**The split's premise did not survive the re-fetch.** Asking statsapi about all twelve - not only the
empty-looking ones - returned a real Final for every one, and **all twelve stored scores were wrong**:

| game | stored | actual final |
|---|---|---|
| Mariners at Red Sox | 9 - 1 | **9 - 6** |
| Tigers at Twins | 1 - 1 | **2 - 15** |
| Giants at Pirates | 5 - 11 | **12 - 13** |
| Athletics at Rangers | 0 - 1 | **5 - 8** |
| Marlins at Royals | 2 - 0 | **6 - 3** |
| Blue Jays at Guardians | 1 - 2 | **1 - 6** |
| Braves at Nationals | 2 - 5 | **5 - 9** |
| Padres at Reds | 2 - 2 | **3 - 4** |
| Mets at Rays | 2 - 5 | **2 - 6** |
| Brewers at Cubs | 0 - 0 | **9 - 4** |
| White Sox at Astros | 0 - 0 | **5 - 1** |
| Orioles at Rockies | 0 - 0 | **2 - 4** |

Every stored score was a **mid-game snapshot**, so the reasoning behind the 0-0 carve-out applied to the
whole set: flipping the nine "plausible" rows to `final` while keeping their scores would have published
nine wrong finals and closed the door on ever noticing. **A plausible-looking score is not a correct
one.** Two of the nine even said so out loud - 2 - 2 and 1 - 1 are not possible MLB regular-season
finals - but the other seven looked perfectly reasonable and were equally wrong.

So the rule Joe gave for the 0-0 rows was applied to all twelve: the provider decides.
`scripts/backfill_stale_finals.py` re-fetches, writes `result_status`, `away_score` and `home_score`
from statsapi, and leaves untouched (and reports) any row the provider does not call Final. It writes
nothing else - `completed_at` and `boxscore_url` stay as the pipeline wrote them - and it is guarded
`and result_status = 'in_progress'`, so re-running is a no-op.

Result: 12 updated, **0 rows left `in_progress`**, `games` 1,384 rows before and after (backup
`artifacts/backups/games_2026-09-04T163552Z.csv`). There is **no provider gap** - the data was always
there to be asked for. `isStaleLive` consequently catches nothing today and is deliberately kept: it
guards a class of pipeline failure, not those twelve rows.

**The gap this leaves open is the pipeline one, still out of scope and still unfixed:**
`schedule_refresh` fails on the RENDER job with `FileNotFoundError: artifacts/validation/mlb_2026_teams.json`,
which is why these statuses were never updated in the first place. Reconciling the rows does not stop it
happening again tomorrow.

## Re-reconcile, 2026-09-05 — the telecast ladder's twin (prompt 46 stage 3, run id 81)

`pipeline/reconcile.py` decided the eligibility `reason` and its twin `games.network_status` thirty
lines apart. Prompt 24 fixed `reason` for bare non-CFB games; the twin was left, so those same games
kept `network_status = 'no_linear_telecast'` and a card read "No linear telecast" underneath a NETWORK
TBD badge. Both now come from one pure function, `telecast_verdict(sport, active, rules, ...)`, and
`no_linear_telecast` is only ever concluded from broadcast rows that exist.

Backups first: `artifacts/backups/games_2026-09-05T133646Z.csv` and
`viewer_game_eligibility_2026-09-05T133646Z.csv`, 1,384 rows each. Dry run via `--export` then
`--input --emit-sql` (`DB(emit_path)` never connects, so `--all --emit-sql` alone reads nothing and
reports 0 games — use the two-step form).

`python -m pipeline.reconcile --all` — 1,384 games, **172 s**, run id **81**, committed.

**Sanity gate, all seven criteria PASS.** Identical before and after: `games` 1,384, eligible 466,
market-pending 176, hidden 918, genuinely-unavailable 389, uncovered 0, orphans 0.

The change set is provably bare-only — 529 games carry zero active broadcast rows, and:

| sport | before | after |
|---|---|---|
| nfl | `no_linear_telecast` 24 (all bare) | `tbd` 24 |
| nhl | `no_linear_telecast` 38 (all bare) | `tbd` 38 |
| nba | `no_linear_telecast` 16 (all bare) | `tbd` 16 |
| cfb | `tbd` 451 (all bare) | unchanged |
| every sport | `assigned` 689, `stream_exclusive` 166 | unchanged, to the row |

`no_linear_telecast` rows remaining: **0**. The 94 distinct reason strings the database holds were not
rewritten — every rows-present rung produces the same string it did before, pinned by
`tests/test_telecast_ladder.py`.
