-- MySports -- standings + probable pitchers (Joe 2026-09-02: listings get ONE data line per card --
-- record, division standing, odds, and for MLB the pitching matchup; richer data in the detail panel).
-- Applied as Supabase migration `mysports_0008_standings_and_probables`. Depends on 0003. Additive only.
-- Take a CSV backup of team_records and games first (scripts/backup_table.py).
-- team_records already carries wins/losses/ties per (team, season, as_of); this adds the standings
-- fields the pro leagues publish and two probable-pitcher columns on games. Loader-written facts,
-- NOT reconciled observations (same reasoning as 0007's scores).
set role mysports_owner;
set search_path = mysports;

alter table team_records
  add column if not exists ot_losses     smallint,        -- nhl overtime losses (W-L-OTL)
  add column if not exists points        smallint,        -- nhl standings points
  add column if not exists division_rank smallint,        -- 1 = leading the division
  add column if not exists games_back    numeric(5,1);    -- mlb/nba style GB; null where the league doesn't use it

alter table games
  add column if not exists probable_home_pitcher text,
  add column if not exists probable_away_pitcher text;

-- display names (Joe 2026-09-02): the app shows the MEDIA-STANDARD short form of each team name --
-- 'LIU' not 'Long Island University', 'NC A&T' not 'North Carolina A&T', but 'Georgia State' spelled
-- out because it fits. Populated for cfb from ESPN's shortDisplayName (the scoreboard convention);
-- null means the app falls back to short_name.
alter table teams
  add column if not exists display_name text;

-- verification (visible under --dry-run too)
select count(*) as team_record_rows, count(division_rank) as with_rank from team_records;
select count(*) as games, count(probable_home_pitcher) as with_probables from games;

reset role;
