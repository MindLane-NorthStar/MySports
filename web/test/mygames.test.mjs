// /api/my-games, THE ADDRESS MYDASH READS JOE'S GAMES FROM (prompt 127, Joe's ruling 2026-10-05).
//
// The route answers with what MySports' own card shows, so what is tested here is that every field
// comes from the card's own functions: the favourites, the order the page uses, the overlay handed
// only today's favourites, the card's name and dark logo, the mark the card wears, and the right
// slot's verdict - plus the exact keys a reader can rely on, and the wiring, as source text.
//
// THE FIXTURES ARE GAME_SELECT'S EXACT SHAPE, held to it by the first test, so a field the query
// gains or loses cannot leave these rows describing a game the route never sees. They carry no
// `home_team_id`: GAME_SELECT does not select it, so `isFavorite` and `cardName` take the embed.
//
// EVERY `in_progress` KICKOFF IS COMPUTED FROM Date.now(). A literal one turns `stale` eight hours
// later and the file goes red on a tree nobody touched (test/cardgeometry.test.mjs records the last
// time that happened).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { DAYS_AHEAD, overlayRows, myGamesAnswer } from '../lib/mygames.js';
import { cardMark, broadcastName } from '../lib/cardbroadcast.js';
import { hasMark } from '../lib/marks.js';
import { markUrl, teamLogoDarkUrl, ASSET_VERSION } from '../lib/config.js';
import { favoriteIds } from '../lib/favorites.js';
import { region } from './region.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const HOUR = 3600 * 1000;
const ago = (hours) => new Date(Date.now() - hours * HOUR).toISOString();

const TODAY = '2026-10-10';
const NEXT = '2026-10-11';
const END = '2026-10-17';
const ORIGIN = 'https://mysports.example';

// The shape of data/favorites.json, with ids in its own conventions. Not the real file: a bare JSON
// import fails under `node --test` (lib/favorites.js), and the route's read of it is pinned below.
const FAV = favoriteIds({ teams: { nfl: ['nfl-5'], mlb: ['mlb-114'], nba: ['nba-CLE'], nhl: ['nhl-29'] } });

/** One `teams` embed, every column GAME_SELECT asks for. */
const team = (id, o = {}) => ({
  id,
  canonical_name: o.canonical ?? id,
  short_name: o.short ?? null,
  display_name: o.display ?? null,
  abbreviation: o.abbr ?? null,
  primary_color: o.primary ?? null,
  secondary_color: o.secondary ?? null,
  conference: o.conference ?? null,
});

const BROWNS = team('nfl-5', { canonical: 'Cleveland Browns', short: 'Cleveland', display: 'Browns', abbr: 'CLE',
  primary: '#311D00', secondary: '#FF3C00', conference: { name: 'AFC North' } });
const STEELERS = team('nfl-23', { canonical: 'Pittsburgh Steelers', short: 'Pittsburgh', display: 'Steelers', abbr: 'PIT',
  primary: '#000000', secondary: '#FFB612' });
const GUARDIANS = team('mlb-114', { canonical: 'Guardians', short: 'Cleveland', display: 'Guardians', abbr: 'CLE',
  primary: '#00385D', secondary: '#E50022' });
const TIGERS = team('mlb-116', { canonical: 'Tigers', display: 'Tigers', abbr: 'DET', primary: '#0C2340', secondary: '#FA4616' });
const RAVENS = team('nfl-33', { canonical: 'Baltimore Ravens', display: 'Ravens', abbr: 'BAL', primary: '#241773', secondary: '#9E7C0C' });
const BENGALS = team('nfl-4', { canonical: 'Cincinnati Bengals', display: 'Bengals', abbr: 'CIN', primary: '#FB4F14', secondary: '#000000' });

/** One broadcast row, every column GAME_SELECT embeds (the builder test/cardbroadcast.test.mjs uses). */
const bc = (service_id, delivery_surface, o = {}) => ({
  label: o.label ?? null,
  active: o.active ?? true,
  network: o.network === null ? null : {
    id: service_id,
    type: o.type ?? (delivery_surface === 'STREAMING' ? 'streaming' : 'linear_cable'),
    canonical_name: o.name ?? service_id.toUpperCase(),
    default_sort_order: o.order ?? null,
  },
  feed_side: o.side ?? 'NATIONAL',
  is_primary: o.primary ?? false,
  service_id,
  access_status: o.access ?? 'available',
  delivery_surface,
  carriage_certainty: 'CONFIRMED',
});

