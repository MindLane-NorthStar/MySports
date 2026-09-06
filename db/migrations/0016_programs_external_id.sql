-- 0016 — a race session's natural key stops depending on the time it starts.
--
-- WHY THIS EXISTS. 0012 keyed a race session on `(sport, series, start_at, title)`. That works while
-- a schedule only gains races and breaks the moment one MOVES: a corrected or postponed time is a
-- different key, so `ON CONFLICT` matches nothing and the loader INSERTS a second copy of the same
-- race. Prompt 48 found cf.nascar.com publishes naive Eastern timestamps, prompt 49 corrected all 98
-- rows, and between those two the only thing standing between the schedule and 98 duplicates was a
-- guard that SKIPPED every race rather than loading it. A guard that refuses to work is not a key.
--
-- `postponed_to` makes this permanent rather than one-off: `docs/research/nascar.md` §5 says rain
-- moves races to Monday and that "the watch task must catch the move". Under 0012's key every such
-- move is a new race.
--
-- `external_id` IS THE FEED'S OWN `race_id`, which cf.nascar.com already publishes on every entry
-- and which `adapters/nascar.py` already carried in `_provenance` - it simply never reached the
-- database, because `pipeline/load_programs.py`'s PROGRAM_COLS did not list it.
--
-- ADDITIVE. One nullable column, one partial unique index. **0012's index is LEFT IN PLACE**:
-- dropping it is not additive and this run's approval does not allow one. It is SUPERSEDED for any
-- row carrying an `external_id` and remains the only key for rows without one; it should be dropped
-- in a later, separately approved migration once every race session has an id.
--
-- `coalesce(series, '')` AND NOT `series`, and that is 0015's lesson applied one migration later
-- rather than relearned. NULLs are distinct in a unique index; NASCAR carries a series on every row
-- but IndyCar runs ONE series and carries none (register §16 ruled that giving it a value would make
-- it a fourth NASCAR series). A key of `(sport, series, external_id)` would therefore never match an
-- IndyCar row and every load would insert 18 more - which is exactly the bug 0015 was written to fix,
-- in a new place. The brief for this migration specified the bare `series`; this is the one thing in
-- it that the tree had already proved wrong.

set role mysports_owner;
set search_path = mysports;

alter table programs add column if not exists external_id text;

comment on column programs.external_id is
  '0016 (2026-09-05). The PROVIDER''s own stable id for this program - cf.nascar.com''s race_id for a '
  'NASCAR race session, and the schedule slug for an IndyCar one. It is what lets a natural key stop '
  'depending on start_at, so a corrected or postponed time UPDATES the race instead of inserting a '
  'second copy of it. Null means the adapter supplied none, and such a row keeps 0012''s key.';

create unique index if not exists programs_race_session_external_uq
  on programs (sport, (coalesce(series, '')), external_id)
  where program_type = 'race_session' and external_id is not null;

comment on index programs_race_session_external_uq is
  '0016. The race-session key that survives a moved race. 0012''s programs_race_session_uq and '
  '0015''s programs_race_session_key_uq are both KEPT and both still apply to rows with no '
  'external_id; they are superseded for rows that have one and are to be dropped in a later, '
  'separately approved migration once every race session carries an id.';

do $$
declare n_total int; n_keyed int;
begin
  select count(*) into n_total from programs where program_type = 'race_session';
  select count(*) into n_keyed from programs
   where program_type = 'race_session' and external_id is not null;
  raise notice '0016: % race sessions, % already carrying an external_id (the backfill fills the rest)',
    n_total, n_keyed;
end $$;

reset role;
