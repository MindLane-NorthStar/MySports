// THE RIGHT RAIL SHOWS THE POINT SPREAD (prompt 63 stage 3).
//
// Joe's ruling: the spread, not the moneyline, with the favourite's mark above it. The mark stays in
// the right rail only - the matchup keeps away-on-top and does not reorder.
//
// `game_odds.spread` is HOME-RELATIVE (0003_games.sql): negative means home is favoured. So the
// favourite's own line is the spread for a home favourite and its negation for an away one, and it
// is ALWAYS negative - that is what a spread means.

import test from 'node:test';
import assert from 'node:assert/strict';
import { slotContent } from '../lib/format.js';

const sched = { result_status: 'scheduled' };
const fav = (spread, home_moneyline, away_moneyline, side, ml) =>
  ({ odds: { spread, total: 7.5, home_moneyline, away_moneyline }, side, ml });
const row2 = (f) => slotContent(sched, f).row2;

test('the favourite reads its own spread, whichever side it is', () => {
  assert.equal(row2(fav(-7.5, -300, 250, 'home', -300)), '-7.5');
  // away favourite: the stored spread is +7.5 home-relative, and the away side's own line is -7.5
  assert.equal(row2(fav(7.5, 250, -300, 'away', -300)), '-7.5');
  // a whole number stays whole - no trailing zero
  assert.equal(row2(fav(-3, -150, 130, 'home', -150)), '-3');
});

test('the moneyline is the fallback, not a legacy path', () => {
  // Joe's ruling. MLB is usually priced on the moneyline and the run line, so this is the common
  // route there rather than an edge case.
  assert.equal(row2(fav(null, -150, 130, 'home', -150)), '-150');
  assert.equal(row2(fav(undefined, 130, -150, 'away', -150)), '-150');
  // and a favourite with a spread but NO moneyline still reads the spread
  assert.equal(row2(fav(-40.5, null, null, 'home', null)), '-40.5');
  // nothing at all is the dash, exactly as before
  assert.equal(row2(fav(null, null, null, 'home', null)), '-');
});

test('when the moneylines and the spread disagree, the moneyline wins', () => {
  // NOT HYPOTHETICAL: measured 2026-09-08 over 119 rows, SEVEN disagree - all MLB near-pick'ems
  // where the moneyline has home by four cents (-110 / -106) while the run line has home at +1.5,
  // the underdog by runs. `favourite()` takes the side from the moneylines, so the spread there
  // belongs to the OTHER team and would print as a POSITIVE number under the favourite's mark.
  assert.equal(row2(fav(1.5, -110, -106, 'home', -110)), '-110');
  // the same shape the other way round
  assert.equal(row2(fav(-1.5, -106, -110, 'away', -110)), '-110');
});

test('a pick’em never reaches this rung', () => {
  // `favourite()` returns null at spread 0 and slotContent falls to rung 5, which is the dash.
  const s = slotContent(sched, null);
  assert.equal(s.kind, 'none');
  assert.equal(s.row3, '—');
});

test('the scored and in-progress rungs are untouched', () => {
  // The odds rung fires only for `scheduled`, which is why a completed game showing odds is a DATA
  // fault and not a rendering one - see prompt 63 stage 4.
  const final = slotContent({ result_status: 'final', home_score: 3, away_score: 7 },
                            fav(-7.5, -300, 250, 'home', -300));
  assert.equal(final.kind, 'score');
  assert.equal(final.row2, '7 - 3');
  const live = slotContent({ result_status: 'in_progress' }, fav(-7.5, -300, 250, 'home', -300));
  assert.equal(live.kind, 'live');
  assert.equal(live.row2, null);
});
