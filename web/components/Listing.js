'use client';

// Client shell for a page's games: the listings cards, the mobile grid, and the one detail panel they
// share. The pages themselves stay Server Components - they fetch, this renders and handles taps.
//
// M11's near-live refresh lives here too: while any game on the page is inside its window, the route
// is revalidated every REFRESH_SECONDS. A page with nothing in flight does not poll at all.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import MatchupCard from './MatchupCard.js';
import MobileGrid from './MobileGrid.js';
import GameDetail from './GameDetail.js';
import { indexStandings } from '../lib/standings.js';
import { REFRESH_SECONDS } from '../lib/config.js';

function anyInFlight(games) {
  const now = Date.now();
  return (games || []).some((g) => {
    if (g.result_status === 'in_progress') return true;
    if (g.result_status === 'final' || !g.canonical_kickoff_at_utc) return false;
    const t = new Date(g.canonical_kickoff_at_utc).getTime();
    return Number.isFinite(t) && now >= t - 15 * 60_000 && now <= t + 4 * 60 * 60_000;
  });
}

export default function Listing({ games, standingsRows, day, sport, generatedAt, showDay = false, grid = false }) {
  const [open, setOpen] = useState(null);
  const router = useRouter();
  const standings = useMemo(() => indexStandings(standingsRows), [standingsRows]);

  useEffect(() => {
    if (!anyInFlight(games)) return undefined;
    const id = setInterval(() => router.refresh(), REFRESH_SECONDS * 1000);
    return () => clearInterval(id);
  }, [games, router]);

  const showGrid = Boolean(grid && sport && games.length);
  const gridId = `grid-${sport || 'all'}-${day || ''}`;

  // LISTINGS FIRST, in every view and for every sport (Joe's ruling 2026-09-03). The grid is the
  // second thing on the page, not the first: a phone opens to what is on, and the grid is one tap
  // away through the jump chip rather than a screen of scrolling.
  return (
    <>
      {showGrid ? (
        <div className="jumpbar">
          <a className="chip jumpchip" href={`#${gridId}`}>
            Grid &darr;
          </a>
        </div>
      ) : null}

      <div className="cards">
        {games.map((g) => (
          <MatchupCard key={g.id} game={g} standings={standings} showDay={showDay} onOpen={setOpen} />
        ))}
      </div>

      {showGrid ? (
        <div id={gridId}>
          <MobileGrid games={games} sport={sport} day={day} standings={standings} onOpen={setOpen} />
        </div>
      ) : null}

      {open ? (
        <GameDetail game={open} standings={standings} generatedAt={generatedAt} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}
