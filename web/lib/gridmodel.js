// Mobile grid geometry - docs/rendering-contract-mobile.md M2 (time scale) and M3 (gap collapse).
//
// Pure functions, no DOM: the component measures text and hands the widest line in, so the same
// arithmetic can be exercised without a browser.

// The per-team cap surface and art (Joe's candidate-D ruling, 2026-09-04). Generated from the logos
// at render size by scripts/build_cap_table.py; read here, never derived here.
import capTable from './cap-table.json' with { type: 'json' };

// Joe's per-team band and ink for the four pro leagues (2026-09-08), judged by eye at grid scale.
// A TABLE AND NOT A RULE, on purpose: four candidate rules were tested against these 124 judgements
// and the best of them reproduced 83, so a rule plus 41 overrides would be bigger and less honest
// than the table itself. Read here, never derived here, and never extended to college - nobody has
// judged a college block, so those keep bandFor()'s own answer.
import proColours from '../../data/grid_colors_pro.json' with { type: 'json' };

const CAP_TABLE = capTable.teams || {};
const PRO_COLOURS = proColours.teams || {};
/** The tinted level. With candidate D this is one of TWO cap surfaces, not the global one. */
export const CAP_TINT = 0.72;

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


/* ---------------------------------------------------------------- CONTRACT §3, MOBILE BAND RULE
 *
 * JOE'S RULING (2026-09-04), replacing §3's band-and-ink rule on the phone: whichever of a team's two
 * colours is LIGHTER paints the band, and the darker one is the ink. Where that pair is not legible,
 * the band still keeps the team colour and only the INK is neutralised.
 *
 * WHY §3 AS WRITTEN CANNOT STAND HERE. §3 says the band is always the PRIMARY, with white-or-charcoal
 * ink and a x0.82 darkening loop to rescue white. That was written for the printed PC grid on white
 * paper. On the phone every block sits on a dark ground, and measured across the 357 teams that play
 * this season, the primary-always band lands under 3:1 against that ground on 251 of them and under
 * 1.5:1 on 107 - dark shapes on a dark ground. Joe's rule: 47 and 16, average 9.06:1 against 2.75:1.
 * That is a contract defect on this surface, not a preference.
 *
 * THERE IS NO DARKENING. The x0.82 loop existed to rescue white ink on a too-dark band; here the band
 * is always the lighter colour and the ink adapts to it, so bands render at exactly the brand colour,
 * never modified. If this function ever seems to need the loop, something else is wrong.
 *
 * THE FALLBACK IS A DELIBERATE READING OF JOE'S WORDS, flagged for veto. He said "swap out white or
 * charcoal for the secondary colour". Read literally that puts the neutral INTO the pair and re-applies
 * "lighter paints the band" - which makes white the band on 94 teams, because white is lighter than
 * every team colour, and leaves only 14 of 108 fallback cards showing any team colour at all.
 * Neutralising the INK instead keeps a team colour on all 108. Same words, better served.
 */
const BAND_INK = '#f2f2f0';        // --ink
const BAND_CHARCOAL = '#101214';
export const BAND_MIN_RATIO = 3.0; // the names are large text, where 3:1 is WCAG AA

