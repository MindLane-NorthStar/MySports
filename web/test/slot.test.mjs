// Contract v1.6.6: the card's right slot, and the ordering that is the whole point of it.
//
// WHY THIS EXISTS. The shipped card ran score -> odds -> status with the odds branch gated only on
// `!score`, so a postponed game with a posted line printed the moneyline and never printed the
// postponement - and the status branch beneath it was unreachable. Zero games in the loaded season
// are postponed, so it had never fired once; it would have gone live on the first rain-out. That is
// exactly the class of bug a fixture test catches and a screenshot does not.
//
// slotContent is pure and takes `fav` as an argument, so every rung below is exercised without a DOM
// and without the odds helper that lives in the component.

import test from 'node:test';
import assert from 'node:assert/strict';
import { slotContent } from '../lib/format.js';

const DASH = '—';
const odds = (side, ml, total) => ({ side, ml, odds: { total } });

test('rung 1: an exception outranks odds - postponed', () => {
  const s = slotContent({ result_status: 'postponed' }, odds('home', -135, 41.5));
  assert.equal(s.kind, 'exception');
  assert.equal(s.row3, 'Postponed');
  assert.equal(s.row2, null, 'never the moneyline');
  assert.equal(s.markSide, null);
});

test('rung 1: an exception outranks odds - cancelled', () => {
  const s = slotContent({ result_status: 'cancelled' }, odds('away', 120, 8));
  assert.equal(s.kind, 'exception');
  assert.equal(s.row3, 'Cancelled');
  assert.equal(s.row2, null);
});

test('rung 2: the higher score reads first when the AWAY side leads', () => {
  const s = slotContent({ result_status: 'final', away_score: 14, home_score: 7 });
  assert.equal(s.row2, '14 - 7');
  assert.equal(s.markSide, 'away', "the winner's mark");
  assert.equal(s.row3, 'Final');
  assert.equal(s.tone, 'final');
});

test('rung 2: the higher score reads first when the HOME side leads', () => {
  // The stored order is away-home, so this is the case that actually reverses.
  const s = slotContent({ result_status: 'final', away_score: 7, home_score: 14 });
  assert.equal(s.row2, '14 - 7');
  assert.equal(s.markSide, 'home');
});

test('rung 2: equal scores render TIED, no mark, away-home order kept', () => {
  const s = slotContent({ result_status: 'in_progress', away_score: 3, home_score: 3 });
  assert.equal(s.tied, true);
  assert.equal(s.markSide, null, 'a word goes here instead of a mark');
  assert.equal(s.row2, '3 - 3');
  assert.equal(s.tone, 'live');
});

test('rung 2: 0 - 0 at the opening whistle is TIED, not an empty slot', () => {
  // Most live games for their first minutes. Integer zero must not be read as falsy anywhere.
  const s = slotContent({ result_status: 'in_progress', away_score: 0, home_score: 0 });
  assert.equal(s.kind, 'score');
  assert.equal(s.tied, true);
  assert.equal(s.row2, '0 - 0');
});

test('rung 2: a final with odds shows the score, never the moneyline', () => {
  const s = slotContent({ result_status: 'final', away_score: 3, home_score: 1 }, odds('home', -200, 8));
  assert.equal(s.kind, 'score');
  assert.equal(s.row2, '3 - 1');
  assert.equal(s.row3, 'Final');
});

test('rung 3: in progress with null scores is the clock alone', () => {
  const s = slotContent({ result_status: 'in_progress', away_score: null, home_score: null });
  assert.equal(s.kind, 'live');
  assert.equal(s.markSide, null, 'no mark');
  assert.equal(s.row2, null, 'no score row');
  assert.equal(s.row3, 'Live');
});

test('rung 3: the live clock replaces the word when the overlay carried one', () => {
  const s = slotContent(
    { result_status: 'in_progress', sport: 'nfl', period: 3, clock: '2:14', away_score: null, home_score: null },
  );
  assert.equal(s.kind, 'live');
  assert.match(s.row3, /Q3|Live/);
});

test('rung 4: scheduled with odds restacks to mark / moneyline / O-U', () => {
  const s = slotContent({ result_status: 'scheduled' }, odds('away', -110, 44.5));
  assert.equal(s.kind, 'odds');
  assert.equal(s.markSide, 'away');
  assert.equal(s.row2, '-110');
  assert.equal(s.row3, 'O/U 44.5');
});

test('rung 4: a positive moneyline keeps its plus sign', () => {
  assert.equal(slotContent({ result_status: 'scheduled' }, odds('home', 145, 8)).row2, '+145');
});

test('rung 4: odds with no total drop the third row rather than printing an empty one', () => {
  const s = slotContent({ result_status: 'scheduled' }, odds('home', -120, null));
  assert.equal(s.row3, null);
});

test('rung 5: scheduled with no odds is the dash', () => {
  const s = slotContent({ result_status: 'scheduled' });
  assert.equal(s.kind, 'none');
  assert.equal(s.row3, DASH);
  assert.equal(s.tone, 'none');
  assert.equal(s.markSide, null);
  assert.equal(s.row2, null);
});

test('rung 5: a null result_status is the dash and does not crash', () => {
  // 7 such games in the loaded season.
  for (const g of [{ result_status: null }, {}, { result_status: undefined }]) {
    const s = slotContent(g);
    assert.equal(s.row3, DASH);
    assert.equal(s.kind, 'none');
  }
  assert.equal(slotContent(null).row3, DASH, 'and a null game itself');
});

test('the word Sched appears nowhere in the ladder', () => {
  const cases = [
    [{ result_status: 'scheduled' }, null],
    [{ result_status: null }, null],
    [{ result_status: 'scheduled' }, odds('home', -110, 44.5)],
    [{ result_status: 'final', away_score: 2, home_score: 1 }, null],
  ];
  for (const [g, f] of cases) {
    assert.doesNotMatch(JSON.stringify(slotContent(g, f)), /Sched/);
  }
});

test('every rung returns the same shape, so the renderer needs no special cases', () => {
  const keys = ['kind', 'markSide', 'tied', 'row2', 'row3', 'tone'];
  const cases = [
    [{ result_status: 'postponed' }, null],
    [{ result_status: 'final', away_score: 1, home_score: 0 }, null],
    [{ result_status: 'in_progress', away_score: null, home_score: null }, null],
    [{ result_status: 'scheduled' }, odds('home', -110, 44.5)],
    [{ result_status: 'scheduled' }, null],
  ];
  for (const [g, f] of cases) {
    assert.deepEqual(Object.keys(slotContent(g, f)).sort(), [...keys].sort());
  }
});
