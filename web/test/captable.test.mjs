// The per-team cap surface (Joe's candidate-D ruling, 2026-09-04): the table, the lookup, and the
// pin that keeps inkFor() and bandFor() from ever disagreeing about the text colour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { bandFor, inkFor, capFor, tint, CAP_TINT, BAND_MIN_RATIO, contrastRatio } from '../lib/gridmodel.js';
import { teamLogoUrl, teamLogoDarkUrl, teamLogoCapUrl, ASSET_BASE_URL } from '../lib/config.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (rel) => readFileSync(join(HERE, '..', rel), 'utf8');
const table = JSON.parse(readFileSync(join(HERE, '..', 'lib', 'cap-table.json'), 'utf8'));
// the study fixture carries every team's real colour pair, which is what makes the pin real data
const fixture = JSON.parse(
  readFileSync(join(HERE, '..', '..', 'artifacts', 'cap-study', 'cap_table_candidate_C.json'), 'utf8')
);

test('inkFor reproduces bandFor().ink exactly on the band surface - the study teams', () => {
  // THE PIN. The name row takes the CAP's surface, so its ink is re-derived by inkFor(). On a team
  // whose surface IS the band, that must land on the same colour bandFor() already chose, or the
  // 198 flat-cap blocks quietly change their text colour.
  let checked = 0;
  for (const row of fixture.teams) {
    const b = bandFor(row.band, null);
    assert.equal(inkFor(b.band, row.band, null).ink.toLowerCase(), b.ink.toLowerCase(), row.id);
    checked++;
  }
  assert.ok(checked >= 300, `expected the study's teams, got ${checked}`);
});

test('inkFor reproduces bandFor().ink over 2,000 random colour pairs', () => {
  let seed = 40;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const hex = () => '#' + Math.floor(rnd() * 0x1000000).toString(16).padStart(6, '0');
  for (let i = 0; i < 2000; i++) {
    const p = hex();
    const s = rnd() < 0.15 ? null : hex();
    const b = bandFor(p, s);
    assert.equal(inkFor(b.band, p, s).ink.toLowerCase(), b.ink.toLowerCase(),
                 `primary=${p} secondary=${s}`);
  }
});

test('inkFor never returns the surface as its own ink', () => {
  for (const s of ['#ffffff', '#101214', '#1b3a6b', '#c8102e', '#ffb81c']) {
    const got = inkFor(s, s, s);
    assert.notEqual(got.ink.toLowerCase(), s.toLowerCase());
    assert.equal(got.neutral, true, 'with no usable team colour it must fall to a neutral');
  }
});

test('inkFor only takes a team colour when it clears the band threshold', () => {
  // #202020 on #101214 is a team colour that does NOT clear 3:1 - it must be refused for a neutral.
  const got = inkFor('#101214', '#202020', null);
  assert.equal(got.neutral, true);
  assert.ok(contrastRatio('#202020', '#101214') < BAND_MIN_RATIO);
});

test('capFor returns the table row for a known id, keeping the database case', () => {
  const id = Object.keys(table.teams).find((k) => k !== k.toLowerCase());
  assert.ok(id, 'expected a mixed-case id such as nba-CLE in the table');
  assert.deepEqual(capFor(id), { tint: table.teams[id].tint, art: table.teams[id].art });
});

test('capFor falls back to TODAY behaviour for an unknown id, and never throws', () => {
  // A team that arrives before the table is regenerated must render exactly as it does now.
  for (const bad of ['no-such-team', '', null, undefined, 0, 'NBA-cle']) {
    assert.deepEqual(capFor(bad), { tint: 0.72, art: 'raw' }, String(bad));
  }
});

test('every row in the shipped table is one of the two levels and one of the two files', () => {
  const ids = Object.keys(table.teams);
  assert.ok(ids.length >= 307, `expected at least the study's 307 rows, got ${ids.length}`);
  for (const id of ids) {
    const r = table.teams[id];
    assert.ok(r.tint === 1 || r.tint === CAP_TINT, `${id} tint ${r.tint}`);
    // 'cap' joined the two in prompt 69 - a black silhouette for a bright band, grid endcap only.
    assert.ok(r.art === 'raw' || r.art === 'dark' || r.art === 'cap', `${id} art ${r.art}`);
    assert.ok(r.edge_crisp >= 0 && r.edge_crisp <= 1, `${id} edge_crisp ${r.edge_crisp}`);
  }
});

/**
 * ROWS DELIBERATELY EDITED AWAY FROM THE STUDY, each with the reason it was.
 *
 * The test below exists to catch hand-editing drift, so an override is declared HERE rather than
 * softened into the assertion: any row that differs and is not named fails, and a named row that
 * stops differing fails too. Reverting one means deleting its entry, which is the point.
 */
