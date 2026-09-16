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
// ANY of the marks. These assertions are on the DATA and the FUNCTION, which is what decides
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
  // 28 -> 32: prompt 55 stage 2 added nfl-network, tbs, trutv and accnx.
  // 32 -> 33: prompt 72 added `directv`, the carrier's own dark lockup, so the DIRECTV link on the
  // detail card wears a mark instead of the word. The count is stated rather than derived on
  // purpose - a mark appearing or vanishing unnoticed is exactly what this file exists to catch -
  // so bump it deliberately when the suite grows, and never to make a run go green.
  // 33 -> 35: prompt 104 added the two COMPOSITES for the Cavaliers' OTA simulcast, `cbs-dazn` and
  // `cbs-wuab-43` - CBS stacked over the stream it simulcasts. Bumped deliberately, and they are
  // held to every assertion in this file rather than excepted from it: both land exactly on the
  // 600px^2 rail target below. NOTE FOR PROMPT 105: Joe ruled them LIST VIEW ONLY, and nothing in
  // the manifest records that - a mark carries no surface. If the rail must never draw them, that
  // fact needs somewhere to live.
  assert.equal(manifest.length, 35);
  for (const m of manifest) {
    assert.ok(Number.isInteger(m.w) && m.w > 0, `${m.slug} has a width`);
    // build_web_marks.py PUBLISH_H = 128. Anything else means the published suite is not what the
    // script says it is, which is a finding rather than a number to work around.
    assert.equal(m.h, 128, `${m.slug} is PUBLISH_H tall`);
    assert.equal(typeof m.hf, 'number', `${m.slug} keeps its hf`);
  }
});

// NAME CORRECTED BY PROMPT 106. It read "31 of 32 marks land on the 600px^2 target" while the
// assertion below said 34 of 35 - stale since prompt 72 added `directv`, and passed over by 104 and
// 105, both of which edited this very test. A failing run sent the reader hunting for 32 marks that
// do not exist. The name now says the PROPERTY, which does not move when the suite grows.
test('every mark lands on the 600px^2 rail target except ESPN2, the one irreducibly wide wordmark', () => {
  // Stage 5 landed 26 of 28, with ESPN2 and HBO Max short because their aspect put them against the
  // `RAIL_BOX_W / a` ceiling. Stage 7 replaced HBO Max's wide wordmark with the stacked 2025 lockup
  // (aspect 6.30 -> 2.14) and it came onto the target with NO CODE CHANGE - the fit recomputed from
  // the manifest, which is the whole point of making it data-driven. ESPN2 has no compact variant:
  // its brand IS a wide wordmark, and none was found.
  const off = [];
  for (const m of manifest) {
    const r = railMark(m.slug);
    if (Math.abs(r.height * r.width - RAIL_TARGET_AREA) > 1) off.push(m.slug);
  }
  // THE PROPERTY IS THAT ESPN2 IS THE ONLY EXCEPTION, and that is unchanged: prompt 72's `directv`
  // came onto the 600px^2 target with no code change, the same way HBO Max's stacked lockup did -
  // and so did prompt 104's two composites. **Prompt 105 RESIZED both** - Joe ruled CBS down to the
  // width of the mark beneath it, which makes each stack taller and narrower - and they came back
  // onto the target with no code change here, the same way: 30.00 x 20.00 -> 27.73 x 21.64 and
  // 27.21 x 22.05 -> 23.52 x 25.51, all four 600.0. Re-measured rather than assumed, and they stay
  // INSIDE this assertion; if a composite ever misses the target that is a finding, not a reason to
  // except it. The exception list is the assertion that matters; the count moves with the suite.
  assert.deepEqual(off.sort(), ['espn2']);
  assert.equal(manifest.length - off.length, 34);
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

test('the ink-area spread collapses from 3.00x to at most 1.20x', () => {
  // 3.00x before stage 5; 1.40x after it; 1.16x once stage 7's compact HBO Max landed.
  const areas = manifest.map((m) => { const r = railMark(m.slug); return r.height * r.width; });
  const spread = Math.max(...areas) / Math.min(...areas);
  assert.ok(spread <= 1.20, `spread ${spread.toFixed(2)}x`);
  // AND IT IS THE FIT FUNCTION DOING THE WORK, not the art. Run the OLD rule - the bare CSS box,
  // 61 x 30 with object-fit: contain and no height on the <img> - over the SAME manifest and it is
  // still materially worse. (Measured against the pre-stage-5 art the old rule gave 3.00x; that
  // number is history and is not recomputed here, because the art it described has since changed.)
  const old = manifest.map((m) => {
    const a = m.w / m.h; const h = Math.min(30, 61 / a); return h * (h * a);
  });
  const oldSpread = Math.max(...old) / Math.min(...old);
  assert.ok(oldSpread > spread * 1.5,
    `the CSS-box rule spreads ${oldSpread.toFixed(2)}x against the fit function's ${spread.toFixed(2)}x`);
});

test('the one exception is the SMALLEST mark, so nothing new becomes the worst offender', () => {
  // The point of the assertion, which survives the count change: a mark that cannot reach the
  // target must not END UP LARGER than one that can. Below target is fine; above it is a bug.
  const byArea = manifest
    .map((m) => ({ slug: m.slug, area: (() => { const r = railMark(m.slug); return r.height * r.width; })() }))
    .sort((a, b) => a.area - b.area);
  assert.equal(byArea[0].slug, 'espn2');
  assert.ok(byArea[0].area < RAIL_TARGET_AREA);
  assert.ok(byArea.slice(1).every((x) => Math.abs(x.area - RAIL_TARGET_AREA) <= 1),
    'every other mark is exactly on target');
});

test('HBO Max came onto the target from ART ALONE, with no code change', () => {
  // Stage 5 predicted this: the `RAIL_BOX_W / a` term stops binding at aspect 4.51, so compact art
  // at or below that closes a short mark because the fit recomputes from the manifest.
  const hbo = manifest.find((m) => m.slug === 'hbo-max');
  const a = hbo.w / hbo.h;
  assert.ok(a <= 4.51, `aspect ${a.toFixed(2)} - was 6.30 before the 2025 stacked lockup`);
  const r = railMark('hbo-max');
  assert.ok(Math.abs(r.height * r.width - RAIL_TARGET_AREA) <= 1);
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
  // WAS `tbs`, and prompt 55 stage 2 gave TBS art - so the case moves onto a network that still
  // has none. ESPN3 is the only one left in the access profile, and it is unmarked on purpose:
  // the art supplied for it carries a "clearpng" watermark baked over the letterforms, which the
  // flood key cannot reach because it is not connected to the border. Recorded in register §23 so
  // nobody re-sources it blind.
  assert.equal(railMark('espn3'), null, 'ESPN3 has no art - the rail renders call letters');
  assert.equal(railMark(''), null);
  assert.equal(railMark(null), null);
});
