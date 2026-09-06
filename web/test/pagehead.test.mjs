// 05 section 12: the DATE / WEEK headings carry their picker, and each heading IS the picker's label.
//
// WHY SOURCE AND NOT A RENDER: these are async server components that read the database, so `node
// --test` cannot mount them - the same constraint nav.test.mjs works under. What decides the answer
// is textual anyway: whether the heading wraps a <label htmlFor> that names the control's id, and
// whether the control still renders a second label of its own. One label, one control, or the
// accessible name silently changes.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');

// Comments in these files SAY "<label" while explaining where the label went, so a bare grep for it
// finds prose. Assertions about what a component renders run against code with the comments removed.
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('DAY mode: the heading is the word DATE and it labels the date input', () => {
  // PROMPT 50: the three pages became one, so this now reads the hub. The heading is chosen by
  // `mode` rather than by which route you are on, which is the same fact expressed once.
  const page = src('app/page.js');
  assert.match(page, /htmlFor=\{P\.isWeek \? 'week-select' : 'viewing-day'\}/,
               'the label points at whichever picker the mode renders');
  assert.match(page, /\{P\.isWeek \? 'WEEK' : 'DATE'\}/,
               'and it renders the literal word, not a formatted date');
  assert.doesNotMatch(page, /<h1>\{longDay\(day\)\}<\/h1>/, 'the old formatted heading is gone');
  assert.match(page, /className="pagehead"[\s\S]{0,400}?<DatePicker day=\{P\.day\} \/>/,
               'and the picker sits in the same row as the heading');
});

test('Today: DatePicker owns the input and no second label', () => {
  const f = code('components/Filters.js');
  const fn = f.slice(f.indexOf('export function DatePicker'), f.indexOf('export function SportFilter'));
  assert.match(fn, /id="viewing-day"/, 'the id the heading points at');
  assert.doesNotMatch(fn, /<label/, 'the label moved to the heading; a second one would be a second name');
  assert.doesNotMatch(fn, /aria-label/, 'an aria-label would OVERRIDE the visible heading label');
});

test('WEEK mode: the week select sits in the same header row', () => {
  const page = src('app/page.js');
  assert.match(page, /className="pagehead"[\s\S]{0,600}?<WeekSelect /,
               'the week picker sits in the same row as the heading');
  assert.doesNotMatch(page, /<h1>Weeks<\/h1>/, 'the old heading is gone');
});

test('Weeks: WeekSelect owns the select and no second label', () => {
  const w = code('components/WeekSelect.js');
  assert.match(w, /id="week-select"/, 'the id the heading points at');
  assert.doesNotMatch(w, /<label/, 'prompt 25 4b\'s one real label is the heading now, not a duplicate');
});

