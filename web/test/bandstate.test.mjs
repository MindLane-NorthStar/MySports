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
    const r = bandState(games, new Date(c.now), POLICY);
    assert.equal(r.state, c.expect, `${c.name}: expected ${c.expect}, got ${r.state}`);
    assert.ok(BAND_STATES.includes(r.state));
    if (c.empty) {
      assert.equal(r.empty, true, 'a day with no games must say so');
      assert.equal(r.rows.length, 0);
    }
  });
}

// --------------------------------------------------------------------------- the header
// R9, prompt 56. It read `${dayLabel} · ${clock} ET`; the picker two rows above the band already
// shows that date, in those words, since prompt 50 retired the DATE heading this line replaced.
test('R9: the header states the CLOCK IT USED, and nothing else', () => {
  const r = bandState(SLATE.cfb('2026-09-05'), new Date('2026-09-06T01:14:00Z'), POLICY);
  assert.equal(r.heading, 'as of 9:14 PM');
  assert.doesNotMatch(r.heading, / ET$/,
    'prompt 31 took ET off every clock in the app; the footnote carries it once');
  assert.doesNotMatch(r.heading, /September|Friday|2026/, 'and the day is not repeated here');
});

test('R9: the clock is still stated when there are no games (E10)', () => {
  const r = bandState([], new Date('2027-01-10T20:00:00Z'), POLICY);
  assert.equal(r.empty, true);
  assert.equal(r.heading, 'as of 3:00 PM');
});

test('R9: R11 was CONSIDERED AND DECLINED - the subtext carries no fraction', () => {
  // Joe weighed "2 of 14 today" beside the clock on 2026-09-06 and said no. Recorded as a test so
  // it is not re-proposed as an improvement.
  const r = bandState(SLATE.cfb('2026-09-05'), new Date('2026-09-06T01:14:00Z'), POLICY);
  // THIS ASSERTION WAS BROKEN FROM THE DAY IT WAS WRITTEN, in two ways at once (found by prompt 58).
  // It was `/\bof\b/`, and the two `\b`s were written through a shell heredoc that turned them into
  // literal BACKSPACE bytes - so the pattern was /<BS>of<BS>/, which nothing can ever match and
  // which therefore passed vacuously.
  //
  // AND HAD IT BEEN ESCAPED CORRECTLY IT WOULD HAVE FAILED, which is the more useful half: the
  // heading is "as of 9:14 PM", so a word-boundary match on "of" hits the heading's OWN wording.
  // R11 was never about the word - it was about a FRACTION ("2 of 14 today"), and that is what the
  // one surviving line actually tests.
  assert.doesNotMatch(r.heading, /\d+\s*(of|\/)\s*\d+/, 'no "N of M" fraction beside the clock');
  assert.match(r.heading, /^as of /, 'and the heading is still the clock alone');
});

test('the three band titles share ONE voice (prompt 56, Joe 2026-09-06)', () => {
  // He asked for one and then ruled all three should match rather than leaving two connectors
  // doing one job. The STATES are unchanged - these are names, not behaviour.
  assert.equal(BAND_TITLE.tonight, 'Tonight');
  assert.equal(BAND_TITLE.live, 'Live & Upcoming');
  assert.equal(BAND_TITLE.finals, 'Finals & Tomorrow');
  assert.deepEqual(BAND_STATES, ['tonight', 'live', 'finals'], 'three states, as 05 §D1b specced');
  for (const s of BAND_STATES) {
    assert.doesNotMatch(BAND_TITLE[s], /·|\//, 'no connector but the one they now share');
  }
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
  const r = bandState(games, new Date('2026-09-05T20:00:00Z'), POLICY);  // 16:00 ET
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
  const r = bandState(games, new Date('2026-09-04T06:00:00Z'), POLICY, { tomorrow });
  assert.equal(r.state, 'finals');
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].result_status, 'final');
});

test('a live game holds the band open past the window\'s close', () => {
  const day = '2026-09-03';
  const games = [game('mlb', day, 19, 10, { result_status: 'in_progress' })];
  const r = bandState(games, new Date('2026-09-04T06:00:00Z'), POLICY);
  assert.equal(r.state, 'live', 'a game still being played is not a "final"');
});

test('TONIGHT drops games that started before the window opened', () => {
  const day = '2026-09-05';
  const games = [game('cfb', day, 9), game('cfb', day, 15, 30)];
  const r = bandState(games, new Date('2026-09-05T13:00:00Z'), POLICY); // 09:00 ET
  assert.equal(r.state, 'tonight');
  assert.deepEqual(r.rows.map((g) => g.id), ['cfb-1530']);
});

test('a TBD kickoff sorts last and is never dropped for having no time', () => {
  const day = '2026-09-05';
  const tbd = { id: 'cfb-tbd', sport: 'cfb', canonical_kickoff_at_utc: null };
  const r = bandState([game('cfb', day, 19, 30), tbd], new Date('2026-09-05T13:00:00Z'), POLICY);
  assert.deepEqual(r.rows.map((g) => g.id), ['cfb-1930', 'cfb-tbd']);
});

// --------------------------------------------------------------------------- shape
test('bandState is pure: same inputs, same answer, nothing mutated', () => {
  const games = SLATE.cfb('2026-09-05');
  const snapshot = JSON.stringify(games);
  const now = new Date('2026-09-05T17:30:00Z');
  const a = bandState(games, now, POLICY);
  const b = bandState(games, now, POLICY);
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

// --------------------------------------------------------------------------- the wrap (v1.7)
test('a slate that ends AT or AFTER 03:00 has not already finished', () => {
  // THE BUG A UFC CARD FOUND. primeWindow reports closesAt as a wall clock, and pastCutover only
  // lifts a value BEFORE 03:00 - so a 9 PM card with a 360-minute block closes at "03:00", came
  // back as 180, and 180 is smaller than the window's own 14:00 opening. The band read that as
  // "the day is over", jumped to FINALS, found no finals, and rendered "Nothing loaded for this
  // viewing day yet" over a card that had not started.
  //
  // A window cannot close before it opens. That is a wrap, and it is read as one.
  const policy = { ufc: { prime_window_start: '14:00', block_minutes: 360 } };
  const card = {
    id: 'program-1', sport: 'ufc', result_status: 'scheduled',
    canonical_kickoff_at_utc: '2026-09-20T01:00:00Z',        // 9:00 PM ET on the 19th
  };
  // asked at 6 PM ET on the day itself - inside the window, hours before the card
  const at6pm = new Date('2026-09-19T22:00:00Z');
  const band = bandState([card], at6pm, policy);
  assert.notEqual(band.state, 'finals', 'the evening has not finished');
  assert.equal(band.empty, false);
  assert.deepEqual(band.rows.map((r) => r.id), ['program-1']);
});

test('and the wrap does not stop an ordinary day from finishing', () => {
  // The guard above must not turn every day into an unfinished one. A slate that closes BEFORE
  // midnight has no wrap to read, so `closes` stands and FINALS still arrives on time.
  const policy = { cfb: { prime_window_start: '12:00', block_minutes: 210 } };
  const game = {
    id: 'g1', sport: 'cfb', result_status: 'final',
    canonical_kickoff_at_utc: '2026-09-19T17:00:00Z',        // 1:00 PM ET, closing at 4:30 PM
  };
  const band = bandState([game], new Date('2026-09-19T22:00:00Z'), policy);
  assert.equal(band.state, 'finals', 'a 4:30 PM close is past by 6 PM');
  assert.deepEqual(band.rows.map((r) => r.id), ['g1']);
});
