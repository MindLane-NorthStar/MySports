// The processed network marks and the rule for WHEN one is allowed to appear.
//
// scripts/build_web_marks.py publishes web/public/marks/{slug}.png plus manifest.json = [{slug, hf}].
// `hf` is the frozen ink-area normalization factor: every mark renders at the same base height and is
// multiplied by its own hf, so a thin wordmark and a fat roundel carry equal visual weight. The app
// never re-derives it - if a mark looks wrong, the fix is a recipe in the Python table, not CSS here.

import manifest from '../public/marks/manifest.json' with { type: 'json' };
import { markUrl } from './config.js';

const HF = new Map(manifest.map((m) => [m.slug, m.hf]));

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
