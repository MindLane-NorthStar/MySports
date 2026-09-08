// The auto-scroll's PURE half - the decisions, with no React and no DOM writes.
//
// IT LIVES HERE SO IT CAN BE TESTED. `components/AutoScroll.js` imports `next/navigation`, which
// does not resolve under a bare `node --test` run, so anything defined beside the effect can only be
// reached by reading the component's source as text. `web/test/autoscroll.test.mjs` was doing
// exactly that, and carrying its own copy of `scrollTargetFor` next to a comment admitting the copy
// could drift. Prompt 68 needed the arrival rule pinned properly, so the whole pure half moved out.
// `lib/headerstate.js` is the same shape and the same reason.

/** Breathing room between the sticky stack and the thing scrolled to. */
export const SCROLL_GAP = 8;

/** The fallback if `--stack-h` has not been written yet - the bar's collapsed height. */
const BAR_FALLBACK = 44;

/** After the collapse commits: long enough for the reflow and the `--stack-h` ResizeObserver. */
export const SETTLE_MS = 120;

/** After the smooth scroll: long enough for it to have finished, since Safari has no `scrollend`. */
export const CORRECT_MS = 600;

/**
 * The bottom edge of everything that is stuck to the top of the viewport.
 *
 * Read rather than derived: `.pickrow` sticks AT `--stack-h`, so once the page is scrolled its
 * bottom is exactly the bar plus its own height. Measuring its `getBoundingClientRect().bottom`
 * directly would be circular - that value depends on the scroll position this is being used to
 * compute.
 */
export function stackBottom(doc = document) {
  const raw = getComputedStyle(doc.documentElement).getPropertyValue('--stack-h');
  const bar = Number.parseFloat(raw);
  const pick = doc.querySelector('.pickrow');
  return (Number.isFinite(bar) ? bar : BAR_FALLBACK)
    + (pick ? pick.getBoundingClientRect().height : 0);
}

/**
 * Where the page should be scrolled to, or null if it should not be scrolled at all.
 *
 * Exported and pure-ish so `web/test/autoscroll.test.mjs` can drive it over a fake document rather
 * than asserting that a browser did something.
 */
export function scrollTargetFor(doc = document) {
  const today = doc.querySelector('[data-istoday="true"]');
  if (!today) return null;                       // a week without today, or a day that is not today
  return today.querySelector('.mcard[data-live="1"]') || today;
}

/**
 * Whether this trigger may scroll, and the entry state it leaves behind. PURE - state in, state out.
 *
 * Exported and pure so the five rows of the arrival rule can be pinned directly in
 * `web/test/autoscroll.test.mjs` rather than inferred from the component's source text. The effect
 * below and the `visibilitychange` handler BOTH go through it; the handler consulting the same
 * state is the entire point of the rule and the easy half to forget.
 *
 * @param {{arrivalKey: string|null, navigated: boolean}} state
 * @param {'entry'|'return'} trigger  a mount or route change, or a return from the background
 * @param {string|null} key           the current view key; meaningless for 'return'
 * @returns {{scroll: boolean, state: {arrivalKey: string|null, navigated: boolean}}}
 */
export function decideScroll(state, trigger, key) {
  // A RETURN NEVER PROMOTES. Coming back from the background is not navigating, so it can only act
  // on a navigation that already happened - which is what keeps a PWA's ordinary open silent.
  if (trigger === 'return') return { scroll: state.navigated, state };

  // THE FIRST ENTRY IN THIS DOCUMENT IS THE ARRIVAL. Record the key and scroll nothing.
  if (state.arrivalKey === null) {
    return { scroll: false, state: { arrivalKey: key, navigated: false } };
  }

  // Any entry on a DIFFERENT key is a navigation. `navigated` is sticky rather than a key compare,
  // so day A -> day B -> day A still scrolls on the way back: the reader has been navigating, and
  // arriving at the key they started on does not undo that.
  const navigated = state.navigated || key !== state.arrivalKey;
  return { scroll: navigated, state: { arrivalKey: state.arrivalKey, navigated } };
}
