// STAGE 8, prompt 56: ONE VERTICAL RHYTHM BELOW THE PICKER.
//
// Joe, 2026-09-06: "evaluate the vertical spacing between cards and between sections that render
// below the picker - make sure they're standardized and not excessive."
//
// THE SCALE, derived from the control stack's own 8px rhythm (prompt 51):
//     8px   card -> card, and anything inside one group
//    16px   a heading -> the content it labels
//    24px   one section -> the next section
//
// WHAT THIS FILE CAN AND CANNOT DO. It cannot measure a RENDERED gap - that needs a browser, and
// the measured before/after table lives in prompt 56's report and in handoff-status. What it CAN do
// is pin the declarations the measurement resolved to, so that a later edit which quietly reopens
// one of them fails here rather than on Joe's phone. Each assertion names the rendered pair it
// produced, because the declaration alone never tells you the gap (`.listing` is a flex column, so
// nothing collapses out of it; elsewhere adjacent block margins do).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, '..', 'app', 'globals.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');            // the rules, never the prose about them

test('8px: card -> card, and the rule that closes the favourites group inside a band', () => {
  assert.match(css, /\.cards\s*\{[^}]*gap:\s*8px/, 'card -> card measured 8');
  // `.favrule` was retired by prompt 59 and `.favgroup` by prompt 82 block D2. The 8px this test
  // was really about is the step BETWEEN CARDS, and that is `.cards`' own gap - which is where it
  // always lived. The group's `margin-bottom: 8px` only ever restated it for the one seam below the
  // floated group, and with no group there is no second seam to keep in step.
  //
  // PINNED ON THE SURVIVING RULE, not the deleted one. A favourite card now sits in the ordinary
  // flow at the ordinary gap, which is exactly what "the mark is not a position" means in pixels.
  assert.match(css, /\.cards \{[^}]*gap: 8px;/, 'card -> card is the 8px inside-one-group step');
  assert.doesNotMatch(css, /\.favrule\{/, 'the hairline is gone');
  assert.doesNotMatch(css, /\.favgroup/, 'and so is the group whose margin used to restate the 8');
});

test('24px: band -> band, and the two lines at the foot of the page', () => {
  assert.match(css, /\.band\{margin:0 0 24px\}/, 'band -> band measured 26, now 24');
  // ONE rule sets TWO pairs, because both lines carry .footnote: count line -> provenance, and
  // provenance -> the timezone line. Both measured 34.
  assert.match(css, /\.footnote \{[^}]*margin-top:\s*24px/);
});

test('the last band in a listing carries NO trailing margin - the largest excess measured', () => {
  // `.listing` is a flex column, so a trailing margin does not collapse out of it: it simply made
  // the container taller. At 390 before this rule the last card of a day group sat 61px above the
  // next day's heading and 44px above the page count line, against 8px between cards.
  assert.match(css, /\.listing > \.band:last-child\{margin-bottom:0\}/);
  // `.pagecount-hidden` has had the same rule since prompt 50; this is its `.listing` twin.
  assert.match(css, /\.pagecount-hidden > \.band:last-child \{ margin-bottom: 0; \}/);
});

test('24px between day groups, from two owners that each mean something', () => {
  // The day heading owns a 16px clearance; a day group leaves 8px below it. 8 + 16 = 24 between
  // groups, and the control stack's own 8px padding + the same 16 = 24 above the first one.
  assert.match(css, /\.weekday \{\s*margin: 0;\s*\}/, 'the group itself carries nothing');
  assert.match(css, /\.weekday \+ \.weekday \{ margin-top: 8px; \}/);
  assert.match(css, /\.weekday h3, \.weekday-head \{[^}]*margin: 16px 0 6px;/,
    'the top margin is DECLARED - it was the UA\u2019s unchosen 1em (21px at 21px type)');
});

test('the scope line leaves the caption gap, and the first day does not leave a second', () => {
  assert.match(css, /\.scopeline \{[^}]*margin: 0 0 16px;/, 'a heading -> its content is 16');
  assert.match(css, /\.scopeline \+ \.weekday \.weekday-head \{ margin-top: 0; \}/,
    'without this the pair measured 32 - the caption\u2019s 16 plus the day heading\u2019s own 16');
});

test('the phone grid gives up the gap BELOW it and keeps the one above', () => {
  // Below: 20px, which stacked with the day step to put 55px between one day\u2019s grid and the next
  // day\u2019s heading in a week. Above: 14px, which with the control stack\u2019s 8px makes
  // picker -> grid 22px - under the 24px section target, and hard rule 1 forbids opening it up.
  assert.match(css, /\.mgrid \{[^}]*margin: 14px 0 0;/);
});

test('the three hard rules are recorded in the stylesheet, not only in a prompt', () => {
  const withProse = readFileSync(join(HERE, '..', 'app', 'globals.css'), 'utf8');
  assert.match(withProse, /NO RENDERED GAP MAY GROW/);
  assert.match(withProse, /NOTHING INSIDE A LIST CARD OR A GRID BLOCK CHANGES/);
  assert.match(withProse, /THE CONTROL STACK IS OUT OF SCOPE/);
});
