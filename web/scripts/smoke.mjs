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
//   e) the embeds the pages rely on (teams via both FKs, broadcasts via networks_services) come back;
//   f) v0.2 - standings exist for all four pro leagues (or are honestly absent before a season starts),
//      a probable pitcher renders for tomorrow's slate, display names behave, and "Sox" is not a team.
//
// Exits non-zero on the first failure. Reads nothing secret: the anon key is publishable.

import { rest, restAll, inList, RestError } from '../lib/rest.js';
import proColours from '../../data/grid_colors_pro.json' with { type: 'json' };
import { SUPABASE_URL, ASSET_BASE_URL, gridAssetUrl } from '../lib/config.js';
import { indexStandings, standingLine } from '../lib/standings.js';
import { isPlaceholderTeam, placeholderReason } from '../lib/placeholders.js';
import { staleEligibility, FRESHNESS_DAYS, FRESHNESS_HOURS } from '../lib/freshness.js';
import { todayET } from '../lib/format.js';
import { addDays } from '../lib/weeks.js';

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
    // generated_grids stores BARE KEYS; the consumer joins ASSET_BASE_URL. Fetching the stored value
    // raw is what made this check fail - `fetch('grids/mlb/...')` cannot even parse as a URL.
    const res = await fetch(gridAssetUrl(newest.svg_asset_url), {
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


// ---------------------------------------------------------------- (f) v0.2 data the locked card needs
console.log('\n(f) standings, probables, display names, MLB short names');
{
  // -- standings for all four pro leagues. A league whose season has not started has NO rows for that
  //    season, and that is a PASS: the card omits the record line rather than showing last spring's.
  const rows = await rest(
    'team_records?select=team_id,season,as_of,wins,losses,ties,ot_losses,points,division_rank,games_back,source' +
      '&as_of=gte.2026-09-01&order=as_of.desc'
  );
  assert(rows.length > 0, 'team_records has recent rows', `got ${rows.length}`);
  const byLeague = {};
  for (const r of rows) {
    const lg = String(r.team_id).split('-')[0];
    (byLeague[lg] ||= []).push(r);
  }
  for (const lg of ['mlb', 'nhl', 'nba', 'nfl']) {
    const n = (byLeague[lg] || []).length;
    const seasons = [...new Set((byLeague[lg] || []).map((r) => r.season))].sort();
    assert(n > 0, `${lg}: standings rows present`, `${n} rows, season(s) ${seasons.join('/') || 'none'}`);
  }
  // NBA's division_rank carries the CONFERENCE seed (Joe's ruling) - it must be a plausible 1..15.
  const nbaRanks = (byLeague.nba || []).map((r) => r.division_rank).filter((v) => v != null);
  assert(
    nbaRanks.length === 0 || nbaRanks.every((v) => v >= 1 && v <= 15),
    'nba division_rank holds a conference seed (1..15)',
    `${nbaRanks.length} ranked, max ${Math.max(0, ...nbaRanks)}`
  );
  const idx = indexStandings(rows);
  const cle = idx.get('mlb-114|2026');
  assert(Boolean(cle), 'the Guardians have a current row');
  if (cle) console.log(`        CLE line: ${standingLine(cle, 'mlb', 'American League Central')}`);

  // -- a probable pitcher renders for an upcoming slate
  const pitched = await rest(
    'games?select=id,viewing_day,probable_home_pitcher,probable_away_pitcher&sport=eq.mlb' +
      '&viewing_day=gte.2026-09-03&or=(probable_home_pitcher.not.is.null,probable_away_pitcher.not.is.null)&limit=5'
  );
  assert(pitched.length > 0, 'an upcoming MLB game names a probable starter', `${pitched.length} games`);
  const shape = /^[A-Z]\. \S/;
  const sample = pitched.flatMap((g) => [g.probable_away_pitcher, g.probable_home_pitcher]).filter(Boolean);
  assert(sample.every((s) => shape.test(s)), 'every probable reads "F. Lastname..."', sample[0] || '');
  console.log(`        e.g. ${pitched[0].viewing_day}  ${sample[0]}`);

  // -- display names: written only where they DIFFER from short_name; null means fall back
  const liu = await rest('teams?select=id,short_name,display_name&id=eq.2341');
  const gast = await rest('teams?select=id,short_name,display_name&id=eq.2247');
  const bama = await rest('teams?select=id,short_name,display_name&id=eq.333');
  assert(
    liu[0]?.display_name && liu[0].display_name !== liu[0].short_name,
    'LIU carries a shorter display name',
    `${liu[0]?.short_name} -> ${liu[0]?.display_name}`
  );
  assert(
    gast[0]?.display_name !== gast[0]?.short_name,
    'Georgia State has a display name distinct from short_name',
    `${gast[0]?.short_name} -> ${gast[0]?.display_name}`
  );
  assert(
    bama[0]?.display_name === null,
    'a name that is already short stays null (falls back to short_name)',
    `Alabama -> ${bama[0]?.display_name}`
  );

  const pro = await rest('teams?select=id&sport=neq.cfb&display_name=not.is.null&limit=1');
  assert(pro.length === 0, 'pro teams have no display_name', `${pro.length} found`);

  // -- "Sox" is not a team
  const sox = await rest('teams?select=id,short_name&id=in.("mlb-111","mlb-145","mlb-141")&order=id.asc');
  const byId = Object.fromEntries(sox.map((t) => [t.id, t.short_name]));
  assert(byId['mlb-111'] === 'Red Sox', 'mlb-111 is the Red Sox', String(byId['mlb-111']));
  assert(byId['mlb-145'] === 'White Sox', 'mlb-145 is the White Sox', String(byId['mlb-145']));
  assert(byId['mlb-111'] !== byId['mlb-145'], 'Red Sox and White Sox are different names');
  assert(byId['mlb-141'] === 'Blue Jays', 'mlb-141 is the Blue Jays', String(byId['mlb-141']));

  // -- Joe's pro grid colours name teams that actually exist (prompt 65)
  //
  // THE FAILURE THIS CATCHES is a team id changing under the table. The rulings are keyed by id, and
  // an id that stops resolving does not throw and does not render wrong - it silently falls back to
  // the rule, and that team quietly stops being the colour Joe chose. Only live data can see it, so
  // it is a smoke check rather than a unit test. restAll, not rest: 809 teams is past the 1,000-row
  // cap today but the margin is one season of expansion, and rule 19 does not have exceptions.
  const allTeams = await restAll('teams?select=id,sport,canonical_name&order=id.asc');
  const known = new Map(allTeams.map((t) => [String(t.id), t.sport]));
  const ruledIds = Object.keys(proColours.teams);
  const unresolved = ruledIds.filter((id) => !known.has(id));
  assert(unresolved.length === 0, 'every ruled grid colour names a real team',
         unresolved.length ? unresolved.join(', ') : `${ruledIds.length} ids resolve`);
  const wrongSport = ruledIds.filter((id) => known.get(id) !== proColours.teams[id].sport);
  assert(wrongSport.length === 0, 'every ruled team is in the sport the table says',
         wrongSport.length ? wrongSport.join(', ') : `${ruledIds.length} agree`);
  // WHAT A PLACEHOLDER IS lives in lib/placeholders.js (prompt 114 rev B, Joe's ruling 2026-09-23):
  // a `-TBD` id, or an MLB row named for a postseason seed or wild card slot in one of the two forms
  // MLB has published. The 2026-09-23 refresh loaded seven of the latter and this check went red,
  // which is what it is for - and a form nobody has ruled on yet is MEANT to turn it red again. The
  // detail names every row this exempted and why, so a green run still shows the reader the seven.
  const proUnruled = allTeams.filter((t) => t.sport !== 'cfb' && !proColours.teams[String(t.id)]);
  const exempt = proUnruled.filter(isPlaceholderTeam).map((t) => `${t.id} "${t.canonical_name}" (${placeholderReason(t)})`);
  const notPlaceholder = proUnruled.filter((t) => !isPlaceholderTeam(t)).map((t) => `${t.id} "${t.canonical_name}"`);
  assert(proUnruled.every(isPlaceholderTeam),
         'the only unruled pro rows are TBD placeholders',
         `${exempt.length} placeholder${exempt.length === 1 ? '' : 's'} exempted: ${exempt.join('; ') || 'none'}`
         + (notPlaceholder.length ? ` | NOT placeholders: ${notPlaceholder.join('; ')}` : ''));
}

// ---------------------------------------------------------------- (g) eligibility freshness
// Prompt 125, queue item 16 (register §66, §69). From 2026-09-05 until prompt 123 a change in who can
// watch a game reached game_broadcasts and never reached viewer_game_eligibility, and nothing went red.
// The RULE is lib/freshness.js's, unit-tested on fixture rows in test/freshness.test.mjs; this applies
// it to the next 7 ET viewing days of live rows. It is red when the reconciler has stopped re-judging
// games whose broadcasts moved - a day of failed reconciles, or register §66 coming back.
//
// BOUNDED, RULE 19: all three reads page with restAll. The games are a 7-day viewing_day range (146 on
// 2026-09-29); the other two are keyed by those games' ids, in chunks so no URL grows with the slate.
console.log(`\n(g) eligibility freshness - the next ${FRESHNESS_DAYS} viewing days`);
{
  const start = todayET();
  const end = addDays(start, FRESHNESS_DAYS - 1);
  const games = await restAll(
    `games?select=id,sport,viewing_day&viewing_day=gte.${start}&viewing_day=lte.${end}&order=id.asc`);
  const ids = games.map((g) => g.id);
  const broadcasts = [];
  const eligibility = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = inList(ids.slice(i, i + 100));
    broadcasts.push(...await restAll(`game_broadcasts?select=game_id,last_seen_at&game_id=in.${chunk}&order=id.asc`));
    eligibility.push(...await restAll(
      `viewer_game_eligibility?select=game_id,computed_at&viewer_profile_id=eq.1&game_id=in.${chunk}&order=game_id.asc`));
  }
  const stale = staleEligibility(games, broadcasts, eligibility);
  const inScope = new Set(broadcasts.map((b) => b.game_id)).size;
  assert(stale.length === 0,
         `no game in the next ${FRESHNESS_DAYS} viewing days has eligibility more than ${FRESHNESS_HOURS}h older than its broadcasts`,
         stale.length
           ? stale.slice(0, 8).map((g) => `${g.id} (${g.why}${g.lagHours === null ? '' : `, ${g.lagHours}h`})`).join('; ')
             + (stale.length > 8 ? ` and ${stale.length - 8} more` : '')
           : `${start}..${end}: ${games.length} games, ${inScope} with broadcasts, 0 stale`);
}

console.log(`\n${failures === 0 ? 'OK' : 'FAILED'} - ${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
