// THE MLB.TV LINK CARRIES A PER-GAME ADDRESS (prompt 81 block F, Joe's tap test 2026-09-09).
//
// WHAT THE TAP TEST SETTLED. Joe tapped two links from Messages on his iPhone — `mlb.com/tv/g824791`
// (a real gamePk) and `mlb.com/tv/g999999999` (a control that cannot resolve to a game). BOTH opened
// the MLB app on the Guardians page. So iOS hands `mlb.com/tv/g*` to the app, which is what this
// change rests on and is why the link is worth building.
//
// WHAT IT DID NOT SETTLE, and no test here asserts it either way: whether the app READS the number.
// The control landed on the same screen, so a real game's landing is indistinguishable from a
// fallback to Joe's club. The URL shipped is the same under both readings.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { mlbAppUrl, watchUrl, DIRECTV_STREAM } from '../lib/config.js';
import { region } from './region.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ------------------------------------------------------------------------------- the builder
test('a real MLB game id becomes the per-game MLB.TV address', () => {
  assert.equal(mlbAppUrl({ id: 'mlb-824791' }), 'https://www.mlb.com/tv/g824791');
});

test('anything that is not an MLB game id is null', () => {
  // NULL RATHER THAN A DEFAULT: the caller falls through to `watchUrl(service)`, which is a real
  // page. A default here would be a link to nowhere wearing a working link's clothes.
  assert.equal(mlbAppUrl({ id: 'cfb-401858202' }), null, 'another sport');
  assert.equal(mlbAppUrl({ id: 'nfl-401872656' }), null);
  assert.equal(mlbAppUrl({ id: 'mlb-' }), null, 'the prefix with no digits');
  assert.equal(mlbAppUrl({ id: 'mlb-114x' }), null, 'digits with a suffix');
  assert.equal(mlbAppUrl({ id: '' }), null);
  assert.equal(mlbAppUrl({}), null);
  assert.equal(mlbAppUrl(undefined), null);
  assert.equal(mlbAppUrl(null), null);
});

test('the id is ANCHORED, because a team id shares the prefix', () => {
  // `adapters/mlb.py:66` mints team ids as `mlb-{id}` too, so the prefix alone means nothing. A team
  // id has no business reaching a game row; the anchor removes the question rather than documenting
  // it. Asserted on the regex itself so a later `.includes`-style rewrite fails here.
  assert.match(code('lib/config.js'), /\/\^mlb-\(\\d\+\)\$\//);
  assert.equal(mlbAppUrl({ id: 'xmlb-824791' }), null, 'no leading match');
  assert.equal(mlbAppUrl({ id: 'mlb-824791 ' }), null, 'no trailing slop');
});

test('the id scheme is the adapter’s, read at the two lines that mint it', () => {
  // Cowork asserted this scheme once before on reasoning that did not hold even though the scheme
  // did, so it is pinned against the source rather than believed.
  const a = src('../adapters/mlb.py');
  assert.match(a, /pk = g\.get\("gamePk"\)/);
  assert.match(a, /"id": f"mlb-\{pk\}"/);
});

// ------------------------------------------------------------------------------ the call site
test('the SERVICE row passes the deep link, and only for guardians-tv', () => {
  const g = code('components/GameDetail.js');
  const row = region(g, 'accessible.map((b, i) => (', '))}', 'the accessible broadcast row');
  assert.match(row, /href=\{b\.service_id === 'guardians-tv' \? mlbAppUrl\(game\) : null\}/);
  assert.match(g, /import \{[^}]*\bmlbAppUrl\b[^}]*\} from '\.\.\/lib\/config\.js';/);
});

test('the DIRECTV link is UNTOUCHED - two links, which is Joe’s ruling', () => {
  // "I want to keep that link alive in addition to DirecTV - two separate links - because the MLBTV
  // feed offers more features." The MLB.TV one is the one that changed.
  const g = code('components/GameDetail.js');
  assert.match(g, /<WatchLink service="directv" name="DIRECTV" href=\{DIRECTV_STREAM\} big=\{false\} \/>/);
  assert.equal(DIRECTV_STREAM, 'https://stream.directv.com');
});

test('a null href falls through to watchUrl, so every other service is unchanged', () => {
  // `WatchLink` renders `href || watchUrl(service)`. This is what makes the change inert everywhere
  // except the one row - asserted on the component rather than assumed from the ternary.
  const g = code('components/GameDetail.js');
  assert.match(g, /href=\{href \|\| watchUrl\(service\)\}/);
  assert.equal(watchUrl('guardians-tv'), 'https://www.mlb.com/guardians/schedule/watch',
    'and the fallback entry stays exactly as it was');
});

test('RULE 32: guardians-tv is the only MLB-app service, enumerated not assumed', () => {
  // Searched the WATCH map for every value on an mlb.com host. Exactly two.
  //
  // `mlb-network` IS EXCLUDED ON THE DURABLE REASON FIRST: MLB Network is a linear cable channel,
  // not the per-game MLB.TV product, so a one-game address is meaningless for it whatever any
  // manifest says. That the 2026-09-07 AASA harvest did not claim `/network` corroborates it, but
  // MLB can rewrite that file without telling anyone - it is evidence, not the ruling.
  //
  // MUTATION-CHECKED (prompt 82): adding a third mlb.com entry to the map fails this test, so it
  // really does catch a future MLB-app service rather than counting something that cannot change.
  const c = code('lib/config.js');
  const watch = region(c, 'export const WATCH', '\n};', 'the WATCH map');
  const onMlb = [...watch.matchAll(/^\s*'?([a-z0-9-]+)'?:\s*'https:\/\/www\.mlb\.com[^']*'/gm)]
    .map((m) => m[1]).sort();
  assert.deepEqual(onMlb, ['guardians-tv', 'mlb-network']);
  assert.match(code('components/GameDetail.js'), /'guardians-tv'/);
  assert.doesNotMatch(code('components/GameDetail.js'), /'mlb-network'/,
    'MLB Network is a cable channel, not the MLB.TV per-game product');
});
