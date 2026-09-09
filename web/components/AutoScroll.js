'use client';

// LANDING ON WHAT IS ON NOW (prompt 67 stage 2, Joe's ruling 2026-09-08).
//
// Joe: "Top of the day before games start, games in-progress while games are in-progress." So the
// app opens on the current day's heading until something is live, and on the earliest live game once
// something is.
//
// ---------------------------------------------------------------------------------------------
// IT DOES NOT FIRE ON ARRIVAL, AND THAT IS A DELIBERATE REVERSAL (prompt 68, Joe 2026-09-08).
//
// Prompt 67 ran it on EVERY entry to the view and AGAIN on every return from the background - the
// most aggressive of the options, chosen knowingly over the gentler recommendation. It was wrong in
// the one case nobody pictured: a cold open. Joe reported "when opening the app, the main banner
// doesn't appear - the app opens with the navbar", because `land()` collapses the header and scrolls
// the banner off before he has looked at it. His ruling: "Can we tune the auto-scroll to NOT work on
// first opening of the app?"
//
// THE RULE IS STRONGER THAN "SKIP THE FIRST RUN", and the difference is the whole point on the
// target device. An iOS home-screen PWA usually SURVIVES backgrounding, so "opening the app" is
// normally a `visibilitychange` on a document that already exists - not a fresh mount. Suppressing
// only the mount would leave the complaint intact for the most common way Joe opens it. So:
//
//   THE SCROLL NEVER FIRES UNTIL THE READER HAS NAVIGATED WITHIN THE APP AT LEAST ONCE IN THIS
//   DOCUMENT. After that, both triggers behave exactly as prompt 67 left them.
//
//   cold open, fresh document                    no - the banner is there and the header is open
//   background and return, having navigated      no - the view is left exactly as it was
//   change day / week / sport / scope / view     YES
//   background and return after any navigation   YES
//   pull-to-refresh, or iOS evicting the PWA     no - a fresh document is an arrival
//
// MODULE SCOPE IS THE CARRIER, and the choice is load-bearing. It survives every re-render and every
// client-side route change WITHIN one document, and it dies with the document - which is exactly the
// definition of "a fresh open of the app". A `useRef` would reset on remount; `sessionStorage` would
// survive a reload and suppress nothing on the fifth row above.
//
// IT IS ALSO WHAT MAKES PROMPT 67 STAGE 1 SAFE. The TONIGHT band was removed in the same prompt, and
// the band's whole job was answering "what is on right now" at a glance. This is that answer, moved
// from a duplicated list of cards into the scroll position.
//
// ---------------------------------------------------------------------------------------------
// THE TARGET, and why there is only one rule for four view combinations.
//
//   [data-istoday="true"]        the current day's block - week mode marks one per day, day mode
//                                marks `#all-today`. NOTHING carries it on a week that does not
//                                contain today, so "never scroll on such a week" needs no check:
//                                the query returns null and this returns.
//   .mcard[data-live="1"]        a game in progress. Written from `result_status` on the server
//                                (components/MatchupCard.js) so no clock reaches the client.
//
// The first live card INSIDE today's block, or the block itself. In GRID view there are no cards at
// all - prompt 55 put cards in list view only - so the same expression lands on the day's heading
// without a branch, which is also the only safe answer there: MobileGrid owns a horizontal scroll
// and a pinch handler, and scrolling to something inside it could disturb both.
//
// AFTER THE LAST GAME the day has no live card and this lands on the heading, the same as before
// the first one. That is Cowork's reading of "top of the day before games start" rather than Joe's
// words, and it is the conservative half of the ruling: a finished day is a day with nothing on.
//
// ---------------------------------------------------------------------------------------------
// THE THREE HAZARDS, and what this does about each.
//
// 1. THE HEADER COLLAPSE. `lib/headerstate.js` collapses on an IntersectionObserver crossing the
//    sentinel and applies a scroll COMPENSATION when it does - it measures the sentinel, writes the
//    attribute, measures again and scrolls by the difference. A programmatic scroll past the
//    sentinel would trigger that mid-flight and land the reader somewhere neither of us chose.
//    So this COLLAPSES FIRST, deliberately and synchronously, and only then measures. The
//    compensation is spent before anything here reads a box, and the observer's later call is
//    idempotent and returns false. Landing collapsed is also the right answer on its own terms -
//    the reader asked to see what is on, not 340px of banner above it.
//
// 2. THE STICKY STACK. `.chdr` sticks at the top and `.pickrow` sticks under it at
//    `top: var(--stack-h)` (prompt 62). An element scrolled to viewport 0 sits BEHIND both. The
//    target is offset by the bar's height plus the picker's, both measured rather than assumed -
//    `--stack-h` is maintained by a ResizeObserver in CollapsedHeader.js and is the bar's real
//    rendered height, and the picker's own height is read off its box.
//
// 3. prefers-reduced-motion. A smooth scroll is motion. Honoured, the same way headerstate.js's
//    expand does it - an instant jump is never the wrong answer for a reader who asked for less.

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { suppressScrollCollapse, releaseScrollCollapse } from '../lib/headerstate.js';
import {
  SCROLL_GAP,
  SETTLE_MS,
  CORRECT_MS,
  stackBottom,
  scrollTargetFor,
  decideScroll,
} from '../lib/autoscroll.js';

