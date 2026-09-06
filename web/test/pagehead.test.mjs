// The pickers, and the ONE thing that must never silently break about them: each has exactly one
// accessible name, and that name is visible on screen.
//
// WHY SOURCE AND NOT A RENDER: these are async server components that read the database, so `node
// --test` cannot mount them - the same constraint nav.test.mjs works under. What decides the answer
// is textual anyway: which element supplies the name, and whether the control also carries a second
// one that would override it.
//
// WHAT CHANGED AT PROMPT 50, and why this file is RE-BASED rather than deleted.
//
// From prompt 45 to prompt 49 the name came from the page heading: `<h1><label htmlFor="viewing-day">
// DATE</label></h1>` on Today and the same shape with WEEK on Weeks. Prompt 25 had insisted on a
// visible name because a control whose own text is a date needs one, and the assertions below
// forbade an `aria-label` on the control because one would OVERRIDE that visible text.
//
// Prompt 50 stage 2d retired those headings: the DAY | WEEK toggle sits at the top of the control
// stack and says the same word one row up, so repeating it was noise. **That removal would have left
// both pickers with NO accessible name at all** - the drawn picker face is `aria-hidden`, so there
// was nothing else naming them. The name moved to `aria-labelledby` pointing at the matching segment
// of that toggle.
//
// So the property under test is unchanged and is asserted more directly than before: ONE name, and
// it is a visible element rather than a hidden string.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');

// Comments in these files SAY "<label" and "aria-label" while explaining where the label went, so a
// bare grep finds prose. Assertions about what a component RENDERS run against code with comments
// removed. JSX `//` comments inside braces are stripped by the line rule.
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ---------------------------------------------------------------- the name, and only one of it

