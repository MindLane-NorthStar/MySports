// D4/E3: the off-service split and the count line.
//
// The eligibility VERDICT is not tested here because it is not made here - it is read from
// mysports.viewer_game_eligibility, written by pipeline/reconcile.py. What is tested is how this app
// reads that verdict and turns it into a sentence, including the two cases that would otherwise be
// silent failures: a game with no eligibility row at all, and a day where every missed game is on its
// own out-of-market RSN.

import test from 'node:test';
import assert from 'node:assert/strict';

import { isEligible, eligibilityReason, outletsFor, offServiceSummary, countLine, shortOutlet, countSummary } from '../lib/offservice.js';

const game = (id, eligible, outlets = [], extra = {}) => ({
  id,
  eligibility: eligible === undefined ? undefined : [{ eligible, reason: eligible ? 'linear abc' : 'not receivable: x=unavailable' }],
  broadcasts: outlets.map((n) => ({ active: true, network: { id: n.toLowerCase(), canonical_name: n } })),
  ...extra,
});

test('the reconciler verdict is read, not recomputed', () => {
  assert.equal(isEligible(game('a', true)), true);
  assert.equal(isEligible(game('b', false)), false);
  assert.equal(eligibilityReason(game('b', false)), 'not receivable: x=unavailable');
});

test('a game with NO eligibility row is shown, never silently hidden', () => {
  // An unjudged game is not the same as an ineligible one. Hiding something never assessed would be
  // the worst of both behaviours - invisible AND uncounted.
  assert.equal(isEligible({ id: 'x' }), true);
  assert.equal(isEligible({ id: 'x', eligibility: [] }), true);
  assert.equal(isEligible({ id: 'x', eligibility: [{ eligible: null }] }), true);
});

test('eligibility survives PostgREST returning an object instead of an array', () => {
  assert.equal(isEligible({ id: 'x', eligibility: { eligible: false } }), false);
  assert.equal(isEligible({ id: 'x', eligibility: { eligible: true } }), true);
});

test('outlets come from active broadcast rows only', () => {
  const g = {
    broadcasts: [
      { active: true, network: { canonical_name: 'FOX' } },
      { active: false, network: { canonical_name: 'Stale Net' } },
      { active: true, network: { canonical_name: 'FOX' } },
      { active: true, network: null },
    ],
  };
  assert.deepEqual(outletsFor(g), ['FOX'], 'inactive rows and nulls are skipped, duplicates collapse');
});

test('the split hides off-service games and counts them', () => {
  const games = [game('1', true, ['ABC']), game('2', false, ['CBS Sports Network']), game('3', true, ['FOX'])];
  const s = offServiceSummary(games);
  assert.equal(s.total, 3);
  assert.equal(s.offCount, 1);
  assert.deepEqual(s.on.map((g) => g.id), ['1', '3']);
  assert.deepEqual(s.off.map((g) => g.id), ['2']);
  assert.equal(s.line, '3 games · 1 not on your services · CBS Sports Network');
});

test('the line is null when nothing is hidden - no line rather than a zero', () => {
  assert.equal(offServiceSummary([game('1', true, ['ABC'])]).line, null);
  assert.equal(offServiceSummary([]).line, null);
  assert.equal(countLine(10, 0, []), null);
});

test('outlets are ranked by how many missed games they carry', () => {
  const games = [
    game('1', false, ['CBS Sports Network']),
    game('2', false, ['Rays.TV']),
    game('3', false, ['CBS Sports Network']),
  ];
  const s = offServiceSummary(games);
  assert.deepEqual(s.outlets, ['CBS Sports Network', 'Rays.TV'], 'the costlier outlet leads');
});

test('a wall of one-off RSNs is truncated with a count, not listed in full', () => {
  // A real MLB night: nearly every missed game is its own out-of-market RSN. Listing all 28 would
  // bury the number that actually matters.
  const many = Array.from({ length: 28 }, (_, i) => game(String(i), false, [`RSN ${String(i).padStart(2, '0')}`]));
  const s = offServiceSummary(many);
  assert.match(s.line, /^28 games · 28 not on your services · RSN 00, RSN 01, RSN 02 and 25 more$/);
});

