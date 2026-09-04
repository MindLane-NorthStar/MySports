// The grid's team-colour bands (M13 cap gradients).
//
// WHY THIS EXISTS. Joe reported the MLB grid rendering "flat charcoal instead of team-colour bands".
// Measured against live data on 2026-09-03 it does not: the colour is stored, reaches MobileGrid, and
// tints to real team colours - Brewers rgb(19,38,67), Cubs rgb(15,47,118), Orioles rgb(195,63,4),
// beside CFB's rgb(139,26,46) Alabama crimson. Nothing in the colour path was broken.
//
// What the report was almost certainly comparing is the ARCHIVED PC GRID for CFB against the MOBILE
// grid for MLB - the two grids were both on screen at desktop width, which is the bug fixed in
// 24f9de8. So the guard worth having is not a fix but a tripwire: if a payload change ever drops
// primary_color, tint() silently returns its grey fallback and every band goes the colour of the
// page ground. That failure is invisible by inspection, so it gets a test.

import test from 'node:test';
import assert from 'node:assert/strict';
import { tint } from '../lib/gridmodel.js';

const GREY_FALLBACK = tint(null, 0.86);

test('a real team colour tints to that colour, not the fallback', () => {
  assert.equal(tint('#134a8e', 0.86), 'rgb(19, 66, 125)', 'Blue Jays');
  assert.equal(tint('#df4601', 0.86), 'rgb(195, 63, 4)', 'Orioles orange');
  assert.equal(tint('#9e1b32', 0.86), 'rgb(139, 26, 46)', 'Alabama crimson');
  for (const hex of ['#134a8e', '#df4601', '#9e1b32']) {
    assert.notEqual(tint(hex, 0.86), GREY_FALLBACK);
  }
});

test('the two gradient endpoints differ, so a cap reads as a gradient', () => {
  assert.notEqual(tint('#134a8e', 0.86), tint('#134a8e', 0.58));
});

test('a MISSING colour falls back to grey - the tell that the payload lost primary_color', () => {
  // Not a bug in itself; it is the signal. If a whole slate renders this, the read is broken.
  for (const bad of [null, undefined, '', 'not-a-hex', '#12345', '#1234567']) {
    assert.equal(tint(bad, 0.86), GREY_FALLBACK, String(bad));
  }
});

test('a near-black team colour still tints darker than the grey fallback', () => {
  // MLB has 13 of 30 teams below luminance 40 - but so does CFB, at 59% of 400. Dark is normal and
  // must not be mistaken for absent: black tints to near-black, never to the grey.
  assert.equal(tint('#000000', 0.86), 'rgb(3, 3, 3)');
  assert.notEqual(tint('#000000', 0.86), GREY_FALLBACK);
});

test('hex is accepted with or without the leading hash, any case', () => {
  assert.equal(tint('134a8e', 0.86), tint('#134A8E', 0.86));
});

// ------------------------------------------- CONTRACT §3 MOBILE BAND RULE (prompt 35, Joe's ruling)
//
// Whichever team colour is LIGHTER paints the band; the darker one is the ink. Where that pair is not
// legible the band KEEPS the team colour and only the ink is neutralised. §3 as written puts the
// primary on the band always, which on this dark ground leaves 251 of 357 teams under 3:1 against it.

import { bandFor, contrastRatio, luminance, BAND_MIN_RATIO } from '../lib/gridmodel.js';

const INK = '#f2f2f0';
const CHAR = '#101214';

test('the LIGHTER colour paints the band when the secondary is lighter', () => {
  // Steelers: black primary, gold secondary. Gold paints, black inks.
  const b = bandFor('#000000', '#ffb612');
  assert.equal(b.band, '#ffb612');
  assert.equal(b.ink, '#000000');
  assert.equal(b.inkIsNeutral, false);
  assert.ok(b.ratio > 11 && b.ratio < 13, `${b.ratio}`);
});

test('the LIGHTER colour paints the band when the PRIMARY is lighter', () => {
  // Ohio State: crimson primary, grey secondary - the grey is lighter, so it paints.
  const b = bandFor('#ba0c2f', '#a7b1b7');
  assert.equal(b.band, '#a7b1b7');
  assert.equal(b.ink, '#ba0c2f');
  assert.equal(b.inkIsNeutral, false);
});

