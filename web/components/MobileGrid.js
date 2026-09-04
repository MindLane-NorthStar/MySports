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
  tint,
  inkFor,
  capFor,
  CAP_TINT,
} from '../lib/gridmodel.js';
import { splitOverlaps } from '../lib/overlap.js';
import { teamLogoUrl, teamLogoDarkUrl, sportMarkUrl, SPORT_LABEL } from '../lib/config.js';
import { markStyle, hasMark } from '../lib/marks.js';
import { etTime, longDay } from '../lib/format.js';
import { cardName, cardBroadcast } from './MatchupCard.js';
import { recordText, standingFor } from '../lib/standings.js';
import { railLabel } from '../lib/raillabel.js';
// 05 section 9: the SAME predicate the listings use. The grid must not re-derive it - two
// definitions of "nobody has announced this" would drift, and the band's count line and the
// grid's note would then disagree about the same games on the same screen.
import { isNetworkTbd } from '../lib/offservice.js';

const SCALE = 0.8; // M1: all grid content renders at 80% of contract design size
const SEAM_PX = 30; // the dashed cut occupies this much of the axis (M3)
// CAP_TINT now comes from gridmodel beside capFor(), because it is one of TWO cap surfaces rather
// than the single global value B5 shipped. See the note at the cap.


/** Text measurement in the REAL fonts - M2 requires the widest line be measured, not estimated. */
function useTextMeasurer() {
  const ctxRef = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const canvas = document.createElement('canvas');
    ctxRef.current = canvas.getContext('2d');
    let cancelled = false;
    const done = () => !cancelled && setReady(true);
    if (document.fonts?.ready) document.fonts.ready.then(done, done);
    else done();
    return () => {
      cancelled = true;
    };
  }, []);
  return useMemo(
    () => ({
      ready,
      measure(text, font) {
        const ctx = ctxRef.current;
        if (!ctx) return (text || '').length * 8;
        ctx.font = font;
        return ctx.measureText(text || '').width;
      },
    }),
    [ready]
  );
}

/**
 * The record run beside a name (contract v1.1). `games.home_record` / `away_record` are the CFB
 * enrichment path and are null for every game in the database today, so the run falls back to the
 * club's current team_records row - the same number the listings card shows. A club with neither
 * simply has no run, which is the contract's "suppressed at 0-0" behaviour by another route.
 */
function teamLine(game, side, standings) {
  const t = side === 'home' ? game.home : game.away;
  const rank = side === 'home' ? game.home_rank : game.away_rank;
  const stored = side === 'home' ? game.home_record : game.away_record;
  const row = standings ? standingFor(standings, t?.id, game.season) : null;
  const rec = stored || (row ? recordText(row, game.sport) : null);
  // CONTRACT §3: "never (0-0)". A team that has not played tells the reader nothing, and on a
  // week-1 slate it is every team - the Steelers block read "FALCONS0-0 / @STEELERS0-0" before
  // this. Suppression was specified and never implemented on the phone.
  const shownRec = rec && !/^0-0(-0)?$/.test(rec.trim()) ? rec : null;
  return {
    rank: Number.isInteger(rank) && rank > 0 ? String(rank) : null,
    name: (cardName(t, side === 'home' ? game.home_team_id : game.away_team_id) || '').toUpperCase(),
    record: shownRec,
    color: t?.primary_color,
    color2: t?.secondary_color,
    id: t?.id,
  };
}

