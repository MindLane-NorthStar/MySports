-- 0019 — every game gets its game link, not only the ones the nightly happened to fetch.
--
-- ============================================================================================
-- APPLIED 2026-09-10 at 20:21:23 UTC, through the Supabase connector (`apply_migration`, history
-- version 20260910202123 `backfill_game_urls`), on Joe Lull's explicit named approval ("Apply 0019").
-- Applied FROM this file; the SQL below is byte-for-byte what ran - only this header was edited after.
--
-- Rule 27 checked first: no workflow in progress, the day's last refresh finished ~17:25 UTC.
-- SELECT-and-paste immediately before: 3,527 without a link (cfb 704, mlb 15, nba 1,206, nfl 258,
-- nhl 1,344), 426 already linked, and those 426 fingerprinted: md5 of id=url in id order,
-- 80711cfbf3404e8c48761f684972dd21.
-- MEASURED AFTER: 0 games without a link, 3,953 of 3,953 linked. The migration's transaction (xmin
-- 11551) wrote EXACTLY 3,527 rows; the 426 rows outside it re-fingerprint to the same md5, so no
-- stored link changed; and 0 of 3,953 links differ from the derived expression. Five new links
-- spot-checked, 200 each - including Thursday's nfl-401872657 and Monday's nfl-401872931, and
-- nhl-2026020001, which nhl.com redirects to that game's own page.
-- (The connector does not return RAISE NOTICE output, so the before/after SELECTs are the record.)
--
-- PREPARED 2026-09-10, prompt 87 block B.
--
-- WORKING RULE 14: a write through the Supabase connector needs Joe's approval BY NAME for this
-- operation, SELECT-and-paste first, rule 27's schedule check, and this file applied FROM the repo
-- rather than retyped. The brief's commit-and-push approval does not cover it.
-- ============================================================================================
--
-- WHY THIS EXISTS. `pipeline/load.py`'s `boxscore_url()` derives a game's link from its sport and
-- its own id and NOTHING else - no provider field, no fetch. But `SCORES_SQL` only runs for games in
-- the payload a nightly step fetched, so a game outside every step's window has no link at all:
-- Thursday and Monday NFL (docs/queue.md item 1), and everything more than a few days out.
--
-- MEASURED 2026-09-10 BEFORE THIS FILE WAS WRITTEN (Supabase connector, read-only SELECT), after the
-- day's 17:06 UTC refresh:
--
--     sport   games   no link   id shape of the unlinked rows
--     cfb       888       704   bare ESPN id, no hyphen (704 of 704)
--     mlb       243        15   `mlb-<gamePk>`
--     nba     1,206     1,206   `nba-<espn id>`
--     nfl       272       258   `nfl-<espn id>`
--     nhl     1,344     1,344   `nhl-<game id>`
--                     ------
--                      3,527   rows this statement is expected to touch
--
-- A DATED FIGURE, NOT A CONSTANT - the nightly keeps linking games as it fetches them. Re-count
-- immediately before applying; the notice below reports what was actually touched.
--
-- THE EXPRESSION IS `boxscore_url()` IN SQL, INCLUDING ITS ASYMMETRY (`load.py:80`): cfb passes the
-- WHOLE id, every other sport passes the text after the FIRST hyphen - `split("-", 1)[-1]`, which
-- is the whole id when there is no hyphen. `substr(id, strpos(id, '-') + 1)` is exactly that:
-- strpos is 0 with no hyphen, so substr starts at 1. `split_part(id, '-', 2)` would NOT be - it
-- drops everything after a second hyphen, and `mlb-778123-2` is a real doubleheader id shape.
--
-- ONE MAPPING IN TWO LANGUAGES IS WHAT PROMPT 78 RULED AGAINST, so this is the one place it is
-- tolerated and it is pinned: `tests/test_game_url_backfill.py` executes the text between the
-- EXPR markers below - this file's own SQL, not a copy - and asserts it produces exactly what
-- `boxscore_url()` produces for every sport and id shape. Change a template in either place and
-- that test fails.
--
-- NOTHING STORED IS TOUCHED: `boxscore_url is null` guards the update, the same never-overwrite as
-- SCORES_SQL's `coalesce`. A sport with no template yields null and is left alone.

set search_path = mysports;

begin;

do $$
declare
  before_null  int;
  before_linked int;
  touched      int;
  after_null   int;
begin
  select count(*) into before_null   from mysports.games where boxscore_url is null;
  select count(*) into before_linked from mysports.games where boxscore_url is not null;

  update mysports.games g
     set boxscore_url = u.url
    from (
      select id,
-- EXPR-BEGIN
case sport
  when 'cfb' then 'https://www.espn.com/college-football/game/_/gameId/' || id
  when 'nfl' then 'https://www.espn.com/nfl/game/_/gameId/' || substr(id, strpos(id, '-') + 1)
  when 'nba' then 'https://www.espn.com/nba/game/_/gameId/' || substr(id, strpos(id, '-') + 1)
  when 'nhl' then 'https://www.nhl.com/gamecenter/' || substr(id, strpos(id, '-') + 1)
  when 'mlb' then 'https://www.mlb.com/gameday/' || substr(id, strpos(id, '-') + 1)
end
-- EXPR-END
             as url
        from mysports.games
       where boxscore_url is null
    ) u
   where g.id = u.id
     and g.boxscore_url is null
     and u.url is not null;
  get diagnostics touched = row_count;

  select count(*) into after_null from mysports.games
   where boxscore_url is null and sport in ('cfb', 'nfl', 'nba', 'nhl', 'mlb');

  raise notice '0019: % games had no link, % already linked; % linked now; % of the five sports remain without one',
    before_null, before_linked, touched, after_null;

  if after_null <> 0 then
    raise exception '0019: % games of a templated sport still have no link - rolled back', after_null;
  end if;
end
$$;

commit;