test('singular game reads correctly', () => {
  assert.equal(countLine(1, 1, ['FOX']), '1 game · 1 not on your services · FOX');
});

test('an off-service game with no known outlet still gets counted', () => {
  // The outlet NAME is unknown, but a row exists - that is what makes this off-service rather than
  // network-TBD (05 section 9). Before prompt 24 the fixture passed no outlets at all, which now
  // means the fourth state, so it now says what it always meant: one active row, no name on it.
  const s = offServiceSummary([game('1', true, ['ABC']),
                               game('2', false, [], { broadcasts: [{ active: true, network: null }] })]);
  assert.equal(s.line, '2 games · 1 not on your services', 'no outlet clause rather than a dangling separator');
  assert.equal(s.tbdCount, 0, 'a row with no name is still a row');
});

test('the split preserves input order within each group', () => {
  // The ineligible two carry an outlet: ineligible AND no broadcast row is network-TBD now, and
  // this test is about ordering within the off bucket.
  const games = [game('1', true), game('2', false, ['FOX']), game('3', true), game('4', false, ['CBS'])];
  const s = offServiceSummary(games);
  assert.deepEqual(s.on.map((g) => g.id), ['1', '3']);
  assert.deepEqual(s.off.map((g) => g.id), ['2', '4']);
});

test('sponsor tails are trimmed so a comma-joined list stays countable', () => {
  // Left whole, "ABTV, presented by Pechanga Resort Casino" puts a comma INSIDE an item and the line
  // reads as two more outlets than it names.
  assert.equal(shortOutlet('ABTV, presented by Pechanga Resort Casino'), 'ABTV');
  assert.equal(shortOutlet('Cardinals.TV Presented by bet365'), 'Cardinals.TV');
  assert.equal(shortOutlet('Rangers Sports Network, presented by Progressive'), 'Rangers Sports Network');
  assert.equal(shortOutlet('CBS Sports Network'), 'CBS Sports Network', 'plain names are untouched');
  assert.equal(shortOutlet(null), '');
});

test('trimming collapses outlets that differ only by sponsor', () => {
  const line = countLine(3, 3, ['Reds.TV', 'Reds.TV Presented by Somebody', 'FOX']);
  assert.equal(line, '3 games · 3 not on your services · Reds.TV, FOX');
});

// ---------------------------------------------------------------- E5: market pending is a THIRD state
import { isMarketPending, countLines } from '../lib/offservice.js';

const pend = (id, outlets = []) => ({
  id,
  eligibility: [{ eligible: false, market_pending: true, reason: 'not receivable: fox=unverified' }],
  broadcasts: outlets.map((n) => ({ active: true, network: { canonical_name: n } })),
});

test('E5: a market-pending game is neither eligible nor off-service', () => {
  const s = offServiceSummary([game('1', true, ['ABC']), pend('2', ['FOX']), game('3', false, ['CBS Sports Network'])]);
  assert.deepEqual(s.on.map((g) => g.id), ['1']);
  assert.deepEqual(s.pending.map((g) => g.id), ['2']);
  assert.deepEqual(s.off.map((g) => g.id), ['3']);
});

test('E5: a market-pending game is NEVER counted inside "not on your services"', () => {
  const s = offServiceSummary([pend('1', ['FOX']), pend('2', ['CBS']), game('3', false, ['NFL+'])]);
  assert.equal(s.offCount, 1, 'only the genuinely ineligible game counts as off');
  assert.equal(s.pendingCount, 2);
  // The BUCKETS are unchanged - offCount 1, pendingCount 2 above. 05 section 10 renames the
  // segments and sums the two TBD states for display only, so 'unavailable' is the off segment
  // and 'TBD' carries the two pending games.
  assert.equal(s.lines.unavailable, '1 unavailable');
  assert.equal(s.lines.tbd, '2 TBD');
});

test('E5: an eligible row is never pending even if the flag is set', () => {
  // eligible wins - if there is a way to watch it, nothing is pending.
  assert.equal(isMarketPending({ eligibility: [{ eligible: true, market_pending: true }] }), false);
});

