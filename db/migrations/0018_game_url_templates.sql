-- 0018 — stored ESPN game links move from the box-score page to the game page.
--
-- ============================================================================================
-- APPLIED 2026-09-10 at 16:45:15 UTC, through the Supabase connector (`apply_migration`, history
-- version 20260910164515 `game_url_templates`), on Joe Lull's explicit named approval ("Apply 0018").
-- Applied FROM this file; the SQL below is byte-for-byte what ran - only this header was edited after.
--
-- Rule 27 checked first: no workflow in progress, the day's schedule_refresh finished 15:06 UTC.
-- SELECT-and-paste immediately before: 99 rows in the old form (cfb 98, nfl 1), mlb 138, nhl 0.
-- MEASURED AFTER, the same SELECT: 0 rows in the old /boxscore/ form, 99 in the /game/ form
-- (cfb 98, nfl 1), mlb's 138 untouched, no stored URL outside the three known hosts. Two rewritten
-- links spot-checked: espn.com/nfl/game/_/gameId/401872656 and
-- espn.com/college-football/game/_/gameId/401856634 both answer 200 with no redirect.
-- (The connector does not return RAISE NOTICE output, so the before/after SELECT is the record.)
--
-- PREPARED 2026-09-10, prompt 86 block B.
--
-- It is applied AFTER the loader change that makes it necessary is committed and pushed, so the
-- nightly refresh has stopped writing the old form before the stored rows are rewritten. The window
-- in between leaves new rows on `/game/` and old rows on `/boxscore/`; both are working ESPN pages,
-- so that is cosmetic.
--
-- WORKING RULE 14: a write through the Supabase connector needs Joe's approval BY NAME for this
-- operation, SELECT-and-paste first, rule 27's schedule check, and this file applied FROM the repo
-- rather than retyped. A brief's blanket authorization does not cover it.
-- ============================================================================================
--
-- WHY THIS EXISTS. Prompt 86 changed `pipeline/load.py`'s `_BOXSCORE` for cfb, nfl and nba from
-- ESPN's `/{league}/boxscore/_/gameId/{n}` to `/{league}/game/_/gameId/{n}`: the game page resolves
-- preview -> gamecast -> recap by itself, which is what lets ONE link serve a game before, during and
-- after (Joe's ruling, 2026-09-10 - the app labels it Preview / Live box score / Box score).
--
-- THE LOADER CANNOT FIX WHAT IS ALREADY STORED, BY DESIGN. SCORES_SQL writes
-- `boxscore_url = coalesce(boxscore_url, %s)` - never overwrite - which is what makes it idempotent.
-- So every row that already carries the old form keeps it forever unless it is rewritten here.
--
-- MEASURED 2026-09-10 BEFORE THIS FILE WAS WRITTEN (Supabase connector, read-only SELECT):
--
--     sport   stored URLs   old /boxscore/ form   new /game/ form
--     cfb          98               98                   0
--     nfl           1                1                   0
--     nba           0                0                   0
--     nhl           0                0                   0
--     mlb         138                0                   0
--                                  ---
--                                   99   rows this statement is expected to touch
--
--     no stored URL outside the three known hosts (espn.com, nhl.com/gamecenter, mlb.com/gameday)
--
-- THE 99 IS A DATED FIGURE, NOT A CONSTANT - the nightly loader keeps writing finals in the old
-- form until the push lands. Re-count immediately before applying; the notice below reports what
-- was actually touched.
--
-- ONE DEPARTURE FROM THE BRIEF'S SQL, and why. It matched with
-- `like '%/boxscore/_/gameId/%'` - but `_` in LIKE is a single-character WILDCARD, so that pattern
-- matches `/boxscore/<any character>/gameId/`, while `replace()` below is LITERAL. The two halves
-- would disagree on any row where the wildcard matched something other than `_`. `strpos()` is a
-- literal match, so the row selected is exactly the row `replace()` can rewrite. On 2026-09-10 both
-- forms counted 99, so today it changes nothing; it keeps the statement true tomorrow. The host
-- clause is belt-and-braces for nhl and mlb, whose URLs never contain `/boxscore/` at all.

set search_path = mysports;

begin;

do $$
declare
  before_old int;
  before_mlb int;
  before_nhl int;
  touched    int;
  after_old  int;
begin
  select count(*) into before_old from mysports.games
   where strpos(boxscore_url, '/boxscore/_/gameId/') > 0;
  select count(*) into before_mlb from mysports.games where boxscore_url like 'https://www.mlb.com/gameday/%';
  select count(*) into before_nhl from mysports.games where boxscore_url like 'https://www.nhl.com/gamecenter/%';

  update mysports.games
     set boxscore_url = replace(boxscore_url, '/boxscore/_/gameId/', '/game/_/gameId/')
   where strpos(boxscore_url, '/boxscore/_/gameId/') > 0
     and boxscore_url like 'https://www.espn.com/%';
  get diagnostics touched = row_count;

  select count(*) into after_old from mysports.games
   where strpos(boxscore_url, '/boxscore/_/gameId/') > 0;

  raise notice '0018: % rows in the old /boxscore/ form before, % rewritten, % remain', before_old, touched, after_old;
  raise notice '0018: mlb % and nhl % stored URLs - not selected by this statement', before_mlb, before_nhl;

  if after_old <> 0 then
    raise exception '0018: % rows still carry /boxscore/ - rolled back', after_old;
  end if;
end
$$;

commit;
