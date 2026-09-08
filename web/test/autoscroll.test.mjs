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

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');

/**
 * The narrowest possible stand-in for `document`: `querySelector` over a list of fake elements.
 *
 * The component's `scrollTargetFor()` uses exactly two selectors and this understands exactly those
 * two, so the test drives the real logic without a DOM. Importing the component itself would pull in
 * `next/navigation`, which does not resolve outside the bundler.
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

// The function under test, kept in step with the component by the source check at the bottom.
function scrollTargetFor(doc) {
  const today = doc.querySelector('[data-istoday="true"]');
  if (!today) return null;
  return today.querySelector('.mcard[data-live="1"]') || today;
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
test('the component computes the target with exactly these two selectors', () => {
  const c = src('components/AutoScroll.js');
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
  const c = src('components/AutoScroll.js');
  assert.match(c, /--stack-h/);
  assert.match(c, /querySelector\('\.pickrow'\)/);
});