test('ONE derivation of which week is selected', () => {
  // The heading renders the picker and the block below renders that week's games. Two copies of the
  // fallback chain would be free to drift, and the page would offer a week it was not showing.
  // It moved to the hub with the rest of the week model.
  const page = src('app/page.js');
  assert.equal((page.match(/currentWeekKey\(/g) || []).length, 1,
               'weekChoices() is the only place the pick is derived');
  assert.match(page, /function weekChoices\(/);
  // The hub has ONE call site where the three routes had three - the derivation cannot drift from
  // itself. Asserted as a count, so adding a second one fails here rather than in front of Joe.
  // Calls only - the `function weekChoices({` definition matches the same shape, so it is excluded
  // explicitly rather than by an off-by-one the next reader would have to rediscover.
  assert.equal((page.match(/(?<!function )weekChoices\(\{/g) || []).length, 1,
               'exactly one call site, so the picker and the block below cannot disagree');
});

test('the broadcast count and the Day row are gone from Today', () => {
  const page = src('app/page.js');
  assert.doesNotMatch(page, /broadcastCount/, 'the count helper is deleted, not just unmounted');
  assert.doesNotMatch(page, /dayrow|daycount/, 'and its row with it');
  const css = src('app/globals.css');
  assert.doesNotMatch(css, /^\.dayrow \{/m, 'the orphaned rules go too');
  assert.doesNotMatch(css, /^\.daycount \{/m);
});

test('History is retired as a ROUTE but not as functionality', () => {
  // Prompt 50 / R1. Its heading question is moot - there is no History page to head - but the thing
  // the page existed for must still be reachable, so the route redirects rather than 404ing and a
  // past `day` still renders that day's finals through the same card.
  const hist = src('app/history/page.js');
  assert.match(hist, /redirect\(/, 'the route still resolves');
  assert.doesNotMatch(hist, /<h1>History<\/h1>/, 'and no longer renders a page of its own');
});

test('the header row is styled, and the week trigger is allowed to shrink', () => {
  const css = src('app/globals.css');
  assert.match(css, /^\.pagehead \{[\s\S]*?align-items: center;/m, 'centred on the heading text box');
  assert.match(css, /^\.pagehead \.picker \{[\s\S]*?min-width: 0;/m,
               'min-width:0 is what lets the longest week label shrink instead of pushing the row wide');
});

// ---------------------------------------------------------------- prompt 46 unit 1C: the pickers
//
// The native control is what iOS opens; the FACE is what we draw. Both have to stay true, and only
// the source can say so here - these are server components reading the database.

test('both pickers keep a real native control under a drawn face', () => {
  const shell = code('components/Picker.js');
  assert.match(shell, /className=\{`picker /, 'the wrapper carries the shared class');
  assert.match(shell, /aria-hidden="true"/, 'the face must not be announced - the label already is');
  assert.match(shell, /\{control\}/, 'and the real control is rendered, not replaced');

  const css = src('app/globals.css');
  assert.match(css, /\.picker > select,\s*\.picker > input \{[\s\S]*?opacity: 0;/,
               'the control is transparent, not display:none - that would lose the tap target');
  assert.match(css, /\.picker > select,\s*\.picker > input \{[\s\S]*?font-size: 16px;/,
               '16px or Mobile Safari zooms the page when the invisible control takes focus');
  assert.match(css, /\.picker:focus-within \{[^}]*outline/, 'keyboard focus must still be visible');
});

test('the WEEK face is built from PARTS, never by splitting the joined label', () => {
  const page = src('app/page.js');
  assert.match(page, /const parts = \(w\) =>/, 'one builder for both forms');
  assert.match(page, /const join = \(p\) =>/, 'and the option text is assembled FROM the parts');
  assert.doesNotMatch(page, /\.split\(['"`]\s*·/, 'never parse the separator back out');
  assert.match(page, /selectedParts: parts\(selected\)/);

  const w = code('components/WeekSelect.js');
  assert.match(w, /className="pk-sport">\{p\.prefix\}/, 'season week: the sport-week is its own run');
  assert.match(w, /className="pk-range">\{p\.range\}/);
  assert.match(w, /pk-range pk-range--solo">\{p\.range\}/, 'calendar week: range only, no prefix');
  assert.match(w, /id="week-select"/, 'still the labelled native select');
});

test('the WEEK face colours follow Joe: gold sport-week, standings-grey range', () => {
  const css = src('app/globals.css');
  assert.match(css, /\.pk-sport \{[^}]*color: var\(--gold\)/);
  assert.match(css, /\.pk-range \{[^}]*color: var\(--dim\)/, '--dim is .tcol-rec, the standings line');
  assert.match(css, /\.pk-range--solo \{[^}]*color: var\(--ink\)/, 'a calendar week keeps trigger ink');
  // the prefix must never be the part that ellipsizes
  assert.match(css, /\.pk-sport \{[^}]*flex: 0 0 auto/);
  assert.match(css, /\.pk-range \{[^}]*text-overflow: ellipsis/);
});

test('the DATE face is longDay(), not a second formatter', () => {
  const f = code('components/Filters.js');
  assert.match(f, /\{longDay\(day\)\}/, 'reuse the formatter the old <h1> used');
  assert.match(f, /id="viewing-day"/);
  assert.match(f, /type="date"/, 'still a real date input, so iOS opens its calendar');
  assert.doesNotMatch(f, /toLocaleDateString/, 'no new date formatting in this component');
});

test('the header row cannot wrap the picker onto its own line', () => {
  // flex-wrap decides on an item's CONTENT width before shrinking is considered, so basis auto put
  // the long NFL face on a second line and broke "directly to the right of the header text".
  const css = src('app/globals.css');
  assert.match(css, /\.pagehead \.chip-select,\s*\.pagehead \.picker \{[\s\S]*?flex: 1 1 0;/);
});
