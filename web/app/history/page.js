// HISTORY - games that have actually been played, newest first, with the final score.
//
// Each card is a whole-card link to games.boxscore_url, opened in a new tab. The raw URL is never
// displayed: pipeline/load.py computes it once, at the first load that sees result_status 'final',
// and the completed event card is the click target. A final game with no boxscore_url (possible for
// a sport with no template) simply renders as a non-link card rather than a dead one.

import Listing from '../../components/Listing.js';
import { SearchBox, SportFilter } from '../../components/Filters.js';
import { finalGames, matchesSearch, standingsForGames, rankingsForGames } from '../../lib/queries.js';
import { SPORT_LABEL, resolveSportParam } from '../../lib/config.js';
import { RestError } from '../../lib/rest.js';

export const dynamic = 'force-dynamic';

export default async function HistoryPage({ searchParams }) {
  const params = await searchParams;
  const sport = resolveSportParam(params?.sport);
  const q = (params?.q || '').slice(0, 80);

  let games = [];
  let standingsRows = [];
  let rankingsRows = [];
  let error = null;
  try {
    games = await finalGames({ sport });
    [standingsRows, rankingsRows] = await Promise.all([
      standingsForGames(games), rankingsForGames(games),
    ]);
  } catch (e) {
    error = e instanceof RestError ? `${e.status} — ${e.body}` : String(e);
  }

  // The locked card is a three-line card, so the page renders the newest PAGE_SIZE of the matches
  // rather than every completed game at once. The count line always states the full total.
  const PAGE_SIZE = 60;
  const matched = games.filter((g) => matchesSearch(g, q));
  const shown = matched.slice(0, PAGE_SIZE);

  return (
    <main>
      <h1>History</h1>
      <p className="sub">
        Completed games, newest first. Tapping a card opens its detail panel, and a final game's box
        score is a link inside it.
      </p>

      <div className="controls">
        <SearchBox q={q} placeholder="Team or network…" />
        <SportFilter sport={sport} />
      </div>

      {error ? <p className="error">Could not read the database: {error}</p> : null}

      {!error ? (
        <p className="sub">
          {shown.length === matched.length ? shown.length : `${shown.length} of ${matched.length}`} of{' '}
          {games.length} completed {games.length === 1 ? 'game' : 'games'}
          {q ? ` matching “${q}”` : ''}
          {sport ? ` · ${SPORT_LABEL[sport] || sport}` : ''}
        </p>
      ) : null}

      {!error && matched.length === 0 ? (
        <p className="empty">
          {games.length === 0
            ? 'No completed games in the database yet — scores arrive with the loader once a day has been played.'
            : 'Nothing matches that search.'}
        </p>
      ) : null}

      <Listing games={shown} standingsRows={standingsRows} rankingsRows={rankingsRows} showDay />
    </main>
  );
}
