// MY TEAMS IS SAID ONCE, AND IN ORDER (prompt 60 stage 4).
//
// Joe, 2026-09-07: "On the MY TEAMS page, My Teams render twice - once in what appears to be
// chronological order (although WWE Raw is currently appearing ahead of the Guardians game that
// airs 7 hours earlier) and a second time divided by sport. This seems unnecessary and repetitive."
//
// THREE SEPARATE MECHANISMS produced that, and only the first was in the brief:
//
//   1. the duplication - `FirstBand` and `#all-today` rendered the same handful of rows;
//   2. the BANDING - `bands={!P.isGrid}` is true under MY TEAMS, and bands render in SPORTS order,
//      so the chronology R4 computes was discarded three lines after it was computed;
//   3. the CONCATENATION - `allRows = [...games, ...programRows]` is two separately-ordered reads
//      joined end to end, so it was never in kickoff order at all. Invisible until (2) was fixed.
//
// AND WHAT JOE SAW WAS NOT A SORT FAULT. `byKickoff` in bandstate.js is correct and always was:
// measured on 2026-09-07, the first band was TONIGHT, which shows the evening from the prime window
// onward - 8:00 PM MONDAY NIGHT RAW - while the 1:35 PM Guardians game falls before that window and
// appeared only in the list below. Two correctly-ordered sections, stacked, putting a later row
// above an earlier one. Removing the duplicate removed the inversion.
//
// The page is a Server Component and cannot be rendered here, so what is pinned is the pair of
// conditions and the sort function they depend on - the three things a later edit can undo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chronological } from '../lib/favorites.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const at = (id, iso, extra = {}) => ({ id, canonical_kickoff_at_utc: iso, ...extra });

test('chronological interleaves the two reads the page concatenates', () => {
  // 2026-09-06 under MY TEAMS, in the shape page.js actually builds: every GAME by kickoff, then
  // every PROGRAM by start_at. Before this function the page rendered it in exactly this order.
  const games = [at('mlb', '2026-09-06T17:40:00Z'), at('cfb', '2026-09-06T23:30:00Z')];
  const programs = [at('indycar', '2026-09-06T18:30:00Z'), at('nascar', '2026-09-06T21:00:00Z'),
                    at('wwe', '2026-09-07T00:00:00Z')];
  const concatenated = [...games, ...programs];
  assert.deepEqual(concatenated.map((r) => r.id), ['mlb', 'cfb', 'indycar', 'nascar', 'wwe'],
    'the concatenation is out of order - this is the input, not a strawman');
  assert.deepEqual(chronological(concatenated).map((r) => r.id),
    ['mlb', 'indycar', 'nascar', 'cfb', 'wwe']);
});

test('a row with no kickoff sorts LAST, never first', () => {
  // The same rule bandstate.js's byKickoff uses: a TBD is not "earliest", it is "unknown".
  const rows = [at('tbd', null), at('late', '2026-09-06T23:30:00Z'), at('early', '2026-09-06T17:40:00Z')];
  assert.deepEqual(chronological(rows).map((r) => r.id), ['early', 'late', 'tbd']);
  // and an unparseable string is treated as absent rather than as NaN, which would sort randomly
  assert.deepEqual(chronological([at('junk', 'not a date'), at('ok', '2026-09-06T17:40:00Z')])
    .map((r) => r.id), ['ok', 'junk']);
});

test('it reads a program that has not been through toRow, and does not mutate its input', () => {
  // `toRow` copies `start_at` onto `canonical_kickoff_at_utc`, so rows reaching the page carry the
  // first key. Reading both means the helper is correct on a raw programs row too.
  const raw = [{ id: 'p', start_at: '2026-09-06T18:30:00Z' }, at('g', '2026-09-06T17:40:00Z')];
  assert.deepEqual(chronological(raw).map((r) => r.id), ['g', 'p']);
  const input = [at('b', '2026-09-06T23:30:00Z'), at('a', '2026-09-06T17:40:00Z')];
  chronological(input);
  assert.deepEqual(input.map((r) => r.id), ['b', 'a'], 'the caller keeps its own array');
});

