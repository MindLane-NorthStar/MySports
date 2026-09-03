// Mobile grid geometry - docs/rendering-contract-mobile.md M2 (time scale) and M3 (gap collapse).
//
// Pure functions, no DOM: the component measures text and hands the widest line in, so the same
// arithmetic can be exercised without a browser.

/** Contract design geometry (docs/rendering-contract.md §3). */
export const BLOCK_H = 74;
export const TRAY_H = 28;
export const LANE_GAP = 8;
export const ROW_H = BLOCK_H + TRAY_H + LANE_GAP; // 110
export const CAP = 74; // a square endcap, one per side
export const NAME_PAD = 34; // the hairline span's breathing room between the two caps

/** Standard display duration per sport (data/render_policies.json block_minutes). */
export const BLOCK_MINUTES = { cfb: 210, nfl: 210, nhl: 150, nba: 150, mlb: 180 };

export function blockMinutes(sport) {
  return BLOCK_MINUTES[sport] || 180;
}

/**
 * M2 - per-day maximum compression.
 *
 * The narrowest a standard block may be is the widest team line ON THIS SLATE (rank prefix and record
 * run included, measured in the real fonts) plus both endcaps plus the name padding. Dividing that by
 * the sport's standard duration gives the day's pixels-per-minute. Because the scale is derived FROM
 * the widest line, no name can ever be pushed to a second line - that is what "by construction" means
 * in the addendum, and it is why this number is computed per day rather than fixed.
 */
export function pxPerMinute(widestLinePx, sport) {
  const minWidth = widestLinePx + 2 * CAP + NAME_PAD;
  return minWidth / blockMinutes(sport);
}

/** Minutes since local midnight for an instant, in the display zone. */
export function minutesOfDay(instant, timeZone = 'America/New_York') {
  const d = new Date(instant);
  if (Number.isNaN(d.getTime())) return null;
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const h = Number(p.find((x) => x.type === 'hour')?.value);
  const m = Number(p.find((x) => x.type === 'minute')?.value);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
}

/**
 * The viewing day runs to the 03:00 ET cutover, so a 10:40pm tip and a 12:30am finish are the same
 * evening. Anything before the cutover is pushed past midnight rather than to the top of the axis.
 */
export function viewingMinutes(instant, cutoverHour = 3, timeZone = 'America/New_York') {
  const m = minutesOfDay(instant, timeZone);
  if (m === null) return null;
  return m < cutoverHour * 60 ? m + 24 * 60 : m;
}

function merge(intervals) {
  const s = intervals.filter(Boolean).slice().sort((a, b) => a.start - b.start);
  const out = [];
  for (const iv of s) {
    const last = out[out.length - 1];
    if (last && iv.start <= last.end) last.end = Math.max(last.end, iv.end);
    else out.push({ start: iv.start, end: iv.end });
  }
  return out;
}

/**
 * M3 - hard cut. A stretch of `gapMin` or more with nothing airing is removed from the axis entirely
 * and replaced by a dashed seam; the axis resumes at the next window. A continuous day yields exactly
 * one segment and therefore renders uncut.
 *
 * Returns { segments, cuts } where a segment is a rendered span of real minutes and a cut records the
 * range that was skipped, for the seam label.
 */
export function collapseGaps(intervals, gapMin = 60) {
  const merged = merge(intervals);
  if (!merged.length) return { segments: [], cuts: [] };
  const segments = [merged[0]];
  const cuts = [];
  for (let i = 1; i < merged.length; i += 1) {
    const prev = segments[segments.length - 1];
    const gap = merged[i].start - prev.end;
    if (gap >= gapMin) {
      cuts.push({ from: prev.end, to: merged[i].start });
      segments.push({ ...merged[i] });
    } else {
      prev.end = Math.max(prev.end, merged[i].end);
    }
  }
  return { segments, cuts };
}

/**
 * A scale over the collapsed segments: real minutes in, pixels out. `seamPx` is the width the dashed
 * seam itself occupies so the two sides do not touch.
 */
export function makeScale(segments, pxPerMin, seamPx = 26) {
  const offsets = [];
  let x = 0;
  for (const seg of segments) {
    offsets.push({ ...seg, x });
    x += (seg.end - seg.start) * pxPerMin + seamPx;
  }
  const width = Math.max(0, x - (segments.length ? seamPx : 0));

  function toX(minute) {
    if (!offsets.length) return 0;
    for (const seg of offsets) {
      if (minute <= seg.end) return seg.x + Math.max(0, minute - seg.start) * pxPerMin;
    }
    const last = offsets[offsets.length - 1];
    return last.x + (last.end - last.start) * pxPerMin;
  }

  return { width, toX, segments: offsets, seamPx };
}

/** 'NOON' / '1PM' / 'MIDNIGHT' / '1AM' - M5's Style B shorthand, uppercase at render time. */
export function hourLabel(minuteOfDay) {
  const h = Math.round(minuteOfDay / 60) % 24;
  if (h === 12) return 'NOON';
  if (h === 0) return 'MIDNIGHT';
  return `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * M5 - labels ONLY on the hour, and only inside a rendered segment (never stranded in a cut).
 * Gridlines keep :15 granularity, which is why lines and labels are produced separately.
 */
export function axisTicks(segments) {
  const labels = [];
  const lines = [];
  for (const seg of segments) {
    const first = Math.ceil(seg.start / 15) * 15;
    for (let m = first; m <= seg.end; m += 15) {
      const onHour = m % 60 === 0;
      lines.push({ minute: m, hour: onHour });
      if (onHour) labels.push({ minute: m, text: hourLabel(m) });
    }
  }
  return { labels, lines };
}

/** 'no games 5:15 - 6:40' for a seam label. */
export function clockShort(minute) {
  const m = ((minute % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${mm}`;
}

/** First-fit lane packing: overlapping games on one network stack instead of colliding. */
export function packLanes(items) {
  const lanes = [];
  for (const it of items.slice().sort((a, b) => a.start - b.start)) {
    let placed = false;
    for (const lane of lanes) {
      if (lane[lane.length - 1].end <= it.start) {
        lane.push(it);
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push([it]);
  }
  return lanes;
}

/**
 * tint(hex, f) - the contract's cap gradient endpoints, 0.86 -> 0.58 (Mobile Grid Addendum M13).
 *
 * Lives here rather than in MobileGrid because it is grid MODEL, not markup - and because a component
 * full of JSX cannot be imported by a plain `node --test` run, which is what kept this untested.
 *
 * The grey [110,116,124] fallback is the tell that a team colour never arrived: if a payload change
 * ever drops primary_color, every band goes that flat grey, which is almost indistinguishable from
 * the charcoal ground at a glance. web/test/gridbands.test.mjs pins it.
 */
export function tint(hex, f) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const [r, g, b] = m
    ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16))
    : [110, 116, 124];
  const mix = (c) => Math.round(c * f + 255 * (1 - f) * 0.08);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
