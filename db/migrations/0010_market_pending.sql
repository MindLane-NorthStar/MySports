-- MySports 0010 — market_pending on viewer_game_eligibility (E5).
-- docs/feature-study/05-home-page-decisions.md §8. Applied as `mysports_0010_market_pending`. Depends on 0009.
--
-- ADDITIVE ONLY. One nullable column. Nothing is dropped, narrowed, retyped or deleted; no existing
-- row is modified by this file. Backup taken first: viewer_game_eligibility, 375 rows.
--
-- WHY NULLABLE WITH NO DEFAULT, which is the whole design of this column. Three states have to stay
-- distinguishable:
--
--     null    never computed - the reconciler has not visited this row since 0010
--     false   computed, and this game is NOT market pending
--     true    computed, and the out-of-market conclusion rests on no map data
--
-- A `default false` would have quietly asserted "computed, not pending" for all 375 pre-existing rows
-- and made the backfill unverifiable - there would be no way to tell a row the reconciler had judged
-- from one it had never seen. The backfill in this same change turns every null into a real verdict;
-- the nullability is what lets that be checked afterwards.
--
-- E5 in one line: a regional game whose market assignment has not published yet is neither watchable
-- nor off-service, and saying "not on your services" about it asserts a certainty the data does not
-- have. See the column comment for how the state resolves itself.

set role mysports_owner;
set search_path = mysports;

alter table viewer_game_eligibility
  add column if not exists market_pending boolean;

comment on column viewer_game_eligibility.market_pending is
  'E5 (2026-09-03). TRUE when this game is ineligible ONLY because its regional market assignment has '
  'not published yet - an active broadcast row carries access_status = unverified and market_coverage '
  'holds no row for that (game, network, viewer market). Such a game is ALWAYS SHOWN, never filtered, '
  'and is never counted inside "not on your services". NULL means never computed, which is why this '
  'column has no default. Self-resolving: when the 506sports map loads into market_coverage the '
  'reconciler re-decides and the game becomes eligible or genuinely out-of-market, with no manual step. '
  'A game that is eligible is never market pending.';

reset role;
