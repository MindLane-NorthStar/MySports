// The hub's navigation facts, and the property they exist to protect.
//
// WHY THIS IS A TEST AND NOT A CLICK-THROUGH: `next build` cannot run on this laptop (Windows
// Application Control blocks the SWC binary), so the app cannot be served locally to click. What CAN
// be asserted without a bundler is the thing that actually decides the answer, by reading the source.
//
// WHAT CHANGED AT PROMPT 50, and why this is a RE-BASE rather than a weakening.
//
// Until the hub there were three routes and this file asserted a TOTAL NAVIGATION GRAPH: every route
// reaches every other route, because `display: "standalone"` removes the address bar and the back
// button, so a route the app cannot link to is a route the user cannot leave.
//
// With one route that assertion is trivially true and therefore worthless - it would pass whatever
// happened to the app. **The property it was protecting is not trivial and is asserted here in the
// form the hub gives it:**
//
//   1. there is exactly ONE route, defined once;
//   2. every RETIRED route still resolves - it redirects rather than 404s, so no bookmark dies;
//   3. every parameter of the hub round-trips through hubHref/resolveHubParams, so no control can
//      set a state the resolver cannot read back;
//   4. every parameter has a DEFAULT, which is what makes `start_url: "/"` always land somewhere
//      valid and is now the whole of the "nothing is a dead end" guarantee.
//
// That is strictly more than the route graph asserted, because the route graph could not see
// parameters at all.

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PRIMARY_ROUTES, RETIRED_ROUTES } from '../lib/routes.js';
import { resolveHubParams, hubHref, DEFAULTS, MODES, SCOPES, VIEWS } from '../lib/hubparams.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');
const TODAY = '2026-09-05';

// ---------------------------------------------------------------- 1. one route

test('there is exactly ONE primary route, and it is the hub', () => {
  assert.deepEqual(PRIMARY_ROUTES.map((r) => r.href), ['/']);
  assert.equal(PRIMARY_ROUTES.length, 1);
});

