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
//
// PROMPT 60 REPLACED THE LAST OF THOSE, and it is the one thing about this bar that changed
// shape. It read "SCROLL POSITION ALONE owns the state. There is no manual expand control."
// Joe designed the successor across four exchanges on 2026-09-07:
//
//   SCROLL ONLY EVER COLLAPSES. IT NEVER EXPANDS.
//
// Expansion is manual and is this bar's own wordmark. Scrolling back to the top leaves the
// header collapsed, which is what "the navbar would remain permanently in place from that point
// forward" asks for. lib/headerstate.js carries the whole machine, the reason the asymmetry
// removes the two-inputs-one-state conflict, and the compensation that keeps it from jumping.
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
// THE LIST-VIEW-ONLY EXCLUSION IS LIFTED, AND WHAT IT WAS HEDGING AGAINST WAS MEASURED.
//
// Prompt 58 shipped this bar in list view only. The hedge was that `.mgrid-scroll` sets
// `touch-action: pan-x pan-y` and runs a pinch handler, so a fixed bar over the top 44px of that
// scroller would take touches there - untried on a device, and week mode stacks N such scrollers.
//
// IT HAD BECOME THE MORE VISIBLE DEFECT OF THE TWO. Tapping GRID in this bar sets `view=grid` with
// `{ scroll: false }`, so the reader does not move - but the exclusion then cleared the collapsed
// state, the banner and the control stack came back into the flow, and ~340px arrived above the
// reader with no compensation. Measured: collapsed at scrollY 904, tapping GRID left scrollY 759
// with the grid's top at -335 and the bar gone. The control deleted itself with the tap that used
// it, which is the exact failure `KEEP_SCROLL` exists to prevent.
//
// WHAT THE TOUCH TEST FOUND is recorded beside the `view` toggle below and in register §28h.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { resolveHubParams } from '../lib/hubparams.js';
import { todayET } from '../lib/format.js';
import { SPORT_LABEL } from '../lib/config.js';
import { useSetParam, SportFilter, chipMarkUrl } from './Filters.js';
import {
  SENTINEL_ID, subscribeHeader, headerCollapsed, headerCollapsedOnServer,
  collapseHeader, expandHeader, scrollCollapseSuspended,
} from '../lib/headerstate.js';

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

/* `SENTINEL_ID` MOVED TO lib/headerstate.js (prompt 60). Three files need it now - this one, the
   `Controls` block in app/page.js that renders it, and the state module that measures it - and
   the module is the only one of the three all of them already import. It is also no longer "the
   element in layout.js": the sentinel moved out of the layout in the same change. */

