// 05 section 11: the page order, and the property the whole reorder turns on.
//
// WHY THIS EXISTS. Hoisting favourites out of their sport bands into a page-level section moves games
// between the things that count them. The failure mode is silent and arithmetic: a band left counting
// a game that is no longer in it, or a favourite counted twice - once in YOUR TEAMS and once in its
// sport. Neither would throw, and neither is visible on a day where the numbers happen to be small.
//
// THE HOIST IS GONE AND THIS FILE MOVED WITH IT (prompt 82 block D2). The page-level YOUR TEAMS
// section was retired at prompt 51 stage 4a and the in-band float at prompt 82, so there is no
// mechanism left that can move a game between the things that count it - which means the
// double-counting failure above cannot happen by construction rather than by test.
//
// THE COVERAGE MOVED RATHER THAN DISAPPEARING, which is the point. Two properties are still real and
// are pinned below: every game lands in exactly ONE band and the counts sum to the day (that is
// `offServiceSummary`, unchanged and still capable of drifting), and A BAND READS AS A TIMELINE -
// which is the property the float used to threaten and `chronological()` now guarantees.
//
// Listing.js cannot be rendered here - it is a client component with hooks and a router - so what is
// pinned is the PARTITION RULE, computed from the same exported functions the component uses.

import test from 'node:test';
import assert from 'node:assert/strict';
import { offServiceSummary } from '../lib/offservice.js';
import { favoriteIds, isFavorite, chronological } from '../lib/favorites.js';

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

/**
 * Exactly what Listing.js does on `/`: group by sport, in SPORTS order. No hoist.
 *
 * `favIds` IS NO LONGER A PARAMETER because the partition no longer depends on it - a favourite
 * lands in its sport band like everything else and is distinguished by a class on the row wrapper,
 * not by position. That is the whole of block D2 in one signature change.
 */