const OVERRIDES = {
  // Prompt 68 stage 4. The study chose `dark` measured against tint 0.72; prompt 66 gave every
  // ruled team tint 1, so that surface no longer exists. Re-measured on the band as it now paints
  // (#e01234, Joe's chosen 76ers band): raw scores edge_crisp 0.599 and the dark lockup 0.005 - not
  // a close call about which reads better, a lockup that has stopped rendering as a shape. A stale
  // input rather than a preference, so it is corrected. One row, reversible by deleting this entry.
  'nba-PHI': { art: 'raw' },

  // Prompt 69 stage 3. Joe ruled the Giants' SF mark black on their orange band. Measured with the
  // builder's own edge_crisp at render size: on #fd5a1e the raw file scores 0.000, the dark file
  // 0.000 and a black silhouette 1.000 - and on charcoal that silhouette scores 0.000, where the raw
  // and dark files both score 1.000. The two contexts want opposite art for this team, so it gets a
  // THIRD file rather than a different one of the two: `logos/{id}_cap.png`, read only by the grid
  // endcap through teamLogoCapUrl(). `art: 'cap'` is what selects it.
  'mlb-137': { art: 'cap' },
};

test('the shipped table matches the study field for field on tint and art', () => {
  let flatRaw = 0, flatDark = 0, tintRaw = 0, tintDark = 0;
  for (const row of fixture.teams) {
    const mine = table.teams[row.id];
    assert.ok(mine, `${row.id} missing from the shipped table`);
    const over = OVERRIDES[row.id] || {};
    assert.equal(mine.tint, 'tint' in over ? over.tint : row.tint, `${row.id} tint`);
    assert.equal(mine.art, 'art' in over ? over.art : row.art, `${row.id} art`);
    for (const [field, want] of Object.entries(over)) {
      assert.notEqual(row[field], want,
        `${row.id} ${field} is declared an override but matches the study - delete the entry`);
    }
    if (row.tint === 1 && row.art === 'raw') flatRaw++;
    else if (row.tint === 1) flatDark++;
    else if (row.art === 'raw') tintRaw++;
    else tintDark++;
  }
  assert.deepEqual({ flatRaw, flatDark, tintRaw, tintDark },
                   { flatRaw: 170, flatDark: 28, tintRaw: 84, tintDark: 25 });
});

test('the two cap surfaces are the band itself and its 0.72 tint, and they differ', () => {
  const band = '#c8102e';
  assert.equal(tint(band, 1), 'rgb(200, 16, 46)');
  assert.notEqual(tint(band, CAP_TINT), tint(band, 1));
});

test('a flat-cap team keeps the ink it has today; a tinted one is re-derived on the tint', () => {
  // Boston College: the study puts it at tint 1.0, so its surface is the band and nothing moves.
  const bc = fixture.teams.find((t) => t.id === '103');
  assert.equal(bc.tint, 1.0);
  const b = bandFor(bc.band, null);
  assert.equal(inkFor(b.band, bc.band, null).ink.toLowerCase(), b.ink.toLowerCase());
  // UMass: tint 0.72, so the surface is darker than the band and the ink is chosen against THAT.
  const umass = fixture.teams.find((t) => t.id === '113');
  assert.equal(umass.tint, 0.72);
  const surface = tint(umass.band, CAP_TINT);
  assert.notEqual(surface, umass.band);
  assert.ok(inkFor(surface, umass.band, null).ink);
});

// ---------------------------------------------------------------------------------------------
// THE TINTED-SURFACE DEFECT (shipped in bf5a297, fixed here).
//
// tint() returns a CSS string - `rgb(126, 133, 137)` - and rgbOf() parsed only #rrggbb. So on every
// TINTED surface contrastRatio() returned null for the team colours AND for both neutrals, and
// `null >= null` is true in JS, so inkFor() fell out of its last branch with white and a null ratio.
// All 109 tinted teams rendered white names whatever their colours; eleven at 1.68:1 on #bdbdbd.
//
// It survived a green suite because the pins above only ever walk BAND surfaces, which are hex, and
// the 191/116/0 counts were computed on the Python side. Nothing ran a tinted surface through the
// runtime that actually renders. These tests do.

test('inkFor parses a tinted surface and gives Ohio State charcoal, not white', () => {
  const got = inkFor(tint('#a7b1b7', CAP_TINT), '#ba0c2f', '#a7b1b7');
  assert.equal(got.ink, '#101214');
  assert.ok(Math.abs(got.ratio - 5.01) < 0.02, `ratio ${got.ratio}`);
});

