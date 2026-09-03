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
