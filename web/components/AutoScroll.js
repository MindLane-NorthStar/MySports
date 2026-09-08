'use client';

// LANDING ON WHAT IS ON NOW (prompt 67 stage 2, Joe's ruling 2026-09-08).
//
// Joe: "Top of the day before games start, games in-progress while games are in-progress." So the
// app opens on the current day's heading until something is live, and on the earliest live game once
// something is. It runs on EVERY entry to the view and AGAIN when the app returns from the
// background - Joe chose the most aggressive trigger knowingly, over the gentler recommendation.
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

import { collapseHeader } from '../lib/headerstate.js';

/** Breathing room between the sticky stack and the thing scrolled to. */
export const SCROLL_GAP = 8;

/** The fallback if `--stack-h` has not been written yet - the bar's collapsed height. */
const BAR_FALLBACK = 44;

/** After the collapse commits: long enough for the reflow and the `--stack-h` ResizeObserver. */
const SETTLE_MS = 120;

/** After the smooth scroll: long enough for it to have finished, since Safari has no `scrollend`. */
const CORRECT_MS = 600;

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

      // Hazard 1: collapse FIRST, deliberately. Its own scroll compensation is spent before
      // anything here measures, and the observer's later call is idempotent.
      collapseHeader();

      // Two frames plus a beat: one for React to commit the collapse, one for the reflow, and
      // SETTLE_MS for the ResizeObserver that maintains `--stack-h`.
      requestAnimationFrame(() => requestAnimationFrame(() => later(() => {
        const d = delta();
        if (d === null || Math.abs(d) <= 1) return;
        const reduced = window.matchMedia
          && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollBy({ top: d, behavior: reduced ? 'auto' : 'smooth' });

        // ONE CORRECTION, after the smooth scroll has finished. `scrollend` would be the right
        // event and Safari does not have it, which is the browser this has to be right on.
        later(() => {
          const d2 = delta();
          if (d2 !== null && Math.abs(d2) > 2) window.scrollBy({ top: d2, behavior: 'auto' });
        }, CORRECT_MS);
      }, SETTLE_MS)));
    };

    // EVERY ENTRY. The effect re-runs on any change to the path or the query, which is what a
    // change of day, week, sport, scope or view is in this app - there is one route.
    land();

    // AND AGAIN FROM THE BACKGROUND. `visibilitychange` rather than `focus`: focus fires when the
    // reader dismisses a keyboard or returns from a share sheet, which is not returning to the app.
    const onVisible = () => { if (document.visibilityState === 'visible') land(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      timers.forEach(window.clearTimeout);
      timers = [];
    };
  }, [key]);

  return null;
}
