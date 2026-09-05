// D1: the first band's state, pinned by the fixtures at tests/fixtures/band_state_cases.json.
//
// The fixtures are SHARED on purpose. Contract v1.7's §11.9 Tonight line asks the same question of
// the same days, and the overlap rule already showed what happens when two renderers answer one
// question from two implementations - so the cases live outside web/ and either side can read them.
//
// Everything here passes `now` explicitly. bandState() never reads a clock, which is what makes it
// testable at 09:00 and at 23:59 on a day that has already happened.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { bandState, clockLabel, BAND_STATES, BAND_TITLE } from '../lib/bandstate.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = JSON.parse(
  readFileSync(join(HERE, '..', '..', 'tests', 'fixtures', 'band_state_cases.json'), 'utf8'),
);
const POLICY = JSON.parse(readFileSync(join(HERE, '..', '..', 'data', 'render_policies.json'), 'utf8'));

/** A game at a given ET wall time on a given day. */
function game(sport, day, etHour, etMin = 0, extra = {}) {
  // ET is UTC-4 in September; the fixtures never cross a DST boundary.
  const utcHour = etHour + 4;
  const dayNum = Number(day.slice(8, 10)) + Math.floor(utcHour / 24);
  const iso = `${day.slice(0, 8)}${String(dayNum).padStart(2, '0')}T${String(utcHour % 24).padStart(2, '0')}:${String(etMin).padStart(2, '0')}:00Z`;
  return { id: `${sport}-${etHour}${etMin}`, sport, canonical_kickoff_at_utc: iso, ...extra };
}

const SLATE = {
  cfb: (day) => [game('cfb', day, 12), game('cfb', day, 15, 30), game('cfb', day, 19, 30)],
  nfl: (day) => [game('nfl', day, 13), game('nfl', day, 16, 25), game('nfl', day, 20, 20)],
  mlb: (day) => [game('mlb', day, 19, 10)],
};

// --------------------------------------------------------------------------- the shared fixtures
for (const c of FIXTURES.cases) {
  test(`fixture: ${c.name}`, () => {
    const games = c.sports.flatMap((s) => SLATE[s](c.day));
    const r = bandState(games, new Date(c.now), POLICY, { dayLabel: 'Saturday, September 5' });
    assert.equal(r.state, c.expect, `${c.name}: expected ${c.expect}, got ${r.state}`);
    assert.ok(BAND_STATES.includes(r.state));
    if (c.empty) {
      assert.equal(r.empty, true, 'a day with no games must say so');
      assert.equal(r.rows.length, 0);
    }
  });
}

// --------------------------------------------------------------------------- the header
test('the header states the viewing day AND the clock it used', () => {
  const r = bandState(SLATE.cfb('2026-09-05'), new Date('2026-09-06T01:14:00Z'), POLICY,
                      { dayLabel: 'Friday, September 4' });
  assert.match(r.heading, /^Friday, September 4 · \d{1,2}:\d{2} (AM|PM) ET$/, r.heading);
});

test('the day is still named when there are no games (E10)', () => {
  const r = bandState([], new Date('2027-01-10T20:00:00Z'), POLICY, { dayLabel: 'Sunday, January 10' });
  assert.equal(r.empty, true);
  assert.match(r.heading, /^Sunday, January 10 · /);
});

test('clockLabel is ET, not the runner\'s zone', () => {
  // 01:14 UTC is 21:14 the previous evening in New York. If this ever reads 1:14 the band is
  // stating the wrong clock on every phone east of the Atlantic.
  assert.equal(clockLabel(new Date('2026-09-06T01:14:00Z')), '9:14 PM');
});

// --------------------------------------------------------------------------- the rows
test('ON NOW puts in-progress games first, then the next kickoffs', () => {
  const day = '2026-09-05';
  const games = [
    game('cfb', day, 12, 0, { result_status: 'final' }),
    game('cfb', day, 15, 30, { result_status: 'in_progress' }),
    game('cfb', day, 19, 30),
    game('cfb', day, 17, 0),
  ];
  const r = bandState(games, new Date('2026-09-05T20:00:00Z'), POLICY, { dayLabel: 'x' });  // 16:00 ET
  assert.equal(r.state, 'live');
  assert.equal(r.rows[0].result_status, 'in_progress', 'what is on comes first');
  const rest = r.rows.slice(1).map((g) => g.id);
  assert.deepEqual(rest, ['cfb-170', 'cfb-1930'], 'then the next kickoffs, in order');
  assert.ok(!r.rows.some((g) => g.result_status === 'final'), 'a finished game is not "next up"');
});

test('FINALS shows today\'s finals and then tomorrow\'s first games', () => {
  const day = '2026-09-03';
  const games = [game('mlb', day, 19, 10, { result_status: 'final' })];
  const tomorrow = [game('mlb', '2026-09-04', 13, 10)];
  // 02:00 ET the next morning - past the last block, nothing live
  const r = bandState(games, new Date('2026-09-04T06:00:00Z'), POLICY, { dayLabel: 'x', tomorrow });
  assert.equal(r.state, 'finals');
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].result_status, 'final');
});

test('a live game holds the band open past the window\'s close', () => {
  const day = '2026-09-03';
  const games = [game('mlb', day, 19, 10, { result_status: 'in_progress' })];
  const r = bandState(games, new Date('2026-09-04T06:00:00Z'), POLICY, { dayLabel: 'x' });
  assert.equal(r.state, 'live', 'a game still being played is not a "final"');
});

test('TONIGHT drops games that started before the window opened', () => {
  const day = '2026-09-05';
  const games = [game('cfb', day, 9), game('cfb', day, 15, 30)];
  const r = bandState(games, new Date('2026-09-05T13:00:00Z'), POLICY, { dayLabel: 'x' }); // 09:00 ET
  assert.equal(r.state, 'tonight');
  assert.deepEqual(r.rows.map((g) => g.id), ['cfb-1530']);
});

test('a TBD kickoff sorts last and is never dropped for having no time', () => {
  const day = '2026-09-05';
  const tbd = { id: 'cfb-tbd', sport: 'cfb', canonical_kickoff_at_utc: null };
  const r = bandState([game('cfb', day, 19, 30), tbd], new Date('2026-09-05T13:00:00Z'), POLICY,
                      { dayLabel: 'x' });
  assert.deepEqual(r.rows.map((g) => g.id), ['cfb-1930', 'cfb-tbd']);
});

// --------------------------------------------------------------------------- shape
test('bandState is pure: same inputs, same answer, nothing mutated', () => {
  const games = SLATE.cfb('2026-09-05');
  const snapshot = JSON.stringify(games);
  const now = new Date('2026-09-05T17:30:00Z');
  const a = bandState(games, now, POLICY, { dayLabel: 'x' });
  const b = bandState(games, now, POLICY, { dayLabel: 'x' });
  assert.deepEqual(a.state, b.state);
  assert.deepEqual(a.rows.map((g) => g.id), b.rows.map((g) => g.id));
  assert.equal(JSON.stringify(games), snapshot, 'the input was mutated');
});

test('every state has a title', () => {
  for (const s of BAND_STATES) assert.ok(BAND_TITLE[s], s);
});

test('the module reads no clock of its own', () => {
  const src = readFileSync(join(HERE, '..', 'lib', 'bandstate.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(src, /Date\.now\(\)/, '`now` is an argument, always');
  assert.doesNotMatch(src, /new Date\(\)/, 'a bare new Date() is a hidden clock');
});
