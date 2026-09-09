// A SLICE OF SOURCE THAT CANNOT SILENTLY BECOME THE WRONG SLICE.
//
// WHY THIS EXISTS. Prompt 71 deleted `collapseHeader();` from components/AutoScroll.js and
// autoscroll.test.mjs kept passing, because it asserted
//
//     assert.ok(c.indexOf('collapseHeader();') < c.indexOf('requestAnimationFrame'), ...)
//
// and `indexOf` returns -1 when it misses. -1 is less than every real index, so the assertion held
// for the one reason it existed to rule out. Prompt 73 found it; prompt 74 swept the suite and
// found SIX more of the same family - not the ordering shape, but the REGION shape:
//
//     const head = g.slice(g.indexOf('dpanel-head'), g.indexOf('dpanel-close'));
//
// If the first anchor goes, `slice(-1, j)` is empty or one character and every `doesNotMatch` over
// it passes trivially. If the SECOND goes, `slice(i, -1)` is the rest of the file, and a test that
// said "within the panel head" is quietly asserting "somewhere in this component" instead. Neither
// fails. Both stop being the test that was written.
//
// IT IS THE SAME RULING AS scripts/probes/landmark.mjs, which throws when a probe's landmark is
// missing: "A tool that answers after its landmark disappears is worse than one that stops, because
// the answer still looks like a measurement." A test is the same thing with a pass/fail bit on it.
//
// `web/scripts/probes/test-mutation.mjs` is what proves these hold: it deletes each anchor from a
// copy of the tree and runs the suite, and a test that still passes is reported. Run it after adding
// any assertion that reads source text.

/** @param {string} what - what the caller was looking for, for the failure message */
function need(source, anchor, from, what) {
  const at = source.indexOf(anchor, from);
  if (at === -1) {
    throw new Error(
      `region anchor not found: ${JSON.stringify(anchor)} - ${what}. The region this assertion is `
      + 'defined against is gone. Fix the anchor or delete the assertion; do not let it silently '
      + 'widen to the whole file or collapse to nothing.');
  }
  return at;
}

/**
 * The text between two anchors, INCLUDING the first and excluding the second.
 *
 * Throws if either anchor is missing, which is the whole point - a missing anchor is a fact about
 * the source, and it should stop the test rather than change what the test means.
 */
export function region(source, startAnchor, endAnchor, what = 'the region under test') {
  const a = need(source, startAnchor, 0, what);
  const b = need(source, endAnchor, a, `${what} - the closing anchor after ${JSON.stringify(startAnchor)}`);
  return source.slice(a, b);
}

/** Everything from an anchor to the end of the file. Throws if the anchor is missing. */
export function after(source, startAnchor, what = 'the region under test') {
  return source.slice(need(source, startAnchor, 0, what));
}

/**
 * Everything BEFORE an anchor. Throws if the anchor is missing.
 *
 * The one that reads most innocently and fails worst: `s.slice(0, s.indexOf(gone))` is
 * `s.slice(0, -1)` - the whole file bar its last character - so "the rules outside the phone
 * breakpoint" silently becomes "every rule in the stylesheet, phone ones included".
 */
export function before(source, endAnchor, what = 'the region under test') {
  return source.slice(0, need(source, endAnchor, 0, what));
}

/**
 * The index of an anchor, for the ordering assertions that compare two positions.
 *
 * `assert.ok(a < b)` is unsound when either can be -1; `assert.ok(anchorAt(s, x) < anchorAt(s, y))`
 * cannot be, because a miss throws before the comparison happens.
 *
 * `anchorAt`, NOT `at`. Two test files already define a local helper called `at()` that builds a
 * fixture row - myteamsonce.test.mjs and primewindow.test.mjs - and a shared helper with the same
 * name is a collision waiting for the day one of them adds an import. It also makes the anchor
 * unfindable by tooling: scripts/probes/test-mutation.mjs reported seven fixture timestamps as
 * source anchors on its first run because `at(` matched both.
 */
export function anchorAt(source, anchor, what = 'an ordering assertion') {
  return need(source, anchor, 0, what);
}
