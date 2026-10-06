// WHICH BROADCAST THE CARD AND THE GRID LANE NAME (prompt 126, Joe's report 2026-09-30).
//
// Joe: the Blue Jackets opener showed no network mark on its list card while Prime Video sat in its
// detail panel. The card named the primary row, `cbjnhl`, which has no published mark, on a game the
// reconciler had decided he can watch on `prime-video`. The rule in lib/cardbroadcast.js keeps the
// card's own pick whenever it shows a mark, and otherwise names the row the eligibility verdict
// names, if that row is active on the game and has a mark.
//
// THE FIXTURES ARE ROWS AS gameById() RETURNED THEM ON 2026-09-30, trimmed to the two embeds the rule
// reads, and the first test holds their keys to GAME_SELECT's own column lists so a fixture cannot
// quietly stop being the query's shape. The Cavaliers rows are the exception and say so where they
// are built: no simulcast row was loaded on that date (`wuab-43` had 0 rows), so there was nothing
// live to copy.
//
// WHAT THIS DOES NOT COVER: that the mark is painted, or which rail row the grid draws the game in.
// Those are browser facts and are in the screenshots under assets/p126-card-broadcast/.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { cardBroadcast } from '../lib/cardbroadcast.js';
import { cardMarkSlug, simulcastLanes, hasMark, showsMark } from '../lib/marks.js';
import { region } from './region.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** One broadcast row, every column GAME_SELECT embeds. */
const bc = (service_id, delivery_surface, access_status, o = {}) => ({
  label: o.label ?? null,
  active: o.active ?? true,
  network: {
    id: service_id,
    type: o.type ?? (delivery_surface === 'STREAMING' ? 'streaming' : 'linear_cable'),
    canonical_name: o.name ?? service_id.toUpperCase(),
    default_sort_order: o.order ?? null,
  },
  feed_side: o.side ?? 'NATIONAL',
  is_primary: o.primary ?? false,
  service_id,
  access_status,
  delivery_surface,
  carriage_certainty: o.certainty ?? 'CONFIRMED',
});

/** The verdict embed: an ARRAY of one row, which is how PostgREST returns it. */
const verdict = (eligible, reason, via_net, via_srv) => [{
  reason,
  eligible,
  market_pending: false,
  eligible_via_network_id: via_net,
  eligible_via_service_ids: via_srv,
}];

// nhl-2026020011, BUF @ CBJ, 2026-10-01 - the game Joe reported. Five rows, one of them retired.
const OPENER = {
  broadcasts: [
    bc('cbj-local', 'LINEAR', 'available', { label: 'Blue Jackets local TV - carrier TBA', active: false,
      type: 'local_tba', name: 'CBJ LOCAL', order: 39, side: 'HOME', certainty: 'TBA_NO_RIGHTS_HOLDER' }),
    bc('cbjnhl', 'LINEAR', 'unknown', { label: 'CBJNHL', name: 'CBJNHL', side: 'HOME', primary: true }),
    bc('cbjhn', 'LINEAR', 'unknown', { label: 'CBJHN', name: 'CBJHN', side: 'HOME' }),
    bc('msg-b', 'LINEAR', 'out_of_market', { label: 'MSG-B', name: 'MSG-B', side: 'HOME' }),
    bc('prime-video', 'STREAMING', 'available', { label: 'Blue Jackets on Prime Video', name: 'Prime Video',
      order: 27, side: 'HOME' }),
  ],
  eligibility: verdict(true, 'stream only: prime-video', null, ['prime-video']),
};

// nfl-401872994, BUF @ LAR, 2026-10-12 - a Monday night simulcast. ESPN is listed first and named by
// the verdict; ABC is primary.
const MNF = {
  broadcasts: [
    bc('espn', 'LINEAR', 'available', { name: 'ESPN', order: 6 }),
    bc('abc', 'LINEAR', 'available', { name: 'ABC', type: 'linear_broadcast', order: 2, primary: true }),
  ],
  eligibility: verdict(true, 'linear espn', 'espn', []),
};

