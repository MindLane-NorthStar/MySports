// `/weeks` is retired as a route. It redirects into the Schedule Hub's week mode.
//
// ROUTE-LEVEL `redirect()`, NOT `next.config.mjs` `redirects()`, and the audit's section B2 gives
// the reasoning: this is not a rename. `/weeks` carried MEANING that has to be TRANSLATED into the
// new parameter model - the route itself was the mode - and a config redirect can only pattern-match
// and forward, one hand-written `has` clause per parameter shape. Here the translation is code, it
// lives under `app/` where nav.test.mjs can read it the same way it reads every other route fact,
// and it costs one server render that returns a 307.
//
// `?w=` and `?sport=` are CARRIED FORWARD, because a shared or bookmarked week link must keep
// working - that is the whole point of the URL-only state model. A stale `?w=` from another sport
// still falls back to that sport's current week, exactly as it did here, because the fallback lives
// in `weekChoices` and moved with it.

import { redirect } from 'next/navigation';
import { hubHref } from '../../lib/hubparams.js';

export const dynamic = 'force-dynamic';

export default async function WeeksRedirect({ searchParams }) {
  const p = (await searchParams) || {};
  redirect(hubHref({
    mode: 'week',
    w: typeof p.w === 'string' ? p.w : null,
    sport: typeof p.sport === 'string' ? p.sport : null,
  }));
}
