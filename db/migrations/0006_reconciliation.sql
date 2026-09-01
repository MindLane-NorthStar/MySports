-- MySports Milestone 2 — reconciliation support (spec §9.6 step 5, §9.13, §15.2). Applied as Supabase migration
-- `mysports_0006_reconciliation`. Depends on 0004. Rewrites existing source_observations rows once (collapses the
-- identical rows that Milestone 1 loads re-inserted every run; closes claims a source has since replaced). Take a
-- pg_dump of source_observations first (deployment contract §6); nothing else is touched.
set role mysports_owner;
set search_path = mysports;

alter table source_observations
  add column if not exists last_seen_at timestamptz not null default now(),   -- newest load that repeated this exact claim
  add column if not exists seen_count   int         not null default 1;       -- how many loads repeated it
alter table sources
  add column if not exists rights_scope text;                                 -- games.rights_controller_id this source controls (null = not a rights controller)
alter table game_broadcasts
  add column if not exists active boolean not null default true;              -- false = no source currently lists this row (never deleted)

-- 0. Milestone 1 attributed feed outlets to data/local_rights when only the Cleveland-receives-it judgment was hand-made
--    (CLE @ JAX on CBS). The outlet claim belongs to the feed; the judgment becomes its own local_carriage claim (loader, M2).
update source_observations o set source_id = 'espn.scoreboard', authority_role = 'structured_provider', authority_score = 55
where o.source_id = 'data/local_rights' and o.field_name = 'broadcast' and o.claim_certainty = 'definite'
  and split_part(o.normalized_value, '|', 3) = 'CONFIRMED';

-- 1. collapse exact duplicates: keep the earliest row of each identical claim, carry the count and the newest sighting
with dup as (
  select min(id) as keep_id, count(*) as n, max(observed_at) as last_seen, array_agg(id) as ids
  from source_observations
  group by source_id, game_id, field_name, coalesce(normalized_value, ''), claim_certainty, coalesce(raw_label, '')
  having count(*) > 1)
update source_observations o set seen_count = dup.n, last_seen_at = dup.last_seen from dup where o.id = dup.keep_id;

with dup as (
  select min(id) as keep_id, array_agg(id) as ids
  from source_observations
  group by source_id, game_id, field_name, coalesce(normalized_value, ''), claim_certainty, coalesce(raw_label, '')
  having count(*) > 1)
delete from source_observations o using dup
where o.id = any(dup.ids) and o.id <> dup.keep_id
  and not exists (select 1 from game_broadcasts b where b.source_observation_id = o.id)
  and not exists (select 1 from broadcast_crews c where c.source_observation_id = o.id)
  and not exists (select 1 from rankings r where r.source_observation_id = o.id)
  and not exists (select 1 from market_coverage m where m.source_observation_id = o.id)
  and not exists (select 1 from whip_around_broadcasts w where w.source_observation_id = o.id)
  and not exists (select 1 from canonical_decisions d where d.winning_source_observation_id = o.id)
  and not exists (select 1 from canonical_change_history h where h.winning_source_observation_id = o.id);

update source_observations set last_seen_at = observed_at where last_seen_at < observed_at;

-- 2. single-valued fields: a source's older claims are superseded by its newest one
with ranked as (
  select id, row_number() over (partition by source_id, game_id, field_name order by last_seen_at desc, id desc) as rn
  from source_observations where field_name = 'kickoff_at' and valid_to is null)
update source_observations o set valid_to = o.last_seen_at from ranked where o.id = ranked.id and ranked.rn > 1;

-- 3. broadcast rows a source stopped listing (absent from its newest load, 10-minute tolerance for multi-fixture runs)
with latest as (
  select source_id, game_id, max(last_seen_at) as newest
  from source_observations where field_name = 'broadcast' and valid_to is null group by source_id, game_id)
update source_observations o set valid_to = o.last_seen_at
from latest l
where o.source_id = l.source_id and o.game_id = l.game_id and o.field_name = 'broadcast' and o.valid_to is null
  and o.last_seen_at < l.newest - interval '10 minutes';

-- 4. claims pointing at outlets that no longer exist (the four alias networks removed 2026-09-01) are closed too
update source_observations o set valid_to = coalesce(o.valid_to, now())
where o.field_name = 'broadcast' and o.valid_to is null
  and not exists (select 1 from networks_services n where n.id = split_part(o.normalized_value, '|', 1));

-- 5. game_broadcasts.active mirrors "some source still lists this outlet for this game"
update game_broadcasts b set active = exists (
  select 1 from source_observations o
  where o.game_id = b.game_id and o.field_name = 'broadcast' and o.valid_to is null
    and split_part(o.normalized_value, '|', 1) = b.service_id);

create index if not exists source_observations_active_idx on source_observations (game_id, field_name) where valid_to is null;
create index if not exists source_observations_source_game_idx on source_observations (source_id, game_id, field_name);

comment on column source_observations.last_seen_at is 'newest load that repeated this exact claim (spec 9.13: a repeat is not new evidence)';
comment on column source_observations.valid_to is 'set when the same source replaced or withdrew this claim (spec 9.6 step 5); rows are never deleted';
comment on column game_broadcasts.active is 'false when no source currently lists this outlet for the game; kept for audit (spec 15.2)';

reset role;