test('the DATE / WEEK heading is RETIRED, in the page and in the stylesheet', () => {
  const page = src('app/page.js');
  assert.doesNotMatch(page, /htmlFor="viewing-day"/, 'the DATE heading is gone');
  assert.doesNotMatch(page, /htmlFor="week-select"/, 'and the WEEK heading');
  assert.doesNotMatch(page, /className="pagehead"/, 'and the row that held them');
  const css = src('app/globals.css');
  assert.doesNotMatch(css, /^\.pagehead[\s{.]/m, 'the orphaned rules go too, not just the markup');
});

test('the DAY | WEEK toggle supplies BOTH pickers their name, and it is on screen', () => {
  // The segments carry ids `mode-day` and `mode-week` (Segmented builds `${name}-${value}`), and
  // each picker points at the one that matches its mode.
  const f = code('components/Filters.js');
  assert.match(f, /id=\{`\$\{name\}-\$\{o\.value\}`\}/, 'the segments carry addressable ids');
  assert.match(f, /name="mode"/, 'and the mode group is the one named `mode`');
  assert.match(f, /aria-labelledby="mode-day"/, 'the date input is named by the DAY segment');

  const w = code('components/WeekSelect.js');
  assert.match(w, /aria-labelledby="mode-week"/, 'the week select is named by the WEEK segment');
});

test('NEITHER picker carries a second name that would override the visible one', () => {
  // This is prompt 25's rule, unchanged: an aria-label would win over the visible text and lose the
  // word to a screen reader, which was the whole point of having a visible name.
  const f = code('components/Filters.js');
  const dp = f.slice(f.indexOf('export function DatePicker'), f.indexOf('export function SportFilter'));
  assert.match(dp, /id="viewing-day"/, 'the input the name points at');
  assert.doesNotMatch(dp, /<label/, 'no second label');
  assert.doesNotMatch(dp, /aria-label=/, 'and no aria-label - aria-labelledby only');

  const w = code('components/WeekSelect.js');
  assert.match(w, /id="week-select"/);
  assert.doesNotMatch(w, /<label/, 'prompt 25 4b\'s one real label is the mode toggle now');
  assert.doesNotMatch(w, /aria-label=/, 'and no aria-label beside the aria-labelledby');
});

// ---------------------------------------------------------------- the picker row

test('the picker sits BELOW the tiles, in its own row, with an arrow either side', () => {
  const page = src('app/page.js');
  // The stack order IS the requirement (prompt 50 stage 2a): toggles, then the sport block, then
  // the picker. Asserted as source order inside the control stack.
  const ctl = page.slice(page.indexOf('function Controls('));
  const iMode = ctl.indexOf('<ModeToggle');
  const iPair = ctl.indexOf('<ScopeViewToggles');
  const iSport = ctl.indexOf('<SportFilter');
  const iPick = ctl.indexOf('className="pickrow"');
  assert.ok(iMode >= 0 && iPair > iMode, 'DAY|WEEK first, then the scope/view pair');
  assert.ok(iSport > iPair, 'then the sport block');
  assert.ok(iPick > iSport, 'and the picker BELOW the tiles - this is the restack');
});

test('the arrows are real buttons and say what they step', () => {
  const f = code('components/Filters.js');
  assert.match(f, /label="Previous day"/);
  assert.match(f, /label="Next day"/);
  assert.match(f, /label="Previous week"/);
  assert.match(f, /label="Next week"/);
  assert.match(f, /<button type="button" className="pk-arrow" aria-label=\{label\}/,
               'real buttons with a real name, not styled spans');
  assert.match(f, /disabled=\{disabled\}/, 'and they disable at the ends of the range');
  // week arrows step the SPORT'S OWN week list, not seven days
  assert.match(f, /const next = all\[i \+ n\]/, 'a week arrow steps the week list');
});

test('the picker is still allowed to shrink rather than push the row wide', () => {
  const css = src('app/globals.css');
  assert.match(css, /\.pickrow > \.picker \{[\s\S]*?flex: 1 1 0;/,
               'basis 0, or the long NFL week label wraps the arrows onto a second line');
  assert.match(css, /\.pickrow > \.picker \{[\s\S]*?min-width: 0;/);
  assert.match(css, /\.pk-range \{[^}]*text-overflow: ellipsis/, 'and it ellipsizes at the end');
});

// ---------------------------------------------------------------- unchanged facts

test('both pickers keep a real native control under a drawn face', () => {
  const shell = code('components/Picker.js');
  assert.match(shell, /className=\{`picker /, 'the wrapper carries the shared class');
  assert.match(shell, /aria-hidden="true"/, 'the face must not be announced - it is not the name');
  assert.match(shell, /\{control\}/, 'and the real control is rendered, not replaced');

  const css = src('app/globals.css');
  assert.match(css, /\.picker > select,\s*\.picker > input \{[\s\S]*?opacity: 0;/,
               'the control is transparent, not display:none - that would lose the tap target');
  assert.match(css, /\.picker > select,\s*\.picker > input \{[\s\S]*?font-size: 16px;/,
               '16px or Mobile Safari zooms the page when the invisible control takes focus');
  assert.match(css, /\.picker:focus-within \{[^}]*outline/, 'keyboard focus must still be visible');
});

test('ONE derivation of which week is selected', () => {
  // The picker renders that week and the block below renders its games. Two copies of the fallback
  // chain would be free to drift, and the page would offer a week it was not showing. It moved to
  // the hub with the rest of the week model.
  const page = src('app/page.js');
  assert.equal((page.match(/currentWeekKey\(/g) || []).length, 1,
               'weekChoices() is the only place the pick is derived');
  assert.match(page, /function weekChoices\(/);
  // Calls only - the `function weekChoices({` definition matches the same shape.
  assert.equal((page.match(/(?<!function )weekChoices\(\{/g) || []).length, 1,
               'exactly one call site, so the picker and the block below cannot disagree');
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
});

test('the WEEK face colours follow Joe: gold sport-week, standings-grey range', () => {
  const css = src('app/globals.css');
  assert.match(css, /\.pk-sport \{[^}]*color: var\(--gold\)/);
  assert.match(css, /\.pk-range \{[^}]*color: var\(--dim\)/, '--dim is .tcol-rec, the standings line');
  assert.match(css, /\.pk-range--solo \{[^}]*color: var\(--ink\)/, 'a calendar week keeps trigger ink');
  assert.match(css, /\.pk-sport \{[^}]*flex: 0 0 auto/, 'the prefix never ellipsizes');
});

test('the DATE face is longDay(), not a second formatter', () => {
  const f = code('components/Filters.js');
  assert.match(f, /\{longDay\(day\)\}/, 'reuse the formatter the old <h1> used');
  assert.match(f, /type="date"/, 'still a real date input, so iOS opens its calendar');
  assert.doesNotMatch(f, /toLocaleDateString/, 'no new date formatting in this component');
});

test('History is retired as a ROUTE but not as functionality', () => {
  // Prompt 50 / R1. Its heading question is moot - there is no History page to head - but the thing
  // the page existed for must still be reachable, so the route redirects rather than 404ing and a
  // past `day` still renders that day's finals through the same card.
  const hist = src('app/history/page.js');
  assert.match(hist, /redirect\(/, 'the route still resolves');
  assert.doesNotMatch(hist, /<h1>History<\/h1>/, 'and no longer renders a page of its own');
});

test('the broadcast count and the Day row are still gone', () => {
  const page = src('app/page.js');
  assert.doesNotMatch(page, /broadcastCount/, 'the count helper is deleted, not just unmounted');
  assert.doesNotMatch(page, /dayrow|daycount/, 'and its row with it');
  const css = src('app/globals.css');
  assert.doesNotMatch(css, /^\.dayrow \{/m, 'the orphaned rules go too');
  assert.doesNotMatch(css, /^\.daycount \{/m);
});
