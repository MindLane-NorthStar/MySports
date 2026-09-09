// THE HELPER THAT MAKES A MISSING ANCHOR FAIL (prompt 74). test/region.mjs carries the why.
//
// This is the gate's copy of what `scripts/probes/test-mutation.mjs` proves the slow way. The probe
// deletes each anchor from a copy of the tree and runs the suite - decisive, and 40 subprocesses.
// These are the same property asserted directly, so a change to the helper fails in `test:unit`
// rather than only in a tool somebody has to remember to run.
//
// WHAT THE SWEEP FOUND, so the numbers are not lost: 41 anchors across 36 test files, SIX of which
// survived having their own anchor deleted - two in collapsedheader.test.mjs, two in
// emptyday.test.mjs, two in programpanel.test.mjs. All six were the REGION shape rather than
// prompt 71's ordering shape: a slice whose start anchor vanishes becomes one character, and one
// whose END anchor vanishes becomes the rest of the file. Neither fails; both stop being the test
// that was written.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { region, after, anchorAt } from './region.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');

const SAMPLE = 'alpha\nBEGIN\nmiddle\nEND\nomega\n';

test('region() returns the text between the anchors, first included, second not', () => {
  assert.equal(region(SAMPLE, 'BEGIN', 'END'), 'BEGIN\nmiddle\n');
});

test('region() THROWS when the opening anchor is gone, rather than returning one character', () => {
  // `'x'.slice(-1)` is the last character, and every `doesNotMatch` over one character passes.
  assert.throws(() => region(SAMPLE, 'MISSING', 'END'), /region anchor not found/);
});

test('region() THROWS when the CLOSING anchor is gone, rather than widening to the whole file', () => {
  // This is the half that is easy to miss: `slice(i, -1)` is the rest of the file, so a test that
  // said "inside the panel head" quietly becomes "somewhere in this component" and keeps passing.
  assert.throws(() => region(SAMPLE, 'BEGIN', 'MISSING'), /region anchor not found/);
});

test('the closing anchor is looked for AFTER the opening one', () => {
  // Otherwise a second copy earlier in the file would produce a backwards slice, silently empty.
  const s = 'END\nBEGIN\nmiddle\nEND\n';
  assert.equal(region(s, 'BEGIN', 'END'), 'BEGIN\nmiddle\n');
});

test('after() throws on a miss, and returns the tail otherwise', () => {
  assert.equal(after(SAMPLE, 'END'), 'END\nomega\n');
  assert.throws(() => after(SAMPLE, 'MISSING'), /region anchor not found/);
});

test('anchorAt() throws on a miss, which is what makes an ordering assertion sound', () => {
  // PROMPT 71'S DEFECT IN ONE LINE. `indexOf` returns -1, and -1 < any real index - so
  // `assert.ok(a.indexOf(gone) < a.indexOf(present))` holds for the very reason it was written to
  // rule out. `anchorAt` cannot: the comparison never happens.
  assert.ok(anchorAt(SAMPLE, 'BEGIN') < anchorAt(SAMPLE, 'END'));
  assert.throws(() => anchorAt(SAMPLE, 'MISSING'), /region anchor not found/);
});

test('the failure message says what to do, not just that something was not found', () => {
  // A landmark.mjs-shaped message: the probe guard one directory up says "Fix the selector or delete
  // the measurement; do not let it fall through to another element." Same ruling, same wording.
  assert.throws(() => after(SAMPLE, 'MISSING'), (e) => {
    assert.match(e.message, /Fix the anchor or delete the assertion/);
    assert.match(e.message, /widen to the whole file or collapse to nothing/);
    return true;
  });
});

test('it is named anchorAt, NOT at - two test files already own that name', () => {
  // `myteamsonce.test.mjs` and `primewindow.test.mjs` each define a local `at(sport, time)` fixture
  // builder. A shared helper called `at` is a collision waiting for one of them to add an import,
  // and it also makes the anchor unfindable by tooling - the mutation probe reported seven fixture
  // timestamps as source anchors before the rename.
  const m = src('test/region.mjs');
  assert.match(m, /export function anchorAt\(/);
  assert.doesNotMatch(m, /export function at\(/);
  for (const f of ['test/myteamsonce.test.mjs', 'test/primewindow.test.mjs']) {
    assert.match(src(f), /const at = /, `${f} still owns its own at()`);
  }
});

test('every test file that slices source text goes through this helper', () => {
  // RULE 32: enumerate the renderers, do not sample one. The six that were wrong were found by
  // deleting anchors and running the suite; this keeps a SEVENTH from being written the old way.
  //
  // The legal remaining uses of a bare `indexOf` are the ones that cannot fall through: a bounded
  // search inside an already-anchored region, an `> 0` guard that fails on -1, and a loop that
  // tests `!== -1` explicitly. What is banned is the shape that silently changes what is measured.
  const dir = join(HERE);
  const offenders = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.test.mjs'))) {
    const t = readFileSync(join(dir, f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // `x.slice(x.indexOf(...))` and `x.slice(x.indexOf(...), x.indexOf(...))` are the two shapes
    // that widen or empty silently. Anything reached through region/after/anchorAt is fine.
    for (const m of t.matchAll(/\.slice\(\s*[A-Za-z0-9_]+\.indexOf\(/g)) offenders.push(`${f}: ${m[0]}`);
    for (const m of t.matchAll(/\.slice\(\s*0\s*,\s*[A-Za-z0-9_]+\.indexOf\(/g)) offenders.push(`${f}: ${m[0]}`);
  }
  assert.deepEqual(offenders, [],
    'use region()/after() from test/region.mjs - a bare anchored slice cannot fail when its anchor goes');
});
