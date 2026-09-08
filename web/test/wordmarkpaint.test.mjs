// THE WORDMARK'S PAINT CONTRACT (prompt 63 stage 1).
//
// Joe, from his phone: MYSPORTS TV was invisible in the navbar. The box was still there - the
// toggles were still pushed right by it - so every measurement prompt 61 stage 5b took passed:
// button top 0, height 44, widths unmoved. A box cannot see a paint failure.
//
// THE CAUSE. `.chdr-wm` carried `background-image` + `background-clip: text` + `color: transparent`.
// Prompt 61 stage 5b moved the text into a child span for an optical offset and left the paint on
// the button. `background-clip: text` clips an element's background to GLYPHS; the button had none
// of its own left, and the span inherited `color: transparent` and painted nothing.
//
// AND CHROMIUM DOES NOT REPRODUCE IT. Measured at DPR 4 on 2026-09-08, the broken build still put
// gold in the wordmark's box - #cab480, #c9b37f, #c2ab77 - because Chromium clips a parent's
// `background-clip: text` to its DESCENDANTS' glyphs. WebKit does not. So every browser gate in
// this repo was green while the wordmark was invisible on the only device that matters.
//
// THAT IS WHY THIS IS A CONTRACT TEST ON THE DECLARATIONS. A pixel test would have passed. A box
// test did pass. The only thing that catches it is the rule itself: whatever element carries
// `background-clip: text` must also carry the background it is clipping AND the transparent colour,
// and must be the element that actually holds the text.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');

/** Every rule block in the stylesheet, comments stripped, as { selector, body }. */
function rules(css) {
  const out = [];
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    out.push({ selector: m[1].trim().replace(/\s+/g, ' '), body: m[2] });
  }
  return out;
}

test('every background-clip: text carries its own gradient and transparent colour', () => {
  // Stated as a property of the WHOLE stylesheet rather than of `.chdr-wm-ink`, so a future element
  // that fills type with a gradient inherits the guard instead of repeating the bug.
  const all = rules(src('app/globals.css'));
  const clippers = all.filter((r) => /background-clip:\s*text/.test(r.body));
  assert.ok(clippers.length > 0, 'no background-clip: text found - this test would pass vacuously');
  for (const r of clippers) {
    assert.match(r.body, /background-image:/,
      `${r.selector} clips a background to text but declares no background to clip`);
    assert.match(r.body, /color:\s*transparent/,
      `${r.selector} clips to text but does not make the glyphs transparent`);
    // -webkit- prefixed alongside the standard one: WebKit is the engine that needs it and the
    // engine this bug only showed on.
    assert.match(r.body, /-webkit-background-clip:\s*text/, `${r.selector} needs the prefixed form`);
  }
});

test('the wordmark gradient is on the element that HOLDS the text, not its parent', () => {
  const css = src('app/globals.css');
  const jsx = src('components/CollapsedHeader.js');

  // Which class wraps the literal text?
  const m = jsx.match(/<span className="([\w-]+)">MYSPORTS TV<\/span>/);
  assert.ok(m, 'the wordmark text is in a span with a class - if that changed, so must this test');
  const inkClass = m[1];

  const all = rules(css);
  const ink = all.find((r) => r.selector === `.${inkClass}` && /background-clip/.test(r.body));
  assert.ok(ink, `.${inkClass} holds the text, so it must be the element carrying the clip`);

  // AND THE PARENT MUST NOT still be trying to do it - that is the exact broken state.
  const btn = all.find((r) => r.selector === '.chdr-wm');
  assert.ok(btn, '.chdr-wm was located');
  assert.doesNotMatch(btn.body, /background-clip/,
    '.chdr-wm no longer holds the text, so clipping to its own glyphs paints nothing');
  // ANCHORED TO A PROPERTY BOUNDARY. `/color:\s*transparent/` unanchored matches the substring
  // inside `background-color: transparent`, which the button legitimately keeps - the first version
  // of this guard failed on a correct stylesheet for exactly that reason.
  assert.doesNotMatch(btn.body, /(^|[;{\s])color:\s*transparent/,
    'transparent on the button would inherit down and blank the span again');
  // `background-color: transparent` STAYS - it is the button reset, and `background: none` would
  // take a future gradient with it. The distinction is the button's own comment.
  assert.match(btn.body, /background-color:\s*transparent/);
});
