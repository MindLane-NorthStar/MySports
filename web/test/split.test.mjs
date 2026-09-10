// THE SPLIT (prompt 62 stage 2) — the picker joins the bar, the league row divides them.
//
// Joe's ruling: tapping ALL SPORTS opens the league row BETWEEN the navbar and the picker, pushing
// the picker and the schedule down rather than covering them.
//
// THE ROUTE MOVES NEITHER THE PICKER NOR ITS DATA, which is why it was chosen over three others.
// `.hubctl` becomes `display: contents` when collapsed, so `.pickrow` becomes a direct child of
// <main> for layout and can stick against it; the picker still renders from `Controls` in
// app/page.js, on the server, with `choices` computed there.
//
// These are SOURCE assertions - the behavioural half (does the row actually push the picker down,
// does the offset track it) is proved in a browser and pinned in scripts/qa-shots.mjs.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
// CSS with its comments stripped. AN ABSENCE MUST BE ASSERTED AGAINST THE RULES, NOT THE PROSE:
// the first version of the `.shell` check below matched the very comment that explains why the rule
// was deleted, and failed on a file that was correct.
const cssRules = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '');

test('THE SIBLING TRAP: `Controls` renders exactly these five children of .hubctl', () => {
  // `html[data-hdr='collapsed'] .hubctl > :not(.pickrow) { display: none }` hides BY DEFAULT. A
  // sixth child added to `Controls` would vanish the moment the header collapsed, with no gate
  // failing and nothing on screen to say why - the reader would simply never see it again after
  // scrolling. This test is the loud failure that addition deserves.
  //
  // If you are here because you added a control: decide whether it belongs in the collapsed stack.
  // If it does, give it a rule beside `.pickrow`'s. If it does not, add it to this list and say so.
  const page = code('app/page.js');
  const start = page.indexOf('<div className="hubctl">');
  const end = page.indexOf('<div id={SENTINEL_ID}', start);
  assert.ok(start > 0 && end > start, 'the .hubctl block was located');
  const block = page.slice(start, end);
  const children = [...block.matchAll(/^ {8}<(\w+)/gm)].map((m) => m[1]);
  assert.deepEqual(children, ['ModeToggle', 'ScopeViewToggles', 'div', 'div'],
    'the four non-picker children, in order - the second div is .pickrow');
  // and the picker is inside the LAST of those, not a fifth sibling
  assert.match(block, /<div className="pickrow">/);
  assert.equal((block.match(/className="pickrow"/g) || []).length, 1, 'exactly one .pickrow');
});

test('there is exactly ONE picker in the source, and it is not moved or portalled', () => {
  const page = code('app/page.js');
  assert.equal((page.match(/className="pickrow"/g) || []).length, 1);
  assert.match(page, /<WeekPicker choices=\{choices\} sport=\{P\.sport\} \/>/,
    'week mode still gets its choices from the page, computed server-side');
  assert.match(page, /<DayPicker day=\{P\.day\} \/>/);
  // The three rejected routes, each pinned as an absence so nobody quietly reintroduces one.
  assert.doesNotMatch(page, /createPortal/, 'no portal - it would drop the picker from the SSR html');
  const hdr = code('components/CollapsedHeader.js');
  // NARROWED IN PLACE BY PROMPT 86 BLOCK C to what the message says it guards: RENDERING a picker.
  // It forbade the bare word `pickrow`, and the header now MEASURES the one picker - a
  // ResizeObserver writing --pick-h reads `.pickrow` by selector - which renders nothing.
  assert.doesNotMatch(hdr, /className="pickrow"|<DayPicker|<WeekPicker/,
    'the header must not render a second picker');
});

