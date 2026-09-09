// Landing on what is on now - the TARGET rule (prompt 67 stage 2).
//
// WHAT THIS COVERS AND WHAT IT DOES NOT. The scrolling itself is a browser behaviour and is measured
// in the browser: four scenarios, the landing position of each, and that the grid's own horizontal
// scroll is not disturbed. Those numbers are in the prompt-67 report and in handoff-status.md. What
// is testable here without a browser is the DECISION - which element the page should land on - and
// that is the half most likely to be broken by a later edit, because it is one expression standing
// in for four view combinations.
//
// THE TARGET RULE, restated so a failure here says what was meant:
//   * the block marked `data-istoday="true"` - week mode marks one day, day mode marks #all-today;
//   * inside it, the FIRST `.mcard[data-live="1"]`, which is DOM order and therefore kickoff order;
//   * nothing at all when no block carries the attribute, which is a week without today, or a day
//     that is not today. That is the "never scroll" rule, and it needs no code of its own.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  decideScroll, scrollTargetFor, stackBottom, heldHeight, SCROLL_GAP, TOP_STACK,
} from '../lib/autoscroll.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');

/**
 * The narrowest possible stand-in for `document`: `querySelector` over a list of fake elements.
 *
 * `scrollTargetFor()` uses exactly two selectors and this understands exactly those two, so the test
 * drives the REAL function over a fake document. It used to carry a copy of that function, because
 * the only importable home for it was the component and the component pulls in `next/navigation`;
 * prompt 68 moved the pure half to `lib/autoscroll.js` and the copy went with it.
 */
function fakeDoc({ today = null, cards = [] } = {}) {
  const block = today
    ? {
      name: today,
      querySelector: (sel) => (sel === '.mcard[data-live="1"]'
        ? cards.find((c) => c.live) || null
        : null),
    }
    : null;
  return { querySelector: (sel) => (sel === '[data-istoday="true"]' ? block : null) };
}

test('no block marked today means NO SCROLL - a week that does not contain today', () => {
  assert.equal(scrollTargetFor(fakeDoc({ today: null })), null);
});

test('a day with nothing live lands on the day block itself', () => {
  const doc = fakeDoc({ today: 'sep-8', cards: [{ id: 'a' }, { id: 'b' }] });
  assert.equal(scrollTargetFor(doc).name, 'sep-8');
});

test('a live game wins over the day block', () => {
  const live = { id: 'c', live: true };
  const doc = fakeDoc({ today: 'sep-8', cards: [{ id: 'a' }, { id: 'b' }, live] });
  assert.equal(scrollTargetFor(doc), live);
});

test('the EARLIEST live game wins, which is DOM order', () => {
  // The list is chronological, so first-in-DOM is earliest-by-kickoff. Two live games and the
  // reader is taken to the one that started first, not the one furthest down the page.
  const first = { id: 'early', live: true };
  const later = { id: 'late', live: true };
  const doc = fakeDoc({ today: 'sep-8', cards: [{ id: 'a' }, first, { id: 'b' }, later] });
  assert.equal(scrollTargetFor(doc), first);
});

test('after the last game it is the day block again - the same as before the first', () => {
  // Cowork's reading of "top of the day before games start", flagged as such: a finished day is a
  // day with nothing on, and there is no live card to land on.
  const doc = fakeDoc({ today: 'sep-8', cards: [{ id: 'a' }, { id: 'b' }] });
  assert.equal(scrollTargetFor(doc).name, 'sep-8');
});

// ------------------------------------------------------------------ the wiring, asserted in source
test('the target is computed with exactly these two selectors', () => {
  // Read from lib/autoscroll.js since prompt 68 - the component no longer holds this.
  const c = src('lib/autoscroll.js');
  assert.match(c, /querySelector\('\[data-istoday="true"\]'\)/);
  assert.match(c, /querySelector\('\.mcard\[data-live="1"\]'\)/);
});

test('both anchors are written on the SERVER, so no clock reaches the client', () => {
  const page = src('app/page.js');
  // week mode: one block per day, today's marked
  assert.match(page, /data-daykey=\{d\}\s+data-istoday=\{d === today \? 'true' : undefined\}/);
  // day mode: #all-today carries the same pair
  assert.match(page, /id="all-today" data-daykey=\{day\} data-istoday=\{day === today \? 'true' : undefined\}/);
  const card = src('components/MatchupCard.js');
  assert.match(card, /result_status === 'in_progress'/, 'liveness comes from the row, on the server');
  assert.match(card, /data-live=\{live\}/);
});

