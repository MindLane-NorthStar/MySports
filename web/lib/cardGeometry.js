// The list card's right half, in numbers - one source for the CSS, the component and the tests.
//
// Joe's ruling, 2026-09-04: the right half is TWO FIXED-WIDTH COLUMNS - the network mark, and the
// three-row data slot - each with its content centred on its own vertical centreline, so that looking
// down a mixed list every mark sits on one line and every slot sits on another. Nothing here is
// `auto` any more, because an auto track is sized by its content and therefore moves per card: stage
// 1 measured the mark column swinging 41-62px in portrait and 41-92px in landscape, which dragged the
// matchup column with it by the same amount and left the marks' left edges ragged by 39.1px and
// 57.1px respectively. The right edges lined up; nothing else did.
//
// TWO BREAKPOINTS, because `@media (max-width: 560px)` already gives the phone its own card geometry
// (a 56px time column, a 46px slot floor, a 20px row-1 image, a 13px row 3). Every number below is
// stated per breakpoint for that reason, and the CSS is the only place they are applied.

/** The phone. Matches `@media (max-width: 560px)` in globals.css. */
export const PORTRAIT_MAX = 560;

export const MARK = {
  /** The fixed grid track the network mark column occupies. */
  track: { portrait: 62, desktop: 92 },
  /**
   * The box the mark's <img> is fitted into, `object-fit: contain`, centred both ways.
   *
   * `hf` IS DELIBERATELY NOT APPLIED HERE. The frozen ink-area factors in
   * web/public/marks/manifest.json still govern the banner and the grid rail; on the listings card
   * they produced heights from 22px to 45px and widths from 39.7px to 92px, which is the ragged
   * column above. Joe's cost, accepted: the median mark loses about 18% of its delivered ink in
   * portrait and Guards TV loses 21%, which is the worst of the set.
   */
  box: { portrait: { w: 56, h: 40 }, desktop: { w: 84, h: 44 } },
};

export const SLOT = {
  /**
   * The fixed grid track for the three-row slot, sized from the WIDEST STRING THE LADDER CAN EMIT,
   * measured in the real faces rather than estimated (stage 2a):
   *
   *   portrait   80.05px  "Final pending"  .mslot-state at 13px     <- the binding case
   *              75.94px  "116 - 104"      .mscore at 15px, stepped down
   *              61.75px  "Postponed"
   *   desktop    98.52px  "Final pending"  .mslot-state at 16px     <- the binding case
   *              75.94px  "116 - 104"
   *              76.00px  "Postponed"
   *
   * Rounded up to the next even pixel for sub-pixel and font-fallback variance.
   *
   * PORTRAIT WAS 88px, set from "116 - 104" at 17px (86.06px). Stepping a three-digit score down one
   * size (format.js row2Size) takes it to 75.94px and hands the binding case to `Final pending` - the
   * stale-live guard's string - at 80.05px. Six pixels back to the matchup column, which is what let
   * New Hampshire and James Madison stop truncating at 390px. `Final pending` binds at BOTH
   * breakpoints now and is deliberately not renamed to buy width: it is the honest label for a row
   * whose score the pipeline never delivered.
   */
  track: { portrait: 82, desktop: 100 },
  /** Row 1: the favoured/winning team's mark, and the TIED word sized to the same box. */
  row1: { portrait: 44, desktop: 44 },
  /** Measured gaps between the three rows, unchanged from stage 1. */
  gap: { portrait: 3, desktop: 3 },
};

/** Pick a breakpoint's numbers by viewport width, the way the media query does. */
export function forWidth(width) {
  const key = width <= PORTRAIT_MAX ? 'portrait' : 'desktop';
  return {
    key,
    markTrack: MARK.track[key],
    markBox: MARK.box[key],
    slotTrack: SLOT.track[key],
    row1: SLOT.row1[key],
    gap: SLOT.gap[key],
  };
}

// ---------------------------------------------------------------- the team name's room (prompt 42)
//
// The card's fit order now mirrors the grid's. The PC contract §3 states the grid's as
// "shrink the whole line to keep the record -> drop the record -> shrink the name alone", and the
// card had neither half of it: the record was `flex: 0 0 auto`, so it took its ~37px whatever the
// name needed, and the name's tier stepped on CHARACTER COUNT rather than on the room it actually
// had. "South Alabama" is thirteen characters, so it rendered at 15px and needed 110px in 81px.
//
// Measured at 390px over the four loaded days, 206 team lines: 70 truncated. Width-measured tiers
// alone take that to 16, the record yielding alone takes it to 58, and the two together to 3.

/** The three sizes the name may take, largest first. Unchanged; only how one is chosen has moved. */
export const NAME_TIERS = [15, 12.5, 11];

/** The logo box and the flex gap inside `.tl1`, which the name has to share the row with. */
export const NAME_ROW = { logo: 20, gap: 7 };

/**
 * The largest tier whose rendered width fits `avail`, or the smallest tier when none does.
 *
 * Returns `{ px, fits }` - `fits: false` means even 11px overruns, so the name will ellipsis and the
 * caller has already conceded everything it can. `measure` is the canvas measurer from
 * useTextMeasurer; `font` is a CSS font shorthand builder taking the size in px.
 */
export function fitNameTier(measure, name, avail, font, letterSpacing = 0) {
  const text = String(name || '');
  if (!measure || !(avail > 0)) return { px: NAME_TIERS[0], fits: true };
  for (const px of NAME_TIERS) {
    // measureText excludes letter-spacing, so it is added per character where the face carries it.
    const w = measure(text, font(px)) + letterSpacing * px * text.length;
    if (w <= avail) return { px, fits: true };
  }
  return { px: NAME_TIERS[NAME_TIERS.length - 1], fits: false };
}

/**
 * How much of the row is left for the name, with and without the record beside it.
 *
 * `.tl1` is a flex row of logo, name and optionally record, with one gap between each pair - so the
 * record costs its own width AND a second gap, which at 390px is the difference between 81px of room
 * and 37px.
 */
export function nameRoom(rowWidth, recordWidth) {
  const withoutRecord = rowWidth - NAME_ROW.logo - NAME_ROW.gap;
  return {
    withoutRecord,
    withRecord: recordWidth > 0 ? withoutRecord - NAME_ROW.gap - recordWidth : withoutRecord,
  };
}

/**
 * The whole concession, in one pure decision: what size the name takes and whether the record
 * survives beside it.
 *
 * Order, least-visible first: keep both and step the name down 15 -> 12.5 -> 11 while it still fits
 * beside the record; only when no tier fits does the record go; only when no tier fits WITHOUT the
 * record does the name truncate. A line therefore never shows a shortened name next to a full
 * record, which was the old behaviour and the wrong way round.
 *
 * THE RECORD IS DROPPED FROM THE FLOW, NOT HIDDEN. `visibility: hidden` keeps the box and its gap,
 * so it would concede nothing at all - the 44px it occupies is the entire point of dropping it.
 */
export function fitNameAndRecord(measure, name, recordWidth, rowWidth, font, letterSpacing = 0) {
  const room = nameRoom(rowWidth, recordWidth);
  const keep = fitNameTier(measure, name, room.withRecord, font, letterSpacing);
  if (keep.fits) return { px: keep.px, showRecord: true, truncates: false };
  const drop = fitNameTier(measure, name, room.withoutRecord, font, letterSpacing);
  return { px: drop.px, showRecord: false, truncates: !drop.fits };
}
