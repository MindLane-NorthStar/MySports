// THE FAVOURITE MARK — a gold border on the card (prompt 82 block D2, Joe 2026-09-09).
//
// THIS FILE USED TO TEST A BRACKET, AND THE BRACKET IS RETIRED. The history matters because the same
// ground has been walked three times and the tests moved with it each time:
//
//   D6 / prompt 20   floated favourites under a faint "YOUR TEAMS" micro-label
//   prompt 27        made that the first heading on the page; Joe: "small gray text like an
//                    afterthought"
//   prompt 59        replaced it with a gold left-rule BRACKET around the floated group
//   prompt 82        removes the FLOAT and marks the card instead
//
// WHAT CHANGED IS THE ORDER, NOT THE TASTE. Joe's 2026-09-09 ruling makes position meaningful —
// `chronological()` sorts by time, then a studio show, then a favourite at a tie — and a group
// hoisted to the top of a list sorted by the clock contradicts the sort. `app/page.js` sorted and
// `SportBand` un-sorted it. The gesture survives on the card; the hoist is what went.
//
// THE TESTS ARE REWRITTEN, NOT DELETED. Every property the bracket tests protected still has an
// owner below: the favourite is distinguishable, MY TEAMS suppresses it, and MatchupCard is still
// untouched. What is NEW is the composition case, which the bracket never had to answer.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { region } from './region.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// --------------------------------------------------------------------------- the float is gone
test('the band renders ONE list, in the order the page sorted it', () => {
  const b = code('components/SportBand.js');
  assert.match(b, /<div className="cards">\{\(games \|\| \[\]\)\.map\(row\)\}<\/div>/,
    'one list, straight from the prop');
  assert.doesNotMatch(b, /favgroup/, 'the bracket wrapper is gone');
  assert.doesNotMatch(b, /splitFavorites/, 'and the split that fed it');
  assert.doesNotMatch(b, /favlabel|favrule/, 'as are the heading and hairline it replaced');
});

test('nothing anywhere still floats favourites', () => {
  // Rule 32: the prop threaded page -> Listing -> SportBand, so all three are checked. `.favgroup`
  // is checked in the stylesheet too - a rule with no markup is dead weight that reads as evidence
  // the feature still exists.
  for (const f of ['app/page.js', 'components/Listing.js', 'components/SportBand.js']) {
    assert.doesNotMatch(code(f), /floatFavorites/, `${f} still threads the float`);
  }
  assert.doesNotMatch(code('app/globals.css'), /\.favgroup/, 'the stylesheet rule is gone');
});

test('`splitFavorites` is retired, not left exported with no caller', () => {
  // The ruling lib/headerstate.js records for `resetHeader()` and prompt 67 applied to `bandstate`.
  assert.doesNotMatch(code('lib/favorites.js'), /export function splitFavorites/);
  // and the two predicates the MARK needs are still there
  assert.match(code('lib/favorites.js'), /export function isFavorite/);
  assert.match(code('lib/favorites.js'), /export function favoriteIds/);
});

// ------------------------------------------------------------------------------- the mark itself
test('the favourite is a FOURTH row-wrapper class, computed from isFavorite', () => {
  // The class goes on the WRAPPER, never on the card: `MatchupCard` is locked under the rendering
  // contract and `SportBand`'s own note says nothing here reaches inside it.
  const b = code('components/SportBand.js');
  const rc = region(b, 'const rowClass = (g) =>', '.filter(Boolean)', 'the row class list');
  assert.match(rc, /favIdSet && isFavorite\(g, favIdSet\) \? 'fav-row' : null/);
  assert.doesNotMatch(code('components/MatchupCard.js'), /fav-row|isFavorite/,
    'the card is closed and stays closed');
});

