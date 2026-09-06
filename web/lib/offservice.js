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
//
// AND A FOURTH (05 section 9, NETWORK TBD). E5 covers a game whose BROADCASTER is known and whose
// Cleveland assignment is not. It cannot cover a game with no broadcast row at all, and must not be
// stretched to: saying 'market pending' about an NFL week-18 game asserts a broadcaster exists whose
// regional split is undecided, when no broadcaster has been named. That is a second false certainty.
// So a game with zero active broadcast rows gets its own state, its own count and its own cue, and
// the same carve-out from D4 - the season load put 529 games in it, and the app was calling every
// one of them 'not on your services'.

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

/**
 * NETWORK TBD (05 section 9): nobody has announced who is airing this game yet.
 *
 * ONE LINE, ONE PLACE. The state is a structural fact about the game - it has no active broadcast
 * row - not a verdict to be read from a column, so unlike isMarketPending there is nothing in the
 * database to defer to. Every surface imports THIS; none re-derives it.
 *
 * Eligible wins, exactly as it does for market-pending: if there is a way to watch it, nothing is
 * TBD. In production that guard can never fire, because pipeline/reconcile.py derives `eligible`
 * FROM the active rows and so eligible implies at least one of them - but the two sibling states
 * must not behave differently under the same contradiction.
 */
