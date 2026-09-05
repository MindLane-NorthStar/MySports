-- 0015 — the race-session natural key survives a NULL series.
--
-- THE DEFECT, found by loading IndyCar. 0012 gave race sessions their key:
--
--     create unique index programs_race_session_uq
--       on programs (sport, series, start_at, title) where program_type = 'race_session';
--
-- `programs.series` is nullable, and **NULLs are distinct in a unique index**. NASCAR carries a
-- series on every row (cup / oreilly / truck) so the key works there and 98 races reload cleanly.
-- IndyCar runs ONE series and therefore carries `series = null` - register §16 named the trap
-- explicitly, that a `racing` series value "would make IndyCar a fourth series alongside NASCAR's
-- Cup, O'Reilly and Truck" - so every IndyCar row looks new to `ON CONFLICT` and a second load
-- INSERTS. Measured: two runs of the same 18 races produced 36 rows.
--
-- This is 0012's own finding in a second place. 0012 wrote it about `game_broadcasts.game_id`:
-- "NULLs are distinct in a unique constraint, so with game_id null every program broadcast looks
-- new and a re-load duplicates all of them." The same sentence is true of `programs.series`, and
-- the index 0012 created is the one it is true of.
--
-- ADDITIVE. One new index; the 0012 index is LEFT IN PLACE. It is not wrong, only insufficient:
-- for a row with a non-null series the two enforce the same thing, and for a null series the old
-- one enforces nothing, which is the bug rather than a conflict. Dropping it would be a drop, and
-- this run's approval does not allow one.
--
-- THE ONE ROW-LEVEL WRITE, and why it is here. A unique index cannot be built over duplicate rows,
-- so the 18 second copies this run's own IndyCar load created have to go first. It is scoped to
-- EXACTLY those: `sport = 'indycar'`, keeping the lowest `program_id` of each (title, start_at)
-- group, and it asserts afterwards that 18 rows remain. Their `game_broadcasts` rows follow through
-- 0012's `on delete cascade`. Backups taken before the load that made them:
--   artifacts/backups/programs_2026-09-05T205219Z.csv        (3,966 rows)
--   artifacts/backups/game_broadcasts_2026-09-05T205219Z.csv (2,374 rows)
-- Nothing outside `sport = 'indycar'` is touched, and the file proves it by counting.

set role mysports_owner;
set search_path = mysports;

do $$
declare
  before_n int;
  after_n  int;
  removed  int;
  other_n  int;
  other_after int;
begin
  select count(*) into before_n  from programs where sport = 'indycar';
  select count(*) into other_n   from programs where sport <> 'indycar';

  -- keep the FIRST copy of each race; delete the rest. `sport = 'indycar'` is in the predicate so
  -- this statement cannot reach a NASCAR row even if one were somehow duplicated.
  with ranked as (
    select program_id,
           row_number() over (partition by title, start_at order by program_id) as rn
    from programs
    where sport = 'indycar' and program_type = 'race_session'
  )
  delete from programs p using ranked r
   where p.program_id = r.program_id and r.rn > 1;
  get diagnostics removed = row_count;

  select count(*) into after_n from programs where sport = 'indycar';
  select count(*) into other_after from programs where sport <> 'indycar';

  raise notice '0015: indycar % -> % (% duplicate rows removed); every other sport % -> %',
    before_n, after_n, removed, other_n, other_after;

  if other_after <> other_n then
    raise exception '0015 touched a non-indycar row: % -> %', other_n, other_after;
  end if;
  if after_n * 2 <> before_n then
    raise warning '0015: expected exactly two copies of each race; % -> %', before_n, after_n;
  end if;
end $$;

-- THE NULL-SAFE KEY. `coalesce(series, '')` rather than a NULLS NOT DISTINCT clause, because the
-- expression form works on every Postgres 14 and earlier as well and reads the same to ON CONFLICT.
-- A statement inferring this index must repeat BOTH the expression and the predicate, exactly as
-- 0012's partial index taught the program loader.
create unique index if not exists programs_race_session_key_uq
  on programs (sport, (coalesce(series, '')), start_at, title)
  where program_type = 'race_session';

comment on index programs_race_session_key_uq is
  '0015 (2026-09-05). The race-session natural key that survives a NULL series. 0012''s '
  'programs_race_session_uq is kept and is not wrong - it is insufficient, because NULLs are '
  'distinct in a unique index and IndyCar carries no series. pipeline/load_programs.py conflicts on '
  'THIS one.';

do $$
declare n int;
begin
  select count(*) into n from programs where sport = 'indycar';
  raise notice '0015: indycar now holds % race sessions', n;
end $$;

reset role;