/** The live entry state. MODULE SCOPE deliberately - see the note at the top of this file. */
let entryState = { arrivalKey: null, navigated: false };

export default function AutoScroll() {
  const pathname = usePathname();
  const params = useSearchParams();
  const key = `${pathname}?${params}`;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let timers = [];
    const later = (fn, ms) => { timers.push(window.setTimeout(fn, ms)); };

    // HOW FAR THE TARGET IS FROM WHERE IT SHOULD BE. A DELTA, not an absolute position, and that is
    // the whole correctness argument: measuring `rect.top + scrollY` once and calling scrollTo was
    // the first attempt and it landed the week's day heading 36px BEHIND the sticky stack. The cause
    // is that `collapseHeader()` calls `notify()`, React re-renders, and prompt 62's split reparents
    // `.pickrow` out of `.hubctl` - a reflow that had not happened when a single rAF measured. A
    // delta re-measures against whatever the layout has become, so a late reflow is corrected rather
    // than baked in.
    const delta = () => {
      const el = scrollTargetFor(document);
      return el ? el.getBoundingClientRect().top - stackBottom() - SCROLL_GAP : null;
    };

    const land = () => {
      if (!scrollTargetFor(document)) return;

      // Hazard 1, ANSWERED DIFFERENTLY SINCE PROMPT 71. This used to call collapseHeader() first and
      // deliberately, to SPEND the compensation before measuring. Joe: "once you change to week view
      // it closes the banner since the screen auto scrolls to the current day." So the collapse is
      // SUPPRESSED for the duration instead - the observer does not fire, so there is no
      // compensation to spend, and the banner is still there when he scrolls back up.
      suppressScrollCollapse();

      // Two frames plus a beat: one for React to commit, one for the reflow, and SETTLE_MS for the
      // ResizeObserver that maintains `--stack-h`.
      requestAnimationFrame(() => requestAnimationFrame(() => later(() => {
        const d = delta();
        if (d === null || Math.abs(d) <= 1) { releaseScrollCollapse(); return; }
        const reduced = window.matchMedia
          && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollBy({ top: d, behavior: reduced ? 'auto' : 'smooth' });

        // ONE CORRECTION, after the smooth scroll has finished. `scrollend` would be the right
        // event and Safari does not have it, which is the browser this has to be right on.
        later(() => {
          const d2 = delta();
          if (d2 !== null && Math.abs(d2) > 2) window.scrollBy({ top: d2, behavior: 'auto' });
          // RE-ARM LAST, after the correction has moved the page for the final time.
          releaseScrollCollapse();
        }, CORRECT_MS);
      }, SETTLE_MS)));
    };

    // EVERY ENTRY BUT THE ARRIVAL. The effect re-runs on any change to the path or the query, which
    // is what a change of day, week, sport, scope or view is in this app - there is one route. React
    // StrictMode double-invokes this on mount in development; the second run carries the SAME key,
    // so it is not a navigation and nothing scrolls.
    const entry = decideScroll(entryState, 'entry', key);
    entryState = entry.state;
    if (entry.scroll) land();

    // AND AGAIN FROM THE BACKGROUND, through the same predicate. `visibilitychange` rather than
    // `focus`: focus fires when the reader dismisses a keyboard or returns from a share sheet, which
    // is not returning to the app.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const back = decideScroll(entryState, 'return', null);
      entryState = back.state;
      if (back.scroll) land();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      timers.forEach(window.clearTimeout);
      timers = [];
      // A landing interrupted by a route change must not leave the collapse suppressed for the life
      // of the document - that would be a banner that never collapses again.
      releaseScrollCollapse();
    };
  }, [key]);

  return null;
}
