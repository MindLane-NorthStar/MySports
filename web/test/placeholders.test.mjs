// THE PLACEHOLDER PREDICATE (prompt 114 rev B, Joe's ruling 2026-09-23, register §60).
//
// The seven MLB postseason placeholders the 2026-09-23 refresh loaded turned the smoke check red
// because their ids do not end in `-TBD`. Joe widened the rule to the two name forms MLB has
// published - and ONLY those two, so that a form nobody has seen yet still turns the check red and
// gets looked at. Every negative below is a shape the pattern must refuse for exactly that reason.
// It did: the Division Series sides arrived as "AL 3/6 Winner", and Joe ruled that third form in on
// 2026-09-28 (prompt 123's gate run).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { isPlaceholderTeam, placeholderReason } from '../lib/placeholders.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');

// the seven rows as the database holds them, and the one -TBD row
const SEVEN = [
  ['mlb-4614', 'AL #3 Seed'],
  ['mlb-4617', 'NL #3 Seed'],
  ['mlb-4619', 'NL Wild Card #1'],
  ['mlb-4944', 'AL Wild Card #2'],
  ['mlb-4945', 'NL Wild Card #2'],
  ['mlb-4946', 'AL Wild Card #3'],
  ['mlb-4947', 'NL Wild Card #3'],
];

test('the seven MLB postseason placeholders are placeholders, by the pattern', () => {
  for (const [id, canonical_name] of SEVEN) {
    assert.equal(isPlaceholderTeam({ id, sport: 'mlb', canonical_name }), true, `${id} ${canonical_name}`);
    assert.equal(placeholderReason({ id, sport: 'mlb', canonical_name }), 'mlb-pattern', id);
  }
});

// the four Division Series sides the 2026-09-28 refresh loaded (Joe's ruling that day, register §60)
const DIVISION_SERIES = [
  ['mlb-5528', 'AL 3/6 Winner'],
  ['mlb-5529', 'AL 4/5 Winner'],
  ['mlb-5532', 'NL 3/6 Winner'],
  ['mlb-5533', 'NL 4/5 Winner'],
];

test('the four Division Series sides are placeholders, by the pattern - the third published form', () => {
  for (const [id, canonical_name] of DIVISION_SERIES) {
    assert.equal(isPlaceholderTeam({ id, sport: 'mlb', canonical_name }), true, `${id} ${canonical_name}`);
    assert.equal(placeholderReason({ id, sport: 'mlb', canonical_name }), 'mlb-pattern', id);
  }
});

test('the series-winner form is exactly as published: near-misses are refused', () => {
  const mlb = (canonical_name) => isPlaceholderTeam({ id: 'mlb-9999', sport: 'mlb', canonical_name });
  assert.equal(mlb('AL 3/6 Winners'), false, 'a trailing s is not the published form');
  assert.equal(mlb('AL 3-6 Winner'), false, 'the seeds are separated by a slash');
  assert.equal(mlb('AL 3/6 winner'), false, 'the published form is capitalised');
  assert.equal(mlb('AL 3/ Winner'), false, 'both seeds are digits');
  assert.equal(mlb('AL Winner'), false, 'a winner with no seeds is not the published form');
  assert.equal(mlb('ALCS 1/4 Winner'), false, 'the league is AL or NL, not a round name');
  assert.equal(mlb('The AL 3/6 Winner'), false, 'anchored at the start');
  assert.equal(mlb('AL 3/6 Winner (home)'), false, 'anchored at the end');
  assert.equal(isPlaceholderTeam({ id: 'nhl-1', sport: 'nhl', canonical_name: 'AL 3/6 Winner' }), false, 'MLB only');
});

test('a -TBD id is a placeholder in any sport, by the suffix - the rule that stood before', () => {
  assert.equal(isPlaceholderTeam({ id: 'nba-TBD', sport: 'nba', canonical_name: 'TBD' }), true);
  assert.equal(placeholderReason({ id: 'nba-TBD', sport: 'nba', canonical_name: 'TBD' }), 'suffix');
  assert.equal(isPlaceholderTeam({ id: 'nhl-TBD', sport: 'nhl', canonical_name: 'Anything' }), true);
});

test('a real club is not a placeholder', () => {
  assert.equal(isPlaceholderTeam({ id: 'mlb-114', sport: 'mlb', canonical_name: 'Cleveland Guardians' }), false);
  assert.equal(placeholderReason({ id: 'mlb-114', sport: 'mlb', canonical_name: 'Cleveland Guardians' }), null);
});

test('the pattern is narrow: near-misses are refused so an unseen form turns the smoke check red', () => {
  const mlb = (canonical_name, id = 'mlb-9999') => isPlaceholderTeam({ id, sport: 'mlb', canonical_name });
  assert.equal(mlb('AL #3 Seeds'), false, 'a trailing s is not the published form');
  assert.equal(mlb('AL Wild Card'), false, 'a wild card slot without a number is not the published form');
  assert.equal(mlb('ALDS Winner A'), false, 'not the form MLB published for a series winner (ruled 2026-09-28: "AL 3/6 Winner")');
  assert.equal(mlb('Seed AL #3'), false);
  assert.equal(mlb('The AL #3 Seed'), false, 'anchored at the start');
  assert.equal(mlb('AL #3 Seed (home)'), false, 'anchored at the end');
  assert.equal(mlb('AL #x Seed'), false, 'the number is digits');
});

test('the pattern is MLB-only: the same name on another sport is not a placeholder', () => {
  assert.equal(isPlaceholderTeam({ id: 'nba-4614', sport: 'nba', canonical_name: 'AL #3 Seed' }), false);
  assert.equal(isPlaceholderTeam({ id: 'nhl-1', sport: 'nhl', canonical_name: 'NL Wild Card #1' }), false);
});

test('the suffix is exact: mlb-TBDX is not a -TBD id', () => {
  assert.equal(isPlaceholderTeam({ id: 'mlb-TBDX', sport: 'mlb', canonical_name: 'TBD' }), false);
  assert.equal(isPlaceholderTeam({ id: 'mlb-TBD-2', sport: 'mlb', canonical_name: 'TBD' }), false);
});

test('a missing row, id or name is never a placeholder', () => {
  assert.equal(isPlaceholderTeam(null), false);
  assert.equal(isPlaceholderTeam({}), false);
  assert.equal(isPlaceholderTeam({ id: 'mlb-1', sport: 'mlb' }), false);
});

test('smoke.mjs uses the predicate and no longer tests the suffix itself', () => {
  // The check is a smoke check because only live data can see a new row; the RULE it applies must
  // be the one place this file pins, or the two drift and a widening here never reaches the gate.
  const smoke = src('scripts/smoke.mjs');
  assert.match(smoke, /import \{ isPlaceholderTeam, placeholderReason \} from '\.\.\/lib\/placeholders\.js'/);
  assert.match(smoke, /teams\?select=id,sport,canonical_name/, 'the select carries the name the pattern reads');
  assert.doesNotMatch(smoke, /endsWith\('-TBD'\)/, 'the suffix test lives in lib/placeholders.js now');
  assert.match(smoke, /proUnruled\.every\(isPlaceholderTeam\)/);
});
