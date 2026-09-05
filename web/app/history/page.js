// HISTORY - games that have actually been played, newest first, with the final score.
//
// Each card is a whole-card link to games.boxscore_url, opened in a new tab. The raw URL is never
// displayed: pipeline/load.py computes it once, at the first load that sees result_status 'final',
// and the completed event card is the click target. A final game with no boxscore_url (possible for
// a sport with no template) simply renders as a non-link card rather than a dead one.

import Listing from '../../components/Listing.js';
import { SearchBox, SportFilter } from '../../components/Filters.js';
import { finalGames, finalPrograms, matchesSearch, standingsForGames, rankingsForGames } from '../../lib/queries.js';
import { toRows } from '../../lib/programs.js';
import { SPORT_LABEL, resolveSportParam } from '../../lib/config.js';
import { RestError } from '../../lib/rest.js';

export const dynamic = 'force-dynamic';

/** The search test for a program row: its title, its series and the networks carrying it. */
function matchesProgram(row, q) {
  const needle = String(q || '').trim().toLowerCase();
  if (!needle) return true;
  const hay = [
    row.title, row.subtitle, row.series, row.location_text, row.brand_key,
    ...(row.broadcasts || []).map((b) => b?.network?.canonical_name || b?.label || b?.service_id),
  ].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(needle);
}

export default async function HistoryPage({ searchParams }) {
  const params = await searchParams;
  const sport = resolveSportParam(params?.sport);
  const q = (params?.q || '').slice(0, 80);

  let games = [];
  let rows = [];
  let standingsRows = [];
  let rankingsRows = [];
  let error = null;
  try {
    // v1.7: History carries programs too - a race that has run is history exactly as a game that
    // has been played is. A game is "final" because a provider said so; a program is because the
    // clock says so, which is the honest test for something nobody reports a result for.
    const now = new Date();
    const [g, p] = await Promise.all([
      finalGames({ sport }), finalPrograms({ sport, before: now.toISOString() }),
    ]);
    games = g;
    // Newest first, across both kinds, on the one field both have.
    rows = [...g, ...toRows(p, now)].sort(
      (a, b) => String(b.canonical_kickoff_at_utc || '').localeCompare(String(a.canonical_kickoff_at_utc || ''))
    );
    // Asked about the GAMES only: a program has no club to look up.
    [standingsRows, rankingsRows] = await Promise.all([
      standingsForGames(games), rankingsForGames(games),
    ]);
  } catch (e) {
    error = e instanceof RestError ? `${e.status} — ${e.body}` : String(e);
  }

  // The locked card is a three-line card, so the page renders the newest PAGE_SIZE of the matches
  // rather than every completed game at once. The count line always states the full total.
  const PAGE_SIZE = 60;
  // matchesSearch() reads team names and network names off a GAME. A program has neither shape, so
  // it is matched on what it does have - its title, its brand and its own broadcast labels - rather
  // than being silently dropped from every search, which is what passing it to matchesSearch would
  // do (a row with no home/away matches nothing).
  const matched = rows.filter((r) => (r.program_id != null ? matchesProgram(r, q) : matchesSearch(r, q)));
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
          {rows.length} completed {rows.length === 1 ? 'entry' : 'entries'}
          {q ? ` matching “${q}”` : ''}
          {sport ? ` · ${SPORT_LABEL[sport] || sport}` : ''}
        </p>
      ) : null}

      {!error && matched.length === 0 ? (
        <p className="empty">
          {rows.length === 0
            ? 'No completed games in the database yet — scores arrive with the loader once a day has been played.'
            : 'Nothing matches that search.'}
        </p>
      ) : null}

      <Listing games={shown} standingsRows={standingsRows} rankingsRows={rankingsRows} showDay />
    </main>
  );
}
