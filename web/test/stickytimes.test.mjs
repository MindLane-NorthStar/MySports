// THE TIME ROW LOCKS UNDER THE PICKER (prompt 86 block C, Joe's Route A).
//
// The axis was hoisted out of `.mgrid-scroll`, because a sticky `top` inside a box that scrolls on
// either axis resolves against that box, and `.mgrid-scroll` never scrolls vertically. Its horizontal
// position is kept in step by a transform on the TRACK. That makes this the one change to this
// component that ADDS a transform - which is exactly what M4 exists to police - so the relationship
// is asserted here rather than reasoned about in a comment.
//
// These read source, because `node --test` cannot mount the component. qa-shots measures the same
// things in the served page: the axis top against --stack-h + --pick-h, the noon label and gridline
// against the lanes' noon gridline after a pan, and the rail's ancestors in the live DOM.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { region, after, anchorAt } from './region.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const css = () => src('app/globals.css').replace(/\/\*[\s\S]*?\*\//g, '');
/** The body of the FIRST rule whose selector list is exactly `sel`. */
const rule = (sheet, sel) => region(sheet, `${sel} {`, '}', `the ${sel} rule`);

const AXIS = '<div className="mgrid-axis" ref={axisRef}>';
const SCROLL = '<div className="mgrid-scroll" ref={scrollRef}>';

// ------------------------------------------------------------------------------- the structure
test('.mgrid-axis is NOT a descendant of .mgrid-scroll - it renders immediately before it', () => {
  const g = code('components/MobileGrid.js');
  assert.ok(anchorAt(g, AXIS, 'the axis') < anchorAt(g, SCROLL, 'the scroller'), 'the axis comes first');
  // between the axis opening and the scroller opening: the axis's own subtree, and no scroller
  const axisBlock = region(g, AXIS, SCROLL, 'the axis block');
  assert.doesNotMatch(axisBlock, /mgrid-scroll|mgrid-canvas|mgrid-row/, 'nothing of the scroller inside it');
  // and no second time row inside the scroller - the reach below is `mgrid-axis-reach`, never these
  assert.doesNotMatch(after(g, SCROLL, 'the scroller onward'),
    /className="mgrid-axis"|className="mgrid-axis-track"|className="mgrid-axis-rail"|ref=\{trackRef\}|ref=\{axisRef\}/,
    'no second axis left behind inside the scroller');
});

