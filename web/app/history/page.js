// HISTORY - games that have actually been played, newest first, with the final score.
//
// Each card is a whole-card link to games.boxscore_url, opened in a new tab. The raw URL is never
// displayed: pipeline/load.py computes it once, at the first load that sees result_status 'final',
// and the completed event card is the click target. A final game with no boxscore_url (possible for
// a sport with no template) simply renders as a non-link card rather than a dead one.

import GameCard from '../../components/GameCard.js';
import { SearchBox, SportFilter } from '../../components/Filters.js';
import { finalGames, matchesSearch } from '../../lib/queries.js';
import { SPORTS, SPORT_LABEL } from '../../lib/config.js';
import { RestError } from '../../lib/rest.js';

export const dynamic = 'force-dynamic';

export default async function HistoryPage({ searchParams }) {
  const params = await searchParams;
  const sport = SPORTS.includes(params?.sport) ? params.sport : null;
  const q = (params?.q || '').slice(0, 80);

  let games = [];
  let error = null;
  try {
    games = await finalGames({ sport });
  } catch (e) {
    error = e instanceof RestError ? `${e.status} — ${e.body}` : String(e);
  }

  const shown = games.filter((g) => matchesSearch(g, q));

  return (
    <main>
      <h1>History</h1>
      <p className="sub">
        Completed games, newest first. Every card opens its box score in a new tab.
      </p>

      <div className="controls">
        <SearchBox q={q} placeholder="Team or network…" />
        <SportFilter sport={sport} />
      </div>

      {error ? <p className="error">Could not read the database: {error}</p> : null}

      {!error ? (
        <p className="sub">
          {shown.length} of {games.length} completed {games.length === 1 ? 'game' : 'games'}
          {q ? ` matching “${q}”` : ''}
          {sport ? ` · ${SPORT_LABEL[sport] || sport}` : ''}
        </p>
      ) : null}

      {!error && shown.length === 0 ? (
        <p className="empty">
          {games.length === 0
            ? 'No completed games in the database yet — scores arrive with the loader once a day has been played.'
            : 'Nothing matches that search.'}
        </p>
      ) : null}

      <div className="cards">
        {shown.map((g) => (
          <GameCard key={g.id} game={g} href={g.boxscore_url || undefined} showDay />
        ))}
      </div>
    </main>
  );
}
