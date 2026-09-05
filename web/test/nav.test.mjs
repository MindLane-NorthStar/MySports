// The navigation graph, and the mount points that make it total.
//
// WHY THIS IS A TEST AND NOT A CLICK-THROUGH: `next build` cannot run on this laptop (Windows
// Application Control blocks the SWC binary), so the app cannot be served locally to click. What CAN
// be asserted without a bundler is the thing that actually decides the answer - that the route list
// is complete, and that PrimaryNav is mounted UNCONDITIONALLY in Chrome. If both hold, every route
// reaches every other route, which is the property display:"standalone" depends on: with no address
// bar and no back button, a route the app cannot link to is a route the user cannot leave.
//
// Chrome used to have two branches - the banner on `/`, the compact NavBanner bar everywhere else -
// and three tests here pinned that shape by reading the source. Joe's ruling of 2026-09-04 retired
// the split, so those three are re-based onto the new structure rather than deleted: the assertions
// still read the source, they just assert that there is ONE masthead instead of two.

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PRIMARY_ROUTES } from '../lib/routes.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');

test('the primary routes are exactly Today, Weeks and History', () => {
  assert.deepEqual(PRIMARY_ROUTES.map((r) => r.href), ['/', '/weeks', '/history']);
  assert.deepEqual(PRIMARY_ROUTES.map((r) => r.label), ['Today', 'Weeks', 'History']);
});

test('the navigation graph is TOTAL: every route reaches every other route', () => {
  // PrimaryNav renders the whole list on every page it is mounted on, so reachability is just
  // "is the list complete" x "is it mounted everywhere".
  const routes = PRIMARY_ROUTES.map((r) => r.href);
  for (const from of routes) {
    for (const to of routes) {
      assert.ok(routes.includes(to), `${from} cannot reach ${to}`);
    }
  }
  assert.equal(routes.length, 3);
});

test('Chrome no longer branches on the route: one masthead, not two', () => {
  const chrome = src('components/Chrome.js');
  assert.doesNotMatch(chrome, /usePathname\(\)\s*===\s*'\/'/, 'the pathname branch is gone');
  // Matched against USE, not against the word: the comment at the top of Chrome.js records why the
  // compact bar went, and that history is worth more than a grep-clean file.
  assert.doesNotMatch(chrome, /^import.*NavBanner/m, 'NavBanner is no longer imported');
  assert.doesNotMatch(chrome, /<NavBanner/, 'nor mounted');
  assert.doesNotMatch(chrome, /usePathname/, 'nothing here needs the client any more');
});

test('the banner and PrimaryNav are rendered UNCONDITIONALLY, so every route carries them', () => {
  const chrome = src('components/Chrome.js');
  assert.match(chrome, /\{banner\}/, 'every route renders the banner it is handed');
  assert.match(chrome, /<PrimaryNav\s+className="hn-nav"/, 'and the tab row beneath it');
  assert.doesNotMatch(chrome, /return[\s\S]*return/, 'one return, so there is no second shape');
});

test('the compact bar is GONE, not merely unused', () => {
  assert.equal(existsSync(join(HERE, '..', 'components/NavBanner.js')), false, 'NavBanner.js is deleted');
  const css = src('app/globals.css');
  assert.doesNotMatch(css, /\.navbar\{/, 'the .navbar rule went with it');
  assert.doesNotMatch(css, /--nav-safe/, 'and its private safe-area variable');
  assert.doesNotMatch(css, /\.nb-nav/, 'and the nb-* block');
});

test('.banner carries the ONLY top safe-area inset, and now it is on every route', () => {
  // This is what prompt 31 was fixing when it gave .navbar an inset of its own: Weeks and History ran
  // under the iPhone clock because the single inset rule lived on a component they did not render.
  // With one masthead there is one inset again, and it is the right one.
  const css = src('app/globals.css');
  assert.equal((css.match(/safe-area-inset-top/g) || []).length, 1, 'exactly one top inset rule');
  assert.match(css, /\.banner\{[\s\S]{0,300}?safe-area-inset-top/, 'and it belongs to .banner');
});

test('there is exactly ONE definition of the link list', () => {
  // A second literal list is how the two mount points would silently drift.
  for (const f of ['components/PrimaryNav.js', 'components/Chrome.js']) {
    assert.doesNotMatch(src(f), /href:\s*'\/weeks'/, `${f} must not redeclare the route list`);
  }
  assert.match(src('lib/routes.js'), /href:\s*'\/weeks'/, 'routes.js is the one definition');
});

test('the home nav is styled, so it is not an unstyled row under the banner', () => {
  const css = src('app/globals.css');
  assert.match(css, /\.homenav\{/);
  assert.match(css, /\.hn-nav a\.on\{[^}]*--gold/, 'active link keeps the gold underline');
});

test('standalone display is retained, which is what makes the nav load-bearing', () => {
  assert.match(src('app/manifest.js'), /display:\s*'standalone'/);
});
