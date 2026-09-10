// THE GAME LINK - one link, one destination per sport, and the label follows the state (prompt 86,
// Joe's ruling 2026-09-10).
//
// These RUN the rule rather than reading it. Rule 24: a count computed on the Python side is no
// evidence the JS runtime agrees, so the labels are asserted here, in the JS gate, against the same
// function GameDetail calls - not inferred from the loader's tests.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { gameLink, GAME_LINK_LABEL, PREVIEW_LABEL } from '../lib/gamelink.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const URL = 'https://www.espn.com/nfl/game/_/gameId/401772510';
const game = (result_status, boxscore_url = URL) => ({ id: 'nfl-401772510', sport: 'nfl', result_status, boxscore_url });

// ------------------------------------------------------------------------------- the labels
test('before the game the link is a PREVIEW', () => {
  assert.deepEqual(gameLink(game('scheduled')), { href: URL, label: 'Preview' });
});

test('while the game is on it is the LIVE BOX SCORE', () => {
  assert.deepEqual(gameLink(game('in_progress')), { href: URL, label: 'Live box score' });
});

test('once it is over it is the BOX SCORE', () => {
  assert.deepEqual(gameLink(game('final')), { href: URL, label: 'Box score' });
});

test('any other state is a Preview, and a missing status is too', () => {
  // "anything else -> Preview" - a postponed game's page is the preview of the game that will be.
  for (const s of ['postponed', 'cancelled', null, undefined, 'something-new']) {
    assert.equal(gameLink(game(s)).label, PREVIEW_LABEL, String(s));
  }
});

test('ONE destination: the state changes the words and never the URL', () => {
  const hrefs = new Set(['scheduled', 'in_progress', 'final'].map((s) => gameLink(game(s)).href));
  assert.deepEqual([...hrefs], [URL]);
});

test('the three labels are three different strings', () => {
  const labels = [PREVIEW_LABEL, GAME_LINK_LABEL.in_progress, GAME_LINK_LABEL.final];
  assert.equal(new Set(labels).size, 3);
});

// ------------------------------------------------------------------------------- no link
test('NO LINK AT ALL without a stored URL, in every state', () => {
  // Rows written before prompt 86's loader change and not yet refreshed have none. A link to
  // nothing is worse than no link; it fills in on the next refresh.
  for (const s of ['scheduled', 'in_progress', 'final', 'postponed', null]) {
    for (const url of [null, undefined, '']) {
      const row = { id: 'nfl-401772510', sport: 'nfl', result_status: s, boxscore_url: url };
      assert.equal(gameLink(row), null, `${s} / ${JSON.stringify(url)}`);
    }
    const { boxscore_url: _gone, ...noField } = game(s);   // the field absent altogether
    assert.equal(gameLink(noField), null, `${s} / no field`);
  }
});

test('a PROGRAM never produces one, even handed a stray URL', () => {
  // `boxscore_url` is a column on `games` and `programs` has none, so this holds by construction;
  // gameLink refuses a program row outright so it holds regardless.
  const program = { program_id: 9007, program_type: 'studio_show', result_status: 'in_progress' };
  assert.equal(gameLink(program), null);
  assert.equal(gameLink({ ...program, boxscore_url: URL }), null);
});

test('nothing in, nothing out', () => {
  assert.equal(gameLink(null), null);
  assert.equal(gameLink(undefined), null);
});

// ------------------------------------------------------------------------------- the panel
test('GameDetail draws what gameLink returns, and learned no label of its own', () => {
  const g = code('components/GameDetail.js');
  assert.match(g, /const link = gameLink\(game\);/);
  assert.match(g, /\{link\.label\}/);
  for (const label of ['Preview', 'Live box score', 'Box score']) {
    assert.doesNotMatch(g, new RegExp(`'${label}'`), `the panel must not hard-code '${label}'`);
  }
});

test('the footer no longer tells a reader the game link opens the service', () => {
  // "Watch links are best effort - they open the service, not this game" stays: it is still true of
  // the watch links. It is false of the game link, so a clause says so when one renders.
  const g = src('components/GameDetail.js');
  assert.match(g, /Watch links are best effort - they open the service, not this game\./);
  assert.match(g, /\{link \? ` \$\{link\.label\} opens this game's own page\.` : ''\}/);
});

test('no copy implies the game link streams anything', () => {
  for (const label of [PREVIEW_LABEL, ...Object.values(GAME_LINK_LABEL)]) {
    assert.doesNotMatch(label, /watch|stream|live on/i, label);
  }
});
