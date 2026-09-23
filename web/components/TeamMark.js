'use client';

// A TEAM'S MARK, OR A "TBD" BADGE WHERE THE MARK WOULD BE (prompt 116, Joe's ruling 2026-09-23).
//
// MLB's postseason rows arrive with placeholder participants - "AL Wild Card #2", a team id that is
// not a club, has no logo on R2 and no colour ruling - and every `<img src={teamLogoDarkUrl(id)}>`
// drew the browser's broken-image icon for them (seen at pixel scale in prompt 114 rev B's crops).
// Joe: a grey "TBD" badge, in the SAME box as the logo it replaces, so the names stay aligned with
// every other card. One component, used at every site that draws a team mark, so the rule cannot
// be applied at four sites and missed at the fifth (rule 32).
//
// TWO WAYS TO THE BADGE, and both are needed. (1) `isPlaceholderTeam` - the predicate smoke uses -
// decides from the row before any request is made. (2) A logo that FAILS TO LOAD swaps to the badge
// too: the name pattern is deliberately narrow (register §60), and a later round's placeholder, a
// Division Series winner say, will not match it, yet it will still have no logo. `onError` catches
// a failure after hydration; the mount check catches one that fired BEFORE hydration, when the
// server-rendered <img> had already errored and React attached its handler too late - that is
// `img.complete && img.naturalWidth === 0`, which is what a broken image looks like from the DOM.
//
// The game embed carries `id` and `canonical_name` but not `sport`, so callers pass the game's.
// Written with createElement rather than JSX so `node --test` can import and render it directly.

import { createElement, useEffect, useRef, useState } from 'react';
import { isPlaceholderTeam } from '../lib/placeholders.js';

export default function TeamMark({ team, sport, src, loading = 'lazy' }) {
  const placeholder = isPlaceholderTeam(team ? { ...team, sport } : null);
  const [failed, setFailed] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);
  if (placeholder || failed || !src) {
    return createElement('span', { className: 'tbd-mark', role: 'img', 'aria-label': 'Team to be determined' }, 'TBD');
  }
  return createElement('img', { ref, src, alt: '', loading, onError: () => setFailed(true) });
}
