// THE LIVE OVERLAY, ON ITS OWN (prompt 77 stage 1, Joe's ruling 2026-09-09).
//
// WHAT THIS REPLACES, and why the old shape was the wrong one. `Listing.js` polled with
// `router.refresh()`, which re-renders the WHOLE page on the server - every query, the standings,
// the rankings, the programs, the header, the banner - to update three fields on a handful of cards.
// This route is those three fields and nothing else.
//
// THE STALENESS WAS ENTIRELY THE CLIENT'S. `lib/livescores.js` caches the upstream fetch for 60
// seconds, so the server's answer is never more than a minute old; the phone was waiting fifteen
// (`REFRESH_SECONDS = 900`). The interval moved to 60s to match that cache exactly - every fetch
// returns genuinely new data and none is wasted. DO NOT SHORTEN IT without shortening
// `REVALIDATE_SECONDS` too, which means more calls out to ESPN, the NHL and MLB - and livescores.js
// records one of those sources 403ing an honest bot on 2026-09-03.
//
// ---------------------------------------------------------------------------------------------
// THE CLIENT SENDS A DAY, NOT A LIST OF GAMES, and that is a deliberate refusal.
//
// Taking ids from the client would let a caller drive the fan-out: the sports fetched would be
// whatever it claimed were on screen. The server re-reads the day itself - a slim three-column
// query, not the page's read with its eight embeds - and `sportsWorthFetching` decides from that.
// So the set of upstream calls is a function of the DATABASE and the clock, exactly as it is on a
// full page render, and this route cannot be made to fetch anything the page would not.
//
// It also cannot fetch for a day that is not today: `sportsWorthFetching` returns [] unless
// `day === today` (livescores.js:202), and `overlayForDay` returns the empty overlay without a
// single upstream call when that list is empty. A week not containing today therefore costs one
// small database read and nothing else - which is the whole reason week mode can have an overlay
// now (see the reversal of prompt 53 stage 4b in app/page.js).

import { NextResponse } from 'next/server';
import { restAll } from '../../../lib/rest.js';
import { overlayForDay } from '../../../lib/livescores.js';
import { todayET } from '../../../lib/format.js';

// `force-dynamic` because the answer depends on the clock and on live upstream state. The UPSTREAM
// fetch is still cached for 60s by livescores.js's own `next: { revalidate }`, so two readers a few
// seconds apart share one call out - this only stops Next caching the ROUTE.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** A viewing day, and nothing else. Rejected rather than coerced - a bad day is a bug, not a guess. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request) {
  const day = new URL(request.url).searchParams.get('day');
  if (!day || !DAY.test(day)) {
    return NextResponse.json({ error: 'day must be YYYY-MM-DD' }, { status: 400 });
  }

  const today = todayET();
  // THE CHEAPEST QUESTION THAT ANSWERS IT. `sportsWorthFetching` reads exactly `sport` and
  // `result_status` off each row, and `overlayForDay` needs `id` to join against - so those three
  // columns are the whole requirement. The page's own read pulls eight embedded resources; asking
  // for those here would put most of a page render back into a poll that exists to avoid one.
  //
  // `restAll` rather than `rest`: a busy Saturday is well over PostgREST's silent 1000-row cap for a
  // single day once every sport is in season, and rule 19 says never issue an unbounded select.
  let slim = [];
  try {
    slim = await restAll(
      `games?select=id,sport,result_status&viewing_day=eq.${encodeURIComponent(day)}`,
    );
  } catch (e) {
    // A database failure must not take the poll down - the cards keep the scores they already have.
    return NextResponse.json(
      { day, fetchedAt: null, sports: [], stats: {}, rows: [], error: String(e?.message ?? e).slice(0, 200) },
      { status: 200 },
    );
  }

  const overlay = await overlayForDay(day, slim, { today });
  // The MAP is a Map and does not survive JSON. Sent as an array of the rows the client patches with,
  // which is the same shape `applyOverlay` consumes once it is rebuilt into a Map there.
  return NextResponse.json({
    day,
    today,
    fetchedAt: overlay.fetchedAt,
    sports: overlay.sports,
    stats: overlay.stats,
    rows: [...overlay.map.values()],
  });
}
