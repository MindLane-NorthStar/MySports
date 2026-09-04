// The list card's right half: the two fixed columns, and the ladder that fills the slot.
//
// Fixtures, not DOM. The numbers live in web/lib/cardGeometry.js and are asserted here against the
// CSS text, so the constants and the stylesheet cannot drift apart silently - which is the failure
// this whole stage exists to prevent, an `auto` track quietly sizing itself per card.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { MARK, SLOT, PORTRAIT_MAX, forWidth } from '../lib/cardGeometry.js';
import { slotContent } from '../lib/format.js';

const HERE = dirname(fileURLToPath(import.meta.url));
// Comments are stripped before matching. Several of these rules carry a comment that MENTIONS the
// property it replaced ("max-width is GONE"), and a naive regex would match the prose and report the
// property as still present - a test that fails on its own documentation is worse than no test.
const CSS = readFileSync(join(HERE, '..', 'app', 'globals.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** The @media (max-width: 560px) block, so portrait rules are read from portrait. */
function portraitBlock() {
  const i = CSS.indexOf('@media (max-width: 560px)');
  assert.ok(i > -1, 'the portrait breakpoint block must exist');
  let d = 0, j = CSS.indexOf('{', i);
  const start = j;
  do { if (CSS[j] === '{') d++; else if (CSS[j] === '}') d--; j++; } while (d > 0 && j < CSS.length);
  return CSS.slice(start, j);
}
const PORTRAIT = portraitBlock();
const BASE = CSS.slice(0, CSS.indexOf('@media (max-width: 560px)'));

/** Source with comments removed - same reason as the CSS: these files NAME the things they removed. */
function code(...parts) {
  return readFileSync(join(HERE, ...parts), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}
const CARD = code('..', 'components', 'MatchupCard.js');

// ---------------------------------------------------------------- the two fixed tracks
test('the card grid uses FIXED tracks for the mark and the slot, both breakpoints', () => {
  // `auto` and `minmax(...)` are what moved: content-sized tracks change per card, which is how the
  // mark column swung 41-92px and dragged the matchup column with it.
  assert.match(BASE, new RegExp(
    `grid-template-columns:\\s*78px\\s+minmax\\(0,\\s*1fr\\)\\s+${MARK.track.desktop}px\\s+${SLOT.track.desktop}px`));
  assert.match(PORTRAIT, new RegExp(
    `grid-template-columns:\\s*56px\\s+minmax\\(0,\\s*1fr\\)\\s+${MARK.track.portrait}px\\s+${SLOT.track.portrait}px`));
  for (const t of [MARK.track.portrait, MARK.track.desktop, SLOT.track.portrait, SLOT.track.desktop]) {
    assert.equal(typeof t, 'number');
    assert.ok(t > 0);
  }
});

test('the mark box is fixed per breakpoint and carries no hf', () => {
  assert.match(BASE, new RegExp(`\\.mnet-mark\\s*\\{[^}]*width:\\s*${MARK.box.desktop.w}px[^}]*height:\\s*${MARK.box.desktop.h}px`, 's'));
  assert.match(PORTRAIT, new RegExp(`\\.mcard \\.mnet-mark\\s*\\{[^}]*width:\\s*${MARK.box.portrait.w}px[^}]*height:\\s*${MARK.box.portrait.h}px`, 's'));
  // the card path must not compute a height from the manifest any more
  assert.doesNotMatch(CARD, /markStyle/, 'markStyle belongs to the banner and the rail, not the card');
  assert.doesNotMatch(CARD, /STACK_H/);
});

test('the mark box fits inside its track at both breakpoints', () => {
  assert.ok(MARK.box.portrait.w <= MARK.track.portrait, 'portrait box wider than its track');
  assert.ok(MARK.box.desktop.w <= MARK.track.desktop, 'desktop box wider than its track');
});

test('the slot track fits the widest string the ladder can emit', () => {
  // Measured in the real faces (stage 2a): portrait 86.06px "116 - 104", desktop 98.52px
  // "Final pending". A track narrower than either would clip or wrap a real state.
  assert.ok(SLOT.track.portrait >= 86.06, `portrait track ${SLOT.track.portrait} < 86.06`);
  assert.ok(SLOT.track.desktop >= 98.52, `desktop track ${SLOT.track.desktop} < 98.52`);
  // and the old cap that would have clipped a three-digit score is gone
  assert.doesNotMatch(PORTRAIT, /\.mslot\s*\{[^}]*max-width/s, '.mslot must not re-acquire a max-width');
});

test('the slot is centred, not flush right - this reverses v1.6.6 by ruling', () => {
  assert.match(BASE, /\.mslot\s*\{[^}]*align-items:\s*center/s);
  assert.match(BASE, /\.mslot\s*\{[^}]*justify-self:\s*stretch/s);
  assert.match(BASE, /\.mslot\s*\{[^}]*text-align:\s*center/s);
  assert.doesNotMatch(BASE, /\.mslot\s*\{[^}]*align-items:\s*flex-end/s);
});

// ---------------------------------------------------------------- row 1 and TIED
test('row 1 is 44px and TIED is sized to the same box, both breakpoints', () => {
  assert.equal(SLOT.row1.portrait, 44);
  assert.equal(SLOT.row1.desktop, 44);
  assert.match(BASE, new RegExp(`\\.mslot img\\s*\\{[^}]*width:\\s*${SLOT.row1.desktop}px[^}]*height:\\s*${SLOT.row1.desktop}px`, 's'));
  assert.match(PORTRAIT, new RegExp(`\\.mslot img\\s*\\{[^}]*width:\\s*${SLOT.row1.portrait}px`, 's'));
  // the jog stage 1 found by reading the code: TIED at 20px against a 24px image
  assert.match(BASE, new RegExp(`\\.mslot-tied\\s*\\{[^}]*line-height:\\s*${SLOT.row1.desktop}px`, 's'));
  assert.match(PORTRAIT, new RegExp(`\\.mslot-tied\\s*\\{[^}]*line-height:\\s*${SLOT.row1.portrait}px`, 's'));
});

// ---------------------------------------------------------------- one silhouette per state
test('the odds state and the score state emit the SAME row classes', () => {
  // v1.6.6 claimed one silhouette; the odds rung actually rendered 14px/11px against 17px/13px.
  assert.doesNotMatch(CARD, /mslot-ml/, 'the moneyline must use the score row class');
  assert.doesNotMatch(CARD, /mslot-ou/, 'the O/U must use the state row class');
  assert.match(CARD, /className="mscore"/);
  assert.match(CARD, /className="mslot-state"/);
});

test('no state-specific row sizes survive in the stylesheet', () => {
  for (const dead of ['.mslot-ml', '.mslot-ou']) {
    assert.doesNotMatch(CSS, new RegExp(`\\${dead}\\s*\\{`), `${dead} still carries its own size`);
  }
});

// ---------------------------------------------------------------- the reserved empty track
test('an empty mark column reserves its width instead of collapsing', () => {
  // width:0 let the slot slide left on any card whose network has no published mark.
  assert.match(BASE, /\.mnet-mark-empty\s*\{[^}]*visibility:\s*hidden/s);
  assert.doesNotMatch(BASE, /\.mnet-mark-empty\s*\{[^}]*width:\s*0/s);
  assert.doesNotMatch(BASE, /\.mnet-mark-empty\s*\{[^}]*display:\s*none/s);
});

// ---------------------------------------------------------------- forWidth
test('forWidth picks the breakpoint the media query would', () => {
  for (const w of [320, 390, 430, 560]) assert.equal(forWidth(w).key, 'portrait', String(w));
  for (const w of [561, 852, 1440]) assert.equal(forWidth(w).key, 'desktop', String(w));
  assert.equal(forWidth(PORTRAIT_MAX).slotTrack, SLOT.track.portrait);
  assert.equal(forWidth(PORTRAIT_MAX + 1).slotTrack, SLOT.track.desktop);
  assert.deepEqual(forWidth(390).markBox, MARK.box.portrait);
});

// ---------------------------------------------------------------- prompt 29's ladder, unchanged
const G = (o) => ({ sport: 'mlb', canonical_kickoff_at_utc: '2026-09-04T18:00:00Z', ...o });

test("prompt 29's ladder still returns its nine cases unchanged", () => {
  // 1 exception outranks odds
  assert.equal(slotContent(G({ result_status: 'postponed' }), { side: 'home', ml: -110 }).kind, 'exception');
  assert.equal(slotContent(G({ result_status: 'cancelled' })).kind, 'exception');
  // 1b stale live
  assert.equal(slotContent(G({ result_status: 'in_progress',
                               canonical_kickoff_at_utc: '2026-01-01T00:00:00Z' })).kind, 'stale');
  // 2 score, and the winner's mark, higher number first
  const fin = slotContent(G({ result_status: 'final', away_score: 2, home_score: 6 }));
  assert.equal(fin.kind, 'score');
  assert.equal(fin.markSide, 'home');
  assert.equal(fin.row2, '6 - 2');
  // 2b level
  const tied = slotContent(G({ result_status: 'final', away_score: 3, home_score: 3 }));
  assert.equal(tied.tied, true);
  assert.equal(tied.markSide, null);
  // 3 in progress with no numbers
  assert.equal(slotContent(G({ result_status: 'in_progress' })).kind, 'live');
  // 4 scheduled with a line
  const odds = slotContent(G({ result_status: 'scheduled' }),
                           { side: 'away', ml: -162, odds: { total: 47.5 } });
  assert.equal(odds.kind, 'odds');
  assert.equal(odds.row2, '-162');
  assert.equal(odds.row3, 'O/U 47.5');
  // 5 everything else
  assert.equal(slotContent(G({ result_status: 'scheduled' })).kind, 'none');
});

test('single-row states still emit ONE row - no empty rows are reserved', () => {
  for (const s of [slotContent(G({ result_status: 'postponed' })),
                   slotContent(G({ result_status: 'in_progress' })),
                   slotContent(G({ result_status: 'scheduled' }))]) {
    assert.equal(s.row2, null, `${s.kind} must not reserve row 2`);
    assert.equal(s.markSide, null);
  }
});
