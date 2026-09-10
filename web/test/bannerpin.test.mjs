// THE BANNER PINS UNTIL THE READER'S OWN FIRST SCROLL (prompt 73, Joe's ruling 2026-09-09).
//
//   "make banner STICKY until the user scrolls, regardless of day/week, All Games/MyTeams,
//    List/Grid, All Sports or League tile."
//
// WHAT THIS COVERS AND WHAT IT DOES NOT. The pinning itself is a browser behaviour and was measured
// in one - ten view combinations, the landing figure for each, 247 scroll positions across four
// views with the banner's own pixels identical at every one, and the release under a real wheel.
// Those numbers are in the prompt-73 report and in handoff-archive.md (moved there by prompt 87). What is testable here without
// a browser is the WIRING, and it is the half a later edit is most likely to break silently:
//
//   * the attribute the stylesheet reads and the attribute the module writes are the same one;
//   * the banner stays IN FLOW - sticky, never fixed;
//   * the landing's clearance learns about the pin, or today's block lands behind it - which is now
//     `heldHeight`/`stackBottom` in lib/autoscroll.js and is pinned in autoscroll.test.mjs;
//   * the release listener is not INSTALLED while a landing is in flight, which is what makes the
//     auto-scroll unable to release the pin it exists to survive.

import test from 'node:test';
import assert from 'node:assert/strict';
import { region } from './region.mjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  PIN_ATTR, PIN_BANNER, armBannerPin, releaseBannerPin, bannerPinArmed, installPinRelease,
} from '../lib/bannerpin.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');

/**
 * The narrowest stand-in for `document` this module needs: an element that remembers one attribute,
 * and a `.banner` with a height. Both halves of the real thing that matter here.
 */
function fakeDoc({ bannerHeight = 124, banner = true } = {}) {
  const attrs = new Map();
  return {
    documentElement: {
      setAttribute: (k, v) => attrs.set(k, v),
      removeAttribute: (k) => attrs.delete(k),
      getAttribute: (k) => (attrs.has(k) ? attrs.get(k) : null),
    },
    querySelector: (sel) => (sel === '.banner' && banner
      ? { getBoundingClientRect: () => ({ height: bannerHeight }) }
      : null),
  };
}

// ---------------------------------------------------------------------------- the state itself
test('arm, read, release - one attribute on <html> and nothing else', () => {
  const doc = fakeDoc();
  assert.equal(bannerPinArmed(doc), false, 'nothing is pinned until something arms it');
  armBannerPin(doc);
  assert.equal(doc.documentElement.getAttribute(PIN_ATTR), PIN_BANNER);
  assert.equal(bannerPinArmed(doc), true);
  armBannerPin(doc);
  assert.equal(bannerPinArmed(doc), true, 'arming is idempotent');
  releaseBannerPin(doc);
  assert.equal(doc.documentElement.getAttribute(PIN_ATTR), null, 'released is ABSENT, not a value');
  assert.equal(bannerPinArmed(doc), false);
});