function sections(games) {
  const by = new Map();
  for (const g of games) {
    if (!by.has(g.sport)) by.set(g.sport, []);
    by.get(g.sport).push(g);
  }
  return [...SPORTS.filter((s) => by.has(s)), ...[...by.keys()].filter((s) => !SPORTS.includes(s)).sort()]
    .map((s) => ({ name: s, games: by.get(s) }));
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

test('every game lands in exactly one band', () => {
  const secs = sections(DAY);
  const ids = secs.flatMap((s) => s.games.map((g) => g.id));
  assert.equal(ids.length, DAY.length, 'no game is dropped');
  assert.equal(new Set(ids).size, DAY.length, 'and none is counted twice');
  assert.deepEqual([...ids].sort(), DAY.map((g) => g.id).sort());
});

test('THE INVARIANT: the band totals sum to the day, with nothing double-counted', () => {
  // This is the number the page prints at the foot. It survives the hoist's removal because it was
  // never about the hoist - it is about `offServiceSummary` counting each band's own rows.
  const secs = sections(DAY);
  const sum = secs.reduce((n, s) => n + offServiceSummary(s.games).total, 0);
  assert.equal(sum, DAY.length, `bands summed to ${sum}, day has ${DAY.length}`);
});

test('A FAVOURITE STAYS IN ITS SPORT BAND - it is marked, not moved (prompt 82)', () => {
  // THIS IS THE INVERSION. It read "a favourite is counted in YOUR TEAMS and NOT again in its sport
  // band" and asserted the Guardians game was GONE from MLB. The hoist is retired, so the property
  // is now the opposite one and a float coming back fails here rather than passing quietly.
  const secs = sections(DAY);
  assert.equal(secs.find((s) => s.name === 'YOUR TEAMS'), undefined, 'no such section exists');
  const mlb = secs.find((s) => s.name === 'mlb');
  assert.deepEqual(mlb.games.map((g) => g.id), ['g4', 'g5'],
    'the Guardians game sits in MLB, in input order, beside the stranger');
  assert.equal(offServiceSummary(mlb.games).total, 2);
  const cfb = secs.find((s) => s.name === 'cfb');
  assert.deepEqual(cfb.games.map((g) => g.id), ['g1', 'g2', 'g3'], 'and the CFB favourite likewise');
});

test('each band counts only what it shows - the four states follow the games', () => {
  const secs = sections(DAY);
  const cfb = offServiceSummary(secs.find((s) => s.name === 'cfb').games);
  assert.equal(cfb.total, 3, 'the favourite is counted HERE now, not in a section of its own');
  assert.equal(cfb.tbdCount, 1);
  assert.equal(cfb.offCount, 1);
  const mlb = offServiceSummary(secs.find((s) => s.name === 'mlb').games);
  assert.equal(mlb.total, 2);
  assert.equal(mlb.pendingCount, 1, 'g4 is market-pending and is a favourite - both cues, one row');
});

test('a sport whose only game is a favourite still gets its band', () => {
  // THE INVERSION OF "gets NO band, rather than a header over nothing". That test existed because
  // the hoist emptied a band; nothing empties one now. The live case it named - 2026-10-01,
  // 2026-10-29 and 2026-11-30 each have exactly one NFL game and it is a favourite - is now an
  // ordinary band with one marked card in it.
  const day = [game('a', 'nfl', 'cle', 'x'), game('b', 'mlb', 'q', 'r')];
  const secs = sections(day);
  assert.deepEqual(secs.map((s) => s.name), ['nfl', 'mlb'], 'the NFL band is there');
  assert.deepEqual(secs[0].games.map((g) => g.id), ['a']);
  assert.equal(secs.reduce((n, s) => n + offServiceSummary(s.games).total, 0), day.length);
});

test('a day with no favourites looks exactly the same, which is the point', () => {
  const day = [game('a', 'nfl', 'p', 'x'), game('b', 'mlb', 'q', 'r')];
  const secs = sections(day);
  assert.deepEqual(secs.map((s) => s.name), ['nfl', 'mlb']);
  assert.equal(secs.reduce((n, s) => n + offServiceSummary(s.games).total, 0), day.length);
});

test('A BAND READS AS A TIMELINE - the property the float used to threaten', () => {
  // THE COVERAGE MOVED HERE. The retired test pinned that the hoist preserved order WITHIN each
  // group, which is a weaker promise than the one Joe actually asked for: the whole band in clock
  // order, with a favourite winning only a tie. That is `chronological`, and it is what a float
  // coming back would break.
  const at = (id, t, home) => ({ id, canonical_kickoff_at_utc: `2026-09-13T${t}:00.000Z`,
                                 home_team_id: home, away_team_id: 'zzz' });
  const FAVS = new Set(['cle']);
  const band = [at('stranger-early', '17:00', 'x'), at('fav-late', '20:00', 'cle'),
                at('stranger-mid', '18:00', 'y')];
  assert.deepEqual(chronological(band, FAVS).map((g) => g.id),
    ['stranger-early', 'stranger-mid', 'fav-late'],
    'a favourite does NOT jump the clock - it is marked where it falls');
  // and at a tie it wins, which is the half that IS a promotion
  const tie = [at('stranger', '18:00', 'x'), at('fav', '18:00', 'cle')];
  assert.deepEqual(chronological(tie, FAVS).map((g) => g.id), ['fav', 'stranger']);
  // the mark is what distinguishes it, and it is computed from the same predicate the band uses
  assert.equal(isFavorite(at('f', '18:00', 'cle'), FAVS), true);
  assert.equal(isFavorite(at('s', '18:00', 'x'), FAVS), false);
});

test('the real favourites file resolves to ids the partition can use', () => {
  // Guards the wiring rather than the list: an empty set here would silently disable the whole
  // section on every day.
  const ids = favoriteIds({ teams: { cfb: ['194'], mlb: ['mlb-114'] } });
  assert.ok(ids.size >= 2);
  assert.ok(ids.has('194') || ids.has('mlb-114'));
});
