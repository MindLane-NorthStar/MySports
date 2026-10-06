// JOE'S TEAMS' GAMES FOR THE WEEK, AS ONE READ-ONLY ADDRESS (prompt 127, Joe's ruling 2026-10-05).
//
// Another app of Joe's, MyDash, draws small score boxes for his own teams and reads them from here.
// It works out nothing for itself, so this answers with what MySports' own card shows, and every rule
// it applies is the card's: lib/mygames.js composes them, and this file holds none of its own.
//
// IT TAKES NO PARAMETER. /api/live refuses a client's list of games so that what it fetches is "a
// function of the DATABASE and the clock"; this one is a function of the database, the clock and
// data/favorites.json, and it reads no query string.
//
// IT IS OPEN TO ANYONE, like the rest of the app (no sign-in, deployment contract D4). It shows which
// teams Joe follows, which data/favorites.json in the public repo already publishes. No CORS header:
// MyDash reads it from its own server.

import { NextResponse } from 'next/server';
import { gamesForRange } from '../../../lib/queries.js';
import { overlayForDay } from '../../../lib/livescores.js';
import { viewingDayOf } from '../../../lib/programs.js';
import { addDays } from '../../../lib/weeks.js';
import { favoriteIds } from '../../../lib/favorites.js';
import { DAYS_AHEAD, overlayRows, myGamesAnswer } from '../../../lib/mygames.js';
import favoritesDoc from '../../../../data/favorites.json';

// `force-dynamic` because the answer depends on the clock and on live upstream state. The upstream
// fetch is still cached for 60s by livescores.js's own `next: { revalidate }`, so a reader asking once
// a minute shares that cache with the page.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request) {
  // The VIEWING day - the app's own 3 AM rule - not the page's calendar date (see DAYS_AHEAD).
  const today = viewingDayOf(new Date());
  const end = addDays(today, DAYS_AHEAD);
  const favIds = favoriteIds(favoritesDoc);
  const origin = new URL(request.url).origin;

  let rows;
  try {
    // ONE READ, the card's own select (GAME_SELECT), every sport. It reads the whole eight-day slate
    // to keep a handful of rows - chosen, for one query the card already trusts.
    rows = await gamesForRange(today, end);
  } catch (e) {
    // A database failure answers 200 with no games and the reason, as /api/live does; it never throws.
    return NextResponse.json(myGamesAnswer({ today, end, rows: [], favIds, origin, error: e }),
      { status: 200, headers: NO_STORE });
  }

  // overlayForDay never throws and never rejects (lib/livescores.js).
  const overlay = await overlayForDay(today, overlayRows(rows, favIds, today), { today });
  return NextResponse.json(myGamesAnswer({ today, end, rows, favIds, overlay, origin }),
    { status: 200, headers: NO_STORE });
}
