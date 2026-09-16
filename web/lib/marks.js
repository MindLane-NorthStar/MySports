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
 * A listings row shows the processed mark only for **access-profile networks**.
 *
 * THIS USED TO BEGIN "shows the GREY NETWORK TEXT for every matchup, and additionally the processed
 * mark", AND THAT HAS BEEN FALSE SINCE RULING A3 (prompt 56). `networkText()` was deleted from
 * components/MatchupCard.js with that ruling - the grey line under the matchup is the VENUE now, the
 * network name is not on the card at all, and the mark is the only thing that names the service
 * there. Corrected by prompt 106 (rule 30), because this sentence was read as live behaviour when
 * that prompt was written: it carried a ruling to SUPPRESS the network text on a collapsed row, and
 * there has been no text on any row to suppress for two months. The rows that name a service in
 * words are GameDetail's, and the grid rail's labels.
 *
 * Having a published mark IS being an access-profile network: assets/network-logos holds art for
 * exactly the networks in data/access_profile.json plus Cleveland's own local rows, which is what
 * data/row_order.json builds the rail from. An out-of-market RSN - NBCS BA, Chicago Sports Network,
 * Marlins.TV - has no mark and therefore renders NOTHING in the card's mark column, which is the
 * intended result. (That clause read "renders as grey text alone" and is corrected with the sentence
 * above: the column holds an invisible placeholder so the track keeps its width - `.mnet-mark-empty`
 * in globals.css - and the name is not printed anywhere on the card.)
 *
 * Note what this deliberately does NOT key off: the per-GAME `access_status`. Whether Cleveland gets
 * THIS Sunday's CBS regional game is a market question answered per game; whether CBS is a network in
 * the viewer's profile is not. Keying the mark off the former hid the CBS and FOX marks on every game
 * whose regional assignment was not yet entered, which is not what the rule says.
 */
export function showsMark(broadcast) {
  return Boolean(broadcast) && hasMark(broadcast.service_id);
}

/* ------------------------------------------------- the Cavaliers' OTA simulcast, collapsed (prompt 106)
 *
 * JOE'S RULING, 2026-09-16: the GRID shows every network airing the game - the CBS/WOIO row, the
 * WUAB 43 lane and the RESN/DAZN lane, so a both-station game appears three times on one grid,
 * deliberately - while the LIST shows ONE CARD per game wearing the composite mark for its state.
 *
 * DERIVED FROM THE SERVICES PRESENT ON THE GAME, never from data/local_rights.json. The rendering
 * surface has no business knowing which games were hand-entered: by the time a card is drawn, the
 * fact is simply which rows the game carries, and that is a question about this game rather than
 * about the package. The adapter is the only thing that reads the announcement.
 *
 *   dazn + cbs               -> cbs-dazn       the nine WOIO-only games
 *   dazn + wuab-43 + cbs     -> cbs-wuab-43    the four on both stations
 *   dazn + wuab-43           -> wuab-43        the two WUAB-only games; the mark already exists
 *   dazn alone               -> null, and the ordinary single-mark path draws `dazn` as it does today
 *
 * `wuab-43` ALREADY CARRIES RESN/DAZN INSIDE IT, which is why the three-service row takes the
 * two-part `cbs-wuab-43` stack rather than anything with a third tier.
 */
const SIM_DAZN = 'dazn';
const SIM_WUAB = 'wuab-43';
const SIM_CBS = 'cbs';

/**
 * The slug the LIST card should wear for this game, or null to use the ordinary single-mark path.
 * @param {{broadcasts?: Array<{service_id?: string, active?: boolean}>}} game
 */
export function cardMarkSlug(game) {
  const ids = new Set((game?.broadcasts || [])
    .filter((b) => b && b.active !== false)
    .map((b) => String(b.service_id || '').toLowerCase()));
  if (!ids.has(SIM_DAZN)) return null;            // not a Cavaliers local game; nothing to collapse
  if (ids.has(SIM_WUAB)) return ids.has(SIM_CBS) ? 'cbs-wuab-43' : SIM_WUAB;
  if (ids.has(SIM_CBS)) return 'cbs-dazn';
  return null;
}

/**
 * THE COMPOSITES ARE LIST-VIEW ONLY (Joe, 2026-09-16), and this is where that fact lives.
 *
 * `railmark.test.mjs` recorded the hole prompt 104 left: the ruling was a convention, and NOTHING in
 * the manifest records a mark's surface - a mark is a slug and a size. Both composites land on the
 * rail's 600px² target, so a leak would render perfectly and nobody would see it.
 *
 * WHAT ACTUALLY KEEPS THEM OUT, and it is two facts rather than a check: a rail lane is a row in
 * `data/row_order.json` and a grid/detail mark is a broadcast's `service_id`. No composite is either
 * - no adapter emits one as an outlet, and neither is a network. This set is what a test asserts
 * those two facts against, and what a future surface should consult before drawing a mark it did not
 * get from `cardMarkSlug()`.
 */
export const LIST_ONLY_MARKS = new Set(['cbs-dazn', 'cbs-wuab-43']);

/**
 * THE GRID SHOWS A LANE PER NETWORK AIRING THE GAME (Joe, 2026-09-16) - the other half of the same
 * ruling, and the opposite of the list's.
 *
 * "Every network airing a Cavs game shows it on the grid - the WOIO/CBS row, the WUAB 43 lane, and
 * the RESN/DAZN lane, as applicable per game." A both-station game therefore appears THREE TIMES on
 * one grid. **Deliberate, not duplication**: the grid's question is "what is on this channel at this
 * hour", and the answer for all three channels is this game.
 *
 * SCOPED TO THE SIMULCAST, AND THAT SCOPE IS LOAD-BEARING. `MobileGrid` otherwise draws one block per
 * game, chosen by `cardBroadcast()`. Making every game occupy a lane per broadcast would put every
 * CFB game on ESPN and ESPN+ into two rows, double the blocks on a Saturday, and move the block and
 * lane counts the geometry gate holds as hard stops. This returns [] for every game that is not one
 * of the fifteen, so nothing else on any grid moves.
 *
 * @returns {string[]} service ids to draw a lane for, in rail order; empty when the normal rule applies
 */
export function simulcastLanes(game) {
  if (!cardMarkSlug(game)) return [];          // not a collapsed simulcast: one block, as today
  const ids = new Set((game?.broadcasts || [])
    .filter((b) => b && b.active !== false)
    .map((b) => String(b.service_id || '').toLowerCase()));
  return [SIM_CBS, SIM_WUAB, SIM_DAZN].filter((id) => ids.has(id));
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