// nhl-2026020068, PIT @ CBJ, 2026-10-09 - past the refresh's window, still on the old carrier-TBA row.
const CARRIER_TBA = {
  broadcasts: [
    bc('cbjnhl', 'LINEAR', 'unknown', { label: 'CBJNHL', name: 'CBJNHL', side: 'HOME', primary: true }),
    bc('cbj-local', 'LINEAR', 'available', { label: 'Blue Jackets local TV - carrier TBA', type: 'local_tba',
      name: 'CBJ LOCAL', order: 39, side: 'HOME', certainty: 'TBA_NO_RIGHTS_HOLDER' }),
  ],
  eligibility: verdict(true, 'local feed - carrier TBA', 'cbj-local', []),
};

/** What the card named at 71a819b, written out so "unchanged" has something to be compared with. */
const previousPick = (game) => {
  const rows = (game.broadcasts || []).filter((b) => b.active !== false);
  if (!rows.length) return null;
  return rows.find((b) => b.is_primary) || rows.find((b) => b.delivery_surface === 'LINEAR') || rows[0];
};

// ------------------------------------------------------------------ the fixtures are the query's shape
test('the fixture rows carry exactly the columns GAME_SELECT embeds', () => {
  const q = src('lib/queries.js');
  const cols = (re) => q.match(re)[1].split(',').map((c) => c.split(':')[0]).sort();
  const broadcast = q.match(/'broadcasts:game_broadcasts\(([^']+?),network:networks_services\(([^)]+)\)\)'/);
  assert.ok(broadcast, 'the game broadcast embed is one string in GAME_SELECT');
  assert.deepEqual(Object.keys(OPENER.broadcasts[0]).sort(), [...broadcast[1].split(','), 'network'].sort());
  assert.deepEqual(Object.keys(OPENER.broadcasts[0].network).sort(), broadcast[2].split(',').sort());
  assert.deepEqual(Object.keys(OPENER.eligibility[0]).sort(),
    cols(/'eligibility:viewer_game_eligibility\(([^)]+)\)'/));
});

// ---------------------------------------------------------------------------------- the rule
test("the Blue Jackets opener's rows name prime-video", () => {
  assert.equal(previousPick(OPENER).service_id, 'cbjnhl', 'the primary row is what the card used to name');
  assert.equal(hasMark('cbjnhl'), false, 'and it has no published mark - the empty column Joe saw');
  const b = cardBroadcast(OPENER);
  assert.equal(b.service_id, 'prime-video');
  assert.equal(b, OPENER.broadcasts[4], 'the ROW from the game, so the grid lane gets its network too');
  assert.ok(showsMark(b), 'and the card draws a mark for it');
});

test('an ABC primary with an ESPN verdict keeps ABC, because ABC shows a mark', () => {
  assert.ok(hasMark('abc'), 'abc has a published mark');
  assert.ok(hasMark('espn'), 'and so does the row the verdict names - the mark on the PICK is what decides');
  assert.equal(cardBroadcast(MNF).service_id, 'abc');
});

test('a pick that shows a mark is never replaced, whatever the verdict names', () => {
  const game = {
    broadcasts: [
      bc('tnt', 'LINEAR', 'unknown', { primary: true }),
      bc('hbo-max', 'STREAMING', 'available'),
    ],
    eligibility: verdict(true, 'stream only: hbo-max', null, ['hbo-max']),
  };
  assert.equal(cardBroadcast(game).service_id, 'tnt');
});

test('no eligibility row keeps the primary', () => {
  for (const eligibility of [[], undefined, null]) {
    assert.equal(cardBroadcast({ ...OPENER, eligibility }).service_id, 'cbjnhl');
  }
});

