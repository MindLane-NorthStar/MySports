// The week picker's range label (prompt 67 stage 3, Joe's ruling 2026-09-08).
//
// Calendar weeks read `Monday, Sep 7 - Sunday, Sep 13` - full weekday names, abbreviated month, no
// year. Season weeks keep their gold prefix and read `NFL Week 1 · Wed Sep 9 - Mon Sep 14`.
//
// WHY TWO WEEKDAY WIDTHS. Measured in the real font - Inter 600 at 12px with 0.36px tracking, read
// off `.pk-range` in the running app rather than assumed:
//
//   Monday, September 7 - Sunday, September 13     283.4px   Joe's first ask, does not fit anywhere
//   Monday, Sep 7 - Sunday, Sep 13                 196.3px   what ships for a calendar week
//   Wed Sep 9 - Mon Sep 14                         149.1px   what ships behind a season prefix
//   Mon Aug 24 - Sun Aug 30, 2026                  197.4px   what it replaced
//
// A season week's range sits behind `NFL Week 17 ·`, and `.pk-sport` is the half that may never
// ellipsize, so its range stays short rather than pushing the week number out.
//
// THE YEAR SURVIVES EXACTLY ONE CASE: a week whose two ends fall in different years. `Monday, Dec 28
// - Sunday, Jan 3, 2027` is otherwise indistinguishable from the same dates a year either way.

import test from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';

import { daySpanWeekdays } from '../lib/format.js';

test('a calendar week: full weekday names, short month, NO year', () => {
  assert.equal(daySpanWeekdays('2026-09-07', '2026-09-13', { longWeekday: true }),
    'Monday, Sep 7 - Sunday, Sep 13');
});

test('a season week: short weekdays, NO year', () => {
  assert.equal(daySpanWeekdays('2026-09-09', '2026-09-14'), 'Wed Sep 9 - Mon Sep 14');
});

test('THE YEAR IS GONE - it is what the full weekday names are spent on', () => {
  for (const s of [daySpanWeekdays('2026-09-07', '2026-09-13', { longWeekday: true }),
                   daySpanWeekdays('2026-09-09', '2026-09-14')]) {
    assert.doesNotMatch(s, /20\d\d/, s);
  }
});

test('a month-spanning week still reads correctly', () => {
  // 197.9px measured - it fits wherever the ordinary case does.
  assert.equal(daySpanWeekdays('2026-09-28', '2026-10-04', { longWeekday: true }),
    'Monday, Sep 28 - Sunday, Oct 4');
});

test('A YEAR-SPANNING WEEK KEEPS THE YEAR, and it is the END\'s', () => {
  // The end is the half a reader would otherwise get wrong: "Jan 3" after "Dec 28" is next year.
  assert.equal(daySpanWeekdays('2026-12-28', '2027-01-03', { longWeekday: true }),
    'Monday, Dec 28 - Sunday, Jan 3, 2027');
  assert.equal(daySpanWeekdays('2026-12-31', '2027-01-04'), 'Thu Dec 31 - Mon Jan 4, 2027');
});

test('a week inside one year never shows it, including across a month', () => {
  assert.doesNotMatch(daySpanWeekdays('2026-12-21', '2026-12-27', { longWeekday: true }), /2026/);
  assert.doesNotMatch(daySpanWeekdays('2026-12-28', '2026-12-31', { longWeekday: true }), /2026/);
});

test('a single day carries no year and no dash', () => {
  assert.equal(daySpanWeekdays('2026-09-07', null, { longWeekday: true }), 'Monday, Sep 7');
  assert.equal(daySpanWeekdays('2026-09-07', '2026-09-07'), 'Mon Sep 7');
});

test('no start is an empty string, not a throw', () => {
  assert.equal(daySpanWeekdays(null, '2026-09-13'), '');
  assert.equal(daySpanWeekdays('', ''), '');
});

test('the short form drops its comma and the long form keeps it', () => {
  // Intl gives 'Mon, Sep 7' and 'Monday, Sep 7'. Four commas in one label reads as a list.
  assert.equal(daySpanWeekdays('2026-09-07', '2026-09-13').split(',').length - 1, 0);
  assert.equal(daySpanWeekdays('2026-09-07', '2026-09-13', { longWeekday: true }).split(',').length - 1, 2);
});

test('the calendar picker asks for the long form and the season picker does not', () => {
  // Rule 32: the ruling is in the builder, not only in the formatter.
  const page = readFileSync(new URL('../app/page.js', import.meta.url), 'utf8');
  assert.match(page, /range: daySpanWeekdays\(w\.start, w\.end\) \}/, 'season keeps short weekdays');
  assert.match(page, /range: daySpanWeekdays\(w\.start, w\.end, \{ longWeekday: true \}\) \}/,
    'calendar takes the long ones');
});
