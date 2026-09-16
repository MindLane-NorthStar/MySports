// The auto-scroll's PURE half - the decisions, with no React and no DOM writes.
//
// IT LIVES HERE SO IT CAN BE TESTED. `components/AutoScroll.js` imports `next/navigation`, which
// does not resolve under a bare `node --test` run, so anything defined beside the effect can only be
// reached by reading the component's source as text. `web/test/autoscroll.test.mjs` was doing
// exactly that, and carrying its own copy of `scrollTargetFor` next to a comment admitting the copy
// could drift. Prompt 68 needed the arrival rule pinned properly, so the whole pure half moved out.
// `lib/headerstate.js` is the same shape and the same reason.

// ONE NAME FOR THE SENTINEL, from the module that owns it. `lib/headerstate.js` exports the id the
// page renders and the observer watches; the release policy at the foot of this file has to find the
// same element, and a second copy of that string is a second thing to get wrong.
import { SENTINEL_ID } from './headerstate.js';

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

/* ---------------------------------------------------------------------------------------------
 * THE FIRST SCROLL AFTER A LANDING HAD NOTHING TO COLLAPSE IT (prompt 101 block A, Joe 2026-09-15).
 *
 * Joe: "you scroll down and the banner disappears, scroll up and the banner is still there, scroll
 * down again and THEN the banner disappears and navbar appears." And, which named the cause: "I
 * can't scroll down on initial open because the DAY / All Games / List view today is so short
 * there's no scrolldown to perform. When I immediately shift to week and scroll down, there is no
 * navbar popup."
 *
 * WHY IT HAPPENS, and it is not a regression: an IntersectionObserver reports CROSSINGS, not
 * positions. The landing carries the page past the sentinel (~1050 in week/all games/list, against a
 * sentinel near 340) while `suppressScrollCollapse()` is in force, so that crossing is delivered and
 * swallowed. The observer's state then SITS at "not intersecting". The reader's first scroll down
 * crosses nothing, so no callback exists to fire; scrolling back up re-intersects and the machine is
 * one-way; the second scroll down is the first real crossing. components/CollapsedHeader.js's
 * observer note has described this since prompt 71 and treated it as acceptable. Joe's ruling is
 * that it is not.
 *
 * WHAT THIS DOES NOT DO. It adds a collapse path and never an expand path, so lib/headerstate.js's
 * promise - "SCROLL ONLY EVER COLLAPSES ... if one is ever added, this file's whole promise is
 * void" - is intact. And it is INERT wherever the observer still works: when the sentinel is on
 * screen the crossing is still to come and the observer owns it, so prompts 71 and 73 cannot
 * regress through here.
 */

/**
 * The policy for a pin release that is ALSO the reader's first collapse.
 *
 * `collapse` IS INJECTED rather than imported, for two reasons. The first is the one this repo has a
 * test for: components/AutoScroll.js must contain no call to `collapseHeader`, because prompt 71's
 * ruling is that THE LANDING never collapses the header - so the component passes the function and
 * never invokes it, and that guard keeps its full force. The second is that an injected function is
 * a function a test can watch, which is what makes both halves of this predicate assertable without
 * a browser.
 *
 * @param {Document} doc
 * @param {() => void} collapse   headerstate.js's `collapseHeader`, passed by reference
 * @returns {(downward: boolean) => boolean} whether this release also collapsed the header
 */
export function pinReleaseCollapse(doc, collapse) {
  return (downward) => {
    // DIRECTION FIRST. The natural gesture after a landing is a scroll back UP to see the banner the
    // pin just kept on the screen; collapsing on that would take it away in the reader's face.
    if (!downward) return false;
    const el = doc && typeof doc.getElementById === 'function' ? doc.getElementById(SENTINEL_ID) : null;
    if (!el) return false;
    // AND THE SENTINEL MUST ALREADY BE ABOVE THE VIEWPORT, which is the proof that the observer
    // cannot do this job for this scroll: its crossing was spent during the landing. While the
    // sentinel is on screen this returns false and the observer collapses as it always has.
    if (el.getBoundingClientRect().top >= 0) return false;
    collapse();
    return true;
  };
}

/**
 * THE WORDMARK'S EXPAND RE-ARMS THE PIN (prompt 101 block B, provisional - see register §50).
 *
 * A transition detector rather than a handler: `subscribeHeader` notifies on every change, and only
 * COLLAPSED -> EXPANDED is the wordmark restoring the banner. A collapse must not arm anything.
 *
 * This is Joe's prompt-73 ruling reaching one more entry point - "make banner STICKY until the user
 * scrolls" - and not the design lib/bannerpin.js records as rejected: the banner still travels, the
 * release still fires on the reader's next scroll, the sentinel still crosses, and the height
 * arithmetic is untouched.
 *
 * @param {() => boolean} isCollapsed   headerstate.js's `headerCollapsed`
 * @param {() => void} onExpand         run once per collapsed -> expanded transition
 * @returns {() => void} the subscriber
 */
export function pinRearmOnExpand(isCollapsed, onExpand) {
  let was = isCollapsed();
  return () => {
    const now = isCollapsed();
    const expanded = was && !now;
    was = now;
    if (expanded) onExpand();
  };
}
