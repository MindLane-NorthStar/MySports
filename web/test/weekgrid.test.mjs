// THE WEEK GRID (prompt 54).
//
// Joe: "Choosing 'Week 1 NFL' displays all cards for that week's NFL games - cards from Wednesday,
// Thursday and Sunday - and TV grid from Wednesday, Thursday and Sunday."
//
// A TV grid's x-axis is ONE viewing day's minutes, so seven days cannot share one horizontal ruler:
// a week grid is N grids stacked, one per day that has games, each under its own day heading.
//
// WHY THESE ARE CALL-SITE ASSERTIONS AND NOT PIXEL NUMBERS. `next build` cannot run on this laptop
// (rule 12), so the page cannot be served from a unit test - and more importantly, prompt 53 proved
// that the grid's pixel figures are a function of the STANDINGS: every block width and scrollWidth
// derive from `widest`, the widest rendered team line, which carries the record and the CFB poll
// rank. A test pinned to those numbers rots on its own within a week of the season. So this file
// pins what the WEEK BRANCH HANDS THE COMPONENT - rule 19's lesson, applied to rendering - and the
// runtime geometry is proved by qa/tools/geometry.mjs, whose day/week equality check is immune to
// data drift because both sides see the same standings on the same run.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');
const page = src('app/page.js');
const listing = src('components/Listing.js');
const grid = src('components/MobileGrid.js');

/** The week branch's <Listing> call, isolated so each assertion reads one thing. */
function weekListingCall() {
  const i = page.indexOf('grouped[d]?.length');
  assert.ok(i > 0, 'the week branch still maps days through grouped[d]');
  const j = page.indexOf('</div>', i);
  return page.slice(i, j);
}

test('the week hands each day a grid, gated on GRID VIEW', () => {
  const call = weekListingCall();
  assert.match(call, /grid=\{P\.isGrid\}/, 'the day gets a grid in GRID VIEW');
  assert.match(call, /gridOnly=\{P\.isGrid\}/,
    "prompt 53's list suppression is carried down PER DAY");
  assert.match(call, /day=\{d\}/, 'and the grid is told WHICH day it is');
  assert.match(call, /sport=\{P\.sport\}/, 'prompt 53 stage 5 added this; the grid needs it too');
});

test('WEEK + LIST gets no grid - the toggle is what turns it on', () => {
  // `grid={P.isGrid}` rather than a bare `grid`. A first pass passed it unconditionally and turned
  // the phone grid on in week + LIST, which changed a view this run was not asked to touch.
  //
  // COMMENTS ARE STRIPPED FIRST. A looser version of this test matched the word "grid" inside the
  // explanatory comment beside the call and failed on prose.
  const call = weekListingCall()
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.match(call, /grid=\{P\.isGrid\}/);
  assert.doesNotMatch(call, /\sgrid(?=[\s/>])/, 'no BARE `grid` attribute - it must be gated');
  assert.doesNotMatch(call, /grid=\{true\}/);
});

