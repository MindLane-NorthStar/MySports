// R8, prompt 56: THE EMPTY DAY STOPS NAMING DATES THAT HAVE PASSED.
//
// The generic empty state hardcoded six viewing days - "try 2026-09-03 or 2026-09-04 (MLB),
// 2026-09-05 (CFB), 2026-09-13 (NFL), 2026-10-01 (NHL) or 2026-10-28 (NBA)". Three of them were
// already in the past on the day the fault was found, and by November the paragraph would have been
// a list of dead ends. Week mode's equivalent ("try a CFB or NFL week") does not age because it
// names no date; this one aged because it named six.
//
// TWO KINDS OF TEST, DELIBERATELY. `loadedDayLine` is pure and is tested by calling it. The QUERY
// and its CALL SITE are tested textually, because working rule 19 says pin the call site rather
// than a row count, and because an async server component that reads the database cannot be mounted
// under `node --test` (the constraint pagehead.test.mjs and nav.test.mjs already work under).

import test from 'node:test';
import assert from 'node:assert/strict';
import { region, after, before } from './region.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadedDayLine } from '../lib/format.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ------------------------------------------------------------------------------- the sentence

test('R8: the line names the next loaded day, and says so when the nearest one is behind', () => {
  assert.equal(loadedDayLine({ day: '2026-10-10', past: false }),
    'The next loaded day is Saturday, October 10, 2026.');
  assert.equal(loadedDayLine({ day: '2026-08-31', past: true }),
    'Nothing later is loaded \u2014 the most recent loaded day is Monday, August 31, 2026.');
});

test('R8: no answer, a broken answer or a failed lookup all fall back to a line with NO date', () => {
  // An empty state must not be able to error, and a fallback that named a date would age exactly as
  // the six hardcoded ones did.
  for (const bad of [null, undefined, {}, { day: null }, { day: 42 }, { past: true }]) {
    const line = loadedDayLine(bad);
    assert.equal(line, 'The database currently holds loaded days only.');
    assert.doesNotMatch(line, /\d{4}/, 'the fallback names no year, so it cannot go stale');
  }
});

// -------------------------------------------------------------------- the query, and where it runs

test('R8: the lookup is BOUNDED - ordered, limit 1, never an unbounded select (rule 19)', () => {
  const q = code('lib/queries.js');
  // `after()` THROWS ON A MISS (prompt 74). A bare `slice(indexOf(...))` on a renamed function is
  // `slice(-1)` - one character - and every assertion below then runs over nothing.
  const fn = after(q, 'export async function nearestLoadedDay', 'the bounded lookup');
  const body = before(fn, '\n}\n', 'the closing brace of the lookup') + '\n}\n';
  const calls = body.match(/`games\?[^`]+`/g) || [];
  assert.equal(calls.length, 2, 'exactly two: forward, then the backward fallback');
  for (const c of calls) {
    assert.match(c, /select=viewing_day&/, 'one column, not the whole game');
    assert.match(c, /&order=viewing_day\.(asc|desc)&/, 'ordered');
    assert.match(c, /&limit=1`$/, 'and bounded - PostgREST caps an unbounded select at 1000 silently');
    assert.match(c, /\$\{sportFilter\(sport\)\}/, 'scoped to the sport being viewed');
  }
  assert.match(body, /viewing_day=gte\.\$\{day\}/, 'prefer at-or-after the day being viewed');
  assert.match(body, /viewing_day=lt\.\$\{day\}/, 'and only then fall back to behind it');
});

test('R8: the CALL SITE runs only on an empty ALL GAMES day, and cannot throw the page', () => {
  const page = code('app/page.js');
  assert.match(page, /if \(!error && rows\.length === 0 && !hidden\.length && !P\.isMine\) \{/,
    'the same condition the empty state renders on, so a populated page makes no extra round trip');
  assert.match(page, /nearest = await nearestLoadedDay\(day, P\.sport\);/);
  assert.match(page, /\} catch \{\s*nearest = null;/,
    'a failed lookup leaves the generic line, it does not 500 an empty state');
  assert.match(page, /loadedDayLine\(nearest\)/);
});

test('R8: the six hardcoded dates are gone, and the per-sport lines are NOT touched', () => {
  const page = src('app/page.js');
  // `region()` RATHER THAN TWO BARE SLICES (prompt 74). With the opening anchor gone the stanza was
  // the empty string and the six-date loop below passed over nothing; with `</p>` gone it was the
  // rest of the file, so a test that said "inside the empty-day stanza" was quietly asserting
  // something about all of page.js. Both proved by deleting the anchor and running this file.
  const stanza = region(page, 'Nothing on this viewing day{P.sport', '</p>', 'the empty-day stanza');
  for (const d of ['2026-09-03', '2026-09-04', '2026-09-05', '2026-09-13', '2026-10-01', '2026-10-28']) {
    assert.ok(!stanza.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').includes(d),
      `${d} is no longer offered as a place to go`);
  }
  // SPORT_EMPTY names external gates - "NASCAR arrives with the playoffs, September 6" - rather than
  // loaded data, which is why those lines are allowed to name a date and are deliberately unchanged.
  assert.match(page, /nascar: 'It arrives with the playoffs, September 6\.'/);
  assert.match(page, /IndyCar's 2026 season ends this month/);
});
