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
import { DatePicker, SeriesFilter, SportFilter } from '../components/Filters.js';
import { gamesForDay, programsForDay, newestGridFor, gridIndex, standingsForGames, rankingsForGames } from '../lib/queries.js';
import { toRows } from '../lib/programs.js';
import { viewingMinutes } from '../lib/gridmodel.js';
import { longDay, todayET, etTime } from '../lib/format.js';
import FirstBand from '../components/FirstBand.js';
import { bandState } from '../lib/bandstate.js';
import policies from '../lib/policies.js';
import { SPORT_LABEL, gridAssetUrl, resolveSeriesParam, resolveSportParam } from '../lib/config.js';
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
    // etTime() no longer appends " ET" (prompt 31) - the footnote in layout.js carries it once.
    tail = `live scores checked ${etTime(overlay.fetchedAt)}, ${joined} game${joined === 1 ? '' : 's'} updated`;
  }
  return <p className="footnote asof">Schedule, networks and finals from the database · {tail}.</p>;
}

export default async function TodayPage({ searchParams }) {
  const params = await searchParams;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params?.day || '') ? params.day : todayET();
  const sport = resolveSportParam(params?.sport);
  const series = resolveSeriesParam(params?.series);
  // PROTOTYPE GATE (branch audit/sticky-grid). `?view=grid` and nothing else. Every other URL on
  // this page renders exactly what main renders, which is the whole point of gating it: the
  // prototype has to be measurable beside the thing it is trying to replace, not instead of it.
  const gridView = params?.view === 'grid';

  let games = [];
  let programs = [];
  let grids = [];
  let standingsRows = [];
  let rankingsRows = [];
  let error = null;
  try {
    // v1.7: programs are a SECOND read, not a join. They live in `programs` and have no `games` row
    // at all, so one query cannot return both - and keeping them separate means a programs failure
    // can never take the game slate down with it.
    [games, programs, grids] = await Promise.all([
      gamesForDay(day, sport), programsForDay(day, sport, series), gridIndex(),
    ]);
    // One round trip each, in parallel. rankingsForGames returns [] with no CFB game on the page,
    // and an empty id list short-circuits before any request is made.
    [standingsRows, rankingsRows] = await Promise.all([
      standingsForGames(games), rankingsForGames(games),
    ]);
  } catch (e) {
    error = e instanceof RestError ? `${e.status} — ${e.body}` : String(e);
  }

  // E1/E4: the live overlay, merged AFTER the database read so the database stays authoritative for
  // everything the overlay does not carry. overlayForDay never throws and never rejects - a provider
  // failure returns an empty overlay and these lines simply pass the database rows through.
  const today = todayET();
  const overlay = await overlayForDay(day, games, { today });
  games = applyOverlay(games, overlay.map);

  // THE REQUEST TIME, used twice and read once. bandState() already takes it as an argument; the
  // grid's now marker takes the same instant as a minute-of-viewing-day. Both are computed HERE, on
  // the server, so neither reaches the client as a clock - which is what keeps a time-aware line out
  // of the hydration path entirely (the trap prompt 42 fell into twice).
  const now = new Date();
  // v1.7: a program is normalised into the row shape every shared module already reads, so
  // offservice.js, bandstate.js and the count lines need no branch. `result_status` is derived from
  // `now` here for the same reason - a program has no observed result to read.
  const programRows = toRows(programs, now);
  const rows = [...games, ...programRows];
  // The marker is drawn on TODAY only. An archived day is immutable and a past day has no "now".
  const nowMinute = day === today ? viewingMinutes(now.toISOString()) : null;

  // D1. Computed ONCE, here, from the request time - the page is force-dynamic, so this is the
  // clock the reader is actually looking at. It reaches the band as data; nothing recomputes it on
  // the client, which is what keeps a time-aware block out of the hydration path entirely.
  // D1's first band takes the SAME rows the page shows, programs included - Cowork's call, flagged
  // in the register: a race that airs today belongs in Tonight beside the games it competes with.
  const band = bandState(rows, now, policies, { dayLabel: longDay(day) });

  return (
    <main className={gridView ? 'gridview' : undefined}>
      {/* Joe's ruling from the installed app, 2026-09-04: the heading is the word DATE and the
          picker sits on the heading's own line, to its right. The heading IS the control's label -
          <label htmlFor> inside an <h1> is valid phrasing content - so the visible name prompt 25
          insisted on is still there, still real, and now only said once. */}
      <div className="pagehead">
        <h1><label htmlFor="viewing-day">DATE</label></h1>
        <DatePicker day={day} />
      </div>

      {/* The sport block: the ALL bar, then the tiles. The day row that used to sit under it is
          gone with its count - the bands below already read `6 airing . 48 TBD . 5 unavailable`,
          and Joe ruled the broadcast count eliminated. */}
      <div className="controls controls-stack">
        <SportFilter sport={sport} />
        {/* Register section 9's series sub-filter. A SECOND row under the tiles - the tile row's
            geometry is untouched, which section 16 froze deliberately. */}
        <SeriesFilter sport={sport} series={series} />
      </div>

      {error ? <p className="error">Could not read the database: {error}</p> : null}

      {!error && rows.length === 0 ? (
        <p className="empty">
          Nothing on this viewing day{sport ? ` for ${SPORT_LABEL[sport] || sport}` : ''}.{' '}
          {(sport && SPORT_EMPTY[sport]) ||
            'The database currently holds loaded days only — try 2026-09-03 or 2026-09-04 (MLB), ' +
              '2026-09-05 (CFB), 2026-09-13 (NFL), 2026-10-01 (NHL) or 2026-10-28 (NBA).'}
        </p>
      ) : null}

      {/* PROTOTYPE: when the grid is the VIEW it is the only content, so it can own the viewport.
          Nothing else renders - no D1 band, no sport bands, no "data as of", no archived render.
          That is not a simplification of the page; it is the structural precondition for a sticky
          axis, measured in the note on `.mgrid-vp`. */}
      {gridView ? (
        !error && rows.length ? (
          <Listing games={rows} standingsRows={standingsRows} rankingsRows={rankingsRows}
                   day={day} sport={sport} grid nowMinute={nowMinute} gridViewport />
        ) : null
      ) : (
        <>
      {/* D1 above, the day below. .today-split only becomes two columns at 1592px (D5); under that
          it is a plain block, so the band sits ABOVE the grid and never after it. */}
      <div className="today-split">
        {!error && rows.length ? (
          <FirstBand band={band} standingsRows={standingsRows} rankingsRows={rankingsRows}
                     day={day} sport={sport} />
        ) : null}

        <div id="all-today">
          <Listing games={rows} standingsRows={standingsRows} rankingsRows={rankingsRows}
                   day={day} sport={sport} grid bands nowMinute={nowMinute} />
        </div>
      </div>

      {!error && rows.length ? <DataAsOf day={day} today={today} overlay={overlay} /> : null}

      {sport && !error && games.length ? (
        <Suspense fallback={null}>
          <ArchivedGrid sport={sport} day={day} />
        </Suspense>
      ) : null}
        </>
      )}
    </main>
  );
}
