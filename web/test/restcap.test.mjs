// THE CAP GUARD (prompt 109): every rest() call in lib/queries.js is bounded, and says how.
//
// PostgREST answers an unbounded select with AT MOST 1,000 rows and says nothing about it - no
// error, no header the app reads, just a short array (lib/rest.js:44-55). It has now caused two
// production defects in this repo, and the second happened AFTER the first was written down:
//
//   1. weekIndexRows read `games` bare; at 1,364 rows the Weeks picker silently offered a third of
//      the season less than the database held. Fixed with restAll(), and the lesson written into
//      rest.js: "use it for any read whose row count grows with the season".
//   2. standingsFor read `team_records` bare, filtered by team id and season. The filter LOOKED
//      bounded and was not - the table keeps one row per club per day - and on 2026-09-22 the week
//      view's 210 clubs stood at 2,820 rows against 1,000 returned. Ordered as_of.asc, the rows that
//      fell off were the newest, so every week card carried a record up to eight days stale, and
//      `npm run geometry`'s day/week equality was what noticed (prompt 108).
//
// A note in rest.js did not prevent the second. This test does: it WALKS every call site and makes
// the author classify it. A call is acceptable only when it is one of
//
//   (a) restAll()                         - pages past the cap, correct at any row count;
//   (b) carries an explicit `limit=`      - bounded by construction (`odds.limit=` does not count -
//                                           that bounds an embed, not the response);
//   (c) named in BOUNDED below            - a filter whose row count cannot grow with the season,
//                                           with the reason written down;
//   (d) named in REPORTED below           - known UNBOUNDED, measured, and awaiting Joe's ruling.
//
// The value is in (c) and (d): someone has to write the reason, the same way railmark.test.mjs
// makes a new mark impossible to add unnoticed. Adding a function to either list to make this test
// go green IS the defect this file exists to catch - the fix for a read that can grow is restAll().
//
// WHY THE CALL SITE AND NOT A ROW COUNT (working rule 19): a test that fetched the week's standings
// and asserted 2,820 rows would pass today and rot by November. What must not regress is the QUERY.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(HERE, '..', 'lib/queries.js'), 'utf8');
// Comments stripped, so a rest() mentioned in prose is not a call site.
const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// (c) BOUNDED BY A FILTER THAT CANNOT GROW WITH THE SEASON. Figures measured 2026-09-22 (prompt 109
// block C) against the live database; they are context for the reason, not the assertion.
const BOUNDED = {
  gamesForDay:
    'one viewing day: `viewing_day=eq.` - the heaviest day loaded is 95 games (2026-09-12), and a ' +
    'day grows with the slate, not with the season',
  gamesForRange:
    'an inclusive viewing_day range - its ONLY caller is the week page (app/page.js, `wk.start` to ' +
    '`wk.end`), one calendar week; the heaviest week loaded is 229 games (w/c 2026-09-21). A caller ' +
    'passing a season-long range would need restAll, and this entry is what makes that visible',
  gamesForSeasonWeek:
    'one (sport, season, week) of a season-week sport: CFB week 1 is the largest at 99 games',
  programsForDay:
    'one viewing day of non-game programs, by start_at range: 6 on the heaviest day',
  rankingsFor:
    'filtered by team ids AND season AND week AND poll: 25 rows per week across all of CFB, and a ' +
    'page asks for its own clubs only (24 of 24 measured in prompt 108)',
};

// (d) KNOWN UNBOUNDED, REPORTED, NOT FIXED HERE. Each entry is a defect in waiting with a measured
// distance from the cap. Prompt 109 block C's instruction was to report gridIndex and fix it only if
// it was already over the cap; it was not, and the decision is Joe's. THIS LIST IS NOT WHERE A NEW
// UNBOUNDED READ GOES - it is where one already reported to Joe waits for his ruling.
const REPORTED = {
  gridIndex:
    'NO FILTER AT ALL - one row per (sport, day) render, ordered generated_at.desc, so truncation ' +
    'drops the OLDEST and fails benignly: an archived day past the horizon renders as "no grid" with ' +
    'no error. 94 of 1,000 on 2026-09-22. Reported by prompt 109 block C; the eventual fix is ' +
    'restAll() or a filter, and the ruling is Joe’s',
};

