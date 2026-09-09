// THE CLIENT'S HALF OF THE LIVE POLL - the decisions, with no React, no DOM and no fetch.
//
// IT LIVES HERE SO IT CAN BE TESTED, the same reason and the same shape as lib/autoscroll.js and
// lib/headerstate.js: `components/Listing.js` imports `next/navigation`, which does not resolve
// under a bare `node --test` run, so anything defined beside the effect can only be reached by
// reading the component's source as text.
//
// ---------------------------------------------------------------------------------------------
// WHY 60 SECONDS, AND WHY NOT LESS (prompt 77, Joe's ruling 2026-09-09).
//
// `lib/livescores.js` caches every upstream fetch for 60 seconds (`REVALIDATE_SECONDS`). The server's
// answer is therefore never more than a minute old, and the phone was waiting fifteen
// (`REFRESH_SECONDS = 900`) - the staleness Joe saw was entirely the client's.
//
// MATCHING THE CACHE EXACTLY is what makes this interval the right one rather than merely a faster
// one: every fetch crosses a cache boundary and returns genuinely new data, and none is wasted.
// GOING BELOW IT BUYS NOTHING without also shortening `REVALIDATE_SECONDS`, and that means more calls
// out to ESPN, the NHL and MLB - which livescores.js records one of 403ing an honest bot on
// 2026-09-03. The two numbers are a pair; move them together or not at all.
export const LIVE_POLL_SECONDS = 60;

/**
 * Is anything on this page inside its live window?
 *
 * MOVED OUT OF components/Listing.js UNCHANGED (prompt 77), including the 15-minutes-before to
 * 4-hours-after bracket. The gate itself is not what this prompt was about: a quiet page must make
 * no request at all, and that was already right. What moved is where it can be tested from.
 *
 * `now` is injectable for the tests. It is NOT threaded from the server: a clock that reaches the
 * client through a prop is a hydration mismatch waiting to happen (the trap prompt 42 fell into
 * twice), and this is only ever called inside an effect, which is after hydration.
 */
export function anyInFlight(games, now = Date.now()) {
  return (games || []).some((g) => {
    if (g.result_status === 'in_progress') return true;
    if (g.result_status === 'final' || !g.canonical_kickoff_at_utc) return false;
    const t = new Date(g.canonical_kickoff_at_utc).getTime();
    return Number.isFinite(t) && now >= t - 15 * 60_000 && now <= t + 4 * 60 * 60_000;
  });
}

/**
 * The rows the route returned, as the Map `applyOverlay` consumes.
 *
 * A Map does not survive JSON, so the route sends `[...map.values()]` and this rebuilds it. Keyed by
 * `String(gameId)` because that is exactly what `applyOverlay` looks up with - livescores.js:255
 * does `overlayMap.get(String(g.id))`, and a number-keyed map would miss every one of them.
 */
export function overlayMapFromRows(rows) {
  const map = new Map();
  for (const r of rows || []) {
    if (r && r.gameId != null) map.set(String(r.gameId), r);
  }
  return map;
}

/**
 * May this tick actually go out to the network?
 *
 * THREE CONDITIONS, and the middle one is the one this prompt added. A BACKGROUNDED PWA ASKING EVERY
 * MINUTE IS PURE WASTE - iOS keeps the document alive across a backgrounding (which is the whole
 * premise of AutoScroll's arrival rule), so without this a phone in a pocket polls all day.
 *
 *   live     this Listing is TODAY's - see the note on the prop in components/Listing.js
 *   visible  the document is on screen
 *   inFlight something on the page is inside its window
 *
 * Pure, so the three can be pinned in a test rather than inferred from an effect body.
 */
export function shouldFetchLive({ live, visible, games, now = Date.now() }) {
  return Boolean(live) && Boolean(visible) && anyInFlight(games, now);
}
