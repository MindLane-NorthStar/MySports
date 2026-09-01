-- MySports Milestone 1 — observations, decisions, history, snapshots, grids, eligibility cache, refresh runs
-- (spec §6.1, §7.9–§7.12, §7.15, §7.16, §16). Applied as Supabase migration `mysports_0004_observations_and_runs`. Depends on 0003.
set role mysports_owner;
set search_path = mysports;

create table source_snapshots (
  id             bigint generated always as identity primary key,
  source_id      text not null references sources(id),
  fetched_at     timestamptz not null default now(),
  source_url     text not null,
  http_status    int,
  content_hash   text,
  content_type   text,
  storage_url    text,                                     -- mysports-data/snapshots/... (private bucket)
  parser_version text,
  parse_status   parse_status not null default 'ok',
  error_message  text
);
create index source_snapshots_source_idx on source_snapshots (source_id, fetched_at desc);

create table source_observations (
  id                   bigint generated always as identity primary key,
  source_id            text not null references sources(id),
  game_id              text references games(id) on delete cascade,
  snapshot_id          bigint references source_snapshots(id),
  observed_at          timestamptz not null default now(),
  published_at         timestamptz,
  updated_at           timestamptz,
  field_name           text not null,                     -- 'kickoff_at', 'primary_network', 'stream', 'crew', 'rank', 'spread', 'local_carriage'
  raw_value            text,
  normalized_value     text,
  raw_label            text,
  authority_role       authority_role not null,
  authority_score      int not null,
  claim_certainty      claim_certainty not null default 'definite',
  source_url_or_key    text,
  source_document_hash text,
  extraction_method    text,
  parser_version       text,
  valid_from           timestamptz not null default now(),
  valid_to             timestamptz
);
create index source_observations_game_field_idx on source_observations (game_id, field_name, observed_at desc);

alter table game_broadcasts     add constraint game_broadcasts_obs_fk     foreign key (source_observation_id) references source_observations(id);
alter table broadcast_crews     add constraint broadcast_crews_obs_fk     foreign key (source_observation_id) references source_observations(id);
alter table rankings            add constraint rankings_obs_fk            foreign key (source_observation_id) references source_observations(id);
alter table market_coverage     add constraint market_coverage_obs_fk     foreign key (source_observation_id) references source_observations(id);
alter table whip_around_broadcasts add constraint whip_around_obs_fk      foreign key (source_observation_id) references source_observations(id);

create table canonical_decisions (
  id                             bigint generated always as identity primary key,
  game_id                        text not null references games(id) on delete cascade,
  field_name                     text not null,
  decided_at                     timestamptz not null default now(),
  rule_version                   text not null,
  rights_context                 text,
  winning_source_observation_id  bigint references source_observations(id),
  considered_observation_ids     bigint[] not null default '{}',
  rejected_observation_ids       bigint[] not null default '{}',
  decision_reason                text,
  result_value                   text,
  result_certainty               claim_certainty,
  decision_status                decision_status not null
);
create index canonical_decisions_game_idx on canonical_decisions (game_id, field_name, decided_at desc);

create table canonical_change_history (
  id                            bigint generated always as identity primary key,
  game_id                       text not null references games(id) on delete cascade,
  field_name                    text not null,
  old_value                     text,
  new_value                     text,
  changed_at                    timestamptz not null default now(),
  canonical_decision_id         bigint references canonical_decisions(id),
  decision_reason               text,
  winning_source_observation_id bigint references source_observations(id),
  conflicting_observation_ids   bigint[] not null default '{}'
);
create index canonical_change_history_game_idx on canonical_change_history (game_id, changed_at desc);

create table generated_grids (
  id                bigint generated always as identity primary key,
  sport             sport,                                 -- null = multi-sport day
  season            int,
  week              int,
  game_date         date not null,
  render_hash       text not null,
  svg_asset_url     text not null,
  png_asset_url     text,
  png2x_asset_url   text,
  generated_at      timestamptz not null default now(),
  generator_version text not null,
  games_on_grid     int,
  games_tbd         int,
  games_omitted     int,
  unique (sport, game_date, render_hash)
);

create table viewer_game_eligibility (
  game_id                 text not null references games(id) on delete cascade,
  viewer_profile_id       smallint not null references viewer_profiles(id),
  eligible                boolean not null,
  eligible_via_network_id text references networks_services(id),
  eligible_via_service_ids text[] not null default '{}',
  reason                  text,
  computed_at             timestamptz not null default now(),
  entitlement_version     text,
  primary key (game_id, viewer_profile_id)
);

create table refresh_runs (                                -- spec §16
  run_id               bigint generated always as identity primary key,
  workflow             text not null,                      -- 'schedule_refresh' | 'render_all' | 'bootstrap_season' | 'backup_schema' | 'cowork'
  started_at           timestamptz not null default now(),
  completed_at         timestamptz,
  status               run_status not null default 'running',
  providers_called     text[] not null default '{}',
  games_checked        int not null default 0,
  games_changed        int not null default 0,
  conflicts_found      int not null default 0,
  graphics_regenerated int not null default 0,
  errors               jsonb not null default '[]',
  warnings             jsonb not null default '[]',
  notes                text
);

-- updated_at maintenance for games
create function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger games_set_updated_at before update on games for each row execute function set_updated_at();

reset role;
