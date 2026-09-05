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
  assert.match(css, /^\.pagehead \.chip-select \{[\s\S]*?min-width: 0;/m,
               'min-width:0 is what lets the longest week label shrink instead of pushing the row wide');
});
