// The processed network marks and the rule for WHEN one is allowed to appear.
//
// scripts/build_web_marks.py publishes web/public/marks/{slug}.png plus manifest.json = [{slug, hf}].
// `hf` is the frozen ink-area normalization factor: every mark renders at the same base height and is
// multiplied by its own hf, so a thin wordmark and a fat roundel carry equal visual weight. The app
// never re-derives it - if a mark looks wrong, the fix is a recipe in the Python table, not CSS here.

import manifest from '../public/marks/manifest.json' with { type: 'json' };
import { markUrl } from './config.js';

const HF = new Map(manifest.map((m) => [m.slug, m.hf]));

/** Published pixel dimensions per slug, for the rail's ink-area fit. */
const DIM = new Map(manifest.map((m) => [m.slug, { w: m.w, h: m.h }]));

/** Height factor for a slug, or null when this network has no published mark. */
export function markHf(slug) {
  const v = HF.get(String(slug || '').toLowerCase());
  return v === undefined ? null : v;
}

export function hasMark(slug) {
  return markHf(slug) !== null;
}

/**
 * A listings row shows the GREY NETWORK TEXT for every matchup, and additionally the processed mark
 * only for **access-profile networks**.
 *
 * Having a published mark IS being an access-profile network: assets/network-logos holds art for
 * exactly the networks in data/access_profile.json plus Cleveland's own local rows, which is what
 * data/row_order.json builds the rail from. An out-of-market RSN - NBCS BA, Chicago Sports Network,
 * Marlins.TV - has no mark and therefore renders as grey text alone, which is the intended result.
 *
 * Note what this deliberately does NOT key off: the per-GAME `access_status`. Whether Cleveland gets
 * THIS Sunday's CBS regional game is a market question answered per game; whether CBS is a network in
 * the viewer's profile is not. Keying the mark off the former hid the CBS and FOX marks on every game
 * whose regional assignment was not yet entered, which is not what the rule says.
 */
export function showsMark(broadcast) {
  return Boolean(broadcast) && hasMark(broadcast.service_id);
}

/** The <img> props for a mark sized to a line box: 2/3 of the stack height, scaled by hf. */
export function markStyle(slug, stackHeight) {
  const hf = markHf(slug);
  if (hf === null) return null;
  return { src: markUrl(slug), height: Math.round((stackHeight * 2) / 3 * hf) };
}

/* ------------------------------------------------------------------ the GRID RAIL's own fit
 *
 * WHY THE RAIL NEEDS ITS OWN FUNCTION, and the finding that produced it.
 *
 * Joe reported "NBC renders much smaller than FOX". NBC is at the rail's MAXIMUM height - 30px,
 * tied for the tallest thing in the column. It reads smaller because it is a square roundel drawn
 * at 30 x 30 while FOX is a wordmark drawn at 61 x 25.8: the eye weighs ink AREA, not height, and
 * FOX carried 71% more of it.
 *
 * THE MECHANISM IS NOT WHAT IT LOOKS LIKE. `markStyle()` computes a height from `hf`, the frozen
 * ink-area normalization factor - but THE RAIL NEVER APPLIED IT. MobileGrid's rail cell called
 * `markStyle(row.id, 42).src` and used only `.src`; the <img> carried no height attribute at all,
 * and `.mrail-mark img { max-width:100%; max-height:100%; object-fit:contain }` fit every mark into
 * a 61 x 30 box on its own. So `hf` did not merely lose to a clamp for the widest marks - it played
 * NO PART IN THE RAIL, for any of the 28. Measured live in the browser: every rail mark reported
 * `height` attribute null, and the drawn sizes matched the CSS fit box exactly.
 *
 * That is why this is a new function rather than a change to `markStyle()`. `markStyle` has two
 * other callers - MobileGrid's sport band and GameDetail - which are different surfaces at
 * different sizes, and Joe scoped this ruling to the GRID views only. Both are left alone.
 *
 * THE RULE. Every mark is drawn at the same INK AREA, so a square roundel and a long wordmark carry
 * equal visual weight, with two ceilings it may not exceed:
 *
 *     H = min( sqrt(TARGET / a),   the equal-ink-area height - the rule itself
 *              BOX_W / a,          never wider than the rail's content box
 *              MAX_H )             never taller than .mrail-mark
 *
 * At 60/600 twenty-six of twenty-eight marks land exactly on the target and the ink-area spread
 * falls from 3.00x to 1.40x. The two that cannot reach it are the two widest lockups, ESPN2
 * (aspect 5.23 -> 9.9px) and HBO Max (aspect 6.30 -> 8.2px); both were already the two smallest
 * marks in the column, so nothing new becomes the worst offender. The `BOX_W / a` term stops
 * binding at aspect 52^2/600 = 4.51, so compact art at or below that brings all 28 onto one weight
 * WITH NO CODE CHANGE - the fit recomputes from the manifest. That is the point of making it
 * data-driven.
 *
 * THE TRADE, and why Joe's two asks could not both be met. Holding every mark at NBC's current
 * ~900px^2 would need a 75px content box - a rail of 83px, FOURTEEN PIXELS WIDER than before,
 * because the widest wordmark sets the ceiling for everyone. Narrowing the rail forces the uniform
 * size down. Shown the measured trade, Joe ruled 60px / 600px^2 on 2026-09-06.
 */

/** px^2 of drawn ink box, the uniform target. Joe's ruling, 2026-09-06. */
export const RAIL_TARGET_AREA = 600;

/* The rail's CONTENT box width. It is `--rail-w` minus the two things that eat into it, and all
   three numbers live in web/app/globals.css:
       --rail-w                              60px
       .mrail-cell border-right              -2px   (2px solid var(--line-grid), B2 surface 1 of 3)
       .mrail-cell padding: 4px 3px          -6px   (3px on each side)
   = 52px. It cannot be read from the stylesheet without a runtime measurement, so it is stated here
   with its terms named: anyone changing the rail width must change this line too. */
export const RAIL_BOX_W = 52;

/** `.mrail-mark`'s height. At a 600px^2 target this ceiling does not bind for any published mark. */
export const RAIL_MAX_H = 30;

/**
 * The <img> props for one GRID RAIL mark: equal ink area, clamped by the box.
 * Returns null when the network has no published mark - the caller renders call letters instead.
 */
export function railMark(slug) {
  const key = String(slug || '').toLowerCase();
  const d = DIM.get(key);
  if (!d || !d.w || !d.h) return null;
  const a = d.w / d.h;
  const h = Math.min(Math.sqrt(RAIL_TARGET_AREA / a), RAIL_BOX_W / a, RAIL_MAX_H);
  return { src: markUrl(key), height: h, width: h * a };
}
