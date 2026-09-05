// Contract v1.6.14: the grid's name·record run — the separator, and all-zero records.
//
// MobileGrid.js is a client component with hooks and a canvas measurer, so it cannot be mounted
// under `node --test`. What decides both halves of this ruling IS extractable, though: allZeroRecord
// is a pure function, and the separator is a property of the source that a regex can pin. Both are
// asserted here rather than trusted to a screenshot.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(HERE, '..', 'components/MobileGrid.js'), 'utf8');

// Lift the pure helper out of the client component rather than exporting it just for the test.
const allZeroRecord = new Function(
  `${src.match(/function allZeroRecord\(rec\)[\s\S]*?\n}/)[0]}; return allZeroRecord;`,
)();

test('an all-zero record is absent, at every arity', () => {
  for (const r of ['0-0', '0-0-0', '0-0-0-0', ' 0-0 ']) {
    assert.equal(allZeroRecord(r), true, `${r} must be treated as no record`);
  }
});

test('a real record survives, and so does anything unparseable', () => {
  for (const r of ['64-75', '0-1', '1-0', '10-0', '0-0-1']) {
    assert.equal(allZeroRecord(r), false, `${r} is a real record`);
  }
  // Not understood is NOT the same as all-zero. Suppressing these would hide real data.
  for (const r of [null, undefined, '', '0', 'TBD', '0-0-x']) {
    assert.equal(allZeroRecord(r), false, `${JSON.stringify(r)} must not be suppressed`);
  }
});

test('the fit ladder starts from "no record" for an all-zero team', () => {
  // teamLine() is what feeds the ladder; a suppressed record reaches it as null, which is the same
  // input a team with no standings row produces. Equality of those two paths is the property.
  assert.match(src, /const shownRec = allZeroRecord\(rec\) \? null : rec \|\| null;/);
});

test('a single space separates the name from the record, and it is measured where it renders', () => {
  // Rendered: a real text node in the NAME's run, not a margin - so it is exactly one space wide in
  // the font the name uses.
  assert.equal(
    (src.match(/\{' '\}\s*\n\s*<span className="mrec">/g) || []).length, 2,
    'both the away and the home row render the space',
  );
  // M2's widest-line measurement must use the same single space, or the grid sizes itself to a
  // string it never draws. It used two.
  assert.match(src, /\$\{l\.record \? ` \$\{l\.record\}` : ''\}/);
  assert.doesNotMatch(src, /`  \$\{l\.record\}`/, 'the two-space measurement is gone');
  // The per-block run measures the space at the NAME size and the record at 60%.
  assert.match(src, /piece\(' ', fs\) \+ piece\(side\.record, fs \* 0\.6\)/);
});

test('the literal-pattern test is gone from the CODE', () => {
  // Comments in this file still quote the old pattern while explaining why it went, and that history
  // is worth keeping - so the assertion runs against source with the comments removed.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\/\^0-0\(-0\)\?\$\//, 'parsed now, not matched against two shapes');
});
