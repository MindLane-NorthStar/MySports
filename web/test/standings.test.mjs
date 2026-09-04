// web/lib/standings.js - the poll-rank resolver, and the record/standing split the listings card reads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { indexRankings, rankFor, rankLabel, standingParts, standingLine } from '../lib/standings.js';

const row = (team_id, poll_type, rank, { season = 2026, week = 1 } = {}) =>
  ({ team_id, season, week, poll_type, rank });

test('the CFP outranks the AP when the committee has ranked the club', () => {
  const ix = indexRankings([row('228', 'AP', 7), row('228', 'CFP', 4)]);
  assert.deepEqual(rankFor(ix, '228', 2026, 1), { poll: 'CFP', rank: 4 },
                   'CFP first, always - and the poll now travels with the number');
});

test('the AP answers alone before the committee exists', () => {
  // Weeks 1-11 have no CFP poll at all - the committee does not publish until about week 12.
  const ix = indexRankings([row('228', 'AP', 7)]);
  assert.deepEqual(rankFor(ix, '228', 2026, 1), { poll: 'AP', rank: 7 });
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
  assert.deepEqual(rankFor(ix, '228', 2026, 1), { poll: 'AP', rank: 7 });
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
  assert.deepEqual(rankFor(ix, '228', 2026, 12), { poll: 'AP', rank: 7 });
});

// ---------------------------------------------------------------- C3: Joe's per-sport line rules

const rec = (o) => ({ wins: 0, losses: 0, ties: 0, ot_losses: null, points: null,
                      division_rank: null, games_back: null, ...o });

test('MLB is unchanged: record on line 1, place and games back on line 2', () => {
  const p = standingParts(rec({ wins: 70, losses: 70, division_rank: 2, games_back: 3 }),
                          'mlb', 'American League Central');
  assert.equal(p.record, '70-70');
  assert.equal(p.rest, '2nd AL Central · 3.0 GB');
});

test('NHL keeps its POINTS, because the league publishes no games back', () => {
  // games_back is null on all 96 NHL rows and points is set on all 96. Joe's spec says "games back";
  // his ruling on top of it says points, and the data is why.
  const p = standingParts(rec({ wins: 55, losses: 16, ot_losses: 11, points: 104, division_rank: 2 }),
                          'nhl', 'Atlantic');
  assert.equal(p.record, '55-16-11');
  assert.equal(p.rest, '104 pts · 2nd Atlantic');
});

test('NBA places by CONFERENCE and shows games back', () => {
  // division_rank carries the conference seed (0008), and 0011 seeded the conference rows that let
  // shortGroup() fold 'Eastern Conference' to 'East'.
  const p = standingParts(rec({ wins: 52, losses: 30, division_rank: 4, games_back: 2 }),
                          'nba', 'Eastern Conference');
  assert.equal(p.record, '52-30');
  assert.equal(p.rest, '4th East · 2.0 GB');
});

test('NFL places by division', () => {
  const p = standingParts(rec({ wins: 3, losses: 0, division_rank: 1 }), 'nfl', 'AFC East');
  assert.equal(p.record, '3-0');
  assert.equal(p.rest, '1st AFC East');
});

test('an all-zero record is NO record, and the division still shows', () => {
  // Every NFL club reads 0-0 until Sep 9. That is the absence of a season, not a start to one.
  const p = standingParts(rec({ wins: 0, losses: 0, division_rank: null }), 'nfl', 'AFC North');
  assert.equal(p.record, null);
  assert.equal(p.rest, 'AFC North');
});

test('no standings row at all still names the conference', () => {
  // The NHL and NBA case today: their games are season 2026 while their team_records are 2025, so
  // nothing matches and the card must still say which division the club is in.
  assert.deepEqual(standingParts(null, 'nhl', 'Atlantic'), { record: null, rest: 'Atlantic' });
  assert.deepEqual(standingParts(null, 'nba', 'Eastern Conference'), { record: null, rest: 'East' });
});

test('no row and no conference renders nothing at all', () => {
  assert.deepEqual(standingParts(null, 'nfl', null), { record: null, rest: null });
});

