// `/history` is retired as a route. It redirects into the Schedule Hub at today, in day mode.
//
// HISTORY IS RETIRED AS NAVIGATION, NOT AS FUNCTIONALITY (R1). Everything the page rendered is still
// rendered: a past `day` shows that day's completed games, with their scores and their box-score
// links, through the same card reading the same rows. Nothing about finals changed - only the route
// that reached them.
//
// ONE THING DID NOT SURVIVE, and it is named here rather than silently dropped: the cross-date `?q=`
// text search over every completed game. Joe's ruling R8 retires it from the hub's controls and
// HOLDS it as a future MY TEAMS sub-feature - a lookup inside the favourites scope rather than a
// search of the whole database. It is recorded in docs/enhancement-register.md section 17. So `?q=`
// is deliberately NOT forwarded: there is nothing on the other side to receive it, and carrying a
// parameter that silently does nothing is worse than dropping one visibly.
//
// `?sport=` IS carried, because the hub has the same filter and it still means the same thing.
//
// It lands on TODAY rather than on the most recent day with finals: "today" is a fact this route can
// state without a database read, where "the last day that had games" is a query, and a redirect that
// reads the database to decide where to send you is a page, not a redirect.

import { redirect } from 'next/navigation';
import { hubHref } from '../../lib/hubparams.js';

export const dynamic = 'force-dynamic';

export default async function HistoryRedirect({ searchParams }) {
  const p = (await searchParams) || {};
  redirect(hubHref({
    mode: 'day',
    sport: typeof p.sport === 'string' ? p.sport : null,
  }));
}
