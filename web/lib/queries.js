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

/**
 * College football poll ranks for a set of clubs, weeks and seasons (migration 0003, loaded by
 * pipeline/rankings.py). Only CFB has polls, so a page with no college game makes no request.
 *
 * Both AP and CFP come back and lib/standings.js rankFor() applies Joe's precedence - CFP first, then
 * AP. The Coaches poll is stored but deliberately not requested: nothing renders it, and asking for
 * rows the card will discard is a bigger response for no reason.
 */
export async function rankingsFor(teamIds, seasons, weeks) {
  const ids = [...new Set((teamIds || []).filter(Boolean))];
  const yrs = [...new Set((seasons || []).filter((s) => Number.isInteger(s)))];
  const wks = [...new Set((weeks || []).filter((w) => Number.isInteger(w)))];
  if (!ids.length || !yrs.length || !wks.length) return [];
  return rest(
    `rankings?select=team_id,season,week,poll_type,rank` +
      `&team_id=in.${inList(ids)}&season=in.(${yrs.join(',')})&week=in.(${wks.join(',')})` +
      `&poll_type=in.(AP,CFP)`
  );
}

/** The rank index for a page's games, in one round trip. CFB only - no other sport has a poll. */
export async function rankingsForGames(games) {
  const ids = [];
  const seasons = [];
  const weeks = [];
  for (const g of games || []) {
    if (g.sport !== 'cfb') continue;
    if (g.home?.id) ids.push(g.home.id);
    if (g.away?.id) ids.push(g.away.id);
    if (Number.isInteger(g.season)) seasons.push(g.season);
    if (Number.isInteger(g.week)) weeks.push(g.week);
  }
  return rankingsFor(ids, seasons, weeks);
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

// --------------------------------------------------------------------------- programs (v1.7)
//
// A PROGRAM IS NOT A GAME AND DOES NOT LIVE IN `games`. Migration 0009 made `programs` the supertype
// and a team game one subtype of it; a race, a fight card, a weekly show and a studio bookend have
// no rows in `games` at all, so they need their own read. `program_type=neq.game` excludes the
// shadow rows pipeline/programs.py writes beside every real game - those are the game, read above.
//
// WHY A start_at RANGE AND NOT viewing_day. `games` carries a `viewing_day` column the pipeline
// computes; `programs` has none, and adding one would mean writing a value onto 3,966 existing rows.
// The viewing day IS a range - 03:00 ET to 03:00 ET - so asking for it as one costs nothing and
// invents nothing. viewingDayBounds() derives the two instants; `programs_sport_start_idx` serves it.
const PROGRAM_SELECT = [
  'program_id',
  'sport',
  'program_type',
  'title',
  'subtitle',
  'start_at',
  'expected_duration_min',
  'open_ended',
  'location_text',
  'on_site',
  'series',
  'headliners',
  'hosts_crew',
  'segments',
  'brand_key',
  'bookend',
  'anchor_program_id',
  'postponed_to',
  'source_url',
  'source_tier',
  // Windows come along because a UFC card's CBS slice is DATA the detail panel shows; the card
  // itself renders plain (design of record, "Rulings that shape it").
  'broadcasts:game_broadcasts(service_id,delivery_surface,feed_side,is_primary,access_status,'
    + 'carriage_certainty,active,label,window_start,window_end,'
    + 'network:networks_services(id,canonical_name,type,default_sort_order))',
  // 0014's own table. Same four fields the game card reads, so web/lib/offservice.js needs no branch.
  'eligibility:viewer_program_eligibility(eligible,reason,eligible_via_network_id,market_pending)',
].join(',');

const PROGRAM_ORDER = 'order=start_at.asc.nullslast,program_id.asc';

/** Minutes to add to a UTC instant to read it as ET, for that instant's own DST state. */
function etOffsetMinutes(instant) {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = Object.fromEntries(f.formatToParts(instant).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return (asUtc - instant.getTime()) / 60000;
}

/**
 * The UTC bounds of one viewing day: `[03:00 ET that day, 03:00 ET the next)`.
 *
 * The offset is resolved by ITERATION rather than by a table, because the answer depends on the
 * instant and the instant depends on the answer. Two passes settle it everywhere except inside the
 * one-hour spring-forward gap, which 03:00 ET is deliberately not in.
 */
export function viewingDayBounds(day, cutoverHour = 3) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day || ''))) return null;
  const at = (dayStr, addDays) => {
    const base = Date.parse(`${dayStr}T00:00:00Z`) + addDays * 86400000 + cutoverHour * 3600000;
    let t = base;
    for (let i = 0; i < 2; i += 1) t = base - etOffsetMinutes(new Date(t)) * 60000;
    return new Date(t).toISOString();
  };
  return { start: at(day, 0), end: at(day, 1) };
}

function programSportFilter(sport) {
  const list = expandSport(sport);
  if (!list.length) return '';
  return list.length === 1 ? `&sport=eq.${list[0]}` : `&sport=in.(${list.join(',')})`;
}

/**
 * The NASCAR series sub-filter (register section 9).
 *
 * IT MUST NOT REMOVE ANYTHING THAT IS NOT NASCAR. `series` is null on every IndyCar race, every
 * fight card and every wrestling show, so a bare `series=eq.cup` would empty the Racing page of
 * IndyCar and an all-sports page of everything else. `or=(sport.neq.nascar,series.eq.cup)` keeps
 * every non-NASCAR row and narrows only the NASCAR ones, which is what a SUB-filter means.
 */
function seriesFilter(series) {
  if (!series) return '';
  return `&or=(sport.neq.nascar,series.eq.${series})`;
}

/** Every non-game program on one viewing day, optionally one sport (or the `racing` token). */
export async function programsForDay(day, sport, series) {
  const b = viewingDayBounds(day);
  if (!b) return [];
  return rest(
    `programs?select=${PROGRAM_SELECT}&program_type=neq.game`
    + `&start_at=gte.${b.start}&start_at=lt.${b.end}${programSportFilter(sport)}`
    + `${seriesFilter(series)}&${PROGRAM_ORDER}`
  );
}

/** Every non-game program in an inclusive viewing-day range. Paginated: a week can be large. */
export async function programsForRange(start, end, sport, series) {
  const a = viewingDayBounds(start);
  const z = viewingDayBounds(end);
  if (!a || !z) return [];
  return restAll(
    `programs?select=${PROGRAM_SELECT}&program_type=neq.game`
    + `&start_at=gte.${a.start}&start_at=lt.${z.end}${programSportFilter(sport)}`
    + `${seriesFilter(series)}&${PROGRAM_ORDER}`
  );
}

/** One program with everything the detail panel shows. */
export async function programById(id) {
  const rows = await rest(`programs?select=${PROGRAM_SELECT}&program_id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows[0] || null;
}

/**
 * Programs that have already aired, newest first - the History page's half of `finalGames`.
 *
 * A GAME has an observed `result_status`; a PROGRAM does not. Nobody reports that a race is over the
 * way a scoreboard reports a final, so "already aired" is a question about the clock and is asked as
 * one: everything that started before now. lib/programs.js toRow() then derives the same three-state
 * word the game card shows, from the same instant the page rendered at.
 */
export async function finalPrograms({ limit = 200, sport, before } = {}) {
  const cut = before || new Date().toISOString();
  return rest(
    `programs?select=${PROGRAM_SELECT}&program_type=neq.game&start_at=lt.${cut}`
    + `${programSportFilter(sport)}&order=start_at.desc&limit=${limit}`
  );
}
