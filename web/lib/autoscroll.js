// The auto-scroll's PURE half - the decisions, with no React and no DOM writes.
//
// IT LIVES HERE SO IT CAN BE TESTED. `components/AutoScroll.js` imports `next/navigation`, which
// does not resolve under a bare `node --test` run, so anything defined beside the effect can only be
// reached by reading the component's source as text. `web/test/autoscroll.test.mjs` was doing
// exactly that, and carrying its own copy of `scrollTargetFor` next to a comment admitting the copy
// could drift. Prompt 68 needed the arrival rule pinned properly, so the whole pure half moved out.
// `lib/headerstate.js` is the same shape and the same reason.

/**
 * Breathing room between the sticky stack's lower edge and whatever the scroll lands on.
 *
 * EIGHT WAS THE WRONG STEP (prompt 68, Joe 2026-09-08): "Below the gold line that rests below the
 * picker, the league logo is super tight to the gold line. There's no buffer above the league logo
 * and beneath the gold line." In day mode the target is `#all-today` and the first thing inside it
 * is the band header row carrying `.band-mark`, so 8px put a league logo 8px under the gold rule.
 *
 * 8px is the type scale's INSIDE-ONE-GROUP step (prompt 56 §24d). What this actually does is seat a
 * new section under a rule, which is the heading-to-content step, 16px at minimum.
 */
export const SCROLL_GAP = 16;

/**
 * After the collapse commits: long enough for the reflow.
 *
 * IT USED TO SAY "and the `--stack-h` ResizeObserver", AND IT NO LONGER HAS TO (prompt 74). The
 * clearance below reads the boxes rather than that custom property, so a landing no longer waits on
 * an observer having fired. The REFLOW is still real and still needs this beat - React commits, and
 * prompt 62's split reparents `.pickrow` out of `.hubctl`.
 */
export const SETTLE_MS = 120;

/** After the smooth scroll: long enough for it to have finished, since Safari has no `scrollend`. */
export const CORRECT_MS = 600;

/**
 * The three boxes that can hold the top of the viewport, in the order they stack.
 *
 * A LIST RATHER THAN A CHAIN OF SPECIAL CASES, because the states multiply: the header is expanded
 * or collapsed, the banner is pinned or released, and the league row is open or closed. That is
 * already six combinations for three elements, and prompt 73's clearance got one of them wrong.
 */
export const TOP_STACK = ['.chdr', '.pickrow', '.banner'];

/** The positions that hold an element against the top of the viewport while the page scrolls. */
const HELD = new Set(['sticky', 'fixed']);

/**
 * How much of the viewport's top edge this element will hold, or 0.
 *
 * STUCK-NESS IS READ FROM THE COMPUTED `position`, NOT FROM `data-hdr` OR `data-pin`. Those two
 * attributes are what the STYLESHEET switches on; asking the element what it resolved to asks the
 * only authority there is, and it stays right when a third state is added. Every one of the three
 * is `static`/`relative` in at least one state and `sticky` in another, and each is switched by a
 * different rule - `.chdr` and `.pickrow` by `html[data-hdr='collapsed']`, `.banner` by
 * `html[data-pin='banner']` - so no single attribute could answer for all three anyway.
 *
 * A HIDDEN ELEMENT ANSWERS ITSELF. `.chdr` is `position: sticky` unconditionally and `display: none`
 * while the header is expanded, so its box measures 0 and it contributes nothing without a second
 * check. The same is true of `.banner` while the header is collapsed.
 *
 * ALL THREE ARE TOP-ANCHORED, which is why the position alone is enough. The grid's `.mrail-cell` is
 * sticky at `left: 0` and holds no part of the TOP edge - it is not in the list above, and if a
 * side-anchored element is ever added to it this needs to learn about `top` as well.
 */
export function heldHeight(doc, selector) {
  const el = doc.querySelector(selector);
  if (!el || typeof el.getBoundingClientRect !== 'function') return 0;
  const view = doc.defaultView || (typeof window === 'undefined' ? null : window);
  if (!view || typeof view.getComputedStyle !== 'function') return 0;
  if (!HELD.has(view.getComputedStyle(el).position)) return 0;
  return el.getBoundingClientRect().height || 0;
}

/**
 * The bottom edge of everything that is stuck to the top of the viewport.
 *
 * MEASURED, NOT DERIVED. `getBoundingClientRect().bottom` would be circular - that value depends on
 * the scroll position this is being used to compute - so each element's HEIGHT is summed instead,
 * which is the same number for a stack that starts at 0 and does not depend on where the page is.
 *
 * IT USED TO COUNT `.pickrow` UNCONDITIONALLY AND THAT WAS A BUG (prompt 74). The picker only sticks
 * while the header is COLLAPSED; expanded it is an ordinary child of `.hubctl` and scrolls away with
 * everything else. Since prompt 71 every landing happens with the header EXPANDED, so the clearance
 * was reserving 31.4px for an obstruction that was not there, and prompt 73's pinned banner turned
 * that reservation into 47px of the PREVIOUS day's card showing between the banner's gold rule and
 * today's heading.
 *
 * THE NUMBER IT RESTORES IS JOE'S OWN. With the banner pinned the clearance is 124 + `SCROLL_GAP`,
 * and that 16px is the buffer he ruled in prompt 69 after reporting the league logo "super tight to
 * the gold line" - the same 16px `html[data-hdr='collapsed'] .pickrow` carries as `margin-block`.
 * The extra 31.4 was not a decision anybody made; it was a term that outlived the collapse that used
 * to justify it.
 *
 * `--stack-h` IS NO LONGER READ HERE, and losing it is a gain rather than a loss. It is written from
 * `.chdr`'s box by a ResizeObserver in components/CollapsedHeader.js and is exactly what measuring
 * `.chdr` gives, so the indirection bought nothing - while its `BAR_FALLBACK` could contribute a
 * whole 44px bar in a state where the bar is not on the screen at all, and reading it made the
 * landing depend on an observer having run. The property itself is untouched and still does its one
 * job: the offset `.pickrow` sticks at.
 */
export function stackBottom(doc = document) {
  return TOP_STACK.reduce((sum, sel) => sum + heldHeight(doc, sel), 0);
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
