// MLB LIVE SCORES HAD NEVER WORKED, AND THE ID SCHEME WAS NOT WHY (prompt 78 block B).
//
// `/api/live` reported `mlb: { returned: 15, joined: 0 }`: the fetch succeeded, the parse succeeded,
// fifteen rows came back, `stats` was populated, nothing warned — and not one id matched, so every
// card silently kept the database's score. It was in that state from the day live scores shipped
// until 2026-09-09, and what surfaced it was Joe asking why a score had not moved.
//
// WHAT IT WAS NOT. Cowork's prompt-76 stage 3 argued that because `livescores.js` matches
// `mlb-${g.gamePk}` against `games.id`, `games.id` must already be `mlb-<gamePk>`. The premise is
// TRUE — `adapters/mlb.py:350` emits exactly `f"mlb-{pk}"` — and the conclusion drawn from it, that
// MLB live scores therefore work, was false. Printed side by side on 2026-09-09:
//
//     returned  mlb-824792  mlb-824228  mlb-823414   <- MLB's answer
//     ours      mlb-824226  mlb-823172  mlb-823818   <- the 2026-09-09 slate
//
// Same shape, different GAMES. `?sportId=1` with no date answers for MLB's own idea of today, which
// was 2026-09-08 — the endpoint holds the previous date well past midnight ET, which is sensible for
// a league whose west-coast games finish after it. Adding `&date=` returned ids that matched ours
// exactly, and the join went 0/15 to 15/15.
//
// FIXED IN THE MATCHER, NOT THE DATA (rule 6). `games.id` is a primary key that other tables and the
// app's own overlay key point at; nothing stored was touched, and no DML was run.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { fetchSport, overlayForDay, joinFailures } from '../lib/livescores.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');

/** Capture the URL a source is asked for, without going near a network. */
async function urlFor(sport, day) {
  let seen = null;
  await fetchSport(sport, {
    day,
    fetchImpl: async (u) => { seen = u; return { ok: true, json: async () => ({}) }; },
  });
  return seen;
}

// ------------------------------------------------------------------- the day reaches every source
test('EVERY source is asked for the day, not for its own idea of today', () => {
  // Rule 32: the same bug was in all five, invisible in four because nothing joined anyway.
  // Measured for 2026-09-09, undated -> dated: NFL 16 -> 1 (our one game), CFB 24 -> 0, NBA 1 -> 0,
  // NHL a gameWeek starting 2026-09-29 -> the week containing the day asked for, MLB 15 -> the right
  // 15. Every `returned` is now a game that could actually join.
  const ls = src('lib/livescores.js');
  assert.match(ls, /const espnDates = \(day\) => \(day \? `\?dates=\$\{String\(day\)\.replace\(\/-\/g, ''\)\}` : ''\);/);
  assert.match(ls, /date=\$\{d\}/, 'MLB takes the day as a query parameter');
  assert.match(ls, /https:\/\/api-web\.nhle\.com\/v1\/schedule\/\$\{d\}/, 'the NHL takes it in the path');
  assert.match(ls, /fetchSport\(s, \{ day, fetchImpl \}\)/, 'and overlayForDay passes it down');
});

test('MLB asks for the day, which is the whole fix', async () => {
  assert.equal(await urlFor('mlb', '2026-09-09'),
    'https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-09-09');
});

test('the ESPN sports take YYYYMMDD, not the ISO day', async () => {
  // A source asked in the wrong format answers for its default, which is the defect wearing a
  // different hat — so the transformation is asserted rather than the presence of a parameter.
  for (const sport of ['nfl', 'cfb', 'nba']) {
    assert.match(await urlFor(sport, '2026-09-09'), /\?dates=20260909$/, sport);
  }
});

test('the NHL takes the day in the path', async () => {
  assert.equal(await urlFor('nhl', '2026-09-09'), 'https://api-web.nhle.com/v1/schedule/2026-09-09');
});

test('with NO day every source keeps its undated form', async () => {
  // Kept rather than deleted: it is what every existing caller in livescores.test.mjs uses, and
  // "no day given" has an honest answer at each provider.
  assert.equal(await urlFor('mlb', null), 'https://statsapi.mlb.com/api/v1/schedule?sportId=1');
  assert.equal(await urlFor('nhl', null), 'https://api-web.nhle.com/v1/schedule/now');
  assert.doesNotMatch(await urlFor('nfl', null), /\?dates=/);
});

// ------------------------------------------------------- the condition that was true and invisible
test('joinFailures: returning rows and joining NONE is the fault', () => {
  // THE SHAPE THAT HID FOR THE LIFE OF THE FEATURE. Everything about it looked healthy.
  assert.deepEqual(joinFailures({ mlb: { returned: 15, joined: 0, unjoined: 15 } }), ['mlb']);
  assert.deepEqual(joinFailures({ mlb: { returned: 15, joined: 15, unjoined: 0 } }), []);
});

test('joinFailures: zero returned is NOT a fault, and a partial join is not either', () => {
  // A day with no games in that sport, or a provider outage `fetchSport` already logged. And ESPN's
  // dated scoreboard can legitimately carry a game our slate does not.
  assert.deepEqual(joinFailures({ nhl: { returned: 0, joined: 0, unjoined: 0 } }), []);
  assert.deepEqual(joinFailures({ nfl: { returned: 16, joined: 1, unjoined: 15 } }), []);
  assert.deepEqual(joinFailures({}), []);
  assert.deepEqual(joinFailures(null), []);
});

