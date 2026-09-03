'use client';

// Client shell for a page's games: the listings cards, the mobile grid, and the one detail panel they
// share. The pages themselves stay Server Components - they fetch, this renders and handles taps.
//
// M11's near-live refresh lives here too: while any game on the page is inside its window, the route
// is revalidated every REFRESH_SECONDS. A page with nothing in flight does not poll at all.

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import SportBand from './SportBand.js';
import MobileGrid from './MobileGrid.js';
import GameDetail from './GameDetail.js';
import { indexStandings } from '../lib/standings.js';
import { REFRESH_SECONDS, SPORTS, SPORT_LABEL } from '../lib/config.js';
import { offServiceSummary } from '../lib/offservice.js';

function anyInFlight(games) {
  const now = Date.now();
  return (games || []).some((g) => {
    if (g.result_status === 'in_progress') return true;
    if (g.result_status === 'final' || !g.canonical_kickoff_at_utc) return false;
    const t = new Date(g.canonical_kickoff_at_utc).getTime();
    return Number.isFinite(t) && now >= t - 15 * 60_000 && now <= t + 4 * 60 * 60_000;
  });
}

export default function Listing({ games, standingsRows, day, sport, generatedAt, showDay = false, grid = false, bands = false }) {
  const [open, setOpen] = useState(null);
  const router = useRouter();
  const standings = useMemo(() => indexStandings(standingsRows), [standingsRows]);

  useEffect(() => {
    if (!anyInFlight(games)) return undefined;
    const id = setInterval(() => router.refresh(), REFRESH_SECONDS * 1000);
    return () => clearInterval(id);
  }, [games, router]);

  // Bands render in SPORTS order (cfb, nfl, nba, nhl, mlb), not in kickoff order - the order is the
  // product's, so a quiet sport does not jump the page because it happened to start first. Only
  // sports with games that day appear.
  const grouped = useMemo(() => {
    if (!bands) return null;
    const by = new Map();
    for (const g of games || []) {
      if (!by.has(g.sport)) by.set(g.sport, []);
      by.get(g.sport).push(g);
    }
    const known = SPORTS.filter((s) => by.has(s));
    const extra = [...by.keys()].filter((s) => !SPORTS.includes(s)).sort();
    return [...known, ...extra].map((s) => [s, by.get(s)]);
  }, [bands, games]);

  // The grid stays bound to a SINGLE selected sport, exactly as before - bands do not each get one.
  const showGrid = Boolean(grid && sport && games.length);
  const gridId = `grid-${sport || 'all'}-${day || ''}`;

  // The mobile grid follows what the bands actually show: everything except genuinely ineligible
  // games. Computed here because the grid spans bands.
  const gridGames = useMemo(() => {
    const off = new Set(offServiceSummary(games).off.map((g) => g.id));
    return (games || []).filter((g) => !off.has(g.id));
  }, [games]);

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

      {bands ? (
        grouped.map(([s, rows]) => (
          <SportBand key={s} sport={s} label={SPORT_LABEL[s] || s} games={rows}
                     standings={standings} showDay={showDay} onOpen={setOpen} />
        ))
      ) : (
        // /weeks and /history keep their flat structure - the same component, header off, so the
        // count line, the toggle, the favourites float and the row wrappers have one implementation.
        <SportBand sport={sport} label={null} games={games} standings={standings}
                   showDay={showDay} onOpen={setOpen} showHeader={false} />
      )}

      {showGrid ? (
        <div id={gridId}>
          <MobileGrid games={gridGames} sport={sport} day={day} standings={standings} onOpen={setOpen} />
        </div>
      ) : null}

      {open ? (
        <GameDetail game={open} standings={standings} generatedAt={generatedAt} onClose={() => setOpen(null)} />
      ) : null}
    </>
  );
}