test('the stylesheet reads exactly the attribute the module writes', () => {
  // The `data-hdr` pair has this guard in lib/headerstate.js for the same reason: a stylesheet and a
  // module that name the same state twice will eventually name it differently.
  const css = src('app/globals.css');
  assert.match(css, /html\[data-pin='banner'\] \.banner \{/);
  assert.equal(PIN_ATTR, 'data-pin');
  assert.equal(PIN_BANNER, 'banner');
});

test('the banner stays IN FLOW - sticky, never fixed', () => {
  // Joe's ruling keeps the banner an ordinary flow element that happens to be pinned, and the
  // rejected alternative - a permanently fixed banner swapped for the navbar in place - would break
  // the sentinel, the compensation and the route back to the expanded banner. `position: fixed`
  // here is that alternative arriving by the back door.
  const css = src('app/globals.css');
  const body = region(css, "html[data-pin='banner'] .banner {", '}', 'the pin rule');
  assert.match(body, /position: sticky;/);
  assert.doesNotMatch(body, /position: fixed/);
  assert.match(body, /top: 0;/);
});

// ---------------------------------------------------------------------- the landing's clearance
//
// `pinnedBannerHeight()` LIVED HERE AND IS GONE (prompt 74). The landing no longer asks this module
// how tall the pinned banner is; `lib/autoscroll.js` asks each of the three candidate boxes whether
// it resolved to `position: sticky` and measures the ones that did. The tests that used to stand
// here moved with the code, to autoscroll.test.mjs, and cover more than they did: the same predicate
// now answers for `.chdr` and `.pickrow` as well, which is what fixed prompt 73's 31px of air.

test('the pin does NOT feed --stack-h, and does not publish a height of its own', () => {
  // `--stack-h` is the offset `.pickrow` sticks at, and the picker only sticks while the header is
  // COLLAPSED - where the banner is display:none. Folding the banner in would push the picker down
  // by a banner nobody can see. A companion property no stylesheet reads would be a second copy of a
  // height that can go stale; a `pinnedBannerHeight()` export would be a second ANSWER to a question
  // the layout can already be asked. This module owns the STATE and nothing else.
  const pin = src('lib/bannerpin.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(pin, /setProperty/, 'the pin writes no custom property');
  assert.doesNotMatch(pin, /--stack-h/, "and does not touch the picker's offset");
  assert.doesNotMatch(pin, /getBoundingClientRect/, 'and measures no layout at all');
});

// -------------------------------------------------------------------------------- the release
test('the release listener fires ONCE and removes itself', () => {
  // Not a scroll handler that lives for the life of the document - the thing CollapsedHeader.js's
  // observer note rules out. It is re-armed by the next navigation, which re-runs the effect.
  const doc = fakeDoc();
  armBannerPin(doc);
  const handlers = [];
  const win = {
    document: doc,
    addEventListener: (t, fn, opts) => handlers.push({ t, fn, opts }),
    removeEventListener: (t, fn) => {
      const i = handlers.findIndex((h) => h.t === t && h.fn === fn);
      if (i >= 0) handlers.splice(i, 1);
    },
  };
  const stop = installPinRelease(win);
  assert.equal(handlers.length, 1);
  assert.equal(handlers[0].t, 'scroll');
  assert.deepEqual(handlers[0].opts, { passive: true }, 'passive: it never cancels a scroll');
  handlers[0].fn();
  assert.equal(bannerPinArmed(doc), false, 'the reader scrolled, so the pin let go');
  assert.equal(handlers.length, 0, 'and the listener took itself off');
  stop();
});

test('the cleanup removes a listener that never fired', () => {
  const doc = fakeDoc();
  const handlers = [];
  const win = {
    document: doc,
    addEventListener: (t, fn) => handlers.push({ t, fn }),
    removeEventListener: (t, fn) => {
      const i = handlers.findIndex((h) => h.t === t && h.fn === fn);
      if (i >= 0) handlers.splice(i, 1);
    },
  };
  installPinRelease(win)();
  assert.equal(handlers.length, 0);
});

test('the LISTENER IS NOT INSTALLED WHILE A LANDING IS IN FLIGHT, and that is the whole defence', () => {
  // A release keyed on scrollY changing fires on the auto-scroll itself and the feature does
  // nothing. Prompt 71 closed the equivalent problem with a flag; a flag cannot close this one,
  // because `scrollBy` moves the offset synchronously and delivers its `scroll` event a frame
  // later - after `releaseScrollCollapse()` on the line below it has already run.
  //
  // So `land()` takes a `done` callback and IS the thing that installs the listener, one animation
  // frame after its last correction. Nothing it does can reach a listener that does not exist yet.
  const c = src('components/AutoScroll.js');
  assert.match(c, /const land = \(done\) => \{/);
  assert.match(c, /installPinRelease\(window\)/);
  assert.match(c, /if \(entry\.scroll\) land\(listen\); else listen\(\);/,
    'no landing means nothing to wait for, so the listener goes on immediately');
  assert.match(c, /requestAnimationFrame\(done\);/,
    'one frame after the correction, so the landing\'s own last scroll event is missed');
  // and the ONLY call is inside `listen` - the import above carries no parens, so one match is one
  // call site. A second one would mean a path that installs the listener without waiting.
  assert.equal((c.match(/installPinRelease\(/g) || []).length, 1,
    'exactly one call site, and it is guarded by `listen`');
});

test('the pin is armed on EVERY entry, cold open included, and re-armed on a return that scrolls', () => {
  // The SCROLL is suppressed on a cold open (prompt 68's arrival rule); the PIN is not, because
  // "sticky until the user scrolls" is true of a page nobody has scrolled yet. And arming once at
  // mount would hold the banner for the FIRST switch and lose it for every later one - the same
  // complaint one journey further along.
  const code = src('components/AutoScroll.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.match(code, /^\s*armBannerPin\(\);$/m, 'armed unconditionally at the top of the effect');
  assert.match(code, /if \(back\.scroll\) \{ rearm\(\); land\(listen\); \}/);
  // the effect keys on the view key, which is what makes every one of Joe's four toggles re-arm
  assert.match(code, /const key = `\$\{pathname\}\?\$\{params\}`;/);
  assert.match(code, /\}, \[key\]\);/);
});
