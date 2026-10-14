// THE ROWS /qa/channel RENDERS (prompt 129 block G, register §74). Plain data, as app/qa/tbd/fixture.js
// is, so web/test/qatbd.test.mjs can hold every row against GAME_SELECT.
//
// JOE'S RULING 1, 2026-10-14: "show the game". A game on a channel nobody has ruled on is the fifth
// listing state, UNRECOGNIZED, and wears a CHANNEL ? cue. To measure that the cue fits at 390px
// EXACTLY AS THE OTHER TWO DO, all three cue states are on one page, one card each:
//
//   UNRECOGNIZED   the NLCS's real stub row before prompt 129: `fs1-fox-one`, access unknown, and a
//                  verdict of "not receivable" - what D4 used to hide;
//   MARKET TBD     a FOX regional row, access unverified, market_pending true (E5);
//   NETWORK TBD    no broadcast row at all (05 section 9).
//
// The rows are /qa/offair's scheduled TBS game, cloned and changed only where the state lives - the
// broadcasts, the eligibility verdict, the primary network and the id - so the shape stays
// gamesForDay()'s by construction. `fs1-fox-one`'s network row is the live one as it stood on
// 2026-10-14 (linear_cable, no sort order).

import { OFFAIR_GAMES } from '../offair/fixture.js';

export const CHANNEL_DAY = '2026-10-16';

const base = OFFAIR_GAMES[0];

function variant(n, kickoff, primary, broadcasts, eligibility, away = base.away, home = base.home) {
  return { ...base, id: `mlb-99020${n}`, boxscore_url: `https://www.mlb.com/gameday/99020${n}`,
           canonical_kickoff_at_utc: kickoff, primary_network_id: primary, broadcasts, eligibility: [eligibility],
           network_status: broadcasts.length ? 'assigned' : 'tbd',
           canonical_state: broadcasts.length ? 'fully_assigned' : 'network_tbd', away, home };
}

const row = (service_id, network, access_status) => ({
  label: null, active: true, network, feed_side: 'NATIONAL', is_primary: true, service_id, access_status,
  delivery_surface: 'LINEAR', carriage_certainty: 'CONFIRMED',
});

const FS1_FOX_ONE = { id: 'fs1-fox-one', type: 'linear_cable', canonical_name: 'FS1/ FOX ONE', default_sort_order: null };
const FOX = { id: 'fox', type: 'linear_broadcast', canonical_name: 'FOX', default_sort_order: 3 };

export const CHANNEL_GAMES = [
  variant(1, '2026-10-16T20:08:00+00:00', 'fs1-fox-one', [row('fs1-fox-one', FS1_FOX_ONE, 'unknown')],
          { reason: 'not receivable: fs1-fox-one=unknown', eligible: false, market_pending: false,
            eligible_via_network_id: null, eligible_via_service_ids: [] }),
  variant(2, '2026-10-16T23:38:00+00:00', 'fox', [row('fox', FOX, 'unverified')],
          { reason: 'not receivable: fox=unverified [market pending]', eligible: false, market_pending: true,
            eligible_via_network_id: null, eligible_via_service_ids: [] }, OFFAIR_GAMES[1].away, OFFAIR_GAMES[1].home),
  variant(3, '2026-10-17T00:08:00+00:00', null, [],
          { reason: 'no active broadcast', eligible: false, market_pending: false,
            eligible_via_network_id: null, eligible_via_service_ids: [] }, OFFAIR_GAMES[2].away, OFFAIR_GAMES[2].home),
];
