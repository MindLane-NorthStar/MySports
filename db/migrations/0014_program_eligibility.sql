-- 0014 — a program can carry an eligibility verdict.
--
-- THE PROBLEM, as prompt 47 left it: `viewer_game_eligibility.game_id` is `text NOT NULL`, so there
-- is nowhere to record whether a race is on a service the viewer has. Rendering-contract v1.7 is the
-- first surface that shows a program to a reader, and it has to be able to say "you can watch this".
--
-- WHY THIS IS NOT 0012'S SHAPE, WHICH THE RUN'S BRIEF ASKED FOR. The brief specified the mirror of
-- 0012: make `game_id` nullable, add `program_id`, add `num_nonnulls(game_id, program_id) = 1`, add a
-- partial unique index. That works on `game_broadcasts` because its identity is a surrogate
-- (`id bigint generated always as identity primary key`) and `game_id` merely carries NOT NULL plus a
-- UNIQUE. IT DOES NOT WORK HERE:
--
--     viewer_game_eligibility_pkey  PRIMARY KEY (game_id, viewer_profile_id)
--
-- `game_id` is half the PRIMARY KEY, and a primary-key column cannot be null. Making it nullable
-- would mean DROPPING the primary key — the row identity of the table the whole app reads its access
-- verdicts from. The run's database approval (Joe, 2026-09-05) is "additive DDL only — new tables,
-- nullable columns, new indexes, ALTER TYPE ... ADD VALUE; NEVER A DROP", with one named exception
-- for dropping a NOT NULL. Dropping a primary key is a drop, and it is not that exception.
--
-- So the capability is built additively instead: a SEPARATE TABLE, column for column the sibling of
-- `viewer_game_eligibility`, keyed by `program_id`. What this buys, beyond staying inside the
-- approval:
--
--   * Every existing count is unchanged BY CONSTRUCTION, not by a `where game_id is not null` guard
--     bolted onto each consumer and hoped to be complete. Nothing about the game table changes, so
--     no coverage query, no summary and no embed can shift.
--   * NULLs are never distinct here, because neither key column is nullable — 0012's partial-index
--     problem cannot arise at all.
--   * PostgREST embeds it from `programs` on an unambiguous FK, exactly as `games` embeds its own.
--     `web/lib/offservice.js` reads the same row shape either way, so the app keeps ONE helper.
--
-- The cost, named: two tables hold one concept, and a future query that wants "every eligibility row
-- regardless of subject" has to union them. Nothing in the tree wants that today.
--
-- ADDITIVE ONLY. One new table, its grants, its RLS policy. No existing table, column, constraint,
-- index or row is touched by this file. Backup taken first anyway:
-- artifacts/backups/viewer_game_eligibility_2026-09-05T192311Z.csv (3,868 rows).

set role mysports_owner;
set search_path = mysports;

create table if not exists viewer_program_eligibility (
  program_id               bigint   not null references programs(program_id) on delete cascade,
  viewer_profile_id        smallint not null references viewer_profiles(id),
  eligible                 boolean  not null,
  eligible_via_network_id  text     references networks_services(id),
  eligible_via_service_ids text[]   not null default '{}',
  reason                   text,
  computed_at              timestamptz not null default now(),
  entitlement_version      text,
  -- E5's three states, verbatim from 0010: null = never computed, false = judged and not pending,
  -- true = the out-of-market conclusion rests on no map data. No default, for the same reason.
  market_pending           boolean,
  primary key (program_id, viewer_profile_id)
);

comment on table viewer_program_eligibility is
  '0014 (2026-09-05). The sibling of viewer_game_eligibility for subjects that are programs and not '
  'games - a race, a fight card, a weekly show, a studio bookend. Same columns, same meaning, same '
  'writer (pipeline/reconcile.py --programs), same reader (web/lib/offservice.js). Separate rather '
  'than merged because game_id is half viewer_game_eligibility''s PRIMARY KEY and could not be made '
  'nullable without dropping it.';

comment on column viewer_program_eligibility.reason is
  'The telecast ladder''s sentence, from pipeline/reconcile.py telecast_verdict(). A program with no '
  'active broadcast row reads "no telecast observed" - the same NETWORK TBD state a bare game gets '
  '(docs/feature-study/05-home-page-decisions.md section 9), never "not on your services".';

create index if not exists viewer_program_eligibility_program_idx
  on viewer_program_eligibility (program_id);

-- 0001 grants SELECT on owner-created tables to anon/authenticated by default privilege, so RLS has
-- to be enabled here or this table would be readable with no policy at all (0009's note).
alter table viewer_program_eligibility enable row level security;
drop policy if exists anon_read on viewer_program_eligibility;
create policy anon_read on viewer_program_eligibility for select to anon, authenticated using (true);

do $$
declare n_programs int; n_elig int;
begin
  select count(*) into n_programs from programs;
  select count(*) into n_elig from viewer_program_eligibility;
  raise notice '0014: programs %, viewer_program_eligibility % (the reconcile fills it)', n_programs, n_elig;
end $$;

reset role;
