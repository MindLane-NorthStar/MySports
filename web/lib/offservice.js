// D4 / E3: which games are not on the viewer's services, and how to say so.
//
// THE ELIGIBILITY DECISION IS NOT MADE HERE. It is read from mysports.viewer_game_eligibility, which
// pipeline/reconcile.py writes from the access profile - active broadcasts whose access_status is in
// the eligible set and whose blackout_rule is not OUT_OF_MARKET. A second rule in JavaScript would
// drift from the reconciler and from the renderer's own "not on your services" count inside a month,
// and then two surfaces would disagree about the same game. This module only READS the verdict and
// turns it into a sentence.
//
// The count line is not decoration. Filtering games out and saying nothing would be a page that lies
// by omission - the viewer would see 63 games on a 83-game Saturday and have no idea the other 20
// existed. So the rule is: hide them by default, but always say how many and where they went.
//
// E5 ADDS A THIRD STATE, and it is exempt from all of that. A regional game whose market assignment
// has not published yet is neither watchable nor off-service: saying "not on your services" about it
// asserts a certainty the data does not have. Market-pending games are ALWAYS SHOWN, in every surface
// and every toggle state, and are NEVER counted inside "not on your services". On NFL Sunday that is
// the difference between hiding eleven of thirteen games and showing the slate with an honest caveat.

function eligibilityRow(game) {
  const e = game?.eligibility;
  return Array.isArray(e) ? e[0] : e;
}

/**
 * E5: ineligible ONLY because the regional map has not published yet.
 *
 * Read from viewer_game_eligibility.market_pending, which pipeline/reconcile.py computes. Not derived
 * here - a second implementation would drift from the reconciler exactly as a JS eligibility rule
 * would have. null means the reconciler has not judged this row, which is not the same as false.
 */
export function isMarketPending(game) {
  const row = eligibilityRow(game);
  if (!row) return false;
  return row.market_pending === true && row.eligible !== true;
}

/** The reconciler's verdict for one game. Absent row -> treated as eligible (shown), never hidden. */
export function isEligible(game) {
  const e = game?.eligibility;
  const row = Array.isArray(e) ? e[0] : e;
  // A game with NO eligibility row has not been judged, and an unjudged game is shown rather than
  // silently dropped. Hiding something we never assessed would be the worst of both behaviours.
  if (!row || row.eligible === null || row.eligible === undefined) return true;
  return Boolean(row.eligible);
}

export function eligibilityReason(game) {
  const e = game?.eligibility;
  const row = Array.isArray(e) ? e[0] : e;
  return row?.reason ?? null;
}

/** Display names of the outlets an off-service game is actually carried on. */
export function outletsFor(game) {
  const names = [];
  for (const b of game?.broadcasts || []) {
    if (b?.active === false) continue;
    const n = b?.network?.canonical_name;
    if (n && !names.includes(n)) names.push(n);
  }
  return names;
}

/**
 * Split a day's games and describe what was hidden.
 *
 * @returns {{on: Array, off: Array, total: number, offCount: number, outlets: string[], line: string|null}}
 */
export function offServiceSummary(games, { maxOutlets = 3 } = {}) {
  const rows = Array.isArray(games) ? games : [];
  const on = [];
  const pending = [];
  const off = [];
  for (const g of rows) {
    // Order matters: pending is tested FIRST, so a market-pending game can never fall into `off` and
    // be counted as unwatchable. That is the whole carve-out.
    if (isMarketPending(g)) pending.push(g);
    else if (isEligible(g)) on.push(g);
    else off.push(g);
  }

  return {
    on,
    pending,
    off,
    total: rows.length,
    onCount: on.length,
    pendingCount: pending.length,
    offCount: off.length,
    outlets: rankOutlets(off),
    pendingOutlets: rankOutlets(pending),
    line: countLine(rows.length, off.length, rankOutlets(off), maxOutlets),
    lines: countLines(rows.length, on.length, pending, off, maxOutlets),
  };
}

/** Outlets ranked by how many of these games they carry - the ones that actually cost something. */
export function rankOutlets(games) {
  const tally = new Map();
  for (const g of games || []) {
    for (const name of outletsFor(g)) tally.set(name, (tally.get(name) || 0) + 1);
  }
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}

/**
 * Trim a sponsor tail so a comma-joined list stays countable.
 *
 * RSN names carry their sponsors - "ABTV, presented by Pechanga Resort Casino", "Cardinals.TV
 * Presented by bet365". Left whole, the first of those puts a comma INSIDE an item and the line reads
 * as four outlets when it names two. The sponsor is never the information the viewer needs here.
 */
export function shortOutlet(name) {
  return String(name ?? '')
    .split(',')[0]
    .replace(/\s+(?:presented|pres\.?)\s+by\s+.*$/i, '')
    .trim();
}

/** Up to `max` short outlet names plus "and N more"; '' when there are none. */
function outletClause(outlets, max) {
  const named = [...new Set((outlets || []).map(shortOutlet).filter(Boolean))];
  if (named.length === 0) return '';
  const head = named.slice(0, max);
  const rest = named.length - head.length;
  return rest > 0 ? `${head.join(', ')} and ${rest} more` : head.join(', ');
}

/**
 * The three-way count, as separate lines (E5 §8 shape):
 *
 *     13 games
 *       2 on your services
 *       3 market pending - FOX, CBS - map publishes ~Wed
 *       8 not on your services - FOX, CBS
 *
 * Returns { total, on, pending, off } of strings, with null for a state that has no games in it - a
 * zero line is noise, and "0 market pending" invites the reader to wonder what they missed.
 */
export function countLines(total, onCount, pending, off, maxOutlets = 3) {
  const pendingOutlets = outletClause(rankOutlets(pending), maxOutlets);
  const offOutlets = outletClause(rankOutlets(off), maxOutlets);
  const pendingCount = (pending || []).length;
  const offCount = (off || []).length;
  return {
    total: `${total} ${total === 1 ? 'game' : 'games'}`,
    on: onCount ? `${onCount} on your services` : null,
    pending: pendingCount
      ? `${pendingCount} market pending${pendingOutlets ? ` · ${pendingOutlets}` : ''} — map publishes ~Wed`
      : null,
    off: offCount ? `${offCount} not on your services${offOutlets ? ` · ${offOutlets}` : ''}` : null,
  };
}

/** '83 games - 20 not on your services - CBS Sports Network, FOX and 26 more'. Null when nothing is hidden. */
export function countLine(total, offCount, outlets, maxOutlets = 3) {
  if (!offCount) return null;
  const head = `${total} ${total === 1 ? 'game' : 'games'}`;
  const missed = `${offCount} not on your services`;
  const tail = outletClause(outlets, maxOutlets);
  return tail ? `${head} · ${missed} · ${tail}` : `${head} · ${missed}`;
}