/** One game row, every field GAME_SELECT returns. Defaults: a scheduled Browns home game at noon ET today. */
const game = (id, o = {}) => ({
  id,
  sport: o.sport ?? 'nfl',
  season: 2026,
  week: o.week ?? 6,
  game_date: o.day ?? TODAY,
  viewing_day: o.day ?? TODAY,
  canonical_kickoff_at_utc: o.at ?? `${o.day ?? TODAY}T16:00:00+00:00`,
  kickoff_status: o.kickoff ?? 'set',
  network_status: 'confirmed',
  canonical_state: 'scheduled',
  neutral_site: o.neutral ?? false,
  primary_network_id: null,
  home_score: o.homeScore ?? null,
  away_score: o.awayScore ?? null,
  result_status: o.status ?? 'scheduled',
  boxscore_url: null,
  completed_at: null,
  probable_home_pitcher: null,
  probable_away_pitcher: null,
  home_rank: null,
  away_rank: null,
  is_rivalry: false,
  rivalry: null,
  venue: o.venue === undefined ? { name: 'Huntington Bank Field', city: 'Cleveland', state: 'OH' } : o.venue,
  home: o.home === undefined ? BROWNS : o.home,
  away: o.away === undefined ? STEELERS : o.away,
  broadcasts: o.broadcasts ?? [bc('cbs', 'LINEAR', { name: 'CBS', type: 'linear_broadcast', primary: true })],
  odds: o.odds ?? [],
  eligibility: o.eligibility ?? [],
});

const answer = (rows, overlay = null) => myGamesAnswer({ today: TODAY, end: END, rows, favIds: FAV, overlay, origin: ORIGIN });
/** What the wire carries: the answer through JSON, so a value left `undefined` shows up as a missing key. */
const wire = (a) => JSON.parse(JSON.stringify(a));
const one = (row, overlay = null) => wire(answer([row], overlay)).games[0];

// --------------------------------------------------------------------- the fixtures are the query's shape
/** A PostgREST select list -> { name: nestedSpec | true }; `alias:table!fk(cols)` is named by its alias. */
function parseSelect(list) {
  const items = [];
  let depth = 0;
  let cur = '';
  for (const ch of list) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) { items.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) items.push(cur);
  const out = {};
  for (const item of items.map((s) => s.trim())) {
    const open = item.indexOf('(');
    const name = (open < 0 ? item : item.slice(0, open)).split(':')[0].split('!')[0];
    out[name] = open < 0 ? true : parseSelect(item.slice(open + 1, item.lastIndexOf(')')));
  }
  return out;
}

function assertShape(value, spec, where) {
  if (spec === true || value === null) return;   // a scalar, or an embed PostgREST returns as null
  for (const row of Array.isArray(value) ? value : [value]) {
    assert.deepEqual(Object.keys(row).sort(), Object.keys(spec).sort(), `${where}: keys`);
    for (const [k, s] of Object.entries(spec)) assertShape(row[k], s, `${where}.${k}`);
  }
}

test('the fixture rows carry exactly the fields GAME_SELECT returns, embeds included', () => {
  const select = parseSelect(
    [...src('lib/queries.js').match(/const GAME_SELECT = \[([\s\S]*?)\]\.join/)[1].matchAll(/^\s*'([^']+)',/gm)]
      .map((m) => m[1]).join(','));
  assert.ok(Object.keys(select).length >= 29, 'the select parsed');
  const g = game('nfl-1', { broadcasts: [bc('espn', 'LINEAR')], odds: [{ provider: 'x', spread: -3, total: 41.5,
    home_moneyline: -150, away_moneyline: 130, fetched_at: ago(1) }],
    eligibility: [{ eligible: true, reason: 'linear espn', eligible_via_network_id: 'espn',
      eligible_via_service_ids: [], market_pending: false }] });
  assertShape(g, select, g.id);
  assert.equal('home_team_id' in g, false, 'GAME_SELECT selects no team id column; the embed carries it');
});