test('E5: market_pending null or false is not pending', () => {
  assert.equal(isMarketPending({ eligibility: [{ eligible: false, market_pending: null }] }), false);
  assert.equal(isMarketPending({ eligibility: [{ eligible: false, market_pending: false }] }), false);
  assert.equal(isMarketPending({ id: 'x' }), false, 'no eligibility row at all');
});

test('E5: a game with NO eligibility row is shown, uncounted, and not pending', () => {
  const s = offServiceSummary([{ id: 'x' }]);
  assert.equal(s.onCount, 1, 'unjudged is shown');
  assert.equal(s.pendingCount, 0);
  assert.equal(s.offCount, 0);
});

test('E5: the Sept 13 shape renders the three-way count', () => {
  const games = [
    game('a', true, ['NBC']), game('b', true, ['ESPN']),
    pend('c', ['FOX']), pend('d', ['CBS']), pend('e', ['FOX']),
    // 5 FOX + 3 CBS, not 4/4: a tie breaks alphabetically, so an even split would assert the
    // tiebreak rather than the ranking this line is supposed to show.
    ...Array.from({ length: 8 }, (_, i) => game(`o${i}`, false, [i < 5 ? 'FOX' : 'CBS'])),
  ];
  const s = offServiceSummary(games);
  // ONE line now, and no outlet lists - each revealed row names its own network. Every COUNT stays,
  // because D4 and E5 both turn on counts this line carries.
  assert.equal(s.lines.total, '13 games', 'still computed, just no longer ON the line');
  assert.equal(s.lines.airing, '2 airing');
  assert.equal(s.lines.tbd, '3 TBD');
  assert.equal(s.lines.unavailable, '8 unavailable');
  assert.equal(countSummary(s.lines), '2 airing · 3 TBD · 8 unavailable');
});

test('E5: a state with no games gets no line rather than a zero', () => {
  const l = countLines(2, 2, [], []);
  assert.equal(l.airing, '2 airing');
  assert.equal(l.tbd, null, '"0 TBD" invites the reader to wonder what they missed');
  assert.equal(l.unavailable, null);
});

test('E5: the sponsor trim still applies wherever outlets ARE listed', () => {
  // The summary line no longer lists outlets, so the trim's remaining job is countLine - the form
  // that still names them. A network name containing a comma must not make the list miscount.
  assert.equal(countLine(3, 3, ['ABTV, presented by Pechanga Resort Casino', 'FOX']),
    '3 games · 3 not on your services · ABTV, FOX');
});

test('E5: pending games survive BOTH toggle states', () => {
  // The visible set is "everything except off"; pending is in it either way. This mirrors what
  // Listing computes, and is the property the whole carve-out rests on.
  const games = [game('1', true), pend('2'), game('3', false, ['NFL+'])];
  const s = offServiceSummary(games);
  const offIds = new Set(s.off.map((g) => g.id));
  const collapsed = games.filter((g) => !offIds.has(g.id));
  assert.deepEqual(collapsed.map((g) => g.id), ['1', '2'], 'default state keeps pending');
  assert.deepEqual(games.map((g) => g.id), ['1', '2', '3'], 'show-all keeps everything, in order');
});

test('E5: a band with nothing hidden still has a total and an on-services line', () => {
  // The count block renders for every band; only the empty STATES are omitted. Without the total,
  // a fully-available band renders no counts at all beside a neighbour showing four lines.
  const s = offServiceSummary([game('1', true, ['ESPN']), game('2', true, ['ABC'])]);
  assert.equal(s.lines.total, '2 games');
  assert.equal(s.lines.airing, '2 airing');
  assert.equal(s.lines.tbd, null);
  assert.equal(s.lines.unavailable, null);
});

test('5c: the whole count is ONE line, zero-count segments omitted', () => {
  assert.equal(countSummary(countLines(68, 62, [{}, {}], new Array(4).fill({}))),
    '62 airing · 2 TBD · 4 unavailable');
  // nothing hidden -> no TBD or unavailable segment, and no "0"
  assert.equal(countSummary(countLines(11, 11, [], [])), '11 airing');
  assert.doesNotMatch(countSummary(countLines(11, 11, [], [])), /0 /);
});

