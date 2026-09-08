// THE FAVOURITES BRACKET (prompt 59) — the gold left rule that replaced a heading and a hairline.
//
// Joe, 2026-09-07: "On the ALL GAMES views, 'Your Teams' still appears… Because the 'Your Teams'
// section isn't noticeably separated from the rest of the content below, it leaves the user
// confused."
//
// TWO DEFECTS, AND ONLY ONE OF THEM WAS THE ONE HE NAMED:
//   * `.favlabel` was `.band-title` character for character - 25.5px display, 700, uppercase,
//     .09em, own bottom hairline - so a band read COLLEGE FOOTBALL then YOUR TEAMS at equal weight
//     and nothing said where the second heading's scope ended.
//   * `.favrule` was 1px of --line-soft on a card-gradient ground. It was the element whose entire
//     job was "your teams end here", and it was imperceptible. That was the actual cause.
//
// The bracket borrows `.scopeline`'s gesture rather than inventing one: a gold left rule already
// means "this is about your teams" in this app.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the band renders a bracket, not a heading and a rule', () => {
  const b = code('components/SportBand.js');
  assert.match(b, /<div className="favgroup">\s*<div className="cards">\{favorites\.map\(row\)\}<\/div>\s*<\/div>/);
  assert.doesNotMatch(b, /favlabel/, 'the heading is gone');
  assert.doesNotMatch(b, /favrule/, 'and so is the rule nobody could see');
});

test('both retired classes are gone from the stylesheet, not merely unused', () => {
  const rules = src('app/globals.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(rules, /\.favlabel\s*\{/);
  assert.doesNotMatch(rules, /\.favrule\s*\{/);
  // and nothing anywhere still names them as a class
  // components/FirstBand.js was the fourth file here until prompt 67 deleted it with the band.
  for (const f of ['components/SportBand.js', 'components/Listing.js', 'app/page.js']) {
    assert.doesNotMatch(code(f), /favlabel|favrule/, `${f} still references a retired class`);
  }
});

test('the bracket is the scope line’s gesture, in the same gold', () => {
  const css = src('app/globals.css');
  const fav = css.match(/\.favgroup \{[^}]*\}/)[0];
  const scope = css.match(/\.scopeline \{[^}]*\}/)[0];
  assert.match(fav, /border-left: 2px solid var\(--gold\)/);
  assert.match(scope, /border-left: 2px solid var\(--gold\)/, 'the two must stay the same mark');
});

test('the padding is 4px, and the reason is measured rather than aesthetic', () => {
  // `.mcard`'s body track is minmax(0, 1fr), so the inset comes out of the room
  // `fitNameAndRecord` has. Across 26 favourite cards over seven days: at 9px, 0 records lost but
  // TEN cards dropped a name tier; at 4px, nothing changed at all. `.scopeline` keeps its 9px
  // because it sits above content rather than beside a width-constrained card.
  const fav = src('app/globals.css').match(/\.favgroup \{[^}]*\}/)[0];
  assert.match(fav, /padding-left: 4px/);
  assert.match(fav, /margin-bottom: 8px/, 'the 8px `.favrule` resolved to survives as the group gap');
});

test('`heading` and `headingClass` travel together - no default to a dead class', () => {
  // headingClass defaulted to 'favlabel'. That default was never reached (only week mode passes a
  // heading, and it passes weekday-head with it), but had it been, it would have styled a heading
  // as a band title - the exact confusion the bracket exists to end.
  const l = code('components/Listing.js');
  assert.doesNotMatch(l, /headingClass = '/, 'no default');
  assert.match(l, /headingClass, nowMinute/);
  // The third file this checked, components/FirstBand.js, was deleted with the band (prompt 67).
});

test('the bracket cannot appear under MY TEAMS', () => {
  // floatFavorites={!P.isMine} at every call site, so `favorites` is empty under MY TEAMS and the
  // group never renders. A band that contains nothing BUT favourites has nothing to bracket.
  // THREE UNTIL 2026-09-08: the FirstBand call site went with the band (prompt 67). The rule is
  // "every call site passes it", not "there are three of them", so the count follows the code.
  const p = code('app/page.js');
  const uses = p.match(/floatFavorites=\{[^}]*\}/g) || [];
  assert.equal(uses.length, 2);
  for (const u of uses) assert.equal(u, 'floatFavorites={!P.isMine}');
  const b = code('components/SportBand.js');
  assert.match(b, /const favorites = floatFavorites \? split\.favorites : \[\];/);
});
