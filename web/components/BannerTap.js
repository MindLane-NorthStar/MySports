'use client';

// THE TV IS A CONTROL NOW (prompt 60 stage 1). Joe: "I'd like the banner to collapse as you scroll
// up OR by a purposeful tap on the tv ON the banner."
//
// AN ILLUSTRATION THAT SILENTLY BECAME TAPPABLE IS WORSE THAN NO CONTROL, so this is a real
// <button> - focusable, named, keyboard-operable, with a visible focus ring and a target that
// measures 47.0 x 49.5 CSS px at 360 and 51.0 x 53.6 at 390. Not an onClick on an <image>.
//
// IT IS AN OVERLAY, NOT AN EDIT TO THE ARTWORK, and that is load-bearing rather than tidy.
// BannerMobileV2.jsx and BannerDesktopV2.jsx are GENERATED from banner-mobile-v2.json by
// scripts/build_banner_mobile.py, which prompt 57 wrote precisely so the committed JSX and the JSON
// can be proved identical (`--check` exits 1 on drift). Wrapping the <image> in a <button> inside
// the generated file would break that check the moment anyone regenerated it. The coordinates here
// are the artwork's own, expressed as PERCENTAGES of the stage:
//
//   phone    stage 428 x 135, TV at x=306.04 y=43.1 w=55.93 h=58.8
//   desktop  stage 1400 x 200, TV at x=1165.06 y=50.5 w=99.87 h=105
//
// Both SVGs are width="100%" over their own viewBox with no CSS height, so a percentage of the
// positioned parent IS a percentage of the stage at every width, and the button tracks the TV
// through every resize without a single measured pixel. If the artwork moves, the JSON moves, the
// component is regenerated - and THESE SIX NUMBERS have to move with it. globals.css carries them.

import { collapseHeader } from '../lib/headerstate.js';

/**
 * @param {{variant: 'mobile'|'desktop'}} props - which stage's coordinates to use. The two banners
 *   are both mounted at once (Banner.js explains why) and CSS chooses which paints, so each needs
 *   its own button rather than one shared box: a single overlay would sit at the phone's
 *   coordinates over the desktop art.
 */
export default function BannerTap({ variant }) {
  return (
    <button
      type="button"
      className={`bn-tvtap bn-tvtap--${variant}`}
      // WHAT IT DOES, not what it is. The banner is the thing on screen and "collapse" is the verb
      // Joe used; a name like "TV" would describe the picture and tell a screen-reader user nothing
      // about pressing it. There is no `aria-expanded` here on purpose - this button only ever
      // collapses, so there is no two-state affordance for it to announce (the navbar's league tile
      // DOES carry one, because that one really does toggle).
      aria-label="Collapse the banner"
      onClick={() => collapseHeader()}
    />
  );
}
