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
  // PROMPT 60 MOVED THE STATE OUT of this component and into lib/headerstate.js, so the assertion
  // moves with it: the promise is not "useState(false)" but "the server snapshot is a constant
  // false", which is the third argument to useSyncExternalStore and the only one the server reads.
  assert.match(c, /useSyncExternalStore\(subscribeHeader, headerCollapsed, headerCollapsedOnServer\)/,
    'the server and the first client render both read false, so there is nothing to mismatch');
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
  // THE SENTINEL IS NO LONGER ASSERTED HERE. Prompt 60 moved it out of the layout and into
  // `Controls` in app/page.js - see the test below for where it went and why. What this test is
  // about is the HEADER's mounting point, which is unchanged and still load-bearing.
  // the header tag must close before .shell opens
  const hdr = layout.indexOf('<CollapsedHeader />');
  const shell = layout.indexOf('<div className="shell">');
  assert.ok(hdr > 0 && shell > hdr, 'the header is mounted before .shell, not around it');
  assert.doesNotMatch(layout, /<CollapsedHeader[^/]*>\s*<div className="shell"/,
    'the header must never wrap the content');
});

test('the sentinel sits after the control stack, and OUTSIDE it (prompt 60)', () => {
  // IT USED TO SIT AFTER THE BANNER, in app/layout.js, and that was right for prompt 58: collapsing
  // only ADDED a fixed bar, so the trigger could fire as soon as ~123px of banner had gone.
  //
  // Prompt 60's collapse REMOVES the banner AND the control stack from the flow. Two properties
  // follow, and both are asserted because either one silently ruins the other half of the feature:
  //
  //   AFTER `.hubctl`  - so crossing the sentinel means the whole collapsible region has left the
  //                      screen, and the scroll compensation is being asked to absorb a distance
  //                      the reader has actually travelled.
  //   OUTSIDE `.hubctl` - so the collapse that hides the stack does not hide the one box
  //                      lib/headerstate.js measures. A display:none sentinel has no rect, the
  //                      compensation silently becomes zero, and the page jumps ~300px.
  const page = code('app/page.js');
  const stackEnd = page.indexOf('</div>', page.indexOf('<div className="pickrow">'));
  const sentinel = page.indexOf('<div id={SENTINEL_ID}');
  assert.ok(sentinel > stackEnd, 'the sentinel follows the control stack');
  // and it is a sibling of `.hubctl`, not a child: the stack's closing tag comes first.
  const hubctl = page.indexOf('<div className="hubctl">');
  const closes = page.lastIndexOf('</div>', sentinel);
  assert.ok(hubctl > 0 && closes > hubctl && closes < sentinel,
            'the sentinel is outside .hubctl, so the collapse cannot hide it');
  // ONE sentinel serves BOTH returns, because it lives in the shared `Controls` component. A
  // week branch without one would have a header that could never collapse.
  assert.equal((page.match(/id=\{SENTINEL_ID\}/g) || []).length, 1);
  assert.match(page, /function Controls\(\{ P, choices \}\) \{\s*return \(\s*<>/,
               'Controls returns a fragment so the sentinel can sit beside the stack');
});

test('SCROLL ONLY EVER COLLAPSES - the one-way machine (prompt 60)', () => {
  // Joe's design of 2026-09-07. The observer callback is one restored `else` away from prompt 58's
  // two-way binding, and nothing on screen looks wrong when that happens - the header just quietly
  // starts re-expanding at the top again, which is the behaviour he asked to replace.
  const c = code('components/CollapsedHeader.js');
  assert.match(c, /if \(!entry\.isIntersecting\) collapseHeader\(\)/,
               'the sentinel may only collapse');
  // SCOPED TO THE CALLBACK, not to the file. A pattern hunting for `else` was tried first and let
  // `if (!entry.isIntersecting) collapseHeader(); else expandHeader();` straight through - the
  // regex was checked against that exact string rather than trusted, which is how it was caught.
  // The property is simply that NOTHING inside the observer expands.
  const cb = c.slice(c.indexOf('new IntersectionObserver('), c.indexOf('io.observe(el)'));
  assert.ok(cb.length > 20, 'the observer callback was located');
  assert.doesNotMatch(cb, /expandHeader/, 'no branch may take the observer back to expanded');
  // EXPANSION IS MANUAL AND HAS EXACTLY ONE CALLER: the wordmark button.
  const expands = (c.match(/expandHeader\(\)/g) || []).length;
  assert.equal(expands, 1, 'exactly one expand call site');
  assert.match(c, /className="chdr-wm"[\s\S]{0,200}onClick=\{\(\) => expandHeader\(\)\}/,
               'and it is the wordmark');
  // The store, not component state: three surfaces share this boolean and one of them is a server
  // component that can hold none.
  const m = code('lib/headerstate.js');
  assert.match(m, /export function headerCollapsedOnServer\(\) \{\s*return false;/,
               'the server snapshot is a constant false - the hydration promise');
  assert.doesNotMatch(m, /scrollTo[\s\S]{0,40}smooth/, 'no motion outside a reduced-motion gate');
});

test('the collapse compensates the scroll, measured against the sentinel', () => {
  // Removing the banner and the stack shortens the document by ~300px. Without this the content
  // jumps that far up under the reader's thumb. qa-shots proves it lands at 0px moved; this pins
  // the MECHANISM, because a later edit could keep the feature and lose the compensation.
  const m = code('lib/headerstate.js');
  assert.match(m, /const before = sentinelTop\(\);[\s\S]{0,200}window\.scrollBy\(0, after - before\)/,
               'measure, apply, measure, scroll by the difference');
  // and the attribute write sits BETWEEN the two measurements, which is what makes it exact.
  const body = m.slice(m.indexOf('export function collapseHeader'));
  const before = body.indexOf('const before');
  const paint = body.indexOf('paint(true)');
  const after = body.indexOf('const after');
  assert.ok(before < paint && paint < after, 'the layout change happens between the measurements');
});

test('the navbar renders in EVERY view - the grid exclusion is lifted', () => {
  // IT USED TO RETURN NULL IN GRID VIEW, and the exclusion caused a worse defect than the one it
  // hedged against: tapping GRID in the bar sets `view=grid` with `{ scroll: false }`, so the
  // reader does not move - but the component then vanished, `resetHeader()` cleared the collapsed
  // state, and ~340px of banner and control stack returned to the flow above them. Measured before
  // the lift: collapsed at scrollY 904, tapping GRID left scrollY 759 with the grid's top at -335.
  //
  // What the exclusion was hedging against is real and is recorded rather than denied - see
  // register §28h and the qa-shots block that measures it.
  const c = code('components/CollapsedHeader.js');
  assert.doesNotMatch(c, /if \(P\.isGrid\) return null;/, 'no view-level early return');
  assert.doesNotMatch(c, /if \(P\.isGrid\) return undefined;/, 'the observer runs in every view');
  // AND THE DEAD FUNCTION WENT WITH IT. `resetHeader` existed for one job - clearing the state for
  // a view that had no bar - and had no other caller in the repo.
  assert.doesNotMatch(c, /resetHeader/, 'no caller left in the component');
  assert.doesNotMatch(code('lib/headerstate.js'), /export function resetHeader/,
    'and the export is deleted rather than left for a future edit to fall through');
  // TWO TRANSITIONS AGAIN, which is what makes the one-way machine legible: collapse and expand.
  const m = code('lib/headerstate.js');
  assert.equal((m.match(/^export function (collapse|expand|reset)Header/gm) || []).length, 2);
});

test('the view toggle is two-way now, and had to become one', () => {
  // It was `topIsOn: true` with `setParam('view', 'grid')` hardcoded, which was correct only while
  // the bar could not render in grid view. Left alone it would have painted LIST in gold while the
  // reader looked at a grid, and the tap would have set `view=grid` a second time.
  const c = code('components/CollapsedHeader.js');
  assert.match(c, /top: 'LIST', bottom: 'GRID', topIsOn: !P\.isGrid/);
  assert.match(c, /setParam\('view', P\.isGrid \? null : 'grid', KEEP_SCROLL\)/,
    "the default is REMOVED from the URL, never written - `/` stays the canonical default");
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
  assert.match(c, /Presentation: \$\{P\.isGrid \? 'Grid view' : 'List view'\}\. Switch to/);
});

test('44px in BOTH dimensions, and no third exception to it', () => {
  // The 44px minimum already carries two recorded exceptions (register §18b: the 31px segmented
  // toggles and the 24px ALL SPORTS bar). A control tapped WHILE SCROLLING is the worst place in
  // the app to spend a third.
  //
  // `.chdr-choice` IS GONE (prompt 60): three of the four became `.chdr-toggle` and the fourth
  // became `.chdr-tile`, so BOTH successors are checked rather than one. A test still naming the
  // retired class would have thrown on a null match, which is how this was caught - but a test that
  // checked only one of the two would have passed while the other quietly lost its floor.
  const css = src('app/globals.css');
  for (const sel of ['\\.chdr-toggle', '\\.chdr-tile']) {
    const rule = css.match(new RegExp(`${sel} \\{[^}]*\\}`))[0];
    assert.match(rule, /min-width: 44px/, `${sel} keeps the horizontal floor`);
    assert.match(rule, /height: 44px/, `${sel} keeps the vertical floor`);
    // and they must never shrink below it - flex items do by default, which silently clipped two
    // labels mid-word at 360 before this line existed
    assert.match(rule, /flex: 0 0 auto/, `${sel} must overflow rather than truncate`);
  }
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
  // LOOSE ON THE NAMED LIST, EXACT ON THE SOURCE. Pinning the whole import line broke the
  // moment stage 3 added `chipMarkUrl` to it - the same brittleness prompt 59 hit and fixed.
  // What matters is that these come from Filters.js and are not re-implemented here.
  assert.match(c, /import \{[^}]*useSetParam[^}]*\} from '\.\/Filters\.js'/);
  assert.match(c, /import \{[^}]*SportFilter[^}]*\} from '\.\/Filters\.js'/);
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

test('the three binaries are ONE target each, showing both words (prompt 60 stage 2)', () => {
  const c = code('components/CollapsedHeader.js');
  // TWO SPANS INSIDE ONE BUTTON. The failure this pins is a well-meant "make the inactive word
  // tappable too": with exactly two states, tapping the control and tapping the other label are the
  // same action, so a second 44px target doubles the bar's permanent cost to buy a duplicate.
  assert.match(c, /<button key=\{c\.key\} type="button" className="chdr-toggle"/);
  // ANCHORED FORWARD FROM THE TOGGLE. Slicing to the FIRST `</button>` in the file matched the
  // wordmark's, which sits earlier - a backwards slice, an empty string, and a test that failed
  // loudly rather than passing vacuously, which is the only reason it was caught here.
  const at = c.indexOf('className="chdr-toggle"');
  const inner = c.slice(at, c.indexOf('</button>', at));
  assert.equal((inner.match(/<span className="chdr-opt"/g) || []).length, 2);
  assert.doesNotMatch(inner, /<button/, 'the two words are spans, never nested buttons');
  // THE ORDER IS FIXED, never live-on-top: `top` and `bottom` are constants and only `topIsOn`
  // moves. Joe's wording is "Day over Week", which is an arrangement, not a sort.
  for (const [top, bottom] of [['DAY', 'WEEK'], ['ALL GAMES', 'MY TEAMS'], ['LIST', 'GRID']]) {
    assert.match(c, new RegExp(`top: '${top}', bottom: '${bottom}'`));
  }
});

test('the accessible name still says which half is live (prompt 60 stage 2)', () => {
  const c = code('components/CollapsedHeader.js');
  // `aria-label` REPLACES the visible text; it does not add to it. Both words are now on screen and
  // both are aria-hidden, so this sentence is the ONLY thing a screen reader gets - and the gold,
  // which is what tells a sighted reader the answer, is not available to it at all.
  assert.match(c, /aria-hidden="true">\{c\.top\}/);
  assert.match(c, /aria-hidden="true">\{c\.bottom\}/);
  assert.match(c, /Time range: \$\{P\.isWeek \? 'Week' : 'Day'\}\. Switch to/);
  assert.match(c, /Scope: \$\{P\.isMine \? 'My teams' : 'All games'\}\. Switch to/);
  assert.match(c, /Presentation: \$\{P\.isGrid \? 'Grid view' : 'List view'\}\. Switch to/);
});

test('the toggles keep 44px in both dimensions - no third exception (prompt 60 stage 2)', () => {
  // Register §18b holds exactly two exceptions to the 44px minimum: the 31px segmented toggles and
  // the 24px ALL SPORTS bar. Prompt 60's brief suspected the collapsed bar was a silent third,
  // reading prompt 58's "the four words are 148.7px" as a TARGET measurement. It is an INK
  // measurement: the targets were and are 44 / 58.13 / 44 / 63.45 at 360, min-width applied.
  const css = src('app/globals.css');
  const block = css.match(/\.chdr-toggle \{[^}]*\}/)[0];
  assert.match(block, /min-width: 44px/);
  assert.match(block, /height: 44px/);
  assert.match(block, /flex: 0 0 auto/, 'a squeeze must overflow, never truncate quietly');
});