// --------------------------------------------------------------------------------------- whose games
test("only favourites' games come back, home or away, and a game with no favourite side does not", () => {
  const rows = [
    game('nfl-home', { home: BROWNS, away: STEELERS }),
    game('nfl-away', { home: RAVENS, away: BROWNS, at: `${TODAY}T17:00:00+00:00` }),
    game('nfl-neither', { home: RAVENS, away: BENGALS, at: `${TODAY}T18:00:00+00:00` }),
  ];
  assert.deepEqual(answer(rows).games.map((g) => g.id), ['nfl-home', 'nfl-away']);
});

// ------------------------------------------------------------------------------------------ the order
test("the order is the page's: by viewing day, a TBD leads its day with no time, and a tie keeps the query's order", () => {
  // In the query's own order - kickoff ascending, then id (lib/queries.js ORDER). A TBD's placeholder
  // instant is midnight ET (pipeline/reconcile.py), which sorts it BEFORE a late game from the day
  // before that kicked off after midnight - so the viewing-day grouping is what puts the late game
  // back on its own day.
  const rows = [
    game('a-noon', { at: `${TODAY}T16:00:00+00:00` }),
    game('b-tie', { at: `${TODAY}T23:15:00+00:00`, home: GUARDIANS, away: TIGERS, sport: 'mlb' }),
    game('c-tie', { at: `${TODAY}T23:15:00+00:00` }),
    game('d-tbd', { day: NEXT, at: `${NEXT}T04:00:00+00:00`, kickoff: 'tbd' }),
    game('e-late', { at: `${NEXT}T05:30:00+00:00` }),
    game('f-noon', { day: NEXT, at: `${NEXT}T17:00:00+00:00` }),
  ];
  const out = answer(rows).games;
  assert.deepEqual(out.map((g) => g.id), ['a-noon', 'b-tie', 'c-tie', 'e-late', 'd-tbd', 'f-noon']);
  assert.deepEqual(out.map((g) => g.viewingDay), [TODAY, TODAY, TODAY, TODAY, NEXT, NEXT]);
  const tbd = out.find((g) => g.id === 'd-tbd');
  assert.equal(tbd.startsAt, null, 'the placeholder instant is never sent as a time');
  assert.equal(tbd.kickoffStatus, 'tbd');
  assert.equal(out.find((g) => g.id === 'f-noon').startsAt, `${NEXT}T17:00:00+00:00`, 'a set kickoff is the stored instant');
  // two games at one instant keep the order they arrived in, which is the query's id order: not re-sorted
  const swapped = [rows[0], rows[2], rows[1], ...rows.slice(3)];
  assert.deepEqual(answer(swapped).games.slice(0, 3).map((g) => g.id), ['a-noon', 'c-tie', 'b-tie']);
});

// -------------------------------------------------------------------------------- the overlay's rows
test("the overlay is handed only favourites' games on today, and none from a later day", () => {
  const rows = [
    game('fav-today'),
    game('other-today', { home: RAVENS, away: BENGALS, sport: 'nfl' }),
    game('fav-mlb-today', { sport: 'mlb', home: GUARDIANS, away: TIGERS, at: `${TODAY}T23:10:00+00:00` }),
    game('fav-tomorrow', { day: NEXT }),
    game('fav-later', { day: END }),
  ];
  assert.deepEqual(overlayRows(rows, FAV, TODAY).map((g) => g.id), ['fav-today', 'fav-mlb-today']);
  assert.deepEqual(overlayRows(rows, FAV, NEXT).map((g) => g.id), ['fav-tomorrow']);
  assert.deepEqual(overlayRows([], FAV, TODAY), []);
});

