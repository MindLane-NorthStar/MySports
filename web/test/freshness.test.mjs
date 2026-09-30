// THE ELIGIBILITY FRESHNESS RULE, PROVEN ON FIXTURE ROWS (prompt 125, register §69).
//
// The smoke check (scripts/smoke.mjs, section g) applies this rule to live data, where it is green
// today - and a guard only ever seen green has not been shown to catch anything. These rows are the
// four cases the rule has, so each branch is shown to decide what it should, with no database write.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { staleEligibility, FRESHNESS_HOURS, FRESHNESS_DAYS } from '../lib/freshness.js';
import { region } from './region.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');

const SEEN = '2026-10-01T08:15:00Z';                 // the newest broadcast sighting, one load
const hoursBefore = (h) => new Date(Date.parse(SEEN) - h * 3600 * 1000).toISOString();

// Four games, one per case. FRESH is deliberately a few hours BEHIND its broadcasts - a run whose
// reconcile failed after its load - so a rule that tolerated no lag at all would fail it.
const GAMES = [
  { id: 'fresh', sport: 'nfl' },
  { id: 'stale', sport: 'nfl' },
  { id: 'missing', sport: 'mlb' },
  { id: 'unbroadcast', sport: 'nhl' },
];
const BROADCASTS = [
  { game_id: 'fresh', last_seen_at: hoursBefore(1) },
  { game_id: 'fresh', last_seen_at: SEEN },            // the NEWEST row decides, not the first
  { game_id: 'stale', last_seen_at: SEEN },
  { game_id: 'missing', last_seen_at: SEEN },
];
const ELIGIBILITY = [
  { game_id: 'fresh', computed_at: hoursBefore(3) },    // 3h behind: inside the window
  { game_id: 'stale', computed_at: hoursBefore(27) },   // 27h behind: outside it
  { game_id: 'unbroadcast', computed_at: hoursBefore(400) },
];

const failing = (opts) => staleEligibility(GAMES, BROADCASTS, ELIGIBILITY, opts).map((g) => g.id).sort();

test('the rule is 26 hours over the next 7 viewing days', () => {
  assert.equal(FRESHNESS_HOURS, 26);
  assert.equal(FRESHNESS_DAYS, 7);
});

test('a fresh game passes, a stale one fails, and a game with broadcasts but no eligibility row fails', () => {
  assert.deepEqual(failing(), ['missing', 'stale']);
});

test('a game with no broadcast rows is out of scope, however old its verdict', () => {
  assert.ok(!failing().includes('unbroadcast'));
});

test('each failure says why, with the lag when there is a row to measure it from', () => {
  const byId = Object.fromEntries(staleEligibility(GAMES, BROADCASTS, ELIGIBILITY).map((g) => [g.id, g]));
  assert.equal(byId.stale.lagHours, 27);
  assert.match(byId.stale.why, /more than 26h older/);
  assert.equal(byId.missing.lagHours, null);
  assert.match(byId.missing.why, /no eligibility row/);
});

test('the boundary: exactly 26 hours behind passes, a minute more fails', () => {
  const at = (h) => [{ game_id: 'g', computed_at: hoursBefore(h) }];
  const g = [{ id: 'g' }];
  const b = [{ game_id: 'g', last_seen_at: SEEN }];
  assert.equal(staleEligibility(g, b, at(26)).length, 0);
  assert.equal(staleEligibility(g, b, at(26 + 1 / 60)).length, 1);
});

test('smoke section (g) applies this function over the next 7 viewing days, reading only with restAll', () => {
  const smoke = src('scripts/smoke.mjs');
  // Section (g) up to the run's summary line: region() throws if either anchor goes, so a renamed
  // section fails this test rather than quietly asserting over the wrong text.
  const g = region(smoke, '(g) eligibility freshness', "${failures === 0 ? 'OK'", 'smoke section (g)');
  assert.match(smoke, /import \{ staleEligibility, FRESHNESS_DAYS, FRESHNESS_HOURS \} from '\.\.\/lib\/freshness\.js'/);
  assert.match(g, /staleEligibility\(/);
  assert.match(g, /addDays\(start, FRESHNESS_DAYS - 1\)/);
  assert.match(g, /viewer_profile_id=eq\.1/);
  // RULE 19: every read in the section pages. A bare rest() here would cap at 1,000 rows silently.
  const calls = [...g.matchAll(/\b(rest|restAll)\(/g)].map((m) => m[1]);
  assert.ok(calls.length >= 3, `three reads, found ${calls.length}`);
  assert.deepEqual([...new Set(calls)], ['restAll']);
});
