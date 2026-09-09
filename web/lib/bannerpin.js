// THE BANNER PINS UNTIL THE READER'S OWN FIRST SCROLL (prompt 73, Joe's ruling 2026-09-09).
//
// Joe: "I think the answer to all of this is to make banner STICKY until the user scrolls,
//       regardless of day/week, All Games/MyTeams, List/Grid, All Sports or League tile."
//
// WHAT WAS ACTUALLY WRONG, and it is NOT a regression of prompt 71. That stage stopped the
// auto-scroll COLLAPSING the header and it holds - measured again before this change: week / all
// games / list lands at scrollY 1050 with `data-hdr` still null and the banner still in the
// document. What defeats it is the landing itself. `.banner` was `position: relative` and first in
// flow, so at scrollY 1050 its top sits at -1050: not collapsed, scrolled past. Joe: "the banner
// doesn't go anywhere but it's lost atop the screen because the scroll scrolls past the banner in
// total." The reader sees cards and no chrome at all, which is indistinguishable from the complaint
// prompt 71 set out to fix.
//
// ---------------------------------------------------------------------------------------------
// RELEASE AND COLLAPSE ARE TWO EVENTS AT TWO MOMENTS, and conflating them is the whole hazard.
//
//   1. RELEASE   the reader's own first scroll   the pin lets go; the banner is ordinary flow
//                                                content again and travels with the page
//   2. COLLAPSE  the sentinel crossing, as today `.chdr` appears, `.pickrow` sticks at --stack-h
//
// Between them is a stretch with no navbar yet, while the banner's tail and the picker are still
// leaving. That is prompt 71's behaviour, unchanged, and Joe chose it over an immediate swap in
// place having been shown both: "lets try 1."
//
// SO THE BANNER STAYS IN FLOW. `position: sticky`, never `fixed` - and that is load-bearing rather
// than stylistic. A sticky element occupies its normal space, so nothing below it moves when the pin
// is armed or released, the sentinel keeps sitting where it always sat, `collapseHeader()`'s
// compensation measures the same delta it always measured, and the route back to the expanded
// banner is untouched. A fixed banner would leave its own height of empty ground behind it and would
// break every one of those.
//
// REJECTED, AND RECORDED SO IT IS NOT RE-PROPOSED AS AN IMPROVEMENT: a permanently pinned banner
// that swaps to the navbar in place. It reads better - no transitional beat - and it is a different
// and larger change, because a banner that never travels breaks the sentinel that triggers the
// collapse, the height arithmetic the landing depends on, and the route back.
//
// ---------------------------------------------------------------------------------------------
// WHAT THE RELEASE IS KEYED ON, which is the thing most likely to be got wrong.
//
// A release keyed on `scrollY` changing fires on the auto-scroll itself and the feature does
// nothing. Prompt 71 solved the equivalent problem with a FLAG consulted by the sentinel observer;
// this does not reuse that flag, and the reason is a timing hole that the flag cannot close:
// `window.scrollBy` moves the offset synchronously but the `scroll` EVENT is dispatched at the next
// rendering opportunity, so the landing's last correction delivers its event AFTER
// `releaseScrollCollapse()` has already run on the line below it.
//
//   THE LISTENER DOES NOT EXIST WHILE THE LANDING IS IN FLIGHT.
//
// `installPinRelease` is called by components/AutoScroll.js at the END of `land()`, one animation
// frame after the last correction - so the landing's own scroll events have nowhere to land, by
// construction rather than by a flag whose ordering has to be right. When there is no landing (a
// cold open, a week without today) it is installed immediately. It listens once and removes itself.
//
// A SCROLL EVENT, NOT `wheel`/`touchmove`. Two reasons, and the second is the one that decided it:
//   * it covers every way a page moves - a wheel, a drag, the keyboard, a scrollbar, a find-in-page
//     jump - rather than an enumeration that will be missing one of them;
//   * a horizontal PAN inside the grid's `.mgrid-scroll` is a touchmove and is NOT the reader
//     scrolling the page. Keyed on touchmove the banner would vanish the moment a thumb pushed the
//     grid sideways; keyed on the document's own scroll it stays, which is right.
//
// ---------------------------------------------------------------------------------------------
// THE PIN DOES NOT FEED `--stack-h`, AND IT HAS NO HEIGHT OF ITS OWN TO PUBLISH EITHER.
//
// `--stack-h` has exactly one job: the offset `.pickrow` sticks at, written from `.chdr`'s real
// rendered height by a ResizeObserver in components/CollapsedHeader.js. It is a CSS custom property
// because CSS READS IT. Folding the banner into it would be wrong twice over: the picker only
// sticks while the header is COLLAPSED, and while it is collapsed the banner is `display: none` - so
// the added height would push the picker down by a banner that is not on the screen. The pin can
// also be armed and collapsed at once (tap the television before scrolling), which is exactly that
// case.
//
// NOR A COMPANION CUSTOM PROPERTY, and nor a `pinnedBannerHeight()` here. Prompt 73 exported one and
// prompt 74 deleted it: `lib/autoscroll.js` now asks each of the three candidate boxes whether it
// resolved to `position: sticky`, which answers for the banner without this module publishing
// anything. That is the better shape for the reason prompt 74 fixed - the clearance was counting
// `.pickrow` in a state where it does not stick, and a per-element predicate is what stops the next
// one of those. This module owns the STATE; what the state does to a layout is measured off the
// layout.

