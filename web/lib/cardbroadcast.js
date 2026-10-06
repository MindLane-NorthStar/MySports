// WHICH BROADCAST A GAME CARD AND A GRID LANE NAME (prompt 126, Joe's report 2026-09-30).
//
// Joe, on his phone: the Blue Jackets opener (BUF @ CBJ, 2026-10-01) showed NO network mark on its
// list card while the Prime Video mark sat in the game's detail panel. The data was right - four
// active rows, `cbjnhl` primary with access `unknown`, `prime-video` available, and a verdict of
// "stream only: prime-video". The card named `cbjnhl` because it was primary; `cbjnhl` has no
// published mark, so the mark column was empty on a game the reconciler had decided he can watch.
//
// THE RULE IS KEYED TO THE MARK, and that is what bounds it. The pick the card has always made -
// primary, then a linear row, then whatever is left - is KEPT whenever it shows a mark, so no card
// that draws a mark today can change: the NFL's ABC/ESPN simulcasts keep ABC although the verdict
// names ESPN. Only when that pick shows nothing does the card name a row the verdict names instead,
// and only one that is active on the game and has a mark. Otherwise the pick stands.
//
// NO SECOND ELIGIBILITY RULE IS DERIVED HERE (the D4/E3 note on GAME_SELECT in lib/queries.js). The
// two fields are read as pipeline/reconcile.py wrote them: `eligible_via_network_id` is the first
// receivable LINEAR row and `eligible_via_service_ids` the receivable STREAMING rows, and both are
// empty on a game that is not eligible, so there is no `eligible` test to repeat.
//
// IT IS ONE FUNCTION FOR THE CARD AND THE GRID. MobileGrid chooses a game's lane with it, so a game
// cannot sit in a rail row for a feed the list card declined to name. It lives in lib/ rather than
// in components/MatchupCard.js, which re-exports it, because that file is JSX and `node --test`
// cannot import it - the rule has to be runnable by the gate that guards it.
//
// WHAT THIS DOES NOT TOUCH: `cardMarkSlug()` and `simulcastLanes()` in lib/marks.js (the Cavaliers
// collapse, which the card consults BEFORE this pick), `programBroadcast()` in ProgramCard.js, and
// GameDetail, which lists every active row.
//
// THE MARK THE CARD WEARS AND A ROW'S NAME LIVE HERE TOO (prompt 127). `/api/my-games` answers with
// what the card shows, and a second copy of either rule in the route is the defect rule 32 names.
// `cardMark()` is the line MatchupCard used to compose inline - the collapse first, then this pick's
// own mark - and the card now calls it. `broadcastName()` is the words GameDetail and MobileGrid's
// rail print for a row; the card prints no network name at all (lib/marks.js, `showsMark`), so that
// one is the panel's rule, and test/mygames.test.mjs holds both components' copies to it.

import { showsMark, cardMarkSlug } from './marks.js';
import { markUrl } from './config.js';

/** The reconciler's verdict row; the embed arrives as an array or an object (lib/offservice.js). */
function eligibilityRow(game) {
  const e = game?.eligibility;
  return Array.isArray(e) ? e[0] : e;
}

/**
 * The broadcast the card names. Primary first, then a linear row, then whatever is left - and that
 * pick stands whenever it shows a mark. When it shows none, the first service the eligibility
 * verdict names that has an active row on the game and a mark: the linear network, then the
 * streaming services in the verdict's own order. Failing that, the pick again.
 */
export function cardBroadcast(game) {
  const rows = (game.broadcasts || []).filter((b) => b.active !== false);
  if (!rows.length) return null;
  const pick = rows.find((b) => b.is_primary) || rows.find((b) => b.delivery_surface === 'LINEAR') || rows[0];
  if (showsMark(pick)) return pick;
  const verdict = eligibilityRow(game);
  const named = [verdict?.eligible_via_network_id, ...(verdict?.eligible_via_service_ids || [])];
  for (const id of named) {
    const row = id ? rows.find((b) => b.service_id === id) : null;
    if (showsMark(row)) return row;
  }
  return pick;
}

/**
 * The mark the list card wears, with the row it names.
 *
 * THE CAVALIERS' SIMULCAST COLLAPSES TO ONE CARD (prompt 106, Joe 2026-09-16): `cardMarkSlug` derives
 * the composite from the game's own rows and is asked FIRST, before the pick above. Null there means
 * "nothing to collapse", which is every other game, and the card wears the pick's own mark when it
 * has one. `url` is a path under this site, versioned; `composite` is the composite's slug or null.
 */
export function cardMark(game) {
  const b = cardBroadcast(game);
  const collapsed = cardMarkSlug(game);
  return {
    broadcast: b,
    composite: collapsed,
    url: collapsed ? markUrl(collapsed) : (showsMark(b) ? markUrl(b.service_id) : null),
  };
}

/** A broadcast row's name in words: the network's, then the row's own label, then the service id. */
export function broadcastName(b) {
  return b.network?.canonical_name || b.label || b.service_id;
}
