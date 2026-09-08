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

import { decideScroll, scrollTargetFor, SCROLL_GAP } from '../lib/autoscroll.js';

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

test('the header is collapsed BEFORE anything is measured', () => {
  // The order is the whole defence against headerstate.js's scroll compensation fighting this.
  const c = src('components/AutoScroll.js');
  const collapse = c.indexOf('collapseHeader()');
  const measure = c.indexOf('getBoundingClientRect');
  assert.ok(collapse > 0 && measure > 0);
  assert.ok(c.indexOf('collapseHeader();') < c.indexOf('requestAnimationFrame'),
    'collapse must happen before the measuring frame is scheduled');
});

test('reduced motion is honoured', () => {
  const c = src('components/AutoScroll.js');
  assert.match(c, /prefers-reduced-motion: reduce/);
  assert.match(c, /behavior: reduced \? 'auto' : 'smooth'/);
});

test('the offset clears BOTH sticky elements, not just the bar', () => {
  // `.chdr` sticks at 0 and `.pickrow` sticks under it at var(--stack-h). Clearing only the first
  // parks the target behind the picker - measured at 56px against a 92px stack before this was
  // fixed.
  //
  // THE INVARIANT IS THAT THE GAP IS ADDED TO stackBottom(), NOT WHAT THE GAP IS. It went 8 -> 16 in
  // prompt 68 because 8px seated a league logo hard under the gold rule; it may move again, and this
  // reads the constant rather than restating it so that a change of taste does not fail a structural
  // test. What must not change is the two terms it is added to.
  const lib = src('lib/autoscroll.js');
  assert.match(lib, /--stack-h/);
  assert.match(lib, /querySelector\('\.pickrow'\)/);
  assert.match(src('components/AutoScroll.js'),
    /getBoundingClientRect\(\)\.top - stackBottom\(\) - SCROLL_GAP/);
  assert.equal(SCROLL_GAP, 16, 'prompt 68 set the landing gap to the 16px heading-to-content step');
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
  assert.match(c, /if \(entry\.scroll\) land\(\)/);
  assert.match(c, /if \(back\.scroll\) land\(\)/);
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
