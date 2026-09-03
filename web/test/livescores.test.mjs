// Tests for the live-score overlay, on Node's built-in runner. No new dependencies.
//
//     npm run test:unit          (from web/)
//
// THE FIXTURES ARE THE POINT. These read ../../tests/fixtures/*.json — the identical bytes
// tests/test_scores.py reads — so the JavaScript overlay and the Python adapters are asserted
// against one payload and cannot silently disagree about what a provider said. That was named as an
// acceptance item in the D3 amendment (docs/feature-study/05-home-page-decisions.md §6): a second,
// narrow reader of the same payloads now exists, and the way it stays honest is a shared fixture.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  resultStatus, scoreInt, readEspnScoreboard, readNhlSchedule, readMlbSchedule,
  fetchSport, sportsWorthFetching, overlayForDay, applyOverlay, USER_AGENT,
} from '../lib/livescores.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '..', '..', 'tests', 'fixtures');
const load = (n) => JSON.parse(readFileSync(join(FIXTURES, n), 'utf8'));

// Node's test runner has no built-in stdout capture; console.warn is silenced per-test where a
// warning is expected, and the calls are recorded so the warning itself can be asserted.
function captureWarn(fn) {
  const original = console.warn;
  const lines = [];
  console.warn = (...a) => lines.push(a.join(' '));
  try {
    return { value: fn(), lines };
  } finally {
    console.warn = original;
  }
}

// ---------------------------------------------------------------- the ported mapping
test('a scheduled game yields null scores', () => {
  assert.equal(resultStatus('pre'), 'scheduled');
  assert.equal(scoreInt('0', 'scheduled'), null, "ESPN sends the string '0' before kickoff");
  assert.equal(scoreInt(0, 'scheduled'), null);
});

test('an in-progress game yields integer scores', () => {
  assert.equal(resultStatus('in'), 'in_progress');
  assert.equal(scoreInt('14', 'in_progress'), 14);
  assert.equal(scoreInt(3, 'in_progress'), 3);
});

test('a final game yields final and keeps its scores', () => {
  assert.equal(resultStatus('post'), 'final');
  assert.equal(scoreInt('27', 'final'), 27);
});

test('an unrecognized state yields null and warns, never final', () => {
  const { value, lines } = captureWarn(() => resultStatus('halftime-ish', { context: 'espn nfl' }));
  assert.equal(value, null, 'a wrong final is the failure this mapping exists to prevent');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /unrecognized provider status/);
});

test('a postponed detail string wins over its state', () => {
  assert.equal(resultStatus('pre', { detail: 'Postponed' }), 'postponed');
  assert.equal(resultStatus('post', { detail: 'Postponed' }), 'postponed',
    'detail outranks state even when the state says the game finished');
  assert.equal(resultStatus('pre', { detail: 'Canceled' }), 'cancelled');
  assert.equal(resultStatus('pre', { detail: 'Cancelled' }), 'cancelled');
});

test('null state maps to null without warning', () => {
  const { value, lines } = captureWarn(() => resultStatus(null));
  assert.equal(value, null);
  assert.equal(lines.length, 0);
});

test('the provider vocabulary matches the python table exactly', () => {
  const cases = [['FUT', 'scheduled'], ['PRE', 'scheduled'], ['LIVE', 'in_progress'],
    ['CRIT', 'in_progress'], ['FINAL', 'final'], ['OFF', 'final'],
    ['Preview', 'scheduled'], ['Live', 'in_progress'], ['Final', 'final']];
  for (const [state, want] of cases) assert.equal(resultStatus(state), want, state);
});

test('scoreInt refuses junk rather than coercing it', () => {
  assert.equal(scoreInt('abc', 'final'), null);
  assert.equal(scoreInt(null, 'final'), null);
  assert.equal(scoreInt('', 'final'), null);
});

