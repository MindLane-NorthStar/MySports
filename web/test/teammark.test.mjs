// THE TBD BADGE (prompt 116, Joe's ruling 2026-09-23, register §61).
//
// A placeholder team - a postseason seed with no club yet - has no logo on R2, and every team mark
// drew the browser's broken-image icon for it. TeamMark renders a grey TBD badge in the logo's box
// for a placeholder, the <img> for a club, and swaps to the badge when a logo fails to load (the
// name pattern is deliberately narrow, so a later round's placeholder will miss it and still have
// no file). Rendered here with React's server renderer, which is exactly what the page does first.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import TeamMark from '../components/TeamMark.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const render = (props) => renderToStaticMarkup(createElement(TeamMark, props));

test('a placeholder team renders the TBD badge, not an <img>', () => {
  const html = render({ team: { id: 'mlb-4944', canonical_name: 'AL Wild Card #2' }, sport: 'mlb', src: 'https://x/logos/mlb-4944_dark.png' });
  assert.match(html, /<span class="tbd-mark"[^>]*>TBD<\/span>/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /aria-label="Team to be determined"/, 'the badge names itself to assistive tech');
});

test('a -TBD id renders the badge in any sport', () => {
  const html = render({ team: { id: 'nba-TBD', canonical_name: 'TBD' }, sport: 'nba', src: 'https://x/logos/nba-tbd_dark.png' });
  assert.match(html, /tbd-mark/);
});

test('a club renders the <img>, lazy by default, and its src is the caller\'s', () => {
  const html = render({ team: { id: 'mlb-147', canonical_name: 'Yankees' }, sport: 'mlb', src: 'https://x/logos/mlb-147_dark.png' });
  assert.match(html, /<img src="https:\/\/x\/logos\/mlb-147_dark\.png" alt="" loading="lazy"\/>/);
  assert.doesNotMatch(html, /tbd-mark/);
});

test('the sport is what makes the MLB pattern bite: the same name on another sport is a club', () => {
  const html = render({ team: { id: 'nba-4944', canonical_name: 'AL Wild Card #2' }, sport: 'nba', src: 'https://x/l.png' });
  assert.match(html, /<img/);
});

test('no src at all is a badge, never a broken <img>', () => {
  const html = render({ team: { id: 'mlb-147', canonical_name: 'Yankees' }, sport: 'mlb', src: null });
  assert.match(html, /tbd-mark/);
});

test('the error path exists in both forms: onError after hydration, and the mount check before it', () => {
  // renderToStaticMarkup cannot fire an image error, so the two handlers are pinned at the source
  // and exercised in the browser by qa-shots (a 404ed logo on a cold load shows the badge).
  const c = code('components/TeamMark.js');
  assert.match(c, /onError: \(\) => setFailed\(true\)/, 'a load failure after hydration swaps to the badge');
  assert.match(c, /img\.complete && img\.naturalWidth === 0\) setFailed\(true\)/, 'a failure that fired before hydration is caught on mount');
  assert.match(c, /if \(placeholder \|\| failed \|\| !src\)/, 'the three ways to the badge');
});

test('EVERY site that draws a team mark goes through TeamMark (rule 32)', () => {
  // The five call sites prompt 116 found by searching for teamLogo: the list row, the slot's
  // favoured mark, the detail panel's two, and the grid endcap. A bare <img src={teamLogo...}>
  // anywhere in these files would be a sixth site the badge never reaches.
  for (const f of ['components/MatchupCard.js', 'components/GameDetail.js', 'components/MobileGrid.js']) {
    const c = code(f);
    assert.match(c, /import TeamMark from '\.\/TeamMark\.js'/, `${f} imports TeamMark`);
    assert.doesNotMatch(c, /<img\s+src=\{(teamLogoDarkUrl|teamLogoUrl|teamLogoCapUrl|capArt)\(/, `${f} still draws a team mark with a bare <img>`);
  }
  assert.equal((code('components/MatchupCard.js').match(/<TeamMark /g) || []).length, 2);
  assert.equal((code('components/GameDetail.js').match(/<TeamMark /g) || []).length, 2);
  assert.equal((code('components/MobileGrid.js').match(/<TeamMark /g) || []).length, 2);
});

test('the badge is styled from the neutral tokens and sized to each logo box it stands in', () => {
  const css = src('app/globals.css');
  const rule = css.match(/\.tbd-mark \{[^}]*\}/)[0];
  assert.match(rule, /background: var\(--spot-0\);/);
  assert.match(rule, /color: var\(--dim\);/);
  assert.match(rule, /font-family: 'Barlow Condensed'/);
  assert.doesNotMatch(rule, /#[0-9a-f]{3,6}/i, 'no retyped hex (rule 16)');
  // one size rule per box, restating the <img> size at that site
  assert.match(css, /\.tl1 \.tbd-mark \{ width: 20px; height: 20px;/);
  assert.match(css, /\.mslot \.tbd-mark \{ width: 44px; height: 44px;/);
  assert.match(css, /\.dpanel-head \.tbd-mark \{ width: 34px; height: 34px;/);
  assert.match(css, /\.mcap \.tbd-mark \{ width: 78%; height: 78%;/);
});
