// Contract v1.6.15: the `vs` marker is retired and the neutral-site fact lives on the venue line.
//
// Joe, 2026-09-05: "Eliminate the vs so all cards look the same. Indicate neutral site by putting
// (neutral site) to the right of the venue name, in a slightly smaller font and without the text
// enhancement the venue name has." This amends prompt 33 stage 1, which kept the marker on the 20
// neutral-site games so a London game would not read as a home game.
//
// Source-read, like nav.test.mjs and pagehead.test.mjs: MatchupCard is a client component with a
// canvas measurer and cannot be mounted under `node --test`. What decides the answer is textual.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');
// Comments in these files still QUOTE the retired marker while explaining where it went.
const code = (p) => src(p).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

test('the list card renders nothing between the two team stacks', () => {
  const c = code('components/MatchupCard.js');
  assert.doesNotMatch(c, /className="at"/, 'the vs span is gone');
  assert.doesNotMatch(c, />vs</, 'and so is the literal');
});

test('the neutral-site fact is on the venue line, and survives a missing venue', () => {
  const c = code('components/MatchupCard.js');
  assert.match(c, /className="mnet-neutral">\(neutral site\)/);
  // Rendered from game.neutral_site directly, NOT nested inside the venue's conditional - a game
  // with no venue row must still say it is at a neutral site.
  assert.match(c, /\{game\.neutral_site \? <span className="mnet-neutral">/);
});

test('the detail panel matches, and its venue block survives a missing venue too', () => {
  const c = code('components/GameDetail.js');
  assert.doesNotMatch(c, /neutral_site \? 'vs'/, 'the panel no longer switches the matchup marker');
  assert.match(c, /game\.venue\?\.name \|\| game\.neutral_site/, 'the block renders for either');
  assert.match(c, /mnet-neutral/);
});

test('the parenthetical is quieter than the venue and never truncates', () => {
  const css = src('app/globals.css');
  const rule = css.slice(css.indexOf('.mnet-neutral {'), css.indexOf('}', css.indexOf('.mnet-neutral {')));
  assert.match(rule, /font-size: 11px/, 'one step under .mnet-text 12px');
  assert.match(rule, /font-style: italic/);
  assert.match(rule, /font-weight: 400/, 'regular - not the venue treatment');
  assert.match(rule, /color: var\(--dim\)/, '--dim is .tcol-rec, the standings-line grey');
  assert.match(rule, /white-space: nowrap/, 'it wraps whole or not at all');
});

test('.mnet stays a block - flex cost every card 2.9px', () => {
  const css = src('app/globals.css');
  const rule = css.slice(css.indexOf('\n.mnet {'), css.indexOf('}', css.indexOf('\n.mnet {')));
  assert.doesNotMatch(rule, /display: flex/,
    'a flex item takes its own content height and loses the block line-height leading');
});

test('.at is deleted, not merely unused', () => {
  assert.doesNotMatch(src('app/globals.css'), /^\.at \{/m);
});

test('the GRID keeps its marker - v1.6.15 is scoped to the list card', () => {
  // prompt 33 already scoped the grid out for want of room; this entry does not reopen it.
  assert.match(code('components/MobileGrid.js'), /neutral_site \? 'vs' : '@'/);
});

test('the locked reference retired the marker too (rule 23)', () => {
  const demo = readFileSync(join(HERE, '..', '..', 'docs/design/mobile_demo.html'), 'utf8');
  assert.doesNotMatch(demo, /class="atbig">vs</, 'the demo drew the hug and no longer does');
});
