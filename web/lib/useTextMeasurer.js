'use client';

// Text measurement in the REAL fonts, shared by the grid block and the listings card.
//
// It lived inside MobileGrid.js, where the grid's M2 rule needs it: "measure the widest rendered team
// line, do not estimate it". The card now needs the same thing for the same reason - prompt 42 found
// its name tiers stepping on CHARACTER COUNT, which cannot know that "South Alabama" (13 characters,
// so 15px by that rule) needs 110px in the 81px it has. One measurer, so the two surfaces cannot
// disagree about what a string is worth.
//
// It is here rather than exported from MobileGrid because MobileGrid already imports from
// MatchupCard (cardName, cardBroadcast); importing back the other way would close a cycle.

import { useEffect, useMemo, useRef, useState } from 'react';

// NO `typeof window` HOOK SWAP HERE. A useLayoutEffect/useEffect branch on the server is exactly the
// pattern React names in "a tree hydrated but some attributes of the server rendered HTML didn't
// match" - and that mismatch is NOT patched up, so the cards froze at their server sizes and the
// measured tiers never applied at all. Plain useEffect on both sides: the server and the first client
// render agree (no measurement yet, character-count fallback), and the measured size lands one tick
// later. One frame at the fallback size is the price of a tree that actually hydrates.

/**
 * A canvas measurer that reports ready only once the real faces have loaded.
 *
 * `ready` matters: measuring before the webfont arrives gives the fallback's metrics, which are not
 * the metrics that will be painted. Callers re-run when it flips.
 */
export function useTextMeasurer() {
  const ctxRef = useRef(null);
  // `tick` bumps twice: once as soon as the canvas exists, and again when the real faces have
  // loaded. Gating the FIRST measurement on document.fonts.ready cost about three seconds of
  // character-count sizes on a page of eighty cards, because nothing could measure until the fonts
  // resolved. Measuring immediately in whatever face is mounted is close, and the second bump makes
  // it exact.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    ctxRef.current = document.createElement('canvas').getContext('2d');
    let cancelled = false;
    setTick((t) => t + 1);
    const done = () => !cancelled && setTick((t) => t + 1);
    if (document.fonts?.ready) document.fonts.ready.then(done, done);
    else done();
    return () => {
      cancelled = true;
    };
  }, []);
  return useMemo(
    () => ({
      ready: tick > 0,
      measure(text, font) {
        const ctx = ctxRef.current;
        if (!ctx) return (text || '').length * 8;
        ctx.font = font;
        return ctx.measureText(text || '').width;
      },
    }),
    [tick]
  );
}

/**
 * The rendered width of an element, kept current across viewport and orientation changes.
 *
 * Measured rather than derived from the viewport: the card's body width is the grid's 1fr track after
 * three fixed tracks, three gaps and the card padding have taken theirs, and reproducing that
 * arithmetic in JS would be a second copy of the stylesheet that silently rots. `useLayoutEffect`
 * The first read happens on mount and the observer handles everything after - rotation, and the
 * 560px breakpoint crossing.
 */
export function useElementWidth(ref) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const read = () => setWidth((w) => {
      const next = el.getBoundingClientRect().width;
      return Math.abs(next - w) > 0.5 ? next : w;
    });
    read();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', read);
      return () => window.removeEventListener('resize', read);
    }
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}
