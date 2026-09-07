// THE COLLAPSING HEADER (prompt 58) — the properties that must not regress.
//
// These are SOURCE assertions, not renders: the component is a client component mounted in a
// layout, and `node --test` cannot mount it — the same constraint pagehead.test.mjs and
// nav.test.mjs already work under. The behavioural half (does it actually appear at the right
// scroll position, does it shift content, is it absent in grid view) is proved in a browser and
// recorded in prompt 58's report; what is pinned here is the set of decisions that make that
// behaviour safe, because those are the ones a later edit can quietly undo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the trigger is an IntersectionObserver on a sentinel, and NOT a scroll listener', () => {
  const c = code('components/CollapsedHeader.js');
  assert.match(c, /new IntersectionObserver\(/);
  assert.match(c, /io\.observe\(el\)/);
  assert.match(c, /return \(\) => io\.disconnect\(\)/, 'the observer is torn down');
  // A scroll handler fires every frame and this app has never had one. Assert that across the
  // WHOLE app, not just this file - the point is the property, not this component's discipline.
  for (const f of ['components/CollapsedHeader.js', 'app/layout.js', 'components/Listing.js',
                   'components/Filters.js', 'components/MobileGrid.js']) {
    assert.doesNotMatch(code(f), /addEventListener\(\s*['"]scroll['"]/, `${f} adds a scroll listener`);
  }
});

test('the server renders the EXPANDED state, which is what makes hydration safe', () => {
  const c = code('components/CollapsedHeader.js');
  assert.match(c, /useState\(false\)/,
    'collapsed starts false, so the first client render equals the server render');
  // and the collapse is applied only after mount
  assert.match(c, /useEffect\(\(\) => \{/);
});

test('nothing is persisted and nothing is read back - the state is ephemeral', () => {
  const c = code('components/CollapsedHeader.js');
  for (const bad of [/localStorage/, /sessionStorage/, /document\.cookie/, /indexedDB/]) {
    assert.doesNotMatch(c, bad, 'the hub is URL-only; presentation state does not get persisted');
  }
});

test('it is mounted as a SIBLING of .shell, never wrapping the content', () => {
  // THE CONTAINING-BLOCK DISCIPLINE, and this is the assertion that enforces it. globals.css tells
  // you not to put a transform on anything between `.mrail-cell` and `.mgrid-scroll`; a header that
  // WRAPPED the content would be on that chain, and its own transform (used for the show/hide)
  // would then become the grid rail's containing block - prompt 30's bug, reintroduced.
  const layout = code('app/layout.js');
  assert.match(layout, /<CollapsedHeader \/>/);
  assert.match(layout, /<div id=\{SENTINEL_ID\} aria-hidden="true" \/>/);
  // the header tag must close before .shell opens
  const hdr = layout.indexOf('<CollapsedHeader />');
  const shell = layout.indexOf('<div className="shell">');
  assert.ok(hdr > 0 && shell > hdr, 'the header is mounted before .shell, not around it');
  assert.doesNotMatch(layout, /<CollapsedHeader[^/]*>\s*<div className="shell"/,
    'the header must never wrap the content');
});

test('the sentinel sits immediately after the banner', () => {
  const layout = code('app/layout.js');
  const chrome = layout.indexOf('<Chrome banner=');
  const sentinel = layout.indexOf('id={SENTINEL_ID}');
  assert.ok(chrome > 0 && sentinel > chrome, 'the sentinel follows the banner');
  assert.ok(sentinel < layout.indexOf('<div className="shell">'), 'and precedes the content');
});

test('grid view returns NULL, not a hidden element', () => {
  // A fixed element that is only `opacity: 0` still takes touches in some engines, and
  // `.mgrid-scroll` sets `touch-action: pan-x pan-y` and runs a pinch handler. Absence is the
  // requirement; invisibility is not enough.
  assert.match(code('components/CollapsedHeader.js'), /if \(P\.isGrid\) return null;/);
});

test('what a query string means is decided in ONE place', () => {
  const c = code('components/CollapsedHeader.js');
  assert.match(c, /resolveHubParams\(/, 'hubparams.js is the only decider; this asks it');
  assert.doesNotMatch(c, /params\.get\(['"]view['"]\)/, 'never re-derive `view` here');
});

test('the bar carries the top inset PLAINLY, without the banner’s artwork absorption', () => {
  const css = src('app/globals.css');
  const rule = css.match(/\.chdr \{[^}]*\}/)[0];
  assert.match(rule, /position: fixed/);
  assert.match(rule, /padding-top: env\(safe-area-inset-top, 0px\)/);
  assert.doesNotMatch(rule, /- 14px/);
  // hidden by default, and hidden in a way that also removes it from hit-testing
  assert.match(rule, /visibility: hidden/);
});

test('the show and hide are transform and opacity only, inside the reduced-motion guard', () => {
  const css = src('app/globals.css');
  const guard = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'));
  assert.match(guard, /\.chdr \{\s*transition:/, 'the transition lives inside the guard');
  const t = guard.match(/\.chdr \{\s*transition: ([^;]+);/)[1];
  for (const prop of t.split(',').map((x) => x.trim().split(/\s+/)[0])) {
    assert.ok(['opacity', 'transform', 'visibility'].includes(prop),
      `${prop} is not allowed to transition here - it could reflow`);
  }
});

// ---------------------------------------------------------------------------------- stage 3

test('the binaries reuse useSetParam - there is not a second one', () => {
  const c = code('components/CollapsedHeader.js');
  // The PROPERTY is "it imports useSetParam from Filters.js", not the exact shape of the import
  // list - stage 4 legitimately added SportFilter to it and this fired on the punctuation.
  assert.match(c, /import \{[^}]*useSetParam[^}]*\} from '\.\/Filters\.js'/,
    'the bar and the expanded toggles must never disagree about what a toggle does');
  assert.doesNotMatch(c, /useRouter|usePathname/,
    'no second implementation - routing belongs to useSetParam');
  assert.match(code('components/Filters.js'), /export function useSetParam\(\)/);
});

test('A THIRD ACCESSIBILITY PATTERN: visible text is the state, accessible name is the action', () => {
  // Filters.js explains why the expanded toggles are radiogroup + aria-checked, and register §17
  // records that the tiles keep aria-pressed. A collapsed binary shows only ONE option, so it can
  // be neither: there is no group to be one of two within, and nothing is "pressed".
  const c = code('components/CollapsedHeader.js');
  assert.doesNotMatch(c, /role="radio/, 'a single visible option is not a radiogroup');
  assert.doesNotMatch(c, /aria-pressed/, 'and it is not a pressed toggle either');
  assert.match(c, /aria-label=\{c\.name\}/);
  // state, then action, separated by a full stop - a dash reads as a pause, not a boundary
  assert.match(c, /Time range: \$\{P\.isWeek \? 'Week' : 'Day'\}\. Switch to/);
  assert.match(c, /Scope: \$\{P\.isMine \? 'My teams' : 'All games'\}\. Switch to/);
  assert.match(c, /Presentation: List view\. Switch to Grid view/);
});

test('44px in BOTH dimensions, and no third exception to it', () => {
  // The 44px minimum already carries two recorded exceptions (register §18b: the 31px segmented
  // toggles and the 24px ALL SPORTS bar). A control tapped WHILE SCROLLING is the worst place in
  // the app to spend a third.
  const css = src('app/globals.css');
  const rule = css.match(/\.chdr-choice \{[^}]*\}/)[0];
  assert.match(rule, /min-width: 44px/);
  assert.match(rule, /height: 44px/);
  // and they must never shrink below it - flex items do by default, which silently clipped two
  // labels mid-word at 360 before this line existed
  assert.match(rule, /flex: 0 0 auto/);
});

test('a tap from the bar keeps the scroll position; every other surface keeps the default', () => {
  const c = code('components/CollapsedHeader.js');
  assert.match(c, /const KEEP_SCROLL = \{ scroll: false \};/);
  const picks = c.match(/setParam\([^)]*\)/g) || [];
  assert.equal(picks.length, 3, 'exactly the three binaries set a param from here');
  for (const p of picks) assert.match(p, /KEEP_SCROLL/, `${p} must not bounce the reader to the top`);
  // the shared function keeps Next's default for everyone else
  assert.match(code('components/Filters.js'), /router\.push\(qs \? `\$\{pathname\}\?\$\{qs\}` : pathname, opts\)/);
});

test('the default is REMOVED from the URL, never written', () => {
  // `/` has to stay the canonical default state - nav.test.mjs asserts that separately.
  const c = code('components/CollapsedHeader.js');
  assert.match(c, /setParam\('mode', P\.isWeek \? null : 'week'/);
  assert.match(c, /setParam\('scope', P\.isMine \? null : 'mine'/);
});

// ---------------------------------------------------------------------------------- stage 4

test('ALL SPORTS is a DISCLOSURE, not a binary', () => {
  // ALL plus eight league tiles is nine states; cycling them would take eight taps to get from NFL
  // back to NHL. Joe ruled it opens the row.
  const c = code('components/CollapsedHeader.js');
  assert.match(c, /aria-expanded=\{sportsOpen\}/);
  assert.match(c, /aria-controls="chdr-sports"/);
  assert.match(c, /id="chdr-sports"/, 'aria-controls must point at something that exists');
  // and the name does NOT repeat the affordance aria-expanded already announces
  assert.match(c, /aria-label=\{`Sport: \$\{P\.sport \? \(SPORT_LABEL\[P\.sport\] \|\| P\.sport\) : 'All sports'\}`\}/);
  assert.doesNotMatch(c, /Sport:[^`]*Show the/, 'aria-expanded carries the verb; the name must not');
});

test('the closed row is ABSENT, not hidden - or focus walks into it', () => {
  const c = code('components/CollapsedHeader.js');
  assert.match(c, /\{sportsOpen \? \(/, 'conditionally rendered');
  assert.doesNotMatch(c, /hidden=\{!sportsOpen\}/, 'hidden attributes still leave it in the DOM');
  // measured: 0 focusable elements when closed, 9 when open
});

test('it reuses SportFilter with props rather than forking it', () => {
  const c = code('components/CollapsedHeader.js');
  assert.match(c, /import \{ useSetParam, SportFilter \} from '\.\/Filters\.js'/);
  assert.match(c, /<SportFilter sport=\{P\.sport\} onPicked=\{\(\) => setSportsOpen\(false\)\} setOpts=\{KEEP_SCROLL\} \/>/);
  // and the two new props default to undefined so every existing caller is unchanged
  const f = code('components/Filters.js');
  assert.match(f, /export function SportFilter\(\{ sport, available, onPicked, setOpts \}\)/);
  assert.match(f, /if \(onPicked\) onPicked\(\);/);
});

test('the open/closed-ness is ephemeral; the URL still owns `sport`', () => {
  const c = code('components/CollapsedHeader.js');
  assert.match(c, /const \[sportsOpen, setSportsOpen\] = useState\(false\)/);
  // the pick goes through setParam like every other sport pick in the app
  assert.match(code('components/Filters.js'), /setParam\('sport', value, setOpts\)/);
});
