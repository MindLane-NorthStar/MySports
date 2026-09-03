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
import { offServiceSummary } from '../lib/offservice.js';
import { favoriteIds, splitFavorites } from '../lib/favorites.js';
import favoritesDoc from '../../data/favorites.json';

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

  // D4/E3. Off-service games are hidden by DEFAULT but never silently: the count line always states
  // the totals and names where the missed games went, and the toggle reveals them dimmed. Applying
  // this in Listing rather than per page covers Today, /weeks and /history with one implementation.
  const [showAll, setShowAll] = useState(false);
  const offService = useMemo(() => offServiceSummary(games), [games]);
  // Revealing keeps CHRONOLOGICAL order by rendering the original array, not on-then-off. Concatenating
  // the two groups would shunt every off-service game to the bottom and stop the day reading as a
  // timeline, which is the one thing a listing has to keep doing.
  const shown = showAll ? games : offService.on;
  const offIds = useMemo(() => new Set(offService.off.map((g) => g.id)), [offService]);

  // D6: Joe's teams float to the top of the listing. Both groups keep the order they arrived in, so
  // each still reads chronologically - a promotion, not a re-sort.
  const favIds = useMemo(() => favoriteIds(favoritesDoc), []);
  const { favorites, rest } = useMemo(() => splitFavorites(shown, favIds), [shown, favIds]);

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

      {offService.line ? (
        <p className="offsvc">
          <span>{offService.line}</span>
          <button type="button" className="offsvc-toggle" onClick={() => setShowAll((v) => !v)}
                  aria-expanded={showAll}>
            {showAll ? 'Hide them' : 'Show all'}
          </button>
        </p>
      ) : null}

      {favorites.length ? (
        <>
          {/* The label and its rule live HERE, at band level - never on the card. The listings card
              is closed (contract v1.6.4 + Mobile Grid Addendum v1.0). */}
          <p className="favlabel">Your teams</p>
          <div className="cards">
            {favorites.map((g) => (
              <div key={g.id} className={offIds.has(g.id) ? 'offsvc-row' : undefined}>
                <MatchupCard game={g} standings={standings} showDay={showDay} onOpen={setOpen} />
              </div>
            ))}
          </div>
          <hr className="favrule" />
        </>
      ) : null}

      <div className="cards">
        {rest.map((g) => (
          // The dim lives on a WRAPPER, never on the card: the listings card is locked by contract
          // v1.6.4 and the Mobile Grid Addendum, and an off-service game is still that same card.
          <div key={g.id} className={offIds.has(g.id) ? 'offsvc-row' : undefined}>
            <MatchupCard game={g} standings={standings} showDay={showDay} onOpen={setOpen} />
          </div>
        ))}
      </div>

      {showGrid ? (
        <div id={gridId}>
          <MobileGrid games={shown} sport={sport} day={day} standings={standings} onOpen={setOpen} />
        </div>
      ) : null}

      {open ? (
        <GameDetail game={open} standings={standings} generatedAt={generatedAt} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}