test('the Browns render orange band, brown ink - the right way round', () => {
  // Joe described this card himself. §3 as written would have produced the inverse.
  const b = bandFor('#472a08', '#ff3c00');
  assert.equal(b.band, '#ff3c00');
  assert.equal(b.ink, '#472a08');
  assert.ok(b.ratio >= 3.0);
});

test('a pair at the 3.0 boundary keeps both team colours', () => {
  const b = bandFor('#ba0c2f', '#a7b1b7');
  assert.ok(b.ratio >= BAND_MIN_RATIO);
  assert.equal(b.inkIsNeutral, false);
});

test('a failing pair keeps the team colour on the BAND and neutralises only the INK', () => {
  // Guardians: navy/red at 2.97 - just under. The red still paints.
  const b = bandFor('#002b5c', '#e31937');
  assert.equal(b.band, '#e31937', 'the band is still a team colour');
  assert.equal(b.inkIsNeutral, true);
  assert.equal(b.ink, INK);
  assert.ok(b.ratio >= BAND_MIN_RATIO);
});

test('a failing pair takes CHARCOAL where charcoal measures higher', () => {
  // Jaguars: teal/gold at 2.36. Gold paints, and charcoal reads better on gold than white does.
  const b = bandFor('#007487', '#d7a22a');
  assert.equal(b.band, '#d7a22a');
  assert.equal(b.ink, CHAR);
  assert.equal(b.inkIsNeutral, true);
  assert.ok(b.ratio >= BAND_MIN_RATIO);
});

test('a null or malformed secondary still paints the primary and neutralises the ink', () => {
  for (const bad of [null, undefined, '', 'not-a-hex', '#12345', '#1234567']) {
    const b = bandFor('#29126f', bad);
    assert.equal(b.band, '#29126f', String(bad));
    assert.equal(b.inkIsNeutral, true);
    assert.ok(b.ratio >= BAND_MIN_RATIO, `${bad} -> ${b.ratio}`);
  }
});

test('a missing primary falls back to the same grey tint() uses, and still inks legibly', () => {
  const b = bandFor(null, null);
  assert.equal(b.band, '#6e747c');
  assert.ok(b.ratio >= BAND_MIN_RATIO);
});

test('THE ASSERTION THAT MATTERS: every worked example clears the threshold on its chosen ink', () => {
  // The eight the brief pins, measured against the loaded season. All 357 teams clear 3.0:1 - that was
  // verified against the database directly; these are the eight that show each branch.
  const cases = [
    ['#000000', '#ffb612'], ['#00274c', '#ffcb05'], ['#472a08', '#ff3c00'], ['#ba0c2f', '#a7b1b7'],
    ['#002b5c', '#e31937'], ['#007487', '#d7a22a'], ['#008e97', '#fc4c02'], ['#29126f', '#000000'],
  ];
  for (const [p, s] of cases) {
    const b = bandFor(p, s);
    assert.ok(b.ratio >= BAND_MIN_RATIO, `${p}/${s} -> ${b.ratio}`);
    assert.equal(contrastRatio(b.ink, b.band).toFixed(2), b.ratio.toFixed(2), 'the reported ratio is the real one');
  }
});

test('the band is NEVER darkened - it is the brand colour exactly', () => {
  // §3's x0.82 loop existed to rescue white ink on a too-dark band. Joe's rule inverts the problem.
  for (const [p, s] of [['#000000', '#ffb612'], ['#008e97', '#fc4c02'], ['#29126f', '#000000']]) {
    const b = bandFor(p, s);
    assert.ok([p, s].includes(b.band), `${b.band} is not one of the team's own colours`);
  }
});

test('luminance and contrastRatio are real sRGB, not a shortcut', () => {
  assert.ok(Math.abs(luminance('#ffffff') - 1) < 1e-9);
  assert.ok(Math.abs(luminance('#000000')) < 1e-9);
  assert.ok(Math.abs(contrastRatio('#ffffff', '#000000') - 21) < 1e-9);
  assert.equal(luminance('nope'), null);
  assert.equal(contrastRatio('nope', '#fff000'), null);
});
