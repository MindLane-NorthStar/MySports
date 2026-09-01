-- MySports Milestone 1 — game facts (spec §7.3–§7.6, §7.17 market_coverage, §7.18, §7.21, §7.22)
-- Applied as Supabase migration `mysports_0003_games`. Depends on 0002.
set role mysports_owner;
set search_path = mysports;

create table games (
  id                        text primary key,             -- adapter id: '401856766' (CFBD), 'nhl-2026020011', 'nfl-401872922'
  sport                     sport not null,
  external_primary_id       text not null,
  season                    int not null,
  week                      int,
  game_date                 date not null,
  viewing_day               date not null,                -- game_date shifted by the 03:00 ET cutover
  home_team_id              text not null references teams(id),
  away_team_id              text not null references teams(id),
  neutral_site              boolean not null default false,
  venue_id                  bigint references venues(id),

  rights_controller_type    rights_controller_type not null default 'unknown',
  rights_controller_id      text,
  rights_context_reason     text,

  canonical_kickoff_at_utc  timestamptz,
  canonical_kickoff_at_et   timestamptz,
  kickoff_status            text,
  kickoff_certainty         claim_certainty,
  schedule_certainty        schedule_certainty not null default 'FINAL',
  flex_decision_deadline    timestamptz,
  doubleheader_game_number  smallint,
  competition_context       competition_context not null default 'REGULAR',
  series_id                 text,
  series_game_number        smallint,

  primary_network_id        text references networks_services(id),
  network_status            text,
  network_certainty         claim_certainty,

  ranking_system            poll_type,
  home_rank                 smallint,
  away_rank                 smallint,
  home_record               text,
  away_record               text,

  rivalry_id                bigint references rivalries(id),
  is_rivalry                boolean not null default false,
  is_conference_championship boolean not null default false,
  is_bowl                   boolean not null default false,
  is_cfp                    boolean not null default false,
  is_national_championship  boolean not null default false,

  canonical_state           canonical_state not null default 'time_and_network_tbd',

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  last_verified_at          timestamptz,
  unique (sport, external_primary_id)
);
create index games_viewing_day_idx on games (viewing_day, sport);
create index games_season_week_idx on games (sport, season, week);
create index games_teams_idx on games (home_team_id, away_team_id);

create table game_broadcasts (
  id                    bigint generated always as identity primary key,
  game_id               text not null references games(id) on delete cascade,
  service_id            text references networks_services(id),   -- null when carriage is UNANNOUNCED / TBA_NO_RIGHTS_HOLDER
  delivery_surface      delivery_surface not null,
  feed_side             feed_side not null default 'NATIONAL',
  is_primary            boolean not null default false,
  requires_auth         boolean not null default false,
  access_status         access_status not null default 'unknown',
  carriage_certainty    carriage_certainty not null default 'CONFIRMED',
  suppresses_local_feed boolean not null default false,
  blackout_rule         blackout_rule not null default 'NONE',
  market_id             text references markets(id),
  label                 text,
  first_seen_at         timestamptz not null default now(),
  last_seen_at          timestamptz not null default now(),
  source_observation_id bigint,                                     -- fk added in 0004 (source_observations)
  unique (game_id, service_id, delivery_surface, feed_side)
);
create index game_broadcasts_game_idx on game_broadcasts (game_id);

create table broadcast_crews (
  id                    bigint generated always as identity primary key,
  game_id               text not null references games(id) on delete cascade,
  service_id            text references networks_services(id),
  play_by_play          text,
  analyst               text,
  sideline_reporter     text,
  other_personnel_json  jsonb not null default '{}',
  source_observation_id bigint,
  verified_at           timestamptz
);

create table rankings (
  id                    bigint generated always as identity primary key,
  sport                 sport not null default 'cfb',
  season                int not null,
  week                  int not null,
  poll_type             poll_type not null,
  poll_date             date,
  team_id               text not null references teams(id),
  rank                  smallint not null,
  points                int,
  source_observation_id bigint,
  unique (sport, season, week, poll_type, team_id)
);

create table market_coverage (
  id                    bigint generated always as identity primary key,
  game_id               text not null references games(id) on delete cascade,
  network_id            text not null references networks_services(id),
  market_id             text not null references markets(id),
  is_primary            boolean not null default true,
  receives              boolean not null,                            -- true = market gets this feed; false = out of market
  source_observation_id bigint,
  unique (game_id, network_id, market_id)
);

create table whip_around_broadcasts (
  id                    bigint generated always as identity primary key,
  sport                 sport not null,
  network_id            text not null references networks_services(id),
  starts_at             timestamptz not null,
  ends_at               timestamptz not null,
  title                 text not null,
  source_observation_id bigint
);
create table whip_around_games (
  whip_around_id bigint not null references whip_around_broadcasts(id) on delete cascade,
  game_id        text not null references games(id) on delete cascade,
  primary key (whip_around_id, game_id)
);

create table game_odds (
  id             bigint generated always as identity primary key,
  game_id        text not null references games(id) on delete cascade,
  provider       text not null,
  spread         numeric(5,1),                                       -- home-relative: negative = home favored (ESPN and CFBD convention)
  total          numeric(5,1),
  home_moneyline int,
  away_moneyline int,
  spread_open    numeric(5,1),
  total_open     numeric(5,1),
  fetched_at     timestamptz not null default now(),
  unique (game_id, provider, fetched_at)
);
create index game_odds_game_idx on game_odds (game_id, fetched_at desc);

create table team_records (
  id          bigint generated always as identity primary key,
  team_id     text not null references teams(id),
  season      int not null,
  as_of       date not null,
  wins        smallint not null default 0,
  losses      smallint not null default 0,
  ties        smallint not null default 0,
  conf_wins   smallint,
  conf_losses smallint,
  conf_ties   smallint,
  source      text,
  unique (team_id, season, as_of)
);

reset role;
