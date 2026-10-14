// THE ROWS /qa/offair RENDERS (prompt 129, register §74). Plain data in its own module, as
// app/qa/tbd/fixture.js is, so web/test/qatbd.test.mjs can hold every row against GAME_SELECT.
//
// JOE'S RULING 4, 2026-10-14: a postponed game comes off the grid as a cancelled one does, and the
// list keeps both. So three watchable MLB games on one postseason day, each on its own network so a
// grid row is a game: one scheduled (TBS), one CANCELLED (FS1), one POSTPONED (FOX). The grid must
// draw exactly one block on one row; the list must show all three cards, two of them printing their
// word in the right slot (lib/format.js, contract v1.6.6).
//
// THE SHAPE IS gamesForDay()'s OUTPUT, the same keys app/qa/tbd/fixture.js copies from a live response;
// the clubs are their live `teams` rows as that file records them, and the three networks their live
// `networks_services` rows, read 2026-10-14. Every game is eligible, so
// splitHidden() hides none: a hidden card is a state the check could not see.

export const OFFAIR_DAY = '2026-10-16';

const team = (id, name, abbreviation, primary, secondary, conference) => ({
  id,
  conference: { name: conference },
  short_name: name,
  abbreviation,
  display_name: null,
  primary_color: primary,
  canonical_name: name,
  secondary_color: secondary,
});

const MARINERS = team('mlb-136', 'Mariners', 'SEA', '#005c5c', '#0c2c56', 'American League West');
const YANKEES = team('mlb-147', 'Yankees', 'NYY', '#132448', '#c4ced4', 'American League East');
const DODGERS = team('mlb-119', 'Dodgers', 'LAD', '#005a9c', '#ffffff', 'National League West');
const PADRES = team('mlb-135', 'Padres', 'SD', '#2f241d', '#ffc425', 'National League West');
const ASTROS = team('mlb-117', 'Astros', 'HOU', '#002d62', '#eb6e1f', 'American League West');
const RED_SOX = team('mlb-111', 'Red Sox', 'BOS', '#0d2b56', '#bd3039', 'American League East');

const NETWORKS = {
  tbs: { id: 'tbs', type: 'linear_cable', canonical_name: 'TBS', default_sort_order: 37 },
  fs1: { id: 'fs1', type: 'linear_cable', canonical_name: 'FS1', default_sort_order: 9 },
  fox: { id: 'fox', type: 'linear_broadcast', canonical_name: 'FOX', default_sort_order: 3 },
};

function game(n, kickoff, away, home, net, status) {
  return {
    id: `mlb-99010${n}`,
    sport: 'mlb',
    season: 2026,
    week: null,
    game_date: OFFAIR_DAY,
    viewing_day: OFFAIR_DAY,
    canonical_kickoff_at_utc: kickoff,
    kickoff_status: 'set',
    network_status: 'assigned',
    canonical_state: 'fully_assigned',
    neutral_site: false,
    primary_network_id: net,
    home_score: null,
    away_score: null,
    result_status: status,
    boxscore_url: `https://www.mlb.com/gameday/99010${n}`,
    completed_at: null,
    probable_home_pitcher: null,
    probable_away_pitcher: null,
    home_rank: null,
    away_rank: null,
    is_rivalry: false,
    odds: [],
    rivalry: null,
    venue: null,
    home,
    away,
    broadcasts: [{
      label: null,
      active: true,
      network: NETWORKS[net],
      feed_side: 'NATIONAL',
      is_primary: true,
      service_id: net,
      access_status: 'available',
      delivery_surface: 'LINEAR',
      carriage_certainty: 'CONFIRMED',
    }],
    eligibility: [{ reason: `linear ${net}`, eligible: true, market_pending: false, eligible_via_network_id: net,
      eligible_via_service_ids: [] }],
  };
}

export const OFFAIR_GAMES = [
  game(1, '2026-10-16T20:08:00+00:00', MARINERS, YANKEES, 'tbs', 'scheduled'),
  game(2, '2026-10-16T23:38:00+00:00', PADRES, DODGERS, 'fs1', 'cancelled'),
  game(3, '2026-10-17T00:08:00+00:00', RED_SOX, ASTROS, 'fox', 'postponed'),
];
