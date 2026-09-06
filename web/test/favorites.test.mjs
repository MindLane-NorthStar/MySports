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

import { favoriteIds, isFavorite, splitFavorites } from '../lib/favorites.js';

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
