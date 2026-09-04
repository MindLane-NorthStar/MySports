-- MySports 0011 - division / conference seed for NFL, NHL and NBA (spec: the listings card's line 2).
-- Applied as `mysports_0011_division_seed`. Depends on 0002 (conferences, teams).
--
-- RECONCILIATION, NOT NEW WORK. Cowork applied this same state directly through the Supabase connector
-- on 2026-09-04 (10 conference rows inserted, 94 teams assigned). This file is the repo's copy of that
-- write, so `db/migrations` remains the source of truth for the schema AND its reference rows. Applying
-- it to the live database is a no-op; applying it to a fresh one reproduces the same state.
--
-- FULLY IDEMPOTENT, and that is load-bearing, not decoration:
--   * the insert is `on conflict (id) do nothing`  - re-running never rewrites a name
--   * the assignment is `where conference_id is null` - re-running never moves a team that already
--     has a conference, which is what kept MLB's six divisions and college football's 73 conferences
--     untouched when this was first applied
--
-- WHY NBA IS SEEDED AT CONFERENCE LEVEL AND THE OTHER TWO AT DIVISION LEVEL. Measured from the actual
-- range of `team_records.division_rank`: MLB 1-5 (a division of five), NHL 1-8 (a division of eight),
-- NBA 1-15 - fifteen clubs is a CONFERENCE, not a division. 0008 already records that the NBA column
-- deliberately holds ESPN's conference `playoffSeed`. So `nba-eastern-conference` / `nba-western-conference`
-- are the rows the seed number actually indexes into, and the web layer's shortGroup() already maps
-- 'Eastern Conference' -> 'East' and 'Western Conference' -> 'West'.
--
-- THE FOUR NHL ROWS PRE-DATE THIS FILE. `nhl-atlantic`, `nhl-metropolitan`, `nhl-central` and
-- `nhl-pacific` were already present when Cowork ran, which is why 10 of 14 inserted rather than 14.
-- They are NOT stale: `pipeline/bootstrap.py`'s teams_and_conferences() created them on 2026-09-01 from
-- an `artifacts/validation/nhl_2026_teams.json` that still carried per-team divisions, and all four now
-- carry eight clubs each. What went missing in between was the ASSIGNMENT, not the rows - see
-- db/README.md for the regeneration that nulled it out. Nothing here deletes or renames them.

set role mysports_owner;
set search_path = mysports;

do $$
declare
  pre  int;
  ins  int;
  upd  int;
begin
  select count(*) into pre from conferences where id in ('nfl-afc-east', 'nfl-afc-north', 'nfl-afc-south', 'nfl-afc-west', 'nfl-nfc-east', 'nfl-nfc-north', 'nfl-nfc-south', 'nfl-nfc-west', 'nhl-atlantic', 'nhl-metropolitan', 'nhl-central', 'nhl-pacific', 'nba-eastern-conference', 'nba-western-conference');

  insert into conferences (id, sport, name) values
      ('nfl-afc-east', 'nfl', 'AFC East'),
      ('nfl-afc-north', 'nfl', 'AFC North'),
      ('nfl-afc-south', 'nfl', 'AFC South'),
      ('nfl-afc-west', 'nfl', 'AFC West'),
      ('nfl-nfc-east', 'nfl', 'NFC East'),
      ('nfl-nfc-north', 'nfl', 'NFC North'),
      ('nfl-nfc-south', 'nfl', 'NFC South'),
      ('nfl-nfc-west', 'nfl', 'NFC West'),
      ('nhl-atlantic', 'nhl', 'Atlantic'),
      ('nhl-metropolitan', 'nhl', 'Metropolitan'),
      ('nhl-central', 'nhl', 'Central'),
      ('nhl-pacific', 'nhl', 'Pacific'),
      ('nba-eastern-conference', 'nba', 'Eastern Conference'),
      ('nba-western-conference', 'nba', 'Western Conference')
  on conflict (id) do nothing;
  get diagnostics ins = row_count;

  update teams t
     set conference_id = m.conference_id
    from (values
      ('nfl-2'     , 'nfl-afc-east'            ),  -- Bills
      ('nfl-15'    , 'nfl-afc-east'            ),  -- Dolphins
      ('nfl-20'    , 'nfl-afc-east'            ),  -- Jets
      ('nfl-17'    , 'nfl-afc-east'            ),  -- Patriots
      ('nfl-4'     , 'nfl-afc-north'           ),  -- Bengals
      ('nfl-5'     , 'nfl-afc-north'           ),  -- Browns
      ('nfl-33'    , 'nfl-afc-north'           ),  -- Ravens
      ('nfl-23'    , 'nfl-afc-north'           ),  -- Steelers
      ('nfl-11'    , 'nfl-afc-south'           ),  -- Colts
      ('nfl-30'    , 'nfl-afc-south'           ),  -- Jaguars
      ('nfl-34'    , 'nfl-afc-south'           ),  -- Texans
      ('nfl-10'    , 'nfl-afc-south'           ),  -- Titans
      ('nfl-7'     , 'nfl-afc-west'            ),  -- Broncos
      ('nfl-24'    , 'nfl-afc-west'            ),  -- Chargers
      ('nfl-12'    , 'nfl-afc-west'            ),  -- Chiefs
      ('nfl-13'    , 'nfl-afc-west'            ),  -- Raiders
      ('nfl-28'    , 'nfl-nfc-east'            ),  -- Commanders
      ('nfl-6'     , 'nfl-nfc-east'            ),  -- Cowboys
      ('nfl-21'    , 'nfl-nfc-east'            ),  -- Eagles
      ('nfl-19'    , 'nfl-nfc-east'            ),  -- Giants
      ('nfl-3'     , 'nfl-nfc-north'           ),  -- Bears
      ('nfl-8'     , 'nfl-nfc-north'           ),  -- Lions
      ('nfl-9'     , 'nfl-nfc-north'           ),  -- Packers
      ('nfl-16'    , 'nfl-nfc-north'           ),  -- Vikings
      ('nfl-27'    , 'nfl-nfc-south'           ),  -- Buccaneers
      ('nfl-1'     , 'nfl-nfc-south'           ),  -- Falcons
      ('nfl-29'    , 'nfl-nfc-south'           ),  -- Panthers
      ('nfl-18'    , 'nfl-nfc-south'           ),  -- Saints
      ('nfl-25'    , 'nfl-nfc-west'            ),  -- 49ers
      ('nfl-22'    , 'nfl-nfc-west'            ),  -- Cardinals
      ('nfl-14'    , 'nfl-nfc-west'            ),  -- Rams
      ('nfl-26'    , 'nfl-nfc-west'            ),  -- Seahawks
      ('nhl-6'     , 'nhl-atlantic'            ),  -- Bruins
      ('nhl-8'     , 'nhl-atlantic'            ),  -- Canadiens
      ('nhl-14'    , 'nhl-atlantic'            ),  -- Lightning
      ('nhl-10'    , 'nhl-atlantic'            ),  -- Maple Leafs
      ('nhl-13'    , 'nhl-atlantic'            ),  -- Panthers
      ('nhl-17'    , 'nhl-atlantic'            ),  -- Red Wings
      ('nhl-7'     , 'nhl-atlantic'            ),  -- Sabres
      ('nhl-9'     , 'nhl-atlantic'            ),  -- Senators
      ('nhl-29'    , 'nhl-metropolitan'        ),  -- Blue Jackets
      ('nhl-15'    , 'nhl-metropolitan'        ),  -- Capitals
      ('nhl-1'     , 'nhl-metropolitan'        ),  -- Devils
      ('nhl-4'     , 'nhl-metropolitan'        ),  -- Flyers
      ('nhl-12'    , 'nhl-metropolitan'        ),  -- Hurricanes
      ('nhl-2'     , 'nhl-metropolitan'        ),  -- Islanders
      ('nhl-5'     , 'nhl-metropolitan'        ),  -- Penguins
      ('nhl-3'     , 'nhl-metropolitan'        ),  -- Rangers
      ('nhl-21'    , 'nhl-central'             ),  -- Avalanche
      ('nhl-16'    , 'nhl-central'             ),  -- Blackhawks
      ('nhl-19'    , 'nhl-central'             ),  -- Blues
      ('nhl-52'    , 'nhl-central'             ),  -- Jets
      ('nhl-68'    , 'nhl-central'             ),  -- Mammoth
      ('nhl-18'    , 'nhl-central'             ),  -- Predators
      ('nhl-25'    , 'nhl-central'             ),  -- Stars
      ('nhl-30'    , 'nhl-central'             ),  -- Wild
      ('nhl-23'    , 'nhl-pacific'             ),  -- Canucks
      ('nhl-24'    , 'nhl-pacific'             ),  -- Ducks
      ('nhl-20'    , 'nhl-pacific'             ),  -- Flames
      ('nhl-54'    , 'nhl-pacific'             ),  -- Golden Knights
      ('nhl-26'    , 'nhl-pacific'             ),  -- Kings
      ('nhl-55'    , 'nhl-pacific'             ),  -- Kraken
      ('nhl-22'    , 'nhl-pacific'             ),  -- Oilers
      ('nhl-28'    , 'nhl-pacific'             ),  -- Sharks
      ('nba-PHI'   , 'nba-eastern-conference'  ),  -- 76ers
      ('nba-MIL'   , 'nba-eastern-conference'  ),  -- Bucks
      ('nba-CHI'   , 'nba-eastern-conference'  ),  -- Bulls
      ('nba-CLE'   , 'nba-eastern-conference'  ),  -- Cavaliers
      ('nba-BOS'   , 'nba-eastern-conference'  ),  -- Celtics
      ('nba-ATL'   , 'nba-eastern-conference'  ),  -- Hawks
      ('nba-MIA'   , 'nba-eastern-conference'  ),  -- Heat
      ('nba-CHA'   , 'nba-eastern-conference'  ),  -- Hornets
      ('nba-NYK'   , 'nba-eastern-conference'  ),  -- Knicks
      ('nba-ORL'   , 'nba-eastern-conference'  ),  -- Magic
      ('nba-BKN'   , 'nba-eastern-conference'  ),  -- Nets
      ('nba-IND'   , 'nba-eastern-conference'  ),  -- Pacers
      ('nba-DET'   , 'nba-eastern-conference'  ),  -- Pistons
      ('nba-TOR'   , 'nba-eastern-conference'  ),  -- Raptors
      ('nba-WAS'   , 'nba-eastern-conference'  ),  -- Wizards
      ('nba-LAC'   , 'nba-western-conference'  ),  -- Clippers
      ('nba-MEM'   , 'nba-western-conference'  ),  -- Grizzlies
      ('nba-UTA'   , 'nba-western-conference'  ),  -- Jazz
      ('nba-SAC'   , 'nba-western-conference'  ),  -- Kings
      ('nba-LAL'   , 'nba-western-conference'  ),  -- Lakers
      ('nba-DAL'   , 'nba-western-conference'  ),  -- Mavericks
      ('nba-DEN'   , 'nba-western-conference'  ),  -- Nuggets
      ('nba-NOP'   , 'nba-western-conference'  ),  -- Pelicans
      ('nba-HOU'   , 'nba-western-conference'  ),  -- Rockets
      ('nba-SAS'   , 'nba-western-conference'  ),  -- Spurs
      ('nba-PHX'   , 'nba-western-conference'  ),  -- Suns
      ('nba-OKC'   , 'nba-western-conference'  ),  -- Thunder
      ('nba-MIN'   , 'nba-western-conference'  ),  -- Timberwolves
      ('nba-POR'   , 'nba-western-conference'  ),  -- Trail Blazers
      ('nba-GSW'   , 'nba-western-conference'  )   -- Warriors
         ) as m(team_id, conference_id)
   where t.id = m.team_id
     and t.conference_id is null;      -- the guard: never move a team that already has one
  get diagnostics upd = row_count;

  raise notice '0011 division seed: conferences pre-existing=% inserted=% ; teams assigned=%', pre, ins, upd;
  raise notice '0011 expected on an already-reconciled database: pre-existing=14 inserted=0 assigned=0';
end $$;

reset role;
