-- MySports 0009 — programs supertype, broadcast windows, studio show registries.
-- Spec v0.5 §P (MYSPORTS_BUILD_SPEC_v0.5.md). Joe's decisions of 2026-09-02, enhancement register §7-§9.
-- Applied as Supabase migration `mysports_0009_programs_supertype`. Depends on 0008.
--
-- ADDITIVE ONLY. Nothing is dropped, narrowed or rewritten: no column is removed or retyped, no enum
-- value is removed, no existing row is touched by this file. Back up games and game_broadcasts first
-- (scripts/backup_table.py) even so, because the two ALTER TABLEs below take locks on live tables.
--
-- ARCHITECTURE ONLY. After this migration the app and the grids look and behave identically. The
-- database can now DESCRIBE non-game programming; nothing yet reads or writes it except the shadow
-- rows in the next commit.
--
-- WHY THE SERIES CHECK COMPARES sport::text AND NOT THE ENUM LITERAL. This file adds five values to
-- the `sport` enum and then, further down, wants a constraint that mentions 'nascar'. PostgreSQL
-- forbids USING a new enum value in the same transaction that added it (the value is not visible to
-- other snapshots until commit), and scripts/apply_migration.py runs the whole file in ONE
-- transaction. Casting the column to text sidesteps that: the constraint compares two strings and
-- never references the enum value at all. The constraint is identical in effect.

set role mysports_owner;
set search_path = mysports;

-- ---------------------------------------------------------------- 1. sport dimension (additive)
-- `sport` is a real enum (5 values as of 0002), not text and not a lookup table, so the dimension
-- grows with ALTER TYPE. IF NOT EXISTS makes the whole file re-runnable.
alter type sport add value if not exists 'nascar';
alter type sport add value if not exists 'indycar';
alter type sport add value if not exists 'ufc';
alter type sport add value if not exists 'wwe';
alter type sport add value if not exists 'aew';

-- NOTE: access_status is deliberately NOT touched. Joe's 2026-09-02 ruling excludes purchasable
-- content, so there is no 'purchasable' value. The grid answers "what can I watch", not "what could
-- I buy". AEW scope is Dynamite/Collision plus specials included with a subscription.

-- ---------------------------------------------------------------- 2. new enums
create type program_type as enum (
  'game',          -- a contest between two teams; the v0.4 world, and the only type with a games row
  'race_session',  -- a motorsport RACE (practice and qualifying are out of scope, spec v0.5 P.6)
  'fight_card',    -- one UFC event start to finish, with a segments timeline
  'weekly_show',   -- Raw, SmackDown, Dynamite, Collision
  'special_event', -- a WWE PLE or an AEW special above the weekly cadence
  'studio_show'    -- a pregame/postgame bookend
);

create type source_tier as enum ('announced', 'reported');

-- ---------------------------------------------------------------- 3. programs (the supertype)
create table programs (
  program_id            bigint generated always as identity primary key,
  sport                 sport,                       -- nullable: a program need not belong to a sport
  program_type          program_type not null,
  title                 text not null,
  subtitle              text,
  start_at              timestamptz,
  expected_duration_min int,
  open_ended            boolean not null default false,
  venue_id              bigint references venues(id),
  location_text         text,
  on_site               boolean not null default false,
  parent_program_id     bigint references programs(program_id),
  series                text,
  headliners            jsonb not null default '[]'::jsonb,
  hosts_crew            jsonb not null default '[]'::jsonb,
  brand_mark            text,
  graphic_package       text,
  segments              jsonb not null default '[]'::jsonb,
  postponed_to          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint programs_series_ck check (
    series is null
    or (sport::text = 'nascar' and series in ('cup', 'oreilly', 'truck'))
  )
);

create index programs_sport_start_idx on programs (sport, start_at);
create index programs_parent_idx on programs (parent_program_id) where parent_program_id is not null;

comment on table programs is
  'Spec v0.5 P.1. Every grid cell is a program; a game is one subtype. games keeps its own identity '
  'and columns and carries a nullable FK here (the shadow link). Loader-written, reconciler-invisible '
  '(0007/0008 doctrine).';
comment on column programs.sport is
  'Drives the app filter chips (P.5). A studio_show carries the sport it COVERS so it filters with '
  'that sport, but never creates a chip of its own.';
comment on column programs.series is
  'NASCAR only: cup | oreilly | truck. Joe 2026-09-02 - NO NASCAR EXCEPTION: nascar is ONE sport '
  'with a series discriminator, not three sports, because three would mean three chips and three rails.';
comment on column programs.segments is
  'Ordered timeline INSIDE one program: [{label, start_at, service_id}]. A UFC event runs early '
  'prelims / prelims / main card on different services and is ONE card with an interior timeline, '
  'not three sibling cards (Joe 2026-09-02).';