// ---------------------------------------------------------------- readers over the shared fixtures
test('ESPN reader maps the recorded NFL scoreboard', () => {
  const rows = readEspnScoreboard(load('espn_nfl_scoreboard_raw.json'), 'nfl');
  assert.ok(rows.length > 0, 'the recorded scoreboard has events');
  for (const r of rows) {
    assert.match(r.gameId, /^nfl-\d+$/, 'NFL ids are namespaced nfl-{espnId}');
    assert.ok(['scheduled', 'in_progress', 'final', 'postponed', 'cancelled', null].includes(r.status));
    if (r.status === 'scheduled') {
      assert.equal(r.homeScore, null);
      assert.equal(r.awayScore, null);
    }
    if (r.status === 'final') assert.equal(typeof r.homeScore, 'number');
  }
});

test('cfb keeps ESPN bare integer ids, unlike every other league', () => {
  const rows = readEspnScoreboard(load('espn_nfl_scoreboard_raw.json'), 'cfb');
  for (const r of rows) assert.match(r.gameId, /^\d+$/, 'CFBD ids ARE ESPN ids');
});

test('NHL reader maps the recorded schedule', () => {
  const rows = readNhlSchedule(load('nhl_schedule_raw.json'));
  assert.ok(rows.length > 0);
  for (const r of rows) {
    assert.match(r.gameId, /^nhl-\d+$/);
    if (r.status === 'scheduled') assert.equal(r.homeScore, null);
  }
});

test('MLB reader maps the recorded schedule and finals carry integer scores', () => {
  const rows = readMlbSchedule(load('mlb_schedule_raw.json'));
  assert.ok(rows.length > 0);
  const finals = rows.filter((r) => r.status === 'final');
  assert.ok(finals.length > 0, 'the 2026-08-31 snapshot is a completed slate');
  for (const r of finals) {
    assert.equal(typeof r.homeScore, 'number');
    assert.equal(typeof r.awayScore, 'number');
  }
  for (const r of rows) assert.match(r.gameId, /^mlb-\d+$/);
});

test('NBA reader maps the recorded scoreboard', () => {
  const rows = readEspnScoreboard(load('nba_scoreboard_raw.json'), 'nba');
  assert.ok(rows.length > 0);
  for (const r of rows) assert.match(r.gameId, /^nba-\d+$/);
});

test('an in-progress fixture game exposes a clock and a period', () => {
  // Synthesised rather than mined: the recorded snapshots are whole-day captures, so whether any
  // given one contains a live game depends on when it was taken. The SHAPE is what matters here.
  const payload = {
    events: [{
      id: '401800000',
      status: { type: { state: 'in', name: 'STATUS_IN_PROGRESS' }, displayClock: '7:12', period: 2 },
      competitions: [{ competitors: [{ homeAway: 'home', score: '14' }, { homeAway: 'away', score: '10' }] }],
    }],
  };
  const [row] = readEspnScoreboard(payload, 'nfl');
  assert.equal(row.status, 'in_progress');
  assert.equal(row.homeScore, 14);
  assert.equal(row.awayScore, 10);
  assert.equal(row.clock, '7:12');
  assert.equal(row.period, 2);
});

// ---------------------------------------------------------------- fail open
test('a provider HTTP error yields no overlay and does not throw', async () => {
  const { value } = captureWarn(() => fetchSport('nfl', { fetchImpl: async () => ({ ok: false, status: 403 }) }));
  assert.deepEqual(await value, []);
});

test('a thrown network error yields no overlay and does not throw', async () => {
  const rows = await (captureWarn(() => fetchSport('nhl', {
    fetchImpl: async () => { throw new Error('ECONNRESET'); },
  })).value);
  assert.deepEqual(rows, []);
});

test('malformed JSON yields no overlay and does not throw', async () => {
  const rows = await (captureWarn(() => fetchSport('mlb', {
    fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError('Unexpected token'); } }),
  })).value);
  assert.deepEqual(rows, []);
});