test('there is exactly ONE definition of the route list', () => {
  // A second literal list is still how two surfaces would drift.
  assert.match(src('lib/routes.js'), /href: '\/'/);
  assert.doesNotMatch(src('components/Chrome.js'), /href:\s*'\//, 'Chrome must not redeclare routes');
});

// ---------------------------------------------------------------- 2. nothing 404s

test('every retired route still RESOLVES - it redirects, it does not 404', () => {
  assert.deepEqual(RETIRED_ROUTES.map((r) => r.href), ['/weeks', '/history']);
  for (const r of RETIRED_ROUTES) {
    assert.ok(existsSync(join(HERE, '..', r.file)), `${r.href} has no route file`);
    const f = src(r.file);
    assert.match(f, /import \{ redirect \} from 'next\/navigation'/, `${r.href} must import redirect`);
    assert.match(f, /redirect\(/, `${r.href} must call redirect()`);
    assert.match(f, /hubHref\(/, `${r.href} must build its target through hubHref, not by hand`);
  }
});

test('/weeks carries its week and sport forward; /history carries sport and DROPS ?q=', () => {
  const weeks = src('app/weeks/page.js');
  assert.match(weeks, /mode: 'week'/, '/weeks lands in week mode');
  assert.match(weeks, /w: typeof p\.w === 'string'/, 'and carries ?w= forward');
  assert.match(weeks, /sport: typeof p\.sport === 'string'/, 'and ?sport=');

  const hist = src('app/history/page.js');
  assert.match(hist, /mode: 'day'/, '/history lands in day mode');
  assert.match(hist, /sport: typeof p\.sport === 'string'/, 'and carries ?sport=');
  // R8: the cross-date search is retired, not forwarded. Forwarding a parameter with nothing on the
  // other side to read it would be worse than dropping one visibly.
  assert.doesNotMatch(hist, /\bq:/, '?q= must NOT be forwarded - R8 retires it');
});

test('the tab row is GONE, not merely unused', () => {
  assert.equal(existsSync(join(HERE, '..', 'components/PrimaryNav.js')), false, 'PrimaryNav.js is deleted');
  const chrome = src('components/Chrome.js');
  assert.doesNotMatch(chrome, /<PrimaryNav/, 'nor mounted');
  const css = src('app/globals.css');
  assert.doesNotMatch(css, /^\.homenav\{/m, 'the .homenav rule went with it');
  assert.doesNotMatch(css, /^\.hn-nav\b/m, 'and the hn-* block');
});

// -------------------------------------------- 2b. the NASCAR series sub-filter is GONE, not hidden

/**
 * PROMPT 52 STAGE 1. Joe: "Remove the Cup / O'Reilly / Truck buttons ... Simply allow all NASCAR
 * races to appear when they should instead of having them filtered by series."
 *
 * This SUPERSEDES enhancement-register §9 (individual sport chips WITH a NASCAR series sub-filter)
 * and §16 (that sub-filter placed as a second row beneath the tiles). Both were deliberate; both
 * are reversed.
 *
 * `programs.series` STAYS IN THE DATABASE and is deliberately not asserted here - migration 0015
 * keys a race session on `(sport, coalesce(series, ''), start_at, title)` and prompt 48 measured
 * what happens without it. This was a PRESENTATION change only.
 */
test('the series sub-filter is deleted, not rendered-but-hidden', () => {
  const filters = src('components/Filters.js');
  assert.doesNotMatch(filters, /SeriesFilter/, 'the component is gone');
  assert.doesNotMatch(filters, /NASCAR_SERIES|SERIES_LABEL|showsNascar/, 'and its imports');

  const page = src('app/page.js');
  assert.doesNotMatch(page, /SeriesFilter/, 'and the call site');

  const cfg = src('lib/config.js');
  assert.doesNotMatch(cfg, /export const NASCAR_SERIES|export const SERIES_LABEL/);
  assert.doesNotMatch(cfg, /export function (resolveSeriesParam|showsNascar)/);

  // The FILTERING, not merely the control: a series token must not narrow any query.
  const q = src('lib/queries.js');
  assert.doesNotMatch(q, /seriesFilter/, 'no query narrows by series');
  assert.doesNotMatch(q, /series\.eq\./, 'and no PostgREST predicate spells one');
  // The COLUMN is still selected - that is the data layer and it is untouched.
  assert.match(q, /^\s+'series',$/m, "programs.series is still SELECTED, just never filtered on");

  const css = src('app/globals.css');
  assert.doesNotMatch(css, /\.seriesrow/, 'the second row CSS went with it');
  assert.doesNotMatch(css, /\.serbtn/);
});

test('a stale ?series=cup link renders, ignored rather than erroring', () => {
  // Old bookmarks and anything Joe has shared must not 404 or 400.
  const p = resolveHubParams({ day: '2026-09-06', sport: 'racing', series: 'cup' }, TODAY);
  assert.equal(p.day, '2026-09-06');
  assert.equal(p.sport, 'racing', 'the sport still selects');
  assert.equal(p.series, undefined, 'the series token is simply not in the contract');
  // and it never comes back out of a generated href
  assert.doesNotMatch(hubHref({ ...p }, { today: TODAY }), /series/);
});

// ---------------------------------------------------------------- 3. every parameter round-trips

test('EVERY parameter round-trips: what a control can set, the resolver can read back', () => {
  const states = [
    {},
    { mode: 'week' },
    { mode: 'day', day: '2026-11-14' },
    { mode: 'week', w: 'cfb-2026-1' },
    { mode: 'week', w: '2026-08-31', sport: 'mlb' },
    { sport: 'nfl' },
    // Was `{ sport: 'nascar', series: 'cup' }`. Prompt 52 stage 1 retired the series sub-filter;
    // the coverage this case actually carried - a hand-typed bare enum sport round-tripping - is
    // kept, re-based onto sport alone.
    { sport: 'nascar' },
    { sport: 'racing' },
    { scope: 'mine' },
    { view: 'grid' },
    { mode: 'week', w: 'nfl-2026-3', sport: 'nfl', scope: 'mine', view: 'grid' },
    { mode: 'day', day: '2027-01-10', sport: 'cfb', scope: 'mine', view: 'grid' },
  ];
  for (const want of states) {
    const href = hubHref({ ...want, day: want.day ?? TODAY }, { today: TODAY });
    const qs = Object.fromEntries(new URLSearchParams(href.split('?')[1] || ''));
    const got = resolveHubParams(qs, TODAY);
    for (const [k, v] of Object.entries(want)) {
      assert.equal(got[k], v, `${JSON.stringify(want)} -> ${href} lost ${k}`);
    }
  }
});

test('defaults are OMITTED from the href, so a clean / is the default state', () => {
  assert.equal(hubHref({}, { today: TODAY }), '/');
  assert.equal(hubHref({ mode: 'day', scope: 'all', view: 'list', day: TODAY }, { today: TODAY }), '/');
  // today is omitted too: naming it makes a shared link go stale the moment tomorrow arrives
  assert.equal(hubHref({ day: TODAY }, { today: TODAY }), '/');
  assert.match(hubHref({ day: '2026-11-14' }, { today: TODAY }), /^\/\?day=2026-11-14$/);
});

test('the href key ORDER is stable, so the same state never produces two URLs', () => {
  const a = hubHref({ mode: 'week', w: 'x', sport: 'nfl', scope: 'mine', view: 'grid' }, { today: TODAY });
  const b = hubHref({ view: 'grid', scope: 'mine', sport: 'nfl', w: 'x', mode: 'week' }, { today: TODAY });
  assert.equal(a, b);
});

// ---------------------------------------------------------------- 4. everything has a default

test('EVERY parameter has a default, so no URL can produce a dead end', () => {
  const empty = resolveHubParams({}, TODAY);
  assert.equal(empty.mode, DEFAULTS.mode);
  assert.equal(empty.scope, DEFAULTS.scope);
  assert.equal(empty.view, DEFAULTS.view);
  assert.equal(empty.day, TODAY);
  assert.equal(empty.w, null);
  assert.equal(empty.sport, null);
  assert.equal(empty.series, undefined, 'the series parameter is RETIRED (prompt 52 stage 1)');
});

test('garbage RESOLVES rather than throwing or 404ing', () => {
  const junk = resolveHubParams(
    { mode: 'sideways', scope: 'everyone', view: 'hologram', day: 'yesterday', sport: 'quidditch', series: 'f1' },
    TODAY,
  );
  assert.equal(junk.mode, 'day');
  assert.equal(junk.scope, 'all');
  assert.equal(junk.view, 'list');
  assert.equal(junk.day, TODAY, 'a malformed day falls back to today, it does not error');
  assert.equal(junk.sport, null);
  // A STALE `?series=cup` IS IGNORED, NOT AN ERROR. Old bookmarks and anything Joe has shared
  // must keep rendering; the parameter is simply not in the contract any more.
  assert.equal(junk.series, undefined);
});

test('a stale ?w= is CARRIED, not rejected - the fallback lives where the week list is', () => {
  // A ?w= from another sport must reach the page, so weekChoices can fall back to that sport's
  // current week. Validating it here would turn a feature into a 404.
  const p = resolveHubParams({ mode: 'week', w: 'nfl-2026-3', sport: 'cfb' }, TODAY);
  assert.equal(p.w, 'nfl-2026-3');
  assert.equal(p.sport, 'cfb');
  assert.match(src('app/page.js'), /currentWeekKey\(all, todayET\(\)\)/,
               'and the fallback chain moved to the hub with weekChoices');
});

test('day and w COEXIST - each is read only in its own mode', () => {
  // This is what makes DAY -> WEEK -> DAY return you to the day you were on.
  const p = resolveHubParams({ mode: 'week', day: '2026-11-14', w: 'cfb-2026-1' }, TODAY);
  assert.equal(p.day, '2026-11-14');
  assert.equal(p.w, 'cfb-2026-1');
  assert.equal(p.isWeek, true);
});

test('the value lists are the ones the controls offer', () => {
  assert.deepEqual(MODES, ['day', 'week']);
  assert.deepEqual(SCOPES, ['all', 'mine']);
  assert.deepEqual(VIEWS, ['list', 'grid']);
  const f = src('components/Filters.js');
  for (const v of [...MODES, ...SCOPES, ...VIEWS]) {
    assert.ok(f.includes(`value: '${v}'`), `no control can set ${v}`);
  }
});

// ---------------------------------------------------------------- unchanged facts

test('the banner is rendered UNCONDITIONALLY, so every state carries it', () => {
  const chrome = src('components/Chrome.js');
  assert.match(chrome, /\{banner\}/);
  assert.doesNotMatch(chrome, /usePathname/, 'nothing here needs the client');
});

test('the compact bar is still GONE', () => {
  assert.equal(existsSync(join(HERE, '..', 'components/NavBanner.js')), false);
  const css = src('app/globals.css');
  assert.doesNotMatch(css, /\.navbar\{/);
  assert.doesNotMatch(css, /--nav-safe/);
});

test('EXACTLY TWO elements take the top safe-area inset, and both are fixed to the top edge', () => {
  // THIS WAS ".banner carries the ONLY top safe-area inset" UNTIL PROMPT 58, and the change is a
  // real one rather than a weakening. `.chdr` - the collapsing header - is the second element in
  // this app that paints at the very top of the viewport, so it needs the same treatment for the
  // same reason: background bleeding up into the band, first ink below it.
  //
  // WHAT THE GUARD IS STILL FOR: a THIRD, unconsidered inset. Every element that takes one is
  // making a claim about owning the top edge, and only two things can. If this count moves again,
  // whoever moved it should have to say which element is now up there and why.
  //
  // THE TWO ARE NOT TREATED IDENTICALLY, deliberately. `.banner` absorbs 14px of the inset
  // (prompts 45/50/51) because its ARTWORK carries its own headroom; `.chdr` takes the PLAIN inset,
  // because it is type on a ground and has no headroom to absorb.
  const css = src('app/globals.css');
  const hits = css.match(/safe-area-inset-top/g) || [];
  assert.equal(hits.length, 3, '.banner base + .banner standalone override + .chdr, and nothing else');
  const stripped = css
    .replace(/\.banner\{[^}]*\}/g, '')
    .replace(/\.chdr \{[^}]*\}/g, '');
  assert.doesNotMatch(stripped, /safe-area-inset-top/,
                      'no selector other than .banner and .chdr may take a top inset');
  // and the one that is NOT the banner must not have copied the banner's absorption
  const chdr = css.match(/\.chdr \{[^}]*\}/)[0];
  assert.match(chdr, /padding-top: env\(safe-area-inset-top, 0px\)/);
  assert.doesNotMatch(chdr, /- 14px/, '.banner’s -14px absorption is artwork-specific');
});

test('standalone display is retained, and now the DEFAULTS are what make it safe', () => {
  assert.match(src('app/manifest.js'), /display:\s*'standalone'/);
  assert.match(src('app/manifest.js'), /start_url:\s*'\/'/);
  // start_url '/' resolves to the default state, asserted above.
  assert.equal(hubHref({}, { today: TODAY }), '/');
});
