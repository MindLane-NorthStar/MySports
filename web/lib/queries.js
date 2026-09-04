// Every read the app makes, in one file, so the data contract is reviewable in one place.
// See docs/app-skeleton.md for the route -> query mapping.

import { rest, inList, restAll } from './rest.js';
import { expandSport } from './config.js';

// The column list every game card needs. Teams are embedded through the two FKs on games; the
// broadcast rows are embedded through game_broadcasts -> networks_services.
const GAME_SELECT = [
  'id',
  'sport',
  'season',
  'week',
  'game_date',
  'viewing_day',
  'canonical_kickoff_at_utc',
  'kickoff_status',
  'network_status',
  'canonical_state',
  'neutral_site',
  'primary_network_id',
  'home_score',
  'away_score',
  'result_status',
  'boxscore_url',
  'completed_at',
  // v0.2: the locked listings card needs the pitching matchup, the ranks the grid prefixes a name
  // with, the rivalry flag the marquee plate keys off, and the venue the tray prints.
  'probable_home_pitcher',
  'probable_away_pitcher',
  'home_rank',
  'away_rank',
  'is_rivalry',
  // the marquee criterion is tier-ONE rivalry, and tier lives on rivalries - one join through the FK,
  // which is why stage 4 needed no new column for it
  'rivalry:rivalries(name,tier,display_label)',
  'venue:venues(name,city,state)',
  'home:teams!games_home_team_id_fkey(id,canonical_name,short_name,display_name,abbreviation,primary_color,secondary_color,conference:conferences(name))',
  'away:teams!games_away_team_id_fkey(id,canonical_name,short_name,display_name,abbreviation,primary_color,secondary_color,conference:conferences(name))',
  'broadcasts:game_broadcasts(service_id,delivery_surface,feed_side,is_primary,access_status,carriage_certainty,active,label,network:networks_services(id,canonical_name,type,default_sort_order))',
  'odds:game_odds(provider,spread,total,home_moneyline,away_moneyline,fetched_at)',
  // D4/E3: the reconciler's OWN eligibility verdict, embedded rather than re-derived. A second
  // rule in JS would drift from pipeline/reconcile.py and from the renderer's "not on your
  // services" count. Embedded on the FK, so this costs no extra round trip.
  'eligibility:viewer_game_eligibility(eligible,reason,eligible_via_network_id,market_pending)',
].join(',');

const ORDER = 'order=canonical_kickoff_at_utc.asc.nullslast,id.asc';

/**
 * §16: the filter token is expanded HERE, never in a component, because this is the last place
 * before the wire. `racing` covers two enum values; anything else covers itself. PostgREST answers
 * `sport=eq.racing` with a 400 - `invalid input value for enum sport` - so an unexpanded token
 * would surface as an error page rather than an empty state.
 */
function sportFilter(sport) {
  const list = expandSport(sport);
  if (!list.length) return '';
  return list.length === 1 ? `&sport=eq.${list[0]}` : `&sport=in.(${list.join(',')})`;
}

/** Every game on one viewing day, optionally one sport. */
export async function gamesForDay(day, sport) {
  return rest(`games?select=${GAME_SELECT}&viewing_day=eq.${day}${sportFilter(sport)}&${ORDER}`);
}

/** Every game in an inclusive viewing_day range, optionally one sport. */
export async function gamesForRange(start, end, sport) {
  return rest(
    `games?select=${GAME_SELECT}&viewing_day=gte.${start}&viewing_day=lte.${end}${sportFilter(sport)}&${ORDER}`
  );
}

/** Every game carrying one provider week label (cfb/nfl). The span is derived from what comes back. */
export async function gamesForSeasonWeek(sport, season, week) {
  return rest(
    `games?select=${GAME_SELECT}&sport=eq.${sport}&season=eq.${season}&week=eq.${week}&${ORDER}`
  );
}

/**
 * The skeleton rows the /weeks page groups on: one row per game, three columns.
 * Small enough to fetch whole (the database holds a few hundred games), and grouping in JS keeps
 * both week concepts in lib/weeks.js rather than split between SQL and the page.
 */
export async function weekIndexRows() {
  // restAll, not rest: this read grows with the season. At 375 games it fitted inside PostgREST's
  // 1000-row cap; at 1364 it did not, and the cap is SILENT - the Weeks picker simply offered CFB
  // weeks 1-10 and NFL weeks 1-9 and omitted the rest of the year with nothing to show it had.
  return restAll('games?select=id,sport,season,week,viewing_day&order=viewing_day.asc,id.asc');
}

