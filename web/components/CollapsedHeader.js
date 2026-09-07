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
import { SPORT_SHORT, SPORT_LABEL } from '../lib/config.js';
import { useSetParam, SportFilter } from './Filters.js';

/**
 * EVERY TAP IN THIS BAR KEEPS THE SCROLL POSITION, and it has to.
 *
 * Next's router.push jumps to the top by default. Measured before this: a tap here threw the reader
 * from 700px back to 0, the sentinel re-entered the viewport, and the bar hid itself with the very
 * tap that caused it. A control that dismisses itself when used is worse than no control.
 *
 * The expanded surfaces keep the default deliberately - changing the day or the sport lands you at
 * the top of a different slate, which is right, and the expanded toggles are at the top anyway.
 */
const KEEP_SCROLL = { scroll: false };

/** The id of the zero-height element in layout.js that decides collapsed-ness. */
export const SENTINEL_ID = 'hdr-sentinel';

export default function CollapsedHeader() {
  // FALSE ON THE SERVER AND ON THE FIRST CLIENT RENDER. That equality is the whole hydration story.
  const [collapsed, setCollapsed] = useState(false);
  /**
   * THE SECOND PIECE OF EPHEMERAL UI STATE, under the same ruling as the first (see the header
   * note). The URL still owns `sport` itself - only the OPEN/CLOSED-ness of the picker is here, and
   * it is not persisted, not in the URL, and gone on reload. It passes the test that note sets: it
   * describes only where the reader is looking right now, not anything about the world.
   */
  const [sportsOpen, setSportsOpen] = useState(false);
  const params = useSearchParams();
  // THE SAME FUNCTION THE EXPANDED TOGGLES USE, imported rather than reimplemented. Two surfaces
  // that can disagree about what a toggle does is a bug waiting for the day someone changes one.
  const setParam = useSetParam();

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
  /**
   * THE THREE BINARIES, AND A THIRD ACCESSIBILITY PATTERN FOR THIS APP.
   *
   * `Filters.js` records why the EXPANDED toggles are `role="radiogroup"` + `aria-checked` rather
   * than `aria-pressed`: each is exactly one of two, and exclusivity should be announced rather
   * than inferred. Register §17 records that the eight league tiles deliberately keep
   * `aria-pressed`, because a filter that can be CLEARED is not a one-of-N choice.
   *
   * A COLLAPSED BINARY SHOWS ONLY ONE OPTION, so it can be neither. There is no group to be one of
   * two within, and nothing is "pressed" - the word on screen is a STATEMENT OF FACT and the tap is
   * a verb. So: a plain button whose VISIBLE TEXT IS THE CURRENT STATE and whose ACCESSIBLE NAME
   * STATES THE ACTION.
   *
   *     <button aria-label="Time range: Day. Switch to Week">DAY</button>
   *
   * That is the brief's wording and it is kept, because it reads correctly in the two places it
   * matters: a screen reader announces "Time range: Day. Switch to Week, button" - the state, then
   * what pressing does - and a voice-control user can say the label. Splitting state from action
   * with a full stop rather than a dash is deliberate; a dash is read as a pause, not a boundary.
   *
   * TAPPING `LIST` IS A ONE-WAY DOOR FROM THIS BAR and that is by design, not an oversight. It
   * switches to grid view, and the bar does not render there (stage 5), so it vanishes with the
   * tap that caused it. Getting back is the expanded stack, one scroll up - the same journey the
   * reader would make to change the day. Recorded so it reads as a consequence of the grid
   * exclusion rather than as a defect.
   */
  const binaries = [
    { key: 'mode', text: P.isWeek ? 'WEEK' : 'DAY',
      name: `Time range: ${P.isWeek ? 'Week' : 'Day'}. Switch to ${P.isWeek ? 'Day' : 'Week'}`,
      // `day` and `w` both stay in the URL - each is read only in its own mode - and the DEFAULT is
      // removed rather than written, which is what keeps `/` the canonical default state.
      onPick: () => setParam('mode', P.isWeek ? null : 'week', KEEP_SCROLL) },
    { key: 'scope', text: P.isMine ? 'MY TEAMS' : 'ALL GAMES',
      name: `Scope: ${P.isMine ? 'My teams' : 'All games'}. Switch to ${P.isMine ? 'All games' : 'My teams'}`,
      onPick: () => setParam('scope', P.isMine ? null : 'mine', KEEP_SCROLL) },
    { key: 'view', text: 'LIST',
      name: 'Presentation: List view. Switch to Grid view',
      onPick: () => setParam('view', 'grid', KEEP_SCROLL) },
  ];

  const sportText = P.sport ? (SPORT_SHORT[P.sport] || P.sport).toUpperCase() : 'ALL SPORTS';

  /**
   * SPORT IS A DISCLOSURE, NOT A BINARY, and that is Joe's ruling rather than an implementation
   * convenience. ALL plus eight league tiles is NINE states: cycling them on tap would take eight
   * presses to get from NFL back to NHL, which is not a control, it is a punishment.
   *
   * IT OPENS THE TILE ROW ONLY - the 24px ALL SPORTS bar and the eight tiles - and not the full
   * 216px control stack. It is the same `SportFilter` the expanded stack renders, given two props
   * rather than forked.
   *
   * THE ACCESSIBLE NAME DOES NOT SAY "SHOW" OR "HIDE", unlike the three binaries above, and the
   * difference is deliberate: `aria-expanded` already announces collapsed/expanded, so a name that
   * repeated it would have a reader hear the affordance twice. State only, and the ARIA carries
   * the verb.
   */
  return (
    <div className="chdr" data-collapsed={collapsed || undefined} aria-hidden={!collapsed}>
      <div className="chdr-inner">
        <span className="chdr-wm">MYSPORTS TV</span>
        <div className="chdr-run">
          {binaries.map((c) => (
            <button key={c.key} type="button" className="chdr-choice" data-key={c.key}
                    aria-label={c.name} onClick={c.onPick}>
              {c.text}
            </button>
          ))}
          <button type="button" className="chdr-choice" data-key="sport"
                  aria-label={`Sport: ${P.sport ? (SPORT_LABEL[P.sport] || P.sport) : 'All sports'}`}
                  aria-expanded={sportsOpen} aria-controls="chdr-sports"
                  onClick={() => setSportsOpen((v) => !v)}>
            {sportText}
          </button>
        </div>
      </div>
      {/* CONDITIONALLY RENDERED, never merely hidden. A row that is only visually hidden stays in
          the accessibility tree and the focus order, so tabbing would walk into eight invisible
          tiles the moment it closed. Absence is the only version of "closed" that is true for a
          keyboard and a screen reader at the same time.
          It lives INSIDE `.chdr`, which is fixed - so opening it grows the bar over the content and
          never pushes it, exactly as the bar itself does. */}
      {sportsOpen ? (
        <div className="chdr-sports" id="chdr-sports">
          <SportFilter sport={P.sport} onPicked={() => setSportsOpen(false)} setOpts={KEEP_SCROLL} />
        </div>
      ) : null}
    </div>
  );
}
