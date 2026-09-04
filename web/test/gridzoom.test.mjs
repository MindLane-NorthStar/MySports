// M4 + M6: zoom drives the SCALE MODEL, not a CSS transform.
//
// WHY THIS EXISTS. The grid used to zoom with `transform: scale(zoom)` on .mgrid-canvas. A transformed
// element becomes the containing block for its descendants, so the `position: sticky` network rail
// inside it resolved against the scaled canvas instead of the scrollport and slid across the screen
// under pinch - which is what Joe reported from the installed app, and what Chromium reproduced at
// +124.6px right of the scroller at zoom 2.5 and -272.8px left at 0.6.
//
// The fix is that zoom multiplies pxPerMin, so the canvas is genuinely wider rather than painted
// larger. That is a property of the sizing arithmetic, so it is pinned here without a DOM. The
// companion DOM assertions - rail pinned, painted width == laid-out width - are in scripts/qa-shots.mjs,
// because those can only be observed in a browser.

import test from 'node:test';
import assert from 'node:assert/strict';
import { makeScale } from '../lib/gridmodel.js';

const SEAM = 30;
// Two segments with a cut between them, the shape M3 produces on a real slate.
const SEGS = [{ start: 720, end: 960 }, { start: 1080, end: 1380 }];
const PPM = 0.42;

const widthAt = (zoom, segs = SEGS, seam = SEAM) => makeScale(segs, PPM * zoom, seam).width;

// makeScale accumulates one segment at a time, so `d1*ppm + d2*ppm` and `(d1+d2)*ppm` differ in the
// last bit. Every comparison against hand arithmetic is therefore approximate on purpose.
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);

test('the width at zoom 1 is the time span plus one seam', () => {
  const minutes = (960 - 720) + (1380 - 1080);
  near(widthAt(1), minutes * PPM + SEAM, 'zoom 1 width');
});

test('zooming scales the TIME portion of the width, and only that', () => {
  // The seam is a fixed marker, not content, so it does not stretch. This is the one behavioural
  // difference from the old transform, which scaled everything including the seam.
  const minutes = (960 - 720) + (1380 - 1080);
  for (const z of [0.6, 1, 1.5, 2.5]) {
    near(widthAt(z), minutes * PPM * z + SEAM, `zoom ${z}`);
  }
});

test('THE INVARIANT: width is a pure function of zoom, so the laid-out canvas cannot disagree with it', () => {
  // The transform bug was exactly this disagreement - the element was painted at width*zoom while
  // being laid out at width. Here there is only one number, and it is the one the canvas is set to.
  for (const z of [0.6, 1, 2.5]) {
    const s = makeScale(SEGS, PPM * z, SEAM);
    near(s.width, widthAt(z), `zoom ${z} width is stable`);
    assert.ok(Number.isFinite(s.width) && s.width > 0);
    // toX must live inside the width it just reported, at every zoom.
    assert.ok(s.toX(1380) <= s.width + 0.001, `toX(end) ${s.toX(1380)} > width ${s.width} at zoom ${z}`);
    assert.equal(s.toX(720), 0, 'the first minute is always the origin');
  }
});

test('zoom scales every x position by the same factor the width grew by', () => {
  const base = makeScale(SEGS, PPM, SEAM);
  const zoomed = makeScale(SEGS, PPM * 2.5, SEAM);
  for (const minute of [720, 840, 960, 1080, 1200, 1380]) {
    const b = base.toX(minute);
    const z = zoomed.toX(minute);
    // Positions inside the first segment scale cleanly; positions after a seam carry the unscaled
    // seam offset, so the check is that the TIME part scaled and the seam did not.
    const seamsBefore = base.segments.filter((s) => minute > s.end).length;
    assert.ok(Math.abs((z - seamsBefore * SEAM) - (b - seamsBefore * SEAM) * 2.5) < 0.001,
      `minute ${minute}: ${b} -> ${z}`);
  }
});

test('a zoom of 1 leaves the model byte-identical - no zoom is not a special case', () => {
  const a = makeScale(SEGS, PPM, SEAM);
  const b = makeScale(SEGS, PPM * 1, SEAM);
  assert.equal(a.width, b.width);
  assert.deepEqual(a.segments, b.segments);
});

test('an empty slate has zero width at every zoom rather than a negative one', () => {
  for (const z of [0.6, 1, 2.5]) {
    assert.equal(makeScale([], PPM * z, SEAM).width, 0);
    assert.equal(makeScale([], PPM * z, SEAM).toX(720), 0);
  }
});

test('the clamp range M6 grants is the range the scale must survive', () => {
  // MobileGrid clamps zoom to [0.6, 2.5]. Both ends, plus the midpoint, must produce a sane width.
  for (const z of [0.6, 1.55, 2.5]) {
    const w = widthAt(z);
    assert.ok(w > 0 && Number.isFinite(w));
  }
  assert.ok(widthAt(2.5) > widthAt(1) && widthAt(1) > widthAt(0.6), 'monotonic in zoom');
});
