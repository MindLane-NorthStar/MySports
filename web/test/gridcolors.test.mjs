// Joe's per-team grid band and ink for the pro leagues - the table wins, and keeps winning.
//
// WHY THIS EXISTS. `bandFor()` implements a RULE, and prompt 65 measured that rule against Joe's own
// 124 judgements: it agrees with him on 38 of them. Three other candidate rules were tried and the
// best reached 83. So the pro leagues ship as a table, and the rule survives only for teams nobody
// has judged - which is every college team.
//
// The table is read from data/grid_colors_pro.json HERE, separately from the module graph, so these
// assertions compare the shipped function against the file on disk rather than against a copy of it
// that could drift. Two failures this is built to catch:
//
//   1. a floor or a "fix" that overrides the table. ELEVEN of Joe's choices measure under
//      BAND_MIN_RATIO and he chose every one of them with the ratio on screen beside it. A later
//      change that quietly rescues them would look like an improvement and would be an override of
//      a judgement, so the eleven are pinned BELOW the threshold on purpose.
//   2. the rule leaking back in for a ruled team, or the table leaking out to an unruled one.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { bandFor, gridColourFor, contrastRatio, BAND_MIN_RATIO } from '../lib/gridmodel.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DOC = JSON.parse(readFileSync(join(HERE, '..', '..', 'data', 'grid_colors_pro.json'), 'utf8'));
const TABLE = DOC.teams;
const IDS = Object.keys(TABLE);

const INK = '#f2f2f0';
const CHAR = '#101214';
const HEX = /^#[0-9a-f]{6}$/;

// --------------------------------------------------------------------------- the file itself
test('the table holds 124 pro teams and says so', () => {
  assert.equal(IDS.length, 124);
  assert.equal(IDS.length, DOC.counts.teams);
});

test('every band and ink is #rrggbb, and every id names its own sport', () => {
  for (const id of IDS) {
    const row = TABLE[id];
    assert.match(row.band, HEX, `${id} band`);
    assert.match(row.ink, HEX, `${id} ink`);
    assert.equal(id.split('-')[0], row.sport, `${id} sport`);
    assert.ok(['mlb', 'nba', 'nfl', 'nhl'].includes(row.sport), `${id} is not a pro league`);
  }
});

// --------------------------------------------------------------------------- a listed team
test('a listed team returns the FILE\'S EXACT pair, whatever colours it is handed', () => {
  for (const id of IDS) {
    const b = bandFor('#123456', '#abcdef', id);
    assert.equal(b.band, TABLE[id].band, `${id} band`);
    assert.equal(b.ink, TABLE[id].ink, `${id} ink`);
  }
});

test('the ratio is MEASURED, never read from the file', () => {
  // The file carries a `ratio` for documentation. If it ever goes stale the app must not care.
  for (const id of IDS) {
    const b = bandFor(null, null, id);
    assert.equal(b.ratio, contrastRatio(TABLE[id].ink, TABLE[id].band), id);
  }
});

test('inkIsNeutral is derived from the ink, not declared', () => {
  const braves = bandFor(null, null, 'mlb-144');      // white ink on crimson
  assert.equal(braves.ink, INK);
  assert.equal(braves.inkIsNeutral, true);

  const browns = bandFor(null, null, 'nfl-5');        // charcoal ink on orange
  assert.equal(browns.ink, CHAR);
  assert.equal(browns.inkIsNeutral, true);

  const astros = bandFor(null, null, 'mlb-117');      // team colour on team colour
  assert.equal(astros.inkIsNeutral, false);

  for (const id of IDS) {
    const b = bandFor(null, null, id);
    assert.equal(b.inkIsNeutral, b.ink === INK || b.ink === CHAR, id);
  }
});

// --------------------------------------------------------------------------- the eleven
test('THE ELEVEN UNDER 3:1 SHIP AS CHOSEN - no floor rescues them', () => {
  // Deliberate, and the reason this test names them one by one: a later "fix" that raised these
  // would be overriding a judgement Joe made with the measured ratio in front of him.
  const low = [
    ['nfl-27', 1.82], ['nfl-8', 2.56], ['nfl-24', 2.65], ['nfl-25', 2.82], ['nfl-1', 2.82],
    ['nba-MIN', 2.87], ['nhl-29', 2.87], ['nhl-13', 2.92], ['nhl-2', 2.92], ['mlb-114', 2.97],
    ['nhl-19', 2.98],
  ];
  for (const [id, expected] of low) {
    const b = bandFor(null, null, id);
    assert.equal(b.ratio.toFixed(2), expected.toFixed(2), id);
    assert.ok(b.ratio < BAND_MIN_RATIO, `${id} is meant to be under the threshold`);
    assert.equal(b.band, TABLE[id].band, id);
    assert.equal(b.ink, TABLE[id].ink, id);
  }
  // and they are the ONLY ones under it - a twelfth appearing means the file changed
  const under = IDS.filter((id) => bandFor(null, null, id).ratio < BAND_MIN_RATIO);
  assert.equal(under.length, 11, `under 3:1: ${under.join(', ')}`);
});

test('the Guardians show the table beating the rule on the same team', () => {
  // The rule reads navy/red as a failing pair, keeps the red band and neutralises the ink to white.
  // Joe kept the red band and put the NAVY back, at 2.97. Both are correct answers to different
  // questions, and gridbands.test.mjs still pins the first one.
  const byRule = bandFor('#002b5c', '#e31937');
  assert.equal(byRule.ink, INK);
  assert.equal(byRule.inkIsNeutral, true);

  const byJoe = bandFor('#002b5c', '#e31937', 'mlb-114');
  assert.equal(byJoe.band, '#e31937');
  assert.equal(byJoe.ink, '#002b5c');
  assert.equal(byJoe.inkIsNeutral, false);
  assert.ok(byJoe.ratio < BAND_MIN_RATIO);
});

// --------------------------------------------------------------------------- an unlisted team
test('an unlisted id returns EXACTLY what the rule alone returns', () => {
  const pairs = [
    ['#9e1b32', '#828a8f'], ['#000000', '#ffb612'], ['#472a08', '#ff3c00'],
    ['#ba0c2f', '#a7b1b7'], ['#29126f', null], [null, null],
  ];
  for (const [p, s] of pairs) {
    for (const id of ['cfb-333', 'zzz-nobody', '', 0, null, undefined]) {
      assert.deepEqual(bandFor(p, s, id), bandFor(p, s), `${p}/${s} @ ${JSON.stringify(id)}`);
    }
  }
});

test('no college id is in the table - nobody has judged one', () => {
  assert.equal(IDS.filter((id) => id.startsWith('cfb-')).length, 0);
  for (const id of ['cfb-333', 'cfb-194', '333', '2341']) {
    assert.equal(gridColourFor(id), null, id);
  }
});

test('gridColourFor answers null for anything unruled, and the pair for anything ruled', () => {
  assert.equal(gridColourFor(null), null);
  assert.equal(gridColourFor(undefined), null);
  assert.equal(gridColourFor('nope'), null);
  for (const id of IDS) {
    assert.deepEqual(gridColourFor(id), { band: TABLE[id].band, ink: TABLE[id].ink }, id);
  }
});

test('a numeric id still resolves - the table is keyed by string', () => {
  // capFor() takes String(teamId) for the same reason; a payload that hands a number must not miss.
  assert.deepEqual(gridColourFor('mlb-114'), gridColourFor(String('mlb-114')));
});
