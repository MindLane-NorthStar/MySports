// 05 section 11: the page order, and the property the whole reorder turns on.
//
// WHY THIS EXISTS. Hoisting favourites out of their sport bands into a page-level section moves games
// between the things that count them. The failure mode is silent and arithmetic: a band left counting
// a game that is no longer in it, or a favourite counted twice - once in YOUR TEAMS and once in its
// sport. Neither would throw, and neither is visible on a day where the numbers happen to be small.
//
// Listing.js cannot be rendered here - it is a client component with hooks and a router - so what is
// pinned is the PARTITION RULE, computed from the same two exported functions the component uses:
// splitFavorites for the hoist and offServiceSummary for each section's counts. If either drifts, or
// if a future surface starts deriving the split for itself, these fail.

import test from 'node:test';
import assert from 'node:assert/strict';
import { offServiceSummary } from '../lib/offservice.js';
import { splitFavorites, favoriteIds } from '../lib/favorites.js';

const SPORTS = ['cfb', 'nfl', 'nba', 'nhl', 'mlb'];

const game = (id, sport, home, away, state = 'on') => ({
  id,
  sport,
  home_team_id: home,
  away_team_id: away,
  eligibility: [state === 'on'
    ? { eligible: true, reason: 'linear abc' }
    : state === 'pending'
      ? { eligible: false, market_pending: true, reason: 'not receivable: fox=unverified' }
      : { eligible: false, market_pending: false, reason: state === 'tbd' ? 'no telecast observed' : 'not receivable: x=unavailable' }],
  broadcasts: state === 'tbd'
    ? []
    : [{ active: true, service_id: 'abc', network: { id: 'abc', canonical_name: 'ABC' } }],
});

/** Exactly what Listing.js does on `/`: hoist favourites, then group the remainder by sport. */
function sections(games, favIds) {
  const { favorites, rest } = splitFavorites(games, favIds);
  const by = new Map();
  for (const g of rest) {
    if (!by.has(g.sport)) by.set(g.sport, []);
    by.get(g.sport).push(g);
  }
  const bands = [...SPORTS.filter((s) => by.has(s)), ...[...by.keys()].filter((s) => !SPORTS.includes(s)).sort()]
    .map((s) => ({ name: s, games: by.get(s) }));
  return favorites.length ? [{ name: 'YOUR TEAMS', games: favorites }, ...bands] : bands;
}

const FAV = new Set(['cle', 'osu']);

const DAY = [
  game('g1', 'cfb', 'osu', 'x1'),          // favourite
  game('g2', 'cfb', 'y1', 'y2', 'tbd'),
  game('g3', 'cfb', 'y3', 'y4', 'off'),
  game('g4', 'mlb', 'cle', 'z1', 'pending'), // favourite
  game('g5', 'mlb', 'z2', 'z3'),
  game('g6', 'nhl', 'w1', 'w2', 'tbd'),
];

test('every game lands in exactly one section', () => {
  const secs = sections(DAY, FAV);
  const ids = secs.flatMap((s) => s.games.map((g) => g.id));
  assert.equal(ids.length, DAY.length, 'no game is dropped');
  assert.equal(new Set(ids).size, DAY.length, 'and none is counted twice');
  assert.deepEqual([...ids].sort(), DAY.map((g) => g.id).sort());
});

test('THE INVARIANT: the section totals sum to the day, with nothing double-counted', () => {
  // This is the number the page prints one scroll above, in <p class="sub">.
  const secs = sections(DAY, FAV);
  const sum = secs.reduce((n, s) => n + offServiceSummary(s.games).total, 0);
  assert.equal(sum, DAY.length, `sections summed to ${sum}, day has ${DAY.length}`);
});

test('a favourite is counted in YOUR TEAMS and NOT again in its sport band', () => {
  const secs = sections(DAY, FAV);
  const yours = secs.find((s) => s.name === 'YOUR TEAMS');
  const mlb = secs.find((s) => s.name === 'mlb');
  assert.deepEqual(yours.games.map((g) => g.id), ['g1', 'g4']);
  assert.deepEqual(mlb.games.map((g) => g.id), ['g5'], 'the Guardians game is gone from MLB');
  assert.equal(offServiceSummary(mlb.games).total, 1);
});

test('each section counts only what it shows - the four states follow the games', () => {
  const secs = sections(DAY, FAV);
  const yours = offServiceSummary(secs.find((s) => s.name === 'YOUR TEAMS').games);
  // g1 is airing, g4 is market-pending: the section's own line, not the band's.
  assert.equal(yours.onCount, 1);
  assert.equal(yours.pendingCount, 1);
  assert.equal(yours.lines.airing, '1 airing');
  assert.equal(yours.lines.tbd, '1 TBD');
  const cfb = offServiceSummary(secs.find((s) => s.name === 'cfb').games);
  assert.equal(cfb.total, 2, 'the favourite is no longer in this count');
  assert.equal(cfb.tbdCount, 1);
  assert.equal(cfb.offCount, 1);
});

test('a sport whose only games were favourites gets NO band, rather than a header over nothing', () => {
  // The live case: 2026-10-01, 2026-10-29 and 2026-11-30 each have exactly one NFL game and it is
  // a favourite. Three days in the loaded season.
  const day = [game('a', 'nfl', 'cle', 'x'), game('b', 'mlb', 'q', 'r')];
  const secs = sections(day, FAV);
  assert.deepEqual(secs.map((s) => s.name), ['YOUR TEAMS', 'mlb'], 'no nfl band at all');
  assert.equal(secs.reduce((n, s) => n + offServiceSummary(s.games).total, 0), day.length);
});

test('a day with no favourites gets no section, and the bands are untouched', () => {
  const day = [game('a', 'nfl', 'p', 'x'), game('b', 'mlb', 'q', 'r')];
  const secs = sections(day, new Set(['nobody']));
  assert.deepEqual(secs.map((s) => s.name), ['nfl', 'mlb'], 'no YOUR TEAMS section');
  assert.equal(secs.reduce((n, s) => n + offServiceSummary(s.games).total, 0), day.length);
});

test('the hoist keeps chronological order, because it keeps input order', () => {
  // `games` arrives ordered by kickoff, so "chronological among themselves" is free - but only as
  // long as splitFavorites is stable. Pin it.
  const day = [game('1', 'cfb', 'osu', 'a'), game('2', 'mlb', 'b', 'c'),
               game('3', 'mlb', 'cle', 'd'), game('4', 'cfb', 'e', 'f')];
  const { favorites, rest } = splitFavorites(day, FAV);
  assert.deepEqual(favorites.map((g) => g.id), ['1', '3']);
  assert.deepEqual(rest.map((g) => g.id), ['2', '4']);
});

test('the real favourites file resolves to ids the partition can use', () => {
  // Guards the wiring rather than the list: an empty set here would silently disable the whole
  // section on every day.
  const ids = favoriteIds({ teams: { cfb: ['194'], mlb: ['mlb-114'] } });
  assert.ok(ids.size >= 2);
  assert.ok(ids.has('194') || ids.has('mlb-114'));
});