/** Every rest()/restAll() call in the file, with the function it sits in and its argument text. */
function callSites() {
  const fns = [...code.matchAll(/function\s+(\w+)\s*\(/g)].map((m) => ({ name: m[1], at: m.index }));
  const enclosing = (i) => fns.filter((f) => f.at < i).pop()?.name || '(module scope)';
  const out = [];
  for (const m of code.matchAll(/\b(rest|restAll)\(/g)) {
    const end = code.indexOf(');', m.index);
    out.push({
      fn: enclosing(m.index),
      kind: m[1],
      text: code.slice(m.index, end === -1 ? code.length : end),
    });
  }
  return out;
}

const classify = (c) => {
  if (c.kind === 'restAll') return 'paged';
  // `odds.limit=1` bounds the EMBED and says nothing about the number of games.
  if (/(?<![.\w])limit=/.test(c.text)) return 'limited';
  if (Object.hasOwn(BOUNDED, c.fn)) return 'bounded';
  if (Object.hasOwn(REPORTED, c.fn)) return 'reported';
  return 'UNBOUNDED';
};

test('the walk finds the call sites, so a silent miss is not a pass', () => {
  const sites = callSites();
  assert.ok(sites.length >= 10, `expected at least ten rest() call sites in lib/queries.js, found ${sites.length}`);
  assert.ok(sites.some((c) => c.fn === 'standingsFor'), 'standingsFor was not found - the walk is broken');
  assert.ok(sites.some((c) => c.fn === 'weekIndexRows'), 'weekIndexRows was not found - the walk is broken');
  // rest() and restAll() are told apart by the word boundary, not by prefix
  assert.ok(sites.some((c) => c.kind === 'restAll') && sites.some((c) => c.kind === 'rest'));
});

test('EVERY rest() call in lib/queries.js is paged, limited, or bounded with a written reason', () => {
  const bad = callSites().filter((c) => classify(c) === 'UNBOUNDED');
  assert.deepEqual(bad.map((c) => c.fn), [],
    'an unbounded PostgREST read: it will return at most 1,000 rows and say nothing.\n' +
    '  If its row count can grow with the season, the fix is restAll() (lib/rest.js).\n' +
    '  If a filter genuinely caps it, add it to BOUNDED in test/restcap.test.mjs with the reason.\n' +
    '  Do NOT add it to REPORTED to make this pass - that list is for reads already reported to Joe.\n' +
    bad.map((c) => `    ${c.fn}: ${c.text.slice(0, 120).replace(/\s+/g, ' ')}`).join('\n'));
});

test('standingsFor pages with restAll, over a total order, so offset paging is stable', () => {
  const s = callSites().filter((c) => c.fn === 'standingsFor');
  assert.equal(s.length, 1);
  assert.equal(s[0].kind, 'restAll', 'the second time this read crossed the cap (prompt 109)');
  // LIMIT/OFFSET over a non-unique order can repeat one row and drop another between pages;
  // (team_id, season, as_of) is the table's unique key (migration 0003).
  assert.match(s[0].text, /order=as_of\.asc,team_id\.asc,season\.asc/);
});

test('the allowlists name only functions that exist - a stale entry is a lie about the file', () => {
  const names = new Set(callSites().map((c) => c.fn));
  for (const k of Object.keys(BOUNDED)) assert.ok(names.has(k), `BOUNDED names ${k}, which makes no rest() call`);
  for (const k of Object.keys(REPORTED)) assert.ok(names.has(k), `REPORTED names ${k}, which makes no rest() call`);
  // and no function is in both, because they mean opposite things
  for (const k of Object.keys(REPORTED)) assert.ok(!Object.hasOwn(BOUNDED, k), `${k} is both bounded and reported`);
});

test('every allowlist entry carries a reason, not a bare name', () => {
  for (const [k, why] of Object.entries({ ...BOUNDED, ...REPORTED })) {
    assert.ok(typeof why === 'string' && why.length >= 40, `${k}: write the reason down`);
  }
});

test('the REPORTED list is exactly the reads Joe has been told about, and nothing has crept in', () => {
  // Stated, not derived, on purpose (railmark.test.mjs's shape): growing this list is a decision
  // that gets written into docs/enhancement-register.md, never a tidy-up.
  assert.deepEqual(Object.keys(REPORTED), ['gridIndex']);
});