/** The attribute on `<html>`, and the one value it takes. The stylesheet reads exactly this pair. */
export const PIN_ATTR = 'data-pin';
export const PIN_BANNER = 'banner';

/**
 * ARM. Called on mount and on every view-key change (see components/AutoScroll.js) - which is what
 * "regardless of day/week, All Games/MyTeams, List/Grid, All Sports or League tile" asks for: each
 * of those is a navigation, each navigation may land the reader a thousand pixels down, and the
 * banner has to survive every one of them and not only the first.
 *
 * Idempotent, and safe while the header is collapsed: the banner is `display: none` there, so the
 * attribute simply has nothing to act on until the wordmark brings it back.
 */
export function armBannerPin(doc = typeof document === 'undefined' ? null : document) {
  if (!doc) return;
  doc.documentElement.setAttribute(PIN_ATTR, PIN_BANNER);
}

/** RELEASE. The banner becomes ordinary flow content again; nothing else about the page changes. */
export function releaseBannerPin(doc = typeof document === 'undefined' ? null : document) {
  if (!doc) return;
  doc.documentElement.removeAttribute(PIN_ATTR);
}

/**
 * Whether the pin is armed right now.
 *
 * THE MODULE'S OWN READER, and its callers are the tests that pin this contract. It is deliberately
 * not consulted by the landing: `lib/autoscroll.js` asks the BANNER what its `position` resolved to
 * rather than asking this what the state is, so the two can never disagree about a banner the
 * stylesheet has hidden.
 */
export function bannerPinArmed(doc = typeof document === 'undefined' ? null : document) {
  return !!doc && doc.documentElement.getAttribute(PIN_ATTR) === PIN_BANNER;
}

/**
 * Watch for the reader's own scroll and release the pin on the first one.
 *
 * ONE SHOT. It removes itself the moment it fires, so this is not a scroll handler that lives for
 * the life of the document - the thing CollapsedHeader.js's observer note rules out. It is re-armed
 * by the next navigation, which re-runs the effect that installed it.
 *
 * @param {Window} win
 * @returns {() => void} teardown, for the effect's cleanup
 */
export function installPinRelease(win) {
  if (!win || typeof win.addEventListener !== 'function') return () => {};
  const onScroll = () => {
    releaseBannerPin(win.document);
    win.removeEventListener('scroll', onScroll);
  };
  win.addEventListener('scroll', onScroll, { passive: true });
  return () => win.removeEventListener('scroll', onScroll);
}