test('equal instants keep the order the database gave them', () => {
  const rows = [at('first', '2026-09-13T17:00:00Z'), at('second', '2026-09-13T17:00:00Z')];
  assert.deepEqual(chronological(rows).map((r) => r.id), ['first', 'second']);
});

test('THE FIRST BAND DOES NOT RENDER AT ALL - it was removed on 2026-09-08', () => {
  // This asserted the band rendered everywhere EXCEPT grid and MY TEAMS. Joe ruled the whole thing
  // out (prompt 67): "In DAY view, ALL GAMES, LIST - we're still seeing the same games two times."
  // The narrowing this test recorded - out of GRID, then out of MY TEAMS - was the same complaint
  // arriving about a smaller slice each time, and the answer in the end was none of it.
  //
  // It is inverted rather than deleted because a test that pinned a feature is the right place to
  // record that the feature is gone, and to fail if it comes back by accident.
  const page = code('app/page.js');
  assert.doesNotMatch(page, /<FirstBand/, 'the band render is gone');
  assert.doesNotMatch(page, /bandState\s*\(/, 'and so is the state it rendered from');
  assert.doesNotMatch(page, /from '\.\.\/lib\/bandstate\.js'/, 'and the import');
  assert.doesNotMatch(page, /from '\.\.\/components\/FirstBand\.js'/, 'and the component import');
});

test('what the band answered is answered by the scroll instead', () => {
  // The band existed to say "what is on right now" on a day too long to scan. Removing it without
  // replacing that would have been a loss; prompt 67 stage 2 lands the reader on the live game on
  // entry. If the anchors ever come out, this says what has to go back in their place.
  const page = code('app/page.js');
  assert.match(page, /data-istoday=/, 'the day blocks carry the anchor the scroll needs');
});


test('MY TEAMS does not band, in EITHER mode (rule 32)', () => {
  const page = code('app/page.js');
  // DAY mode
  assert.match(page, /bands=\{!P\.isGrid && !P\.isMine\}/);
  // WEEK mode - the second place that renders the same thing. It was `bands={!P.sport}`, true under
  // MY TEAMS + ALL SPORTS, so the week regrouped every day into sport bands for the same reason.
  assert.match(page, /bands=\{!P\.sport && !P\.isMine\}/);
  // and BOTH modes pass their rows through `chronological`, because both build them by concatenating
  // a games read and a programs read.
  //
  // THE SHAPE CHANGED IN PROMPT 71 and the assertion follows it rather than being loosened. It used
  // to count `chronological(splitMine(` twice - MY TEAMS only. Joe asked for pregame shows to sort
  // at their air time in ALL GAMES too, so both call sites now wrap the whole ternary:
  // `chronological(P.isMine ? splitMine(...) : rows)`. What is defended is unchanged - each mode
  // sorts, and neither has a second sort of its own.
  assert.equal((page.match(/chronological\(P\.isMine \? splitMine\(/g) || []).length, 2);
  assert.doesNotMatch(page, /chronological\(splitMine\(/, 'no call site sorts only the mine scope');
});

test('the flat section is named by the CALLER, and there is no blanket fallback', () => {
  const listing = code('components/Listing.js');
  const band = code('components/SportBand.js');
  assert.match(listing, /flatLabel = null \}\) \{/, 'the prop defaults to null, so no caller changes');
  assert.match(listing, /<SportBand sport=\{sport\} label=\{flatLabel\}/);
  assert.match(code('app/page.js'), /flatLabel=\{P\.isMine \? 'My teams' : null\}/);
  // NO FALLBACK IN THE BAND. One was written and taken back out: the FIRST BAND reaches this same
  // flat path with a null sport on every ALL SPORTS day, so a fallback would have named a section
  // inside `.fband` - which is already a named region - and changed ALL GAMES. Measured out of
  // Chromium's accessibility tree rather than recalled (rule 34): an unnamed <section> is exposed
  // as `generic`, a named one as `region`. Nameless is not a broken landmark; it is not one.
  assert.match(band, /aria-label=\{label \|\| sport \|\| undefined\}/);
  assert.doesNotMatch(band, /aria-label=\{label \|\| sport \|\| '/, 'no string fallback');
});
