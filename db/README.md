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

## Migrations 0012 and 0013 — 2026-09-05 (prompt 47 stage 1)

**0012 — programs own broadcasts, and a race session gets a natural key.** Both are prompt 46's
findings, unchanged.

```sql
alter table game_broadcasts add column if not exists program_id bigint references programs(program_id) on delete cascade;
alter table game_broadcasts alter column game_id drop not null;
alter table game_broadcasts add constraint game_broadcasts_subject_ck check (num_nonnulls(game_id, program_id) = 1);
create index if not exists game_broadcasts_program_idx on game_broadcasts (program_id);
create unique index if not exists game_broadcasts_program_uq
  on game_broadcasts (program_id, service_id, delivery_surface, feed_side) where program_id is not null;
create unique index if not exists programs_race_session_uq
  on programs (sport, series, start_at, title) where program_type = 'race_session';
```

Dropping the NOT NULL is the one non-additive change, named in the run's approval. The subject check
is **exactly one**, not at least one: a row naming both would be read as a game row by every
game-scoped query. The existing `unique (game_id, service_id, delivery_surface, feed_side)` cannot
serve program rows — NULLs are distinct in a unique constraint, so with `game_id` null every re-load
would duplicate — hence the mirrored partial index.

**The one consumer that would have broken:** `pipeline/reconcile.py`'s `--all` branch passed an empty
broadcast where-clause. It now passes `where b.game_id is not null`. The other three
(`--game`, changed-evidence, `render_feed.MEDIA_SQL`) were already game-scoped;
`web/lib/queries.js` embeds through the FK and never sees program rows. Pinned by
`tests/test_program_broadcasts.py`.

**0013 — the real spec-v0.5 gaps, which are fewer than expected.** 0009 already built `subtitle`,
`location_text`, `on_site`, `series`, `headliners`, `hosts_crew`, `open_ended`, `postponed_to`,
`segments`, **and** `game_broadcasts.window_start/window_end`, **and** every `sport` value (nascar,
indycar, ufc, wwe, aew) and every `program_type` value. **0013 therefore contains no `ALTER TYPE` at
all.** What was genuinely missing:

```sql
alter table programs add column if not exists anchor_program_id bigint references programs(program_id);
alter table programs add column if not exists bookend text;   -- check (pre|post)
alter table programs add column if not exists brand_key text;
alter table programs add column if not exists source_url text;
alter table programs add column if not exists source_tier text;
alter table game_broadcasts add constraint game_broadcasts_window_ck check (window_end > window_start);
create unique index programs_weekly_show_uq   on programs (sport, title, start_at)  where program_type = 'weekly_show';
create unique index programs_studio_show_uq   on programs (sport, title, start_at)  where program_type = 'studio_show';
create unique index programs_fight_card_uq    on programs (sport, start_at, title)  where program_type = 'fight_card';
create unique index programs_special_event_uq on programs (sport, start_at, title)  where program_type = 'special_event';
```

`anchor_program_id` is **not** 0009's `parent_program_id`: parent is containment (a segment inside a
show), anchor is what a bookend attaches to and renders against, on a different network row.
`brand_key` is the lookup into `data/brands.json`; 0009's `brand_mark` is a path to one image.

**The studio tables already existed** — 0009 built `studio_shows(show_id, name, network,
sport_covered, brand_mark, default_slot, created_at)` and `studio_show_instances(instance_id,
show_id, program_id, air_date, location_text, on_site, hosts, source_url, source_tier, observed_at)`.
A `create table if not exists` against them is a **silent no-op**, so 0013 extends `studio_shows`
additively instead (`bookend`, `weekday`, `slot_start_et`, `duration_min`, `anchor_rule`,
`active_from`, `active_to`, `source_url`, `updated_at`) and leaves the instance table alone — its
`location_text` / `source_url` / `source_tier` already are the site, its citation and its tier.

Backups first: `artifacts/backups/{programs,game_broadcasts,games}_2026-09-05T172858Z.csv`. Both
files dry-run (`--dry-run` executes and rolls back) before applying. **Post-check, all eight
identical:** programs 1,384 and its id checksum `766cc016245c5ef64e26fd8f0856ca73`, broadcasts 1,061,
rows with a null `game_id` 0, games 1,384, eligible 466, market-pending 176, hidden 918.

## NHL and NBA 2026-27 regular seasons — 2026-09-05 (prompt 47 stage 2)