test('a payload of the wrong shape yields no rows rather than garbage', async () => {
  const rows = await fetchSport('nfl', { fetchImpl: async () => ({ ok: true, json: async () => ({ nope: 1 }) }) });
  assert.deepEqual(rows, []);
});

test('overlayForDay survives a total failure and returns an empty overlay', async () => {
  const games = [{ id: 'nfl-1', sport: 'nfl', result_status: 'scheduled' }];
  const { value } = captureWarn(() => overlayForDay('2026-09-03', games, {
    today: '2026-09-03', fetchImpl: async () => { throw new Error('down'); },
  }));
  const out = await value;
  assert.equal(out.map.size, 0);
  assert.deepEqual(applyOverlay(games, out.map), games, 'the database rows pass through untouched');
});

// ---------------------------------------------------------------- only fetch when it can matter
test('a past day is never fetched', () => {
  const games = [{ id: 'nfl-1', sport: 'nfl', result_status: 'scheduled' }];
  assert.deepEqual(sportsWorthFetching('2026-09-01', games, '2026-09-03'), []);
});

test('a day with only finals is never fetched', () => {
  const games = [{ id: 'nfl-1', sport: 'nfl', result_status: 'final' }];
  assert.deepEqual(sportsWorthFetching('2026-09-03', games, '2026-09-03'), []);
});

test('only sports actually present on the day are fetched', () => {
  const games = [
    { id: 'nfl-1', sport: 'nfl', result_status: 'scheduled' },
    { id: 'mlb-2', sport: 'mlb', result_status: 'final' },
    { id: 'nhl-3', sport: 'nhl', result_status: 'scheduled' },
  ];
  const got = sportsWorthFetching('2026-09-03', games, '2026-09-03').sort();
  assert.deepEqual(got, ['nfl', 'nhl'], 'mlb is all finals, so it is skipped');
});

// ---------------------------------------------------------------- merge semantics
test('the overlay never overwrites database values it does not carry', () => {
  const games = [{ id: 'nfl-1', sport: 'nfl', result_status: 'scheduled', home_score: null, away_score: null, venue_id: 7 }];
  const map = new Map([['nfl-1', { gameId: 'nfl-1', status: 'in_progress', homeScore: 7, awayScore: 3, clock: '7:12', period: 2 }]]);
  const [row] = applyOverlay(games, map);
  assert.equal(row.result_status, 'in_progress');
  assert.equal(row.home_score, 7);
  assert.equal(row.live_clock, '7:12');
  assert.equal(row.live, true);
  assert.equal(row.venue_id, 7, 'untouched database fields survive');
});

test('a game with no overlay row is returned exactly as the database gave it', () => {
  const games = [{ id: 'mlb-9', sport: 'mlb', result_status: 'final', home_score: 3 }];
  const [row] = applyOverlay(games, new Map([['nfl-1', { gameId: 'nfl-1', status: 'in_progress' }]]));
  assert.deepEqual(row, games[0]);
});

test('an overlay row with a null status is ignored', () => {
  const games = [{ id: 'nfl-1', sport: 'nfl', result_status: 'scheduled' }];
  const map = new Map([['nfl-1', { gameId: 'nfl-1', status: null }]]);
  assert.deepEqual(applyOverlay(games, map), games);
});

test('the honest UA is sent, never a browser UA', async () => {
  let seen = null;
  await fetchSport('nfl', {
    fetchImpl: async (_u, opts) => { seen = opts.headers['User-Agent']; return { ok: true, json: async () => ({ events: [] }) }; },
  });
  assert.equal(seen, USER_AGENT);
  assert.doesNotMatch(seen, /Mozilla|Chrome|Safari/, 'a half-disguise scores worse with Akamai than an honest bot');
});

test('the fetch is cached for 60 seconds so reloads share one upstream call', async () => {
  let seen = null;
  await fetchSport('mlb', {
    fetchImpl: async (_u, opts) => { seen = opts.next; return { ok: true, json: async () => ({ dates: [] }) }; },
  });
  assert.deepEqual(seen, { revalidate: 60 });
});
