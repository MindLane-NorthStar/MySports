// D6: favourites float to the top of their band.
//
// The resolution itself is frozen in data/favorites.json - these tests assert the FILE (that the
// thirteen teams are there as ids, and that the four resolution traps did not bite) and the float
// behaviour (that promotion never becomes a re-sort).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { favoriteIds, isFavorite, splitFavorites, chronological } from '../lib/favorites.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const doc = JSON.parse(readFileSync(join(HERE, '..', '..', 'data', 'favorites.json'), 'utf8'));
const ids = favoriteIds(doc);

test('all thirteen teams are present, as ids', () => {
  assert.equal(ids.size, 13);
  for (const id of ids) assert.equal(typeof id, 'string');
});

test('each sport holds the expected count', () => {
  assert.equal(doc.teams.nfl.length, 2);
  assert.equal(doc.teams.mlb.length, 1);
  assert.equal(doc.teams.nba.length, 1);
  assert.equal(doc.teams.nhl.length, 3);
  assert.equal(doc.teams.cfb.length, 6);
});

test('TRAP: Ohio is the Bobcats and is a DIFFERENT row from Ohio State', () => {
  assert.ok(ids.has('195'), 'Ohio (MAC)');
  assert.ok(ids.has('194'), 'Ohio State');
  assert.notEqual('195', '194');
  assert.equal(doc._names['195'], 'Ohio');
  assert.equal(doc._names['194'], 'Ohio State');
});

test('TRAP: Panthers is the CAROLINA Panthers, not the Florida Panthers', () => {
  assert.ok(doc.teams.nfl.includes('nfl-29'));
  assert.equal(doc._names['nfl-29'], 'Carolina Panthers');
  // Resolved within nfl, so no nhl row can be selected at all.
  for (const id of doc.teams.nhl) assert.doesNotMatch(doc._names[id], /Panthers/);
});

test('TRAP: Ole Miss is not Mississippi State', () => {
  assert.ok(ids.has('145'));
  assert.equal(doc._names['145'], 'Ole Miss');
  assert.ok(!ids.has('344'), 'Mississippi State must not be selected');
});

test('TRAP: Tennessee is the Volunteers, not State/Tech/Middle', () => {
  assert.ok(ids.has('2633'));
  assert.equal(doc._names['2633'], 'Tennessee');
});

test('MLB resolved on the nickname, which is how that sport names teams', () => {
  assert.ok(doc.teams.mlb.includes('mlb-114'));
  assert.equal(doc._names['mlb-114'], 'Guardians');
});

test('a game is a favourite when either side is one', () => {
  assert.equal(isFavorite({ home_team_id: 'nfl-5', away_team_id: 'nfl-1' }, ids), true);
  assert.equal(isFavorite({ home_team_id: 'nfl-1', away_team_id: 'nfl-5' }, ids), true);
  assert.equal(isFavorite({ home_team_id: 'nfl-1', away_team_id: 'nfl-2' }, ids), false);
  assert.equal(isFavorite({ home: { id: '194' }, away: { id: '1' } }, ids), true, 'fixture shape too');
});

test('the float PRESERVES chronological order inside both groups', () => {
  // This is the property that keeps the day reading as a timeline. It is a promotion, not a re-sort.
  const g = (id, home) => ({ id, home_team_id: home, away_team_id: 'zzz' });
  const games = [g('1', 'x'), g('2', 'nfl-5'), g('3', 'y'), g('4', '194'), g('5', 'z')];
  const { favorites, rest } = splitFavorites(games, ids);
  assert.deepEqual(favorites.map((x) => x.id), ['2', '4']);
  assert.deepEqual(rest.map((x) => x.id), ['1', '3', '5']);
});

test('no favourites on the day means no split and no label', () => {
  const games = [{ id: '1', home_team_id: 'x', away_team_id: 'y' }];
  const { favorites, rest } = splitFavorites(games, ids);
  assert.equal(favorites.length, 0);
  assert.deepEqual(rest, games);
});

test('an empty favourites list leaves the listing untouched', () => {
  const games = [{ id: '1', home_team_id: 'nfl-5' }];
  const { favorites, rest } = splitFavorites(games, new Set());
  assert.equal(favorites.length, 0);
  assert.deepEqual(rest, games);
});

test('the file documents that these are TEAM ids, not game ids', () => {
  assert.match(doc._about, /TEAM ids/);
  assert.match(doc._resolved, /EXACT match/);
});

// ---------------------------------------------------------------- prompt 51 stage 4b: the scope
//
// MY TEAMS is the thirteen clubs AND the five team-less sports (Joe's ruling, register §18d). These
// pin the rule with FIXTURES rather than a DOM, because the failure mode is a silent one: a scope
// that quietly drops 196 rows looks exactly like a quiet day.

import { isMine, splitMine, TEAMLESS_SPORTS } from '../lib/favorites.js';