// --------------------------------------------------------------------------------------------- a team
test("a team is the card's name, the dark logo, and both colours as stored", () => {
  const g = one(game('nfl-1'));
  assert.deepEqual(g.home, { id: 'nfl-5', name: 'Browns', abbreviation: 'CLE', logoUrl: teamLogoDarkUrl('nfl-5'),
    primaryColor: '#311D00', secondaryColor: '#FF3C00', score: null });
  assert.match(g.home.logoUrl, /\/logos\/nfl-5_dark\.png\?v=/, 'the _dark file, versioned, already absolute');
  assert.match(g.home.logoUrl, /^https:\/\//);
  // the card's fallback chain: display_name, then short_name, then the canonical name
  const plain = one(game('nfl-2', { away: team('nfl-23', { canonical: 'Pittsburgh Steelers', short: 'Pittsburgh' }) }));
  assert.equal(plain.away.name, 'Pittsburgh');
  assert.equal(plain.away.primaryColor, null, 'a colour not stored is null, never a fallback ink');
});

test('a placeholder team has no logo address, and the real club beside it keeps its own', () => {
  // the two placeholder forms TeamMark badges: MLB's postseason name and a `-TBD` id (lib/placeholders.js)
  const wildCard = team('mlb-4944', { canonical: 'AL Wild Card #2' });
  const g = one(game('mlb-1', { sport: 'mlb', home: GUARDIANS, away: wildCard }));
  assert.equal(g.away.logoUrl, null);
  assert.equal(g.away.name, 'AL Wild Card #2');
  assert.equal(g.home.logoUrl, teamLogoDarkUrl('mlb-114'));
  const tbd = one(game('nfl-3', { away: team('nfl-TBD', { canonical: 'TBD' }) }));
  assert.equal(tbd.away.logoUrl, null);
  // the MLB name form is placeholder only in MLB, as the card decides it with the game's own sport
  const named = one(game('nfl-4', { away: team('nfl-99', { canonical: 'AL Wild Card #2' }) }));
  assert.equal(named.away.logoUrl, teamLogoDarkUrl('nfl-99'));
});

// ---------------------------------------------------------------------------------------- a broadcast
test('a pick with a mark gives an absolute markUrl on the origin passed in, with its ?v=', () => {
  assert.ok(hasMark('espn'));
  const g = one(game('nfl-1', { broadcasts: [bc('espn', 'LINEAR', { name: 'ESPN', primary: true })] }));
  assert.deepEqual(g.broadcast, { name: 'ESPN', markUrl: `${ORIGIN}/marks/espn.png?v=${ASSET_VERSION}` });
  assert.equal(g.broadcast.markUrl, new URL(markUrl('espn'), ORIGIN).href, 'markUrl(), made absolute and nothing else');
  const other = wire(myGamesAnswer({ today: TODAY, end: END, rows: [game('nfl-1', { broadcasts: [bc('espn', 'LINEAR')] })],
    favIds: FAV, origin: 'https://my-sports-xi.vercel.app' })).games[0];
  assert.equal(other.broadcast.markUrl, `https://my-sports-xi.vercel.app/marks/espn.png?v=${ASSET_VERSION}`);
});

test('a pick with no mark gives its name and a null markUrl', () => {
  assert.equal(hasMark('cbjnhl'), false);
  const g = one(game('nhl-1', { sport: 'nhl', home: team('nhl-29', { display: 'Blue Jackets' }), away: team('nhl-7'),
    broadcasts: [bc('cbjnhl', 'LINEAR', { name: 'CBJNHL', label: 'CBJNHL', primary: true, access: 'unknown' })] }));
  assert.deepEqual(g.broadcast, { name: 'CBJNHL', markUrl: null });
  // the panel's words for a row: the network's name, then the row's label, then the service id
  assert.equal(broadcastName(bc('x-feed', 'LINEAR', { network: null, label: 'Team feed' })), 'Team feed');
  assert.equal(broadcastName(bc('x-feed', 'LINEAR', { network: null })), 'x-feed');
});

test('a game with no active broadcast row has a null broadcast', () => {
  assert.equal(one(game('nfl-1', { broadcasts: [] })).broadcast, null);
  assert.equal(one(game('nfl-2', { broadcasts: [bc('espn', 'LINEAR', { active: false })] })).broadcast, null);
});

test("a Cavaliers simulcast gives the composite the card wears, and no name", () => {
  // the WOIO-only state: DAZN plus CBS collapses to `cbs-dazn` (lib/marks.js cardMarkSlug)
  const g = game('nba-1', { sport: 'nba', home: team('nba-CLE', { display: 'Cavaliers' }), away: team('nba-TOR'),
    broadcasts: [bc('dazn', 'STREAMING', { name: 'DAZN', label: 'Cavaliers on DAZN (RESN)', primary: true, side: 'HOME' }),
      bc('cbs', 'LINEAR', { name: 'CBS', type: 'linear_broadcast' })] });
  const out = one(g);
  assert.equal(out.broadcast.name, null, 'one outlet of several - its name beside the composite would be wrong');
  assert.equal(out.broadcast.markUrl, new URL(markUrl('cbs-dazn'), ORIGIN).href);
  assert.equal(out.broadcast.markUrl, new URL(cardMark(g).url, ORIGIN).href, 'exactly the mark the card wears');
  assert.notEqual(out.broadcast.markUrl, new URL(markUrl('dazn'), ORIGIN).href, 'not the pick\'s own mark');
});

// -------------------------------------------------------------------------------------------- the state
test('a scheduled game: no score, no clock, and the card\'s dash - a priced one too, since odds are not carried', () => {
  const g = one(game('nfl-1'));
  assert.equal(g.status, 'scheduled');
  assert.deepEqual(g.card, { kind: 'none', label: '—' });
  assert.deepEqual([g.home.score, g.away.score, g.clock, g.period], [null, null, null, null]);
  assert.equal(g.startsAt, `${TODAY}T16:00:00+00:00`);
  const priced = one(game('nfl-2', { odds: [{ provider: 'x', spread: -3, total: 41.5, home_moneyline: -150,
    away_moneyline: 130, fetched_at: ago(1) }] }));
  assert.deepEqual(priced.card, { kind: 'none', label: '—' }, 'the card draws a line here; the address does not');
  assert.equal(JSON.stringify(priced).includes('moneyline'), false);
});

test('in progress with a clock from the overlay: the overlay\'s status, scores, clock and period', () => {
  const row = game('nfl-401', { at: ago(1) });
  const overlay = { map: new Map([['nfl-401', { gameId: 'nfl-401', status: 'in_progress', homeScore: 14, awayScore: 7,
    clock: '7:12', period: 2 }]]), fetchedAt: '2026-10-10T17:05:00.000Z', sports: ['nfl'], stats: {} };
  const a = wire(answer([row], overlay));
  assert.equal(a.fetchedAt, '2026-10-10T17:05:00.000Z', 'when the live scores were read, as the overlay says');
  const g = a.games[0];
  assert.equal(g.status, 'in_progress');
  assert.deepEqual(g.card, { kind: 'score', label: 'Q2 7:12' });
  assert.deepEqual([g.home.score, g.away.score], [14, 7]);
  assert.equal(g.clock, '7:12');
  assert.equal(g.period, 2);
  // baseball: the clock is the inning half, a string, and the label is the card's
  const mlb = game('mlb-777', { sport: 'mlb', home: GUARDIANS, away: TIGERS, at: ago(2) });
  const inning = { map: new Map([['mlb-777', { gameId: 'mlb-777', status: 'in_progress', homeScore: 3, awayScore: 2,
    clock: 'Bottom', period: 4 }]]), fetchedAt: ago(0), sports: ['mlb'], stats: {} };
  const m = one(mlb, inning);
  assert.deepEqual([m.clock, m.period, m.card.label], ['Bottom', 4, 'B4']);
});

test('in progress with numbers and no overlay reads Live with its score; without numbers, Live alone', () => {
  const scored = one(game('nfl-1', { status: 'in_progress', at: ago(1), homeScore: 3, awayScore: 0 }));
  assert.deepEqual(scored.card, { kind: 'score', label: 'Live' });
  assert.deepEqual([scored.home.score, scored.away.score], [3, 0]);
  assert.equal(scored.clock, null);
  const bare = one(game('nfl-2', { status: 'in_progress', at: ago(1) }));
  assert.deepEqual(bare.card, { kind: 'live', label: 'Live' });
  assert.deepEqual([bare.home.score, bare.away.score], [null, null]);
});

test('a final carries both scores; a postponed game carries none', () => {
  const fin = one(game('nfl-1', { status: 'final', homeScore: 24, awayScore: 17 }));
  assert.deepEqual(fin.card, { kind: 'score', label: 'Final' });
  assert.deepEqual([fin.home.score, fin.away.score], [24, 17]);
  const pp = one(game('mlb-2', { sport: 'mlb', home: GUARDIANS, away: TIGERS, status: 'postponed' }));
  assert.deepEqual(pp.card, { kind: 'exception', label: 'Postponed' });
  assert.deepEqual([pp.home.score, pp.away.score], [null, null]);
});

test('a live row more than eight hours past kickoff reads Final pending, stale, and carries no score', () => {
  // the card suppresses a stale row's score on purpose (lib/format.js), and a reader must not have to
  // hold that rule: the stored numbers are a mid-game snapshot
  const g = one(game('mlb-3', { sport: 'mlb', home: GUARDIANS, away: TIGERS, status: 'in_progress', at: ago(9),
    homeScore: 9, awayScore: 1 }));
  assert.deepEqual(g.card, { kind: 'stale', label: 'Final pending' });
  assert.deepEqual([g.home.score, g.away.score], [null, null]);
  assert.equal(g.status, 'in_progress', 'the status is the row\'s; the card\'s verdict is in `card`');
});

// -------------------------------------------------------------------------------------------- the venue
test('the venue is the stored name, city and state, and a game with none has null', () => {
  assert.deepEqual(one(game('nfl-1')).venue, { name: 'Huntington Bank Field', city: 'Cleveland', state: 'OH' });
  assert.equal(one(game('nfl-2', { venue: null })).venue, null);
  assert.equal(one(game('nfl-3', { neutral: true })).neutralSite, true);
});

// ------------------------------------------------------------------------------------------ the contract
const TOP = ['today', 'start', 'end', 'fetchedAt', 'games'];
const GAME = ['id', 'sport', 'viewingDay', 'startsAt', 'kickoffStatus', 'status', 'clock', 'period', 'card',
  'neutralSite', 'home', 'away', 'venue', 'broadcast'];
const TEAM = ['id', 'name', 'abbreviation', 'logoUrl', 'primaryColor', 'secondaryColor', 'score'];

test('the contract: the exact keys at every level, present even when their values are null', () => {
  const full = wire(answer([game('nfl-1', { broadcasts: [bc('espn', 'LINEAR')] })]));
  assert.deepEqual(Object.keys(full), TOP, 'and in this order');
  assert.equal(full.start, TODAY);
  assert.equal(full.today, TODAY);
  assert.equal(full.end, END);
  assert.equal(full.fetchedAt, null, 'no overlay, no live read');
  const g = full.games[0];
  assert.deepEqual(Object.keys(g), GAME);
  assert.deepEqual(Object.keys(g.home), TEAM);
  assert.deepEqual(Object.keys(g.away), TEAM);
  assert.deepEqual(Object.keys(g.card), ['kind', 'label']);
  assert.deepEqual(Object.keys(g.venue), ['name', 'city', 'state']);
  assert.deepEqual(Object.keys(g.broadcast), ['name', 'markUrl']);
  // the sparsest row the query can return: no venue, no broadcast, a team embed with nothing in it
  const bare = wire(answer([game('nfl-2', { venue: null, broadcasts: [], home: team('nfl-5'), away: null })])).games[0];
  assert.deepEqual(Object.keys(bare), GAME);
  assert.deepEqual(Object.keys(bare.home), TEAM);
  assert.deepEqual(Object.keys(bare.away), TEAM);
  assert.deepEqual(bare.away, { id: null, name: 'TBD', abbreviation: null, logoUrl: null, primaryColor: null,
    secondaryColor: null, score: null });
  assert.equal(DAYS_AHEAD, 7, 'the current viewing day and the seven after it');
});

test("the failed read's answer: the five keys, no games, and the reason cut to 200 characters", () => {
  const failed = wire(myGamesAnswer({ today: TODAY, end: END, rows: [], favIds: FAV, origin: ORIGIN,
    error: new Error(`503 - ${'x'.repeat(400)}`) }));
  assert.deepEqual(Object.keys(failed), [...TOP, 'error']);
  assert.deepEqual(failed.games, []);
  assert.equal(failed.fetchedAt, null);
  assert.equal(failed.error.length, 200);
  assert.ok(failed.error.startsWith('503 - '));
  assert.equal(wire(myGamesAnswer({ today: TODAY, end: END, rows: [], favIds: FAV, origin: ORIGIN, error: 'down' })).error, 'down');
  assert.equal('error' in wire(answer([])), false, 'error is there only when the read failed');
});

// --------------------------------------------------------------------------------- wiring, as source text
test('the route reads no query string, takes the viewing day, makes one read, and sends no-store', () => {
  const r = code('app/api/my-games/route.js');
  assert.doesNotMatch(r, /searchParams|request\.json|request\.body/, 'it takes no parameter');
  assert.match(r, /const today = viewingDayOf\(new Date\(\)\);/, 'the app\'s 3 AM rule');
  assert.doesNotMatch(r, /todayET/, 'not the page\'s calendar date');
  assert.match(r, /const end = addDays\(today, DAYS_AHEAD\);/);
  assert.match(r, /rows = await gamesForRange\(today, end\);/, 'every sport: no third argument');
  assert.equal((r.match(/gamesForRange\(/g) || []).length, 1, 'one read');
  assert.match(r, /overlayForDay\(today, overlayRows\(rows, favIds, today\), \{ today \}\)/,
    'the overlay is handed today\'s favourites, not the range');
  assert.match(r, /'Cache-Control': 'no-store'/);
  assert.equal((r.match(/headers: NO_STORE/g) || []).length, 2, 'on the answer and on the failed read');
  assert.doesNotMatch(r, /Access-Control/, 'no CORS header');
  assert.match(r, /export const dynamic = 'force-dynamic';/);
  assert.match(r, /export const runtime = 'nodejs';/);
  assert.match(r, /import favoritesDoc from '\.\.\/\.\.\/\.\.\/\.\.\/data\/favorites\.json';/, 'as app/qa/tbd/page.js imports it');
  // no PostgREST call outside lib/queries.js, which is the one file the cap guard walks
  for (const f of ['app/api/my-games/route.js', 'lib/mygames.js']) {
    assert.doesNotMatch(code(f), /\brest(All)?\(/, `${f} makes no rest() call of its own`);
  }
});

test('the card and the address take the mark and the name from the same place, and hold no copy', () => {
  const card = code('components/MatchupCard.js');
  const lib = code('lib/mygames.js');
  assert.match(card, /import \{ cardBroadcast, cardMark \} from '\.\.\/lib\/cardbroadcast\.js';/);
  assert.match(lib, /import \{ cardMark, broadcastName \} from '\.\/cardbroadcast\.js';/);
  assert.match(card, /import \{ cardName \} from '\.\.\/lib\/cardname\.js';/);
  assert.match(lib, /import \{ cardName \} from '\.\/cardname\.js';/);
  assert.match(card, /export \{ cardName \};/, 'GameDetail and MobileGrid still import it from the card');
  assert.match(card, /const mark = cardMark\(game\)\.url;/);
  assert.doesNotMatch(card, /function cardName|cardMarkSlug|showsMark|markUrl\(/, 'no second copy in the component');
  assert.doesNotMatch(lib, /cardMarkSlug|showsMark|markUrl\(|display_name|canonical_name/,
    'no second copy of the mark or either name in the address');
  assert.match(lib, /slotContent\(g\)/, 'the right slot is the card\'s own verdict, with no favourite passed');
});

test("the broadcast's name is one expression, and the panel and the grid rail still read the same as it", () => {
  // broadcastName() is the words GameDetail prints for a row (the watch link and the list) and the
  // grid rail prints for a lane. Neither component imports it, so each copy is held to it here: a
  // change to either, or to the definition, goes red.
  const fn = region(code('lib/cardbroadcast.js'), 'export function broadcastName(b) {', '}', 'broadcastName');
  const expr = fn.match(/return (.+);/)[1];
  assert.equal(expr, 'b.network?.canonical_name || b.label || b.service_id');
  const detail = code('components/GameDetail.js');
  assert.ok(detail.includes(`name={${expr}}`), 'GameDetail: the watch link');
  assert.ok(detail.includes(`<span>{${expr}}</span>`), 'GameDetail: the where-to-watch list');
  const grid = code('components/MobileGrid.js');
  assert.ok(grid.includes('const id = it.broadcast.service_id;'), 'MobileGrid: the lane id is the service id');
  const rail = expr.replace(/\bb\.service_id\b/g, 'id').replace(/\bb\./g, 'it.broadcast.');
  assert.ok(grid.includes(`name: ${rail},`), `MobileGrid: the rail reads ${rail}`);
});
