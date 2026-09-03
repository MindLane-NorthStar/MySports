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
  const off = [];
  for (const g of rows) (isEligible(g) ? on : off).push(g);

  // Rank outlets by how many missed games they carry, so the line names the ones that actually cost
  // the viewer something rather than whichever RSN happened to sort first.
  const tally = new Map();
  for (const g of off) {
    for (const name of outletsFor(g)) tally.set(name, (tally.get(name) || 0) + 1);
  }
  const outlets = [...tally.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);

  return { on, off, total: rows.length, offCount: off.length, outlets, line: countLine(rows.length, off.length, outlets, maxOutlets) };
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

/** '83 games - 20 not on your services - CBS Sports Network, FOX and 26 more'. Null when nothing is hidden. */
export function countLine(total, offCount, outlets, maxOutlets = 3) {
  if (!offCount) return null;
  const head = `${total} ${total === 1 ? 'game' : 'games'}`;
  const missed = `${offCount} not on your services`;
  const named = [...new Set((outlets || []).map(shortOutlet).filter(Boolean))].slice(0, maxOutlets);
  if (named.length === 0) return `${head} · ${missed}`;
  const rest = [...new Set((outlets || []).map(shortOutlet).filter(Boolean))].length - named.length;
  // "and 26 more" rather than a 28-outlet wall: on an MLB night nearly every missed game is its own
  // out-of-market RSN, and listing them all would bury the number that matters.
  const tail = rest > 0 ? `${named.join(', ')} and ${rest} more` : named.join(', ');
  return `${head} · ${missed} · ${tail}`;
}
