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
   *   portrait   86.06px  "116 - 104"      .mscore at 17px          <- the binding case
   *              80.05px  "Final pending"  .mslot-state at 13px
   *              61.75px  "Postponed"
   *   desktop    98.52px  "Final pending"  .mslot-state at 16px     <- the binding case
   *              86.06px  "116 - 104"
   *              76.00px  "Postponed"
   *
   * Rounded up to the next even pixel for sub-pixel and font-fallback variance. The three-digit
   * score is a real NBA line, not a hypothetical: at today's 46px portrait floor with a
   * `max-width: 84px` cap, `116 - 104` would already have overflowed its slot.
   */
  track: { portrait: 88, desktop: 100 },
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
