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
