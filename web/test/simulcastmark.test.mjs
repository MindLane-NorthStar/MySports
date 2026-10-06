// THE CAVALIERS' OTA SIMULCAST ON THE LIST CARD (prompt 106, Joe's rulings 2026-09-16).
//
// Joe: the GRID shows every network airing the game - a both-station game appears three times on one
// grid, deliberately - while the LIST shows ONE CARD per game wearing the composite mark for its
// state. These assertions are on the DECISION (which slug, for which set of services) and on the two
// facts that keep a composite off the rail, because that is the half a later edit breaks silently.
//
// WHAT THIS DOES NOT COVER: how the three lanes look. That is a browser fact and is in the rendered
// evidence under assets/p106-simulcast-render/, not here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { cardMarkSlug, simulcastLanes, LIST_ONLY_MARKS, hasMark } from '../lib/marks.js';
import manifest from '../public/marks/manifest.json' with { type: 'json' };

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');
const data = (p) => JSON.parse(readFileSync(join(HERE, '..', '..', 'data', p), 'utf8'));

/** A game carrying exactly these services, in the shape the page hands the card. */
const game = (...ids) => ({ broadcasts: ids.map((service_id) => ({ service_id, active: true })) });

// --------------------------------------------------------------- the four states Joe named
test('DAZN + CBS is the nine WOIO-only games, and wears cbs-dazn', () => {
  assert.equal(cardMarkSlug(game('dazn', 'cbs')), 'cbs-dazn');
});

test('DAZN + WUAB 43 + CBS is the four both-station games, and wears cbs-wuab-43', () => {
  // `wuab-43` already carries RESN/DAZN inside it, so the three-service row takes the TWO-part
  // stack. A third tier would be DAZN twice.
  assert.equal(cardMarkSlug(game('dazn', 'wuab-43', 'cbs')), 'cbs-wuab-43');
});

test('DAZN + WUAB 43 is the two WUAB-only games, and wears the existing wuab-43', () => {
  assert.equal(cardMarkSlug(game('dazn', 'wuab-43')), 'wuab-43');
});

test('DAZN alone collapses nothing - the ordinary single-mark path still draws it', () => {
  // null, not 'dazn': the card's existing line picks the mark off the chosen broadcast, and this
  // must not take that decision over for every Cavaliers game in the season.
  assert.equal(cardMarkSlug(game('dazn')), null);
});

test('a game with no DAZN row collapses nothing, whatever else it carries', () => {
  // The composites mean "this Cavaliers game is also on air". CBS alone is an ordinary CBS game -
  // an NFL Sunday, a bowl - and must never wear a Cavaliers mark.
  assert.equal(cardMarkSlug(game('cbs')), null);
  assert.equal(cardMarkSlug(game('cbs', 'wuab-43')), null);
  assert.equal(cardMarkSlug(game('espn', 'abc')), null);
  assert.equal(cardMarkSlug({ broadcasts: [] }), null);
  assert.equal(cardMarkSlug(undefined), null);
});

test('an INACTIVE row does not count toward the service set', () => {
  // `active: false` is how a row that stopped being observed is retired; the card filters on it
  // everywhere else, and a retired CBS row must not keep a game in the composite state.
  assert.equal(cardMarkSlug({ broadcasts: [
    { service_id: 'dazn', active: true }, { service_id: 'cbs', active: false }] }), null);
});

test('the service set is read off the GAME, never from data/local_rights.json', () => {
  // The rendering surface has no business knowing which games were hand-entered. By the time a card
  // is drawn the fact is simply which rows the game carries.
  //
  // COMMENTS STRIPPED FIRST, and the first version of this test failed because they were not: both
  // files EXPLAIN that they must not read the announcement file, and naming it in that sentence is
  // not reading it. This is the same strip autoscroll.test.mjs and favbracket.test.mjs use.
  const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code('lib/marks.js'), /local_rights/, 'marks.js must not read the announcement file');
  const card = code('components/MatchupCard.js');
  assert.doesNotMatch(card, /local_rights|simulcast_outlets/, 'nor may the card');
  // The collapse is asked in lib/cardbroadcast.js's `cardMark` since prompt 127, and the card wears
  // what it returns - so the function the card calls is held to the same rule as the card.
  const wears = code('lib/cardbroadcast.js');
  assert.doesNotMatch(wears, /local_rights|simulcast_outlets/, 'nor may the function the card wears');
  assert.match(wears, /const collapsed = cardMarkSlug\(game\);/);
  assert.match(card, /const mark = cardMark\(game\)\.url;/);
});

