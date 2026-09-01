# db/migrations

Source of truth for the `mysports` schema (deployment contract v1.0, D10). Files are applied in order to Supabase project
`ztnppejmdwmhqstqsfks` as migrations named `mysports_NNNN_<name>` — by Cowork through the Supabase connector
(`apply_migration`) or by Claude Code with `psql "$SUPABASE_DB_URL" -f db/migrations/NNNN_name.sql` — and the Supabase
migration history records the same names.

| File | Status | Contents |
|---|---|---|
| 0001_schema_and_roles.sql | applied 2026-09-01 | schema `mysports`, roles `mysports_owner` / `mysports_writer`, default privileges |
| 0002_reference_tables.sql | dry-run passed 2026-09-01 (rolled back) | 20 enums; sources, assets, networks_services, viewer_profiles, viewer_services, carriage_status, markets, conferences, teams, venues, team_territories, render_policies, rivalries |
| 0003_games.sql | dry-run passed 2026-09-01 (rolled back) | games, game_broadcasts, broadcast_crews, rankings, market_coverage, whip_around_*, game_odds, team_records |
| 0004_observations_and_runs.sql | dry-run passed 2026-09-01 (rolled back) | source_snapshots, source_observations, canonical_decisions, canonical_change_history, generated_grids, viewer_game_eligibility, refresh_runs, updated_at trigger |
| 0005_rls_and_seed.sql | dry-run passed 2026-09-01 (rolled back) | RLS on every table (anon read; snapshots/observations/refresh_runs private); seed: market cleveland, viewer profile, render_policies, sources |

Rules: every file starts with `set role mysports_owner; set search_path = mysports;` and ends with `reset role;`; nothing is
ever created in `public`; new tables get RLS + an `anon_read` policy in the same file that creates them.