/** Completed games, newest first. `search` matches a team name/abbreviation or a network name. */
export async function finalGames({ limit = 200, sport } = {}) {
  return rest(
    `games?select=${GAME_SELECT}&result_status=eq.final${sportFilter(sport)}` +
      `&order=completed_at.desc.nullslast,canonical_kickoff_at_utc.desc&limit=${limit}`
  );
}

/**
 * The newest archived grid for one (sport, viewing day), or null.
 * generated_grids is an immutable archive - one row per distinct render of a day - so "newest"
 * means the most recently generated row for that key.
 */
export async function newestGridFor(sport, day) {
  // generated_grids.sport is the SAME enum, so this needs the same expansion - `eq.racing` is a
  // 400 here too, and this call sits inside a Suspense where a throw would take the page with it.
  const list = expandSport(sport);
  if (!list.length) return null;
  const clause = list.length === 1 ? `sport=eq.${list[0]}` : `sport=in.(${list.join(',')})`;
  const rows = await rest(
    `generated_grids?select=sport,game_date,svg_asset_url,png_asset_url,generated_at,generator_version,games_on_grid,games_tbd,games_omitted` +
      `&${clause}&game_date=eq.${day}&order=generated_at.desc,id.desc&limit=1`
  );
  return rows[0] || null;
}

/** Every (sport, day) that has at least one archived grid - used to decide what to offer. */
export async function gridIndex() {
  return rest('generated_grids?select=sport,game_date,generated_at&order=generated_at.desc');
}

/** Does this game's card have anything to say about where to watch it? */
export function primaryBroadcast(game) {
  const rows = (game.broadcasts || []).filter((b) => b.active !== false);
  if (!rows.length) return null;
  return (
    rows.find((b) => b.is_primary) ||
    rows.find((b) => b.delivery_surface === 'LINEAR') ||
    rows[0]
  );
}

export function networkName(game) {
  const b = primaryBroadcast(game);
  if (b?.network?.canonical_name) return b.network.canonical_name;
  if (b?.label) return b.label;
  if (game.network_status === 'tbd') return 'Network TBD';
  if (game.network_status === 'no_linear_telecast') return 'No linear telecast';
  if (game.network_status === 'stream_exclusive') return 'Streaming exclusive';
  return null;
}

/** Free-text match used by /history's search box: team names, abbreviations, network names. */
export function matchesSearch(game, needle) {
  if (!needle) return true;
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    game.home?.canonical_name,
    game.home?.short_name,
    game.home?.abbreviation,
    game.away?.canonical_name,
    game.away?.short_name,
    game.away?.abbreviation,
    networkName(game),
    ...(game.broadcasts || []).map((b) => b.network?.canonical_name),
    ...(game.broadcasts || []).map((b) => b.label),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

/**
 * Standings for a set of clubs. team_records keeps one row per club PER DAY, so this asks for the
 * relevant (team, season) pairs and lets lib/standings.js pick the newest as_of for each.
 *
 * A club with no row comes back with nothing, and the card omits its record line entirely. That is
 * the correct answer before a season starts: pipeline/standings.py files the NBA and NHL tables under
 * the season they actually describe, so a 2026-27 game has no 2026-27 standings until games are played.
 */
export async function standingsFor(teamIds, seasons) {
  const ids = [...new Set((teamIds || []).filter(Boolean))];
  const yrs = [...new Set((seasons || []).filter((s) => Number.isInteger(s)))];
  if (!ids.length || !yrs.length) return [];
  return rest(
    `team_records?select=team_id,season,as_of,wins,losses,ties,ot_losses,points,division_rank,games_back,source` +
      `&team_id=in.${inList(ids)}&season=in.(${yrs.join(',')})&order=as_of.asc`
  );
}

/** The standings index for a page's games, in one round trip. */
export async function standingsForGames(games) {
  const ids = [];
  const seasons = [];
  for (const g of games || []) {
    if (g.home?.id) ids.push(g.home.id);
    if (g.away?.id) ids.push(g.away.id);
    if (Number.isInteger(g.season)) seasons.push(g.season);
  }
  return standingsFor(ids, seasons);
}

/** One game with everything the detail panel shows. */
export async function gameById(id) {
  const rows = await rest(`games?select=${GAME_SELECT}&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows[0] || null;
}
