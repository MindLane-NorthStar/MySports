// D4/E3: the off-service split and the count line.
//
// The eligibility VERDICT is not tested here because it is not made here - it is read from
// mysports.viewer_game_eligibility, written by pipeline/reconcile.py. What is tested is how this app
// reads that verdict and turns it into a sentence, including the two cases that would otherwise be
// silent failures: a game with no eligibility row at all, and a day where every missed game is on its
// own out-of-market RSN.

import test from 'node:test';
import assert from 'node:assert/strict';

import { isEligible, eligibilityReason, outletsFor, offServiceSummary, countLine, shortOutlet } from '../lib/offservice.js';

const game = (id, eligible, outlets = [], extra = {}) => ({
  id,
  eligibility: eligible === undefined ? undefined : [{ eligible, reason: eligible ? 'linear abc' : 'not receivable: x=unavailable' }],
  broadcasts: outlets.map((n) => ({ active: true, network: { id: n.toLowerCase(), canonical_name: n } })),
  ...extra,
});

test('the reconciler verdict is read, not recomputed', () => {
  assert.equal(isEligible(game('a', true)), true);
  assert.equal(isEligible(game('b', false)), false);
  assert.equal(eligibilityReason(game('b', false)), 'not receivable: x=unavailable');
});

test('a game with NO eligibility row is shown, never silently hidden', () => {
  // An unjudged game is not the same as an ineligible one. Hiding something never assessed would be
  // the worst of both behaviours - invisible AND uncounted.
  assert.equal(isEligible({ id: 'x' }), true);
  assert.equal(isEligible({ id: 'x', eligibility: [] }), true);
  assert.equal(isEligible({ id: 'x', eligibility: [{ eligible: null }] }), true);
});

test('eligibility survives PostgREST returning an object instead of an array', () => {
  assert.equal(isEligible({ id: 'x', eligibility: { eligible: false } }), false);
  assert.equal(isEligible({ id: 'x', eligibility: { eligible: true } }), true);
});

test('outlets come from active broadcast rows only', () => {
  const g = {
    broadcasts: [
      { active: true, network: { canonical_name: 'FOX' } },
      { active: false, network: { canonical_name: 'Stale Net' } },
      { active: true, network: { canonical_name: 'FOX' } },
      { active: true, network: null },
    ],
  };
  assert.deepEqual(outletsFor(g), ['FOX'], 'inactive rows and nulls are skipped, duplicates collapse');
});

test('the split hides off-service games and counts them', () => {
  const games = [game('1', true, ['ABC']), game('2', false, ['CBS Sports Network']), game('3', true, ['FOX'])];
  const s = offServiceSummary(games);
  assert.equal(s.total, 3);
  assert.equal(s.offCount, 1);
  assert.deepEqual(s.on.map((g) => g.id), ['1', '3']);
  assert.deepEqual(s.off.map((g) => g.id), ['2']);
  assert.equal(s.line, '3 games · 1 not on your services · CBS Sports Network');
});

test('the line is null when nothing is hidden - no line rather than a zero', () => {
  assert.equal(offServiceSummary([game('1', true, ['ABC'])]).line, null);
  assert.equal(offServiceSummary([]).line, null);
  assert.equal(countLine(10, 0, []), null);
});

test('outlets are ranked by how many missed games they carry', () => {
  const games = [
    game('1', false, ['CBS Sports Network']),
    game('2', false, ['Rays.TV']),
    game('3', false, ['CBS Sports Network']),
  ];
  const s = offServiceSummary(games);
  assert.deepEqual(s.outlets, ['CBS Sports Network', 'Rays.TV'], 'the costlier outlet leads');
});

test('a wall of one-off RSNs is truncated with a count, not listed in full', () => {
  // A real MLB night: nearly every missed game is its own out-of-market RSN. Listing all 28 would
  // bury the number that actually matters.
  const many = Array.from({ length: 28 }, (_, i) => game(String(i), false, [`RSN ${String(i).padStart(2, '0')}`]));
  const s = offServiceSummary(many);
  assert.match(s.line, /^28 games · 28 not on your services · RSN 00, RSN 01, RSN 02 and 25 more$/);
});

test('singular game reads correctly', () => {
  assert.equal(countLine(1, 1, ['FOX']), '1 game · 1 not on your services · FOX');
});

test('an off-service game with no known outlet still gets counted', () => {
  const s = offServiceSummary([game('1', true, ['ABC']), game('2', false, [])]);
  assert.equal(s.line, '2 games · 1 not on your services', 'no outlet clause rather than a dangling separator');
});

test('the split preserves input order within each group', () => {
  const games = [game('1', true), game('2', false), game('3', true), game('4', false)];
  const s = offServiceSummary(games);
  assert.deepEqual(s.on.map((g) => g.id), ['1', '3']);
  assert.deepEqual(s.off.map((g) => g.id), ['2', '4']);
});

test('sponsor tails are trimmed so a comma-joined list stays countable', () => {
  // Left whole, "ABTV, presented by Pechanga Resort Casino" puts a comma INSIDE an item and the line
  // reads as two more outlets than it names.
  assert.equal(shortOutlet('ABTV, presented by Pechanga Resort Casino'), 'ABTV');
  assert.equal(shortOutlet('Cardinals.TV Presented by bet365'), 'Cardinals.TV');
  assert.equal(shortOutlet('Rangers Sports Network, presented by Progressive'), 'Rangers Sports Network');
  assert.equal(shortOutlet('CBS Sports Network'), 'CBS Sports Network', 'plain names are untouched');
  assert.equal(shortOutlet(null), '');
});

test('trimming collapses outlets that differ only by sponsor', () => {
  const line = countLine(3, 3, ['Reds.TV', 'Reds.TV Presented by Somebody', 'FOX']);
  assert.equal(line, '3 games · 3 not on your services · Reds.TV, FOX');
});
