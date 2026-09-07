'use client';

// THE COLLAPSING HEADER — the wordmark and the current choices, once the banner has scrolled away.
//
// Joe's rulings, 2026-09-07, across four exchanges:
//   * EXPANDED FIRST, then collapse on scroll. Not opens-collapsed - first paint is unchanged.
//   * the bar carries the wordmark and the four current choices, and NOTHING else
//   * NO TAGLINE, NO TV CUTOUT, NO ARTWORK. Both were in his original sketch and both were
//     measured out. MEASURED WITH THE REAL FONT at 390: the wordmark is 129.9px and there are
//     218.1px beside it once padding and gaps come out, of which the four choices take 148.7px.
//     (The brief modelled 108 and 258 from an estimated 0.45em advance; both were wrong.)
//   * DAY, ALL GAMES and LIST flip on tap; ALL SPORTS opens the tile row
//   * SCROLL POSITION ALONE owns the state. There is no manual expand control.
//
// WHAT IT DOES NOT BUY, so nobody "improves" it by opening collapsed: the above-the-fold burden is
// unchanged at banner 123 + shell padding 8 + control stack 216 = 347px before the first card. The
// saving is REACHABILITY - the four choices follow you down a 19,000px week - not first paint.
//
// ---------------------------------------------------------------------------------------------
// THIS IS THE HUB'S FIRST CLIENT-SIDE UI STATE, AND THE LINE IT DRAWS MATTERS MORE THAN THE FEATURE.
//
// `app/page.js` and globals.css both record that every breakpoint in this app is CSS-gated at 699px
// "precisely so there is no server/client hydration mismatch", and the hub is deliberately URL-only
// with no localStorage: absent means default, always.
//
// This is legitimate because it is POST-MOUNT AND EPHEMERAL:
//   * the SERVER RENDERS THE EXPANDED STATE - `collapsed` starts false, so the first client render
//     is byte-identical to the server's and there is nothing to mismatch;
//   * the observer applies the collapse only AFTER hydration;
//   * nothing is persisted, nothing is read back, and a reload starts expanded again.
//
// THE LINE, for the next person who cites this as precedent: state that ANSWERS A QUESTION ABOUT THE
// WORLD - which day, which sport, which view - belongs in the URL, because it has to survive a
// reload and be shareable. State that describes only WHERE THE READER IS LOOKING RIGHT NOW is
// presentation, and putting it in the URL would make every scroll a history entry. Scroll position
// is the second kind. If a future piece of client state cannot be described in that second sentence,
// it belongs in the URL instead.
//
// ---------------------------------------------------------------------------------------------
// WHY IT IS SAFE ABOVE THE GRID'S STICKY RAIL, since this was briefed as a serious risk and is not.
//
// globals.css on `.mrail-cell` says the rail's stickiness holds "only while nothing between this
// element and `.mgrid-scroll` carries a transform: a transformed ancestor would become its
// containing block... which is exactly the bug prompt 30 fixed. Do not add one."
//
// The hazard is a TRANSFORM ON AN ANCESTOR, scoped to the chain between `.mrail-cell` and
// `.mgrid-scroll`. `position: fixed` and `position: sticky` do NOT establish containing blocks for
// descendants - only transform, filter, perspective, backdrop-filter, will-change and contain do.
// This bar is mounted in layout.js beside `Chrome`, which makes it a sibling of `.shell` and so
// never an ancestor of `<main>` or of the grid. It cannot reach that chain at all.
//
// The real risk is different and smaller: `.mgrid-scroll` sets `touch-action: pan-x pan-y` and the
// grid runs a pinch handler, so a fixed bar over the top 44px of that scroller would take touches
// there. That is why this renders in LIST VIEW ONLY for now - see the `isGrid` return below.

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { resolveHubParams } from '../lib/hubparams.js';
import { todayET } from '../lib/format.js';
import { SPORT_SHORT } from '../lib/config.js';

/** The id of the zero-height element in layout.js that decides collapsed-ness. */
export const SENTINEL_ID = 'hdr-sentinel';

export default function CollapsedHeader() {
  // FALSE ON THE SERVER AND ON THE FIRST CLIENT RENDER. That equality is the whole hydration story.
  const [collapsed, setCollapsed] = useState(false);
  const params = useSearchParams();

  useEffect(() => {
    // AN OBSERVER, NEVER A SCROLL LISTENER. A scroll handler fires every frame and this app has
    // never had one; an IntersectionObserver is a callback on a threshold crossing and costs
    // nothing between crossings.
    const el = document.getElementById(SENTINEL_ID);
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // ONE DECIDER FOR WHAT A QUERY STRING MEANS. `resolveHubParams` is that decider (hubparams.js is
  // explicit that nothing else may be), so this asks it rather than reading `view` itself and
  // inventing a second answer. `todayET()` only feeds `day`, which this component never reads.
  const P = resolveHubParams(Object.fromEntries(params.entries()), todayET());

  // LIST VIEW ONLY, and it returns null rather than hiding: a fixed element that is merely
  // `opacity: 0` still takes touches in some engines, which is the exact failure mode this
  // exclusion exists to avoid.
  if (P.isGrid) return null;

  // THE FOUR CURRENT CHOICES, in the control stack's own order: the page reads DAY, ALL GAMES,
  // LIST, ALL SPORTS downward when expanded, and left to right here.
  //
  // `LIST`, NOT `LIST VIEW`. The expanded toggle says "List view" because it sits beside "Grid
  // view" and the noun disambiguates; alone in a run of four, the noun is the only word that could
  // be dropped without losing the meaning, and it is 21px of a 218px budget.
  //
  // THE SPORT USES THE SHORT LABEL. `SPORT_LABEL.cfb` is "College Football" - measured at 93.3px
  // against the ALL SPORTS target of 57.5px with the real font, so the display name would break
  // this row the moment CFB was selected. `SPORT_SHORT` is that fact in one place.
  //
  // DELIBERATELY ABSENT, so nobody helpfully adds it: THE DATE AND WEEK PICKER. There is no room,
  // and it is not a regression - changing the viewing day already means scrolling to the top today.
  // Tapping DAY flips the MODE, not the date.
  const choices = [
    { key: 'mode', text: P.isWeek ? 'WEEK' : 'DAY' },
    { key: 'scope', text: P.isMine ? 'MY TEAMS' : 'ALL GAMES' },
    { key: 'view', text: 'LIST' },
    { key: 'sport', text: P.sport ? (SPORT_SHORT[P.sport] || P.sport).toUpperCase() : 'ALL SPORTS' },
  ];

  return (
    <div className="chdr" data-collapsed={collapsed || undefined} aria-hidden={!collapsed}>
      <div className="chdr-inner">
        <span className="chdr-wm">MYSPORTS TV</span>
        {/* STAGE 2 RENDERS THESE AS TEXT. Stage 3 makes the first three buttons and stage 4 makes
            the fourth a disclosure; splitting it proves the layout before the interaction lands on
            top of it. */}
        <div className="chdr-run">
          {choices.map((c) => (
            <span key={c.key} className="chdr-choice" data-key={c.key}>{c.text}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