test('the live tile is a disclosure, and the mark table is not forked (prompt 60 stage 3)', () => {
  const c = code('components/CollapsedHeader.js');
  // A DISCLOSURE, NOT A NINTH BINARY. ALL plus eight leagues is nine states; cycling them on tap
  // would take eight presses to get from NFL back to NHL.
  assert.match(c, /className="chdr-tile"[\s\S]{0,400}aria-expanded=\{sportsOpen\}/);
  assert.match(c, /aria-controls="chdr-sports"/);
  assert.match(c, /id="chdr-sports"/, 'the id aria-controls names must exist when open');
  // ONE MARK TABLE. `chipMarkUrl` comes from Filters.js, which is where the tile row builds its
  // own eight - the bar shows THE SAME TILE and must not be able to disagree about what one is.
  assert.match(c, /import \{[^}]*chipMarkUrl[^}]*\} from '\.\/Filters\.js'/);
  assert.doesNotMatch(c, /\/leagues\//, 'the path is built in one place, never here');
  // AND NOT config.js's sportMarkUrl: SPORT_MARK is five leagues and returns null for racing, ufc
  // and wwe - three of the eight tiles.
  const f = code('components/Filters.js');
  assert.match(f, /export function chipMarkUrl\(sport\)/);
  assert.match(f, /CHIP_MARK\[sport\] \|\| sport/);
});

test('the tile can only ever be NARROWER than the words it replaces (prompt 60 stage 3)', () => {
  // The cap is the whole guard. Measured from the art's intrinsic sizes at a 20px mark height:
  // ufc 57.5, mlb 38.0, wwe 22.0, racing 20.0, nhl 17.6, nfl 14.6, cfp 13.8, nba 8.8 - and NASCAR,
  // reachable by a hand-typed ?sport=nascar, 119.9. At 56px the widest tile is 62px against ALL
  // SPORTS's 63.45, so the bar's widest state is the one it renders by default.
  const css = src('app/globals.css');
  const rule = css.match(/\.chdr-mark \{[^}]*\}/)[0];
  assert.match(rule, /max-width: 56px/);
  assert.match(rule, /object-fit: contain/, 'the mark letterboxes; the box never grows to the mark');
  assert.match(rule, /height: 20px/);
});
