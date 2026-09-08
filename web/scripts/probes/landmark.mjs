// A probe that cannot find its landmark must FAIL, not keep printing numbers.
//
// WHY THIS EXISTS. `web/qa/tools/s0-gaps.mjs` and `s3-spacing.mjs` both opened with
//
//     document.querySelector('.fband') || document.querySelector('.today-split')
//
// and `.fband` was deleted with the TONIGHT band in prompt 67. For two prompts the leading selector
// matched nothing, the `||` swallowed it, and both probes went on reporting a "picker to content"
// gap. They were RIGHT by luck - `.today-split` is the element that measurement wanted anyway - but
// nothing in the run could have told the difference between a correct fallback and a silent one.
// Prompt 69 found it by reading the file, which is not a control.
//
// A probe's numbers get quoted into handoff-status.md and into contracts. A tool that answers after
// its landmark disappears is worse than one that stops, because the answer still looks like a
// measurement.
//
// IT IS INJECTED, NOT IMPORTED, and that is forced by where it runs. The lookups happen inside
// `page.evaluate()`, which is the BROWSER's realm - a module imported here is not in scope there.
// So the single definition is a source string, `addInitScript` puts it on `window` before any page
// script runs, and both probes call the same `window.__landmark`. One definition, no inlined copies,
// which is the whole point: two copies of a guard drift exactly like two copies of a probe.

/** The one definition. Injected into the page; never edited into a probe. */
export const LANDMARK_SOURCE = `
window.__landmark = function (selector) {
  const el = document.querySelector(selector);
  if (!el) {
    throw new Error(
      'probe landmark not found: ' + selector +
      ' - the element this measurement is defined against is gone. Fix the selector or delete the ' +
      'measurement; do not let it fall through to another element.'
    );
  }
  return el;
};
window.__optional = function (selector) {
  return document.querySelector(selector);
};
`;

/**
 * Define `window.__landmark` and `window.__optional` in the page.
 *
 * `addInitScript` rather than a one-off `evaluate`: it re-runs on every navigation, so a probe that
 * clicks through to another view keeps the guard instead of losing it at the first route change.
 */
export async function installLandmark(page) {
  await page.addInitScript(LANDMARK_SOURCE);
}

/**
 * The base URL a probe measures against.
 *
 * DEFAULTS TO 3000, WHICH IS WHAT `npm run dev` SERVES. Both promoted probes were written against
 * `http://localhost:3100` hardcoded, a port nothing in this repo starts - so neither could be run
 * from a clone without editing it first. That is half of what "untracked tool" cost: not only was
 * the file missing, the file that existed did not run.
 */
export function probeBase(argv = process.argv) {
  return argv[2] || process.env.PROBE_BASE || 'http://localhost:3000';
}