test('Ball State keeps its scarlet on the tinted white surface', () => {
  const got = inkFor(tint('#ffffff', CAP_TINT), '#ba0c2f', '#ffffff');
  assert.equal(got.ink, '#ba0c2f');
  assert.equal(got.neutral, false);
  assert.ok(Math.abs(got.ratio - 3.51) < 0.02, `ratio ${got.ratio}`);
});

test('the Steelers keep black on the tinted gold surface', () => {
  const got = inkFor(tint('#ffb612', CAP_TINT), '#000000', '#ffb612');
  assert.equal(got.ink, '#000000');
  assert.equal(got.neutral, false);
});

test('rgb() and rgba() surfaces parse; junk throws rather than answering white', () => {
  assert.ok(inkFor('rgb(0, 0, 0)', '#ba0c2f', '#ffffff').ratio > 1);
  assert.ok(inkFor('rgba(18, 20, 22, 1)', '#ba0c2f', '#ffffff').ratio > 1);
  assert.ok(inkFor('rgb(126,133,137)', '#ba0c2f', '#a7b1b7').ratio > 1, 'spaces are optional');
  for (const bad of ['not a colour', '#abc', '', null, 'rgb(1,2)']) {
    assert.throws(() => inkFor(bad, '#ffffff', '#000000'), TypeError, String(bad));
  }
});

test('inkFor never returns a null ratio on any surface the app can produce', () => {
  for (const row of fixture.teams) {
    const b = bandFor(row.band, null);
    for (const s of [b.band, tint(b.band, CAP_TINT)]) {
      const got = inkFor(s, row.band, null);
      assert.equal(typeof got.ratio, 'number', `${row.id} on ${s}`);
      assert.ok(Number.isFinite(got.ratio) && got.ratio >= 1, `${row.id} on ${s}: ${got.ratio}`);
    }
  }
});

// ---- the JS/Python agreement test prompt 40 was missing -------------------------------------
const colours = JSON.parse(
  readFileSync(join(HERE, 'fixtures', 'team-colours.json'), 'utf8')
).teams;

/**
 * Walk one team the way Block() does for an UNRULED team: cap table -> surface -> ink.
 *
 * IT READS THE CAP TABLE DIRECTLY RATHER THAN capFor(), and the distinction matters. Since prompt 66
 * `capFor()` returns `tint: 1` for any team in `data/grid_colors_pro.json`, so that Joe's chosen band
 * paints as chosen instead of being darkened under him. That is a later ruling about the pro leagues,
 * and this study is about something else: the prompt-40 ink rule over a frozen 307-team fixture,
 * including the JS/Python agreement that bf5a297 broke. Routing it through capFor() would let the
 * pro override rewrite the study's counts, which would be measuring the override, not the rule.
 * `gridcolors.test.mjs` pins the override; this file pins what it overrides.
 */
function renderInk(id) {
  const c = colours[id];
  const row = table.teams[id];
  const cap = row ? { tint: row.tint, art: row.art } : { tint: CAP_TINT, art: 'raw' };
  const b = bandFor(c.primary, c.secondary);
  const surface = cap.tint === 1 ? b.band : tint(b.band, CAP_TINT);
  return { cap, band: b, surface, got: inkFor(surface, c.primary, c.secondary) };
}

test('the RUNTIME reproduces the rule over all 307 study teams', () => {
  let team = 0, neutral = 0, under = 0, min = Infinity;
  for (const row of fixture.teams) {
    assert.ok(colours[row.id], `${row.id} missing from team-colours.json`);
    const { got } = renderInk(row.id);
    if (got.neutral) neutral++; else team++;
    if (got.ratio < 3.0) under++;
    min = Math.min(min, got.ratio);
  }
  assert.deepEqual({ team, neutral, under }, { team: 191, neutral: 116, under: 0 });
  assert.ok(min >= 3.0, `minimum ratio ${min}`);
  assert.ok(Math.abs(min - 3.04) < 0.02, `minimum ratio ${min}`);
});

test('the 109 tinted teams split 56 team-colour / 20 charcoal / 33 white', () => {
  // The split the defect destroyed: before the fix this was 0 / 0 / 109.
  let t = 0, ch = 0, wh = 0;
  const charcoal = [];
  for (const row of fixture.teams) {
    const { cap, got } = renderInk(row.id);
    if (cap.tint === 1) continue;
    if (!got.neutral) t++;
    else if (got.ink.toLowerCase() === '#101214') { ch++; charcoal.push(row.id); }
    else wh++;
  }
  assert.deepEqual({ t, ch, wh }, { t: 56, ch: 20, wh: 33 });
  // by id, never by name - two teams can share a display name across sports
  assert.deepEqual(charcoal.sort(), [
    '119',   // Towson
    '160',   // New Hampshire
    '167',   // New Mexico
    '194',   // Ohio State
    '2000',  // Abilene Chrstn
    '2447',  // Nicholls
    '2449',  // N Dakota St
    '2450',  // Norfolk St
    '2678',  // VMI
    '282',   // Indiana St
    '52',    // Florida St
    '58',    // South Florida
    '66',    // Iowa State
    'mlb-108', // Angels
    'nba-DAL', // Mavericks
    'nfl-12',  // Chiefs
    'nfl-24',  // Chargers
    'nfl-8',   // Lions
    'nhl-17',  // Red Wings
    'nhl-7',   // Sabres
  ].sort());
});

