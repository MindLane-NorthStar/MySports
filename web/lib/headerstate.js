// THE HEADER'S STATE MACHINE (prompt 60), and it is ONE-WAY ON PURPOSE.
//
// Joe designed this across four exchanges on 2026-09-07:
//
//   "I'd like the banner to collapse as you scroll up OR by a purposeful tap on the tv ON the
//    banner. Then the navbar that replaces it ... The navbar would take the place of the banner
//    once a user scrolls past the banner, and [it] would remain permanently in place from that
//    point forward until the user taps 'MySports TV' in which case the full banner and expanded
//    toggles would appear atop the app."
//
//   first paint                       EXPANDED - the full banner and the whole control stack
//   scrolling past the header         COLLAPSES
//   tapping the TV on the banner      COLLAPSES
//   tapping MYSPORTS TV in the bar    EXPANDS, and returns the reader to the top
//   scrolling back to the top         STAYS COLLAPSED
//
// SCROLL ONLY EVER COLLAPSES. IT NEVER EXPANDS, and that single asymmetry is what removes the
// conflict prompt 58's brief worried about: two inputs cannot fight over one state when only one of
// them can set it in each direction. Expansion is manual, and it is the only manual thing here.
// `collapseHeader` is therefore idempotent and there is deliberately no scroll path that calls
// `expandHeader` - if one is ever added, this file's whole promise is void.
//
// ---------------------------------------------------------------------------------------------
// WHY THIS IS A MODULE AND NOT REACT STATE.
//
// Three surfaces have to agree: the navbar (components/CollapsedHeader.js), the TV button drawn over
// the banner (components/BannerTap.js), and the PAGE'S OWN control stack, which is rendered by a
// SERVER component in app/page.js and can never hold client state. A React context could serve the
// first two and not the third.
//
// So the layout change is carried by ONE ATTRIBUTE ON <html> - `data-hdr="collapsed"` - and CSS does
// the hiding. That is also what makes the scroll compensation below exact: the attribute write IS
// the layout change, so it can be measured on the line after it rather than a frame later.
//
// THE HYDRATION STORY IS PROMPT 58'S, UNCHANGED. `collapsed` starts false, the server never writes
// the attribute, the first client render is byte-identical to the server's, and nothing is
// persisted - a reload starts expanded again. `getServerSnapshot` below is that promise in code.
//
// ---------------------------------------------------------------------------------------------
// THE SCROLL COMPENSATION, which is the one piece of real engineering here.
//
// Collapsing REMOVES the banner and the control stack from the flow, so every box below them moves
// up by their combined height. Left alone that is a ~340px jump under the reader's thumb, mid-scroll.
//
// The sentinel is the fixed point: it sits immediately AFTER the control stack and OUTSIDE it, so it
// survives the collapse and its viewport position is exactly what must not move. Measure it, apply
// the attribute, measure again, and scroll by the difference - the content the reader is looking at
// stays where it was, and the scroll offset absorbs the whole change.
//
// It resolves to a no-op in the two places it should: tapping the TV at the top of the page has
// nowhere to scroll back to, so the page rises by the header's height, which is what "collapse" MEANS
// and what the reader just asked for.

/** The id of the zero-height element `Controls` renders after the stack. */
export const SENTINEL_ID = 'hdr-sentinel';

/** The attribute the CSS reads. One name, in one place, so the stylesheet and this cannot drift. */
export const HDR_ATTR = 'data-hdr';
export const HDR_COLLAPSED = 'collapsed';

let collapsed = false;
const listeners = new Set();

/** `useSyncExternalStore`'s subscribe half. */
export function subscribeHeader(fn) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** `useSyncExternalStore`'s client snapshot. */
export function headerCollapsed() {
  return collapsed;
}

/**
 * `useSyncExternalStore`'s SERVER snapshot, and it is a constant rather than a read of `collapsed`.
 * The server renders the expanded state, always - see the hydration note above.
 */
export function headerCollapsedOnServer() {
  return false;
}

function notify() {
  for (const fn of [...listeners]) fn();
}

function sentinelTop() {
  if (typeof document === 'undefined') return null;
  const el = document.getElementById(SENTINEL_ID);
  return el ? el.getBoundingClientRect().top : null;
}

function paint(next) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (next) root.setAttribute(HDR_ATTR, HDR_COLLAPSED);
  else root.removeAttribute(HDR_ATTR);
}

/**
 * COLLAPSE. Called by the scroll sentinel and by the TV button, and idempotent for both.
 * @returns {boolean} whether this call changed anything.
 */
export function collapseHeader() {
  if (collapsed) return false;
  const before = sentinelTop();
  collapsed = true;
  paint(true);
  const after = sentinelTop();
  if (before !== null && after !== null && after !== before && typeof window !== 'undefined') {
    window.scrollBy(0, after - before);
  }
  notify();
  return true;
}

/**
 * EXPAND, and RETURN THE READER TO THE TOP. The second half is not a convenience: the thing being
 * restored is 340px of banner and controls that would otherwise appear above the reader's scroll
 * position, where they cannot be seen. Joe's words are "the full banner and expanded toggles would
 * appear atop the app" - so the reader is taken to them.
 *
 * THE ONLY CALLER IS THE WORDMARK BUTTON. Nothing scroll-driven may call this.
 */
export function expandHeader() {
  if (!collapsed) return false;
  collapsed = false;
  paint(false);
  // `behavior` is left at the default rather than set to 'smooth': a smooth scroll is MOTION, and
  // motion in this app lives inside `@media (prefers-reduced-motion: no-preference)`. An instant
  // jump needs no such gate and cannot be the wrong answer for a reader who asked for less of it.
  if (typeof window !== 'undefined') window.scrollTo(0, 0);
  notify();
  return true;
}

/**
 * GRID VIEW HAS NO NAVBAR (prompt 58 stage 5, unchanged), so it must not be able to sit in the
 * collapsed state either - the banner would be hidden with nothing rendered in its place. This is
 * the one path that clears the state without being an expand, and it is a VIEW CHANGE rather than a
 * reader gesture, which is why it does not scroll.
 */
export function resetHeader() {
  if (!collapsed) return false;
  collapsed = false;
  paint(false);
  notify();
  return true;
}