test('a verdict that names nothing keeps the primary', () => {
  const off = verdict(false, 'not receivable: cbjnhl=unknown', null, []);
  assert.equal(cardBroadcast({ ...OPENER, eligibility: off }).service_id, 'cbjnhl');
  // `eligible_via_service_ids` is `not null default '{}'` (migration 0004); a null still must not throw
  const bare = verdict(true, 'stream only: prime-video', null, null);
  assert.equal(cardBroadcast({ ...OPENER, eligibility: bare }).service_id, 'cbjnhl');
});

test('the verdict embed is read as an object as well as an array', () => {
  assert.equal(cardBroadcast({ ...OPENER, eligibility: OPENER.eligibility[0] }).service_id, 'prime-video');
});

test('a verdict naming a service with no row on the game keeps the primary', () => {
  const game = { ...OPENER, eligibility: verdict(true, 'stream only: peacock', null, ['peacock']) };
  assert.ok(hasMark('peacock'), 'the named service has a mark, so only the missing row stops it');
  assert.equal(cardBroadcast(game).service_id, 'cbjnhl');
});

test('a verdict naming a service whose only row is inactive keeps the primary', () => {
  const broadcasts = OPENER.broadcasts.map((b) => (b.service_id === 'prime-video' ? { ...b, active: false } : b));
  assert.equal(cardBroadcast({ ...OPENER, broadcasts }).service_id, 'cbjnhl');
});

test('a verdict naming a service with a row but no mark keeps the primary', () => {
  assert.equal(hasMark('cbj-local'), false, 'the carrier-TBA row has no published mark');
  assert.equal(cardBroadcast(CARRIER_TBA).service_id, 'cbjnhl');
});

test('the linear network the verdict names comes before its streaming services', () => {
  const game = {
    broadcasts: [
      bc('cbjnhl', 'LINEAR', 'unknown', { primary: true }),
      bc('prime-video', 'STREAMING', 'available'),
      bc('tnt', 'LINEAR', 'available'),
    ],
    eligibility: verdict(true, 'linear tnt', 'tnt', ['prime-video']),
  };
  assert.ok(hasMark('tnt') && hasMark('prime-video'), 'both named rows could be drawn');
  assert.equal(cardBroadcast(game).service_id, 'tnt');
});

test('the streaming services are taken in the verdict\'s own order, skipping any without a mark', () => {
  const rows = [
    bc('cbjnhl', 'LINEAR', 'unknown', { primary: true }),
    bc('prime-video', 'STREAMING', 'available'),
    bc('espn-plus', 'STREAMING', 'available'),
    bc('acc-extra', 'STREAMING', 'available'),
  ];
  const named = (ids) => cardBroadcast({ broadcasts: rows, eligibility: verdict(true, 'stream only', null, ids) });
  assert.equal(named(['espn-plus', 'prime-video']).service_id, 'espn-plus');
  assert.equal(named(['prime-video', 'espn-plus']).service_id, 'prime-video');
  assert.equal(hasMark('acc-extra'), false);
  assert.equal(named(['acc-extra', 'prime-video']).service_id, 'prime-video', 'the markless one is passed over');
});

// ------------------------------------------------------- what the change must leave exactly as it was
test('the pick itself is unchanged: primary, then a linear row, then whatever is left', () => {
  const lin = bc('espn', 'LINEAR', 'available');
  const str = bc('espn-plus', 'STREAMING', 'available');
  assert.equal(cardBroadcast({ broadcasts: [str, lin] }), lin, 'no primary: the linear row');
  assert.equal(cardBroadcast({ broadcasts: [lin, { ...str, is_primary: true }] }).service_id, 'espn-plus');
  assert.equal(cardBroadcast({ broadcasts: [str] }), str, 'nothing else: the first row');
  assert.equal(cardBroadcast({ broadcasts: [{ ...lin, active: false }] }), null, 'a retired row is no row');
  assert.equal(cardBroadcast({ broadcasts: [] }), null);
  assert.equal(cardBroadcast({}), null);
});