export default function CollapsedHeader() {
  /**
   * FALSE ON THE SERVER AND ON THE FIRST CLIENT RENDER. That equality is the whole hydration
   * story, and `headerCollapsedOnServer` is a constant `false` rather than a read of the module's
   * variable so it stays true even if an earlier request in the same process collapsed something.
   *
   * IT IS AN EXTERNAL STORE RATHER THAN `useState` (prompt 60) because THREE surfaces now share
   * this one boolean and only two of them are in this tree: the TV button drawn over the banner,
   * and the page's own control stack - which is rendered by a SERVER component and can hold no
   * client state at all. The layout half of the change therefore travels as an attribute on
   * <html> and the CSS does the hiding; this subscription only keeps the bar's markup in step.
   */
  const collapsed = useSyncExternalStore(subscribeHeader, headerCollapsed, headerCollapsedOnServer);
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

  // ONE DECIDER FOR WHAT A QUERY STRING MEANS. `resolveHubParams` is that decider (hubparams.js is
  // explicit that nothing else may be), so this asks it rather than reading `view` itself and
  // inventing a second answer. `todayET()` only feeds `day`, which this component never reads.
  //
  const P = resolveHubParams(Object.fromEntries(params.entries()), todayET());

  useEffect(() => {
    // AN OBSERVER, NEVER A SCROLL LISTENER. A scroll handler fires every frame and this app has
    // never had one; an IntersectionObserver is a callback on a threshold crossing and costs
    // nothing between crossings.
    const el = document.getElementById(SENTINEL_ID);
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    // SCROLL ONLY EVER COLLAPSES (prompt 60). This was `setCollapsed(!entry.isIntersecting)` - a
    // two-way binding, so scrolling back to the top re-expanded the header. The one-way form is
    // not a restriction on the reader; it is what lets a TAP own the other direction without the
    // two inputs ever contradicting each other. Never restore the else.
    // SUSPENDED DURING A PROGRAMMATIC SCROLL (prompt 71). AutoScroll's landing crosses this
    // sentinel, and Joe's banner should survive that: "once you change to week view it closes the
    // banner since the screen auto scrolls to the current day".
    //
    // AND THE RE-ARM NEEDS NO USER-SCROLL GATE, BECAUSE THIS IS A CROSSING AND NOT A POSITION. An
    // IntersectionObserver fires when the intersection STATE CHANGES. The auto-scroll takes the
    // sentinel from intersecting to not, that one callback is suppressed, and the state then sits at
    // "not intersecting" - so releasing the flag afterwards produces no callback at all. The next one
    // comes when the reader scrolls back up (it intersects again) and then down (it leaves), which is
    // exactly the manual collapse Joe asked to keep. A position check would have re-collapsed
    // instantly; this does not. Measured, not reasoned - see the prompt-71 report.
    const io = new IntersectionObserver(
      ([entry]) => { if (!entry.isIntersecting && !scrollCollapseSuspended()) collapseHeader(); },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // `resetHeader()` LIVED HERE AND IS GONE with the exclusion. It existed for one job: grid view
  // could not sit collapsed, because there was no bar there to replace the banner it had hidden.
  // With the bar rendering in every view there is nothing left for it to do, and it had no other
  // caller in the repo - so it is deleted from lib/headerstate.js rather than left as a function
  // nothing calls. The observer's dependency list empties for the same reason.

  /**
   * `--stack-h` - THE BAR'S REAL RENDERED HEIGHT, ON `<html>`, FOR THE PICKER'S STICKY OFFSET.
   *
   * Both `.chdr` and `.pickrow` are sticky now: the bar sticks at 0 and GROWS when the league row
   * opens, so a picker stuck at the closed height would slide underneath it. The offset has to
   * track the bar.
   *
   * A ResizeObserver rather than arithmetic, and that is the point: the bar's height is 44 plus
   * `env(safe-area-inset-top)` plus the league row when open, and only the browser knows the first
   * two. Measuring the element carries all three, and keeps carrying them if the bar ever changes
   * height for a reason nobody has thought of yet.
   *
   * ON THE FRAME THE ROW OPENS, NOT ONE LATER. ResizeObserver delivers between layout and paint, so
   * the custom property is updated before the frame that first shows the taller bar is painted -
   * there is no frame in which the picker sits at the old offset. Verified in the browser by
   * measuring the picker's top against the bar's bottom immediately after the tap; qa-shots pins it.
   */
  useEffect(() => {
    const el = document.querySelector('.chdr');
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const write = () => {
      document.documentElement.style.setProperty(
        '--stack-h', `${el.getBoundingClientRect().height}px`);
    };
    write();
    const ro = new ResizeObserver(write);
    // BORDER-BOX, NOT THE DEFAULT CONTENT-BOX (prompt 63 stage 2). `.chdr` pads itself by
    // `env(safe-area-inset-top)`, and an inset change moves the BORDER box while leaving the content
    // box exactly as it was - so a content-box observer never fires and `--stack-h` keeps a stale
    // height. Reproduced: with the inset raised to 59 after mount, `.chdr` measured 103px while
    // `--stack-h` still read 44px, which parks the picker 59px too high and opens a strip of
    // schedule between the navbar's hairline and the picker. That is the "more space above the
    // picker than below" Joe reported, and why he only saw it on a device.
    ro.observe(el, { box: 'border-box' });
    return () => ro.disconnect();
  }, []);

  /**
   * `--pick-h` - THE PICKER'S REAL RENDERED HEIGHT, FOR THE TIME ROW'S STICKY OFFSET (prompt 86
   * block C). The grid's axis pins at `--stack-h + --pick-h`, flush under the picker, so it needs
   * the picker's height the way the picker needs the bar's.
   *
   * ITS OWN OBSERVER, NOT A SECOND TARGET ON THE ONE ABOVE: one observer per element, so each
   * callback writes exactly one property and neither can go stale because of the other.
   *
   * BOUNDING RECT AND BORDER-BOX, for the reason the note above records: a content-box observer on
   * `.chdr` missed an inset change and parked the picker 59px too high. `.pickrow`'s height changes
   * with its PADDING when the header collapses (8px top and bottom), which moves the border box and
   * not the content box - the same shape.
   *
   * THE PICKER IS NOT THIS COMPONENT'S NODE. `.chdr` is rendered here, in the layout, and lives as
   * long as it does; `.pickrow` is rendered by app/page.js, so a navigation that remounts the page
   * would leave an observer holding a detached element. So every callback checks the node is still
   * connected and, if not, finds the new one and observes that instead - a removed element's box
   * goes to zero, which is itself a resize, so the observer is woken by exactly the event it needs.
   */
  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return undefined;
    let el = document.querySelector('.pickrow');
    if (!el) return undefined;
    const root = document.documentElement;
    const ro = new ResizeObserver(() => {
      if (!el.isConnected) {
        ro.unobserve(el);
        const next = document.querySelector('.pickrow');
        if (!next) return;
        el = next;
        ro.observe(el, { box: 'border-box' });
      }
      root.style.setProperty('--pick-h', `${el.getBoundingClientRect().height}px`);
    });
    root.style.setProperty('--pick-h', `${el.getBoundingClientRect().height}px`);
    ro.observe(el, { box: 'border-box' });
    return () => ro.disconnect();
  }, []);

  // THE TILE ROW CLOSES WITH THE BAR. Expanding restores the full control stack, which contains
  // the same eight tiles; leaving this open would render the row twice, once in a bar nobody can
  // see.
  useEffect(() => {
    if (!collapsed) setSportsOpen(false);
  }, [collapsed]);

  // THE FOUR CURRENT CHOICES, in the control stack's own order: the page reads DAY, ALL GAMES,
  // LIST, ALL SPORTS downward when expanded, and left to right here.
  //
  // THE SPORT USED TO BE A SHORT TEXT LABEL and this note used to explain why - `SPORT_LABEL.cfb`
  // is "College Football" at 93.3px against an ALL SPORTS target of 57.5px, so the display name
  // would have broken the row the moment CFB was selected, and `SPORT_SHORT` was that fact in one
  // place. PROMPT 60 RETIRED THE QUESTION: the column shows the league's MARK now, so there is no
  // text to be too long. `SPORT_SHORT` is no longer imported here at all - the width problem it
  // solved is not this component's any more, and the constraint that replaced it is the 56px cap on
  // `.chdr-mark`. (It read 58 until this commit: stage 3 tightened the cap to 56 to buy the
  // invariant that a league mark can only ever make the row narrower, and left this note behind.)
  //
  // DELIBERATELY ABSENT, so nobody helpfully adds it: THE DATE AND WEEK PICKER. There is no room,
  // and it is not a regression - changing the viewing day already means scrolling to the top today.
  // Tapping DAY flips the MODE, not the date.
  /**
   * THE THREE BINARIES ARE VERTICAL SLIDER TOGGLES (prompt 60 stage 2). Joe, 2026-09-07:
   *
   *   "Could these three choices be rendered as VERTICAL slider toggles? Day over Week, All Games
   *    over My Teams, List View over Grid View. All would render in the navbar with the selected
   *    button in gold."
   *
   * BOTH LABELS ARE VISIBLE AND THE ORDER NEVER MOVES. "Day over Week" is a fixed arrangement, not
   * live-on-top: a control whose two words swap places on every tap is a control the eye has to
   * re-read each time. The gold moves; the words do not.
   *
   * ONE TAP TARGET PER CONTROL, NOT TWO. With exactly two states, tapping the control and tapping
   * the inactive label are the same action - so a second 44px target would double this bar's
   * permanent cost to buy a duplicate of the tap it already has. That is what keeps the bar at 44px,
   * which is the height Joe chose over 88 (see globals.css for why the tagline could not come back
   * with the extra 44).
   *
   * THE ACCESSIBILITY PATTERN IS PROMPT 58'S, AND IT IS UNCHANGED ON PURPOSE.
   *
   * `Filters.js` records why the EXPANDED toggles are `role="radiogroup"` + `aria-checked`: each is
   * exactly one of two, and exclusivity should be announced rather than inferred. Register §17
   * records that the eight league tiles keep `aria-pressed`, because a filter that can be CLEARED
   * is not a one-of-N choice.
   *
   * THIS IS NEITHER, AND SHOWING BOTH WORDS DID NOT CHANGE THAT. It is still ONE control, so there
   * is no group of two for a radiogroup to describe and nothing that is "pressed". The second word
   * is a LABEL FOR THE DESTINATION, not a second option. So the pattern stays what it was: a plain
   * button whose accessible name states the current state and then the action.
   *
   *     <button aria-label="Time range: Day. Switch to Week">DAY / WEEK</button>
   *
   * What DID change is that the name now has to do MORE work, not less. A sighted reader learns the
   * state from the gold; a screen-reader user never hears the colour, and `aria-label` replaces the
   * visible text rather than adding to it - so if the name did not say which of the two is live,
   * that reader would be told the pair and never told the answer. Splitting state from action with
   * a full stop rather than a dash is deliberate: a dash is read as a pause, not a boundary.
   *
   * THE VIEW TOGGLE IS A REAL TWO-WAY CONTROL NOW, and it had to become one with the exclusion.
   * It was hardcoded `topIsOn: true` and `setParam('view', 'grid')`, which was correct only while
   * the bar could not render in grid view: in grid view that markup would have painted LIST in gold
   * while the reader was looking at a grid, and the tap would have set `view=grid` a second time -
   * a control that lies about the state and then does nothing.
   */
  const binaries = [
    { key: 'mode', top: 'DAY', bottom: 'WEEK', topIsOn: !P.isWeek,
      name: `Time range: ${P.isWeek ? 'Week' : 'Day'}. Switch to ${P.isWeek ? 'Day' : 'Week'}`,
      // `day` and `w` both stay in the URL - each is read only in its own mode - and the DEFAULT is
      // removed rather than written, which is what keeps `/` the canonical default state.
      onPick: () => setParam('mode', P.isWeek ? null : 'week', KEEP_SCROLL) },
    { key: 'scope', top: 'ALL GAMES', bottom: 'MY TEAMS', topIsOn: !P.isMine,
      name: `Scope: ${P.isMine ? 'My teams' : 'All games'}. Switch to ${P.isMine ? 'All games' : 'My teams'}`,
      onPick: () => setParam('scope', P.isMine ? null : 'mine', KEEP_SCROLL) },
    // LIST STAYS ON TOP IN BOTH STATES - the order is an arrangement, not a sort, exactly as the
    // two toggles above it. Only the gold moves.
    //
    // `LIST` / `GRID`, NOT `LIST VIEW` / `GRID VIEW`, AND THE MEASUREMENT DECIDED IT. Joe's wording
    // is the long pair and it was measured first, at four viewports with the real font: it needs
    // 233.44px of run against 221.73px of room at 360 and 228.13px at 390 - so it overflows by
    // 11.71px on a small phone and by 5.31px on Joe's own. It fits only at 375 (+3.3) and 430
    // (+34.69), which is to say it fails at both ends of the range that matters. The short pair is
    // 221.58px and fits everywhere, with +0.16 at 360 and +6.55 at 390.
    //
    // AND THE NOUN IS LESS NEEDED HERE THAN IT WAS. Prompt 58 dropped it from a run of four single
    // words on the argument that "view" was the one word droppable without losing the meaning. As a
    // PAIR the case is stronger, not weaker: LIST over GRID is self-evidently a choice of
    // presentation, because the two words only contrast in that one dimension.
    { key: 'view', top: 'LIST', bottom: 'GRID', topIsOn: !P.isGrid,
      name: `Presentation: ${P.isGrid ? 'Grid view' : 'List view'}. Switch to ${P.isGrid ? 'List view' : 'Grid view'}`,
      // `null` rather than `'list'`, matching `ScopeViewToggles`: the DEFAULT is removed from the
      // URL rather than written into it, which is what keeps `/` the canonical default state.
      onPick: () => setParam('view', P.isGrid ? null : 'grid', KEEP_SCROLL) },
  ];

  // THE FOURTH COLUMN IS THE LIVE TILE (prompt 60 stage 3). Joe: "a tiny arrow gets embedded
  // under 'All Sports' indicating that a tap will open a submenu, at that submenu is the league
  // tiles. In the event the user selects a tile - that tile then takes the place of 'All Sports' in
  // the navbar."
  //
  // The words when nothing is chosen, the league's own mark when something is. `SPORT_SHORT` is no
  // longer read here and neither is a short text label: a tile that "takes the place of ALL SPORTS"
  // is the tile, not its abbreviation, and the marks are what Joe recognises (§13's ruling for the
  // row itself, which this now matches).
  const tileMark = chipMarkUrl(P.sport);

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
    <div className="chdr" aria-hidden={!collapsed}>
      <div className="chdr-inner">
        {/* THE WORDMARK IS THE ONLY WAY BACK (prompt 60). Joe: "...until the user taps 'MySports
            TV' in which case the full banner and expanded toggles would appear atop the app."
            A <span> until this prompt, so it becomes a real <button> for the same reason the TV
            did - it takes the bar's full 44px height, it is in the tab order, and it paints the
            same gold focus ring the other controls do. The gradient fill is untouched:
            `.chdr-wm` still carries it, and only the element under it changed.
            The name says the ACTION, matching the pattern the three binaries use; "MySports TV"
            alone would be read as a title rather than as a control. */}
        <button type="button" className="chdr-wm" aria-label="Expand the banner and the controls"
                onClick={() => expandHeader()}>
          {/* THE SPAN EXISTS TO CARRY AN OPTICAL SHIFT, and nothing else (prompt 61 stage 5b).
              `.chdr-wm` is a flex container, so a bare text node becomes an ANONYMOUS flex item -
              which CSS cannot target. All-caps Barlow Condensed sits low in its em box, so
              `align-items: center` centres the LINE BOX and leaves the ink 2.5px off-centre at 390;
              the span is the only handle for moving the glyphs without moving the button.
              It is offset with `position: relative`, NOT a transform on the button: the button's
              44px box is the tap target on purpose (see the note above), and a transform would take
              the hit area down with the ink. Measured before and after to prove it did not. */}
          <span className="chdr-wm-ink">MYSPORTS TV</span>
        </button>
        <div className="chdr-run">
          {binaries.map((c) => (
            <button key={c.key} type="button" className="chdr-toggle" data-key={c.key}
                    aria-label={c.name} onClick={c.onPick}>
              {/* aria-hidden on BOTH words, not just the inactive one. The accessible name above
                  already carries the state and the action in a sentence; leaving these readable
                  would have a screen reader announce the pair twice, once as prose and once as two
                  loose words with no indication which is which. */}
              <span className="chdr-opt" data-on={c.topIsOn} aria-hidden="true">{c.top}</span>
              <span className="chdr-opt" data-on={!c.topIsOn} aria-hidden="true">{c.bottom}</span>
            </button>
          ))}
          <button type="button" className="chdr-tile" data-key="sport" data-open={sportsOpen}
                  aria-label={`Sport: ${P.sport ? (SPORT_LABEL[P.sport] || P.sport) : 'All sports'}`}
                  aria-expanded={sportsOpen} aria-controls="chdr-sports"
                  onClick={() => setSportsOpen((v) => !v)}>
            {tileMark ? (
              // alt="" because `aria-label` on the button already names the league. An alt here
              // would have a screen reader say it twice, which is the same ruling the tile row
              // itself carries.
              <img className="chdr-mark" src={tileMark} alt="" />
            ) : (
              <span className="chdr-opt" data-on="true" aria-hidden="true">ALL SPORTS</span>
            )}
            {/* THE CARET IS WHAT MAKES EVERY COLUMN A TWO-LINE STACK, which is the other half of
                why it is here: without it this column would be one line among three stacks and the
                row would read as uneven. Drawn rather than typed - a glyph like the black
                down-pointing triangle renders at a different size and baseline in every font on
                the shelf, and this one has to sit level with three lines of type it does not
                share a font with. */}
            <svg className="chdr-caret" viewBox="0 0 10 6" width="10" height="6"
                 aria-hidden="true" focusable="false">
              <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6"
                    strokeLinecap="round" strokeLinejoin="round" />
            </svg>
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