// Joe's five CFB cases, 2026-09-04: the rank and the conference are a COMBINATION, not an either/or.
// "the line below USC should read `AP #14 - Big Ten` - NOT simply `#14`".
const AP14 = { poll: 'AP', rank: 14 };
const CFP4 = { poll: 'CFP', rank: 4 };

test('CFB, CFP-ranked with a conference placement', () => {
  assert.equal(standingParts(rec({ division_rank: 3 }), 'cfb', 'ACC', CFP4).rest, 'CFP #4 · 3rd ACC');
});

test('CFB, AP-ranked with a conference placement', () => {
  assert.equal(standingParts(rec({ division_rank: 2 }), 'cfb', 'Big Ten', AP14).rest, 'AP #14 · 2nd Big Ten');
});

test('CFB, AP-ranked with NO placement - the live week-1 case', () => {
  // Zero CFB team_records rows exist, so this is what every ranked card renders today. USC.
  assert.equal(standingParts(null, 'cfb', 'Big Ten', AP14).rest, 'AP #14 · Big Ten');
});

test('CFB, unranked with a placement', () => {
  assert.equal(standingParts(rec({ wins: 8, losses: 1, division_rank: 3 }), 'cfb', 'ACC', null).rest, '3rd ACC');
});

test('CFB, unranked with no placement - the conference alone. Fresno State.', () => {
  assert.equal(standingParts(rec({ wins: 8, losses: 1 }), 'cfb', 'ACC', null).rest, 'ACC');
  assert.equal(standingParts(null, 'cfb', 'Pac-12', null).rest, 'Pac-12');
  assert.equal(standingParts(null, 'cfb', null, null).rest, null, 'nothing known renders nothing');
});

test('CFP outranks AP on the rendered line, not just in the resolver', () => {
  const ix = indexRankings([row('228', 'AP', 7, { week: 12 }), row('228', 'CFP', 4, { week: 12 })]);
  assert.equal(standingParts(null, 'cfb', 'ACC', rankFor(ix, '228', 2026, 12)).rest, 'CFP #4 · ACC');
});

test('a rank with no poll, or a poll with no rank, renders no label at all', () => {
  // Half a label is worse than none: "#14" is what Joe rejected and "AP #" says nothing.
  assert.equal(rankLabel(null), null);
  assert.equal(rankLabel({ rank: 14 }), null);
  assert.equal(rankLabel({ poll: 'AP' }), null);
  assert.equal(rankLabel({ poll: 'AP', rank: 0 }), null);
  assert.equal(standingParts(null, 'cfb', 'Big Ten', { rank: 14 }).rest, 'Big Ten');
});

test('only CFB gets a poll label - a rank passed for another sport is ignored', () => {
  assert.equal(standingParts(rec({ division_rank: 1 }), 'nfl', 'AFC East', AP14).rest, '1st AFC East');
});

test('the CFB rank comes from the resolver, so CFP beats AP end to end', () => {
  const ix = indexRankings([
    { team_id: '228', season: 2026, week: 12, poll_type: 'AP', rank: 7 },
    { team_id: '228', season: 2026, week: 12, poll_type: 'CFP', rank: 4 },
  ]);
  assert.equal(standingParts(null, 'cfb', 'ACC', rankFor(ix, '228', 2026, 12)).rest, 'CFP #4 · ACC');
});

test('standingLine still joins both pieces, because the detail panel renders one wide line', () => {
  const row = rec({ wins: 70, losses: 70, division_rank: 2, games_back: 3 });
  assert.equal(standingLine(row, 'mlb', 'American League Central'), '70-70 · 2nd AL Central · 3.0 GB');
  assert.equal(standingLine(null, 'nfl', 'AFC North'), 'AFC North');
  assert.equal(standingLine(null, 'nfl', null), null);
  // The detail panel gets the poll label too - one set of rules, both surfaces.
  assert.equal(standingLine(null, 'cfb', 'Big Ten', { poll: 'AP', rank: 14 }), 'AP #14 · Big Ten');
});
