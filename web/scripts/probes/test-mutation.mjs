// A TEST THAT PASSES WHEN ITS ANCHOR IS GONE IS NOT A TEST. This is what finds those.
//
// WHY IT EXISTS. Prompt 71 deleted `collapseHeader();` from components/AutoScroll.js and
// autoscroll.test.mjs kept passing, because it asserted
//
//     assert.ok(c.indexOf('collapseHeader();') < c.indexOf('requestAnimationFrame'), ...)
//
// and `indexOf` returns -1 on a miss. -1 is less than every real index, so the assertion held for
// the one reason it existed to rule out - and its guard, `c.indexOf('collapseHeader()')`, matched the
// string inside the COMMENT explaining the deletion. Prompt 73 found it by reading the file, which
// is not a control. This is the control.
//
// It is the same ruling as `landmark.mjs` one directory up, which throws when a probe's landmark is
// missing: "A tool that answers after its landmark disappears is worse than one that stops, because
// the answer still looks like a measurement." A test is that with a pass/fail bit on it.
//
//     node scripts/probes/test-mutation.mjs              # sweep web/test
//     node scripts/probes/test-mutation.mjs --selfcheck  # prove it finds prompt 71's defect
//     node scripts/probes/test-mutation.mjs foo.test.mjs # one file
//
// TWO QUESTIONS, and only the second needs a subprocess:
//
//   A. is the anchor CURRENTLY absent, or present only inside a comment?   - a text scan
//   B. would the assertion still PASS if the anchor went absent?           - delete it and run
//
// B WORKS ON A COPY. The repo is never written to: `lib`, `app`, `components`, `scripts` and `test`
// are copied to a scratch directory and the copy is mutated. An earlier attempt patched
// `readFileSync` from an `--import` hook and changed nothing - the suite does
// `import { readFileSync } from 'node:fs'`, and a builtin's ESM named exports are not live-bound to
// later writes on the CJS object. All 41 mutations "survived" and the tool was reporting on itself.
import { readFileSync, readdirSync, cpSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** Undo the escapes a JS single-quoted literal can carry, so an anchor with a newline is comparable. */
function unescape(x) {
  let out = '';
  for (let i = 0; i < x.length; i += 1) {
    if (x[i] !== '\\') { out += x[i]; continue; }
    i += 1;
    const c = x[i];
    if (c === 'n') out += '\n';
    else if (c === 't') out += '\t';
    else if (c === 'r') out += '\r';
    else out += c;
  }
  return out;
}

/**
 * Every source-text anchor a test file uses.
 *
 * BOTH SHAPES, and the second is here so COVERAGE CANNOT FALL SILENTLY. Fixing a site replaces
 * `x.indexOf('anchor')` with `region(x, 'anchor', ...)` from test/region.mjs, and an extractor that
 * knew only the first would check fewer anchors after the fix than before it - a sweep going green
 * by looking at less, which is the same defect one level up. `region`/`after`/`at` throw on a miss
 * by construction, so they are expected to fail the mutation; checking them is what proves it.
 *
 * The word boundary is load-bearing: without it `at\(` matches inside `concat(`, `repeat(` and
 * `formatAt(`, and the sweep reports anchors that are not anchors.
 */
export function anchorsOf(testSource) {
  const t = strip(testSource);          // the TEST's own comments, so prose about a deletion is not
  const found = [];                     // mistaken for the assertion that was deleted
  for (const m of t.matchAll(/\.(?:indexOf|lastIndexOf)\(\s*'([^']*)'/g)) found.push(m[1]);
  // SPLIT BY ARITY, because the helpers differ: `region(src, start, end, what)` carries TWO anchors
  // and `after(src, anchor, what)` / `anchorAt(src, anchor, what)` carry one followed by a human
  // label. Reading the label as an anchor is how the first run reported "the bounded lookup" as
  // missing from the source - it is a failure message, not a needle.
  //
  // AND ONLY IN FILES THAT IMPORT THE HELPER. `myteamsonce.test.mjs` and `primewindow.test.mjs`
  // define their own local `at(sport, time)` fixture builder, and matching it turned seven fixture
  // timestamps into phantom anchors. The helper was renamed `anchorAt` for the same collision, and
  // this gate is the belt to that brace.
  if (/from '\.\/region\.mjs'/.test(t)) {
    for (const m of t.matchAll(/\bregion\(\s*[^,]+,\s*'([^']*)'\s*,\s*'([^']*)'/g)) {
      found.push(m[1], m[2]);
    }
    for (const m of t.matchAll(/\b(?:after|anchorAt)\(\s*[^,]+,\s*'([^']*)'/g)) found.push(m[1]);
  }
  return [...new Set(found.map(unescape).filter((n) => n.length >= 3))];
}

/** Question A, over one test file's anchors and the sources it reads. */
export function textScan(testSource, sources) {
  const raw = sources.join('\n');
  const bare = strip(raw);
  const out = [];
  for (const n of anchorsOf(testSource)) {
    if (!raw.includes(n)) out.push({ kind: 'DEAD', needle: n });
    else if (!bare.includes(n)) out.push({ kind: 'COMMENT-ONLY', needle: n });
  }
  return out;
}

if (process.argv.includes('--selfcheck')) {
  // PROMPT 71'S DEFECT, reconstructed. A scan that cannot find both halves of it is not evidence.
  const fakeTest = "import { region } from './region.mjs';\n"
    + "const i = c.indexOf('collapseHeader();');\n"
    + "const j = c.indexOf('collapseHeader()');\n"
    + "const k = c.indexOf('suppressScrollCollapse();');\n"
    + "const r = region(c, 'export function land', 'return null', 'the landing');\n"
    + "const q = at('mlb', '2026-09-06T17:40:00Z');\n";   // a LOCAL helper, not this one
  const fakeSource = '// This used to call collapseHeader() first and deliberately.\n'
    + 'suppressScrollCollapse();\nexport function land\nreturn null\n';
  const found = textScan(fakeTest, [fakeSource]);
  for (const h of found) console.log(`  ${h.kind.padEnd(13)} ${JSON.stringify(h.needle)}`);
  const kinds = found.map((h) => h.kind).sort().join(',');
  const anchors = anchorsOf(fakeTest);
  const sawRegion = anchors.includes('export function land') && anchors.includes('return null')
    && !anchors.includes('the landing')                    // the LABEL is not an anchor
    && !anchors.includes('2026-09-06T17:40:00Z');          // nor a local at() fixture's argument
  const ok = kinds === 'COMMENT-ONLY,DEAD' && sawRegion;
  console.log(`\n  ${anchors.length} anchors extracted, region()/after()/anchorAt() ${sawRegion ? 'covered' : 'MISSED'}`);
  console.log(`  selfcheck ${ok ? 'PASS' : 'FAIL'} - expected one DEAD and one COMMENT-ONLY, got: ${kinds || '(none)'}`);
  process.exit(ok ? 0 : 1);
}

// THE FILES A TEST CAN READ. The test files themselves are deliberately NOT mutated, or deleting an
// anchor would delete the assertion along with it.
const TREE = ['lib', 'app', 'components', 'scripts'];
const listFiles = (root, dir, acc = []) => {
  for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
    const rel = join(dir, e.name);
    if (e.isDirectory()) listFiles(root, rel, acc);
    else if (/\.(js|jsx|mjs|css|json)$/.test(e.name)) acc.push(rel);
  }
  return acc;
};
const readOr = (p) => { try { return readFileSync(p, 'utf8'); } catch { return null; } };

/**
 * The one file this cannot speak about, and the exemption is about DOMAIN rather than difficulty.
 *
 * `region.test.mjs` is the unit test OF test/region.mjs, so its anchors point at a fixture string
 * declared inside the test - `const SAMPLE = 'alpha\nBEGIN\nmiddle\nEND\nomega\n'` - and not at any
 * repo source. Deleting "END" from fifteen real source files therefore proves nothing about it, and
 * reporting that as a survivor is the tool measuring something it was not pointed at. Test files are
 * never mutated by design (deleting an anchor would delete the assertion with it), which is exactly
 * why an in-test fixture is out of range.
 *
 * This is not the guard being softened. That file's assertions are the STRONGEST in the sweep: every
 * one of them calls the helper with a missing anchor and requires it to throw.
 */
const NOT_SOURCE_ANCHORED = new Set(['region.test.mjs']);

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const files = (only.length ? only : readdirSync('test').filter((f) => f.endsWith('.test.mjs')))
  .filter((f) => !NOT_SOURCE_ANCHORED.has(f));

const scratch = mkdtempSync(join(tmpdir(), 'mutation-'));
const problems = [];
let runs = 0;
try {
  for (const d of [...TREE, 'test']) cpSync(d, join(scratch, d), { recursive: true });
  const targets = TREE.flatMap((d) => listFiles(scratch, d));
  const pristine = new Map(targets.map((p) => [p, readFileSync(join(scratch, p), 'utf8')]));

  for (const f of files) {
    const testSource = readFileSync(join('test', f), 'utf8');
    // question A, against every source this test reads
    const reads = [...testSource.matchAll(/(?:src|code|css|read|readSrc)\(\s*'([^']+)'\s*\)/g)]
      .map((m) => m[1]);
    const bodies = [...new Set(reads)].map((r) => readOr(r)).filter(Boolean);
    if (bodies.length) {
      for (const h of textScan(testSource, bodies)) {
        problems.push({ f, ...h });
        console.log(`  ${h.kind.padEnd(13)} ${f}: ${JSON.stringify(h.needle)}`);
      }
    }
    // question B
    for (const n of anchorsOf(testSource)) {
      runs += 1;
      let touched = 0;
      for (const [p, body] of pristine) {
        if (!body.includes(n)) continue;
        touched += 1;
        writeFileSync(join(scratch, p), body.split(n).join(''), 'utf8');
      }
      const r = touched
        ? spawnSync(process.execPath, ['--test', join('test', f)], { cwd: scratch, encoding: 'utf8' })
        : null;
      for (const [p, body] of pristine) writeFileSync(join(scratch, p), body, 'utf8');
      if (r && r.status === 0) {
        problems.push({ f, kind: 'SURVIVES', needle: n });
        console.log(`  SURVIVES      ${f}: deleting ${JSON.stringify(n)} from ${touched} file(s) does not fail it`);
      }
    }
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
console.log(`\n${runs} mutations over ${files.length} test files, ${problems.length} problem(s).`);
process.exit(problems.length ? 1 : 0);
