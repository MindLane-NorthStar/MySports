// THE ROWS /qa/tbd RENDERS (prompt 124, register §67). Plain data in its own module - no JSX, no Next
// import - so web/test/qatbd.test.mjs can hold every row against the select and page.js can import it.
// A file here that is not `page.js` is not a route.
//
// THE SHAPE IS gamesForDay()'s OUTPUT (lib/queries.js:88-90): GAME_SELECT (:9-46) with ODDS_NEWEST
// (:73), key for key, copied from a live response for 2026-10-03 (`mlb-849829`) rather than written
// from the select string. Today hands that list through applyOverlay, chronological and splitHidden
// (app/page.js:523-564) before Listing sees it, and none of the three adds or removes a field. No
// field below is invented; `home_team_id` and `away_team_id` are absent because GAME_SELECT does not
// carry them either.
//
// WHAT THE ROWS COVER - every branch TeamMark has (components/TeamMark.js:26-38):
//   - one side per MLB name form lib/placeholders.js recognizes, as their real rows:
//     `mlb-4944` "AL Wild Card #2", `mlb-4617` "NL #3 Seed", `mlb-5528` "AL 3/6 Winner";
//   - one `-TBD` id, `mlb-TBD`, on the HOME side, so both team stacks carry a placeholder somewhere;
//   - a real club with a working logo on every card, so every badge sits beside a real mark;
//   - the Yankees, `mlb-147`, whose logo qa-shots makes 404: the error path, beside the Red Sox.
// The clubs' names and colours are their live `teams` rows, read 2026-09-29. EVERY PLACEHOLDER ID'S
// LOGO 404s ON R2 (measured the same day), which is why qa-shots also asserts that no placeholder
// side requested one - see the TBD block there.
//
// EVERY GAME IS WATCHABLE, so splitHidden() hides none of them: a hidden card would be a side the
// check could not see.

export const TBD_DAY = '2026-10-10';

const team = (id, name, abbreviation, primary = null, secondary = null, conference = null) => ({
  id,
  conference: conference ? { name: conference } : null,
  short_name: name,
  abbreviation,
  display_name: null,
  primary_color: primary,
  canonical_name: name,
  secondary_color: secondary,
});

// the placeholders, as the database holds them (conference and colours null)
const AL_WILD_CARD_2 = team('mlb-4944', 'AL Wild Card #2', 'ALWC2');
const NL_3_SEED = team('mlb-4617', 'NL #3 Seed', 'NL3');
const AL_3_6_WINNER = team('mlb-5528', 'AL 3/6 Winner', 'AL3/6');
const MLB_TBD = team('mlb-TBD', 'TBD', 'TBD');

// the clubs
const ASTROS = team('mlb-117', 'Astros', 'HOU', '#002d62', '#eb6e1f', 'American League West');
const PADRES = team('mlb-135', 'Padres', 'SD', '#2f241d', '#ffc425', 'National League West');
const MARINERS = team('mlb-136', 'Mariners', 'SEA', '#005c5c', '#0c2c56', 'American League West');
const DODGERS = team('mlb-119', 'Dodgers', 'LAD', '#005a9c', '#ffffff', 'National League West');
const RED_SOX = team('mlb-111', 'Red Sox', 'BOS', '#0d2b56', '#bd3039', 'American League East');
const YANKEES = team('mlb-147', 'Yankees', 'NYY', '#132448', '#c4ced4', 'American League East');

const venue = (name) => (name ? { city: '', name, state: null } : null);

function game(n, kickoff, away, home, park) {
  return {
    id: `mlb-99000${n}`,
    sport: 'mlb',
    season: 2026,
    week: null,
    game_date: TBD_DAY,
    viewing_day: TBD_DAY,
    canonical_kickoff_at_utc: kickoff,
    kickoff_status: 'set',
    network_status: 'assigned',
    canonical_state: 'fully_assigned',
    neutral_site: false,
    primary_network_id: 'trutv',
    home_score: null,
    away_score: null,
    result_status: 'scheduled',
    boxscore_url: `https://www.mlb.com/gameday/99000${n}`,
    completed_at: null,
    probable_home_pitcher: null,
    probable_away_pitcher: null,
    home_rank: null,
    away_rank: null,
    is_rivalry: false,
    odds: [],
    rivalry: null,
    venue: venue(park),
    home,
    away,
    broadcasts: [{
      label: 'TruTV',
      active: true,
      network: { id: 'trutv', type: 'linear_cable', canonical_name: 'truTV', default_sort_order: 38 },
      feed_side: 'NATIONAL',
      is_primary: true,
      service_id: 'trutv',
      access_status: 'available',
      delivery_surface: 'LINEAR',
      carriage_certainty: 'CONFIRMED',
    }],
    eligibility: [{ reason: 'linear trutv', eligible: true, market_pending: false, eligible_via_network_id: 'trutv' }],
  };
}

export const TBD_GAMES = [
  game(1, '2026-10-10T17:00:00+00:00', AL_WILD_CARD_2, ASTROS, 'Daikin Park'),
  game(2, '2026-10-10T19:00:00+00:00', NL_3_SEED, PADRES, 'Petco Park'),
  game(3, '2026-10-10T21:00:00+00:00', AL_3_6_WINNER, MARINERS, 'T-Mobile Park'),
  // an unassigned host has no park, so no venue row - the embed is null exactly as it is live
  game(4, '2026-10-10T23:00:00+00:00', DODGERS, MLB_TBD, null),
  game(5, '2026-10-11T01:00:00+00:00', RED_SOX, YANKEES, 'Yankee Stadium'),
];
