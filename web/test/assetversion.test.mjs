// Every asset URL carries the build's version, so new bytes get a new address (prompt 71 stage 1).
//
// WHY THIS IS PINNED. Three false bug reports came from one cause - Joe's installed PWA serving art
// it had cached before `Cache-Control` existed on those objects. A header only says WHEN TO
// RE-CHECK; a client that never asks is never told. Only a different URL reaches it.
//
// The failure this guards against is a NEW asset builder added later without the version, which
// would silently reintroduce the bug for whatever it builds. So the test enumerates the builders
// from the source rather than listing them here (rule 32): a builder that returns an
// `ASSET_BASE_URL` or `/marks/` or `/leagues/` path and is not versioned fails.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  ASSET_VERSION, withAssetVersion, teamLogoUrl, teamLogoDarkUrl, teamLogoCapUrl,
  networkLogoUrl, markUrl, sportMarkUrl, gridAssetUrl,
} from '../lib/config.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(HERE, '..', 'lib', 'config.js'), 'utf8');

const BUILDERS = [
  ['teamLogoUrl', () => teamLogoUrl('MLB-137')],
  ['teamLogoDarkUrl', () => teamLogoDarkUrl('MLB-137')],
  ['teamLogoCapUrl', () => teamLogoCapUrl('MLB-137')],
  ['networkLogoUrl', () => networkLogoUrl('ABC')],
  ['markUrl', () => markUrl('ESPN')],
  ['sportMarkUrl', () => sportMarkUrl('nfl')],
  ['gridAssetUrl', () => gridAssetUrl('grids/cfb/grid_2026-09-05.svg')],
];

test('every asset builder emits a version', () => {
  for (const [name, fn] of BUILDERS) {
    assert.match(fn(), new RegExp(`[?&]v=${ASSET_VERSION}$`), name);
  }
});

test('THE VERSION IS STABLE for unchanged bytes - the same build emits the same URL', () => {
  // The "build twice" property. A token that moved between two reads of the same build would bust
  // every cache on every render, which is a different bug with the same shape.
  for (const [name, fn] of BUILDERS) assert.equal(fn(), fn(), name);
});

test('a legacy ABSOLUTE url with its own query is not corrupted', () => {
  // gridAssetUrl passes absolute values through - a stored row from before bare keys. A bare `?v=`
  // would have made `...?already=1?v=x`.
  assert.equal(withAssetVersion('https://x.example/a.svg?already=1'),
               `https://x.example/a.svg?already=1&v=${ASSET_VERSION}`);
  assert.equal(withAssetVersion('https://x.example/a.svg'),
               `https://x.example/a.svg?v=${ASSET_VERSION}`);
});

test('a null id still returns null, not a bare version string', () => {
  for (const fn of [teamLogoUrl, teamLogoDarkUrl, teamLogoCapUrl, networkLogoUrl, markUrl,
                    gridAssetUrl]) {
    assert.equal(fn(null), null);
    assert.equal(fn(''), null);
  }
  assert.equal(sportMarkUrl('not-a-sport'), null);
});

test('NO ASSET BUILDER ESCAPES IT - enumerated from the source, not from a list here', () => {
  // Every RETURN STATEMENT that composes an asset path must go through withAssetVersion(). A new
  // builder added without it is the regression this catches.
  //
  // BY STATEMENT, NOT BY LINE. The first version scanned lines and reported 6 of 7, because
  // gridAssetUrl's return wraps - the `return` on one line, the `ASSET_BASE_URL` on the next. That
  // was a brittle test rather than a missing version, and a check a reformat can break is one that
  // gets softened by whoever hits it at the wrong moment.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const statements = code.split(/\breturn\b/).slice(1).map((seg) => seg.split(';')[0]);
  const assetReturns = statements.filter((seg) => /ASSET_BASE_URL|\/marks\/|\/leagues\//.test(seg));
  assert.ok(assetReturns.length >= 7,
    `expected at least the 7 asset builders, found ${assetReturns.length}`);
  for (const seg of assetReturns) {
    assert.match(seg, /withAssetVersion\(/,
      `unversioned asset URL: return ${seg.trim().replace(/\s+/g, ' ').slice(0, 90)}`);
  }
});

test('the bucket KEYS are untouched - only the URL the app asks for changes', () => {
  // scripts/sync_assets.py uploads to `logos/mlb-137.png`. If the version were part of the path
  // instead of the query, every key would move and the sync would re-upload the bucket.
  assert.equal(teamLogoDarkUrl('mlb-137').split('?')[0].split('/').slice(-2).join('/'),
               'logos/mlb-137_dark.png');
});
