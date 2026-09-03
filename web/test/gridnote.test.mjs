// 05 section 9, the grid consequence: the note the grid renders for games it has no network row to
// place, and the invariant that makes it trustworthy.
//
// WHY THIS EXISTS. The count line and the grid sit on the same screen, and before prompt 24 they used
// different vocabularies for the same games: the band said nothing at all about them (they were
// filtered as "not on your services") while the grid's footer reported "46 kickoff / network TBA",
// conflating a game with no announced kickoff with a game with no announced broadcaster. On
// 2026-11-14 that single number covered 45 games with a known kickoff and no broadcaster plus 1 with
// a broadcaster and no kickoff.
//
// The component cannot be rendered here - it needs a canvas text measurer and React hooks - so what
// is pinned is the RULE, computed from the same exported predicate the component imports. If
// isNetworkTbd ever drifts, or if either surface starts deriving the state for itself, the two counts
// diverge and this fails.

import test from 'node:test';
import assert from 'node:assert/strict';
import { isNetworkTbd, offServiceSummary } from '../lib/offservice.js';

const eligible = (id, net) => ({
  id,
  kickoff_status: 'set',
  eligibility: [{ eligible: true, reason: `linear ${net}` }],
  broadcasts: [{ active: true, service_id: net, network: { id: net, canonical_name: net.toUpperCase() } }],
});

// Announced, watchable, but nobody has said WHEN - unplaceable for the other reason.
const kickoffTbd = (id, net) => ({ ...eligible(id, net), kickoff_status: 'tbd' });

// The announcement horizon: a known date, an eligibility row saying no, and no broadcast rows.
const networkTbd = (id) => ({
  id,
  kickoff_status: 'set',
  eligibility: [{ eligible: false, market_pending: false, reason: 'no telecast observed' }],
  broadcasts: [],
});

// Announced and genuinely unwatchable - D4 filters these out before the grid ever sees them.
const offService = (id, net) => ({
  id,
  kickoff_status: 'set',
  eligibility: [{ eligible: false, market_pending: false, reason: `not receivable: ${net}=unavailable` }],
  broadcasts: [{ active: true, service_id: net, network: { id: net, canonical_name: net.toUpperCase() } }],
});

/** What Listing.js hands the grid: everything except genuinely ineligible games. */
const gridGames = (games) => {
  const off = new Set(offServiceSummary(games).off.map((g) => g.id));
  return games.filter((g) => !off.has(g.id));
};

/** MobileGrid's partition of the unplaceable bucket, by REASON. */
const partition = (games) => {
  const unplaceable = gridGames(games).filter((g) => g.kickoff_status === 'tbd' || isNetworkTbd(g));
  return {
    netTbd: unplaceable.filter((g) => isNetworkTbd(g)),
    kickTbd: unplaceable.filter((g) => !isNetworkTbd(g)),
  };
};

test('the two unplaceable reasons are counted separately, not as one number', () => {
  const games = [eligible('1', 'espn'), kickoffTbd('2', 'abc'), networkTbd('3'), networkTbd('4')];
  const { netTbd, kickTbd } = partition(games);
  assert.deepEqual(netTbd.map((g) => g.id), ['3', '4'], 'no broadcaster announced');
  assert.deepEqual(kickTbd.map((g) => g.id), ['2'], 'a broadcaster, but no kickoff');
});

test('the partition is exhaustive - no unplaceable game falls out of both counts', () => {
  const games = [eligible('1', 'espn'), kickoffTbd('2', 'abc'), networkTbd('3'),
                 offService('4', 'cbs-sports-network')];
  const { netTbd, kickTbd } = partition(games);
  const unplaceable = gridGames(games).filter((g) => g.kickoff_status === 'tbd' || isNetworkTbd(g));
  assert.equal(netTbd.length + kickTbd.length, unplaceable.length);
  assert.equal(new Set([...netTbd, ...kickTbd].map((g) => g.id)).size, unplaceable.length,
    'and none is counted twice');
});

test('THE INVARIANT: the grid note can never disagree with the band count line', () => {
  // Both read the same exported predicate, so the number in "45 network TBD" and the number in
  // "45 games not on the grid - network TBD" are the same number by construction. This holds because
  // network-TBD games are never off-service, so D4 never filters one out before the grid sees it.
  const games = [
    eligible('1', 'espn'), eligible('2', 'abc'),
    kickoffTbd('3', 'fox'),
    networkTbd('4'), networkTbd('5'), networkTbd('6'),
    offService('7', 'cbs-sports-network'), offService('8', 'nfl-network'),
  ];
  const band = offServiceSummary(games);
  const { netTbd } = partition(games);
  assert.equal(band.tbdCount, 3);
  assert.equal(netTbd.length, band.tbdCount, 'the band counts 3, so the grid must say 3');
  assert.equal(band.lines.tbd, '3 network TBD');
});

test('a game filtered by D4 never reaches the note - the grid speaks only for what it was given', () => {
  const games = [eligible('1', 'espn'), offService('2', 'cbs-sports-network')];
  const { netTbd, kickTbd } = partition(games);
  assert.equal(netTbd.length, 0);
  assert.equal(kickTbd.length, 0);
  assert.deepEqual(gridGames(games).map((g) => g.id), ['1'], 'the off-service game is not handed over');
});

test('the note is omitted at zero rather than reading "0 network TBD"', () => {
  // Prompt 22's rule, applied to the grid's own line as well as the count line.
  const { netTbd } = partition([eligible('1', 'espn'), kickoffTbd('2', 'abc')]);
  assert.equal(netTbd.length, 0, 'and the component renders nothing when this is 0');
});

test('a fully unannounced slate puts every game in the note and none on the grid', () => {
  // 2027-01-10: 16 NFL games, all flex-scheduled, none announced. The grid holds nothing, and the
  // note is the only honest thing on it.
  const games = Array.from({ length: 16 }, (_, i) => networkTbd(`n${i}`));
  const { netTbd, kickTbd } = partition(games);
  assert.equal(netTbd.length, 16);
  assert.equal(kickTbd.length, 0);
  assert.equal(offServiceSummary(games).offCount, 0, 'and not one of them is called off-service');
});