comment on column programs.open_ended is
  'True when the end time is genuinely unknown. Design treatment is a fade-right rather than a false '
  'end time - DEFERRED to rendering contract v1.7, nothing reads this yet. v1.7 must reconcile it '
  'with the per-sport open_ended in data/render_policies.json (text: no|playoffs|yes).';
comment on column programs.parent_program_id is
  'Self-FK: a studio show bookend points at the program it wraps.';

-- updated_at maintenance ONLY, reusing the function games has had since 0004. This is not shadow-row
-- logic: creating and updating a game's program row lives in pipeline/load.py, in code that runs,
-- never in a trigger.
create trigger programs_set_updated_at
  before update on programs for each row execute function set_updated_at();

-- ---------------------------------------------------------------- 4. games.program_id (shadow link)
alter table games add column if not exists program_id bigint references programs(program_id);
create index if not exists games_program_idx on games (program_id);

comment on column games.program_id is
  'Spec v0.5 P.1 shadow link. Nullable BY DESIGN - a program that is not a game (race, PLE, studio '
  'show) has no games row at all, so nullability is the direction of the relationship, not a gap.';

-- ---------------------------------------------------------------- 5. broadcast windows
-- The table is game_broadcasts (renamed from game_streams in v0.4); there is no other broadcast table
-- carrying program carriage - broadcast_crews is announcer data and whip_around_broadcasts is the
-- whip-around feature.
alter table game_broadcasts
  add column if not exists window_start     timestamptz,
  add column if not exists window_end       timestamptz,
  add column if not exists simulcast_linear boolean not null default false;

comment on column game_broadcasts.window_start is
  'Start of a PARTIAL carriage window. NULL MEANS THE ROW CARRIES THE WHOLE PROGRAM - null is "all of '
  'it", NOT "unknown". That is what makes every pre-0009 row correct and unchanged with no backfill. '
  'CBS carrying part of a UFC event is the case this exists for.';
comment on column game_broadcasts.window_end is
  'End of a partial carriage window. Null = whole program (see window_start). DUPLICATE-FEED '
  'SUPPRESSION MUST COMPARE WINDOWS: two rows on the same service are duplicates only when their '
  'windows also coincide, or a CBS window gets wrongly collapsed into its parent streaming row.';
comment on column game_broadcasts.simulcast_linear is
  'A linear broadcast running simultaneously with a streaming feed (the Cavaliers/DAZN OTA case, '
  'generalized).';

-- ---------------------------------------------------------------- 6. studio show registries
-- A show and an AIRING of a show are different things, so they are two tables: the registry says
-- College GameDay exists and covers cfb; the instance says this Saturday's, from Tuscaloosa, with
-- these hosts. Both are EMPTY after this migration - no studio-show data in this prompt.
create table studio_shows (
  show_id       text primary key,                      -- slug, e.g. 'college-gameday'
  name          text not null,
  network       text references networks_services(id), -- DEFAULT SLOT HINT ONLY, never the authority
  sport_covered sport,
  brand_mark    text,
  default_slot  text,
  created_at    timestamptz not null default now()
);

comment on column studio_shows.network is
  'A hint for the default slot, NOT the authority. Spec v0.5 P.3c: the carrying network is a '
  'per-instance broadcast fact, because the Cup season moves FOX -> Prime -> TNT -> USA/NBC inside '
  'one season and AEW Collision''s TNT/HBO Max split is volatile month to month.';

create table studio_show_instances (
  instance_id   bigint generated always as identity primary key,
  show_id       text not null references studio_shows(show_id),
  program_id    bigint references programs(program_id),
  air_date      date not null,
  location_text text,
  on_site       boolean not null default false,
  hosts         jsonb not null default '[]'::jsonb,
  source_url    text not null,
  source_tier   source_tier not null default 'announced',
  observed_at   timestamptz not null default now(),
  unique (show_id, air_date)
);

comment on column studio_show_instances.source_url is
  'NOT NULL on purpose. Joe 2026-09-02: hosts and locations are SOURCED, never curated - so an '
  'unsourced instance is unrepresentable, not merely discouraged.';
comment on column studio_show_instances.source_tier is
  'announced (press room / promoter) outranks reported (trade), and reported renders MUTED. Mirrors '
  'the 2026-09-01 Blue Jackets ruling: a trade report stays RUMOR against an unannounced carrier.';

-- ---------------------------------------------------------------- 7. RLS (0005 doctrine)
-- 0001 grants SELECT on new owner-created tables to anon/authenticated by default privilege, so RLS
-- must be enabled here or these tables would be readable without a policy.
alter table programs enable row level security;
alter table studio_shows enable row level security;
alter table studio_show_instances enable row level security;

create policy anon_read on programs               for select to anon, authenticated using (true);
create policy anon_read on studio_shows           for select to anon, authenticated using (true);
create policy anon_read on studio_show_instances  for select to anon, authenticated using (true);

reset role;
