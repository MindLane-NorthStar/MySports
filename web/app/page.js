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
import { longDay, todayET, etTime } from '../lib/format.js';
import { SPORT_LABEL, gridAssetUrl, resolveSportParam } from '../lib/config.js';
import { RestError } from '../lib/rest.js';
import { overlayForDay, applyOverlay } from '../lib/livescores.js';

export const dynamic = 'force-dynamic';

// The four sports added to the chip row in prompt 25 have nothing loaded yet, and the general
// empty state would answer them with a list of dates for OTHER sports - which reads as a bug
// rather than as a season that has not started. Each says why it is empty and when data arrives.
//
// NASCAR and IndyCar carry register section 13's own copy: each has an EXTERNAL GATE - a playoff
// start, a schedule publication - so each can name a date without inventing one.
//
// WWE and UFC run continuously, so there is no date to name that would not be invented. Cowork
// supplied their copy in prompt 26 stage 4, and rights facts were deliberately NOT used - "streams
// on Paramount+", "Raw is on Netflix" are verifiable today but go stale silently inside an empty
// state nobody re-reads, and production is a public URL. What is left that stays true is that the
// data is not loaded, plus the shape of what will arrive.
//
// FLAGGED FOR JOE'S VETO: "are coming" makes a soft promise with no date. The alternatives were a
// bare "no games" (section 13 rules it out), a date (invented), and a rights claim (rots).
//
// THE SPORT IS PRONOUNCED ONCE, in the shared prefix, and referred back to here. Every one of the
// four used to repeat it - "No games on this viewing day for UFC. UFC is not loaded yet." - and
// that includes IndyCar, whose possessive "IndyCar's" doubled it just as plainly as the rest.
const SPORT_EMPTY = {
  // §16: one chip over two sports, so one line carrying BOTH facts - they resolve on different
  // clocks, so neither can stand in for the other. nascar and indycar keep their own lines for a
  // hand-typed ?sport=nascar, which still resolves even though the chip is gone.
  racing: 'It is not loaded yet. NASCAR arrives with the playoffs, September 6; '
    + "IndyCar's 2026 season ends this month, with the 2027 schedule in October.",
  nascar: 'It arrives with the playoffs, September 6.',
  indycar: 'The 2026 season ends this month; the 2027 schedule publishes in October.',
  ufc: 'It is not loaded yet — the numbered events and Fight Nights are coming.',
  wwe: 'It is not loaded yet — Raw, SmackDown and the premium live events are coming.',
};

async function ArchivedGrid({ sport, day }) {
  // Only offered when exactly one sport is selected: a grid is per (sport, day) by construction.
  if (!sport) return null;
  const grid = await newestGridFor(sport, day);
  const src = gridAssetUrl(grid?.svg_asset_url);
  if (!src) {
    // E10-adjacent, one line: desktop says plainly that no PC grid was rendered for this pair rather
    // than falling back to a phone grid stretched across a desktop column.
    return (
      <p className="gridnone">
        No archived PC grid for {SPORT_LABEL[sport] || sport} on {longDay(day)} yet — it is rendered
        by the daily job once the slate is loaded.
      </p>
    );
  }
  return (
    <figure className="gridpanel">
      {/* The PC grid is drawn at 2862px for a 1398px-plus page (rendering contract v1.3). Fitting it
          into a ~950px column is a 3x downscale, which is what read as "a blank black area" - the
          card text vanishes and only the charcoal ground is left. It now renders at its own width
          inside a horizontal scroller, which is how a PC grid is meant to be read. */}
      <img src={src} alt={`${SPORT_LABEL[sport] || sport} archival grid for ${day}`} />
      <figcaption>
        Archived PC grid · {grid.generator_version || 'unknown'} · {grid.games_on_grid ?? '?'} on the grid
        {grid.games_tbd ? ` · ${grid.games_tbd} TBA` : ''}
        {grid.games_omitted ? ` · ${grid.games_omitted} not on your services` : ''}
      </figcaption>
    </figure>
  );
}

/**
 * E4 "data as of". One quiet line that says WHICH time it is showing.
 *
 * It must never imply live data when the overlay was skipped or failed, so the three cases read
 * differently on purpose: a past day says so, a live check that returned nothing says so, and only
 * an overlay that actually produced rows claims a live time. Silence would be worse than either -
 * a page that shows a score with no provenance invites the reader to assume it is current.
 */
function DataAsOf({ day, today, overlay }) {
  const live = overlay?.fetchedAt && overlay.sports?.length;
  const joined = Object.values(overlay?.stats || {}).reduce((n, s) => n + (s.joined || 0), 0);
  let tail;
  if (day !== today) {
    tail = 'no live check — this is not today';
  } else if (!overlay?.sports?.length) {
    tail = 'no live check needed — nothing on this day is still to be played';
  } else if (!live || joined === 0) {
    tail = 'the live check returned nothing, so scores are the database’s';
  } else {
    // etTime() already appends " ET" - do not add a second one.
    tail = `live scores checked ${etTime(overlay.fetchedAt)}, ${joined} game${joined === 1 ? '' : 's'} updated`;
  }
  return <p className="footnote asof">Schedule, networks and finals from the database · {tail}.</p>;
}

export default async function TodayPage({ searchParams }) {
  const params = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params?.day || '') ? params.day : todayET();
  const sport = resolveSportParam(params?.sport);

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

  // E1/E4: the live overlay, merged AFTER the database read so the database stays authoritative for
  // everything the overlay does not carry. overlayForDay never throws and never rejects - a provider
  // failure returns an empty overlay and these lines simply pass the database rows through.
  const today = todayET();
  const overlay = await overlayForDay(day, games, { today });
  games = applyOverlay(games, overlay.map);

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
          No games on this viewing day{sport ? ` for ${SPORT_LABEL[sport] || sport}` : ''}.{' '}
          {(sport && SPORT_EMPTY[sport]) ||
            'The database currently holds loaded days only — try 2026-09-03 or 2026-09-04 (MLB), ' +
              '2026-09-05 (CFB), 2026-09-13 (NFL), 2026-10-01 (NHL) or 2026-10-28 (NBA).'}
        </p>
      ) : null}

      <Listing games={games} standingsRows={standingsRows} day={day} sport={sport} grid bands />

      {!error && games.length ? <DataAsOf day={day} today={today} overlay={overlay} /> : null}

      {sport && !error && games.length ? (
        <Suspense fallback={null}>
          <ArchivedGrid sport={sport} day={day} />
        </Suspense>
      ) : null}
    </main>
  );
}
