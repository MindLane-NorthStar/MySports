// THE /qa/tbd FIXTURE (prompt 124, register §67).
//
// qa-shots proves the badge in a browser; this proves the ROWS it is proved on. Two things would make
// that browser check quietly worthless: a fixture that drifts from the shape Today hands Listing (a
// field GAME_SELECT gains, and the fixture never carries), and a fixture that stops covering a branch
// of the badge. Plus the one line that keeps the page out of production.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { TBD_GAMES } from '../app/qa/tbd/fixture.js';
import { isPlaceholderTeam, placeholderReason } from '../lib/placeholders.js';
import { splitHidden } from '../lib/offservice.js';
import { chronological } from '../lib/favorites.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');

/** A PostgREST select list -> { name: nestedSpec | true }. `alias:table!fk(cols)` is named by its alias. */
function parseSelect(list) {
  const out = {};
  let depth = 0;
  let cur = '';
  const items = [];
  for (const ch of list) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) { items.push(cur); cur = ''; } else cur += ch;
  }
  if (cur) items.push(cur);
  for (const raw of items) {
    const item = raw.trim();
    const open = item.indexOf('(');
    const head = open < 0 ? item : item.slice(0, open);
    const name = head.split(':')[0].split('!')[0];
    out[name] = open < 0 ? true : parseSelect(item.slice(open + 1, item.lastIndexOf(')')));
  }
  return out;
}

// GAME_SELECT, read from queries.js rather than restated: a restated copy would drift with the fixture.
const GAME_SELECT = parseSelect(
  [...src('lib/queries.js').match(/const GAME_SELECT = \[([\s\S]*?)\]\.join/)[1].matchAll(/^\s*'([^']+)',/gm)]
    .map((m) => m[1]).join(','));

function assertShape(value, spec, where) {
  if (spec === true || value === null) return;   // a scalar, or an embed PostgREST returns as null
  const rows = Array.isArray(value) ? value : [value];
  for (const row of rows) {
    assert.deepEqual(Object.keys(row).sort(), Object.keys(spec).sort(), `${where}: keys`);
    for (const [k, s] of Object.entries(spec)) assertShape(row[k], s, `${where}.${k}`);
  }
}

test('every fixture row carries exactly the fields gamesForDay() returns, embeds included', () => {
  assert.ok(Object.keys(GAME_SELECT).length >= 29, 'the select parsed');
  for (const g of TBD_GAMES) assertShape(g, GAME_SELECT, g.id);
});

test('the fixture covers every branch of the badge: the three MLB name forms and the -TBD suffix', () => {
  const sides = TBD_GAMES.flatMap((g) => [g.away, g.home]).map((t) => ({ ...t, sport: 'mlb' }));
  const placeholders = sides.filter(isPlaceholderTeam);
  assert.equal(placeholders.length, 4);
  assert.deepEqual(placeholders.map(placeholderReason).sort(), ['mlb-pattern', 'mlb-pattern', 'mlb-pattern', 'suffix']);
  const names = placeholders.map((t) => t.canonical_name);
  for (const form of [/^(AL|NL) Wild Card #\d+$/, /^(AL|NL) #\d+ Seed$/, /^(AL|NL) \d+\/\d+ Winner$/]) {
    assert.equal(names.filter((n) => form.test(n)).length, 1, `one side for ${form}`);
  }
  assert.ok(TBD_GAMES.some((g) => isPlaceholderTeam({ ...g.home, sport: 'mlb' })), 'a placeholder on the home side');
  assert.ok(TBD_GAMES.some((g) => isPlaceholderTeam({ ...g.away, sport: 'mlb' })), 'a placeholder on the away side');
});

test('every card carries a real club, and the Yankees sit beside one', () => {
  for (const g of TBD_GAMES) {
    const clubs = [g.away, g.home].filter((t) => !isPlaceholderTeam({ ...t, sport: 'mlb' }));
    assert.ok(clubs.length >= 1, `${g.id} has a real club`);
  }
  const yankees = TBD_GAMES.find((g) => g.home.id === 'mlb-147' || g.away.id === 'mlb-147');
  assert.ok(yankees, 'the 404 club is in the fixture');
  const other = yankees.home.id === 'mlb-147' ? yankees.away : yankees.home;
  assert.equal(isPlaceholderTeam({ ...other, sport: 'mlb' }), false, 'the error-path badge sits beside a real logo');
});

test('Today\'s filters hide none of the fixture: a hidden card is a side qa-shots could not see', () => {
  const { visible, hidden } = splitHidden(chronological(TBD_GAMES, new Set()), new Set());
  assert.equal(hidden.length, 0);
  assert.equal(visible.length, TBD_GAMES.length);
});

test('both qa pages 404 in production: the guard is the first line of each component', () => {
  const guard = /export default (?:async )?function \w+\([^)]*\) \{\n\s+if \(process\.env\.NODE_ENV === 'production'\) notFound\(\);/;
  assert.match(src('app/qa/tbd/page.js'), guard);
  assert.match(src('app/qa/programs/page.js'), guard);
});
