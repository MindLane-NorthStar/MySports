// The overlap rule, phone side (web/lib/overlap.js) - rendering contract v1.6.5.
//
// Reads ../../tests/fixtures/overlap_cases.json, the SAME file tests/test_overlap.py reads. That
// shared fixture is the point: the archived PC grid and the live phone grid are two implementations
// of one design, and the only thing stopping them drifting on placement is that both are asserted
// against one set of expected numbers.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { splitOverlaps, MAX_SPLIT_MIN, MIN_CHIP_MIN } from '../lib/overlap.js';
import { packLanes } from '../lib/gridmodel.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX = JSON.parse(readFileSync(join(HERE, '..', '..', 'tests', 'fixtures', 'overlap_cases.json'), 'utf8'));

const ids = (items, pairs) => pairs.map(([i, j]) => [items[i].id, items[j].id]);

for (const c of FIX.cases) {
  test(`fixture: ${c.name}`, () => {
    const { items, split, guarded } = splitOverlaps(c.items);
    assert.deepEqual(items.map((o) => ({ id: o.id, start: o.start, end: o.end })), c.expect, c.why ?? '');
    assert.deepEqual(ids(c.items, split), c.expect_split);
    assert.deepEqual(ids(c.items, guarded), c.expect_guarded ?? []);
    // the whole point: a split pair must collapse into ONE lane
    assert.equal(packLanes(items).length, c.expect_lanes, c.why ?? '');
  });
}

test('thresholds match the fixture header', () => {
  assert.equal(MAX_SPLIT_MIN, FIX.max_split_min);
  assert.equal(MIN_CHIP_MIN, FIX.min_chip_min);
});

test('the input is never mutated - the adjustment is presentational only', () => {
  const items = [{ id: 'a', start: 720, end: 930 }, { id: 'b', start: 915, end: 1125 }];
  const before = JSON.stringify(items);
  splitOverlaps(items);
  assert.equal(JSON.stringify(items), before);
});

test('a split pair exactly meets, with no gap and no overlap', () => {
  const { items } = splitOverlaps([{ start: 750, end: 960 }, { start: 930, end: 1140 }]);
  assert.equal(items[0].end, items[1].start);
});

test('splitting moves the boundary, never the outer edges', () => {
  const { items } = splitOverlaps([{ start: 750, end: 960 }, { start: 930, end: 1140 }]);
  assert.equal(items[0].start, 750);
  assert.equal(items[1].end, 1140);
});

test('an empty or single row is a no-op', () => {
  assert.deepEqual(splitOverlaps([]).items, []);
  assert.deepEqual(splitOverlaps([{ start: 1, end: 2 }]).items, [{ start: 1, end: 2 }]);
});
