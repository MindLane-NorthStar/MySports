// The per-team cap surface (Joe's candidate-D ruling, 2026-09-04): the table, the lookup, and the
// pin that keeps inkFor() and bandFor() from ever disagreeing about the text colour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { bandFor, inkFor, capFor, tint, CAP_TINT, BAND_MIN_RATIO, contrastRatio } from '../lib/gridmodel.js';

const HERE = dirname(fileURLToPath(import.meta.url));
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
    assert.ok(r.art === 'raw' || r.art === 'dark', `${id} art ${r.art}`);
    assert.ok(r.edge_crisp >= 0 && r.edge_crisp <= 1, `${id} edge_crisp ${r.edge_crisp}`);
  }
});

test('the shipped table matches the study field for field on tint and art', () => {
  let flatRaw = 0, flatDark = 0, tintRaw = 0, tintDark = 0;
  for (const row of fixture.teams) {
    const mine = table.teams[row.id];
    assert.ok(mine, `${row.id} missing from the shipped table`);
    assert.equal(mine.tint, row.tint, `${row.id} tint`);
    assert.equal(mine.art, row.art, `${row.id} art`);
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