test('5c: the summary names no outlets - that was the verbose part', () => {
  const s = offServiceSummary([game('1', false, ['Cardinals.TV']), game('2', false, ['Chicago Sports Network'])]);
  assert.doesNotMatch(countSummary(s.lines), /Cardinals|Chicago|and \d+ more/);
});


// ------------------------------------------------- 05 section 9: NETWORK TBD is a FOURTH state
import { isNetworkTbd } from '../lib/offservice.js';

// A game nobody has announced a broadcaster for: an eligibility row saying no, and no broadcast rows.
const bare = (id) => ({
  id,
  eligibility: [{ eligible: false, market_pending: false, reason: 'no telecast observed' }],
  broadcasts: [],
});

test('the predicate is zero ACTIVE broadcast rows, and nothing else', () => {
  assert.equal(isNetworkTbd(bare('1')), true, 'no rows at all');
  assert.equal(isNetworkTbd({ ...bare('2'), broadcasts: [{ active: false, network: { canonical_name: 'FOX' } }] }),
    true, 'a retired row is not an announcement');
  assert.equal(isNetworkTbd({ ...bare('3'), broadcasts: [{ active: true, network: null }] }),
    false, 'a row with no NAME is still a row - somebody is airing it');
  assert.equal(isNetworkTbd(game('4', false, ['CBS Sports Network'])), false, 'announced but unwatchable');
});

test('an eligible game is never network-TBD, exactly as it is never market-pending', () => {
  // Cannot happen in production - pipeline/reconcile.py derives `eligible` FROM the active rows, so
  // eligible implies at least one. Pinned because the two sibling states must not disagree under the
  // same contradiction, and because fixtures in this file build eligible games with no rows.
  assert.equal(isNetworkTbd({ id: 'x', eligibility: [{ eligible: true }], broadcasts: [] }), false);
  assert.equal(isNetworkTbd(game('y', true)), false);
});

test('broadcasts NOT SELECTED is not a claim that nothing is airing', () => {
  // Every listing surface embeds broadcasts through GAME_SELECT in web/lib/queries.js, but a surface
  // that forgot must not have its whole day declared network-TBD.
  assert.equal(isNetworkTbd({ id: 'x', eligibility: [{ eligible: false }] }), false, 'undefined');
  assert.equal(isNetworkTbd({ id: 'x', eligibility: [{ eligible: false }], broadcasts: null }), false, 'null');
});

test('network-TBD games are their own bucket and are NEVER counted as off-service', () => {
  const s = offServiceSummary([game('1', true, ['ABC']), bare('2'), bare('3'),
                               game('4', false, ['CBS Sports Network']), pend('5', ['FOX'])]);
  assert.deepEqual(s.tbd.map((g) => g.id), ['2', '3']);
  assert.deepEqual(s.off.map((g) => g.id), ['4'], 'only the announced-but-unwatchable game is off');
  assert.deepEqual(s.pending.map((g) => g.id), ['5']);
  assert.deepEqual(s.on.map((g) => g.id), ['1']);
  assert.equal(s.tbdCount, 2);
  assert.equal(s.offCount, 1, 'the two bare games are not in this number');
  assert.equal(s.onCount + s.pendingCount + s.tbdCount + s.offCount, s.total,
    'every game lands in exactly one bucket');
});

test('D4 filter-by-default does not hide network-TBD games, in EITHER toggle state', () => {
  // The visible set is "everything except off", which is what Listing and SportBand compute. This is
  // the property the whole carve-out rests on - 529 games were hidden by its absence.
  const games = [game('1', true, ['ABC']), bare('2'), game('3', false, ['NFL+']), pend('4', ['FOX'])];
  const offIds = new Set(offServiceSummary(games).off.map((g) => g.id));
  assert.deepEqual(games.filter((g) => !offIds.has(g.id)).map((g) => g.id), ['1', '2', '4'],
    'default state keeps the bare game');
  assert.deepEqual(games.map((g) => g.id), ['1', '2', '3', '4'], 'show-all keeps everything, in order');
});