test('the collapse is SUPPRESSED before anything is measured, and is never called', () => {
  // THIS TEST WAS PASSING VACUOUSLY AND PROMPT 73 FOUND IT. It read
  //
  //     assert.ok(c.indexOf('collapseHeader();') < c.indexOf('requestAnimationFrame'), ...)
  //
  // and prompt 71 had deleted that call - so `indexOf` returned -1, -1 is less than any real index,
  // and the assertion held for the one reason it was written to rule out. The first line was worse:
  // `c.indexOf('collapseHeader()')` found the string inside the COMMENT explaining the deletion, so
  // even the guard on it being present passed off prose.
  //
  // What the order actually has to be now is the same shape with the opposite call: the suppression
  // has to be in force before the measuring frame is scheduled, or the observer fires mid-flight,
  // spends headerstate.js's compensation, and lands the reader somewhere nobody chose.
  const code = src('components/AutoScroll.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const suppress = code.indexOf('suppressScrollCollapse();');
  const frame = code.indexOf('requestAnimationFrame');
  assert.ok(suppress > 0, 'the landing suppresses the scroll-driven collapse');
  assert.ok(frame > 0 && suppress < frame, 'and does it before the measuring frame is scheduled');
  assert.ok(code.indexOf('getBoundingClientRect') > 0);
  // AND THE COLLAPSE IS NOT CALLED AT ALL. Prompt 71's whole ruling: "once you change to week view
  // it closes the banner since the screen auto scrolls to the current day." Restoring the call is
  // the regression to catch, and comments are stripped so the note explaining the deletion cannot
  // be mistaken for the call.
  assert.doesNotMatch(code, /collapseHeader\s*\(/,
    'the landing must never collapse the header - prompt 71, and prompt 73 depends on it');
});

test('reduced motion is honoured', () => {
  const c = src('components/AutoScroll.js');
  assert.match(c, /prefers-reduced-motion: reduce/);
  assert.match(c, /behavior: reduced \? 'auto' : 'smooth'/);
});

/**
 * A document whose three candidate boxes each have a `position` and a height.
 *
 * The whole of what `stackBottom()` reads, and nothing else - so the real function runs over it
 * rather than a copy of it. `defaultView.getComputedStyle` is the shape a browser actually presents.
 */
function stackDoc({ chdr, pickrow, banner } = {}) {
  const mk = (spec) => (spec ? {
    __pos: spec.position,
    getBoundingClientRect: () => ({ height: spec.height }),
  } : null);
  const els = { '.chdr': mk(chdr), '.pickrow': mk(pickrow), '.banner': mk(banner) };
  const doc = {
    querySelector: (sel) => (sel in els ? els[sel] : null),
    defaultView: { getComputedStyle: (el) => ({ position: el.__pos }) },
  };
  return doc;
}

// THE FOUR REAL STATES, measured in the browser at 390 and pinned here as arithmetic. The header is
// expanded or collapsed and the banner is pinned or released; every landing since prompt 71 happens
// in the first of those and every one since prompt 73 happens with the pin armed.
//
//   .chdr      sticky always, `display: none` while expanded -> a zero-high box
//   .pickrow   sticky ONLY under html[data-hdr='collapsed']; static in the expanded stack
//   .banner    sticky ONLY under html[data-pin='banner']; relative otherwise, none when collapsed
//
// EVERY HEIGHT BELOW IS A BROWSER READING at 390, not a plausible number: expanded/pinned gives
// stackBottom 124 and a target at 140, collapsed gives 92.4 and 108.4 - and that second figure is
// the 92px stack this repo has recorded since prompt 60 and the 108px landing from before prompt 71,
// which is the control proving the collapsed path is untouched. With the league row open the bar
// measures 127 and the sum follows it to 175.4 with no arithmetic anywhere.
const EXPANDED_PINNED = { chdr: { position: 'sticky', height: 0 },
                          pickrow: { position: 'static', height: 31.4 },
                          banner: { position: 'sticky', height: 124 } };
const EXPANDED_LOOSE = { ...EXPANDED_PINNED, banner: { position: 'relative', height: 124 } };
const COLLAPSED = { chdr: { position: 'sticky', height: 44 },
                    pickrow: { position: 'sticky', height: 48.4 },
                    banner: { position: 'relative', height: 0 } };

test('the clearance counts what is STUCK, not what exists', () => {
  // PROMPT 74's FIX, and it is a correctness fix rather than a taste change. `stackBottom()` counted
  // `.pickrow` unconditionally - but the picker only STICKS while the header is collapsed, and since
  // prompt 71 every landing happens with the header EXPANDED. So the clearance reserved 31.4px for an
  // obstruction that was not there, and prompt 73's pinned banner turned that reservation into 47px
  // of the PREVIOUS day's card showing between the banner's gold rule and today's heading.
  assert.equal(stackBottom(stackDoc(EXPANDED_PINNED)), 124,
    'expanded and pinned: the banner alone holds the top edge');
  assert.equal(stackBottom(stackDoc(EXPANDED_LOOSE)), 0,
    'expanded and released: nothing is stuck, so nothing is cleared');
  assert.equal(stackBottom(stackDoc(COLLAPSED)), 92.4,
    'collapsed: the bar and the picker, and the banner is not on the screen');
});

test("124 + SCROLL_GAP is the landing, and the 16 is Joe's own buffer", () => {
  // 140, not 171.4. The 16px is prompt 69's ruling after he reported the league logo "super tight to
  // the gold line" - the same 16px `html[data-hdr='collapsed'] .pickrow` carries as margin-block, so
  // a landing that scrolls and a page that sits at the top open the same distance under the rule.
  assert.equal(stackBottom(stackDoc(EXPANDED_PINNED)) + SCROLL_GAP, 140);
  assert.equal(SCROLL_GAP, 16, 'prompt 68 set the landing gap to the 16px heading-to-content step');
});

test('stuck-ness is read off the computed position, never off data-hdr or data-pin', () => {
  // A rule written as "if expanded, skip the picker" is wrong the first time a third state exists,
  // and there are already six: two header states x two pin states, times an open or closed league
  // row. Asking the element what it RESOLVED to asks the only authority there is - and no single
  // attribute could answer for all three anyway, since `.chdr` and `.pickrow` are switched by
  // `data-hdr` and `.banner` by `data-pin`.
  const lib = src('lib/autoscroll.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(lib, /data-hdr/, 'the clearance never reads the header attribute');
  assert.doesNotMatch(lib, /data-pin/, 'nor the pin attribute');
  assert.match(lib, /getComputedStyle\(el\)\.position/);
  assert.deepEqual(TOP_STACK, ['.chdr', '.pickrow', '.banner'],
    'three candidates, in the order they stack');
});

test('a hidden box answers itself, so no second display check is needed', () => {
  // `.chdr` is `position: sticky` unconditionally and `display: none` while the header is expanded;
  // `.banner` is hidden outright while it is collapsed. Both report a zero-high rect, so the sum is
  // right without anything having to remember to zero them.
  const doc = stackDoc(EXPANDED_PINNED);
  assert.equal(heldHeight(doc, '.chdr'), 0, 'sticky but display:none contributes nothing');
  assert.equal(heldHeight(doc, '.banner'), 124);
});

test('an element that is not sticky contributes nothing however tall it is', () => {
  const doc = stackDoc(EXPANDED_PINNED);
  assert.equal(heldHeight(doc, '.pickrow'), 0, 'static, 31.4px tall, and not in the way');
});

test('a missing element is 0 rather than a throw', () => {
  const doc = stackDoc({ ...EXPANDED_PINNED, pickrow: null });
  assert.equal(heldHeight(doc, '.pickrow'), 0);
  assert.equal(stackBottom(doc), 124, 'and the sum is unaffected');
});

test('`--stack-h` IS NO LONGER READ BY THE LANDING, and that is deliberate', () => {
  // It is written from `.chdr`'s box by a ResizeObserver, so reading it gave exactly what measuring
  // `.chdr` gives - while its BAR_FALLBACK could contribute a whole 44px bar in a state where the bar
  // is not on the screen, and reading it made the landing depend on an observer having run. The
  // property itself is untouched and still does its one job: the offset `.pickrow` sticks at.
  const lib = src('lib/autoscroll.js');
  assert.doesNotMatch(lib.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''),
    /--stack-h|BAR_FALLBACK/, 'neither the property nor its fallback survives in code');
  // and it is still what the PICKER sticks at, which is the job it was written for
  assert.match(src('app/globals.css'), /top: var\(--stack-h, 44px\);/);
  assert.match(src('components/CollapsedHeader.js'), /setProperty\(\s*'--stack-h'/);
});

test('the landing subtracts the clearance and the gap, in that order', () => {
  assert.match(src('components/AutoScroll.js'),
    /getBoundingClientRect\(\)\.top - stackBottom\(\) - SCROLL_GAP/);
});

// ------------------------------------------------------- the arrival rule (prompt 68, Joe's ruling)
//
// "Can we tune the auto-scroll to NOT work on first opening of the app?" - a deliberate narrowing of
// prompt 67's trigger, which fired on every entry AND every return from the background.
//
// THE RULE: the scroll never fires until the reader has navigated within the app at least once IN
// THIS DOCUMENT. It is stronger than "skip the first run" because an iOS home-screen PWA usually
// keeps its document across a backgrounding, so Joe's "opening the app" is normally a
// visibilitychange and not a mount. Suppressing only the mount would leave the complaint intact for
// the most common way he opens it.
//
// The five rows below are the five rows of the ruling, in order.

const fresh = () => ({ arrivalKey: null, navigated: false });

test('ROW 1 - a cold open does not scroll, and records the arrival', () => {
  const r = decideScroll(fresh(), 'entry', '/?day=2026-09-08');
  assert.equal(r.scroll, false);
  assert.deepEqual(r.state, { arrivalKey: '/?day=2026-09-08', navigated: false });
});

test('ROW 2 - background and return, having navigated nowhere, does not scroll', () => {
  const arrived = decideScroll(fresh(), 'entry', '/?day=2026-09-08').state;
  const back = decideScroll(arrived, 'return', null);
  assert.equal(back.scroll, false, 'the view is left exactly as it was');
  assert.deepEqual(back.state, arrived, 'and a return never promotes');
});

test('ROW 3 - changing day, week, sport, scope or view DOES scroll', () => {
  let st = decideScroll(fresh(), 'entry', '/?day=2026-09-08').state;
  for (const key of ['/?day=2026-09-09', '/?mode=week&w=2026-09-07', '/?day=2026-09-09&sport=nfl',
                     '/?day=2026-09-09&scope=mine', '/?day=2026-09-09&view=grid']) {
    const r = decideScroll(st, 'entry', key);
    assert.equal(r.scroll, true, key);
    st = r.state;
  }
});

test('ROW 4 - background and return AFTER a navigation does scroll', () => {
  let st = decideScroll(fresh(), 'entry', '/?day=2026-09-08').state;
  st = decideScroll(st, 'entry', '/?day=2026-09-09').state;
  assert.equal(decideScroll(st, 'return', null).scroll, true);
});

test('ROW 5 - a reload is a FRESH DOCUMENT, so it is an arrival again', () => {
  // Module scope carries the state, so a pull-to-refresh or iOS evicting the PWA resets it. This is
  // the row that rules out sessionStorage, which would survive the reload and suppress nothing.
  let st = decideScroll(fresh(), 'entry', '/?day=2026-09-08').state;
  st = decideScroll(st, 'entry', '/?day=2026-09-09').state;
  assert.equal(decideScroll(st, 'return', null).scroll, true, 'still armed before the reload');
  assert.equal(decideScroll(fresh(), 'entry', '/?day=2026-09-09').scroll, false, 'and silent after');
});

test('returning to the key the document arrived on still scrolls once navigation has happened', () => {
  // day A -> day B -> day A. `navigated` is sticky rather than a key compare, because the reader HAS
  // been navigating and arriving back where they started does not undo that.
  let st = decideScroll(fresh(), 'entry', '/?day=2026-09-08').state;
  st = decideScroll(st, 'entry', '/?day=2026-09-09').state;
  const backToStart = decideScroll(st, 'entry', '/?day=2026-09-08');
  assert.equal(backToStart.scroll, true);
});

test('React StrictMode double-invoking the effect on mount does not count as navigation', () => {
  // next.config sets reactStrictMode: true, so in development the effect runs twice on mount with
  // the SAME key. The second run must not arm the scroll.
  const first = decideScroll(fresh(), 'entry', '/?day=2026-09-08');
  const second = decideScroll(first.state, 'entry', '/?day=2026-09-08');
  assert.equal(first.scroll, false);
  assert.equal(second.scroll, false);
});

test('BOTH triggers go through the one predicate - the handler is the easy half to forget', () => {
  const c = src('components/AutoScroll.js');
  assert.match(c, /const entry = decideScroll\(entryState, 'entry', key\)/);
  assert.match(c, /const back = decideScroll\(entryState, 'return', null\)/);
  // `land` TAKES A CALLBACK SINCE PROMPT 73 - it tells lib/bannerpin.js when the landing is over -
  // so the shape is `land(listen)` rather than `land()`. What this test is about is unchanged: both
  // triggers go through the one predicate, and the handler is the easy half to forget.
  assert.match(c, /if \(entry\.scroll\) land\(listen\); else listen\(\);/);
  assert.match(c, /if \(back\.scroll\) \{ rearm\(\); land\(listen\); \}/);
});

test('the entry state is MODULE scope, not a ref and not sessionStorage', () => {
  // COMMENTS STRIPPED FIRST, and the first attempt at this test failed because they were not: the
  // component's own note says why a useRef and a sessionStorage key are both wrong, so a bare
  // doesNotMatch over the raw source matched the prose arguing against them. `code()` is the same
  // strip favbracket.test.mjs uses for the same reason.
  const code = src('components/AutoScroll.js')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.match(code, /^let entryState = \{ arrivalKey: null, navigated: false \};$/m,
    'module scope: survives re-renders and route changes, dies with the document');
  assert.doesNotMatch(code, /useRef/, 'a ref would reset on remount');
  assert.doesNotMatch(code, /sessionStorage/, 'sessionStorage would survive a reload');
});
