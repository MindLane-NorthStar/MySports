// web/lib/standings.js - the poll-rank resolver, and the record/standing split the listings card reads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { indexRankings, rankFor } from '../lib/standings.js';

const row = (team_id, poll_type, rank, { season = 2026, week = 1 } = {}) =>
  ({ team_id, season, week, poll_type, rank });

test('the CFP outranks the AP when the committee has ranked the club', () => {
  const ix = indexRankings([row('228', 'AP', 7), row('228', 'CFP', 4)]);
  assert.equal(rankFor(ix, '228', 2026, 1), 4, 'Joe\'s precedence is CFP first, always');
});

test('the AP answers alone before the committee exists', () => {
  // Weeks 1-11 have no CFP poll at all - the committee does not publish until about week 12.
  const ix = indexRankings([row('228', 'AP', 7)]);
  assert.equal(rankFor(ix, '228', 2026, 1), 7);
});

test('a club in neither poll is unranked, not zero and not a guess', () => {
  const ix = indexRankings([row('228', 'AP', 7), row('228', 'CFP', 4)]);
  assert.equal(rankFor(ix, '99', 2026, 1), null);
});

test('an empty index, a missing index and a null team all answer null rather than throwing', () => {
  assert.equal(rankFor(indexRankings([]), '228', 2026, 1), null);
  assert.equal(rankFor(indexRankings(null), '228', 2026, 1), null);
  assert.equal(rankFor(null, '228', 2026, 1), null);
  assert.equal(rankFor(indexRankings([row('228', 'AP', 7)]), null, 2026, 1), null);
});

test('the Coaches poll is stored but never shown', () => {
  // pipeline/rankings.py loads it because CFBD publishes it. The card does not ask for it, so a club
  // ranked ONLY by the coaches is unranked as far as this resolver is concerned.
  const ix = indexRankings([row('228', 'Coaches', 3)]);
  assert.equal(rankFor(ix, '228', 2026, 1), null);
});

test('a rank is scoped to its own week and season - it never leaks across either', () => {
  const ix = indexRankings([row('228', 'AP', 7, { week: 1 })]);
  assert.equal(rankFor(ix, '228', 2026, 1), 7);
  assert.equal(rankFor(ix, '228', 2026, 2), null, 'week 2 has no poll yet; last week is not an answer');
  assert.equal(rankFor(ix, '228', 2025, 1), null, 'nor is last season');
});

test('a malformed rank is treated as absent rather than rendered', () => {
  for (const bad of [null, undefined, 0, -1, 'four', NaN, 1.5]) {
    const ix = indexRankings([{ team_id: '228', season: 2026, week: 1, poll_type: 'AP', rank: bad }]);
    assert.equal(rankFor(ix, '228', 2026, 1), null, `rank ${String(bad)} must not render`);
  }
});

test('a CFP row that is malformed falls through to a sound AP row', () => {
  // The precedence is about which poll ANSWERS, so an unusable CFP entry must not swallow the answer.
  const ix = indexRankings([
    { team_id: '228', season: 2026, week: 12, poll_type: 'CFP', rank: null },
    row('228', 'AP', 7, { week: 12 }),
  ]);
  assert.equal(rankFor(ix, '228', 2026, 12), 7);
});
