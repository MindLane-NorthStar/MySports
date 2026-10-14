// DEV-ONLY fixture page: a cancelled or postponed game leaves the grid and stays in the list
// (prompt 129, Joe's ruling 4 of 2026-10-14; register §74).
//
// THE PATTERN IS app/qa/tbd/page.js's, for the same reason: live rows do not stay. A real cancelled
// postseason game exists only between the night a series ends and the end of the postseason, and a
// postponement only on a rain-out, so a check on live rows would pass or fail on the weather. These
// rows are code. It renders the REAL Listing - bands AND the mobile grid, so the grid's set is built by
// the same gridSet() Today's grid uses - through the same chronological() and splitHidden() Today's day
// mode applies. A 404 in production, by the first line of the component.

import { notFound } from 'next/navigation';
import Listing from '../../../components/Listing.js';
import { chronological, favoriteIds } from '../../../lib/favorites.js';
import { splitHidden } from '../../../lib/offservice.js';
import favoritesDoc from '../../../../data/favorites.json';
import { OFFAIR_DAY, OFFAIR_GAMES } from './fixture.js';

export const dynamic = 'force-dynamic';

export default function OffAirQaPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const favIds = favoriteIds(favoritesDoc);
  const { visible } = splitHidden(chronological(OFFAIR_GAMES, favIds), favIds);

  return (
    <main>
      <h1>Off-air fixtures</h1>
      <p className="sub">Dev-only. A cancelled and a postponed game: in the list, not on the grid.</p>
      <Listing games={visible} standingsRows={[]} rankingsRows={[]} day={OFFAIR_DAY} sport="mlb"
               grid bands gridOnly={false} flatLabel={null} live={false}
               nowMinute={null} markFavorites />
    </main>
  );
}
