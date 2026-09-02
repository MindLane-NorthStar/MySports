// TODAY - one viewing day, filtered by sport, with the day's archived grid above the listing when
// generated_grids has one for that (sport, day).
//
// viewing_day, not game_date: the pipeline buckets by the 03:00 ET cutover, so a game that tips at
// 10:40pm ET and ends after midnight still belongs to the night you sat down to watch it.
//
// v0.2: the listing is the locked matchup card, and selecting a single sport also renders the mobile
// grid built from this day's feed (docs/rendering-contract-mobile.md). The archived SVG stays on the
// page as the PC/archival artefact - the two are different renderings of the same day on purpose.

import { Suspense } from 'react';
import Listing from '../components/Listing.js';
import { DatePicker, SportFilter } from '../components/Filters.js';
import { gamesForDay, newestGridFor, gridIndex, standingsForGames } from '../lib/queries.js';
import { longDay, todayET } from '../lib/format.js';
import { SPORTS, SPORT_LABEL } from '../lib/config.js';
import { RestError } from '../lib/rest.js';

export const dynamic = 'force-dynamic';

async function ArchivedGrid({ sport, day }) {
  // Only offered when exactly one sport is selected: a grid is per (sport, day) by construction.
  if (!sport) return null;
  const grid = await newestGridFor(sport, day);
  if (!grid?.svg_asset_url) return null;
  return (
    <figure className="gridpanel">
      <img src={grid.svg_asset_url} alt={`${SPORT_LABEL[sport] || sport} archival grid for ${day}`} />
      <figcaption>
        Archived PC grid · {grid.generator_version || 'unknown'} · {grid.games_on_grid ?? '?'} on the grid
        {grid.games_tbd ? ` · ${grid.games_tbd} TBA` : ''}
        {grid.games_omitted ? ` · ${grid.games_omitted} not on your services` : ''}
      </figcaption>
    </figure>
  );
}

export default async function TodayPage({ searchParams }) {
  const params = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params?.day || '') ? params.day : todayET();
  const sport = SPORTS.includes(params?.sport) ? params.sport : null;

  let games = [];
  let grids = [];
  let standingsRows = [];
  let error = null;
  try {
    [games, grids] = await Promise.all([gamesForDay(day, sport), gridIndex()]);
    standingsRows = await standingsForGames(games);
  } catch (e) {
    error = e instanceof RestError ? `${e.status} — ${e.body}` : String(e);
  }

  const hasGrid = grids.some((g) => g.sport === sport && g.game_date === day);

  return (
    <main>
      <h1>{longDay(day)}</h1>
      <p className="sub">
        {games.length} {games.length === 1 ? 'game' : 'games'} on this viewing day
        {sport ? ` · ${SPORT_LABEL[sport] || sport}` : ' · all sports'}
      </p>

      <div className="controls">
        <DatePicker day={day} />
        <SportFilter sport={sport} />
      </div>

      {error ? <p className="error">Could not read the database: {error}</p> : null}

      {!error && games.length === 0 ? (
        <p className="empty">
          No games on this viewing day{sport ? ` for ${SPORT_LABEL[sport] || sport}` : ''}. The database
          currently holds loaded days only — try 2026-09-03 or 2026-09-04 (MLB), 2026-09-05 (CFB),
          2026-09-13 (NFL), 2026-10-01 (NHL) or 2026-10-28 (NBA).
        </p>
      ) : null}

      <Listing games={games} standingsRows={standingsRows} day={day} sport={sport} grid />

      {hasGrid ? (
        <Suspense fallback={null}>
          <ArchivedGrid sport={sport} day={day} />
        </Suspense>
      ) : null}
    </main>
  );
}