test('a Cavaliers simulcast game still collapses exactly as before', () => {
  // BUILT, NOT COPIED: no simulcast row was loaded on 2026-09-30. The shape is the query's; the
  // services are the three states `cardMarkSlug` documents, with the verdict the reconciler would
  // write for them - the OTA station linear, DAZN streaming.
  const dazn = () => bc('dazn', 'STREAMING', 'available', { label: 'Cavaliers on DAZN (RESN)', name: 'DAZN',
    order: 49, side: 'HOME', primary: true });
  const cbs = () => bc('cbs', 'LINEAR', 'available', { name: 'CBS', type: 'linear_broadcast' });
  const wuab = () => bc('wuab-43', 'LINEAR', 'available', { name: 'WUAB 43', type: 'linear_broadcast' });
  const states = [
    { rows: [dazn(), cbs()], via: 'cbs', slug: 'cbs-dazn', lanes: ['cbs', 'dazn'] },
    { rows: [dazn(), wuab(), cbs()], via: 'wuab-43', slug: 'cbs-wuab-43', lanes: ['cbs', 'wuab-43', 'dazn'] },
    { rows: [dazn(), wuab()], via: 'wuab-43', slug: 'wuab-43', lanes: ['wuab-43', 'dazn'] },
  ];
  for (const s of states) {
    const game = { broadcasts: s.rows, eligibility: verdict(true, `linear ${s.via}`, s.via, ['dazn']) };
    assert.equal(cardMarkSlug(game), s.slug, 'the composite the card wears');
    assert.deepEqual(simulcastLanes(game), s.lanes, 'and the lanes the grid draws');
    assert.equal(cardBroadcast(game), previousPick(game), 'the row under the collapse did not move either');
  }
  // DAZN alone collapses nothing and draws `dazn` from the pick, as it did
  const alone = { broadcasts: [dazn()], eligibility: verdict(true, 'stream only: dazn', null, ['dazn']) };
  assert.equal(cardMarkSlug(alone), null);
  assert.equal(cardBroadcast(alone).service_id, 'dazn');
  // and the card still asks the collapse FIRST, before the pick this rule makes. The line moved into
  // lib/cardbroadcast.js's `cardMark` with prompt 127, and the card wears what it returns.
  assert.match(region(code('lib/cardbroadcast.js'), 'export function cardMark(', 'export function broadcastName(', 'cardMark'),
    /url: collapsed \? markUrl\(collapsed\) : \(showsMark\(b\) \? markUrl\(b\.service_id\) : null\),/);
  assert.match(code('components/MatchupCard.js'), /const mark = cardMark\(game\)\.url;/);
});

// ------------------------------------------------------------ one rule, reached from both surfaces
test('the card and the grid lane call the same function, and the query fetches what it reads', () => {
  const card = code('components/MatchupCard.js');
  assert.match(card, /import \{ cardBroadcast, cardMark \} from '\.\.\/lib\/cardbroadcast\.js';/);
  assert.match(card, /export \{ cardBroadcast \};/);
  assert.doesNotMatch(card, /function cardBroadcast/, 'no second copy of the rule in the component');
  // the card reaches the rule through `cardMark`, which calls it (prompt 127), and wears its mark
  assert.match(region(code('lib/cardbroadcast.js'), 'export function cardMark(', 'export function broadcastName(', 'cardMark'),
    /const b = cardBroadcast\(game\);/);
  assert.match(card, /const mark = cardMark\(game\)\.url;/);
  const grid = code('components/MobileGrid.js');
  assert.match(grid, /import \{ cardName, cardBroadcast \} from '\.\/MatchupCard\.js';/);
  assert.match(grid, /programBroadcast\(g\) : cardBroadcast\(g\)\]\.filter\(Boolean\)/, 'the lane is chosen by it');
  const q = src('lib/queries.js');
  assert.match(q, /'eligibility:viewer_game_eligibility\(eligible,reason,eligible_via_network_id,eligible_via_service_ids,market_pending\)'/);
  // the PROGRAM verdict is out of scope and unchanged: programs choose their row by programBroadcast()
  assert.match(q, /'eligibility:viewer_program_eligibility\(eligible,reason,eligible_via_network_id,market_pending\)'/);
});
