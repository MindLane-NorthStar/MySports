// DEV-ONLY fixture page: a game on a channel nobody has ruled on is shown, with a CHANNEL ? cue
// (prompt 129 block G, Joe's ruling 1 of 2026-10-14; register §74).
//
// THE PATTERN IS app/qa/tbd/page.js's: the REAL Listing - bands and the mobile grid - with fixture rows
// put through the same chronological() and splitHidden() Today's day mode applies, so what qa-shots
// measures is what ships. All three cue states are here, one card each (./fixture.js), so the new cue
// is measured against the two it is built like. A 404 in production, by the first line of the component.

import { notFound } from 'next/navigation';
import Listing from '../../../components/Listing.js';
import { chronological, favoriteIds } from '../../../lib/favorites.js';
import { splitHidden } from '../../../lib/offservice.js';
import favoritesDoc from '../../../../data/favorites.json';
import { CHANNEL_DAY, CHANNEL_GAMES } from './fixture.js';

export const dynamic = 'force-dynamic';

export default function ChannelQaPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const favIds = favoriteIds(favoritesDoc);
  const { visible } = splitHidden(chronological(CHANNEL_GAMES, favIds), favIds);

  return (
    <main>
      <h1>Channel cue fixtures</h1>
      <p className="sub">Dev-only. CHANNEL ?, MARKET TBD and NETWORK TBD, one card each.</p>
      <Listing games={visible} standingsRows={[]} rankingsRows={[]} day={CHANNEL_DAY} sport="mlb"
               grid bands gridOnly={false} flatLabel={null} live={false}
               nowMinute={null} markFavorites />
    </main>
  );
}