export default function MobileGrid({ games, sport, day, standings, onOpen }) {
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
      const b = cardBroadcast(g);
      if (!known || !b) {
        tbd.push(g);
        continue;
      }
      timed.push({ game: g, start, end: start + blockMinutes(g.sport), broadcast: b });
    }

    // M2: measure the widest rendered team line on THIS slate, in the real fonts.
    const nameFont = `700 ${Math.round(15 * SCALE * 100) / 100}px 'Barlow Condensed', 'Arial Narrow', sans-serif`;
    let widest = 0;
    for (const it of timed) {
      for (const side of ['home', 'away']) {
        const l = teamLine(it.game, side, standings);
        const at = side === 'home' ? '@ ' : '';
        const text = `${at}${l.rank ? `${l.rank} ` : ''}${l.name}${l.record ? `  ${l.record}` : ''}`;
        widest = Math.max(widest, measure(text, nameFont));
      }
    }
    // D3: the scale is set by the SHORTEST block on the slate. pxPerMinute divides the widest team
    // line by a duration, so the smallest duration yields the largest pixels-per-minute - and M2's
    // guarantee is that the NARROWEST block still fits the widest name. Picking the page sport (or
    // the longest) would let a 150-minute NHL block fall under that width and wrap a name, which is
    // the one thing M2 says cannot happen by construction. One sport present: unchanged.
    const present = [...new Set(timed.map((t) => t.game.sport))];
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
  const pinch = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
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
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, [zoom]);

  const { rows, ticks, cuts, tbd, netTbd, kickTbd } = model;

  // THE ZOOM. makeScale is O(segments) - a handful of entries - so rebuilding it on every pinch
  // frame is arithmetic, not layout work, and everything expensive stays in the memo above.
  // Scaling pxPerMin rather than the painted pixels is what keeps scrollWidth honest: the canvas
  // really is this wide, so the scroller has nothing to disagree with.
  const scale = useMemo(
    () => makeScale(model.segments, model.pxPerMin * zoom, SEAM_PX),
    [model.segments, model.pxPerMin, zoom],
  );
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
      {/* D4: "(mark) College Football Broadcasts · Saturday September 12, 2026 · 70 GAMES". It read
          "CFB GRID" over a bare ISO date - the sport as a code, the word GRID naming the widget
          rather than its contents, and a date in a format nobody says out loud.
          longDay() emits "Saturday, September 12, 2026"; the comma after the weekday goes, because
          this line is already separated by middots and a second punctuation mark inside one segment
          reads as a stutter.
          With no sport selected there is no league mark to show and the slate really is every sport,
          so it says so rather than leaving the line to start with a middot. */}
      <div className="mgrid-head">
        <h3>
          {sportMarkUrl(sport) ? <img className="mgrid-mark" src={sportMarkUrl(sport)} alt="" /> : null}
          {/* B1: TWO LINES, split deliberately rather than left to wrap. As one run of text this
              broke mid-date - "MLB Broadcasts - Saturday September 5," then "2026 - 3 games" - which
              is the worst place it could break, because a year on its own line reads as a separate
              fact. The line that names the grid and the line that dates it are different kinds of
              information, so they get a line each and the break stops being the browser's choice. */}
          <span className="mgrid-headlines">
            <span className="mgrid-line1">
              {sport ? SPORT_LABEL[sport] || sport.toUpperCase() : 'All Sports'} Broadcasts
            </span>
            <span className="mgrid-line2">
              {longDay(day).replace(/,/, '')} · {onGrid} {onGrid === 1 ? 'GAME' : 'GAMES'}
            </span>
          </span>
        </h3>
        {/* The count moved into the heading, so this keeps only what the heading cannot say: the
            games that could NOT be placed, and the dead time M3 collapsed. Both explain something
            the reader would otherwise have to notice was missing. */}
        {tbd.length || cuts.length ? (
          <span className="mgrid-meta">
            {tbd.length ? `${tbd.length} awaiting kickoff / network` : ''}
            {tbd.length && cuts.length ? ' · ' : ''}
            {cuts.length ? `${cuts.length} gap${cuts.length > 1 ? 's' : ''} cut` : ''}
          </span>
        ) : null}
      </div>

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

      <div className="mgrid-scroll" ref={scrollRef}>
        {/* No transform. The width below is the real, laid-out width at this zoom. */}
        <div
          className="mgrid-canvas"
          style={{ width: `calc(var(--rail-w) + ${scale.width}px)` }}
        >
          {/* M5: hour-only gold shorthand labels. Gridlines stay on :15. */}
          <div className="mgrid-axis">
            <div className="mgrid-axis-rail" />
            <div className="mgrid-axis-track" style={{ width: scale.width }}>
              {ticks.lines.map((l) => (
                <div
                  key={`al-${l.minute}`}
                  className="mgrid-line"
                  data-hour={l.hour ? 'true' : 'false'}
                  style={{ left: scale.toX(l.minute) }}
                />
              ))}
              {ticks.labels.map((l) => (
                <span key={`ax-${l.minute}`} className="maxis-label" style={{ left: scale.toX(l.minute) }}>
                  {l.text}
                </span>
              ))}
            </div>
          </div>

          {rows.map((row) => (
            <div className="mgrid-row" key={row.id} id={`mrow-${row.id}`}>
              <div className="mrail-cell">
                <div className="mrail-mark">
                  {hasMark(row.id) ? (
                    <img src={markStyle(row.id, 42).src} alt={row.name} loading="lazy" />
                  ) : null}
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
                    style={{ left: scale.toX(l.minute) }}
                  />
                ))}
                {cuts.map((c) => (
                  <div key={`cut-${row.id}-${c.from}`} className="mgrid-cut" style={{ left: scale.toX(c.from) + SEAM_PX / 2 }} />
                ))}
                {row.lanes.map((lane, li) =>
                  lane.map((it) => (
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
                  ))
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
    // the record renders at 60% of the name size (contract §3), so it is measured there
    if (side.record) w += piece(` ${side.record}`, fs * 0.6);
    return w;
  };
  for (let fs = NAME_MAX; fs >= NAME_MIN; fs -= 0.2) {
    // the HOME row carries the marker, the away row does not
    const fits = sides.every((sd, i) => runWidth(sd, fs, i === 1) <= span);
    if (fits) return Math.round(fs * 10) / 10;
  }
  return NAME_MIN;
}

