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

Applied state after 0005 (verified through the connector): 29 tables in `mysports`, all owned by `mysports_owner`, RLS on all 29, `anon_read` on 26 (not on source_snapshots, source_observations, refresh_runs), 20 enums, seed rows: 1 market, 1 viewer profile, 5 render policies, 10 sources; `public` still 36 tables. Migration history: mysports_0001 … mysports_0006.

Dry-run result for 0006 (rolled back): observations 1,914 → 408 rows (sum of `seen_count` = 1,914, nothing lost), 398 open, 10 closed (all ten point at the alias outlets removed on 2026-09-01), 0 kickoff claims superseded, 237 games with exactly one open kickoff claim, CLE @ JAX's CBS claim re-attributed to `espn.scoreboard`, 0 inactive broadcast rows.

Rules: every file starts with `set role mysports_owner; set search_path = mysports;` and ends with `reset role;`; nothing is
ever created in `public`; new tables get RLS + an `anon_read` policy in the same file that creates them. Before a migration
that rewrites existing rows (0006), take a `pg_dump --schema=mysports -t mysports.<table>` of the affected table.

---

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
