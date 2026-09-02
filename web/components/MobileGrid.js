'use client';

// The mobile grid - docs/rendering-contract-mobile.md, M1 through M13.
//
// Built from the day's feed, not from the archival SVG: the SVG is a fixed 1806px-wide artefact, and
// the addendum's whole point is that a phone gets its own time scale. Everything the PC contract says
// about block anatomy still holds (M13); only the rules named M1-M12 differ.
//
// Layout: one horizontal scroller. The network rail is `position: sticky; left: 0` INSIDE it, so
// panning moves only the schedule (M4). Pinch-zoom scales the whole canvas with a CSS transform and
// the rail rides along, which is what "pinned at every zoom level" means (M6).

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
} from '../lib/gridmodel.js';
import { teamLogoUrl } from '../lib/config.js';
import { markStyle, hasMark } from '../lib/marks.js';
import { etTime } from '../lib/format.js';
import { cardName, cardBroadcast } from './MatchupCard.js';
import { recordText, standingFor } from '../lib/standings.js';
import { railLabel } from '../lib/raillabel.js';

const SCALE = 0.8; // M1: all grid content renders at 80% of contract design size
const SEAM_PX = 30; // the dashed cut occupies this much of the axis (M3)

/** tint(hex, f) - the contract's cap gradient endpoints, 0.86 -> 0.58 (M13). */
function tint(hex, f) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const [r, g, b] = m
    ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16))
    : [110, 116, 124];
  const mix = (c) => Math.round(c * f + 255 * (1 - f) * 0.08);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

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
  return {
    rank: Number.isInteger(rank) && rank > 0 ? String(rank) : null,
    name: (cardName(t, side === 'home' ? game.home_team_id : game.away_team_id) || '').toUpperCase(),
    record: rec || null,
    color: t?.primary_color,
    id: t?.id,
  };
}

export default function MobileGrid({ games, sport, day, standings, onOpen }) {
  const { measure, ready } = useTextMeasurer();

  const model = useMemo(() => {
    const mins = blockMinutes(sport);
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
      timed.push({ game: g, start, end: start + mins, broadcast: b });
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
    const pxPerMin = pxPerMinute(widest / SCALE, sport) * SCALE;

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
    for (const r of rows) r.lanes = packLanes(r.items);

    return { rows, scale, ticks, cuts, pxPerMin, tbd, blockMins: mins, widest };
  }, [games, sport, measure, ready, standings]);

  // M6: pinch-to-zoom over the canvas; the rail is sticky inside it and so scales with it.
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

  const { rows, scale, ticks, cuts, tbd } = model;
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
      <div className="mgrid-head">
        <h3>{(sport || '').toUpperCase()} GRID</h3>
        <span className="mgrid-meta">
          {day} · {onGrid} on the grid{tbd.length ? ` · ${tbd.length} awaiting kickoff / network` : ''}
          {cuts.length ? ` · ${cuts.length} gap${cuts.length > 1 ? 's' : ''} cut` : ''}
        </span>
      </div>

      {/* M8: jump-to-network quick nav */}
      {rows.length > 1 ? (
        <nav className="mgrid-nav" aria-label="Jump to network">
          {rows.map((r) => (
            <button key={r.id} type="button" onClick={() => jumpTo(r.id)}>
              {r.name}
            </button>
          ))}
        </nav>
      ) : null}

      <div className="mgrid-scroll" ref={scrollRef}>
        <div
          className="mgrid-canvas"
          style={{ transform: `scale(${zoom})`, width: `calc(var(--rail-w) + ${scale.width}px)` }}
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
                    />
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
        {tbd.length ? <span className="pill">{tbd.length} kickoff / network TBA</span> : null}
        <span className="pill">every game is kept - nothing is deleted</span>
      </div>
    </section>
  );
}

/** One block: cap endcaps with RAW logos on tint gradients, centred names, hairline, seam, tray. */
function Block({ item, scale, top, blockH, trayH, standings, onOpen }) {
  const { game } = item;
  const x = scale.toX(item.start);
  const w = Math.max(46, scale.toX(item.end) - x - 4);
  const away = teamLine(game, 'away', standings);
  const home = teamLine(game, 'home', standings);
  const cap = Math.min(blockH, w / 3);
  const b = item.broadcast;
  // Contract §3 / legend: MARQUEE = BOTH RANKED, or a TIER-1 rivalry. Not "is ranked #1", which is
  // what this used to test - render_day.py's rule is `bool(ra and rh) or bool(rv and rv[1] == 1)`.
  const bothRanked = Number.isInteger(game.home_rank) && Number.isInteger(game.away_rank);
  const tierOne = Boolean(game.is_rivalry) && Number(game.rivalry?.tier) === 1;
  const marquee = bothRanked || tierOne;
  const nameSize = Math.max(8, 15 * 0.8);

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
          className="mcap"
          style={{
            width: cap,
            background: `linear-gradient(180deg, ${tint(away.color, 0.86)}, ${tint(away.color, 0.58)})`,
          }}
        >
          <img src={teamLogoUrl(away.id)} alt="" loading="lazy" />
        </div>
        <div className="mnames">
          <div className="mname" style={{ fontSize: nameSize }}>
            {away.rank ? <span className="mrank">{away.rank}</span> : null}
            {away.name}
            {away.record ? <span className="mrec">{away.record}</span> : null}
          </div>
          <div className="mhair" style={{ width: '86%' }} />
          {/* contract §3: the home band reads "@ {rank} {TEAM}". The '@' is what marks the band as
              the home side and does NOT depend on rank data, which is null for most games. */}
          <div className="mname" style={{ fontSize: nameSize }}>
            <span className="mat">{game.neutral_site ? 'vs' : '@'}</span>
            {home.rank ? <span className="mrank">{home.rank}</span> : null}
            {home.name}
            {home.record ? <span className="mrec">{home.record}</span> : null}
          </div>
        </div>
        <div
          className="mcap"
          style={{
            width: cap,
            background: `linear-gradient(180deg, ${tint(home.color, 0.86)}, ${tint(home.color, 0.58)})`,
          }}
        >
          <img src={teamLogoUrl(home.id)} alt="" loading="lazy" />
        </div>
      </div>
      <div
        className="mseam"
        style={{ background: `linear-gradient(90deg, ${tint(away.color, 0.86)}, ${tint(home.color, 0.86)})` }}
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