test('MARKET TBD and NETWORK TBD are mutually exclusive - no card can render both', () => {
  // By construction: market-pending needs an active row carrying access_status 'unverified',
  // network-TBD needs zero active rows. Confirmed at 0 of 1379 rows in the live database.
  const every = [game('1', true, ['ABC']), bare('2'), pend('3', ['FOX']),
                 game('4', false, ['CBS Sports Network']), { id: '5' }];
  for (const g of every) {
    assert.equal(isMarketPending(g) && isNetworkTbd(g), false, 'both badges on ' + g.id);
  }
  // A CONTRADICTORY row - market_pending true with no broadcast rows - resolves to network-TBD only,
  // never to both, because the bucket chain tests the structural fact first.
  const liar = { id: 'z', eligibility: [{ eligible: false, market_pending: true }], broadcasts: [] };
  const s = offServiceSummary([liar]);
  assert.equal(s.tbdCount, 1);
  assert.equal(s.pendingCount, 0, 'a broadcaster that does not exist is not asserted');
});

test('the count line renders the TBD segment, and omits it at zero', () => {
  // The two worst days of the season load, measured against the live database on 2026-09-03.
  assert.equal(countSummary(countLines(56, 6, [], new Array(5).fill({}), new Array(45).fill({}))),
    '6 airing · 45 TBD · 5 unavailable');
  assert.equal(countSummary(countLines(16, 0, [], [], new Array(16).fill({}))), '16 TBD');
  // zero-omit survives, in both directions
  assert.equal(countSummary(countLines(11, 11, [], [], [])), '11 airing');
  assert.doesNotMatch(countSummary(countLines(11, 11, [], [], [])), /TBD/);
  assert.doesNotMatch(countSummary(countLines(16, 0, [], [], new Array(16).fill({}))), /0 /);
  assert.equal(countLines(2, 2, [], [], []).tbd, null, '"0 TBD" is noise');
  // and the total is gone from the LINE while remaining available on the object
  assert.doesNotMatch(countSummary(countLines(56, 6, [], new Array(5).fill({}), new Array(45).fill({}))), /games/);
  assert.equal(countLines(56, 6, [], [], []).total, '56 games');
});

test('the two TBD states are SUMMED on the line, and only on the line', () => {
  // 2 market-pending + 9 network-TBD = 11 TBD on the line. 05 section 10: the distinction is not
  // lost, it moves to the card, which keeps MARKET TBD and NETWORK TBD as two separate badges.
  const l = countLines(20, 5, [{}, {}], new Array(4).fill({}), new Array(9).fill({}));
  assert.equal(countSummary(l), '5 airing · 11 TBD · 4 unavailable');
  // the sets themselves are NOT merged - offServiceSummary still buckets them apart
  const s = offServiceSummary([game('1', true, ['ABC']), pend('2', ['FOX']), bare('3')]);
  assert.equal(s.pendingCount, 1);
  assert.equal(s.tbdCount, 1);
  assert.equal(s.lines.tbd, '2 TBD', 'summed for display');
});

test('a day with no bare games still renders three segments', () => {
  // The E5 shape in the section 10 vocabulary: market-pending alone still fills the TBD segment.
  assert.equal(countSummary(countLines(68, 62, [{}, {}], new Array(4).fill({}))),
    '62 airing · 2 TBD · 4 unavailable');
});

// ---------------------------------------------------------------- prompt 50 stage 4: the page count
//
// D4's filter-by-default is unchanged in substance and moved from the band to the page, and the
// three carve-outs are what these pin. If any of them ever starts hiding a game, the page tells Joe
// he cannot watch something nobody has decided about yet.

import { splitHidden, pageCountLine, revealLabel } from '../lib/offservice.js';

const fav = (id, home) => ({ ...game(id, false, ['CBS Sports Network']), home_team_id: home });

test('stage 4a: an off-service game is HIDDEN', () => {
  const { visible, hidden } = splitHidden(
    [game('1', true, ['ABC']), game('2', false, ['NFL+'])], new Set());
  assert.deepEqual(visible.map((g) => g.id), ['1']);
  assert.deepEqual(hidden.map((g) => g.id), ['2']);
});