Loaded through GitHub Actions (`bootstrap_season.yml`, manual dispatch, run
[33981953084](https://github.com/MindLane-NorthStar/MySports/actions/runs/33981953084)), **47m54s**.
Date ranges taken from ESPN's core API rather than typed:
`sports.core.api.espn.com/v2/sports/{hockey/leagues/nhl,basketball/leagues/nba}/seasons/2027/types/2`
gave **NHL 2026-09-28 → 2027-04-11** and **NBA 2026-10-20 → 2027-04-12**.

Backups first: `artifacts/backups/{games,game_broadcasts,programs}_2026-09-05T172858Z.csv` and
`viewer_game_eligibility_2026-09-05T174111Z.csv`.

| | before | after |
|---|---|---|
| nhl | 47 (2026-10-01 → 10-07) | **1,344** (2026-09-29 → 2027-04-10) |
| nba | 19 (2026-10-25 → 10-28) | **1,206** (2026-10-20 → 2027-04-11) |
| cfb / nfl / mlb | 888 / 272 / 158 | unchanged |
| total games | 1,384 | **3,868** |

Loader run id **82** (10,530 fixture games seen across ~371 per-date files, 6,319 broadcasts);
reconcile run id **83** — 3,868 games, eligible **986**, market-pending 176, 3,357 changes.
Only **3** of ~371 dates were empty or unreachable.

**Sanity gate: PASS on every criterion.** No pre-existing count decreased. NHL is **+2.44 % over**
the 1,312 a 82-game season implies — 1,344 is 84 games per club, and it is internally consistent:
1,344 distinct ids, 1,344 distinct `external_primary_id`, 32 distinct home clubs, no
same-matchup-same-day duplicate, every row `competition_context = REGULAR`. It is an overage, not a
shortfall, so it does not trip the 5 % stop. NBA is **−1.95 %** against 1,230, inside the threshold.
**All 1,206 NBA ids match `nba-{9-digit espnEventId}`** — the `65cfdf2` guard holds, so the
live-overlay join is intact. Eligibility coverage **0 uncovered / 0 orphans**.

**NHL/NBA `team_records` remain season 2025 by design** (prompt 37). Their cards will show thin
standings until a 2026-27 standings load exists; that is not this run's work.

**No ESPN 403 on the runner** — and none locally either. See the prompt-47 report: prompt 46's
"ESPN is 403 from this laptop, three times out of three" was an artifact of an ad-hoc User-Agent, not
Akamai. The project UA in `adapters/common.py` returns 200.

## NASCAR 2026 race sessions — 2026-09-05 (prompt 47 stage 3)

98 race sessions loaded with a broadcast each, through `pipeline/load_programs.py`. Backups first:
`artifacts/backups/{programs,game_broadcasts}_2026-09-05T183859Z.csv`. Recorded fixtures and a fresh
fetch produced **identical** row sets (0 drift either way), so no race has moved since Friday.

| | |
|---|---|
| programs | 3,868 → **3,966** (exactly +98) |
| by series | cup 40, oreilly 33, truck 25 |
| broadcasts on programs | **98**, none carrying a `game_id` |
| games | 3,868, unchanged |
| race programs owning a game | 0 |

Per-race outlets, which is the whole point of not writing a per-series constant:
`the-cw` 33, `fs1` 32, `usa-network` 10, `fox` 7, `prime-video` 5, `tnt` 5, `nbc` 4, `fs2` 2.

**Idempotence proven, not assumed:** running the same load a second time left `programs` at 3,966 and
program broadcasts at 98 — every row updated, none inserted. That is 0012/0013's partial unique
indexes doing the job prompt 46 said had to exist before anything could be loaded.

**One thing the load had to learn:** ON CONFLICT will not infer a **partial** unique index unless the
statement repeats the index predicate. `on conflict (sport, series, start_at, title)` alone fails with
*"there is no unique or exclusion constraint matching the ON CONFLICT specification"*. `db.upsert()`
builds no WHERE, so program rows are written with their own statement carrying
`where program_type = '<type>'`.

**Programs have no eligibility rows, and cannot.** `viewer_game_eligibility.game_id` is `text NOT
NULL`, so there is nowhere to record whether a race is on a service the viewer has. Answering "can I
watch this race" needs the same treatment 0012 gave `game_broadcasts` — a nullable `game_id`, a
`program_id`, and a one-subject check. **Open for rendering-contract v1.7**, which is the first thing
that will render a program to a reader.

## 0014 — a program can carry an eligibility verdict — 2026-09-05 (prompt 48 stage 1)

Applied through `scripts/apply_migration.py` (dry run first, then committed). Backup taken first:
`artifacts/backups/viewer_game_eligibility_2026-09-05T192311Z.csv` (3,868 rows).
`db/enums.json` regenerated by `scripts/build_enums.py` and is **byte-identical** — this file adds no
enum type, no enum value and no enum column (22 types, 102 values, 39 enum columns, unchanged).

**The brief asked for 0012's shape and the tree would not take it.** The instruction was: make
`viewer_game_eligibility.game_id` nullable, add `program_id`, add
`check (num_nonnulls(game_id, program_id) = 1)`, add a partial unique index — the mirror of what 0012
did to `game_broadcasts`. That works on `game_broadcasts` because its identity is a surrogate
(`id bigint generated always as identity primary key`) and `game_id` merely carries NOT NULL plus a
UNIQUE. It does not work here:

```
viewer_game_eligibility_pkey  PRIMARY KEY (game_id, viewer_profile_id)
```

`game_id` is half the PRIMARY KEY, and a primary-key column cannot be null — so "make it nullable"
means "drop the primary key" of the table the whole app reads its access verdicts from. The run's
database approval is *additive DDL only … never a drop*, with one named exception for dropping a
NOT NULL. **A primary key is not that exception**, so the capability was built additively instead.

### The DDL, verbatim

```sql
create table if not exists viewer_program_eligibility (
  program_id               bigint   not null references programs(program_id) on delete cascade,
  viewer_profile_id        smallint not null references viewer_profiles(id),
  eligible                 boolean  not null,
  eligible_via_network_id  text     references networks_services(id),
  eligible_via_service_ids text[]   not null default '{}',
  reason                   text,
  computed_at              timestamptz not null default now(),
  entitlement_version      text,
  market_pending           boolean,
  primary key (program_id, viewer_profile_id)
);

create index if not exists viewer_program_eligibility_program_idx
  on viewer_program_eligibility (program_id);

alter table viewer_program_eligibility enable row level security;
drop policy if exists anon_read on viewer_program_eligibility;
create policy anon_read on viewer_program_eligibility for select to anon, authenticated using (true);
```

Plus two `comment on` statements. **Nothing else is touched** — no existing table, column, constraint,
index or row appears in this file.

### What the separate table buys

- **Every existing count is unchanged BY CONSTRUCTION**, not by a `where game_id is not null` guard
  bolted onto each consumer and hoped to be complete.
- **NULLs are never distinct here** — neither key column is nullable, so 0012's partial-index problem
  cannot arise at all.
- PostgREST embeds it from `programs` on an unambiguous FK, exactly as `games` embeds its own, so
  `web/lib/offservice.js` keeps **one** helper reading **one** row shape.

The cost, named: two tables hold one concept, and a query wanting "every eligibility row regardless of
subject" would have to union them. Nothing in the tree wants that.

### Consumers of `viewer_game_eligibility`, each with its decision

| consumer | decision |
|---|---|
| `pipeline/reconcile.py:reconcile_game` | unchanged — still the only writer of the game table |
| `pipeline/db.py` `_NATURAL_KEYS` | unchanged; the new table falls through to the generic id-ish key |
| `web/lib/queries.js` `GAME_SELECT` embed | unchanged; a second embed is added from `programs` |
| `web/lib/offservice.js` | unchanged — it reads a row shape, and both tables have the same one |
| `scripts/backfill_market_pending.py` | unchanged (a one-time 0010 backfill, game-only by design) |
| database views / functions over the table | **none exist** — verified against `information_schema` |

### The reconcile — run id 84

`python -m pipeline.reconcile --programs`, 98 programs in one pass. Rule 27 checked first: the last
`schedule_refresh` completed (as a failure — the 0012-era deadlock) at 2026-09-05T13:37:02Z and the
next is a day out; nothing else was writing.

Dry run first, as `--export` then `--input … --emit-sql`: **99 statements, of which 98 are
`insert into viewer_program_eligibility` and zero touch the game side.**

**Sanity gate: PASS on every criterion.**

| | before | after |
|---|---|---|
| `viewer_game_eligibility` rows | 3,868 | 3,868 |
| eligible / market-pending (games) | 986 / 176 | 986 / 176 |
| md5 over every game row's verdict | `d4fa47cb02ab41427267dfcff1eb8440` | `d4fa47cb02ab41427267dfcff1eb8440` |
| `viewer_program_eligibility` rows | 0 | **98** |
| uncovered programs / orphan rows | — | **0 / 0** |

The checksum is the proof that no existing game row was touched, not a row count that could hide an
offsetting change.

**The 98 by network:** `the-cw` 33 · `fs1` 32 · `usa-network` 10 · `fox` 7 · `prime-video` 5 (all
`stream_exclusive`) · `tnt` 5 · `nbc` 4 · `fs2` 2. Market-pending 0 — no NASCAR row carries the
`unverified` access status that state is read from.

### One thing this stage found wrong in the data it was reconciling

`adapters/nascar.py` wrote `access_status: "available"` for **every** broadcaster the feed named, so
the two 2026 races on **FS2** — the Cook Out Clash at Bowman Gray (Feb 4) and the Black's Tire 250
(Aug 14) — say *"linear fs2, eligible"* when `data/access_profile.json` lists FS2 under
`unavailable`. Telling Joe he can watch something he cannot is the same class of error as inventing a
network.

**Fixed at the choke point, not in the adapter:** `pipeline/load_programs.py` now classifies every
broadcast row itself through `adapters.common.access_status_for`, so every adapter this run ships
inherits it. An adapter's own value is honoured only for `out_of_market` / `unverified`, the two
states that are facts about a regional window rather than about the profile.

**The two rows themselves are still wrong in the database**, because a NASCAR re-load is not in this
run's approved write list. They self-heal: the daily `schedule_refresh` NASCAR step re-loads through
the fixed loader on its natural key, after which a `--programs` reconcile flips them. Two past races
in History; named here so nobody has to rediscover it.

## 0015 — the race-session natural key survives a NULL series — 2026-09-05 (prompt 48 stage 3)

**Found by loading IndyCar, and it is 0012's own finding in a second place.** 0012 wrote:
*"NULLs are distinct in a unique constraint, so with game_id null every program broadcast looks new
and a re-load duplicates all of them."* The same sentence is true of `programs.series`, and the index
0012 created is the one it is true of:

```sql
create unique index programs_race_session_uq
  on programs (sport, series, start_at, title) where program_type = 'race_session';
```

NASCAR carries a series on every row (`cup` / `oreilly` / `truck`), so 98 races reload cleanly.
**IndyCar runs one series and carries `series = null`** — register §16 named that trap explicitly, that
a `racing` series value "would make IndyCar a fourth series alongside NASCAR's Cup, O'Reilly and
Truck". So every IndyCar row looked new to `ON CONFLICT` and a second load INSERTED. **Measured: two
runs of the same 18 races produced 36 rows.**

### The DDL, verbatim

```sql
create unique index if not exists programs_race_session_key_uq
  on programs (sport, (coalesce(series, '')), start_at, title)
  where program_type = 'race_session';
```

Plus a `comment on index`. **0012's index is LEFT IN PLACE** — it is not wrong, only insufficient, and
dropping it would be a drop this run's approval does not allow. `pipeline/load_programs.py` conflicts
on the new one, repeating both the expression and the predicate (0012's lesson about partial indexes,
now also about expression indexes).

### The one row-level write, and why it is in a migration

A unique index cannot be built over duplicate rows, so the 18 second copies **this run's own IndyCar
load created** had to go first. It is scoped to exactly those — `sport = 'indycar'`, keeping the
lowest `program_id` of each `(title, start_at)` group — and the migration **asserts** afterwards that
no non-IndyCar row moved, raising an exception if one did. Their `game_broadcasts` rows follow through
0012's `on delete cascade`. Backups taken before the load that made them:
`artifacts/backups/{programs,game_broadcasts}_2026-09-05T205219Z.csv` (3,966 and 2,374 rows).

Dry run and apply both reported: `indycar 36 -> 18 (18 duplicate rows removed); every other sport
3966 -> 3966`.

## IndyCar 2026 — 2026-09-05 (prompt 48 stage 3)

18 race sessions with a broadcast each, from `indycar.com/Schedule` through `adapters/indycar.py`.
**Built against 2026 rather than deferred to 2027** — Joe's amendment of 2026-09-05, register §17,
which supersedes the recommendation in `docs/research/indycar.md` §10 and research-summary-2 §6.

| | |
|---|---|
| programs | 3,966 → **3,984** (exactly +18) |
| by sport | nascar 98, indycar 18 |
| broadcasts on programs | 98 → **116** |
| games | 3,868, unchanged |
| networks | `FOX` 17, `FS1` 1 |
| eligibility | **116 rows, 0 uncovered, 0 orphans** — every race `eligible` |

**The recorded fetch and a fresh one produced identical row sets** (0 drift either way), and the
second and third loads reported 18 programs and 18 broadcasts with the totals unmoved — idempotence
proven after 0015, not assumed.

**Reconcile run id 85**, 116 programs. The game side is provably untouched: the md5 over all 3,868
game verdicts is `d4fa47cb02ab41427267dfcff1eb8440` before and after, unchanged since stage 1.

### What the cross-check found, and the trap inside it

ESPN's `racing/irl` scoreboard was used to verify every start, the same discipline that caught
cf.nascar.com. **Do not verify against `leagues[0].calendar`:** its `startDate` is a fixed THREE HOURS
later than the race on 15 of the 18 entries, and ESPN's own `events[].date` for the same race
disagrees with its own calendar by exactly that (Monterey is `18:30Z` as an event and `21:30Z` in the
calendar). A first pass compared against the calendar, reported 18 of 18 races wrong, and would have
"corrected" a correct adapter into a three-hour error across a whole season.

Against the per-date `events[].date`, **14 of 18 agree to the minute.** The four that differ are
broadcast-window versus green-flag, not zone errors:

| race | indycar.com | ESPN | note |
|---|---|---|---|
| Indianapolis 500 | 10:00 AM ET | 12:00 PM ET | the research doc's "six-hour window from 10 AM" |
| Arlington | 11:30 AM ET | 12:30 PM ET | the doc names an "Arlington 30 min" pre-race |
| Washington DC | 11:30 AM ET | 1:00 PM ET | same shape, 90 minutes |
| Milwaukee race 2 | 6:00 PM ET | — | ESPN lists ONE Milwaukee event that day; the page lists two |

**indycar.com wins on all four**: a TV grid draws the window a viewer tunes to. Recorded so nobody
"fixes" it later.

**Also worth recording:** the page lists **both** Milwaukee races on Aug 30, where
`docs/research/indycar.md` §2 says "Milwaukee Aug 29–30" and ESPN's calendar puts race 1 on Aug 29.
The page is the authority the research verified, so the page is what loaded; the disagreement is a
watch item, not a silent correction.

## WWE, rest of 2026 — 2026-09-05 (prompt 48 stage 4)

36 programs from wwe.com through `adapters/wwe.py`: **33 weekly shows and 3 premium live events**.
Backups first: `artifacts/backups/{programs,game_broadcasts}_2026-09-05T210644Z.csv`.

Two surfaces, joined on the date, both verified fetch-clean in `docs/research/wwe.md` §1 and
re-verified from this laptop at 200: the **"Premier Shows" block** (slots, times, platforms and the
PLE dates) and **wwe.com/events** (the names and venues the block does not carry).

| | |
|---|---|
| programs | 3,984 → **4,020** (exactly +36) |
| Monday Night Raw | 17 episodes, Netflix |
| Friday Night SmackDown | 16 episodes, USA Network |
| PLEs | Money in the Bank (Oct 10, New Orleans), Survivor Series: WarGames (Nov 28, Houston) — both ESPN Unlimited; Sunday Night's Main Event (Sept 6, Atlanta) — Peacock |
| broadcasts on programs | 116 → **152** |
| games | 3,868, unchanged |

**Sanity gate: PASS.** Every Monday and every Friday from Sept 5 to Dec 31 carries **exactly one**
show — 17 and 16 rows, one weekday each, zero duplicates, **zero gaps**. A second load reported 36
programs and 36 broadcasts with every total unmoved. Reconcile **run id 86**, 152 programs,
0 uncovered, 0 orphans; the game-side md5 is still `d4fa47cb02ab41427267dfcff1eb8440`.

Verdicts: `stream only: netflix` 17 · `linear usa-network` 16 · `stream only: espn-unlimited` 2 ·
`stream only: peacock` 1.

### What was deliberately NOT loaded

- **NXT.** Register §7 Q7 dropped it entirely, and the Premier Shows block lists its slot right
  beside the rest ("Tuesdays at 8 ET/7 CT on The CW"). Dropped, and the drop is reported rather than
  silent.
- **AAA's TripleMania 34 (both nights) and the WWE/AAA/NXT Worlds Collide crossover**, which sit in
  the same events carousel as the PLEs. Not main-roster WWE; two of them are not WWE at all.
- **The Netflix twin of each PLE.** The block lists both Oct 10 and Nov 28 **twice** — once on "ESPN
  with the Unlimited Plan" and once on "Netflix" — exactly as `docs/research/wwe.md` §2 flagged.
  ESPN Unlimited only is loaded. **WATCH ITEM:** if Netflix does carry them in the U.S. it changes
  nothing about whether Joe can watch (he has both) and changes which chips the card shows. Close it
  from a U.S.-specific WWE or ESPN release.

### Crews are empty, and that is a decision

`docs/research/wwe.md` §6: *"WWE crews cannot be sourced from WWE itself with any regularity"* — they
are REPORTED by trades, not announced. The design of record's crew tier takes announcements, so
`hosts_crew` is `[]` on every WWE row. Register §17's hand-curation amendment covers **College
GameDay and Big Noon Kickoff only**.

### One thing the page does not carry

**No preemption source.** The brief asked for a gap where "the site lists a preemption"; the Premier
Shows block states a standing slot and nothing else, so every Monday and Friday gets a row and there
is no page to consult for a holiday move. `docs/research/wwe.md` §5 notes NBCU has moved SmackDown on
holidays before, marked UNVERIFIED for 2026. The daily refresh step re-reads the block, so a slot
change lands; a one-week move will not.

## AEW, rest of 2026 — 2026-09-05 (prompt 48 stage 5)

35 episodes through `adapters/aew.py`. Backups first:
`artifacts/backups/{programs,game_broadcasts}_2026-09-05T211905Z.csv`.

**WHICH PATH RAN, which is the first thing to know about this data.** `docs/research/aew.md` §1 and §5
are emphatic that the **WBD monthly HBO Max schedule is the ONLY authority** for AEW's night and
network — Collision aired on TBS rather than TNT on Aug 22 and moved to Thursdays twice in July. The
brief's fallback order is the WBD schedule, else a trade republication, else the slot default marked
as such.

**The third path ran.** Measured on the day: `press.wbd.com` answers **200** — its stage-0 403 was
transient — but carries **no AEW content at its root**, and neither `pwmania.com` nor
`ewrestlingnews.com` had republished a monthly schedule. So 33 of 35 rows are tiered `slot_default`
and 2 are `research_document`.

**The slots are sourced, not remembered.** allelitewrestling.com states both verbatim — *"Dynamite
airs every Wednesday night 8e/7c on TBS + Simulcasted on HBO MAX"*, *"AEW Collision airs every
Saturday at 8e/7c on TNT + Simulcasted on HBO MAX"* — recorded at `tests/fixtures/aew_slots.html` and
asserted against its bytes. The adapter **re-reads that page on every run** and reports a DRIFT line
if the site stops agreeing with `data/aew_2026_schedule.json`, which is the failure mode a slot
default invites.

| | |
|---|---|
| programs | 4,020 → **4,055** (exactly +35) |
| AEW Dynamite | 17, TBS + HBO Max |
| AEW Collision | 17, TNT + HBO Max (one of them the All Out–week move) |
| AEW Collision: Tailgate to All Out | 1, TNT, Sat Sept 26 7 PM |
| broadcasts on programs | 152 → **222** (two per episode: the linear row and the simulcast) |
| games | 3,868, unchanged |

**September matches the research doc's list exactly** — Sept 5 / 12 / 19 Collision, Sept 9 / 16 / 23
Dynamite, Collision moved to **Wed Sept 23 at 10 PM for one hour** in All Out week (and that
Saturday's regular Collision suppressed, not doubled), and the Tailgate special on Sept 26. Second
load moved nothing. Reconcile **run id 87**, 187 programs, 0 uncovered, 0 orphans; the game-side md5
is unchanged.

Verdicts: `linear tbs` 18 · `linear tnt` 17 — **the linear row wins and HBO Max is the chip**, which
is `docs/research/aew.md` §2's rule. Both rows are written; only the linear one is `is_primary`.

### Not loaded, each with its reason

| what | why |
|---|---|
| AEW PPVs | register §7 Q3 — purchasable content is excluded, and v0.5 has no `purchasable` access state |
| "Zero Hour" HBO Max pre-shows | `docs/research/aew.md` §10's recommendation, taken: it exists only to sell the PPV |
| **Countdown to All Out, Sept 23 11 PM** | **a source gap, not a scope decision.** A linear pre-show IS in scope by the same §10 recommendation; the doc gives the time but **not the network**, and a network typed from memory is the invented fact this run does not make. It loads the day a network is stated. |

**AEW gets no chip** (register §13's amendment to §9) — it loads, appears under ALL SPORTS and renders
on its networks. That is a chip-row decision and the adapter is unaffected by it.

## Studio shows — the registry, the instances, the crews — 2026-09-05 (prompt 48 stage 6)

**111 instances across 7 shows**, plus the `studio_shows` registry and 111 `studio_show_instances`
observations. Backups first: `artifacts/backups/{programs,game_broadcasts,studio_shows,studio_show_instances}_2026-09-05T213153Z.csv`.

| | |
|---|---|
| programs | 4,055 → **4,166** (exactly +111) |
| College GameDay | 16 · ESPN + ESPNU | Big Noon Kickoff | 15 · FOX |
| FOX NFL Kickoff / FOX NFL Sunday | 16 each · FOX (**two cards**, events-summary-2 §6's recommendation taken) |
| The NFL Today | 16 · CBS | Football Night in America | 16 · NBC + Peacock |
| Monday Night Countdown | 16 · ESPN | | |
| `studio_shows` | **7** | `studio_show_instances` | **111, all 111 linked to a program** |
| broadcasts on programs | 152 → **2,641 total** (+143) | games | 3,868, unchanged |

**Sanity gate: PASS.** One instance per `(show, air_date)` — zero duplicate groups. Every instance
linked to its program. A second run of both loaders moved nothing. Reconcile **run id 88**, 298
programs, 0 uncovered, 0 orphans; the game-side md5 is unchanged.

### The bookend rule is realised in the DATA

`pipeline/load_studio_shows.py` resolves each instance's anchor as it generates the row and writes
the shortened `expected_duration_min` onto it. **91 of 111 found an anchor.** Football Night in
America's 120-minute slot becomes **80** against an 8:20 PM SNF kickoff. The 20 that did not are CFB
weeks past the announcement horizon, where no game carries a broadcast row yet — those render at
their slot on their own row, which is a real state and not a failure.

### What the sources actually gave

| source | result |
|---|---|
| **espnpressroom.com** | **CLEAN, and more than the doc promised.** The Week 1 release gives GameDay's site (**Baton Rouge, LA**), its window (Sat Sept 5, 9 a.m.–noon ET), its networks, **and its ANNOUNCED nine-member 2026 on-air team** — Rece Davis, Kirk Herbstreit, Desmond Howard, Pat McAfee, Nick Saban, "Stanford Steve" Coughlin, Jen Lada, Jess Sims, Pete Thamel. An announcement outranks the hand-curation register §17 permits, so that is what was used, with the release cited on every seat. |
| espnpressroom.com/us/college-gameday/ | 200, but its single table is a **historical January bowl table**, not the weekly Date/Site/Game table `docs/research/studio-shows.md` §6 described. The weekly site is prose inside each week's own release, so that is what is parsed. |
| **foxsports.com Press Pass** | The doc marked fetchability UNVERIFIED. **Now verified: fetch-clean but CONTENT-EMPTY.** 200 on `/presspass`, `/presspass/latest-news` and `/presspass/latest-news/weekly-schedule`, with **zero tables and zero occurrences of "Big Noon"** on all three — the page is JS-rendered. So Big Noon's site is `tba` (no subtitle) and its crew is TBA. **Neither is guessed.** |

**Site tiers: 1 `announced`, 110 `reported`** — one release means one week. There is no page listing
every week's site, so a week without a recorded release has none.

### Not loaded, and why

Three shows the brief names have **no verified 2026 slot** in `docs/research/studio-shows.md` §1, and
the brief's own rule is *"Nothing not in the doc"*:

- ~~**Sunday NFL Countdown** — absent from the doc's "Verified 2026 slots" list entirely.~~
  **Registered by prompt 86 (2026-09-10)** as `sundaynflcountdown`: ESPN's release states Sun 10 a.m.–1
  p.m. ET on ESPN, §1 now carries it, and it is the first STANDALONE show — `anchor_rule` null, which
  is 0013's own word for "renders at its slot on its own row".
- **Prime Video TNF pregame** — the doc gives "Thu **~**7:00 PM ET", with the tilde. An approximate
  start is not a slot.
- **Netflix NFL pregames** — one dated game and "pregame format [UNVERIFIED]".
- **NASCAR RaceDay and the USA pre/post-race shows** — "30 min each side of the race" but no stated
  start for RaceDay and no machine-readable source. Deriving a broadcast from another broadcast is a
  rule the research has not blessed.

Each is recorded in `data/studio_shows.json`'s `_not_loaded` with its reason, so it arrives the day a
source states its slot rather than being rediscovered.

### The tripwire moved on Sept 5, and here is exactly why

| | before | after |
|---|---|---|
| CFB `2026-09-05` blocks | 62 | **64** (+2: College GameDay, Big Noon Kickoff) |
| block widths | {240, 223} | {240, 223, **205, 136**} — every GAME width unchanged |
| scrollWidth | 1073 | **1282** (+209: the axis now opens at 9:00 AM for GameDay, earlier than the first kickoff) |
| rows | 15 | 15 — both shows sit on ESPN's and FOX's existing rows |
| name count / measured width | 124 / 14744 | 124 / 14744 — **unchanged**, so no game name moved |
| MLB `2026-09-03` | 3 / {228} / 577 | 3 / {228} / 577 — **untouched** |

**New baseline:** CFB `2026-09-05` = **64 / {240, 223, 205, 136} / 1282**; MLB `2026-09-03` =
3 / {228} / 577.

## UFC, rest of 2026 — 2026-09-05 (prompt 48 stage 7)

**9 fight cards** from the Paramount+ "Sneak Peak" schedule page through `adapters/ufc.py`. Backups:
`artifacts/backups/{programs,game_broadcasts}_2026-09-05T214154Z.csv`.

| | |
|---|---|
| programs | 4,166 → **4,175** (exactly +9) |
| cards | Sept 5 Paris · Sept 12 Glendale · Sept 19 **UFC 331** LA · Sept 26 APEX · Oct 3 **UFC 332** Salt Lake · Oct 10 APEX · Oct 17 Edmonton · Oct 24 **UFC 333** Abu Dhabi · Nov 7 APEX |
| broadcasts | 2,641 → **2,650** — Paramount+ on every card, nothing else |
| games | 3,868, unchanged |
| eligibility | 307 rows, 0 uncovered, 0 orphans; all 9 `stream only: paramount-plus` |

**Nine, where `docs/research/ufc.md` §1 listed eight** — the page gained the Oct 10 Fight Night since
the doc was written, which is the page being the authority rather than the doc. Second load moved
nothing. Reconcile **run id 90**; the game-side md5 is unchanged.

### What is deliberately absent

- **No segment dividers and no CBS window overlay on the card.** Joe, 2026-09-03, in the design of
  record — one plain card, superseding the register's own Q2.
- **`segments` is the EMPTY ARRAY, not a guess.** The page carries the **main-card start only**;
  `docs/research/ufc.md` §1 names that as its weakness and §5 warns early prelims can begin three
  hours earlier. A convention-derived prelims time would put a wrong start on the grid for **every**
  card. *(Empty and not null: `programs.segments` is `jsonb NOT NULL default '[]'` from 0009, and a
  null failed the entire load — which is how this was found. The transaction rolled back cleanly and
  nothing landed; verified at 4,166 / 0 UFC rows before the retry.)*
- **No CBS row.** No upcoming card flags a simulcast, and the page says it outright on the Sept 5
  card: *"There is no pay-per-view or CBS simulcast."* Paramount Press Express was re-read and
  carries **zero** UFC/CBS sentences. A window inferred from UFC 326's 8–10 PM precedent would be an
  invented broadcast. **0 windowed rows, and 0 of them outside their card's span** — the gate passes
  vacuously and honestly.
- **No odds.** Register §9 puts UFC moneylines under `show_odds` via The Odds API
  `mma_mixed_martial_arts`; the brief forbids adding a provider key tonight.

### One defect a UFC card exposed in code that predates it

`web/lib/bandstate.js` read a slate as **already finished** whenever its last program ended at or
after 03:00. `primeWindow` reports `closesAt` as a wall clock and `pastCutover` only lifts a value
*before* 03:00, so UFC 331 — 9 PM with a 360-minute block — closed at `"03:00"`, came back as **180**,
and 180 is smaller than the window's own 14:00 opening. D1 jumped to FINALS, found none, and rendered
*"Nothing loaded for this viewing day yet"* over a card that had not started.

**A window cannot close before it opens.** That is a wrap, and it is now read as one. Pinned by two
tests in `web/test/bandstate.test.mjs`: the wrap case, and an ordinary day still reaching FINALS on
time.

## NASCAR start times corrected in place — 2026-09-05 (prompt 49 stage 3)

**Approved by Joe, 2026-09-06 ("NASCAR fix is approved"):** a targeted `UPDATE` of `start_at` on
exactly the 98 NASCAR race-session rows prompt 47 loaded. Nothing else was written.
Backups first: `artifacts/backups/{programs,game_broadcasts}_2026-09-05T234942Z.csv`
(4,190 and 2,681 rows).

**The defect**, from prompt 48's report: `cf.nascar.com` publishes `race_date` as a **naive Eastern
wall clock** and `adapters/common.parse_iso` stamps a naive value UTC, so every race sat 4 hours
early in EDT and 5 in EST. Prompt 48 fixed the adapter (`77258ff`) and could not fix the rows,
because `start_at` is part of the race-session natural key and a corrected time reads as a different
race — the moved-twin guard skipped all 98 on the runner, by design.

### How each row was matched — and why it is not "matching by start_at"

The loader stored **no race id**: `adapters/nascar.py` carries `race_id` in `_provenance`, and
`pipeline/load_programs.py`'s `PROGRAM_COLS` does not include it, so it never reached the database.
`source_url` is per-**series**, not per-race. Title plus series is ambiguous — the two Daytona Duels
share a title and a day.

So each feed race was matched on `(series, title, THE VALUE THE BUGGY LOADER WOULD HAVE WRITTEN)` —
the naive wall clock read as UTC. An exact three-part key that disambiguates the Duels (their naive
times differ, 14:00 and 15:45) and, unlike a fuzzy match, **proves the defect's mechanism on every
row it touches**. `scripts/fix_nascar_start_times.py`; a row that did not match would have stopped
the stage.

**98 of 98 stored rows matched 98 of 98 feed races. Zero unmatched either way.**

### The gate, and the two rows that corrected it

Offsets seen: `+4h` and `+5h`. A first gate asserted "+5h in January, February, November and
December" and **failed two correct rows** — DST 2026 runs **Sunday March 8 to Sunday November 1**, so
the DuraMAX Texas Grand Prix (Mar 1) and the GOVX 200 (Mar 7) are genuinely EST and genuinely +5h.
The gate now asks `zoneinfo` for the offset at each instant, which cannot be wrong about a transition
week.

| | before | after |
|---|---|---|
| Cook Out Southern 500 (Darlington) | 2026-09-06 **13:00 ET** | **17:00 ET** |
| DAYTONA 500 | 2026-02-15 09:30 ET | 14:30 ET |
| America 250 Florida Duel #1 / #2 | 14:00 / 15:45 ET | 19:00 / 20:45 ET |
| NASCAR Championship Race | 2026-11-08 10:00 ET | 15:00 ET |

### What else moved: nothing, and it is checksummed rather than asserted

`programs` carries **no column derived from `start_at`** — no `viewing_day`, no stored end;
`expected_duration_min` is a duration and `postponed_to` is null on all 98. The viewing day is
derived in the app from `start_at` (`web/lib/programs.js` `viewingDayOf`), so it follows. **None of
the 98 attached `game_broadcasts` rows carries a `window_start` or `window_end`** — 0 of 0.

| checksum | before | after | unchanged |
|---|---|---|---|
| every non-NASCAR-race `programs.start_at` | `ea253df60f16a82e…` | `ea253df60f16a82e…` | **YES** |
| `viewer_program_eligibility` verdicts | `2112eac7f64f67d7…` | `2112eac7f64f67d7…` | **YES** |
| `viewer_game_eligibility` verdicts | `1517d6f676eb710b…` | `1517d6f676eb710b…` | **YES** |
| `game_broadcasts` windows | `5ebe727778017e62…` | `5ebe727778017e62…` | **YES** |
| NASCAR race sessions | 98 | **98** | — |

**Verified on the page**, not just in the database: `/?day=2026-09-06&sport=racing` renders the list
card's time column and the grid block's tray as **`5:00 PM`** and `5:00 PM · Darlington Raceway` —
the feed's value, matching ESPN's `2026-09-06T21:00Z`. Screenshots in
`artifacts/qa/2026-09-06-nascar-times/`.

**The DAYTONA 500 keeps cf.nascar.com's 2:30 PM ET**, which prompt 48 recorded as a one-hour
disagreement with ESPN's 1:30 PM. This correction fixes the **timezone** defect only; the source
disagreement is untouched and still open.

## 0016 — a race session's natural key stops depending on start_at — 2026-09-05 (prompt 49 stage 4)

**Approved by Joe, 2026-09-06:** migration 0016, additive. Applied through
`scripts/apply_migration.py` (dry run first). Backups:
`artifacts/backups/programs_2026-09-05T235356Z.csv` (4,190 rows) and
`..._235713Z.csv` before the verification load. `db/enums.json` regenerated and **byte-identical** —
`external_id` is `text`, so no enum type, value or column moved (22 / 102 / 39, unchanged).

**Why 0012's key was never a key.** `(sport, series, start_at, title)` holds while a schedule only
gains races and breaks the moment one MOVES: a corrected or postponed time is a different key,
`ON CONFLICT` matches nothing, and the loader inserts a second copy. Prompt 48 proved it on the
runner — the moved-twin guard logged `MOVED-TWIN SKIPPED 98 row(s)` and refused to load one.
`docs/research/nascar.md` §5 makes it permanent: rain moves races to Monday.

### The DDL, verbatim

```sql
alter table programs add column if not exists external_id text;

create unique index if not exists programs_race_session_external_uq
  on programs (sport, (coalesce(series, '')), external_id)
  where program_type = 'race_session' and external_id is not null;
```

Plus two `comment on` statements. **0012's `programs_race_session_uq` and 0015's
`programs_race_session_key_uq` are both KEPT** — dropping one is not additive and this run's approval
does not allow it. They still apply to rows with no `external_id` and are superseded for rows that
have one; **drop them in a later, separately approved migration** once every race session carries an
id.

**`coalesce(series, '')` and not the bare `series` the brief specified.** That is 0015's lesson
applied one migration later rather than relearned: NULLs are distinct in a unique index, NASCAR
carries a series on every row and IndyCar runs one and carries none (register §16). The bare form
would have made every IndyCar row invisible to its own key — the exact bug 0015 exists to fix.

### The backfill — within write (a): the same 98 rows, one more column

`scripts/fix_nascar_start_times.py --backfill-external-id --apply`, on the same feed-id match stage 3
used. **98 non-null, 98 distinct within series.** Every checksum unchanged.

The script is **re-runnable**: it recognises a row still carrying the defect (holding the naive wall
clock read as UTC) *and* a row already corrected (holding the right instant), so a second invocation
reports `98 matched, 0 need moving, 98 already correct` instead of looking like a failure. The first
version matched 0 of 98 on its second run, which is exactly the misleading signal a one-state matcher
gives.

### The loader

Race sessions upsert on `(sport, coalesce(series, ''), external_id)` when the adapter supplies one —
repeating both the expression **and** the partial predicate, which is prompt 47's finding — and fall
back to 0015's key when it does not. `adapters/nascar.py` supplies the feed's `race_id`;
`adapters/indycar.py` supplies its schedule slug.

**ADOPTION is the part with teeth.** A row loaded before 0016 has `external_id` null, so the new key
cannot see it and an insert would duplicate the race it already holds. The loader stamps the id onto
that row first, matched on series, title **and** `start_at` so it can only ever adopt an otherwise
identical row — the two Daytona Duels share a title, a series and a day, and adopting on title alone
would stamp one id onto both and violate the new index. Exactly one match, or nothing is stamped.

The moved-twin guard is **relaxed for keyed rows** and unchanged for keyless ones. A keyed race that
moves is an UPDATE and says so: `moved: 'Race' (nascar 5624) <old> -> <new>`.

### Verification load, and two writes beyond the letter of the approval

Re-loading the corrected feed reported **98 programs, 98 broadcasts, 0 inserted** — `programs` still
4,190, NASCAR still 98. But a load writes the `game_broadcasts` rows it owns, and **2 changed**: the
Cook Out Clash and the Black's Tire 250, both on **FS2**, from `available` to `unavailable`. That is
the defect prompt 48 found and could not fix. No row was added (2,681 before and after).

A `--programs` reconcile (**run id 96**) then followed, because those two rows had left
`viewer_program_eligibility` contradicting `game_broadcasts`. They now read
`not receivable: fs2=unavailable`; NASCAR is **96 eligible / 2 not**; 307 rows, 0 uncovered, and the
game-verdict md5 `1517d6f676eb710b30fc3b35516f37a5` is unchanged.

**Both writes were outside the approval's letter**, both only propagate already-approved facts into
derived tables, and reverting either would restore a state prompt 48 documented as wrong — but a dry
run should have come first, and this records that it did not.