function chan(v) {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Parse a colour this codebase actually produces: `#rrggbb`, `rgb(r, g, b)` or `rgba(r, g, b, a)`.
 *
 * IT USED TO TAKE HEX ONLY, and that shipped a live defect in bf5a297. tint() returns a CSS string -
 * `rgb(126, 133, 137)` - so once candidate D started asking for the ink on a TINTED surface, every
 * call parsed to null, contrastRatio() returned null for both the team colours and the neutrals, and
 * `null >= null` is true in JS, so inkFor() fell out of its last branch with white and a null ratio.
 * All 109 tinted teams rendered white names whatever their colours; eleven of them at 1.68:1.
 *
 * The alpha in rgba() is deliberately ignored rather than composited: every surface we pass is opaque,
 * and silently blending against an unknown backdrop would be a worse answer than the one it replaces.
 */
function rgbOf(colour) {
  const s = String(colour || '').trim();
  const hex = /^#?([0-9a-f]{6})$/i.exec(s);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const fn = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*[\d.]+\s*)?\)$/i.exec(s);
  if (fn) {
    const c = [fn[1], fn[2], fn[3]].map((v) => Math.min(255, Math.max(0, Math.round(Number(v)))));
    return c.every((v) => Number.isFinite(v)) ? c : null;
  }
  return null;
}

/** Real sRGB relative luminance - not a luminance shortcut and not a tint() approximation. */
export function luminance(hex) {
  const c = rgbOf(hex);
  if (!c) return null;
  return 0.2126 * chan(c[0]) + 0.7152 * chan(c[1]) + 0.0722 * chan(c[2]);
}

/** WCAG contrast ratio. Returns null if either colour is unparseable. */
export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Joe's ruled band and ink for one team, or null where he has not ruled.
 *
 * Shaped like capFor(): an id the table does not carry falls back to TODAY'S behaviour, so college -
 * every team of it - and any team that arrives before the table is extended renders exactly as it
 * does now rather than breaking.
 */
export function gridColourFor(teamId) {
  const row = teamId == null ? null : PRO_COLOURS[String(teamId)];
  return row ? { band: row.band, ink: row.ink } : null;
}

/**
 * One team's band and the ink that goes on it.
 *
 * WITH A teamId THE TABLE ANSWERS, and the rule below is not consulted at all. Without one - which
 * is every existing caller and every test written about the rule - nothing changes. The ratio is
 * recomputed here by contrastRatio() rather than read from the file, so a stale number in the JSON
 * can never reach the app; the file's own `ratio` field is documentation, not input.
 *
 * ELEVEN OF JOE'S 124 LAND UNDER BAND_MIN_RATIO and that is deliberate - he chose each with the
 * measured ratio on screen beside it. This function does not correct them, and must not grow a floor
 * that overrides the table: a threshold that silently overrules a judgement is worse than a low one.
 *
 * @returns {{band: string, ink: string, inkIsNeutral: boolean, ratio: number}}
 */
export function bandFor(primaryHex, secondaryHex, teamId = null) {
  const ruled = gridColourFor(teamId);
  if (ruled) {
    const neutral = (c) => String(c).trim().toLowerCase();
    return {
      band: ruled.band,
      ink: ruled.ink,
      inkIsNeutral: neutral(ruled.ink) === neutral(BAND_INK)
                 || neutral(ruled.ink) === neutral(BAND_CHARCOAL),
      ratio: contrastRatio(ruled.ink, ruled.band),
    };
  }

  // The grey fallback on a missing primary is the same one tint() uses, and gridbands.test.mjs pins it.
  const p = rgbOf(primaryHex) ? String(primaryHex).trim() : '#6e747c';
  const s = rgbOf(secondaryHex) ? String(secondaryHex).trim() : null;

  const lp = luminance(p);
  const ls = s === null ? null : luminance(s);

  // 1. Both present and the pair is legible -> lighter paints, darker inks. Unmodified, both of them.
  if (s !== null) {
    const pair = contrastRatio(p, s);
    if (pair !== null && pair >= BAND_MIN_RATIO) {
      const band = ls > lp ? s : p;
      const ink = ls > lp ? p : s;
      return { band, ink, inkIsNeutral: false, ratio: pair };
    }
  }

  // 2. Otherwise the band STILL keeps the lighter team colour and only the ink is neutralised.
  const band = s !== null && ls > lp ? s : p;
  const rInk = contrastRatio(BAND_INK, band);
  const rChar = contrastRatio(BAND_CHARCOAL, band);
  const useInk = rInk >= rChar;
  return {
    band,
    ink: useInk ? BAND_INK : BAND_CHARCOAL,
    inkIsNeutral: true,
    ratio: useInk ? rInk : rChar,
  };
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
/**
 * The band rule GENERALISED to any surface (Joe's candidate-D ruling, 2026-09-04).
 *
 * bandFor() answers "what ink goes on the band". Once the name rows take the CAP's surface - which
 * is the band on some teams and tint(band, 0.72) on others - the same question has to be answerable
 * for whichever of the two a team actually got. This is that function, and on `surface === band` it
 * reproduces bandFor().ink exactly. `tests/test_cap_table.py` pins that over every real colour pair
 * and web/test/captable.test.mjs pins it again here (gridcolors.test.mjs reads the table too; there
 * is no `cap-table.test.mjs`, and that misnaming misled prompt 112); if the two ever drift, the name row and the cap stop
 * agreeing about the text colour and a block renders unreadable ink on a surface that measured fine.
 *
 * Of the team's two colours take the one with the higher ratio against the surface; use it when that
 * clears 3:1 and is not the surface itself, otherwise the better of --ink and charcoal.
 */
export function inkFor(surfaceHex, primaryHex, secondaryHex) {
  // The surface ALWAYS comes from our own code - bandFor().band or tint() of it - so one that will
  // not parse is a programming error, and the right place for it to surface is a failing test rather
  // than a phone rendering white-on-grey. Returning a null ratio is what let bf5a297 ship: the
  // function had no way to say "I could not answer" and said "white" instead.
  if (rgbOf(surfaceHex) === null) {
    throw new TypeError(`inkFor: unparseable surface ${JSON.stringify(surfaceHex)}`);
  }
  let best = null;
  for (const c of [primaryHex, secondaryHex]) {
    if (rgbOf(c) === null) continue;
    const r = contrastRatio(c, surfaceHex);
    if (r !== null && (best === null || r > best.ratio)) best = { ink: c, ratio: r };
  }
  if (best && best.ratio >= BAND_MIN_RATIO
      && String(best.ink).trim().toLowerCase() !== String(surfaceHex).trim().toLowerCase()) {
    return { ink: best.ink, ratio: best.ratio, neutral: false };
  }
  const rInk = contrastRatio(BAND_INK, surfaceHex);
  const rChar = contrastRatio(BAND_CHARCOAL, surfaceHex);
  return rInk >= rChar
    ? { ink: BAND_INK, ratio: rInk, neutral: true }
    : { ink: BAND_CHARCOAL, ratio: rChar, neutral: true };
}

/**
 * One team's cap surface level and art, from the generated table.
 *
 * The table is built by scripts/build_cap_table.py from the logos themselves, measured at render
 * size - it is not a runtime rule and must never become one, because the measurement needs the
 * pixels. An id the table does not carry falls back to TODAY'S behaviour (0.72, raw art), so a team
 * that arrives before the table is regenerated renders exactly as it does now rather than breaking.
 */
export function capFor(teamId) {
  const row = teamId == null ? null : CAP_TABLE[String(teamId)];
  const cap = row ? { tint: row.tint, art: row.art } : { tint: CAP_TINT, art: 'raw' };

  // A RULED TEAM'S CAP PAINTS THE BAND JOE CHOSE, UNTINTED (prompt 66).
  //
  // The two tables disagreed about the same pixels and the cap table was winning. 42 of the 124
  // ruled teams carry `tint: 0.72`, so what reached the screen was `tint(band, 0.72)` and not the
  // band he picked - his ink landed exactly, his band landed darkened. Measured in the DOM on
  // 2026-09-08: the Brewers painted rgb(19, 35, 60) where his choice is #13294b = rgb(19, 41, 75).
  // It cost four teams the 3:1 he chose them above - Bulls 3.78 -> 2.51, Phillies 4.11 -> 2.61,
  // Raptors 4.12 -> 2.68, Thunder 4.76 -> 2.98 - and took the Lions to 1.46, the worst block in the
  // app.
  //
  // TWO OF THOSE FOUR NOW SIT ON THE TINTED SURFACE ON PURPOSE, so read the line above as history
  // rather than as a live complaint. Prompt 69: Joe saw the Phillies and the Raptors at true grid
  // size and ruled that both should TAKE the tinted surface and lift the ink off it. That is done in
  // the DATA, not here - `grid_colors_pro.json` stores an exact hex, so the 0.72 tint of each band
  // is written in as the band itself (#e81828 -> #ad1723, #d91244 -> #a21337) with a #f2f2f0 ink.
  //
  // A `tint: 0.72` FLAG FOR THOSE TWO WOULD HAVE BROKEN THE INVARIANT BELOW. It is what makes the
  // blanket `tint: 1` safe: no single view mixes cap levels. Two ruled teams at 0.72 would put the
  // Phillies' block on a darker surface than the rest of an MLB grid. Writing the colour in keeps
  // every ruled cap flat and gets the same pixels - measured, not assumed: edge_crisp 0.000 -> 0.961
  // and 0.308 -> 1.000, ink ratio 4.11 -> 6.41 and 4.12 -> 6.98.
  //
  // STORING A PRE-TINT VALUE INSTEAD CANNOT WORK. `tint()` below computes c*f + 255*(1-f)*0.08, so
  // at f = 0.72 it maps 0-255 onto 5.712-189.312. THIRTY-THREE of the 124 ruled bands have a channel
  // above that ceiling and are not outputs of that function at any input - the Browns' #ff3c00, the
  // Flyers' #fe5823, the Warriors' #fdb927. A quarter of the table cannot be expressed that way.
  //
  // The usual objection to mixing cap levels does not apply: a grid renders one sport, every pro
  // team is ruled and no college team is, so no single view mixes a tinted cap with an untinted one.
  //
  // `art` IS LEFT AS THE TABLE MEASURED IT, and that is a known loose end rather than an oversight:
  // 16 of the 42 carry `art: 'dark'`, chosen because the dark lockup read better on the TINTED
  // surface, and the surface under them has just changed. Re-measuring it needs the pixels at render
  // size (scripts/build_cap_table.py), which is not a runtime rule and not this change.
  return gridColourFor(teamId) ? { tint: 1, art: cap.art } : cap;
}

export function tint(hex, f) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  const [r, g, b] = m
    ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16))
    : [110, 116, 124];
  const mix = (c) => Math.round(c * f + 255 * (1 - f) * 0.08);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
