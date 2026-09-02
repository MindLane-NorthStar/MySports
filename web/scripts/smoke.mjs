#!/usr/bin/env node
// MySports web app smoke test - proves the app's data contract against the LIVE database.
//
//     node scripts/smoke.mjs        (or: npm run smoke)
//
// It asserts facts that are true of the loaded data, not just that the endpoint answers:
//   a) 12 MLB games on viewing_day 2026-08-31, every one final, with INTEGER scores;
//   b) 16 NFL week-1 games;
//   c) at least one generated_grids row, and its archived SVG actually resolves over the public
//      R2 base (a registry row pointing at a 404 is worse than no row at all);
//   d) the two intentionally-unreadable tables really are unreadable, so nothing quietly starts
//      depending on them;
//   e) the embeds the pages rely on (teams via both FKs, broadcasts via networks_services) come back.
//
// Exits non-zero on the first failure. Reads nothing secret: the anon key is publishable.

import { rest, RestError } from '../lib/rest.js';
import { SUPABASE_URL, ASSET_BASE_URL } from '../lib/config.js';

let failures = 0;
let checks = 0;

function ok(label, detail = '') {
  checks += 1;
  console.log(`  PASS  ${label}${detail ? `  (${detail})` : ''}`);
}

function fail(label, detail) {
  checks += 1;
  failures += 1;
  console.log(`  FAIL  ${label}  -> ${detail}`);
}

function assert(cond, label, detail) {
  if (cond) ok(label, typeof detail === 'string' ? detail : '');
  else fail(label, detail);
}

console.log(`MySports web smoke test`);
console.log(`  endpoint ${SUPABASE_URL}/rest/v1  (schema mysports, role anon)`);
console.log(`  assets   ${ASSET_BASE_URL}\n`);

// ---------------------------------------------------------------- (a) MLB 2026-08-31
console.log('(a) MLB viewing_day 2026-08-31');
{
  const games = await rest(
    'games?select=id,home_score,away_score,result_status,boxscore_url&sport=eq.mlb&viewing_day=eq.2026-08-31&order=id.asc'
  );
  assert(games.length === 12, '12 games on the viewing day', `got ${games.length}`);
  const notFinal = games.filter((g) => g.result_status !== 'final');
  assert(notFinal.length === 0, 'every game is final', `${notFinal.length} not final`);
  const badScore = games.filter(
    (g) => !Number.isInteger(g.home_score) || !Number.isInteger(g.away_score)
  );
  assert(badScore.length === 0, 'every score is an integer', `${badScore.length} non-integer`);
  const noLink = games.filter((g) => !g.boxscore_url);
  assert(noLink.length === 0, 'every final game has a box score link', `${noLink.length} missing`);
  const sample = games[0];
  console.log(
    `        e.g. ${sample.id}  ${sample.away_score}-${sample.home_score}  ${sample.boxscore_url}`
  );
}

// ---------------------------------------------------------------- (b) NFL week 1
console.log('\n(b) NFL season week 1');
{
  const games = await rest('games?select=id,week,season,viewing_day&sport=eq.nfl&week=eq.1&order=viewing_day.asc');
  assert(games.length === 16, '16 games carry the week-1 label', `got ${games.length}`);
  const days = [...new Set(games.map((g) => g.viewing_day))].sort();
  ok('derived span', `${days[0]} .. ${days[days.length - 1]} over ${days.length} days`);
}

// ---------------------------------------------------------------- (c) archived grids
console.log('\n(c) generated_grids archive');
{
  const rows = await rest(
    'generated_grids?select=sport,game_date,svg_asset_url,generator_version,generated_at&order=generated_at.desc&limit=5'
  );
  assert(rows.length >= 1, 'at least one archived grid row', `got ${rows.length}`);
  const newest = rows[0];
  console.log(
    `        newest ${newest.sport} ${newest.game_date}  ${newest.generator_version}  ${newest.svg_asset_url}`
  );
  try {
    const res = await fetch(newest.svg_asset_url, {
      headers: { 'User-Agent': 'Mozilla/5.0 mysports-smoke' },
    });
    assert(res.ok, 'the newest archived SVG resolves', `HTTP ${res.status}`);
  } catch (e) {
    fail('the newest archived SVG resolves', String(e));
  }
}

// ---------------------------------------------------------------- (d) the RLS boundary
console.log('\n(d) tables anon must NOT read');
for (const table of ['source_observations', 'refresh_runs']) {
  try {
    await rest(`${table}?select=*&limit=1`);
    fail(`${table} is unreadable by anon`, 'it returned rows');
  } catch (e) {
    assert(
      e instanceof RestError && (e.status === 401 || e.status === 403),
      `${table} is unreadable by anon`,
      `status ${e.status}`
    );
  }
}

// ---------------------------------------------------------------- (e) the embeds the pages need
console.log('\n(e) embeds the pages depend on');
{
  const rows = await rest(
    'games?select=id,home:teams!games_home_team_id_fkey(id,canonical_name,primary_color),' +
      'away:teams!games_away_team_id_fkey(id,canonical_name,primary_color),' +
      'broadcasts:game_broadcasts(service_id,is_primary,active,network:networks_services(id,canonical_name))' +
      '&sport=eq.mlb&viewing_day=eq.2026-08-31&limit=3'
  );
  assert(rows.length === 3, 'game rows come back with embeds', `got ${rows.length}`);
  assert(rows.every((r) => r.home?.canonical_name && r.away?.canonical_name), 'both team embeds resolve');
  const withNet = rows.filter((r) => (r.broadcasts || []).some((b) => b.network?.canonical_name));
  assert(withNet.length > 0, 'broadcast -> network embed resolves', `${withNet.length}/3 have a named network`);
}

console.log(`\n${failures === 0 ? 'OK' : 'FAILED'} - ${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
