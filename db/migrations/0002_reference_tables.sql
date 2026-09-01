-- MySports Milestone 1 — reference tables (spec §7.1, §7.2, §7.7, §7.8, §7.13, §7.14, §7.17, §7.19, §7.20; sources per §9)
-- Applied as Supabase migration `mysports_0002_reference_tables`. Everything lives in schema mysports and is owned by mysports_owner.
-- Conventions: external-facing ids are the adapters' namespaced text ids ("nhl-29", "nfl-4", CFBD integer as text);
-- internal rows use bigint identity; every timestamp is timestamptz; every table gets RLS in 0005.
set role mysports_owner;
set search_path = mysports;

-- ---------------------------------------------------------------- enums
create type sport as enum ('cfb', 'nfl', 'nhl', 'nba', 'mlb');
create type access_status as enum ('available', 'unavailable', 'verify', 'conditional', 'out_of_market', 'unverified', 'unknown');
create type network_type as enum ('linear_broadcast', 'linear_cable', 'streaming', 'authenticated_stream', 'hybrid', 'local_rsn', 'local_tba');
create type authority_role as enum ('rights_controller', 'broadcaster', 'host_school', 'visitor_school', 'structured_provider', 'official_aggregator', 'secondary_aggregator', 'league_api', 'hand_entered');
create type claim_certainty as enum ('definite', 'window', 'choice_set', 'flex', 'tbd');
create type decision_status as enum ('accepted', 'retained_last_known_good', 'unresolved_conflict', 'no_change');
create type canonical_state as enum ('fully_assigned', 'time_tbd', 'network_tbd', 'time_and_network_tbd', 'authority_conflict');
create type schedule_certainty as enum ('FINAL', 'FLEX_PENDING', 'TBD', 'TBD_FOLLOWS');
create type competition_context as enum ('REGULAR', 'CUP_GROUP', 'CUP_KNOCKOUT', 'PLAY_IN', 'PLAYOFF', 'EXHIBITION');
create type rights_controller_type as enum ('conference', 'network_or_rights_holder', 'independent_school', 'event_organizer', 'postseason_body', 'league', 'unknown');
create type delivery_surface as enum ('LINEAR', 'STREAMING');
create type feed_side as enum ('HOME', 'AWAY', 'NATIONAL');
create type carriage_certainty as enum ('CONFIRMED', 'AFFILIATE_DISCRETION', 'UNANNOUNCED', 'TBA_NO_RIGHTS_HOLDER');
create type blackout_rule as enum ('NONE', 'IN_MARKET', 'OUT_OF_MARKET', 'NATIONAL_EXCLUSIVE');
create type lane_policy as enum ('alt_lane', 'market_filter');
create type primary_line as enum ('spread', 'moneyline');
create type poll_type as enum ('AP', 'CFP', 'Coaches');
create type territory_type as enum ('Inner', 'Outer', 'Sphere');
create type parse_status as enum ('ok', 'partial', 'failed');
create type run_status as enum ('running', 'succeeded', 'failed', 'partial');

-- ---------------------------------------------------------------- sources (§9 authority matrix; referenced by observations/snapshots)
create table sources (
  id               text primary key,                      -- 'cfbd', 'espn.scoreboard', 'nhl.schedule', '506sports', 'data/local_rights.json'
  name             text not null,
  authority_role   authority_role not null,
  authority_score  int not null default 50,
  sport            sport,                                  -- null = all sports
  base_url         text,
  notes            text,
  active           boolean not null default true
);

-- ---------------------------------------------------------------- assets (§7.14)
create table assets (
  id             bigint generated always as identity primary key,
  asset_type     text not null,                            -- 'team_logo' | 'network_logo' | 'font' | 'grid_svg' | 'grid_png'
  canonical_name text not null,
  source         text,
  source_url     text,
  storage_url    text not null,                            -- R2 key or public URL (deployment contract §3)
  content_hash   text,
  width          int,
  height         int,
  updated_at     timestamptz not null default now(),
  unique (asset_type, canonical_name)
);

