// The Weeks page's current-week default (web/lib/weeks.js currentWeekKey).
//
// The page used to default to all[0] - the first entry of a season-ordered list - which is why it
// opened on CFB Week 1 in September. These pin all four branches of the replacement, including the
// case that makes rule 2 necessary rather than decorative: CFB week 1 spans Aug 29 to Sep 7 2026
// while NFL week 1 begins inside it, so on Sep 13 two season weeks genuinely contain the same day.

import test from 'node:test';
import assert from 'node:assert/strict';
import { region } from './region.mjs';
import { readFileSync } from 'node:fs';
import { currentWeekKey } from '../lib/weeks.js';

// The real shape, from the loaded season.
const CFB1 = { key: 'cfb-2026-1', start: '2026-08-29', end: '2026-09-07' };
const NFL1 = { key: 'nfl-2026-1', start: '2026-09-10', end: '2026-09-15' };
const CFB2 = { key: 'cfb-2026-2', start: '2026-09-08', end: '2026-09-14' };
const CFB8 = { key: 'cfb-2026-8', start: '2026-10-24', end: '2026-10-24' };

test('branch 1: the week whose span contains today', () => {
  assert.equal(currentWeekKey([CFB1, CFB2, NFL1], '2026-09-02'), 'cfb-2026-1');
});

test('branch 2: when several contain today, the one whose START IS LATEST', () => {
  // Sep 13 sits inside BOTH CFB week 2 (Sep 8-14) and NFL week 1 (Sep 10-15). The week that began
  // most recently is what a viewer means by "this week".
  assert.equal(currentWeekKey([CFB1, CFB2, NFL1], '2026-09-13'), 'nfl-2026-1');
});

test('branch 2 holds regardless of input order', () => {
  assert.equal(currentWeekKey([NFL1, CFB2, CFB1], '2026-09-13'), 'nfl-2026-1');
  assert.equal(currentWeekKey([CFB2, NFL1, CFB1], '2026-09-13'), 'nfl-2026-1');
});

test('branch 3: nothing contains today -> the NEXT UPCOMING', () => {
  // Aug 20 is before the season. The useful answer is what is about to happen.
  assert.equal(currentWeekKey([CFB1, CFB2, NFL1], '2026-08-20'), 'cfb-2026-1');
  // A gap mid-season picks the nearest future week, not the furthest.
  assert.equal(currentWeekKey([CFB1, NFL1, CFB8], '2026-09-08'), 'nfl-2026-1');
});

test('branch 4: nothing contains today and nothing is upcoming -> the MOST RECENT PAST', () => {
  assert.equal(currentWeekKey([CFB1, CFB2, NFL1, CFB8], '2026-12-25'), 'cfb-2026-8');
});

test('the boundary days of a span count as inside it', () => {
  assert.equal(currentWeekKey([CFB1], '2026-08-29'), 'cfb-2026-1');
  assert.equal(currentWeekKey([CFB1], '2026-09-07'), 'cfb-2026-1');
  assert.equal(currentWeekKey([CFB1], '2026-09-08'), 'cfb-2026-1', 'past, and the only week there is');
});

test('no weeks -> null, rather than a guess', () => {
  assert.equal(currentWeekKey([], '2026-09-03'), null);
  assert.equal(currentWeekKey(null, '2026-09-03'), null);
});

test('no day given falls back to the first entry rather than throwing', () => {
  assert.equal(currentWeekKey([CFB1, CFB2], null), 'cfb-2026-1');
});

test('entries without a key are ignored', () => {
  assert.equal(currentWeekKey([{ start: '2026-09-01', end: '2026-09-30' }, CFB1], '2026-09-02'), 'cfb-2026-1');
});

test('calendar weeks use the same rule', () => {
  const cal = [
    { key: '2026-08-31', start: '2026-08-31', end: '2026-09-06' },
    { key: '2026-09-07', start: '2026-09-07', end: '2026-09-13' },
  ];
  assert.equal(currentWeekKey(cal, '2026-09-03'), '2026-08-31');
  assert.equal(currentWeekKey(cal, '2026-09-09'), '2026-09-07');
});

// ---------------------------------------------------------------- the silent row cap
test('the week index must be read with restAll, not rest', () => {
  // PostgREST caps an unbounded select at 1000 rows and says nothing. At 375 games the week index
  // fitted; at 1364 it did not, and the picker silently offered CFB weeks 1-10 and NFL weeks 1-9 -
  // a third of the season missing with nothing to show it. This pins the fix at the source, because
  // the symptom is invisible: the page looks fine, it just knows less than the database does.
  const src = readFileSync(new URL('../lib/queries.js', import.meta.url), 'utf8');
  const fn = region(src, 'export async function weekIndexRows', '}', 'the week index read');
  assert.match(fn, /restAll\(/, 'weekIndexRows must page past the 1000-row cap');
  assert.doesNotMatch(fn, /\brest\('games/, 'a bare rest() here truncates once the season loads');
});