test('stage 4a: NETWORK TBD is NEVER hidden - nobody has decided whether he can watch it', () => {
  // 529 games were in this state on the season load. Hiding them would be a false statement about
  // every one of them (05 §9).
  const { visible, hidden } = splitHidden([bare('1'), bare('2'), game('3', true, ['ABC'])], new Set());
  assert.equal(hidden.length, 0, 'not one of them may be hidden');
  assert.deepEqual(visible.map((g) => g.id), ['1', '2', '3']);
});

test('stage 4a: MARKET PENDING is NEVER hidden either', () => {
  const { visible, hidden } = splitHidden([pend('1', ['FOX']), game('2', false, ['NFL+'])], new Set());
  assert.deepEqual(visible.map((g) => g.id), ['1'], 'E5 games stay on the page');
  assert.deepEqual(hidden.map((g) => g.id), ['2']);
});

test('stage 4a: a FAVOURITE is never hidden, even when it is off-service', () => {
  // Measured on 2026-09-12 before this guard existed: Fresno State appeared nowhere on the page
  // while the count line still counted it.
  const ids = new Set(['cle']);
  const { visible, hidden } = splitHidden([fav('1', 'cle'), game('2', false, ['NFL+'])], ids);
  assert.deepEqual(visible.map((g) => g.id), ['1'], 'the favourite survives the filter');
  assert.deepEqual(hidden.map((g) => g.id), ['2']);
});

test('R7 (prompt 56): the page line reads "N broadcasts on your services", TBD only when there are some', () => {
  const s = (rows) => splitHidden(rows, new Set()).summary;
  assert.equal(pageCountLine(s([game('1', true, ['ABC']), game('2', true, ['CBS'])])),
               '2 broadcasts on your services');
  assert.equal(pageCountLine(s([game('1', true, ['ABC']), bare('2'), pend('3', ['FOX'])])),
               '1 broadcast on your services · 2 TBD', 'the two TBD states sum on the line, as §10 had it');
  assert.equal(pageCountLine(s([bare('1')])), '0 broadcasts on your services · 1 TBD');
  // zero-count segments stay omitted
  assert.doesNotMatch(pageCountLine(s([game('1', true, ['ABC'])])), /TBD/);
  assert.doesNotMatch(pageCountLine(s([game('1', true, ['ABC'])])), /0 /);
});

test('stage 4b: singular and plural', () => {
  const s = (rows) => splitHidden(rows, new Set()).summary;
  assert.match(pageCountLine(s([game('1', true, ['ABC'])])), /^1 broadcast on/);
  assert.match(pageCountLine(s([game('1', true, ['ABC']), game('2', true, ['CBS'])])), /^2 broadcasts on/);
});

test('stage 4b: the reveal names its own number, and is absent when there is nothing to reveal', () => {
  assert.equal(revealLabel(18), 'Show 18 not on your services');
  assert.equal(revealLabel(1), 'Show 1 not on your services');
  assert.equal(revealLabel(0), null, 'no control when pressing it would do nothing');
});

test('stage 4: the line and the reveal ACCOUNT FOR EVERY ROW, with nothing counted twice', () => {
  // This is the property the per-band lines had and the page-level line must keep: every row is in
  // exactly one of on / TBD / hidden.
  const rows = [
    game('1', true, ['ABC']), game('2', true, ['CBS']),
    pend('3', ['FOX']), bare('4'), bare('5'),
    game('6', false, ['NFL+']), game('7', false, ['CBS Sports Network']),
  ];
  const { visible, hidden, summary } = splitHidden(rows, new Set());
  assert.equal(visible.length + hidden.length, rows.length, 'no row is dropped');
  assert.equal(summary.onCount + summary.pendingCount + summary.tbdCount + summary.offCount, rows.length);
  assert.equal(hidden.length, summary.offCount, 'hidden is exactly the off-service set');
  assert.equal(pageCountLine(summary), '2 broadcasts on your services · 3 TBD');
  assert.equal(revealLabel(hidden.length), 'Show 2 not on your services');
});
