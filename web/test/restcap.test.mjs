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
//                                           with the reason written down.
//
// The value is in (c): someone has to write the reason, the same way railmark.test.mjs makes a new
// mark impossible to add unnoticed. Adding a function to the list to make this test go green IS the
// defect this file exists to catch - the fix for a read that can grow is restAll().
//
// THERE USED TO BE A (d), and it is gone on purpose. Prompt 109 carried a REPORTED list for reads
// known to be unbounded and awaiting Joe's ruling; it had one member, gridIndex (94 of 1,000, no
// filter), and prompt 110 paged it. An empty exception list is an invitation, so the mechanism was
// removed rather than kept warm: a read that needs an exception in future gets a decision written
// into the register and a restAll(), not a place to wait.
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
    'an inclusive viewing_day range, and it has TWO callers: the week page (app/page.js, `wk.start` ' +
    'to `wk.end`), one calendar week, and /api/my-games (prompt 127), the current viewing day and the ' +
    'seven after it - eight days. Measured 2026-10-05 over all 4,217 loaded games (2026-08-29 to ' +
    '2027-04-11): the heaviest eight-day window is 329 games (from 2026-09-19), the heaviest seven 237, ' +
    'and eight copies of the heaviest day (95, 2026-09-12) is 760, still under the cap. A caller ' +
    'passing a season-long range would need restAll, and this entry is what makes that visible',
  gamesForSeasonWeek:
    'one (sport, season, week) of a season-week sport: CFB week 1 is the largest at 99 games',
  programsForDay:
    'one viewing day of non-game programs, by start_at range: 6 on the heaviest day',
  rankingsFor:
    'filtered by team ids AND season AND week AND poll: 25 rows per week across all of CFB, and a ' +
    'page asks for its own clubs only (24 of 24 measured in prompt 108)',
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
    '  There is no exception list, on purpose (prompt 110).\n' +
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

test('gridIndex pages with restAll - no filter, and the archive grows every night (prompt 110)', () => {
  const g = callSites().filter((c) => c.fn === 'gridIndex');
  assert.equal(g.length, 1);
  assert.equal(g[0].kind, 'restAll', 'a bare rest() here would drop the OLDEST archives first, silently');
  assert.match(g[0].text, /order=generated_at\.desc,id\.desc/, 'a total order, so offset paging is stable');
});

test('the allowlist names only functions that exist - a stale entry is a lie about the file', () => {
  const names = new Set(callSites().map((c) => c.fn));
  for (const k of Object.keys(BOUNDED)) assert.ok(names.has(k), `BOUNDED names ${k}, which makes no rest() call`);
});

test('every allowlist entry carries a reason, not a bare name', () => {
  for (const [k, why] of Object.entries(BOUNDED)) {
    assert.ok(typeof why === 'string' && why.length >= 40, `${k}: write the reason down`);
  }
});