test('an empty day produces no grid, because it produces no day group at all', () => {
  // The whole `.weekday` block is inside `grouped[d]?.length ? (...) : null`, so a day with nothing
  // loaded contributes neither a heading nor a grid. Seven empty grids would be worse than none.
  assert.match(page, /grouped\[d\]\?\.length \? \(/);
});

test('the now marker is server-computed and lands on exactly one day', () => {
  // A clock that reaches the client is a hydration mismatch - the trap prompt 42 fell into twice.
  assert.match(page, /const weekNow = viewingMinutes\(new Date\(\)\.toISOString\(\)\)/,
    'computed on the server, from the request time, exactly as day mode does it');
  const call = weekListingCall();
  assert.match(call, /nowMinute=\{d === today \? weekNow : null\}/,
    'and only the day that IS today gets one');
});

test('gridOnly suppresses the CARDS, never the day heading above them', () => {
  // A column of unlabelled grids is unreadable, and Joe's model is explicit that the grid comes
  // "from Wednesday, Thursday and Sunday". A first pass lost every heading in week + GRID.
  //
  // R4, prompt 56: the heading is now ONE object built once and rendered before the branch, so this
  // pins that it is outside `gridOnly`'s ternary rather than repeated inside it.
  assert.match(listing, /const dayHeading = heading \? \(/);
  assert.match(listing, /\{dayHeading\}\s+\{gridOnly \? null : bands \? \(/,
    'the heading renders BEFORE the branch that suppresses the cards, so gridOnly cannot lose it');
  // and the cards are still suppressed
  assert.match(listing, /\{gridOnly \? null : bands \? \(/);
});

// R3 + R4, prompt 56.
test('R4: the weekday heading is ONE object at ONE level - nothing goes into SportBand', () => {
  // It used to be a <p> sibling above the bands under ALL SPORTS and a `sectionLabel` INSIDE
  // `.band-headrow` with a tile selected: same text, same class, two DOM levels.
  assert.doesNotMatch(listing, /sectionLabel=/, 'Listing no longer passes a heading down');
  const band = src('components/SportBand.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(band, /sectionLabel/, 'and SportBand no longer accepts one');
  assert.doesNotMatch(band, /headingClass/, 'nor the class that only existed to style it');
  // The dead branch it fed: every band carrying a sectionLabel was marked as the retired
  // page-level favourites section, which under week mode meant every weekday.
  assert.match(band, /className="band"/, 'one class, unconditionally');
  // COMMENTS STRIPPED, and that is not cosmetic: both removals are RECORDED in comments at the
  // sites they left, which name the selectors. Asserting against the raw file would be asserting
  // that the record does not exist.
  const rules = src('app/globals.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(rules, /\.listing > \.yourteams/, 'and its order rule is gone with it');
  assert.doesNotMatch(rules, /\.band-headrow > \.favlabel/, 'as is the rule that un-styled it');
});

test('R3: the week names its league - the weekday row carries the mark, and it is not decorative', () => {
  assert.match(listing, /const headMark = sport \? sportMarkUrl\(sport\) : null;/,
    'the mark is gated on a SELECTED sport - under ALL SPORTS the bands carry their own');
  assert.match(listing, /alt=\{SPORT_LABEL\[sport\] \|\| sport\}/,
    'a real accessible name: this mark is the ONLY thing on the row naming the league, unlike a ' +
    'band mark, which sits beside an <h2> that already says it');
  const css = src('app/globals.css');
  assert.match(css, /\.weekday-head \{ display: flex;/, 'the heading is a row so it can hold both');
  assert.match(css, /\.weekday \.band-mark \{ height: 21px; \}/,
    'and the size stays the one .weekday already set - not restated');
});

test('the desktop week promotes archived grids and never falls back to the phone grid', () => {
  // The mobile grid is phone-only: the Mobile Grid Addendum's deviations are phone-only and M5 says
  // "PC keeps v1.2 labels". Both grids are in the DOM and a media query at 699px chooses - never a
  // JS width state, which would put a hydration mismatch back.
  assert.match(page, /<ArchivedGridFigure grid=\{weekGrids\.get\(d\)\} sport=\{P\.sport\} day=\{d\}/);
  assert.match(page, /className="deskgrid-only"/);
  const css = src('app/globals.css');
  assert.match(css, /\.deskgrid-only \{ display: block; \}/);
  assert.match(css, /max-width: 699px\)[\s\S]{0,80}\.deskgrid-only \{ display: none; \}/);
});

test('the week resolves its archived grids ONCE and names the misses in one line', () => {
  // ArchivedGrid renders its own honest one-liner per day, which is right for ONE day where the note
  // IS the answer. Seven stacked is noise.
  assert.match(page, /const weekGrids = new Map\(/);
  assert.match(page, /const gridMissing = gridDays\.filter\(/);
  assert.match(page, /No archived PC grid yet for/);
});

test('the ALL SPORTS desktop sentence is ONE component, used by both modes', () => {
  // Two copies of a sentence are two things free to drift.
  assert.match(page, /function DesktopGridPerLeague\(\)/);
  const uses = page.match(/<DesktopGridPerLeague \/>/g) || [];
  assert.equal(uses.length, 2, 'day mode and week mode, from the same component');
  const sentences = page.match(/The desktop grid is rendered per league/g) || [];
  assert.equal(sentences.length, 1, 'and the words exist exactly once');
});

test('the canvas carries the diagnostics that tell DATA drift from CODE drift', () => {
  // Prompt 53 needed a full stash-and-remeasure to prove the MLB tripwire had moved on the
  // standings rather than on code. With these on the element it is one step: `widest` moved and
  // scrollWidth/widest held -> data. The RATIO moved -> code.
  assert.match(grid, /data-day=\{day\}/);
  assert.match(grid, /data-widest=\{model\.widest\.toFixed\(3\)\}/);
  assert.match(grid, /data-pxpermin=\{model\.pxPerMin\.toFixed\(6\)\}/);
});

test('block widths still derive from `widest`, which is why they are REPORTED not asserted', () => {
  // The mechanism, pinned so a future change to it is visible: `widest` is measured from the
  // rendered team line INCLUDING the record and the rank, and pxPerMin divides it.
  assert.match(grid, /widest = Math\.max\(widest, measure\(text, nameFont\)\)/);
  assert.match(grid, /\$\{at\}\$\{l\.rank \? `\$\{l\.rank\} ` : ''\}\$\{l\.name\}\$\{l\.record \? ` \$\{l\.record\}` : ''\}/);
  assert.match(grid, /const pxPerMin = pxPerMinute\(widest \/ SCALE, scaleSport\) \* SCALE/);
});