test('exactly the 26 teams Joe accepted give up a team-colour ink', () => {
  const lost = [];
  for (const row of fixture.teams) {
    const { band, got } = renderInk(row.id);
    if (!band.inkIsNeutral && got.neutral) lost.push(row.id);
  }
  assert.equal(lost.length, 26);
  // By ID, never by name: two clubs can share a display name across sports, and a name-keyed pin
  // would quietly stop checking the one that moved.
  assert.deepEqual(lost.sort(), [
    '160',      // New Hampshire
    '194',      // Ohio State
    '2000',     // Abilene Chrstn
    '2132',     // Cincinnati
    '2447',     // Nicholls
    '2449',     // N Dakota St
    '2459',     // N Illinois
    '2466',     // N'Western St
    '259',      // Virginia Tech
    '2678',     // VMI
    '282',      // Indiana St
    '309',      // Louisiana
    '52',       // Florida St
    '58',       // South Florida
    '66',       // Iowa State
    'mlb-108',  // Angels
    'mlb-121',  // Mets
    'mlb-142',  // Twins
    'nba-CHA',  // Hornets
    'nba-CHI',  // Bulls
    'nba-CLE',  // Cavaliers
    'nba-DAL',  // Mavericks
    'nba-HOU',  // Rockets
    'nba-TOR',  // Raptors
    'nhl-17',   // Red Wings
    'nhl-7',    // Sabres
  ].sort());
});

// ---------------------------------------------------------------------------------------------
// THE THIRD ART CONTEXT (prompt 69 stage 3).
//
// The app had two: the RAW file for the grid endcap and the light tint plates, and `_dark.png` for a
// logo floating on charcoal. Joe ruled the Giants' SF mark black on their orange band, and black
// cannot live in either - measured with the builder's own edge_crisp at render size:
//
//     art                on the band #fd5a1e     on charcoal #101214
//     raw                              0.000                   1.000
//     dark                             0.000                   1.000
//     BLACK silhouette                 1.000                   0.000
//
// Putting the silhouette in `_dark.png` would score 1.000 where it is wanted and 0.000 in the four
// other places that file is rendered. So: `logos/{id}_cap.png`, read only by the grid endcap.

test('teamLogoCapUrl names the third file, and lowercases the id like its two siblings', () => {
  // `?v=` since prompt 71 - every asset URL carries the build's asset version. The PATH is what this
  // test is about, so it is compared without the query.
  const path = (u) => u.split('?')[0];
  assert.equal(path(teamLogoCapUrl('MLB-137')), `${ASSET_BASE_URL}logos/mlb-137_cap.png`);
  assert.equal(teamLogoCapUrl('mlb-137'), teamLogoCapUrl('MLB-137'));
  assert.equal(teamLogoCapUrl(null), null);
  assert.equal(teamLogoCapUrl(''), null);
});

test('the three URL builders are three DIFFERENT files', () => {
  const id = 'mlb-137';
  const three = new Set([teamLogoUrl(id), teamLogoDarkUrl(id), teamLogoCapUrl(id)]);
  assert.equal(three.size, 3);
});

test('the endcap selects cap art by the table, and FALLS THROUGH for everything else', () => {
  // capArt() lives in MobileGrid.js, which cannot be imported outside the bundler, so the selector
  // is asserted in source. The fall-through is the property that matters: a row that does not say
  // 'cap' must render exactly what it rendered before this existed.
  const g = src('components/MobileGrid.js');
  assert.match(g, /if \(art === 'cap'\) return teamLogoCapUrl\(teamId\);/);
  assert.match(g, /if \(art === 'dark'\) return teamLogoDarkUrl\(teamId\);/);
  assert.match(g, /return teamLogoUrl\(teamId\);/);
  // both endcaps go through it - rule 32, the same thing rendered in two places
  assert.match(g, /src=\{capArt\(awayCap\.art, away\.id\)\}/);
  assert.match(g, /src=\{capArt\(homeCap\.art, home\.id\)\}/);
});

test('exactly one team asks for cap art today - the mechanism is general, the roster is one', () => {
  const wants = Object.entries(table.teams).filter(([, r]) => r.art === 'cap').map(([id]) => id);
  assert.deepEqual(wants, ['mlb-137']);
});
