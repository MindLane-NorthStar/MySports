// A cancelled or postponed game leaves the grid and stays in the list (prompt 129, Joe's ruling 4 of
// 2026-10-14; register §74). Until now nothing in web/components or lib/gridmodel.js tested either
// state, so the grid drew a block of airtime that would not happen.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { airs, gridSet, offServiceSummary, OFF_AIR_STATES } from '../lib/offservice.js';
import { OFFAIR_GAMES } from '../app/qa/offair/fixture.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');

const game = (id, status, eligible = true) => ({
  id,
  result_status: status,
  eligibility: [{ eligible, market_pending: false, reason: eligible ? 'linear tbs' : 'not receivable: x=unavailable' }],
  broadcasts: [{ active: true, service_id: 'tbs', access_status: eligible ? 'available' : 'unavailable', network: { canonical_name: 'TBS' } }],
});

test('the two states that will not air are exactly cancelled and postponed', () => {
  assert.deepEqual([...OFF_AIR_STATES].sort(), ['cancelled', 'postponed']);
  for (const s of ['scheduled', 'in_progress', 'final', null, undefined]) assert.equal(airs({ result_status: s }), true, String(s));
  for (const s of ['cancelled', 'postponed']) assert.equal(airs({ result_status: s }), false, s);
});

test('neither a cancelled nor a postponed game is in the grid set, and an off-service game still is not', () => {
  const day = [game('a', 'scheduled'), game('b', 'cancelled'), game('c', 'postponed'), game('d', 'scheduled', false), game('e', 'final')];
  assert.deepEqual(gridSet(day).map((g) => g.id), ['a', 'e']);
});

test('both stay in the list: the bands file them by eligibility, not by whether they air', () => {
  const day = [game('a', 'scheduled'), game('b', 'cancelled'), game('c', 'postponed')];
  const s = offServiceSummary(day);
  assert.deepEqual(s.on.map((g) => g.id), ['a', 'b', 'c']);
  assert.equal(s.offCount, 0, 'a cancelled game is not "not on your services"');
});

test('the /qa/offair fixture puts one game on the grid and three in the list', () => {
  assert.deepEqual(gridSet(OFFAIR_GAMES).map((g) => g.result_status), ['scheduled']);
  assert.deepEqual(OFFAIR_GAMES.map((g) => g.result_status), ['scheduled', 'cancelled', 'postponed']);
  assert.equal(offServiceSummary(OFFAIR_GAMES).on.length, 3);
});

test('Listing builds the mobile grid from gridSet() - the call site, not a copy of the rule', () => {
  const listing = src('components/Listing.js');
  assert.match(listing, /const gridGames = useMemo\(\(\) => gridSet\(games\), \[games\]\);/);
  assert.match(listing, /<MobileGrid games=\{gridGames\}/);
  assert.equal((listing.match(/<MobileGrid /g) || []).length, 1, 'one grid, built in one place');
});

test('the locked reference drops both states from its grid too (rule 23)', () => {
  const demo = readFileSync(join(HERE, '..', '..', 'docs', 'design', 'mobile_demo.html'), 'utf8');
  assert.match(demo, /const keep = TODAY\.filter\(g=>\{[^}]*g\.result_status!=="cancelled" && g\.result_status!=="postponed"/);
});
