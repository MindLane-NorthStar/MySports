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

test('Today: the heading is the word DATE and it labels the date input', () => {
  const page = src('app/page.js');
  assert.match(page, /<h1><label htmlFor="viewing-day">DATE<\/label><\/h1>/,
               'the h1 renders the literal DATE, not a formatted date');
  assert.doesNotMatch(page, /<h1>\{longDay\(day\)\}<\/h1>/, 'the old formatted heading is gone');
  assert.match(page, /className="pagehead"[\s\S]{0,200}?<DatePicker day=\{day\} \/>/,
               'and the picker sits in the same row as the heading');
});

test('Today: DatePicker owns the input and no second label', () => {
  const f = code('components/Filters.js');
  const fn = f.slice(f.indexOf('export function DatePicker'), f.indexOf('export function SportFilter'));
  assert.match(fn, /id="viewing-day"/, 'the id the heading points at');
  assert.doesNotMatch(fn, /<label/, 'the label moved to the heading; a second one would be a second name');
  assert.doesNotMatch(fn, /aria-label/, 'an aria-label would OVERRIDE the visible heading label');
});

test('Weeks: the heading is the word WEEK and it labels the week select', () => {
  const page = src('app/weeks/page.js');
  assert.match(page, /<h1><label htmlFor="week-select">WEEK<\/label><\/h1>/);
  assert.doesNotMatch(page, /<h1>Weeks<\/h1>/, 'the old heading is gone');
  assert.match(page, /className="pagehead"[\s\S]{0,300}?<WeekSelect /,
               'and the picker sits in the same row as the heading');
});

test('Weeks: WeekSelect owns the select and no second label', () => {
  const w = code('components/WeekSelect.js');
  assert.match(w, /id="week-select"/, 'the id the heading points at');
  assert.doesNotMatch(w, /<label/, 'prompt 25 4b\'s one real label is the heading now, not a duplicate');
});

test('Weeks: ONE derivation of which week is selected', () => {
  // The heading renders the picker and the block below renders that week's games. Two copies of the
  // fallback chain would be free to drift, and the page would offer a week it was not showing.
  const page = src('app/weeks/page.js');
  assert.equal((page.match(/currentWeekKey\(/g) || []).length, 1,
               'weekChoices() is the only place the pick is derived');
  assert.match(page, /function weekChoices\(/);
  for (const caller of ['seasonMode: false', 'seasonMode: true', 'seasonMode })']) {
    assert.ok(page.includes(caller), `weekChoices is called with ${caller}`);
  }
});

test('the broadcast count and the Day row are gone from Today', () => {
  const page = src('app/page.js');
  assert.doesNotMatch(page, /broadcastCount/, 'the count helper is deleted, not just unmounted');
  assert.doesNotMatch(page, /dayrow|daycount/, 'and its row with it');
  const css = src('app/globals.css');
  assert.doesNotMatch(css, /^\.dayrow \{/m, 'the orphaned rules go too');
  assert.doesNotMatch(css, /^\.daycount \{/m);
});

test('History\'s heading is deliberately untouched', () => {
  // Joe: "we will address it later." If this fails, History was changed without a ruling.
  assert.match(src('app/history/page.js'), /<h1>History<\/h1>/);
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
  const page = src('app/weeks/page.js');
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
