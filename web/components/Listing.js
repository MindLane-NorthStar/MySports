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

export default function Listing({ games, standingsRows, day, sport, generatedAt, showDay = false, grid = false, bands = false }) {
  const [open, setOpen] = useState(null);
  const router = useRouter();
  const standings = useMemo(() => indexStandings(standingsRows), [standingsRows]);

  useEffect(() => {
    if (!anyInFlight(games)) return undefined;
    const id = setInterval(() => router.refresh(), REFRESH_SECONDS * 1000);
    return () => clearInterval(id);
  }, [games, router]);

  // 05 section 11: on the Today page the favourites are lifted OUT of their sport bands into one
  // page-level section, across every sport, chronological among themselves. splitFavorites keeps
  // input order, and `games` arrives ordered by kickoff, so that is chronological for free.
  //
  // The two sets are DISJOINT, which is what makes the counting work: each section is handed only
  // the games it shows, so its own count line describes the rows beneath it and a favourite is
  // counted once, in YOUR TEAMS, and not again in its sport's band.
  const favIds = useMemo(() => favoriteIds(favoritesDoc), []);
  const { favorites, rest } = useMemo(
    () => (bands ? splitFavorites(games || [], favIds) : { favorites: [], rest: games || [] }),
    [bands, games, favIds],
  );

  // Bands render in SPORTS order (cfb, nfl, nba, nhl, mlb), not in kickoff order - the order is the
  // product's, so a quiet sport does not jump the page because it happened to start first. Only
  // sports with games that day appear - and since the bands are built from `rest`, a sport whose
  // only games were favourites now has no band at all rather than a header over nothing.
  const grouped = useMemo(() => {
    if (!bands) return null;
    const by = new Map();
    for (const g of rest) {
      if (!by.has(g.sport)) by.set(g.sport, []);
      by.get(g.sport).push(g);
    }
    const known = SPORTS.filter((s) => by.has(s));
    const extra = [...by.keys()].filter((s) => !SPORTS.includes(s)).sort();
    return [...known, ...extra].map((s) => [s, by.get(s)]);
  }, [bands, rest]);

  // The grid stays bound to a SINGLE selected sport, exactly as before - bands do not each get one.
  const showGrid = Boolean(grid && sport && games.length);

  // The mobile grid follows what the bands actually show: everything except genuinely ineligible
  // games. Computed here because the grid spans bands - and it is deliberately built from the WHOLE
  // day, not from `rest`, so hoisting favourites into their own section does not remove them from
  // the grid. The grid shows what it showed.
  const gridGames = useMemo(() => {
    const off = new Set(offServiceSummary(games).off.map((g) => g.id));
    return (games || []).filter((g) => !off.has(g.id));
  }, [games]);

  // 05 section 11: DOM order is YOUR TEAMS -> bands -> grid. At <=699px CSS `order` lifts the grid
  // between the section and the bands, so the phone reads YOUR TEAMS -> grid -> bands. `order`
  // needs a flex parent, which is what .listing is; a column flex container lays block children out
  // the way a block does, and .band carries a BOTTOM margin only, so there is nothing for flex's
  // lack of margin collapsing to change. Measured before and after at both widths to be sure.
  //
  // The jump chip is gone with the same ruling: with the grid second on a phone it had nothing left
  // to jump past.
  return (
    <div className="listing">
      {bands ? (
        <>
          {favorites.length ? (
            <SportBand sport={null} label="Your teams" sectionLabel="Your teams" games={favorites}
                       standings={standings} showDay={showDay} onOpen={setOpen}
                       showHeader={false} floatFavorites={false} />
          ) : null}
          {grouped.map(([s, rows]) => (
            <SportBand key={s} sport={s} label={SPORT_LABEL[s] || s} games={rows}
                       standings={standings} showDay={showDay} onOpen={setOpen}
                       floatFavorites={false} />
          ))}
        </>
      ) : (
        // /weeks and /history keep their flat structure - the same component, header off, so the
        // count line, the toggle, the favourites float and the row wrappers have one implementation.
        <SportBand sport={sport} label={null} games={games} standings={standings}
                   showDay={showDay} onOpen={setOpen} showHeader={false} />
      )}

      {/* THE MOBILE GRID IS MOBILE-ONLY. It used to render at every width, so a desktop MLB day whose
          archived PC grid had not been rendered showed a phone grid stretched across a 1060px column,
          and a desktop CFB day showed BOTH. The Mobile Grid Addendum is explicit that its deviations
          are phone-only - M5's shorthand hour axis says "PC keeps v1.2 labels" - so above the
          breakpoint the desktop grid is the archived PC render and nothing else. CSS-gated at the
          same 699px the rest of the app uses, so no JS width state and no hydration mismatch. */}
      {showGrid ? (
        <div className="mgrid-only">
          <MobileGrid games={gridGames} sport={sport} day={day} standings={standings} onOpen={setOpen} />
        </div>
      ) : null}

      {/* position: fixed, so it takes no part in the flex ordering above. */}
      {open ? (
        <GameDetail game={open} standings={standings} generatedAt={generatedAt} onClose={() => setOpen(null)} />
      ) : null}
    </div>
  );
}