const FAVS = new Set(['cle', 'osu']);
const teamGame = (id, sport, home, away) => ({ id, sport, home_team_id: home, away_team_id: away });
const program = (id, sport, program_type = 'race_session') => ({ id, sport, program_type, title: id });

test('a favourite team\'s game qualifies, on either side', () => {
  assert.equal(isMine(teamGame('1', 'nfl', 'cle', 'pit'), FAVS), true, 'home');
  assert.equal(isMine(teamGame('2', 'cfb', 'mich', 'osu'), FAVS), true, 'away');
});

test('a non-favourite team\'s game does NOT qualify', () => {
  assert.equal(isMine(teamGame('3', 'nfl', 'pit', 'bal'), FAVS), false);
  assert.equal(isMine(teamGame('4', 'mlb', 'nyy', 'bos'), FAVS), false);
});

test('a NASCAR race qualifies with no team on it at all', () => {
  // This is the whole point: favoriteIds() matches team ids and a race has none, so before the
  // sport rule `scope=mine` showed zero of the 98 loaded races.
  assert.equal(isMine(program('r1', 'nascar'), FAVS), true);
  assert.equal(isMine(program('r1', 'nascar'), new Set()), true, 'even with no favourites at all');
});

test('all five team-less sports qualify, and only those five', () => {
  assert.deepEqual(TEAMLESS_SPORTS, ['nascar', 'indycar', 'ufc', 'wwe', 'aew']);
  for (const s of TEAMLESS_SPORTS) {
    assert.equal(isMine(program(`p-${s}`, s), new Set()), true, `${s} must qualify`);
  }
  for (const s of ['nfl', 'cfb', 'mlb', 'nba', 'nhl']) {
    assert.equal(isMine(program(`p-${s}`, s), new Set()), false, `${s} must NOT qualify by sport`);
  }
});

test('a STUDIO SHOW does not qualify - it carries the sport it bookends', () => {
  // Measured against the live database: studio shows carry sport `nfl` (80) or `cfb` (31), never a
  // sport of their own. So they are excluded BY CONSTRUCTION rather than by a special case - which
  // is also why the exclusion is right: a GameDay instance is a pregame show attached to a sport
  // that does have teams, not a thing to follow in its own right.
  assert.equal(isMine(program('gameday', 'cfb', 'studio_show'), new Set()), false);
  assert.equal(isMine(program('fnia', 'nfl', 'studio_show'), new Set()), false);
  // ...unless one of its teams is a favourite, which a studio show never carries anyway
  assert.equal(isMine({ id: 'x', sport: 'cfb', program_type: 'studio_show' }, FAVS), false);
});

test('a row with a null or missing sport does not crash and does not qualify', () => {
  assert.equal(isMine({ id: 'n1', sport: null }, FAVS), false);
  assert.equal(isMine({ id: 'n2' }, FAVS), false);
  assert.equal(isMine({}, FAVS), false);
  assert.equal(isMine(null, FAVS), false);
  assert.equal(isMine(undefined, new Set()), false);
});

test('splitMine keeps input order, so the scope stays chronological', () => {
  const day = [
    teamGame('1', 'nfl', 'cle', 'pit'),   // favourite
    teamGame('2', 'mlb', 'nyy', 'bos'),   // not
    program('3', 'nascar'),               // team-less sport
    teamGame('4', 'cfb', 'osu', 'mich'),  // favourite
    program('5', 'cfb', 'studio_show'),   // studio show - excluded
    program('6', 'aew', 'weekly_show'),   // team-less sport
  ];
  const { mine, rest } = splitMine(day, FAVS);
  assert.deepEqual(mine.map((g) => g.id), ['1', '3', '4', '6'], 'order preserved');
  assert.deepEqual(rest.map((g) => g.id), ['2', '5']);
  assert.equal(mine.length + rest.length, day.length, 'nothing dropped');
});

test('splitMine is a SUBSET of the day, never an invention', () => {
  const day = [teamGame('a', 'nfl', 'x', 'y'), program('b', 'wwe', 'weekly_show')];
  const { mine } = splitMine(day, new Set());
  for (const g of mine) assert.ok(day.includes(g), 'every scoped row came from the day');
});

// ---------------------------------------------------------------------------------------------
// R2, prompt 56: THE MY TEAMS SCOPE LINE, and the coverage that keeps it honest.
//
// The line's whole job is to stop MY TEAMS from silently under-describing itself. If a sixth
// team-less sport is ever added to TEAMLESS_SPORTS and not placed in a category, the line would go
// on saying "RACING + COMBAT SPORTS" over a scope that also contained something else - which is
// exactly the failure the line exists to fix. That is what the first test below refuses to allow.

import { TEAMLESS_CATEGORIES, scopeLine } from '../lib/favorites.js';

