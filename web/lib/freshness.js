// THE ELIGIBILITY FRESHNESS RULE (prompt 125, queue item 16 closed; register §66 and §69).
//
// WHAT IT GUARDS. From 2026-09-05 until prompt 123, a change in who can watch a game reached
// `game_broadcasts` and never reached `viewer_game_eligibility`, the table the app reads. Nothing went
// red: Joe found it by watching "Market TBD" sit on decided NFL games all of Sunday 2026-09-27. The
// reconciler now re-judges every game whose broadcast rows moved, in the same run; this is the
// tripwire that would have caught the old failure, and would catch it coming back.
//
// THE RULE. For the next 7 ET viewing days' games, a game's eligibility row (viewer profile 1) may be
// no more than 26 hours older than the newest `last_seen_at` among its `game_broadcasts` rows. A game
// WITH broadcast rows and NO eligibility row fails too. A game with no broadcast rows is out of scope:
// there is nothing for its verdict to be stale against.
//
// WHY 26 HOURS. The refresh runs at least once a day (the Worker's 4 a.m. dispatch, the 11:37 UTC
// backstop) and re-judges every game it touches in the same run, so a healthy pipeline sits at or
// below zero lag. A day of slack means one missed run is not a red smoke; a day of failed reconciles,
// or a regression of register §66, is.
//
// PURE, AND WHY. The comparison lives here and not inline in smoke.mjs so it can be unit-tested with
// fixture rows (web/test/freshness.test.mjs). That test is what makes the guard provable without a
// database write (stop-list S2): the live data today is green, and a guard only ever seen green on
// live data has not been shown to catch anything.

export const FRESHNESS_HOURS = 26;
export const FRESHNESS_DAYS = 7;

const HOUR_MS = 3600 * 1000;

/**
 * The games in `games` whose eligibility is stale against their broadcasts.
 *
 * `games` - [{ id, ... }]; `broadcasts` - [{ game_id, last_seen_at }]; `eligibility` -
 * [{ game_id, computed_at }] for ONE viewer profile. Returns the failing games, each with `why`,
 * `lagHours` (null when there is no eligibility row) and the two timestamps.
 */
export function staleEligibility(games, broadcasts, eligibility, { hours = FRESHNESS_HOURS } = {}) {
  const newestSeen = new Map();
  for (const b of broadcasts || []) {
    const t = Date.parse(b?.last_seen_at ?? '');
    if (!Number.isFinite(t)) continue;
    if (!newestSeen.has(b.game_id) || t > newestSeen.get(b.game_id)) newestSeen.set(b.game_id, t);
  }
  const computedAt = new Map();
  for (const e of eligibility || []) computedAt.set(e.game_id, Date.parse(e?.computed_at ?? ''));

  const out = [];
  for (const g of games || []) {
    const seen = newestSeen.get(g.id);
    if (seen === undefined) continue;                       // no broadcast rows: out of scope
    const at = computedAt.get(g.id);
    if (at === undefined || !Number.isFinite(at)) {
      out.push({ ...g, why: 'broadcast rows but no eligibility row', lagHours: null,
                 lastSeenAt: new Date(seen).toISOString(), computedAt: null });
      continue;
    }
    if (at < seen - hours * HOUR_MS) {
      out.push({ ...g, why: `eligibility more than ${hours}h older than its broadcasts`,
                 lagHours: Math.round(((seen - at) / HOUR_MS) * 10) / 10,
                 lastSeenAt: new Date(seen).toISOString(), computedAt: new Date(at).toISOString() });
    }
  }
  return out;
}
