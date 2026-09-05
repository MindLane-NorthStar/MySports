-- 0013 — the spec v0.5 gaps that 0009 did not build, and the studio-show registry.
--
-- READ 0009 BEFORE THIS FILE. It already built most of what a program needs: subtitle, location_text,
-- on_site, series, headliners, hosts_crew, open_ended, postponed_to and segments are all there, and
-- so are every `sport` value (nascar, indycar, ufc, wwe, aew) and every `program_type` value (game,
-- race_session, fight_card, weekly_show, special_event, studio_show). THIS FILE ADDS NO ENUM VALUES,
-- because there are none left to add - the plan expected otherwise; the tree disagreed.
--
-- Everything here is additive and nullable.

set role mysports_owner;
set search_path = mysports;

-- ---------------------------------------------------------------- programs: the five real gaps
--
-- anchor_program_id is NOT parent_program_id. 0009's parent is containment - a segment inside a
-- show. An anchor is what a bookend is attached to and rendered against: College GameDay ends when
-- its anchor game starts, and the anchor lives on a different network row. A pre-show is not a child
-- of the game.
alter table programs add column if not exists anchor_program_id bigint references programs(program_id);

-- Text with a check rather than a new enum type: two values, and a check can be relaxed in one
-- statement where an enum cannot.
alter table programs add column if not exists bookend text;
alter table programs drop constraint if exists programs_bookend_ck;
alter table programs add constraint programs_bookend_ck
  check (bookend is null or bookend in ('pre', 'post'));

-- brand_key is the LOOKUP into data/brands.json (the colour and the mark). 0009's brand_mark is a
-- path to a specific image; the key is the identity that survives the image being replaced.
alter table programs add column if not exists brand_key text;

-- Provenance, so a row can say where it came from and how much to trust it - the same pair every
-- adapter already writes for games.
alter table programs add column if not exists source_url text;
alter table programs add column if not exists source_tier text;

-- ---------------------------------------------------------------- broadcasts: the CBS-window pair
--
-- A UFC card runs on Paramount+ end to end while a WINDOW of it is simulcast on CBS. That is one
-- broadcast row with a start and an end inside the program's span, not a second program.
alter table game_broadcasts add column if not exists window_start timestamptz;
alter table game_broadcasts add column if not exists window_end timestamptz;
alter table game_broadcasts drop constraint if exists game_broadcasts_window_ck;
alter table game_broadcasts add constraint game_broadcasts_window_ck
  check (window_start is null or window_end is null or window_end > window_start);

-- ---------------------------------------------------------------- natural keys per program type
--
-- 0012 gave race_session one. The others need theirs for the same reason: without a key to conflict
-- on, every re-load inserts instead of updating. Partial per type, because the identifying columns
-- differ and a single index over all of them would be wrong for each.
create unique index if not exists programs_weekly_show_uq
  on programs (sport, title, start_at) where program_type = 'weekly_show';
create unique index if not exists programs_studio_show_uq
  on programs (sport, title, start_at) where program_type = 'studio_show';
create unique index if not exists programs_fight_card_uq
  on programs (sport, start_at, title) where program_type = 'fight_card';
create unique index if not exists programs_special_event_uq
  on programs (sport, start_at, title) where program_type = 'special_event';

-- ------------------------------------------------- the studio-show registry: EXTENDED, not created
--
-- 0009 ALREADY BUILT BOTH TABLES, with its own names, and this file does not get to rename them:
--   studio_shows(show_id, name, network, sport_covered, brand_mark, default_slot, created_at)
--   studio_show_instances(instance_id, show_id, program_id, air_date, location_text, on_site,
--                         hosts, source_url, source_tier, observed_at)
--
-- The plan proposed show_key / title / network_key / site_text and a fresh CREATE. A `create table
-- if not exists` against a table that already exists is a silent no-op - it would have looked like
-- it worked and left the registry without a single one of the new columns. So the instance table
-- needs NOTHING (location_text, source_url and source_tier are already the site, its citation and
-- its tier under 0009 names), and studio_shows gets only what it genuinely lacks: the slot a
-- generator needs to produce instances, and the anchor rule that makes a bookend a bookend.

alter table studio_shows add column if not exists bookend       text;
alter table studio_shows drop constraint if exists studio_shows_bookend_ck;
alter table studio_shows add constraint studio_shows_bookend_ck
  check (bookend is null or bookend in ('pre', 'post'));

-- ISO weekday, 0=Monday .. 6=Sunday. Null for a show with no fixed night.
alter table studio_shows add column if not exists weekday       int;
alter table studio_shows drop constraint if exists studio_shows_weekday_ck;
alter table studio_shows add constraint studio_shows_weekday_ck
  check (weekday is null or weekday between 0 and 6);

-- 0009 has default_slot as free text. These are the parsed form a generator can actually use.
alter table studio_shows add column if not exists slot_start_et time;
alter table studio_shows add column if not exists duration_min  int;

-- How to find the anchor game. Null = standalone, and the show renders at its slot on its own row.
alter table studio_shows add column if not exists anchor_rule   text;

-- The window a show is on air across a season, so a generator stops at the right date.
alter table studio_shows add column if not exists active_from   date;
alter table studio_shows add column if not exists active_to     date;

alter table studio_shows add column if not exists source_url    text;
alter table studio_shows add column if not exists updated_at    timestamptz not null default now();

create index if not exists studio_show_instances_date_idx on studio_show_instances (air_date);
create index if not exists programs_anchor_idx on programs (anchor_program_id);