test('R2: the two category words cover TEAMLESS_SPORTS exactly - no gap, no invention', () => {
  const covered = Object.values(TEAMLESS_CATEGORIES).flat();
  assert.deepEqual([...covered].sort(), [...TEAMLESS_SPORTS].sort(),
    'every team-less sport falls into exactly one category, and no category names a sport that is ' +
    'not in the scope');
  assert.equal(covered.length, new Set(covered).size, 'no sport is in two categories');
  // `racing` is the app's OWN filter token for those two, not new vocabulary invented for the line.
  assert.deepEqual(TEAMLESS_CATEGORIES.racing, ['nascar', 'indycar']);
});

test('R2: `combat sports` is a display label and must never become a filter token', async () => {
  const { SPORT_FILTERS, SPORTS, expandSport } = await import('../lib/config.js');
  for (const label of Object.keys(TEAMLESS_CATEGORIES)) {
    if (label === 'racing') continue;                 // racing IS a token, deliberately
    assert.ok(!SPORT_FILTERS.includes(label), `${label} must not be a chip token`);
    assert.ok(!SPORTS.includes(label), `${label} must not be a sport value`);
    assert.deepEqual(expandSport(label), [], `${label} must not resolve to any query`);
  }
});

test('R2: the line is Joe\u2019s wording, and its club count is derived', () => {
  assert.equal(scopeLine(ids.size), 'MY TEAMS \u00b7 13 CLUBS + RACING + COMBAT SPORTS');
  // Derived, never written down: the day Joe adds a team the line follows on its own.
  assert.equal(scopeLine(14), 'MY TEAMS \u00b7 14 CLUBS + RACING + COMBAT SPORTS');
  assert.equal(scopeLine(1), 'MY TEAMS \u00b7 1 CLUB + RACING + COMBAT SPORTS', 'singular');
  assert.equal(scopeLine(0), 'MY TEAMS \u00b7 0 CLUBS + RACING + COMBAT SPORTS');
});

// ------------------------------------------- pregame shows sort before their game (prompt 71 s3)
//
// Joe, 2026-09-08: "please have all pregame shows render in their respective sport at the time they
// air. In that window - if the pregame show airs the same time as a game starts, the pregame show is
// listed first."
//
// Prompt 60 recorded this as open in app/page.js rather than fixing it in passing, and was right to;
// Joe has now answered the question. `allRows` is `[...games, ...programRows]`, two separately
// ordered reads concatenated, so ALL GAMES rendered a band's games and then its studio shows.

test('at an equal start time a studio show sorts BEFORE the game', () => {
  const game = { id: 'game', canonical_kickoff_at_utc: '2026-09-12T17:00:00Z' };
  const show = { id: 'show', program_id: 'p1', start_at: '2026-09-12T17:00:00Z' };
  // BOTH INPUT ORDERS, because a stable sort would otherwise let the database decide it - and decide
  // it differently on different days, which is what made this look intermittent.
  assert.deepEqual(chronological([game, show]).map((r) => r.id), ['show', 'game']);
  assert.deepEqual(chronological([show, game]).map((r) => r.id), ['show', 'game']);
});

test('the tie-break NEVER outranks the clock', () => {
  // A show at 4pm does not jump a game at 1pm. The tie-break applies only at an equal instant.
  const rows = [
    { id: 'game-1pm', canonical_kickoff_at_utc: '2026-09-12T17:00:00Z' },
    { id: 'game-4pm', canonical_kickoff_at_utc: '2026-09-12T20:00:00Z' },
    { id: 'show-12pm', program_id: 'p', start_at: '2026-09-12T16:00:00Z' },
    { id: 'show-4pm', program_id: 'p', start_at: '2026-09-12T20:00:00Z' },
  ];
  assert.deepEqual(chronological(rows).map((r) => r.id),
                   ['show-12pm', 'game-1pm', 'show-4pm', 'game-4pm']);
});

test('two shows at one instant keep database order - the tie-break is show-vs-game only', () => {
  const a = { id: 'a', program_id: 'p', start_at: '2026-09-12T17:00:00Z' };
  const b = { id: 'b', program_id: 'p', start_at: '2026-09-12T17:00:00Z' };
  assert.deepEqual(chronological([a, b]).map((r) => r.id), ['a', 'b']);
  assert.deepEqual(chronological([b, a]).map((r) => r.id), ['b', 'a']);
});

test('a TBD still sorts last, show or not', () => {
  const rows = [
    { id: 'tbd-show', program_id: 'p' },
    { id: 'game', canonical_kickoff_at_utc: '2026-09-12T17:00:00Z' },
  ];
  assert.deepEqual(chronological(rows).map((r) => r.id), ['game', 'tbd-show']);
});

test('ALL GAMES goes through the same sort - not a second one', () => {
  const page = readFileSync(new URL('../app/page.js', import.meta.url), 'utf8');
  assert.match(page, /const scoped = chronological\(P\.isMine \? splitMine\(allRows, favIds\)\.mine : allRows\)/);
  // and the comment recording it as an open question is gone with the question
  assert.doesNotMatch(page, /ALL GAMES IS UNTOUCHED, deliberately/);
});