test('the collapsed stack is `display: contents`, and the picker sticks against it', () => {
  const css = src('app/globals.css');
  assert.match(css, /html\[data-hdr='collapsed'\] \.hubctl \{\s*display: contents;\s*\}/);
  assert.match(css, /html\[data-hdr='collapsed'\] \.hubctl > :not\(\.pickrow\) \{\s*display: none;\s*\}/);
  const rule = css.match(/html\[data-hdr='collapsed'\] \.pickrow \{[^}]*\}/)[0];
  assert.match(rule, /position: sticky/);
  assert.match(rule, /top: var\(--stack-h, 44px\)/, 'the offset tracks the bar, with a bare fallback');
  assert.match(rule, /background: var\(--spot-2\)/, 'opaque, or the schedule scrolls through it');
  // THE 8px IS INSIDE THE PLATE - as margin it was a transparent letterbox the schedule showed
  // through. The horizontal half became a full BLEED in prompt 63 stage 2: the plate has to reach
  // the viewport edges like the navbar above it, while its CONTENT stays in the column.
  assert.match(rule, /padding: 8px calc\(50vw - 50%\)/, 'vertical gap inside, horizontal bleed');
  assert.match(rule, /margin-inline: calc\(50% - 50vw\)/, 'the box grows to the viewport');
  assert.match(rule, /margin-block: 0/, 'and gains no vertical margin doing it');
  // SCOPED TO COLLAPSED. Unscoped, the expanded picker would detach from the stack and park itself
  // partway down the viewport with nothing above it, because `.chdr` is display:none there.
  const unscoped = css.match(/^\.pickrow \{[^}]*\}/m)[0];
  assert.doesNotMatch(unscoped, /position: sticky/);
});

test('.chdr is sticky in flow, and the expanded state leaves the flow entirely', () => {
  const css = src('app/globals.css');
  const rule = css.match(/^\.chdr \{[^}]*\}/m)[0];
  assert.match(rule, /position: sticky/);
  assert.doesNotMatch(rule, /position: fixed/);
  // `display: none`, not visibility+transform: a transformed in-flow element still occupies its
  // box, which would leave ~77px of empty ground above the banner.
  assert.match(rule, /display: none/);
  assert.doesNotMatch(rule, /transform: translateY\(-100%\)/);
  assert.match(css, /html\[data-hdr='collapsed'\] \.chdr \{\s*display: block;\s*\}/);
  // and the clearance padding that existed only to clear a FIXED bar is gone
  assert.doesNotMatch(cssRules('app/globals.css'),
    /html\[data-hdr='collapsed'\] \.shell \{[^}]*padding-top/);
  // .hubctl must NOT be hidden alongside .banner any more - that rule won on source order and
  // silently undid the split once already.
  const hide = css.match(/html\[data-hdr='collapsed'\] \.banner[^{]*\{[^}]*\}/)[0];
  assert.doesNotMatch(hide, /hubctl/);
});

test('--stack-h is measured from the bar, not computed from constants', () => {
  const c = code('components/CollapsedHeader.js');
  // The bar's height is 44 + env(safe-area-inset-top) + the league row when open, and only the
  // browser knows the first two. A ResizeObserver carries all three and keeps carrying them.
  assert.match(c, /new ResizeObserver\(write\)/);
  // BORDER-BOX, NOT THE DEFAULT (prompt 63 stage 2). `.chdr` pads itself by the safe-area inset, and
  // an inset change moves the border box while leaving the content box untouched - a default
  // content-box observer never fires, `--stack-h` goes stale, and the picker sticks too high with a
  // strip of schedule above it. Reproduced at 59px of simulated inset: bar 103px, --stack-h 44px.
  assert.match(c, /ro\.observe\(el, \{ box: 'border-box' \}\)/,
    'a content-box observer cannot see a safe-area inset change');
  assert.match(c, /return \(\) => ro\.disconnect\(\)/, 'the observer is torn down');
  assert.match(c, /setProperty\(\s*'--stack-h', `\$\{el\.getBoundingClientRect\(\)\.height\}px`\)/);
  assert.doesNotMatch(c, /--stack-h['"]?,\s*['"`]44/, 'never a hardcoded height');
});
