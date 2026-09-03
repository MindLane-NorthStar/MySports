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