function Block({ item, scale, top, blockH, trayH, standings, onOpen, measure }) {
  const { game } = item;
  const x = scale.toX(item.start);
  const w = Math.max(46, scale.toX(item.end) - x - 4);
  const away = teamLine(game, 'away', standings);
  const home = teamLine(game, 'home', standings);
  const cap = Math.min(blockH, w / 3);
  // C2: each half of the block gets its team's band and ink.
  const awayBand = bandFor(away.color, away.color2);
  const homeBand = bandFor(home.color, home.color2);
  // CANDIDATE D: the cap's surface is per team - the band itself, or its 0.72 tint - and the NAME ROW
  // takes that same surface, so cap and names are one continuous field on every block. The ink then
  // has to be re-derived for whichever surface this team got, which is what inkFor() is for; on a
  // band-surface team it returns exactly bandFor().ink, so nothing changes for the 198 flat teams.
  const awayCap = capFor(away.id);
  const homeCap = capFor(home.id);
  const awaySurface = awayCap.tint === 1 ? awayBand.band : tint(awayBand.band, CAP_TINT);
  const homeSurface = homeCap.tint === 1 ? homeBand.band : tint(homeBand.band, CAP_TINT);
  const awayInk = inkFor(awaySurface, away.color, away.color2).ink;
  const homeInk = inkFor(homeSurface, home.color, home.color2).ink;
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
          <img src={awayCap.art === 'dark' ? teamLogoDarkUrl(away.id) : teamLogoUrl(away.id)}
               alt="" loading="lazy" />
        </div>
        <div className="mnames">
          <div className="mname" style={{ fontSize: nameSize, background: awaySurface, color: awayInk }}>
            {away.rank ? <span className="mrank">{away.rank}</span> : null}
            {away.name}
            {away.record ? <span className="mrec">{away.record}</span> : null}
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
            {home.record ? <span className="mrec">{home.record}</span> : null}
          </div>
        </div>
        <div
          className="mcap mcap-home"
          style={{
            width: cap,
            background: homeSurface,
          }}
        >
          <img src={homeCap.art === 'dark' ? teamLogoDarkUrl(home.id) : teamLogoUrl(home.id)}
               alt="" loading="lazy" />
        </div>
      </div>
      {/* D2: the BAND colours, not the primaries. This was the last place in the block still
          reading team.primary_color directly - so a Steelers block had a gold band, gold caps and a
          black seam, which looked like a rendering fault rather than a design. Untinted, for the
          same reason the caps are: the seam is the block's own edge, not a shadow of it. */}
      <div
        className="mseam"
        style={{ background: `linear-gradient(90deg, ${awayBand.band}, ${homeBand.band})` }}
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
