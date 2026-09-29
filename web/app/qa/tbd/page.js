// DEV-ONLY fixture page for the TBD badge (prompt 124, register §67).
//
// WHY IT EXISTS. qa-shots' TBD-badge check read LIVE postseason rows, and live placeholders do not
// stay. It moved twice in five days - seven sides to six on 2026-09-25 when the Braves clinched, and
// 2026-09-29 to 2026-10-03 on 2026-09-28 when every Wild Card side had resolved - and it would have
// gone red a third time when the Division Series sides resolve. A check that passes or fails on who
// is still playing is measuring the standings, not the badge. These rows are code, so the check can
// count them exactly.
//
// WHY IT IS NOT A SECOND IMPLEMENTATION. It renders the REAL Listing - and through it MatchupCard and
// TeamMark - with rows in the exact shape Today hands Listing (./fixture.js says whose output they
// copy), put through the same chronological() and splitHidden() Today's day mode applies
// (app/page.js:561-564). So what it proves is what ships. A hand-built mock of the badge would prove
// only that the mock was built to match, which is the second derivation working rule 22 exists to
// prevent. app/qa/programs/page.js is the same pattern for the program card.
//
// IT IS NOT REACHABLE IN PRODUCTION. `notFound()` on NODE_ENV=production, the component's first line,
// exactly as app/qa/programs/page.js:99 does it, so a Vercel build serves a 404 for this path and the
// fixture clubs never reach a reader.
//
// SMOKE STILL READS LIVE ROWS, ON PURPOSE (register §60). A new MLB placeholder form is meant to turn
// smoke red so someone rules on it. This page cannot see a new form and is not meant to.

import { notFound } from 'next/navigation';
import Listing from '../../../components/Listing.js';
import { chronological, favoriteIds } from '../../../lib/favorites.js';
import { splitHidden } from '../../../lib/offservice.js';
import favoritesDoc from '../../../../data/favorites.json';
import { TBD_DAY, TBD_GAMES } from './fixture.js';

export const dynamic = 'force-dynamic';

export default function TbdQaPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const favIds = favoriteIds(favoritesDoc);
  const { visible } = splitHidden(chronological(TBD_GAMES, favIds), favIds);

  return (
    <main>
      <h1>TBD badge fixtures</h1>
      <p className="sub">Dev-only. Every branch of the TBD badge, through the shipping components.</p>
      {/* The props Today passes for `/?day=…&sport=mlb` in LIST view (app/page.js:700-704). No
          standings or rankings: a fixture has no season to look records up in. */}
      <Listing games={visible} standingsRows={[]} rankingsRows={[]} day={TBD_DAY} sport="mlb"
               grid={false} bands gridOnly={false} flatLabel={null} live={false}
               nowMinute={null} markFavorites />
    </main>
  );
}
