// PROMPT 57 STAGE 1: the card reads the NEWEST line, and every query that embeds odds says so.
//
// `odds:game_odds(...)` carried no order and no limit. PostgREST guarantees nothing about the order
// of an embedded resource, and every consumer reads `[0]`, so the card showed whichever row the
// planner handed back first out of a pile that grows by one per game per day.
//
// MEASURED 2026-09-07 against the live database, and it corrects the brief that asked for this: the
// embed was coming back NEWEST-first for all seven multi-row games sampled, so the cards were right
// by luck rather than showing a frozen opening line. Nothing promises that, which is the whole
// reason this is pinned here.
//
// WHY THE CALL SITE AND NOT A ROW COUNT (working rule 19): a test that asserted "one odds row comes
// back" would pass against a database that simply has no duplicates yet, and would say nothing about
// the query. What must not regress is the QUERY, so that is what is asserted.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the embed is ordered and limited, keyed to the alias and not inside the select', () => {
  const q = code('lib/queries.js');
  assert.match(q, /const ODDS_NEWEST = '&odds\.order=fetched_at\.desc&odds\.limit=1';/);
  // The alias is `odds`, so the params are `odds.*`. Inside the select string they would be a
  // column name and PostgREST would 400.
  assert.match(q, /odds:game_odds\(provider,spread,total,home_moneyline,away_moneyline,fetched_at\)/);
  assert.doesNotMatch(q, /game_odds\([^)]*order=/, 'ordering never goes inside the embed parens');
});

// WORKING RULE 32. The first draft of the brief for this stage named two consumers and missed the
// grid; this test refuses to let the same shape happen to the QUERIES.
test('rule 32: EVERY query that embeds GAME_SELECT also carries ODDS_NEWEST', () => {
  const q = code('lib/queries.js');
  // The unit is the STATEMENT, not the template literal: `finalGames` builds its path from two
  // concatenated literals, so a per-backtick match sees only the first half and reports a false
  // failure. Slice from each call site to the `);` that closes its rest() call.
  const NEEDLE = 'games?select=${GAME_SELECT}';
  const uses = [];
  for (let i = q.indexOf(NEEDLE); i !== -1; i = q.indexOf(NEEDLE, i + 1)) {
    const end = q.indexOf(');', i);
    uses.push(q.slice(i, end === -1 ? q.length : end));
  }
  assert.equal(uses.length, 5, `expected the five known call sites, found ${uses.length}`);
  for (const u of uses) {
    assert.match(u, /\$\{ODDS_NEWEST\}/,
      `a games query embeds odds without bounding them:\n    ${u.slice(0, 200)}`);
  }
});

test('rule 32: all THREE consumers read index 0, and there are exactly three', () => {
  // With `odds.limit=1` there is only ever one row, so `[0]` is correct at each - but the list has
  // to be complete, because a fourth reader added later would be reading an unbounded embed if its
  // query were added without ODDS_NEWEST.
  const files = ['components/MatchupCard.js', 'components/GameDetail.js', 'components/MobileGrid.js'];
  for (const f of files) {
    assert.match(code(f), /\(game\.odds \|\| \[\]\)\[0\]/, `${f} reads the odds row`);
  }
  // and nothing else in web/ does
  const others = ['components/ProgramCard.js', 'components/SportBand.js', 'components/Listing.js',
                  'components/PageCount.js', 'components/Filters.js'];  // FirstBand.js deleted, prompt 67
  for (const f of others) {
    assert.doesNotMatch(code(f), /game\.odds/, `${f} is not an odds consumer - update this list if it becomes one`);
  }
});