// ------------------------------------------- the grid's half of the ruling: a lane per network
test('a both-station game takes THREE lanes on the grid, in rail order', () => {
  // Joe: "every network airing a Cavs game shows it on the grid". Measured in the browser on
  // 2027-03-14: the same 6:00 PM Cavaliers @ Kings block draws in cbs, wuab-43 and dazn.
  assert.deepEqual(simulcastLanes(game('dazn', 'wuab-43', 'cbs')), ['cbs', 'wuab-43', 'dazn']);
});

test('a WOIO-only game takes two lanes, and a WUAB-only game takes two', () => {
  assert.deepEqual(simulcastLanes(game('dazn', 'cbs')), ['cbs', 'dazn']);
  assert.deepEqual(simulcastLanes(game('dazn', 'wuab-43')), ['wuab-43', 'dazn']);
});

test('EVERY OTHER GAME TAKES ONE BLOCK, and that scope is load-bearing', () => {
  // A lane per broadcast in general would split every CFB game across ESPN and ESPN+, double the
  // blocks on a Saturday and move the block and lane counts `npm run geometry` holds as HARD STOPS.
  assert.deepEqual(simulcastLanes(game('dazn')), []);
  assert.deepEqual(simulcastLanes(game('espn', 'espn-plus')), []);
  assert.deepEqual(simulcastLanes(game('cbs')), []);
  assert.deepEqual(simulcastLanes({ broadcasts: [] }), []);
});

test('the grid asks for lanes and falls back to ONE broadcast, in MobileGrid', () => {
  const code = src('components/MobileGrid.js')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.match(code, /const lanes = program \? \[\] : simulcastLanes\(g\);/);
  assert.match(code, /cardBroadcast\(g\)\]\.filter\(Boolean\)/, 'the one-block path survives');
  assert.match(code, /for \(const b of chosen\) timed\.push\(/);
});

// --------------------------------------------------- the composites are LIST ONLY (Joe's ruling)
test('every list-only slug is a real published mark, so the set cannot rot', () => {
  for (const slug of LIST_ONLY_MARKS) {
    assert.ok(hasMark(slug), `${slug} is in LIST_ONLY_MARKS but not in the manifest`);
  }
  assert.deepEqual([...LIST_ONLY_MARKS].sort(), ['cbs-dazn', 'cbs-wuab-43']);
});

test('NO composite is a rail lane - it is not a network in data/row_order.json', () => {
  // THE GUARD railmark.test.mjs ASKED FOR. A rail lane is a row in row_order; if a composite ever
  // became one it would draw at the rail's 600px^2 target like anything else and look correct.
  const ro = data('row_order.json');
  const names = [];
  for (const [sport, groups] of Object.entries(ro)) {
    if (sport.startsWith('_')) continue;
    for (const [group, items] of Object.entries(groups)) {
      if (group.startsWith('_') || !Array.isArray(items)) continue;
      for (const it of items) names.push(String(typeof it === 'string' ? it : it.network || ''));
    }
  }
  const slugged = names.map((n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  for (const slug of LIST_ONLY_MARKS) {
    assert.ok(!slugged.includes(slug), `${slug} became a rail lane in row_order.json`);
  }
  // and the lane prompt 106 DID add is there, in the NBA band
  assert.deepEqual(ro.nba.broadcast.map((b) => b.network), ['ABC', 'NBC', 'CBS', 'WUAB 43']);
});

test('NO composite is a service anyone can subscribe to - absent from access_profile.json', () => {
  const ap = data('access_profile.json');
  const all = [...(ap.available || []), ...(ap.unavailable || [])]
    .map((n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
  for (const slug of LIST_ONLY_MARKS) assert.ok(!all.includes(slug), `${slug} is in access_profile`);
  // WOIO stays out of it too: it resolves as CBS in the adapter's alias table (prompt 106).
  assert.ok(!(ap.available || []).includes('WOIO') && !(ap.unavailable || []).includes('WOIO'),
    'WOIO must stay out of access_profile - it resolves as CBS');
});

test('the composites are named in ONE web file - the rail and the detail cannot reach them', () => {
  // A composite can only arrive at another surface through a broadcast's service_id or a rail row,
  // and no adapter emits one. This pins the remaining route: a component naming a composite slug
  // directly would be drawing one outside cardMarkSlug().
  for (const f of ['components/MobileGrid.js', 'components/GameDetail.js', 'components/MatchupCard.js',
                   'components/Listing.js']) {
    const body = src(f);
    for (const slug of LIST_ONLY_MARKS) {
      assert.ok(!body.includes(slug), `${f} names ${slug}; only lib/marks.js may`);
    }
  }
  assert.ok(manifest.some((m) => m.slug === 'cbs-dazn'), 'and they are still published');
});