export function isNetworkTbd(game) {
  if (isEligible(game)) return false;
  const rows = game?.broadcasts;
  // NOT SELECTED is not a claim. Every listing surface embeds broadcasts through GAME_SELECT in
  // web/lib/queries.js, but a surface that forgot would otherwise mark its whole day network-TBD -
  // the same reasoning that makes an unjudged game shown rather than hidden.
  if (!Array.isArray(rows)) return false;
  return !rows.some((b) => b?.active !== false);
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
  const tbd = [];
  const off = [];
  for (const g of rows) {
    // Order matters, and it carries both carve-outs: the two exempt states are tested BEFORE `off`,
    // so neither can fall into it and be counted as unwatchable. network-TBD goes first of all
    // because it is the structural fact - a stale row claiming market_pending on a game with no
    // broadcast rows would otherwise assert a broadcaster that does not exist. The two cannot both
    // be true anyway (pending needs an unverified row, TBD needs none), which a test pins.
    if (isNetworkTbd(g)) tbd.push(g);
    else if (isMarketPending(g)) pending.push(g);
    else if (isEligible(g)) on.push(g);
    else off.push(g);
  }

  return {
    on,
    pending,
    tbd,
    off,
    total: rows.length,
    onCount: on.length,
    pendingCount: pending.length,
    tbdCount: tbd.length,
    offCount: off.length,
    outlets: rankOutlets(off),
    pendingOutlets: rankOutlets(pending),
    line: countLine(rows.length, off.length, rankOutlets(off), maxOutlets),
    lines: countLines(rows.length, on.length, pending, off, tbd),
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
 * The count line's segments (05 section 10 shape):
 *
 *     6 airing · 48 TBD · 5 unavailable
 *
 * Null for a state with no games in it - a zero segment is noise, and "0 TBD" invites the reader
 * to wonder what they missed.
 *
 * THE TWO TBD STATES ARE SUMMED HERE AND NOWHERE ELSE. `pending` and `tbd` arrive as separate
 * arrays and stay separate everywhere that matters - the buckets in offServiceSummary, D4's
 * filter carve-outs, the row-wrapper classes in SportBand, and the two card badges. This is a
 * DISPLAY sum on one line, not a merge of the sets. Section 9's objection was to LABELLING a
 * network-TBD game "market pending", which asserts a broadcaster exists when none has been named;
 * a neutral "TBD" asserts neither, and the distinction it protects lives on the card, where
 * MARKET TBD and NETWORK TBD remain two words that cannot both appear.
 *
 * `total` is still returned - it is true and cheap - but it is NOT on the line any more. The Today
 * page prints it one scroll above in <p class="sub">, and the three segments sum to it.
 */
export function countLines(total, onCount, pending, off, tbd) {
  const pendingCount = (pending || []).length;
  const tbdCount = (tbd || []).length;
  const offCount = (off || []).length;
  const bothTbd = pendingCount + tbdCount;
  return {
    total: `${total} ${total === 1 ? 'game' : 'games'}`,
    airing: onCount ? `${onCount} airing` : null,
    tbd: bothTbd ? `${bothTbd} TBD` : null,
    unavailable: offCount ? `${offCount} unavailable` : null,
  };
}

/**
 * The whole count as ONE line (05 section 10):
 *   '6 airing · 48 TBD · 5 unavailable'
 * A segment with a count of zero is omitted, so a fully-available day reads '62 airing'.
 *
 * WHY THE TOTAL CAME OUT. Prompt 25 measured the previous four-segment line at 390px on a real
 * November Saturday: '56 games · 6 available to you · 45 network TBD · 5 not on your services'
 * rendered 404px against 366px of available width, wrapping to two lines and pushing the toggle
 * to a third. Dropping the total alone does not close it - a day carrying both TBD states reaches
 * an estimated 427px - so the wording shortened too.
 *
 * THE COST, NAMED AND ACCEPTED BY JOE. 'airing' is true of every game on the page; only some are
 * airing on services he has. 'unavailable' reads as "not on television" rather than "not on your
 * services". Both soften D4's deliberate access language, and this product's differentiator is
 * access, not broadcast. He ruled for brevity on a line that has to survive a 56-game Saturday at
 * 390px, with the trade-off on the record in 05 section 10.
 */
/**
 * The same three segments as countSummary, but as PARTS so the band can make one of them a
 * control. Joe: "eliminate the 'Show 11 unavailable' text with link and instead make the
 * 'X unavailable' text the link. We don't need to list the number of unavailable games twice."
 *
 * countSummary stays, returning the joined string. It has one app caller and a dozen test
 * assertions pinned to the joined form; breaking it to add a second shape would be churn for
 * nothing. Both read the same `lines` object, so they cannot disagree.
 */
export function countParts(lines) {
  return [
    { key: 'airing', text: lines.airing },
    { key: 'tbd', text: lines.tbd },
    { key: 'unavailable', text: lines.unavailable },
  ].filter((p) => p.text);
}

export function countSummary(lines) {
  // What he can watch, what nobody has settled yet, what he cannot watch.
  return [lines.airing, lines.tbd, lines.unavailable].filter(Boolean).join(' · ');
}

/** '83 games - 20 not on your services - CBS Sports Network, FOX and 26 more'. Null when nothing is hidden. */
export function countLine(total, offCount, outlets, maxOutlets = 3) {
  if (!offCount) return null;
  const head = `${total} ${total === 1 ? 'game' : 'games'}`;
  const missed = `${offCount} not on your services`;
  const tail = outletClause(outlets, maxOutlets);
  return tail ? `${head} · ${missed} · ${tail}` : `${head} · ${missed}`;
}

/**
 * WHAT THE PAGE HIDES, and what it must never hide (prompt 50 stage 4a).
 *
 * D4's filter-by-default, unchanged in substance and moved from the band to the page. A game on a
 * service Joe does not have is hidden; everything else is shown.
 *
 * THREE CARVE-OUTS, and none of them is negotiable:
 *
 *   NETWORK TBD    nobody has announced a broadcaster. Hiding a game because you cannot watch it,
 *                  when nobody has yet decided whether you can, is a false statement about 529 of
 *                  them (05 §9). Exempt by construction - a network-TBD game is never in `off`.
 *   MARKET PENDING the broadcaster is known and Cleveland's coverage is not confirmed (E5). Same
 *                  reasoning, same construction.
 *   FAVOURITES     a favourited team's game is never hidden. Without this it vanished from the page
 *                  entirely while the count still counted it - measured on 2026-09-12, Fresno State
 *                  appeared nowhere while the line said "1 unavailable".
 *
 * The first two are free: `offServiceSummary`'s if/else tests them BEFORE `off`, so neither can fall
 * into it. Only favourites need naming here.
 *
 * @returns {{visible: Array, hidden: Array, summary: object}}
 */
export function splitHidden(rows, favIds) {
  const summary = offServiceSummary(rows);
  const offIds = new Set(summary.off.map((g) => g.id));
  const isFav = (g) => Boolean(favIds && favIds.size && (
    favIds.has(String(g?.home_team_id ?? g?.home?.id ?? '')) ||
    favIds.has(String(g?.away_team_id ?? g?.away?.id ?? ''))));
  const visible = [];
  const hidden = [];
  for (const g of rows || []) {
    if (offIds.has(g.id) && !isFav(g)) hidden.push(g);
    else visible.push(g);
  }
  return { visible, hidden, summary };
}

/**
 * THE PAGE'S ONE COUNT LINE (prompt 50 stage 4b).
 *
 * `8 games on your services`, plus `· 3 TBD` when any are, and that is the whole line. It renders
 * ONCE, at the foot of the page, where the old per-band lines rendered once per band.
 *
 * THIS SUPERSEDES 05 §10's `6 airing · 48 TBD · 5 unavailable`, which prompt 26 shipped and which
 * Joe worded himself. Two of its three segments are gone by consequence rather than by preference:
 * `unavailable` became the reveal control, and `airing` became `on your services` - which is the
 * phrase D4 originally used and §10 shortened to fit a 390px band header. At page level there is
 * room for the accurate word again.
 *
 * THE `TBD` SEGMENT IS COWORK'S CALL AND IS FLAGGED FOR VETO. Joe's renderings show one segment.
 * Without a second, a day carrying 45 network-TBD games would render `6 games on your services`
 * above 51 rows, and the line would be undercounting what is on screen by a factor of eight. The
 * alternative is that TBD games are shown but uncounted. One line to remove if Joe prefers his.
 *
 * Zero-count segments stay omitted, so a day with nothing pending reads exactly as the rendering
 * shows it.
 */
export function pageCountLine(summary) {
  const on = summary?.onCount ?? 0;
  const tbd = (summary?.pendingCount ?? 0) + (summary?.tbdCount ?? 0);
  const head = `${on} ${on === 1 ? 'game' : 'games'} on your services`;
  return tbd ? `${head} · ${tbd} TBD` : head;
}

/** `Show 5 not on your services` - the reveal's label. Null when there is nothing to reveal. */
export function revealLabel(hiddenCount) {
  return hiddenCount ? `Show ${hiddenCount} not on your services` : null;
}
