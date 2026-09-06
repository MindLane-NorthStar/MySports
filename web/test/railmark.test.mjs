// The GRID RAIL's ink-area fit (prompt 52 stage 5, Joe's 60/600 ruling).
//
// WHY THIS FILE EXISTS. Joe reported "NBC renders much smaller than FOX". NBC was at the rail's
// MAXIMUM height - 30px, tied for the tallest thing in the column - while FOX drew at 61 x 25.8.
// The eye weighs ink AREA, not height.
//
// THE MECHANISM WAS NOT WHAT IT LOOKED LIKE, and that is the part worth pinning. `markStyle()`
// computes a height from `hf`, the frozen ink-area normalization factor, but THE RAIL NEVER
// APPLIED IT: MobileGrid called `markStyle(row.id, 42).src` and used only `.src`, so the <img>
// carried no height and CSS fit-boxed every mark on its own. `hf` played no part in the rail for
// ANY of the 28 marks. These assertions are on the DATA and the FUNCTION, which is what decides
// the answer - the browser-side numbers live in the addendum's v2.0 amendment under M4.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { railMark, markStyle, RAIL_TARGET_AREA, RAIL_BOX_W, RAIL_MAX_H } from '../lib/marks.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(HERE, '..', 'public/marks/manifest.json'), 'utf8'));

test('the manifest carries published geometry for every mark, and h is PUBLISH_H', () => {
  assert.equal(manifest.length, 28);
  for (const m of manifest) {
    assert.ok(Number.isInteger(m.w) && m.w > 0, `${m.slug} has a width`);
    // build_web_marks.py PUBLISH_H = 128. Anything else means the published suite is not what the
    // script says it is, which is a finding rather than a number to work around.
    assert.equal(m.h, 128, `${m.slug} is PUBLISH_H tall`);
    assert.equal(typeof m.hf, 'number', `${m.slug} keeps its hf`);
  }
});

test('26 of 28 marks land on the 600px^2 target; the two exceptions are the two widest lockups', () => {
  const off = [];
  for (const m of manifest) {
    const r = railMark(m.slug);
    const area = r.height * r.width;
    if (Math.abs(area - RAIL_TARGET_AREA) > 1) off.push(m.slug);
  }
  assert.deepEqual(off.sort(), ['espn2', 'hbo-max']);
  assert.equal(manifest.length - off.length, 26);
});

test('NO mark is drawn wider than the rail content box - the CSS clamp must not bind', () => {
  // `.mrail-mark img` keeps max-width/max-height as a BACKSTOP. If one ever binds, the fit function
  // is wrong, not the CSS.
  for (const m of manifest) {
    const r = railMark(m.slug);
    assert.ok(r.width <= RAIL_BOX_W + 1e-9, `${m.slug} drawn ${r.width}px wide, box is ${RAIL_BOX_W}`);
    assert.ok(r.height <= RAIL_MAX_H + 1e-9, `${m.slug} drawn ${r.height}px tall, max is ${RAIL_MAX_H}`);
  }
});

test('the ink-area spread collapses from 3.00x to at most 1.45x', () => {
  const areas = manifest.map((m) => { const r = railMark(m.slug); return r.height * r.width; });
  const spread = Math.max(...areas) / Math.min(...areas);
  assert.ok(spread <= 1.45, `spread ${spread.toFixed(2)}x`);
  // and it is a real improvement, not a tautology: the OLD rule was the CSS box 61 x 30.
  const old = manifest.map((m) => {
    const a = m.w / m.h; const h = Math.min(30, 61 / a); return h * (h * a);
  });
  const oldSpread = Math.max(...old) / Math.min(...old);
  assert.ok(oldSpread > 2.9, `the old spread was ${oldSpread.toFixed(2)}x`);
});

test('the two exceptions are the SMALLEST marks, so nothing new becomes the worst offender', () => {
  const byArea = manifest
    .map((m) => ({ slug: m.slug, area: (() => { const r = railMark(m.slug); return r.height * r.width; })() }))
    .sort((a, b) => a.area - b.area);
  assert.deepEqual(byArea.slice(0, 2).map((x) => x.slug).sort(), ['espn2', 'hbo-max']);
});

test('compact art at aspect <= 4.51 closes them, with NO code change', () => {
  // RAIL_BOX_W / a stops binding when sqrt(TARGET/a) <= BOX_W/a, i.e. a <= BOX_W^2 / TARGET.
  const crossover = (RAIL_BOX_W * RAIL_BOX_W) / RAIL_TARGET_AREA;
  assert.ok(Math.abs(crossover - 4.51) < 0.01, `crossover ${crossover}`);
  for (const m of manifest) {
    if (m.w / m.h <= crossover) {
      const r = railMark(m.slug);
      assert.ok(Math.abs(r.height * r.width - RAIL_TARGET_AREA) <= 1, `${m.slug} is on target`);
    }
  }
});

test('markStyle is NOT changed - its other two callers are different surfaces', () => {
  // MobileGrid's sport band (26px) and GameDetail (its own size). Joe scoped the ruling to the GRID
  // views only, so both keep the hf-scaled height they have always had.
  assert.equal(markStyle('nbc', 42).height, Math.round((42 * 2) / 3 * 1.15));
  assert.equal(markStyle('nbc', 26).height, Math.round((26 * 2) / 3 * 1.15));
  assert.equal(markStyle('no-such-network', 42), null);
});

test('a network with no published mark gets no rail fit', () => {
  assert.equal(railMark('tbs'), null, 'TBS has no art - the rail renders call letters');
  assert.equal(railMark(''), null);
  assert.equal(railMark(null), null);
});
