// SMOKE (i), THE SUNDAY WINDOWS (prompt 132 block C, Joe approved 2026-11-16, threshold Thursday).
//
// The rule is lib/sundaywindows.js's; smoke applies it to the live coming Sunday. These pin it on the
// shape of the outage it exists to catch: 2026-11-08, read 2026-11-09 - the Browns' game decided by rule 3
// (local team) and the other ten Sunday-afternoon CBS/FOX rows all `unverified` for nine days.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { isoWeekday, comingSunday, inSundayWindow, regionalRows, sundayWindowsVerdict,
  SUNDAY_WINDOW_ET, THRESHOLD_ISO_WEEKDAY } from '../lib/sundaywindows.js';

const HERE = dirname(fileURLToPath(import.meta.url));

// 2026-11-08 as the database held it during the outage (ids are the real ESPN ids; 1:00 PM ET = 18:00Z
// and 4:25 PM ET = 21:25Z in November). nfl-401873039 is CLE @ NO, the Browns' game.
const EARLY = '2026-11-08T18:00:00Z';
const LATE = '2026-11-08T21:25:00Z';
const OUTAGE_GAMES = [
  ['nfl-401873039', EARLY, 'cbs'], ['nfl-401873040', EARLY, 'fox'], ['nfl-401873041', EARLY, 'cbs'],
  ['nfl-401873042', EARLY, 'cbs'], ['nfl-401873043', EARLY, 'fox'], ['nfl-401873044', EARLY, 'fox'],
  ['nfl-401873045', EARLY, 'cbs'], ['nfl-401873046', '2026-11-08T21:05:00Z', 'cbs'],
  ['nfl-401873047', LATE, 'fox'], ['nfl-401873048', LATE, 'fox'], ['nfl-401873049', LATE, 'fox'],
];
const BROWNS = ['nfl-401873039'];
const games = (spec = OUTAGE_GAMES) => spec.map(([id, k]) => ({ id, canonical_kickoff_at_utc: k }));
const rows = (spec = OUTAGE_GAMES, status = (id) => (BROWNS.includes(id) ? 'available' : 'unverified')) =>
  spec.map(([id, , svc]) => ({ game_id: id, service_id: svc, access_status: status(id), active: true }));

const THU = '2026-11-05';
const TUE = '2026-11-03';

test('the calendar: ISO weekdays, and the coming Sunday is today on a Sunday', () => {
  assert.equal(isoWeekday('2026-11-16'), 1, 'Monday');
  assert.equal(isoWeekday(THU), 4, 'Thursday');
  assert.equal(isoWeekday('2026-11-08'), 7, 'Sunday');
  assert.equal(comingSunday('2026-11-16'), '2026-11-22');
  assert.equal(comingSunday('2026-11-21'), '2026-11-22');
  assert.equal(comingSunday('2026-11-22'), '2026-11-22');
  assert.equal(comingSunday(THU), '2026-11-08');
  assert.equal(THRESHOLD_ISO_WEEKDAY, 4, "Joe's threshold: Thursday");
});

test('the window is rule 1\'s, read from adapters/espn.py rather than retyped', () => {
  const py = readFileSync(join(HERE, '..', '..', 'adapters', 'espn.py'), 'utf8');
  const m = py.match(/^SUNDAY_WINDOW = \((\d+), (\d+)\)$/m);
  assert.ok(m, 'espn.py still states SUNDAY_WINDOW');
  assert.deepEqual(SUNDAY_WINDOW_ET, [Number(m[1]), Number(m[2])]);
  assert.equal(inSundayWindow(EARLY), true);
  assert.equal(inSundayWindow('2026-11-08T14:30:00Z'), false, 'a London 9:30 AM kickoff is national');
  assert.equal(inSundayWindow('2026-11-09T01:20:00Z'), false, 'Sunday night is national');
  assert.equal(inSundayWindow('2026-11-12T01:15:00Z'), false, 'Thursday night is not Sunday');
});

test('RED on a Thursday when every regional game is unverified - the 2026-11-08 outage', () => {
  const v = sundayWindowsVerdict(THU, games(), rows(), BROWNS);
  assert.deepEqual(v, { sunday: '2026-11-08', past: true, regional: 10, unverified: 10, decided: 0, red: true });
});

test('GREEN on a Tuesday with the same data - the maps are not out yet', () => {
  const v = sundayWindowsVerdict(TUE, games(), rows(), BROWNS);
  assert.equal(v.past, false);
  assert.equal(v.red, false);
  assert.equal(sundayWindowsVerdict('2026-11-02', games(), rows(), BROWNS).red, false, 'Monday');
  assert.equal(sundayWindowsVerdict('2026-11-04', games(), rows(), BROWNS).red, false, 'Wednesday');
});

test('GREEN on a Thursday when even one regional game is decided', () => {
  const one = rows(OUTAGE_GAMES, (id) => (BROWNS.includes(id) ? 'available' : id === 'nfl-401873041' ? 'out_of_market' : 'unverified'));
  const v = sundayWindowsVerdict(THU, games(), one, BROWNS);
  assert.equal(v.decided, 1);
  assert.equal(v.red, false);
});

test('RED stays red through Friday, Saturday and the Sunday itself', () => {
  for (const day of ['2026-11-06', '2026-11-07', '2026-11-08']) {
    assert.equal(sundayWindowsVerdict(day, games(), rows(), BROWNS).red, true, day);
  }
});

test("the market's own game is left out - with it counted, the outage could never have fired", () => {
  // rule 3 decides the Browns' game with no windows source, so it read `available` all through the outage
  assert.equal(sundayWindowsVerdict(THU, games(), rows(), []).red, false, 'the premise: 1 of 11 decided');
  assert.equal(sundayWindowsVerdict(THU, games(), rows(), BROWNS).red, true);
});

test('national telecasts and other networks are not regional rows', () => {
  const extra = [...OUTAGE_GAMES, ['nfl-1', '2026-11-08T14:30:00Z', 'fox'], ['nfl-2', '2026-11-09T01:20:00Z', 'nbc'],
                 ['nfl-3', EARLY, 'nfl-network']];
  const r = rows(extra, (id) => (BROWNS.includes(id) ? 'available' : ['nfl-1', 'nfl-2', 'nfl-3'].includes(id) ? 'available' : 'unverified'));
  assert.equal(regionalRows(games(extra), r).length, 11, 'only the eleven Sunday-afternoon CBS/FOX rows');
  assert.equal(sundayWindowsVerdict(THU, games(extra), r, BROWNS).red, true, 'a decided national game does not mask the outage');
});

test('an inactive row is not read, and no rows at all is green', () => {
  const r = rows();
  r.push({ game_id: 'nfl-401873041', service_id: 'cbs', access_status: 'out_of_market', active: false });
  assert.equal(sundayWindowsVerdict(THU, games(), r, BROWNS).red, true, 'a retired decided row does not count');
  assert.equal(sundayWindowsVerdict(THU, [], [], []).red, false);
});

test('smoke.mjs applies this rule, with the local club from data/markets.json', () => {
  const smoke = readFileSync(join(HERE, '..', 'scripts', 'smoke.mjs'), 'utf8');
  assert.match(smoke, /import \{ comingSunday, sundayWindowsVerdict \} from '\.\.\/lib\/sundaywindows\.js'/);
  assert.match(smoke, /const local = new Set\(markets\.nfl\.localTeams\)/);
  assert.match(smoke, /assert\(!v\.red, /);
});
