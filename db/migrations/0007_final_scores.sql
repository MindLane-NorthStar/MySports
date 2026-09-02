-- MySports Milestone 4 part 0 -- final scores (event-history foundations; Joe's decisions 2026-09-01: archive one
-- final end-of-day rendering per sport/day, scores overlaid in the app layer, box-score links ESPN for cfb/nfl/nba
-- and league-native for nhl/mlb, links never displayed as raw URLs -- the completed event card is the click target).
-- Applied as Supabase migration `mysports_0007_final_scores`. Depends on 0003. Additive only: five nullable columns,
-- no rows rewritten; generated_grids (0004) already covers the archive registry and needs nothing.
-- Take a CSV backup of games first (scripts/backup_table.py games).
-- Design choice, recorded: scores are LOADER-WRITTEN provider facts, not reconciled observations -- one structured
-- provider per sport reports objective post-game results, so the evidence/reconciliation machinery (spec 9.6)
-- deliberately does not apply; the reconciler never reads or writes these columns.
set role mysports_owner;
set search_path = mysports;

alter table games
  add column if not exists home_score    int,
  add column if not exists away_score    int,
  add column if not exists result_status text,          -- scheduled | in_progress | final | postponed | cancelled (provider-mapped)
  add column if not exists boxscore_url  text,          -- filled by the loader when result_status first reaches 'final'
  add column if not exists completed_at  timestamptz;   -- first load that saw result_status = 'final'

alter table games drop constraint if exists games_result_status_chk;
alter table games add constraint games_result_status_chk
  check (result_status is null or result_status in ('scheduled','in_progress','final','postponed','cancelled'));

-- the loader (mysports_writer) will insert archive-registry rows going forward; 0004/0005 granted it the
-- observation tables but generated_grids was Milestone-4 deferred -- grant it now, incl. the identity sequence
grant select, insert on generated_grids to mysports_writer;
grant usage, select on all sequences in schema mysports to mysports_writer;

-- verification (visible under --dry-run too)
select count(*) as games, count(home_score) as with_scores, count(result_status) as with_status from games;

reset role;