test('the axis\'s REACH stays in the canvas, invisible and inert, so a full pan still shows the last label', () => {
  // Hoisted out, the last hour label's overhang stopped counting toward scrollWidth: CFB 1273 -> 1248,
  // MLB 568 -> 556, and at full pan the last label sat just past the edge. The same labels, laid out
  // again in the canvas at zero height, restore the reach - and are nothing else.
  const g = code('components/MobileGrid.js');
  const canvas = region(g, '<div\n          className="mgrid-canvas"', '<div className="mgrid-row"', 'the canvas head');
  const reach = region(canvas, '<div className="mgrid-axis-reach" aria-hidden="true">', '{nowMinute', 'the reach');
  assert.match(reach, /<div className="mgrid-axis-reach-track" style=\{\{ width: scale\.width \}\}>/);
  assert.match(reach, /ticks\.labels\.map/, 'the SAME labels');
  assert.match(reach, /className="maxis-reach-label"/, 'its own class, so `.maxis-label` still means a visible label');
  assert.doesNotMatch(reach, /className="maxis-label"/);
  assert.match(css(), /\.maxis-label,\s*\.maxis-reach-label \{/, 'and the same metrics, to the pixel');
  assert.doesNotMatch(reach, /ref=|transform|data-minute/, 'not synced, not measured, not a second row');
  const r = rule(css(), '.mgrid-axis-reach');
  assert.match(r, /height: 0;/);
  assert.match(r, /visibility: hidden;/, 'no paint, but the layout that makes the reach');
  assert.match(r, /pointer-events: none;/);
});

test('the axis keeps its two children: the corner and the track', () => {
  const axisBlock = region(code('components/MobileGrid.js'), AXIS, SCROLL, 'the axis block');
  assert.match(axisBlock, /<div className="mgrid-axis-rail" \/>/);
  assert.match(axisBlock, /<div className="mgrid-axis-track" ref=\{trackRef\} style=\{\{ width: scale\.width \}\}>/);
});

// ------------------------------------------------------------------------------- the transform
test('the transform is written to the TRACK and to nothing else', () => {
  const g = code('components/MobileGrid.js');
  const writes = g.match(/\.style\.transform\s*=/g) || [];
  assert.equal(writes.length, 1, 'exactly one transform write in the component');
  assert.match(g, /track\.style\.transform = `translateX\(\$\{-el\.scrollLeft\}px\)`;/);
  assert.match(g, /const track = trackRef\.current;/);
  assert.equal((g.match(/ref=\{trackRef\}/g) || []).length, 1, 'trackRef is attached to one element');
  // and no JSX style anywhere in the component carries one
  assert.doesNotMatch(g, /style=\{\{[^}]*transform/, 'no inline transform in the JSX');
});

test('M4: .mrail-cell has no transformed ancestor up to .mgrid-scroll', () => {
  const g = code('components/MobileGrid.js');
  // The chain, in source order: .mgrid-scroll > .mgrid-canvas > .mgrid-row > .mrail-cell.
  const chain = region(g, SCROLL, '<div className="mrail-cell">', 'scroller to rail');
  for (const cls of ['mgrid-canvas', 'mgrid-row']) {
    assert.match(chain, new RegExp(`className="${cls}"`), `${cls} is on the path`);
  }
  assert.doesNotMatch(chain, /trackRef|transform/, 'the synced transform is not on the rail\'s path');
  // and none of those three boxes gets a containing-block-making property from the stylesheet
  // (transform, filter, perspective, backdrop-filter, will-change, contain - the list globals.css
  // records beside .mrail-cell)
  const sheet = css();
  for (const sel of ['.mgrid-scroll', '.mgrid-canvas', '.mgrid-row']) {
    assert.doesNotMatch(rule(sheet, sel), /\b(transform|filter|perspective|backdrop-filter|will-change|contain)\s*:/,
      `${sel} must not become the rail's containing block`);
  }
});

// ------------------------------------------------------------------------------- the sync
test('the sync is a PASSIVE listener on the scroller, one write per frame, and never React state', () => {
  const g = code('components/MobileGrid.js');
  const effect = region(g, 'const trackRef = useRef(null);', '}, [scale, rows.length]);', 'the sync effect');
  assert.match(effect, /const el = scrollRef\.current;/, 'on the grid\'s own scroller');
  assert.match(effect, /el\.addEventListener\('scroll', onScroll, \{ passive: true \}\);/);
  assert.match(effect, /if \(!frame\) frame = requestAnimationFrame\(sync\);/, 'coalesced');
  assert.match(effect, /el\.removeEventListener\('scroll', onScroll\);/, 'torn down');
  assert.match(effect, /cancelAnimationFrame\(frame\)/, 'a pending frame is cancelled on teardown');
  assert.match(effect, /\n\s+sync\(\);\n/, 'runs once on mount, before any scroll');
  assert.doesNotMatch(effect, /\bset[A-Z]\w*\(/, 'no React state in the scroll path');
  // re-run whenever the scale changes, so a pinch-zoom cannot leave the strip behind
  assert.match(g, /\}, \[scale, rows\.length\]\);/);
});

test('the time row still takes the grid\'s gestures - a pinch zooms and a swipe pans', () => {
  // Hoisted out of the scroller, the row lost both, and qa-shots' pinch "60px lower" landed on it
  // and failed. The pinch handlers listen on the row as well as the scroller; a one-finger drag on
  // the row moves the scroller, whose scroll the sync then follows.
  const g = code('components/MobileGrid.js');
  assert.match(g, /const targets = \[scrollRef\.current, axisRef\.current\]\.filter\(Boolean\);/);
  assert.match(g, /el\.addEventListener\('touchmove', onMove, \{ passive: false \}\);/, 'the pinch may cancel');
  assert.match(g, /el\.scrollLeft = drag\.left - \(e\.touches\[0\]\.clientX - drag\.x\);/, 'the drag moves the SCROLLER');
  assert.match(g, /axis\.addEventListener\('touchmove', onMove, \{ passive: true \}\);/);
  assert.match(rule(css(), '.mgrid-axis'), /touch-action: pan-x pan-y;/, 'the scroller\'s own value');
});

// ------------------------------------------------------------------------------- the CSS
test('.mgrid clips with `clip`, not `hidden` - hidden would make it the sticky row\'s scroll container', () => {
  const r = rule(css(), '.mgrid');
  assert.match(r, /overflow: hidden;\s*overflow: clip;/, 'clip, with hidden only as the fallback line before it');
});

test('the axis clips its translated track and paints an opaque token ground', () => {
  const r = rule(css(), '.mgrid-axis');
  assert.match(r, /overflow: hidden;/);
  assert.match(r, /background: var\(--panel\);/, 'a token, never a literal (rule 16)');
  assert.match(rule(css(), '.mgrid-axis-track'), /flex: 0 0 auto;/, 'the track keeps scale.width');
});

test('the row pins ONLY when collapsed, flush under the picker, beneath the picker and the bar', () => {
  const sheet = css();
  const r = rule(sheet, "html[data-hdr='collapsed'] .mgrid-axis");
  assert.match(r, /position: sticky;/);
  assert.match(r, /top: calc\(var\(--stack-h, 44px\) \+ var\(--pick-h, 0px\)\);/);
  const z = (body) => Number(/z-index: (\d+);/.exec(body)[1]);
  const axisZ = z(r);
  const pickZ = z(rule(sheet, "html[data-hdr='collapsed'] .pickrow"));
  assert.ok(axisZ < pickZ, `axis ${axisZ} under picker ${pickZ}`);
  // and the unscoped rule never makes it sticky on its own
  assert.doesNotMatch(rule(sheet, '.mgrid-axis'), /position: sticky/);
});