-- ---------------------------------------------------------------- networks & services (§7.8, §7.7, §7.20)
create table networks_services (
  id                          text primary key,           -- slug: 'cbs', 'espn-plus', 'cbj-local'
  canonical_name              text not null unique,
  short_name                  text,
  type                        network_type not null,
  logo_asset_id               bigint references assets(id),
  default_sort_order          int,
  supports_concurrent_streams boolean not null default true,
  simulcast_service_id        text references networks_services(id),  -- CBS -> paramount-plus (contract §5 rule)
  aliases                     text[] not null default '{}'
);

create table viewer_profiles (
  id          smallint primary key,
  name        text not null,
  provider    text,                                        -- 'DIRECTV CHOICE'
  market_id   text,                                        -- fk added after markets
  notes       text
);

create table viewer_services (
  id             bigint generated always as identity primary key,
  profile_id     smallint not null references viewer_profiles(id),
  service_id     text not null references networks_services(id),
  access_status  access_status not null,
  access_method  text,                                     -- 'DIRECTV', 'ESPN Unlimited', 'subscription'
  notes          text,
  effective_from date not null default current_date,
  effective_to   date,
  unique (profile_id, service_id, effective_from)
);

create table carriage_status (
  id             bigint generated always as identity primary key,
  network_id     text not null references networks_services(id),
  provider_id    text not null,
  status         access_status not null,
  effective_from date not null default current_date,
  effective_to   date,
  source         text
);

-- ---------------------------------------------------------------- markets (§7.17)
create table markets (
  id               text primary key,                      -- 'cleveland'
  name             text not null,
  dma_code         int,
  zip_list_json    jsonb not null default '[]',
  is_viewer_market boolean not null default false
);
alter table viewer_profiles add constraint viewer_profiles_market_fk foreign key (market_id) references markets(id);

-- ---------------------------------------------------------------- conferences, teams, venues (§7.1, §7.2)
create table conferences (
  id            text primary key,                         -- 'big-ten', 'nfl-afc', 'nhl-metropolitan'
  sport         sport not null,
  name          text not null,
  abbreviation  text,
  logo_asset_id bigint references assets(id),
  active_from   date,
  active_to     date
);

create table teams (
  id              text primary key,                       -- adapter id: '194' (CFBD), 'nhl-29', 'nfl-4'
  sport           sport not null,
  canonical_name  text not null,                          -- 'Columbus Blue Jackets', 'Ohio State'
  short_name      text,                                   -- card name: 'Blue Jackets', 'Ohio State'
  location        text,
  abbreviation    text,
  conference_id   text references conferences(id),
  fbs_status      text,                                   -- 'fbs' | 'fcs' | null for pro
  primary_color   text,
  secondary_color text,
  logo_asset_id   bigint references assets(id),
  external_ids    jsonb not null default '{}',            -- {"espn": "29", "nhl": "29", "cfbd": 194}
  active_from     date,
  active_to       date
);
create index teams_sport_abbr_idx on teams (sport, abbreviation);

create table venues (
  id        bigint generated always as identity primary key,
  name      text not null,
  city      text,
  state     text,
  country   text default 'USA',
  indoor    boolean,
  timezone  text,
  unique (name, city)
);

create table team_territories (
  team_id      text not null references teams(id),
  market_id    text not null references markets(id),
  network_type territory_type not null,
  source       text,
  primary key (team_id, market_id)
);

-- ---------------------------------------------------------------- render policies (§7.19)
create table render_policies (
  sport               sport primary key,
  block_minutes       int not null,
  lane_policy         lane_policy not null,
  primary_line        primary_line not null,
  open_ended          text not null default 'no',           -- 'no' | 'yes' | 'playoffs'
  viewing_day_cutover time not null default '03:00',
  title               text not null,
  week_label          boolean not null default false,
  data_label          text,
  local_row_label     text
);

-- ---------------------------------------------------------------- rivalries (§7.13)
create table rivalries (
  id            bigint generated always as identity primary key,
  sport         sport not null,
  name          text not null,
  team_a_id     text references teams(id),
  team_b_id     text references teams(id),
  team_a_name   text not null,                            -- name-keyed seed from data/rivalries.json until ids resolve
  team_b_name   text not null,
  trophy_name   text,
  display_label text,
  tier          smallint not null default 2,
  active        boolean not null default true,
  unique (sport, team_a_name, team_b_name)
);

reset role;
