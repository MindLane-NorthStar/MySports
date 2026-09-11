'use client';

// The mobile grid - docs/rendering-contract-mobile.md, M1 through M13.
//
// Built from the day's feed, not from the archival SVG: the SVG is a fixed 1806px-wide artefact, and
// the addendum's whole point is that a phone gets its own time scale. Everything the PC contract says
// about block anatomy still holds (M13); only the rules named M1-M12 differ.
//
// Layout: one horizontal scroller. The network rail is `position: sticky; left: 0` INSIDE it, so
// panning moves only the schedule (M4). ZOOM DRIVES THE SCALE MODEL, not a CSS transform: pinching
// multiplies pxPerMin, so the canvas's real laid-out width, every block's left/width and the axis
// ticks all grow together through layout (M6).
//
// IT USED TO BE `transform: scale(zoom)` ON THE CANVAS, and that broke M4. A transformed element
// becomes the containing block for its descendants, so the sticky rail resolved against the scaled
// canvas instead of the scrollport and travelled with the content - Joe saw it slide out from the
// left edge and across the grid on his phone. Measured in Chromium before the change, after
// panning fully right: the rail sat +124.6px right of the scroller at zoom 2.5 and -272.8px left
// at 0.6, against 0px at zoom 1. Compositing hints (will-change, translateZ) change WHEN that
// appears, never whether it does.
//
// The same transform caused prompt 25's other finding - scrollWidth stayed at the unzoomed layout
// width, leaving ~418px of dead scroll past the end at zoom 0.6. One cause, both symptoms, one fix.

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BLOCK_H,
  TRAY_H,
  LANE_GAP,
  blockMinutes,
  pxPerMinute,
  collapseGaps,
  makeScale,
  axisTicks,
  clockShort,
  packLanes,
  viewingMinutes,
  bandFor,
  gridColourFor,
  tint,
  inkFor,
  capFor,
  CAP_TINT,
} from '../lib/gridmodel.js';
import { splitOverlaps } from '../lib/overlap.js';
// Moved to lib so the listings card can measure with the same canvas and the same faces.
import { useTextMeasurer } from '../lib/useTextMeasurer.js';
// sportMarkUrl and SPORT_LABEL went with the grid's header (prompt 50 stage 5a): the tile row
// above the grid is what states the sport now.
import { teamLogoUrl, teamLogoDarkUrl, teamLogoCapUrl } from '../lib/config.js';
import { markStyle, hasMark, railMark } from '../lib/marks.js';
// longDay went with the header too - the picker directly above the grid carries the date.
import { etTime } from '../lib/format.js';
import { cardName, cardBroadcast } from './MatchupCard.js';
import { recordText, standingFor } from '../lib/standings.js';
import { railLabel } from '../lib/raillabel.js';
// 05 section 9: the SAME predicate the listings use. The grid must not re-derive it - two
// definitions of "nobody has announced this" would drift, and the band's count line and the
// grid's note would then disagree about the same games on the same screen.
import { isNetworkTbd } from '../lib/offservice.js';
import {
  brandFor, crewNames, eligibilityMissing, fitCrew, isOpenEnded, isProgram, markAspect,
  programMinutes,
  seamGradient, subtitleFor, titleFor, tintToWhite, washGradient, CREW_INK, ENDCAP_GRADIENT,
} from '../lib/programs.js';
import { programBroadcast } from './ProgramCard.js';

const SCALE = 0.8; // M1: all grid content renders at 80% of contract design size
const SEAM_PX = 30; // the dashed cut occupies this much of the axis (M3)
// CAP_TINT now comes from gridmodel beside capFor(), because it is one of TWO cap surfaces rather
// than the single global value B5 shipped. See the note at the cap.



/**
 * Is every component of this record zero? (contract v1.6.14)
 *
 * Records arrive as `W-L` (most sports), `W-L-OTL` (NHL) and, in principle, four parts. Splitting on
 * the separator and testing the numbers covers all of them and cannot be surprised by a new arity;
 * a literal pattern can, and did. A record with any non-numeric component is NOT all-zero - it is
 * something this function does not understand, and suppressing it would hide real data.
 */
function allZeroRecord(rec) {
  if (!rec) return false;
  const parts = String(rec).trim().split('-');
  if (parts.length < 2) return false;
  return parts.every((x) => /^\d+$/.test(x) && Number(x) === 0);
}

/**
 * The record run beside a name (contract v1.1). `games.home_record` / `away_record` are the CFB
 * enrichment path's desktop form, and GAME_SELECT (web/lib/queries.js) does not select them, so
 * `stored` is always undefined here and the run comes from the club's current team_records row - the
 * same number the listings card shows. CFB rows land there from pipeline/enrich_cfb.py (prompt 90).
 * A club with no row simply has no run, which is the contract's "suppressed at 0-0" behaviour by
 * another route.
 */
function teamLine(game, side, standings) {
  const t = side === 'home' ? game.home : game.away;
  const rank = side === 'home' ? game.home_rank : game.away_rank;
  const stored = side === 'home' ? game.home_record : game.away_record;
  const row = standings ? standingFor(standings, t?.id, game.season) : null;
  const rec = stored || (row ? recordText(row, game.sport) : null);
  // CONTRACT §3 / v1.6.14: "never (0-0)". A team that has not played tells the reader nothing, and
  // on a week-1 slate it is every team - the Steelers block read "FALCONS0-0 / @STEELERS0-0" before
  // prompt 31. PARSED, not matched against literals: the old test was /^0-0(-0)?$/, which covered the
  // two shapes that existed when it was written and would have missed a four-part record. A record
  // is absent when every component of it is zero, whatever the arity.
  const shownRec = allZeroRecord(rec) ? null : rec || null;
  return {
    rank: Number.isInteger(rank) && rank > 0 ? String(rank) : null,
    name: (cardName(t, side === 'home' ? game.home_team_id : game.away_team_id) || '').toUpperCase(),
    record: shownRec,
    color: t?.primary_color,
    color2: t?.secondary_color,
    id: t?.id,
  };
}

