// NAMED EXHIBITION OPPONENTS (Joe's ruling 2026-10-06, prompt 128, register §73).
//
// London Lions (`nba-LON`) played one exhibition, LON @ POR on 2026-10-12, and turned smoke's
// unruled-pro-rows check red. Joe ruled it exempt BY NAME, in data/grid_colors_pro.json
// `exhibitionOpponents`: no colour ruling, no class exemption, never a property. These pin the rule in
// lib/exhibition.js, the real file's one entry, and smoke's wiring. Smoke itself proves it on the live
// teams table, where it goes red if the named id is not a team in its sport or is also ruled.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { exhibitionEntry, isExhibitionOpponent, exhibitionFaults } from '../lib/exhibition.js';
import { isPlaceholderTeam } from '../lib/placeholders.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const DOC = JSON.parse(readFileSync(join(HERE, '..', '..', 'data', 'grid_colors_pro.json'), 'utf8'));

/** The teams row as the database holds it (Cowork's read-only SELECT, 2026-10-06), in smoke's select. */
const LONDON = { id: 'nba-LON', sport: 'nba', canonical_name: 'London Lions' };
/** Every ruled team, as smoke reads the teams table, plus London: the shape exhibitionFaults() is given. */
const TEAMS = [...Object.entries(DOC.teams).map(([id, t]) => ({ id, sport: t.sport, canonical_name: t.name ?? id })), LONDON];

// ------------------------------------------------------------------------------ the real file
test('the file names exactly one exhibition opponent, London Lions, with its game and the ruling', () => {
  const names = Object.keys(DOC.exhibitionOpponents).filter((k) => !k.startsWith('_'));
  assert.deepEqual(names, ['nba-LON']);
  const e = DOC.exhibitionOpponents['nba-LON'];
  assert.equal(e.name, 'London Lions');
  assert.equal(e.sport, 'nba');
  assert.deepEqual(e.game, { id: 'nba-401914130', matchup: 'LON @ POR', viewingDay: '2026-10-12' });
  assert.equal(e.date, '2026-10-06');
  assert.match(e.ruling, /^Joe 2026-10-06: .*by name/);
});

test('the ruling added no colour: teams and counts are as they were (124)', () => {
  assert.equal(Object.keys(DOC.teams).length, 124);
  assert.equal(DOC.counts.teams, 124);
  assert.equal(Object.hasOwn(DOC.teams, 'nba-LON'), false, 'no colour ruling');
});

test('against the teams it names, the real file has no fault', () => {
  assert.deepEqual(exhibitionFaults(DOC, TEAMS), []);
});

// ------------------------------------------------------------------------------- the rule
test('London Lions, as the database holds it, is a named exhibition opponent', () => {
  assert.equal(isExhibitionOpponent(LONDON, DOC), true);
  assert.equal(exhibitionEntry(LONDON, DOC), DOC.exhibitionOpponents['nba-LON']);
});

test('the id is matched exactly and cross-checked on the sport and the name (rule 18)', () => {
  assert.equal(isExhibitionOpponent({ ...LONDON, sport: 'nhl' }, DOC), false, 'another sport');
  assert.equal(isExhibitionOpponent({ ...LONDON, canonical_name: 'Portland Trail Blazers' }, DOC), false, 'another name');
  assert.equal(isExhibitionOpponent({ ...LONDON, id: 'nba-lon' }, DOC), false, 'case is part of the id');
  assert.equal(isExhibitionOpponent({ ...LONDON, id: 'nba-LONX' }, DOC), false, 'no prefix match');
  assert.equal(isExhibitionOpponent({ id: '_about', sport: 'nba', canonical_name: 'London Lions' }, DOC), false);
  assert.equal(isExhibitionOpponent(null, DOC), false);
  assert.equal(isExhibitionOpponent(LONDON, {}), false, 'no list, no exemption');
});

test('a property never decides: a club that merely LOOKS like London Lions is not exempt', () => {
  // conference null, external_ids {}, no colours, no logo - exactly how a real club whose id changed
  // arrives, which is what the check exists to catch
  const lookalike = { id: 'nba-XYZ', sport: 'nba', canonical_name: 'Somewhere Somethings', conference: null, external_ids: {} };
  assert.equal(isExhibitionOpponent(lookalike, DOC), false);
});

test('an exhibition opponent is NOT a placeholder, so it keeps its logo and gets no TBD badge', () => {
  assert.equal(isPlaceholderTeam(LONDON), false);
  assert.doesNotMatch(code('lib/placeholders.js'), /exhibition/i, 'the placeholder rule is untouched');
});

test('the faults: a named id that is no team, in another sport, under another name, or also ruled', () => {
  const doc = (id, entry = { name: 'London Lions', sport: 'nba' }) => ({ teams: DOC.teams, exhibitionOpponents: { [id]: entry } });
  assert.deepEqual(exhibitionFaults(doc('nba-ZZZ'), TEAMS), ['nba-ZZZ: no such team']);
  assert.deepEqual(exhibitionFaults(doc('nba-LON', { name: 'London Lions', sport: 'nhl' }), TEAMS),
    ['nba-LON: a nba team, the entry says nhl']);
  assert.deepEqual(exhibitionFaults(doc('nba-LON', { name: 'London Lion', sport: 'nba' }), TEAMS),
    ['nba-LON: named "London Lions", the entry says "London Lion"']);
  const ruledId = Object.keys(DOC.teams).find((id) => id.startsWith('nba-'));
  const ruled = DOC.teams[ruledId];
  const both = exhibitionFaults(doc(ruledId, { name: ruled.name ?? ruledId, sport: ruled.sport }), TEAMS);
  assert.ok(both.includes(`${ruledId}: also ruled in teams`), both.join('; '));
});

// ------------------------------------------------------------------------------ smoke's wiring
test('smoke exempts a placeholder or a named exhibition opponent, and the same check carries the faults', () => {
  const smoke = code('scripts/smoke.mjs');
  assert.match(smoke, /import \{ isExhibitionOpponent, exhibitionFaults \} from '\.\.\/lib\/exhibition\.js';/);
  assert.match(smoke, /const faults = exhibitionFaults\(proColours, allTeams\);/);
  assert.match(smoke, /!proColours\.teams\[String\(t\.id\)\]\s*&& !isExhibitionOpponent\(t, proColours\)/,
    'a named opponent leaves the unruled set by name');
  assert.match(smoke, /assert\(proUnruled\.every\(isPlaceholderTeam\) && faults\.length === 0,/,
    'one check: placeholders, and no fault in the named list');
  assert.match(smoke, /'the only unruled pro rows are TBD placeholders or named exhibition opponents'/,
    'the label says both');
  assert.match(smoke, /\(exhibition opponent, named\)/, 'the detail names why each row was exempted');
});
