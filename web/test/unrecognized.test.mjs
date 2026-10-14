// The fifth listing state, UNRECOGNIZED (prompt 129 block G, Joe's ruling 1 of 2026-10-14: "show the
// game"). A game on a channel nobody has ruled on was filed `off` and hidden by D4 - 39 games over four
// weeks. Now it is shown, cued CHANNEL ?, counted in TBD, and drawn on the grid.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { isUnrecognized, offServiceSummary, splitHidden, pageCountLine, countSummary, gridSet } from '../lib/offservice.js';
import { CHANNEL_GAMES } from '../app/qa/channel/fixture.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');

const b = (service_id, access_status, active = true) => ({ service_id, access_status, active, network: { canonical_name: service_id } });
const game = (id, rows, eligible = false, pending = false) => ({
  id, broadcasts: rows, eligibility: [{ eligible, market_pending: pending, reason: 'x' }],
});

test('the predicate: not eligible, not pending, not network-TBD, and an active unknown row', () => {
  assert.equal(isUnrecognized(game('a', [b('fs1-fox-one', 'unknown')])), true);
  assert.equal(isUnrecognized(game('b', [b('fs1-fox-one', 'unknown'), b('fs2', 'unavailable')])), true, 'one unknown row is enough');
  assert.equal(isUnrecognized(game('c', [b('fs1-fox-one', 'unknown'), b('fs1', 'available')], true)), false, 'eligible wins');
  assert.equal(isUnrecognized(game('d', [b('fox', 'unverified'), b('x', 'unknown')], false, true)), false, 'market pending wins');
  assert.equal(isUnrecognized(game('e', [])), false, 'no rows is network-TBD, not this');
  assert.equal(isUnrecognized(game('f', [b('fs2', 'unavailable'), b('fs1-fox-one', 'unknown', false)])), false,
               'an inactive row is not a claim - the stub the refresh retired leaves the game off-service');
  assert.equal(isUnrecognized(game('g', [b('fs2', 'unavailable')])), false, 'every row ruled: off-service');
  assert.equal(isUnrecognized({ id: 'h', eligibility: [{ eligible: false }] }), false, 'broadcasts not selected is not a claim');
});

test('the order: tbd, pending, on, unrecognized, off - each game in exactly one bucket', () => {
  const day = [
    game('tbd', []),
    game('pending', [b('fox', 'unverified')], false, true),
    game('on', [b('fs1', 'available'), b('x', 'unknown')], true),
    game('unrec', [b('fs1-fox-one', 'unknown')]),
    game('off', [b('fs2', 'unavailable')]),
  ];
  const s = offServiceSummary(day);
  assert.deepEqual([s.tbd, s.pending, s.on, s.unrecognized, s.off].map((xs) => xs.map((g) => g.id)),
                   [['tbd'], ['pending'], ['on'], ['unrec'], ['off']]);
  assert.equal(s.unrecognizedCount, 1);
});

test('it is never hidden by D4', () => {
  const { visible, hidden } = splitHidden([game('unrec', [b('fs1-fox-one', 'unknown')]), game('off', [b('fs2', 'unavailable')])], new Set());
  assert.deepEqual(visible.map((g) => g.id), ['unrec']);
  assert.deepEqual(hidden.map((g) => g.id), ['off']);
});

test('the TBD segment sums it with pending and network-TBD, on both count lines', () => {
  const s = offServiceSummary([game('t', []), game('p', [b('fox', 'unverified')], false, true), game('u', [b('q', 'unknown')]),
                               game('o', [b('fs1', 'available')], true)]);
  assert.equal(pageCountLine(s), '1 broadcast on your services · 3 TBD');
  assert.equal(countSummary(s.lines), '1 airing · 3 TBD');
});

test('the grid includes it', () => {
  assert.deepEqual(gridSet([game('u', [b('fs1-fox-one', 'unknown')]), game('o', [b('fs2', 'unavailable')])]).map((g) => g.id), ['u']);
});

test('the /qa/channel fixture holds one game in each cue state', () => {
  const s = offServiceSummary(CHANNEL_GAMES);
  assert.deepEqual([s.unrecognized.length, s.pending.length, s.tbd.length, s.off.length, s.on.length], [1, 1, 1, 0, 0]);
});

test('SportBand puts the wrapper class on the row, and globals.css carries the cue text in the shared place', () => {
  assert.match(src('components/SportBand.js'), /unrecognizedIds\.has\(g\.id\) \? 'unrecognized-row' : null/);
  const css = src('app/globals.css');
  assert.match(css, /\.unrecognized-row::after\{content:'CHANNEL \?';position:absolute;top:4px;right:66px;/);
  assert.match(css, /@media \(max-width:699px\)\{\.unrecognized-row::after\{font-size:9px;padding:1px 4px 0\}\}/);
  assert.doesNotMatch(src('components/MatchupCard.js'), /unrecognized|CHANNEL/, 'MatchupCard is locked');
});

test('the locked reference carries the cue too (rule 23)', () => {
  const demo = readFileSync(join(HERE, '..', '..', 'docs', 'design', 'mobile_demo.html'), 'utf8');
  assert.match(demo, /\.unrecognized-row::after\{content:'CHANNEL \?'/);
  assert.match(demo, /g\.access_status==="unknown" && !g\.eligible \? `<div class="unrecognized-row">\$\{c\}<\/div>`/);
});