export default function MobileGrid({ games, sport, day, standings, onOpen, nowMinute = null }) {
  const { measure, ready } = useTextMeasurer();

  const model = useMemo(() => {
    // D3: PER GAME, not per page. Block length is policy per sport - CFB and NFL 210 minutes, NHL
    // and NBA 150, MLB 180 - so an ALL grid that used one number would draw every baseball game
    // three and a half hours wide. On a single-sport page every g.sport equals `sport`, so this is
    // exactly the old value there and the frozen geometry does not move.
    const timed = [];
    const tbd = [];
    for (const g of games || []) {
      const start = viewingMinutes(g.canonical_kickoff_at_utc);
      const known = g.kickoff_status !== 'tbd' && start !== null;
      // v1.7: a PROGRAM's broadcast row is chosen by its own rule - it has no `is_primary` written
      // by the reconciler, which only ever ran over games - and its length is its own duration, not
      // the sport's block policy. A 360-minute UFC card and a 120-minute Dynamite cannot share one
      // number the way two CFB games can.
      const program = isProgram(g);
      const b = program ? programBroadcast(g) : cardBroadcast(g);
      if (!known || !b) {
        tbd.push(g);
        continue;
      }
      const mins = program ? programMinutes(g) : blockMinutes(g.sport);
      timed.push({ game: g, start, end: start + mins, broadcast: b, program, mins });
    }

    // M2: measure the widest rendered team line on THIS slate, in the real fonts.
    const nameFont = `700 ${Math.round(15 * SCALE * 100) / 100}px 'Barlow Condensed', 'Arial Narrow', sans-serif`;
    let widest = 0;
    // A PROGRAM-ONLY DAY STILL NEEDS A SCALE. M2 derives pixels-per-minute from the widest rendered
    // line on the slate, and a race has no team lines at all - so a day of nothing but races would
    // measure 0 and collapse the axis. The program's TITLE is what it renders, so the title is what
    // it contributes, in the same font the block draws it in.
    const titleFont = `700 ${Math.round(15 * SCALE * 100) / 100}px 'Barlow Condensed', 'Arial Narrow', sans-serif`;
    for (const it of timed) {
      if (!it.program) continue;
      widest = Math.max(widest, measure(titleFor(it.game), titleFont));
    }
    for (const it of timed) {
      if (it.program) continue;
      for (const side of ['home', 'away']) {
        const l = teamLine(it.game, side, standings);
        const at = side === 'home' ? '@ ' : '';
        // v1.6.14: ONE space before the record, and it is a real space in the NAME's font - the
        // same thing the block renders, so this measurement and that render cannot disagree.
        const text = `${at}${l.rank ? `${l.rank} ` : ''}${l.name}${l.record ? ` ${l.record}` : ''}`;
        widest = Math.max(widest, measure(text, nameFont));
      }
    }
    // D3: the scale is set by the SHORTEST block on the slate. pxPerMinute divides the widest team
    // line by a duration, so the smallest duration yields the largest pixels-per-minute - and M2's
    // guarantee is that the NARROWEST block still fits the widest name. Picking the page sport (or
    // the longest) would let a 150-minute NHL block fall under that width and wrap a name, which is
    // the one thing M2 says cannot happen by construction. One sport present: unchanged.
    // Programs are excluded from the scale-sport choice: their length is per-program, so there is no
    // policy number for them to contribute, and letting a 120-minute show act as the shortest block
    // would rescale every game on the day around a show.
    const present = [...new Set(timed.filter((t) => !t.program).map((t) => t.game.sport))];
    const scaleSport = present.length
      ? present.reduce((a, b) => (blockMinutes(b) < blockMinutes(a) ? b : a))
      : sport;
    const pxPerMin = pxPerMinute(widest / SCALE, scaleSport) * SCALE;

    const { segments, cuts } = collapseGaps(
      timed.map((t) => ({ start: t.start, end: t.end })),
      60
    );
    const scale = makeScale(segments, pxPerMin, SEAM_PX);
    const ticks = axisTicks(segments);

    // rows = the networks actually carrying something, in the contract's rail order (M10 omits empties)
    const byNet = new Map();
    for (const it of timed) {
      const id = it.broadcast.service_id;
      if (!byNet.has(id)) {
        byNet.set(id, {
          id,
          name: it.broadcast.network?.canonical_name || it.broadcast.label || id,
          order: it.broadcast.network?.default_sort_order ?? 9999,
          streaming: it.broadcast.delivery_surface === 'STREAMING',
          items: [],
        });
      }
      byNet.get(id).items.push(it);
    }
    const rows = [...byNet.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    // OVERLAP RULE (contract v1.6.5): before packing lanes, let overlapping pairs on the SAME network
    // split the difference so they share one row. Block lengths are policy, not measurement - every
    // CFB game is drawn 210 minutes wide - so a 12:30 and a 3:30 on one network overlap by 30 minutes
    // purely as an artefact of that estimate, and that artefact alone was generating an extra row.
    //
    // PRESENTATIONAL ONLY: the adjusted start/end drive the chip's x and width, and nothing else. The
    // item keeps its game, so the detail panel still shows the real kickoff.
    let guardHits = 0;
    for (const r of rows) {
      const { items, guarded } = splitOverlaps(r.items);
      guardHits += guarded.length;
      // carry the adjustment onto the render items, leaving every other field alone
      r.items = r.items.map((it, k) => ({ ...it, start: items[k].start, end: items[k].end }));
      r.lanes = packLanes(r.items);
    }

    // The tbd bucket has always held two different problems: a game whose KICKOFF is unknown and a
    // game whose NETWORK is unknown. Both are unplaceable, but only one of them is the
    // announcement horizon, and the footer was reporting them as one number - "46 kickoff /
    // network TBA" on 2026-11-14, when 45 of those had a known kickoff and no broadcaster at all.
    // Partitioned here so the grid can name each in its own words. Every game stays in `tbd` and
    // still gets its M7 card; this splits the COUNT, not the list.
    const netTbd = tbd.filter((g) => isNetworkTbd(g));
    const kickTbd = tbd.filter((g) => !isNetworkTbd(g));

    // `segments` and `pxPerMin` come out so the zoomed scale can be rebuilt WITHOUT re-running any
    // of the above. The costly part of this memo is M2's text measurement, one measure() per team
    // line, and it does not depend on zoom - neither does the overlap split or the lane packing,
    // which both work in MINUTES. Keeping them on these deps is what makes a pinch frame cheap.
    return { rows, scale, ticks, cuts, pxPerMin, segments, tbd, netTbd, kickTbd,
             blockMins: blockMinutes(scaleSport), widest, guardHits };
  }, [games, sport, measure, ready, standings]);

  // M6: pinch-to-zoom over the canvas. The rail is sticky in the SCROLLER, which now has no
  // transformed ancestor, so it holds the left edge natively at every level.
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef(null);
  const axisRef = useRef(null);
  const pinch = useRef(null);

  // THE PINCH LISTENS ON THE TIME ROW TOO (prompt 86 block C). The axis used to live inside the
  // scroller and took its gestures for free; hoisted out to pin under the picker, it became a 28px
  // strip that ignored them - qa-shots' "the same pinch 60px lower works normally" landed on it and
  // failed. Same handlers, second element: a pinch is a pinch wherever the two fingers start.
  useEffect(() => {
    const targets = [scrollRef.current, axisRef.current].filter(Boolean);
    if (!targets.length) return undefined;
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    function onStart(e) {
      if (e.touches.length === 2) pinch.current = { d: dist(e.touches), z: zoom };
    }
    function onMove(e) {
      if (e.touches.length === 2 && pinch.current) {
        e.preventDefault();
        const next = Math.min(2.5, Math.max(0.6, (pinch.current.z * dist(e.touches)) / pinch.current.d));
        setZoom(next);
      }
    }
    function onEnd() {
      pinch.current = null;
    }
    for (const el of targets) {
      el.addEventListener('touchstart', onStart, { passive: true });
      el.addEventListener('touchmove', onMove, { passive: false });
      el.addEventListener('touchend', onEnd);
    }
    return () => {
      for (const el of targets) {
        el.removeEventListener('touchstart', onStart);
        el.removeEventListener('touchmove', onMove);
        el.removeEventListener('touchend', onEnd);
      }
    };
  }, [zoom]);

  // AND A SWIPE ON THE TIME ROW STILL PANS THE GRID. Inside the scroller that was native; outside it,
  // one finger dragging across the row moves the scroller by the same distance, and the scroll it
  // causes is what the axis sync (below) follows - so the row and the columns cannot part company.
  // No momentum on this one strip, which native panning had; the columns below keep theirs. Passive:
  // it never cancels anything, and `touch-action` on the row leaves vertical page scroll to the
  // browser.
  useEffect(() => {
    const axis = axisRef.current;
    const el = scrollRef.current;
    if (!axis || !el) return undefined;
    let drag = null;
    function onStart(e) {
      drag = e.touches.length === 1 ? { x: e.touches[0].clientX, left: el.scrollLeft } : null;
    }
    function onMove(e) {
      if (drag && e.touches.length === 1) el.scrollLeft = drag.left - (e.touches[0].clientX - drag.x);
    }
    function onEnd() {
      drag = null;
    }
    axis.addEventListener('touchstart', onStart, { passive: true });
    axis.addEventListener('touchmove', onMove, { passive: true });
    axis.addEventListener('touchend', onEnd);
    return () => {
      axis.removeEventListener('touchstart', onStart);
      axis.removeEventListener('touchmove', onMove);
      axis.removeEventListener('touchend', onEnd);
    };
  }, [model.rows.length]);

  const { rows, ticks, cuts, tbd, netTbd, kickTbd } = model;

  // THE ZOOM. makeScale is O(segments) - a handful of entries - so rebuilding it on every pinch
  // frame is arithmetic, not layout work, and everything expensive stays in the memo above.
  // Scaling pxPerMin rather than the painted pixels is what keeps scrollWidth honest: the canvas
  // really is this wide, so the scroller has nothing to disagree with.
  const scale = useMemo(
    () => makeScale(model.segments, model.pxPerMin * zoom, SEAM_PX),
    [model.segments, model.pxPerMin, zoom],
  );
  /**
   * THE TIME ROW TRAVELS WITH THE COLUMNS FROM OUTSIDE THE SCROLLER (prompt 86 block C, Route A).
   *
   * The axis was hoisted out of `.mgrid-scroll` so it can pin under the picker on a downward scroll:
   * a box with non-visible overflow on EITHER axis is a scroll container in BOTH, so a sticky `top`
   * inside the scroller resolved against a box that never scrolls vertically, and did nothing.
   * Outside it, the axis no longer pans natively - so this puts it back in step.
   *
   * THE TRANSFORM GOES ON THE TRACK AND NOTHING ELSE. M4: nothing between `.mrail-cell` and
   * `.mgrid-scroll` may carry a transform, because a transformed ancestor becomes the rail's
   * containing block and the rail slides (prompt 30). The track is no longer an ancestor of the
   * rail - the rail lives in `.mgrid-row`, inside the scroller - and stickytimes.test.mjs pins that.
   *
   * WRITTEN STRAIGHT TO THE NODE, never through React state: state would re-render the whole grid on
   * every scroll frame. COALESCED to one write per frame - scroll events fire before animation
   * frames in the same rendering update, so the write lands in the frame the scroll does. PASSIVE,
   * because it never cancels anything. Re-run when the scale changes, so a pinch-zoom (which moves
   * scrollLeft by clamping) cannot leave the strip behind.
   *
   * THE ONE SCROLL LISTENER IN THIS APP, deliberately - collapsedheader.test.mjs allows exactly this
   * one, on this element, and still forbids any on the page.
   */
  const trackRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    const track = trackRef.current;
    if (!el || !track) return undefined;
    let frame = 0;
    const sync = () => {
      frame = 0;
      track.style.transform = `translateX(${-el.scrollLeft}px)`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(sync);
    };
    sync();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scale, rows.length]);

  const blockH = BLOCK_H * SCALE;
  const trayH = TRAY_H * SCALE;
  const laneH = blockH + trayH + LANE_GAP * SCALE;
  const onGrid = rows.reduce((n, r) => n + r.items.length, 0);

  function jumpTo(id) {
    const node = document.getElementById(`mrow-${id}`);
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (!rows.length && !tbd.length) {
    return <p className="empty">Nothing scheduled on this viewing day.</p>;
  }

  return (
    <section className="mgrid" aria-label="Mobile grid">
      {/* THE GRID'S OWN HEADER IS GONE (prompt 50 stage 5a), and this REVERSES prompt 37 stage B1,
          which rebuilt it into two lines with the league mark spanning both. Deliberate, and every
          piece it carried was checked against where that piece now lives before it was deleted:

            the league mark and the sport name -> the tile row above, which states the sport
            the date                           -> the picker, now directly above the grid
            "N ON THE GRID"                    -> the footer's own `{onGrid} on the grid` pill,
                                                  which is the SAME number, not stage 4's page line
            "N awaiting kickoff / network"     -> the footer splits it into its two honest halves:
                                                  the `N kickoff TBA` pill and .mgrid-note's
                                                  network-TBD line
            "N gaps cut"                       -> the footer prints one pill PER cut, naming the
                                                  range it skipped

          The last two are MORE information in the footer than the header carried, not less: the
          header summed two different unknowns into one number, which is the conflation prompt 24
          split apart in the first place. */}
      {/* M8: jump-to-network quick nav */}
      {rows.length > 1 ? (
        <nav className="mgrid-nav" aria-label="Jump to network">
          {/* D5: the network's own mark where it has one, its name where it does not - TBS, and every
              out-of-market RSN, have no published mark and are not going to grow one. The aria-label
              is unconditional so the accessible name is the network either way: an <img alt=""> in a
              button that has no other text leaves it announced as "button", nothing more. */}
          {rows.map((r) => {
            const mark = markStyle(r.id, 26);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => jumpTo(r.id)}
                aria-label={`Jump to ${r.name}`}
                data-mark={mark ? 'true' : 'false'}
              >
                {mark ? <img src={mark.src} height={mark.height} alt="" /> : r.name}
              </button>
            );
          })}
        </nav>
      ) : null}

      {/* M5: hour-only gold shorthand labels. Gridlines stay on :15.
          HOISTED OUT OF THE SCROLLER (prompt 86 block C) so it can pin under the picker on a
          downward scroll; its horizontal position is kept in step by the effect on `trackRef`.
          `data-minute` is diagnostic, like the canvas's data-*: it lets qa-shots find the SAME
          minute here and in the lanes and compare the two by number. */}
      <div className="mgrid-axis" ref={axisRef}>
        <div className="mgrid-axis-rail" />
        <div className="mgrid-axis-track" ref={trackRef} style={{ width: scale.width }}>
          {ticks.lines.map((l) => (
            <div
              key={`al-${l.minute}`}
              className="mgrid-line"
              data-hour={l.hour ? 'true' : 'false'}
              data-minute={l.minute}
              style={{ left: scale.toX(l.minute) }}
            />
          ))}
          {ticks.labels.map((l) => (
            <span key={`ax-${l.minute}`} className="maxis-label" data-minute={l.minute}
                  style={{ left: scale.toX(l.minute) }}>
              {l.text}
            </span>
          ))}
          {/* The now marker's segment through the time row. It used to cross the axis for free,
              because the axis was inside the canvas it spans; out here it is drawn once more at the
              same minute, so the gold hairline still runs unbroken from the labels to the last row. */}
          {nowMinute !== null && Number.isFinite(nowMinute) ? (
            <div className="mnow" aria-hidden="true" style={{ left: scale.toX(nowMinute) }} />
          ) : null}
        </div>
      </div>

      <div className="mgrid-scroll" ref={scrollRef}>
        {/* No transform. The width below is the real, laid-out width at this zoom. */}
        <div
          className="mgrid-canvas"
          style={{ width: `calc(var(--rail-w) + ${scale.width}px)` }}
          /* DIAGNOSTICS, and they exist to make one specific question answerable in one step.
           *
           * Every block width and the canvas width derive from `widest` - M2 measures the widest
           * rendered team line ON THIS SLATE, in the real fonts, and that line carries the team's
           * RECORD and its CFB poll rank. Both drift all season. Prompt 53 found the MLB tripwire
           * had moved with no code change at all, and it took a full stash-and-remeasure to prove
           * that. With these on the element, the next run compares `scrollWidth / widest`: if
           * `widest` moved and the RATIO held, that is the standings; if the RATIO moved, that is
           * code, and that is the stop. */
          data-day={day}
          data-widest={model.widest.toFixed(3)}
          data-pxpermin={model.pxPerMin.toFixed(6)}
        >
          {/* THE AXIS'S REACH, LEFT BEHIND ON PURPOSE (prompt 86 block C). An hour label on the last
              minute of the day starts AT the canvas's right edge and its text runs past it - CFB
              2026-09-05's "2AM" by 26.56px, MLB 2026-09-03's "10PM" by 13.17. While the axis lived
              in here, that overhang was part of the scroller's scrollable overflow, so a full pan
              right brought the last label into view. Hoisted out, it was not: scrollWidth fell 1273
              -> 1248 and 568 -> 556, geometry's day-span stop caught it, and at full pan the last
              label sat just past the right edge, unseen.
              So the SAME labels are laid out here once more - invisible, zero-height, inert - and
              reach exactly as far as they always did. Not `.mgrid-axis`, and nothing here is synced
              or transformed: it is extent, not a second time row. */}
          <div className="mgrid-axis-reach" aria-hidden="true">
            <div className="mgrid-axis-reach-rail" />
            <div className="mgrid-axis-reach-track" style={{ width: scale.width }}>
              {ticks.labels.map((l) => (
                <span key={`rx-${l.minute}`} className="maxis-reach-label" style={{ left: scale.toX(l.minute) }}>
                  {l.text}
                </span>
              ))}
            </div>
          </div>

          {/* THE NOW MARKER (contract v1.7). A vertical gold hairline at the current ET minute,
              across the full grid height, ABOVE the blocks and BELOW the sticky rail (z 2 against
              the rail's 3). It renders only when the page hands one down, which it does only for
              TODAY - an archived day is immutable and a week view has no single "now", so both
              simply pass null and nothing is drawn.
              POSITIONED SERVER-SIDE. `nowMinute` is computed from the REQUEST time in page.js and
              arrives as a number, so there is no clock in this component and no hydration mismatch;
              M11's existing 15-minute refresh is what moves it. */}
          {nowMinute !== null && Number.isFinite(nowMinute) ? (
            <div
              className="mnow"
              aria-hidden="true"
              style={{ left: `calc(var(--rail-w) + ${scale.toX(nowMinute)}px)` }}
            />
          ) : null}

          {rows.map((row) => (
            <div className="mgrid-row" key={row.id} id={`mrow-${row.id}`}>
              <div className="mrail-cell">
                <div className="mrail-mark">
                  {/* EQUAL INK AREA, not equal height (prompt 52 stage 5, Joe's 60/600 ruling).
                      This called `markStyle(row.id, 42).src` and used ONLY `.src` - the <img>
                      carried no height at all, so `hf` never reached the rail and CSS fit every
                      mark into the box on its own. That is why a 30px-tall NBC roundel read
                      smaller than a 25.8px FOX wordmark: same column, 71% less ink.
                      `railMark` returns a real width AND height; the CSS clamps stay as a
                      backstop but no longer bind, which stage 5 verified for all 28. */}
                  {hasMark(row.id) ? (() => {
                    const m = railMark(row.id);
                    return <img src={m.src} width={m.width} height={m.height}
                                alt={row.name} loading="lazy" />;
                  })() : null}
                </div>
                {/* a network WITH a mark needs no name under it; one without gets a derived
                    abbreviation of at most two short lines - never a mid-word ellipsis */}
                {hasMark(row.id) ? null : (
                  <div className="mrail-call" title={row.name}>
                    {railLabel(row.name).map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="mgrid-lanes" style={{ width: scale.width, height: row.lanes.length * laneH }}>
                {ticks.lines.map((l) => (
                  <div
                    key={`gl-${row.id}-${l.minute}`}
                    className="mgrid-line"
                    data-hour={l.hour ? 'true' : 'false'}
                    data-minute={l.minute}
                    style={{ left: scale.toX(l.minute) }}
                  />
                ))}
                {cuts.map((c) => (
                  <div key={`cut-${row.id}-${c.from}`} className="mgrid-cut" style={{ left: scale.toX(c.from) + SEAM_PX / 2 }} />
                ))}
                {row.lanes.map((lane, li) =>
                  lane.map((it) =>
                    it.program ? (
                      <ProgramBlock
                        key={it.game.id}
                        item={it}
                        scale={scale}
                        top={li * laneH}
                        blockH={blockH}
                        trayH={trayH}
                        onOpen={onOpen}
                        measure={measure}
                      />
                    ) : (
                      <Block
                        key={it.game.id}
                        item={it}
                        scale={scale}
                        top={li * laneH}
                        blockH={blockH}
                        trayH={trayH}
                        standings={standings}
                        onOpen={onOpen}
                      measure={measure} />
                    )
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* the cut seams need their labels above the scroller's clipping, so they render once here */}
      {cuts.length ? (
        <div className="mgrid-foot">
          {cuts.map((c) => (
            <span className="pill" key={`cl-${c.from}`}>
              no games {clockShort(c.from)} - {clockShort(c.to)}
            </span>
          ))}
        </div>
      ) : null}

      {/* M7: TBD cards scale to viewport width */}
      {tbd.length ? (
        <div className="mtbd">
          <h4>Awaiting kickoff / network - {tbd.length}</h4>
          <div className="mtbd-cards">
            {tbd.map((g) => (
              <button type="button" className="mtbd-card" key={g.id} onClick={() => onOpen?.(g)}>
                <strong>
                  {cardName(g.away, g.away_team_id)} {g.neutral_site ? 'vs' : '@'} {cardName(g.home, g.home_team_id)}
                </strong>
                <em>
                  {g.kickoff_status === 'tbd' ? 'Kickoff TBD' : etTime(g.canonical_kickoff_at_utc, g.kickoff_status)}
                  {' · '}
                  {cardBroadcast(g)?.network?.canonical_name || 'Network TBA'}
                </em>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* M9: footer pills wrap; the omitted pill is never dropped */}
      <div className="mgrid-foot">
        <span className="pill">{onGrid} on the grid</span>
        {kickTbd.length ? <span className="pill">{kickTbd.length} kickoff TBA</span> : null}
        {/* The "every game is kept" pill lived here and is gone: web/app/layout.js:29 already
            carries the statement as a global footnote on every page, so it rendered TWICE on one
            phone screen, and inside the grid it competed with the on-the-grid count, the
            kickoff-TBA pill and .mgrid-note. M9 requires that a CONDITIONAL pill is never dropped
            when its count is non-zero; this one was static and carried no count. */}
      </div>

      {/* 05 section 9, the grid consequence. A network-TBD game CANNOT take a grid position - the
          grid is organised into network rows and there is no network to put it on - so the count
          line can say "45 network TBD" while the lanes hold five. One quiet line in the grid's own
          voice closes that gap. "on the grid" means what the pill beside it already means: placed
          in a lane. The games themselves are above, as M7 cards, and still tappable.
          No placeholder row and no invented "TBD" network lane - a grid row is a channel you can
          tune to, and inventing one would break that contract. Omitted when the count is zero. */}
      {netTbd.length ? (
        <p className="mgrid-note">
          {netTbd.length} {netTbd.length === 1 ? 'game' : 'games'} not on the grid · network TBD
        </p>
      ) : null}
    </section>
  );
}

/** One block: RAW logos on tinted band caps, the names as one surface, hairline, seam, tray. */

/**
 * C5, Joe: "I want the text as large as it can be without abbreviating or affecting geometry."
 *
 * Three constraints in priority order: geometry is frozen, nothing abbreviates, and subject to those
 * the type is as large as possible. So this returns the LARGEST size at which the whole
 * `{rank} NAME (record)` run fits the span, per card - which is what §3 and render_day.py's
 * `fs = max(18, fs*span/total)` both do. It measures the text; it does not estimate from character
 * counts. The measurer is the same canvas context M2 already uses - one measuring path, not two.
 *
 * Cap: the contract's 26px x M1's 0.8 scale. Floor: the contract's 14px x 0.8.
 */
const NAME_MAX = 26 * 0.8;   // 20.8
const NAME_MIN = 14 * 0.8;   // 11.2

export function fitNameSize(measure, sides, span, marker = '@ ') {
  if (!measure || !(span > 0)) return NAME_MIN;
  const face = (px) => `700 ${Math.round(px * 100) / 100}px 'Barlow Condensed', 'Arial Narrow', sans-serif`;
  // .mname carries letter-spacing: 0.02em, which measureText does NOT include - it has to be added
  // per character or every run measures narrow and the fit overflows. That is what a first pass did.
  const piece = (text, fs) => measure(text, face(fs)) + 0.02 * fs * text.length;
  const runWidth = (side, fs, withMarker) => {
    let w = piece(side.name, fs);
    if (side.rank) w += piece(`${side.rank} `, fs);
    if (withMarker) w += piece(marker, fs);
    // The record renders at 60% of the name size (contract §3) but the SPACE before it does not -
    // it is a text node in the name's own run - so each is measured at its own size. Folding the
    // space into the 60% piece measured it 40% narrow on every card that carries a record.
    if (side.record) w += piece(' ', fs) + piece(side.record, fs * 0.6);
    return w;
  };
  for (let fs = NAME_MAX; fs >= NAME_MIN; fs -= 0.2) {
    // the HOME row carries the marker, the away row does not
    const fits = sides.every((sd, i) => runWidth(sd, fs, i === 1) <= span);
    if (fits) return Math.round(fs * 10) / 10;
  }
  return NAME_MIN;
}

/** The endcap's art file, per the cap table's `art`. Unknown values fall through to the raw file. */
function capArt(art, teamId) {
  if (art === 'cap') return teamLogoCapUrl(teamId);
  if (art === 'dark') return teamLogoDarkUrl(teamId);
  return teamLogoUrl(teamId);
}

function Block({ item, scale, top, blockH, trayH, standings, onOpen, measure }) {
  const { game } = item;
  const x = scale.toX(item.start);
  const w = Math.max(46, scale.toX(item.end) - x - 4);
  const away = teamLine(game, 'away', standings);
  const home = teamLine(game, 'home', standings);
  const cap = Math.min(blockH, w / 3);
  // C2: each half of the block gets its team's band and ink.
  const awayBand = bandFor(away.color, away.color2, away.id);
  const homeBand = bandFor(home.color, home.color2, home.id);
  // CANDIDATE D: the cap's surface is per team - the band itself, or its 0.72 tint - and the NAME ROW
  // takes that same surface, so cap and names are one continuous field on every block. The ink then
  // has to be re-derived for whichever surface this team got, which is what inkFor() is for; on a
  // band-surface team it returns exactly bandFor().ink, so nothing changes for the 198 flat teams.
  const awayCap = capFor(away.id);
  const homeCap = capFor(home.id);
  const awaySurface = awayCap.tint === 1 ? awayBand.band : tint(awayBand.band, CAP_TINT);
  const homeSurface = homeCap.tint === 1 ? homeBand.band : tint(homeBand.band, CAP_TINT);
  // A RULED TEAM'S INK IS JOE'S, NOT inkFor()'s. bandFor().ink is never painted by itself - this
  // line is what reaches the screen - so leaving inkFor() to answer here would have shipped his
  // BANDS while silently recomputing his INKS from the raw team colours, which is half a ruling.
  // inkFor() still answers for every unruled team, college included, exactly as before.
  const awayInk = gridColourFor(away.id) ? awayBand.ink : inkFor(awaySurface, away.color, away.color2).ink;
  const homeInk = gridColourFor(home.id) ? homeBand.ink : inkFor(homeSurface, home.color, home.color2).ink;
  const b = item.broadcast;
  // Contract §3 / legend: MARQUEE = BOTH RANKED, or a TIER-1 rivalry. Not "is ranked #1", which is
  // what this used to test - render_day.py's rule is `bool(ra and rh) or bool(rv and rv[1] == 1)`.
  const bothRanked = Number.isInteger(game.home_rank) && Number.isInteger(game.away_rank);
  const tierOne = Boolean(game.is_rivalry) && Number(game.rivalry?.tier) === 1;
  const marquee = bothRanked || tierOne;
  // C5: the largest size at which the WHOLE run fits, per card, measured - not a hardcoded 12px.
  // The span is the block minus both caps; the contract's 26px and 14px scaled by M1's 0.8.
  // The span is .mnames minus the centring slack. Measured against the DOM rather than derived:
  // a 240px block has 59px caps, .mnames renders 120 and .mname's usable client width is 114,
  // so the run has (w - 2*cap - 8) to live in. Deriving it as w - 2*cap overflows by exactly
  // that slack, which a first pass did.
  const span = Math.max(0, w - 2 * cap - 8);
  const nameSize = fitNameSize(measure, [away, home], span, game.neutral_site ? 'vs ' : '@ ');

  const odds = (game.odds || [])[0];
  const pills = [];
  if (odds?.spread != null) pills.push({ kind: 'spread', text: `${Number(odds.spread) > 0 ? '+' : ''}${odds.spread}` });
  if (odds?.total != null) pills.push({ kind: 'ou', text: `O/U ${odds.total}` });
  if (game.is_rivalry) pills.push({ kind: 'rivalry', text: (game.rivalry?.name || 'RIVALRY').toUpperCase() });
  // right-to-left drop priority: the narrower the block, the fewer pills survive
  const room = Math.max(0, Math.floor((w - 90) / 46));
  const shown = pills.slice(0, room);

  return (
    <button
      type="button"
      className="mblock"
      data-marquee={marquee ? 'true' : 'false'}
      style={{ left: x, top, width: w, height: blockH + trayH }}
      onClick={() => onOpen?.(game)}
      title={`${away.name} at ${home.name}`}
    >
      {marquee ? <span className="mplate" /> : null}
      <div className="mblock-body" style={{ height: blockH }}>
        <div
          className="mcap mcap-away"
          style={{
            width: cap,
            // CANDIDATE D (Joe's ruling on the cap study, 2026-09-04). The cap surface is chosen PER
            // TEAM from web/lib/cap-table.json: the band itself where that team's logo still reads on
            // it, otherwise tint(band, 0.72). B5's single global 0.72 is superseded - it was the best
            // one value for everybody, which is a different thing from the right value for anybody.
            // The art is chosen the same way: the raw file, or the existing _dark file where it reads
            // materially better on the surface that was picked. Neither is derived here; the table is
            // measured from the pixels at render size, which a runtime rule cannot do.
            background: awaySurface,
          }}
        >
          {/* THREE ART CONTEXTS since prompt 69, and this is the only place the third is chosen.
              A FALL-THROUGH ON PURPOSE: a row that does not say 'cap' behaves exactly as it did. */}
          <img src={capArt(awayCap.art, away.id)}
               alt="" loading="lazy" />
        </div>
        <div className="mnames">
          <div className="mname" style={{ fontSize: nameSize, background: awaySurface, color: awayInk }}>
            {away.rank ? <span className="mrank">{away.rank}</span> : null}
            {away.name}
            {away.record ? (
              <>
                {' '}
                <span className="mrec">{away.record}</span>
              </>
            ) : null}
          </div>
          {/* D1: full width, not 86%. An inset rule was right when the two names were floating
              pills on a panel; on one continuous surface it left a 7% notch of band colour at each
              end where the divider simply stopped. */}
          <div className="mhair" />
          {/* contract §3: the home band reads "@ {rank} {TEAM}". The '@' is what marks the band as
              the home side and does NOT depend on rank data, which is null for most games. */}
          <div className="mname" style={{ fontSize: nameSize, background: homeSurface, color: homeInk }}>
            <span className="mat">{game.neutral_site ? 'vs' : '@'}</span>
            {home.rank ? <span className="mrank">{home.rank}</span> : null}
            {home.name}
            {home.record ? (
              <>
                {' '}
                <span className="mrec">{home.record}</span>
              </>
            ) : null}
          </div>
        </div>
        <div
          className="mcap mcap-home"
          style={{
            width: cap,
            background: homeSurface,
          }}
        >
          {/* THREE ART CONTEXTS since prompt 69, and this is the only place the third is chosen.
              A FALL-THROUGH ON PURPOSE: a row that does not say 'cap' behaves exactly as it did. */}
          <img src={capArt(homeCap.art, home.id)}
               alt="" loading="lazy" />
        </div>
      </div>
      {/* D2 said this takes the BAND colours rather than the primaries, because the seam is the
          block's own edge and not a shadow of it. That reasoning is unchanged; what the block PAINTS
          has changed. After candidate D each half is its surface - the band on some teams, its 0.72
          tint on others - so a seam drawn from the bands is a strip of a colour the block above it no
          longer uses. Measured on the live slates: 31 of 53 blocks drew a seam LIGHTER than the
          surface it sits under, and the Steelers were the clearest - a full-gold rgb(255,182,18)
          strip beneath a rgb(189,137,19) cap, which reads as a rendering fault rather than an edge.
          So it follows the surfaces. Same rule as D2, applied to what the block is now made of. */}
      <div
        className="mseam"
        style={{ background: `linear-gradient(90deg, ${awaySurface}, ${homeSurface})` }}
      />
      <div className="mtray" style={{ height: trayH - 2 }}>
        <span className="mtray-left">
          {etTime(game.canonical_kickoff_at_utc, game.kickoff_status)}
          {game.venue?.name ? ` · ${game.venue.name}` : ''}
        </span>
        <span className="mtray-right">
          {shown.map((p) => (
            <span className="mtray-pill" data-kind={p.kind} key={p.kind}>
              {p.text}
            </span>
          ))}
        </span>
      </div>
    </button>
  );
}

/**
 * THE PROGRAM BLOCK - rendering contract v1.7, the design of record built on the frozen silhouette.
 *
 * Every measurement below is the game block's, scaled by M1 exactly as the game block is: the same
 * 74 + 28 geometry, the same rx, the same plate, the same tray line. What differs is what fills it,
 * because a program has no two teams to split the card between:
 *
 *   endcap        charcoal RAIL-TILE gradient (globals.css --panel-top -> --panel-bottom, the same
 *                 pair contract §2 paints the network rail with), carrying the brand mark inset and
 *                 fit-boxed. NEVER brand-coloured, NEVER white-backed.
 *   brand bar     3px of the brand colour on the endcap's RIGHT edge - the one place the colour is
 *                 shown at full strength, which is what makes four red brands distinguishable.
 *   stage wash    the signature: brand at BOTH edges fading to charcoal at the centre, peak ~55%.
 *   title         centred, Barlow Condensed 700, --ink, shrinking by the game card's own fit steps.
 *   subtitle      centred beneath, the brand colour tinted 70% toward white.
 *   seam          mirrored to match - charcoal at centre, brand at both ends.
 *   tray          start . venue/service on the left; the crew as a muted right-aligned run that
 *                 renders ONLY when it fits, whole names or nothing (lib/programs.js fitCrew).
 *
 * OPEN-ENDED: a program whose end is unknown draws to its expected end and then FADES - the wash
 * dropping to transparent over the last half-hour column - instead of stopping at a hard edge it
 * cannot honestly claim. The rule that decides it is lib/programs.js isOpenEnded().
 *
 * UFC RENDERS PLAIN. No segment dividers, no CBS-window overlay (design of record, superseding the
 * register's Q2). `segments[]` and the broadcast windows are data the detail panel shows.
 */
function ProgramBlock({ item, scale, top, blockH, trayH, onOpen, measure }) {
  const program = item.game;
  const x = scale.toX(item.start);
  const w = Math.max(46, scale.toX(item.end) - x - 4);
  const brand = brandFor(program.brand_key);
  const openEnded = isOpenEnded(program);
  const subtitle = subtitleFor(program);
  const missing = eligibilityMissing(program);
  const titleText = titleFor(program);
  const titleFontAt = (px) => `700 ${px}px 'Barlow Condensed', 'Arial Narrow', sans-serif`;

  // ---------------------------------------------------------------- THE LOGO COMES FIRST
  //
  // JOE'S RULING, 2026-09-06, AND IT INVERTS WHAT WAS HERE:
  //
  //   "I want the pregame/postgame program logos to appear clearly no matter what. Priority should
  //    be given to the LOGO to render clearly - even if it prevents text from rendering... if it
  //    fills the entire space that is fine - only if there's enough room to render the logo clearly
  //    on the left in the logo tile, then open up the text portion of the card to the right, only
  //    then should logo AND text both render."
  //
  // WHAT WAS HERE. cap = max(16, min(blockH, w / 3)) gave the mark A THIRD of the block, and the
  // title took the largest of [26, 22, 18, 15, 13, 11] x SCALE that fitted - FALLING THROUGH TO THE
  // SMALLEST when none did. So the logo was squeezed to a third and the text ALWAYS rendered, at
  // 11 x SCALE (8.8px) if that was what it took. Exactly backwards.
  //
  // THE RULE NOW. The mark takes the width it needs to draw at its clear height, and the title
  // renders only if what is LEFT still fits it at a legible size. Text that has to shrink past
  // legibility is not information; Joe would rather have the mark.
  //
  // THE FLOOR IS 18 x SCALE (14.4px) - the fourth rung of the ladder above rather than a new
  // number, because the three rungs below it were always the "it only just fits" sizes.
  //
  // ZOOM IS CORRECT BY CONSTRUCTION. capNeeded derives from blockH, which pinch-zoom does not
  // change, while w grows with it - so the logo stays at its clear size and every extra pixel goes
  // to the text. That is what makes Joe's "as the grid card is expanded, the text can render" true
  // without a second rule.
  //
  // A BRAND WITH NO ART KEEPS TODAY'S TREATMENT EXACTLY - the old w/3 cap and the full ladder - so
  // the typographic mark still gets its third and the title still renders. Logo priority applies
  // where there IS a logo; the gap stays visible rather than disguised.
  //
  // SCOPE IS EVERY PROGRAM TYPE, not just studio shows. Long blocks keep both anyway because they
  // have the room, so in practice this changes only the short ones.
  const aspect = markAspect(brand);
  const MARK_H = 0.62;   // .pblock .pcap img max-height
  const MARK_W = 0.78;   // .pblock .pcap img max-width
  const TEXT_FLOOR = 18 * SCALE;
  // The endcap width at which the mark reaches its clear height inside those insets.
  const capNeeded = aspect ? (blockH * MARK_H * aspect) / MARK_W : 0;
  const titleFitsBeside = aspect
    ? measure(titleText, titleFontAt(TEXT_FLOOR)) <= Math.max(0, w - capNeeded - 10)
    : true;
  const logoOnly = Boolean(aspect) && !titleFitsBeside;

  const cap = logoOnly
    ? w
    : aspect
      ? Math.max(16, Math.min(w, capNeeded))
      // No art: the original rule, untouched. The floor of 46 on the width is the game block's own;
      // the cap is a third of it, so a short show shows a narrow mark and its title rather than a
      // mark and nothing.
      : Math.max(16, Math.min(blockH, w / 3));

  // The title's own fit ladder, the game card's steps applied to one line instead of two: the
  // largest size at which the WHOLE title fits the span between the endcap and the right edge.
  const span = Math.max(0, w - cap - 10);
  const steps = [26, 22, 18, 15, 13, 11].map((px) => px * SCALE);
  const titleSize =
    steps.find((px) => measure(titleText, titleFontAt(px)) <= span) ?? steps[steps.length - 1];

  // THE CREW-FIT RULE. The run gets whatever the tray has left after the left-hand primary text,
  // and names are dropped from the right until the remainder fits - never an ellipsis, never a
  // half name. See lib/programs.js fitCrew for why that is the chosen behaviour.
  const trayFont = `600 ${Math.round(11 * SCALE * 100) / 100}px Inter, -apple-system, sans-serif`;
  const leftText = `${etTime(program.canonical_kickoff_at_utc, program.kickoff_status)}${
    program.location_text ? ` · ${program.location_text}` : ''}`;
  const leftW = measure(leftText, `700 ${Math.round(12.5 * SCALE * 100) / 100}px Inter, sans-serif`);
  const crewRoom = Math.max(0, w - leftW - 16);
  const crew = fitCrew(crewNames(program), crewRoom, measure, trayFont);

  const wash = washGradient(brand.color);

  return (
    <button
      type="button"
      className="mblock pblock"
      data-open-ended={openEnded ? 'true' : 'false'}
      data-brand={brand.key || 'unknown'}
      style={{ left: x, top, width: w, height: blockH + trayH }}
      onClick={() => onOpen?.(program)}
      title={titleText}
    >
      <div className="mblock-body" style={{ height: blockH }} data-logo-only={logoOnly ? 'true' : 'false'}>
        <div className="pcap" style={{ width: cap, background: ENDCAP_GRADIENT }}>
          {/* LOGO ONLY KEEPS THE WASH - it is what tells four red-branded shows apart - and it
              moves inside the endcap because there is no stage left to hold it. */}
          {logoOnly ? <span className="pwash" style={{ backgroundImage: wash }} /> : null}
          {brand.mark_dark ? (
            <img src={brand.mark_dark} alt="" loading="lazy" />
          ) : (
            // NO FABRICATED LOGO, and none fetched. A brand the tree has no art for renders its
            // short title as a typographic mark on the charcoal tile, and the run's report lists it
            // as an open item for the marks pipeline.
            <span className="pcap-type">{brand.short_title || titleText.slice(0, 10)}</span>
          )}
          {/* The 3px brand bar marks the endcap's edge AGAINST THE STAGE. In LOGO ONLY there is no
              such edge - the endcap is the whole block - so it goes and the wash carries the brand. */}
          {logoOnly ? null : <span className="pcap-bar" style={{ background: brand.color }} />}
        </div>
        {logoOnly ? null : (
        <div className="pstage">
          {/* The wash is its own layer so the open-ended fade can mask it without touching the
              text above, and so the acceptance pass can sample one element for symmetry. */}
          <span className="pwash" style={{ backgroundImage: wash }} />
          <span className="ptext">
            <span className="ptitle" style={{ fontSize: titleSize }}>{titleText}</span>
            {subtitle ? (
              <span className="psub" style={{ color: tintToWhite(brand.color) }}>{subtitle}</span>
            ) : null}
          </span>
        </div>
        )}
      </div>
      {/* THE SEAM AND THE TRAY STAY IN BOTH LAYOUTS. The tray carries the start time and the venue,
          and a reader needs those whether or not the title rendered. */}
      <div className="mseam pseam" style={{ background: seamGradient(brand.color) }} />
      <div className="mtray" style={{ height: trayH - 2 }}>
        <span className="mtray-left">{leftText}</span>
        <span className="mtray-right">
          {missing ? <span className="mtray-pill" data-kind="eligmissing">ELIGIBILITY MISSING</span> : null}
          {crew.text ? <span className="pcrew-run" style={{ color: CREW_INK }}>{crew.text}</span> : null}
        </span>
      </div>
    </button>
  );
}