test('joinFailures names EVERY broken sport, not the first', () => {
  const broken = joinFailures({
    mlb: { returned: 15, joined: 0 }, nfl: { returned: 16, joined: 1 }, nhl: { returned: 43, joined: 0 },
  });
  assert.deepEqual(broken.sort(), ['mlb', 'nhl']);
});

test('the rule has ONE definition, and the live probe uses it rather than a copy', () => {
  // Rule 32. A probe with its own idea of "broken" would drift from the tests that pin it.
  const probe = src('scripts/probes/live-join.mjs');
  assert.match(probe, /import \{ overlayForDay, joinFailures \} from '\.\.\/\.\.\/lib\/livescores\.js';/);
  assert.doesNotMatch(probe, /function joinFailures/, 'no second copy of the rule');
});

test('the join is measured end to end over a fake provider', async () => {
  // The real defect, reproduced: a provider that answers for the wrong day returns rows that cannot
  // join. Driven through the real `overlayForDay` so the stats are the ones the app computes.
  const games = [{ id: 'mlb-1', sport: 'mlb', result_status: 'scheduled' }];
  const wrongDay = async () => ({ ok: true, json: async () => ({
    dates: [{ games: [{ gamePk: 999, status: {}, teams: {} }] }] }) });
  const bad = await overlayForDay('2026-09-09', games, { today: '2026-09-09', fetchImpl: wrongDay });
  assert.deepEqual(joinFailures(bad.stats), ['mlb'], 'returned 1, joined 0 - the invisible state');

  const rightDay = async () => ({ ok: true, json: async () => ({
    dates: [{ games: [{ gamePk: 1, status: {}, teams: {} }] }] }) });
  const good = await overlayForDay('2026-09-09', games, { today: '2026-09-09', fetchImpl: rightDay });
  assert.deepEqual(joinFailures(good.stats), []);
  assert.equal(good.map.size, 1);
});

// ---------------------------------------------------------------- B2: the game link, every state
//
// REWRITTEN IN PLACE BY PROMPT 86, NOT REMOVED. These two pinned prompt 78's ruling - live and
// final, never scheduled, because `/boxscore/` for an unstarted game is a dead tap. Joe replaced it on
// 2026-09-10: the stored URL is now the game's own page, which is a preview before kickoff, so the
// state gate went and the never-overwrite stayed. Each test still guards the half of the old ruling
// that survives.
test('the loader writes the game link in EVERY state now, never only live and final', () => {
  const load = src('../pipeline/load.py');
  assert.match(load, /boxscore_url\s+= coalesce\(boxscore_url, %s\)\s*\n/);
  assert.doesNotMatch(load, /boxscore_url\s+= case when coalesce\(%s, result_status\) in/, 'the state gate is gone');
});

test('the state gate went and the NEVER-OVERWRITE did not', () => {
  // `coalesce` keeps a stored URL from being rewritten on every refresh. Widening it into a plain
  // assignment would make the write non-idempotent - and would silently do migration 0018's job for
  // new templates while hiding that it had.
  const load = src('../pipeline/load.py');
  assert.doesNotMatch(load, /boxscore_url\s+= %s/, 'never an unconditional assignment');
});

test('completed_at is deliberately NOT widened with it', () => {
  // It is the moment the game ENDED. Stamping now() on a live game would make it look finished to
  // everything that reads it.
  const load = src('../pipeline/load.py');
  assert.match(load, /completed_at\s+= case when coalesce\(%s, result_status\) = 'final'/);
});

test('the panel draws the link ONCE, beside the status, and the URL guard stayed', () => {
  // REWRITTEN IN PLACE TWICE. Prompt 86 moved the labels into lib/gamelink.js, where
  // gamelink.test.mjs RUNS them; prompt 87 block C moved the link out of BOTH link rows (inside the
  // watch links, and its own `.dlinks` under "Where to watch") into the status row, per Joe's
  // Option A. What this pins is the panel side: one render site, and the guard on the stored URL.
  const g = src('components/GameDetail.js');
  assert.match(g, /const boxScore = link \? \(/);
  assert.equal((g.match(/\{boxScore\}/g) || []).length, 1, 'one render site');
  assert.doesNotMatch(g, /\{boxScore \? <div className="dlinks">/, 'not on its own row any more');
  const lib = src('lib/gamelink.js');
  assert.match(lib, /!row\.boxscore_url\) return null;/, 'no stored URL, no link');
});

test('the URL mapping has ONE owner, in Python', () => {
  // Deriving it in JS was considered and rejected in the same ruling: it would put the same
  // per-sport mapping in two languages that must agree, and a rule kept in two places drifts.
  // Prompt 86 added ESPN's `/game/` shape to the forbidden list and gamelink.js to the files.
  const load = src('../pipeline/load.py');
  assert.match(load, /_BOXSCORE = \{/);
  for (const f of ['components/GameDetail.js', 'lib/config.js', 'lib/livescores.js', 'lib/gamelink.js']) {
    assert.doesNotMatch(src(f),
      /espn\.com\/[a-z-]*\/(boxscore|game)\/_\/gameId|mlb\.com\/gameday|nhl\.com\/gamecenter/,
      `${f} must not learn a second copy of the game URL shapes`);
  }
});