test('it is a RECOLOURED BORDER, never an `outline` — the focus ring owns that', () => {
  // `button.mcard:focus-visible` is `outline: 2px solid var(--gold)` with `outline-offset: 2px`.
  // A favourite drawn with `outline` would be that ring character for character: every favourite
  // card would look permanently focused and a keyboard user would lose their position on exactly
  // the cards Joe cares about most.
  const css = src('app/globals.css');
  const focus = region(css, 'button.mcard:focus-visible', '}', 'the focus ring');
  assert.match(focus, /outline: 2px solid var\(--gold\)/, 'the ring is unchanged');
  assert.match(focus, /outline-offset: 2px/, 'and still paints outside the border');

  const mark = region(css, '.fav-row > .mcard {', '}', 'the favourite mark');
  assert.match(mark, /border-color: var\(--gold\)/, 'the token is read, never a retyped hex');
  assert.doesNotMatch(mark, /outline/, 'no outline - that property is the focus ring');
  assert.doesNotMatch(mark, /padding|margin|width/, 'and nothing that costs layout');
});

test('the mark costs no layout, which is why it is a border and not an inset', () => {
  // The retired bracket INSET the card, and `.mcard`'s body track is `minmax(0, 1fr)`, so an inset
  // comes out of what `fitNameAndRecord` has for a name and a record. Prompt 59 measured 11px of
  // inset dropping 10 of 26 name tiers. Recolouring an existing border spends none of that budget.
  // The measurement is KEPT in the stylesheet because it is the reason for this shape.
  const css = src('app/globals.css');
  assert.match(css, /name tiers dropped/, 'prompt 59\'s table survives the element it measured');
  assert.match(css, /10 of 26/);
  // and the card really does already have a border to recolour
  const card = region(css, '.mcard {', '}', 'the card');
  assert.match(card, /border: 1px solid var\(--line-soft\)/);
  assert.match(card, /border-radius: var\(--radius\)/, 'so the mark follows the radius for free');
});

// ------------------------------------------------------------------------- composition and scope
test('fav-row COMPOSES with off-service — the other three are exclusive, this one is not', () => {
  // `offServiceSummary`'s buckets are mutually exclusive by its own if/else, so at most one of
  // networktbd / pending / offsvc can apply. A favourite can be ANY of them, and both cues must
  // show. "One silently wins" is the failure this shape invites.
  const b = code('components/SportBand.js');
  const rc = region(b, 'const rowClass = (g) =>', '.filter(Boolean)', 'the row class list');
  for (const cls of ['networktbd-row', 'pending-row', 'offsvc-row', 'fav-row']) {
    assert.match(rc, new RegExp(`'${cls}'`), `${cls} is in the list`);
  }
  // joined with a space rather than chosen between - that is what makes them compose
  assert.match(b, /\.filter\(Boolean\)\.join\(' '\) \|\| undefined/);
  // and the off-service rule targets the wrapper too, so both land on the same element
  assert.match(code('app/globals.css'), /\.offsvc-row/);
});

test('MY TEAMS suppresses the mark, in the same vocabulary the float used', () => {
  // Every row there is a favourite, so marking them all marks nothing. `!P.isMine` is the same
  // predicate the float was switched off with - one rule for a reader to learn, not two.
  const page = code('app/page.js');
  const uses = page.match(/markFavorites=\{[^}]*\}/g) || [];
  assert.equal(uses.length, 2, 'both call sites - day and week (rule 32)');
  for (const u of uses) assert.equal(u, 'markFavorites={!P.isMine}');
  // and the band honours it by withholding the ids rather than by a second branch
  assert.match(code('components/SportBand.js'), /const favIdSet = markFavorites \? favIds : null;/);
});

test('no `.pcard` arm, because a program can never be a favourite', () => {
  // `isFavorite` reads home/away team ids and a race, a fight card and a studio show carry neither.
  // A selector that cannot fire reads to a later reader as evidence the case was handled.
  assert.doesNotMatch(code('app/globals.css'), /\.fav-row > \.pcard/);
  assert.match(src('app/globals.css'), /NO `\.pcard` ARM/, 'and the reason is recorded');
});
