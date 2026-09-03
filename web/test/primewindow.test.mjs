// D2: the prime-window policy and its derivation.
//
// The policy lives in data/render_policies.json and the derivation in web/lib/primewindow.js. These
// assert BOTH, because the interesting failures are at the seam: a sport whose policy is missing, a
// day whose earliest sport is not the one you expected, and an empty day that must not fall back to
// a default window.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { primeWindow, parseHHMM, formatHHMM, kickoffMinutes } from '../lib/primewindow.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const policies = JSON.parse(readFileSync(join(HERE, '..', '..', 'data', 'render_policies.json'), 'utf8'));

// Kickoffs are given in UTC; 16:00Z is noon ET in September (EDT, UTC-4).
const at = (sport, utc) => ({ sport, canonical_kickoff_at_utc: utc });
// The policy is injected, exactly as app code injects it via web/lib/policies.js.
const win = (games, opts = {}) => primeWindow(games, { policy: policies, ...opts });

test('the policy file carries prime_window_start for every sport', () => {
  for (const [sport, want] of Object.entries({ cfb: '12:00', nfl: '13:00', nhl: '18:00', nba: '18:00', mlb: '18:00' })) {
    assert.equal(policies[sport].prime_window_start, want, sport);
  }
});

test('adding the key did not disturb block_minutes', () => {
  assert.equal(policies.cfb.block_minutes, 210);
  assert.equal(policies.nhl.block_minutes, 150);
  assert.equal(policies.mlb.block_minutes, 180);
});

test('a CFB Saturday opens at 12:00', () => {
  const w = win([at('cfb', '2026-09-05T16:00:00Z'), at('cfb', '2026-09-05T23:30:00Z')]);
  assert.equal(w.opensAt, '12:00');
  assert.deepEqual(w.sports, ['cfb']);
});

test('an NFL Sunday opens at 13:00', () => {
  const w = win([at('nfl', '2026-09-13T17:00:00Z')]);
  assert.equal(w.opensAt, '13:00');
});

test('a weeknight of only pro sport opens at 18:00', () => {
  assert.equal(win([at('mlb', '2026-09-02T22:40:00Z')]).opensAt, '18:00');
  assert.equal(win([at('nhl', '2026-10-01T23:00:00Z')]).opensAt, '18:00');
  assert.equal(win([at('nba', '2026-10-28T23:00:00Z')]).opensAt, '18:00');
});

test('a mixed day takes the EARLIEST of the sports present', () => {
  // CFB noon beats NFL 13:00 beats MLB 18:00 - and the answer must not depend on row order.
  const rows = [at('mlb', '2026-09-05T22:40:00Z'), at('nfl', '2026-09-05T17:00:00Z'), at('cfb', '2026-09-05T16:00:00Z')];
  assert.equal(win(rows).opensAt, '12:00');
  assert.equal(win([...rows].reverse()).opensAt, '12:00');
  assert.deepEqual(win(rows).sports, ['cfb', 'mlb', 'nfl']);
});

test('a mixed day WITHOUT cfb falls to the next earliest, not to a default', () => {
  assert.equal(win([at('mlb', '2026-09-13T22:40:00Z'), at('nfl', '2026-09-13T17:00:00Z')]).opensAt, '13:00');
});

test('an empty day returns null, NOT a default window', () => {
  assert.equal(win([]), null);
  assert.equal(win(null), null);
  assert.equal(win(undefined), null);
});

test('a day of only unknown sports returns null rather than inventing a window', () => {
  assert.equal(win([{ sport: 'quidditch' }]), null);
});

test('closesAt is the last program END, kickoff plus that sport block_minutes', () => {
  // 19:00 ET kickoff + 150 minutes of hockey = 21:30 ET.
  const w = win([at('nhl', '2026-10-01T23:00:00Z')]);
  assert.equal(w.closesAt, '21:30');
});

test('closesAt takes the latest end, not the latest kickoff', () => {
  // CFB at 12:00 ET runs 210 minutes to 15:30; MLB at 13:00 ET runs 180 to 16:00. MLB ends later
  // despite CFB having the longer block, and an earlier-kickoff long game must not win by accident.
  const w = win([at('cfb', '2026-09-05T16:00:00Z'), at('mlb', '2026-09-05T17:00:00Z')]);
  assert.equal(w.closesAt, '16:00');
});

test('a TBD kickoff cannot extend the window', () => {
  const w = win([at('nhl', '2026-10-01T23:00:00Z'), { sport: 'nhl', canonical_kickoff_at_utc: null }]);
  assert.equal(w.closesAt, '21:30');
  assert.equal(w.opensAt, '18:00', 'and it still counts as the sport being present');
});

test('a day whose every kickoff is TBD still opens, but has no close', () => {
  const w = win([{ sport: 'cfb', canonical_kickoff_at_utc: null }]);
  assert.equal(w.opensAt, '12:00');
  assert.equal(w.closesAt, null);
});

test('parseHHMM and formatHHMM round-trip, and refuse junk', () => {
  assert.equal(parseHHMM('12:00'), 720);
  assert.equal(parseHHMM('00:00'), 0);
  assert.equal(parseHHMM('18:30'), 1110);
  assert.equal(formatHHMM(1110), '18:30');
  assert.equal(formatHHMM(720), '12:00');
  for (const junk of ['', null, undefined, '24:00', '12:60', 'noon', '12', '1200']) {
    assert.equal(parseHHMM(junk), null, String(junk));
  }
});

test('kickoffMinutes reads the instant in ET, not UTC', () => {
  // 16:00Z in September is 12:00 EDT.
  assert.equal(kickoffMinutes({ canonical_kickoff_at_utc: '2026-09-05T16:00:00Z' }), 720);
  assert.equal(kickoffMinutes({ startDate: '2026-09-05T16:00:00Z' }), 720, 'fixture rows use startDate');
  assert.equal(kickoffMinutes({}), null);
  assert.equal(kickoffMinutes({ canonical_kickoff_at_utc: 'not a date' }), null);
});

test('the policy is required: calling without one returns null, never a guess', () => {
  assert.equal(primeWindow([{ sport: 'cfb' }]), null);
  assert.equal(primeWindow([{ sport: 'cfb' }], {}), null);
});
