-- MySports Milestone 1 — row-level security (deployment contract D4) and reference seed rows
-- Applied as Supabase migration `mysports_0005_rls_and_seed`. Depends on 0004.
-- Every table: RLS on; anon/authenticated may SELECT every row (the grid is public within the market-of-one);
-- writes only by the table owner (mysports_owner / mysports_writer), which bypasses RLS as owner.
set role mysports_owner;
set search_path = mysports;

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'mysports' loop
    execute format('alter table mysports.%I enable row level security', t);
    execute format('create policy anon_read on mysports.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

-- private tables: no anon read at all (raw evidence and run internals are not public application content, spec §7.15)
drop policy anon_read on source_snapshots;
drop policy anon_read on source_observations;
drop policy anon_read on refresh_runs;
revoke select on source_snapshots, source_observations, refresh_runs from anon, authenticated;

-- ---------------------------------------------------------------- seed: market-of-one, viewer profile, render policies, sources
insert into markets (id, name, dma_code, zip_list_json, is_viewer_market)
values ('cleveland', 'Cleveland', 510, '["44221"]', true);

insert into viewer_profiles (id, name, provider, market_id, notes)
values (1, 'Joe', 'DIRECTV CHOICE', 'cleveland', 'spec 3.2 access profile; no Sports Pack');

insert into render_policies (sport, block_minutes, lane_policy, primary_line, open_ended, title, week_label, data_label, local_row_label) values
  ('cfb', 210, 'alt_lane',      'spread',    'no',       'COLLEGE FOOTBALL', true,  'CFBD', null),
  ('nfl', 210, 'market_filter', 'spread',    'no',       'NFL',              true,  'ESPN', null),
  ('nhl', 150, 'market_filter', 'moneyline', 'playoffs', 'NHL',              false, 'NHL',  'CARRIER TBA'),
  ('nba', 150, 'market_filter', 'spread',    'no',       'NBA',              false, 'NBA',  'CARRIER TBA'),
  ('mlb', 180, 'market_filter', 'moneyline', 'yes',      'MLB',              false, 'MLB',  null);

insert into sources (id, name, authority_role, authority_score, sport, base_url, notes) values
  ('cfbd',              'CollegeFootballData',            'structured_provider', 60, 'cfb', 'https://api.collegefootballdata.com', 'spec 8; key in .env'),
  ('espn.scoreboard',   'ESPN site API scoreboard',       'structured_provider', 55, null,  'https://site.api.espn.com', 'NFL backbone; shared enrichment (odds, colors, logos)'),
  ('espn.teams',        'ESPN site API teams',            'structured_provider', 50, null,  'https://site.api.espn.com', 'colors + PNG logos'),
  ('nhl.schedule',      'NHL api-web schedule',           'league_api',          80, 'nhl', 'https://api-web.nhle.com', 'tvBroadcasts incl. market H/A/N'),
  ('nhl.postal-lookup', 'NHL postal-lookup territory',    'league_api',          80, 'nhl', 'https://api-web.nhle.com', 'team_territories'),
  ('nba.schedule',      'NBA league schedule file',       'league_api',          80, 'nba', 'https://cdn.nba.com', 'requires nba.com Referer'),
  ('mlb.statsapi',      'MLB Stats API',                  'league_api',          80, 'mlb', 'https://statsapi.mlb.com', 'hydrate=broadcasts(all)'),
  ('506sports',         '506sports coverage maps',        'official_aggregator', 70, 'nfl', 'https://506sports.com', 'hand-entered weekly into data/market_coverage_nfl.json'),
  ('data/local_rights', 'Local rights status (curated)',  'hand_entered',        90, null,  null, 'data/local_rights.json: TBA_NO_RIGHTS_HOLDER / UNANNOUNCED'),
  ('data/row_order',    'Viewer rail + affiliates (curated)', 'hand_entered',    90, null,  null, 'data/row_order.json');

reset role;
