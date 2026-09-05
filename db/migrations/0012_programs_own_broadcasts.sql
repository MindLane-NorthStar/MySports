-- 0012 — programs own broadcasts, and a race session has a natural key.
--
-- Both findings are prompt 46's, reported there and unchanged here.
--
-- 1. A PROGRAM COULD NOT OWN A BROADCAST ROW. game_broadcasts.game_id was NOT NULL and referenced
--    games; the table had no program_id at all. So a NASCAR race - a program with no games row -
--    had nowhere to record that it is on FS2. The subject becomes "exactly one of game_id or
--    program_id", enforced by a check rather than by convention.
--
-- 2. programs HAD NO NATURAL KEY. Its only unique constraint was the identity primary key, so a
--    loader had nothing to upsert on and a second run would insert 98 duplicate race sessions
--    rather than update 98 rows.
--
-- DROPPING THE NOT NULL IS THE ONE NON-ADDITIVE CHANGE IN THIS FILE, and it is named in the run's
-- approval. Every existing row keeps its game_id; the check constraint validates them all on the way
-- in (num_nonnulls(game_id, program_id) = 1 is true for every row that has a game and no program).

set role mysports_owner;
set search_path = mysports;

alter table game_broadcasts
  add column if not exists program_id bigint references programs(program_id) on delete cascade;

alter table game_broadcasts
  alter column game_id drop not null;

-- Exactly one subject. Not "at least one": a row that named both would be ambiguous to every
-- consumer, and the reconciler's `where game_id = %s` would silently treat it as a game row.
alter table game_broadcasts
  drop constraint if exists game_broadcasts_subject_ck;
alter table game_broadcasts
  add constraint game_broadcasts_subject_ck
  check (num_nonnulls(game_id, program_id) = 1);

create index if not exists game_broadcasts_program_idx
  on game_broadcasts (program_id);

-- THE EXISTING unique (game_id, service_id, delivery_surface, feed_side) CANNOT SERVE PROGRAM ROWS.
-- NULLs are distinct in a unique constraint, so with game_id null every program broadcast looks new
-- and a re-load duplicates all of them. A partial index over program_id is the mirror of it.
create unique index if not exists game_broadcasts_program_uq
  on game_broadcasts (program_id, service_id, delivery_surface, feed_side)
  where program_id is not null;

-- The race-session natural key. Partial, because it is only these rows that this identifies: a
-- weekly show or a fight card gets its own key in 0013.
create unique index if not exists programs_race_session_uq
  on programs (sport, series, start_at, title)
  where program_type = 'race_session';
