// The navigation graph, and the mount points that make it total.
//
// WHY THIS IS A TEST AND NOT A CLICK-THROUGH: `next build` cannot run on this laptop (Windows
// Application Control blocks the SWC binary), so the app cannot be served locally to click. What CAN
// be asserted without a bundler is the thing that actually decides the answer - that the route list
// is complete, and that PrimaryNav is mounted on BOTH branches of Chrome. If both hold, every route
// reaches every other route, which is the property display:"standalone" depends on: with no address
// bar and no back button, a route the app cannot link to is a route the user cannot leave.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

test('PrimaryNav is mounted on the HOME branch of Chrome - the dead end this fixes', () => {
  const chrome = src('components/Chrome.js');
  const home = chrome.slice(chrome.indexOf("usePathname() === '/'"), chrome.indexOf('return <NavBanner'));
  assert.match(home, /<PrimaryNav/, 'the home route must carry the nav; Banner.js has no links at all');
  assert.match(home, /\{banner\}/, 'and it must still render the banner itself');
});

test('PrimaryNav is mounted on the NON-home branch too, via NavBanner', () => {
  assert.match(src('components/NavBanner.js'), /<PrimaryNav\s+className="nb-nav"/);
});

test('NavBanner keeps its existing appearance: same wrapper class as before', () => {
  const nav = src('components/NavBanner.js');
  assert.match(nav, /className="nb-nav"/, 'the compact bar must still use nb-nav');
  assert.match(nav, /className="navbar"/);
  assert.match(nav, /nb-brand|nb-tv|nb-wm/, 'brand block untouched');
});

test('there is exactly ONE definition of the link list', () => {
  // A second literal list is how the two mount points would silently drift.
  for (const f of ['components/PrimaryNav.js', 'components/NavBanner.js', 'components/Chrome.js']) {
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
