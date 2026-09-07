// THE DETAIL PANEL AND PROGRAMS (prompt 59) — three defects, only one of which Joe reported.
//
// Joe, 2026-09-07: "Any program/event that isn't a matchup between two teams… when you click on the
// event and the sub-card popup renders, the title bar says TBD @ TBD."
//
// Programs reach this panel the same way games do — Listing and PageCount wire `onOpen` to both card
// types and render ONE <GameDetail> for whatever was tapped — and it was written for matchups only.
//
//   1. THE HEAD. A program has no `home`, no `away` and no team ids, so `cardName` fell through to
//      its `|| 'TBD'` and printed TBD @ TBD, flanked by two <img> built from `undefined`.
//   2. THE PROBABLE-PITCHER BLOCK was gated on `sport === 'mlb'` alone. LATENT, not live: measured
//      2026-09-07, zero of 307 non-game programs carry sport 'mlb' (nfl 80, cfb 31, nascar 98,
//      aew 35, wwe 36, indycar 18, ufc 9). Guarded anyway - the day an MLB pregame show loads is
//      not the day to find out.
//   3. THE VENUE ROW read `game.venue?.name`; a program's place is `location_text`, so the row was
//      absent on all 130 programs that carry one.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the panel branches on isProgram, and the helpers are IMPORTED not reimplemented', () => {
  const g = code('components/GameDetail.js');
  assert.match(g, /import \{[\s\S]*?\} from '\.\.\/lib\/programs\.js'/);
  assert.match(g, /const program = isProgram\(game\);/);
  // rule 32: one concept, one place. A second title-builder here would drift from the card's.
  assert.match(g, /titleFor\(game\)/);
  assert.match(g, /subtitleFor\(game\)/);
  assert.match(g, /brandFor\(game\.brand_key\)/);
  for (const bad of [/function titleFor/, /function subtitleFor/, /function brandFor/,
                     /\|\| 'UNTITLED PROGRAM'/]) {
    assert.doesNotMatch(g, bad, 'no forked title logic in the panel');
  }
});

test('a program never reaches the two-team head', () => {
  const g = code('components/GameDetail.js');
  const head = g.slice(g.indexOf('dpanel-head'), g.indexOf('dpanel-close'));
  assert.match(head, /\{program \? \(/, 'the program branch comes first');
  // the matchup markup survives untouched on the other arm
  assert.match(head, /teamLogoDarkUrl\(away\?\.id\)/);
  assert.match(head, /cardName\(away, game\.away_team_id\)\} @ \{cardName\(home, game\.home_team_id\)/);
});

test('the typographic fallback survives - an unbranded programme never blanks the head', () => {
  // ProgramCard renders `brand.short_title` as a type mark when a brand has no art in the tree,
  // deliberately, so an unknown brand never gets a fabricated logo. The panel does the same.
  const g = code('components/GameDetail.js');
  assert.match(g, /brand\.mark_dark \? \(/);
  assert.match(g, /<span className="pcap-type">\{brand\.short_title \|\| titleFor\(game\)\.slice\(0, 10\)\}<\/span>/);
});

test('the probable-pitcher block cannot fire for a program', () => {
  assert.match(code('components/GameDetail.js'), /\{!program && sport === 'mlb' \? \(/);
});

test('a program’s place is location_text, and is not printed twice', () => {
  const g = code('components/GameDetail.js');
  assert.match(g, /game\.location_text && subtitleFor\(game\) !== String\(game\.location_text\)\.toUpperCase\(\)/,
    'subtitleFor falls back to location_text, so every race would have shown it twice');
  // the neutral-site parenthetical stays a GAME fact - a race has no neutral site to be at
  const venue = g.slice(g.indexOf('program ?', g.indexOf('dgrid')));
  assert.match(venue, /neutral_site/);
});

test('the endcap is styled for the panel without touching the card’s rules', () => {
  const css = src('app/globals.css');
  assert.match(css, /\.dpanel-cap \{/);
  assert.match(css, /\.dpanel-cap \.pcap-type \{/);
  // the brand bar is shared rather than copied
  assert.match(css, /\.pblock \.pcap-bar,\s*\n\.pcard \.pcap-bar,\s*\n\.dpanel-cap \.pcap-bar \{/);
  // and the card's own endcap rules are untouched
  assert.match(css, /\.pcard \.pcap \{/);
});
