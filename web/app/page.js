// THE SCHEDULE HUB - one route, one page, and every piece of its state in the query string.
//
// This was three routes until prompt 50: `/` Today, `/weeks` Weeks, `/history` History, with a tab
// row to move between them. Joe's ruling R1 (docs/hub/restructure-triage-2026-09-05.md section 6a)
// retired that model. There is now one page whose "prism" is chosen by six parameters, resolved in
// web/lib/hubparams.js and nowhere else:
//
//   mode   day | week      the time prism
//   day    ISO date        read only when mode=day
//   w      week key        read only when mode=week
//   sport  one of eight    absent = ALL SPORTS
//   (the NASCAR `series` sub-filter is RETIRED - prompt 52 stage 1. All NASCAR series render
//    together. `programs.series` remains in the DATABASE and is untouched.)
//   scope  all | mine      ALL GAMES | MY TEAMS
//   view   list | grid     LIST VIEW | GRID VIEW
//
// HISTORY IS RETIRED AS NAVIGATION, NOT AS FUNCTIONALITY. A past `day` renders that day's completed
// games with their scores and their box-score links exactly as the History page did, because it is
// the same card reading the same rows. What did NOT survive is the cross-date `?q=` search (R8),
// which is held as a future MY TEAMS sub-feature and recorded in the enhancement register.
//
// viewing_day, not game_date: the pipeline buckets by the 03:00 ET cutover, so a game that tips at
// 10:40pm ET and ends after midnight still belongs to the night you sat down to watch it.

import { Suspense } from 'react';
import Listing from '../components/Listing.js';
import { SportFilter, ModeToggle, ScopeViewToggles, DayPicker, WeekPicker } from '../components/Filters.js';
import {
  gamesForDay, programsForDay, newestGridFor, gridIndex, standingsForGames, rankingsForGames,
  weekIndexRows, gamesForRange, gamesForSeasonWeek, programsForRange,
} from '../lib/queries.js';
import { toRows } from '../lib/programs.js';
import { viewingMinutes } from '../lib/gridmodel.js';
import { longDay, todayET, etTime, shortDay, daySpanWeekdays } from '../lib/format.js';
import FirstBand from '../components/FirstBand.js';
import { bandState } from '../lib/bandstate.js';
import policies from '../lib/policies.js';
import { SPORT_LABEL, gridAssetUrl } from '../lib/config.js';
import { RestError } from '../lib/rest.js';
import { overlayForDay, applyOverlay } from '../lib/livescores.js';
import { resolveHubParams } from '../lib/hubparams.js';
import { calendarWeeksFrom, seasonWeeksFrom, daySpan, currentWeekKey, usesSeasonWeeks } from '../lib/weeks.js';
import { favoriteIds, splitMine } from '../lib/favorites.js';
import { splitHidden } from '../lib/offservice.js';
import favoritesDoc from '../../data/favorites.json';
import PageCount from '../components/PageCount.js';

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

// SPORT_LABEL is the display name ("College Football"); the week label wants the short sport tag.
const SPORT_TAG = { cfb: 'CFB', nfl: 'NFL', nba: 'NBA', nhl: 'NHL', mlb: 'MLB' };

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
function DataAsOf({ day, today, overlay, week = false }) {
  const live = overlay?.fetchedAt && overlay.sports?.length;
  const joined = Object.values(overlay?.stats || {}).reduce((n, s) => n + (s.joined || 0), 0);
  let tail;
  if (week) {
    // WEEK MODE HAS NO OVERLAY, AND DELIBERATELY SO (prompt 53 stage 4b). `overlayForDay` is a
    // per-day fetch and a week is up to ten days, so running it here would be up to ten live calls
    // on one render. The line still has to appear: a week containing today renders today's games
    // with database scores, and silence in front of a score invites the reader to assume it is
    // current - which is the argument this component's own docstring makes.
    tail = 'no live check — a week view does not check live scores, so today’s are the database’s';
  } else if (day !== today) {
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

/**
 * ONE definition of the week list, which one is picked, and how each is labelled.
 *
 * Moved here verbatim from the retired `/weeks` route. Two callers need the same answer - the picker
 * in the controls and the block of days below it - and two copies of
 * `all.find(pick) || currentWeekKey || all[0]` would be free to drift, so the picker could offer a
 * week the block was not showing.
 *
 * THE STALE `?w=` FALLBACK IS THIS CHAIN and it is deliberate: a `?w=` left over from a different
 * sport simply does not match, and the page falls back to that sport's current week - which is where
 * you want to land anyway, so the stale key is a feature rather than a case to guard.
 */
function weekChoices({ index, pick, sport, seasonMode }) {
  const all = seasonMode
    ? seasonWeeksFrom(index)
        .filter((w) => !sport || w.sport === sport)
        .map((w) => ({ ...w, key: `${w.sport}-${w.season}-${w.week}` }))
    : calendarWeeksFrom(index).map((w) => ({ ...w, key: w.start }));
  if (!all.length) return { all, selected: null, options: [] };
  const selected =
    all.find((w) => w.key === pick) ||
    all.find((w) => w.key === currentWeekKey(all, todayET())) ||
    all[0];
  // C1: no ISO week number, in the picker or in the heading. PARTS, AND THE JOINED FORM BUILT FROM
  // THEM - the <option> text has to be one string, but the styled trigger needs the halves
  // separately so the sport-week can be gold and the range grey (prompt 46 unit 1C).
  const parts = (w) =>
    seasonMode
      ? { prefix: `${SPORT_TAG[w.sport] || w.sport.toUpperCase()} Week ${w.week}`,
          range: daySpanWeekdays(w.start, w.end) }
      : { range: daySpanWeekdays(w.start, w.end) };
  const join = (p) => (p.prefix ? `${p.prefix} · ${p.range}` : p.range);
  const options = all.map((w) => {
    const p = parts(w);
    return {
      key: w.key,
      ...(seasonMode ? { group: SPORT_LABEL[w.sport] || w.sport.toUpperCase() } : {}),
      parts: p,
      label: join(p),
    };
  });
  return { all, selected, options, selectedParts: parts(selected) };
}

function byDay(rows, days) {
  const map = Object.fromEntries(days.map((d) => [d, []]));
  for (const g of rows) if (map[g.viewing_day]) map[g.viewing_day].push(g);
  return map;
}

/**
 * What a week with no rows says. A chip can legitimately select a sport that has nothing loaded.
 *
 * IT SHARES `SPORT_EMPTY` WITH DAY MODE (prompt 53 stage 4a). This used to return the bare
 * "No UFC games loaded for this week." - which is exactly the dead end register §13 rules out, and
 * which day mode had already been given bespoke copy to avoid. Same tile, same absent data, two
 * different answers depending on which toggle the reader happened to be on.
 *
 * ONLY THE EXPLANATORY HALF IS SHARED. The framing stays week mode's own - "loaded for this week"
 * rather than "on this viewing day" - because the two prisms really are asking different questions.
 * The SPORT_EMPTY strings are written to follow a sentence that has already named the sport, so
 * they compose the same way after either framing.
 */
function emptyFor(sport) {
  const head = sport
    ? `No ${SPORT_LABEL[sport] || sport} games loaded for this week.`
    : 'No games loaded for this week.';
  const why = (sport && SPORT_EMPTY[sport])
    || 'The database currently holds loaded weeks only — try a CFB or NFL week.';
  return `${head} ${why}`;
}

export default async function HubPage({ searchParams }) {
  const raw = await searchParams;
  const today = todayET();
  const P = resolveHubParams(raw, today);

  // ------------------------------------------------------------------ WEEK MODE
  if (P.isWeek) {
    const seasonMode = Boolean(P.sport) && usesSeasonWeeks(P.sport);
    let index = [];
    let error = null;
    try {
      index = await weekIndexRows();
    } catch (e) {
      error = e instanceof RestError ? `${e.status} — ${e.body}` : String(e);
    }
    const choices = weekChoices({ index, pick: P.w, sport: P.sport, seasonMode });
    const wk = choices.selected;

    let rows = [];
    let standingsRows = [];
    let rankingsRows = [];
    let days = [];
    if (!error && wk) {
      try {
        // v1.7: programs are a SECOND read, not a join - they have no `games` row at all, so one
        // query cannot return both, and a programs failure can never take the game slate down.
        const games = seasonMode
          ? await gamesForSeasonWeek(wk.sport, wk.season, wk.week)
          : await gamesForRange(wk.start, wk.end, P.sport);
        // BOTH BRANCHES PASS THE SPORT. The season branch used to drop it, and it is the branch
        // that CANNOT be sportless: `seasonMode` is `Boolean(P.sport) && usesSeasonWeeks(P.sport)`
        // (above), so it is true only when a sport is selected - the branch that knows the sport was
        // the one discarding it. WEEK · CFB rendered CFB games beside EVERY sport's programs.
        // Measured on the 2026-08-29 CFB week: 14 programs, of which 10 were aew/indycar/nascar/
        // ufc/wwe; on the 2026-09-09 NFL week, 14 of which 9 were unrelated.
        //
        // THIS LOSES NOTHING WANTED. A studio show carries the sport it bookends - `nfl` or `cfb`,
        // never a sport of its own (favorites.js, "MEASURED, not assumed") - so filtering by sport
        // keeps every show that belongs on the week and drops only the other sports.
        // Not a ternary any more: both branches were the same call once the season branch stopped
        // dropping the sport, and a two-armed ternary with identical arms invites the bug back.
        const progs = await programsForRange(wk.start, wk.end, P.sport);
        const now = new Date();
        rows = [...games, ...toRows(progs, now)];
        // Asked ONLY about the games: a program has no club to look up.
        [standingsRows, rankingsRows] = await Promise.all([
          standingsForGames(games), rankingsForGames(games),
        ]);
        days = seasonMode ? daySpan(wk.start, wk.end) : wk.days;
      } catch (e) {
        error = e instanceof RestError ? `${e.status} — ${e.body}` : String(e);
      }
    }

    // R4: MY TEAMS is a SCOPE. Favourites only, filtered inside the day grouping so the calendar
    // survives - 05 section 11's scope note is explicit that hoisting a favourite out of its day
    // destroys the thing a week view exists to show.
    const favIds = favoriteIds(favoritesDoc);
    // R4 + register §18d: MY TEAMS is the thirteen clubs AND the five team-less sports.
    const scoped = P.isMine ? splitMine(rows, favIds).mine : rows;
    // D4, restored and moved to the page (stage 4a): off-service games are hidden, network-TBD and
    // market-pending never are, and a favourite never is. Decided ONCE for the whole week so the
    // count line at the foot describes every day above it.
    const { visible, hidden, summary } = splitHidden(scoped, favIds);
    const grouped = byDay(visible, days);

    // THE NOW MARKER, COMPUTED ON THE SERVER, exactly as day mode does it (see the note further
    // down beside day mode's own `now`). No clock reaches the client, so nothing here enters the
    // hydration path - the trap prompt 42 fell into twice.
    //
    // ONLY THE DAY THAT IS TODAY GETS ONE. A week is up to ten days and at most one of them can be
    // now; every other day is an archived day, which is immutable and has no "now" to mark.
    const weekNow = viewingMinutes(new Date().toISOString());

    return (
      <main>
        <Controls P={P} choices={choices} />
        {error ? <p className="error">Could not read the database: {error}</p> : null}
        {!error && !wk ? (
          <p className="empty">
            {seasonMode ? 'No NFL or college football weeks loaded.' : 'No games loaded.'}
          </p>
        ) : null}
        {!error && wk && visible.length === 0 && !hidden.length ? (
          <p className="empty">
            {P.isMine ? 'None of your teams play this week.' : emptyFor(P.sport)}
          </p>
        ) : null}
        {!error && wk && (visible.length || hidden.length) ? (
          <>
            {days.map((d) =>
              grouped[d]?.length ? (
                <div key={d} className="weekday">
                  {/* C3: the day heading renders THROUGH Listing -> SportBand, so it shares the
                      header row exactly as a sport band does.

                      BANDS UNDER ALL SPORTS ONLY (prompt 53 stage 5, Joe's ruling). Banding adds
                      information exactly when more than one sport is on screen; with a tile
                      selected it adds only a heading that repeats what the tile already says.
                      Week mode passed no `bands` at all, so `Listing` defaulted it false and an NFL
                      game and an MLB game sat adjacent under ALL SPORTS with nothing between them.
                      With a sport selected the flat shape is retained exactly as before. */}
                  {/* THE WEEK GRID (prompt 54 stage 1). Joe: "Choosing 'Week 1 NFL' displays all
                      cards for that week's NFL games - cards from Wednesday, Thursday and Sunday -
                      and TV grid from Wednesday, Thursday and Sunday."

                      A TV GRID'S X-AXIS IS ONE VIEWING DAY'S MINUTES, so seven days cannot share one
                      horizontal ruler. A week grid is therefore N grids STACKED, one per day that
                      has games, each under its own day heading - which is exactly what Joe
                      described. `Listing` already renders a grid for whatever day it is handed
                      (`showGrid = Boolean(grid && games.length)`); the week branch was calling it
                      once per day already and simply passing none of the grid props.

                      `gridOnly` carries prompt 53 stage 3's suppression down PER DAY: in week +
                      GRID each day shows its heading and its grid and no cards. */}
                  <Listing games={grouped[d]} standingsRows={standingsRows} rankingsRows={rankingsRows}
                           day={d} heading={shortDay(d)} headingClass="weekday-head"
                           bands={!P.sport} sport={P.sport} floatFavorites={!P.isMine}
                           grid={P.isGrid} gridOnly={P.isGrid}
                           nowMinute={d === today ? weekNow : null} />
                </div>
              ) : null
            )}
            <PageCount summary={summary} hidden={hidden} standingsRows={standingsRows}
                       rankingsRows={rankingsRows} />
            <DataAsOf week />
          </>
        ) : null}
      </main>
    );
  }

  // ------------------------------------------------------------------ DAY MODE
  const day = P.day;
  let games = [];
  let programs = [];
  let standingsRows = [];
  let rankingsRows = [];
  let error = null;
  try {
    // v1.7: programs are a SECOND read, not a join. They live in `programs` and have no `games` row
    // at all, so one query cannot return both - and keeping them separate means a programs failure
    // can never take the game slate down with it.
    [games, programs] = await Promise.all([
      gamesForDay(day, P.sport), programsForDay(day, P.sport),
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
  // everything the overlay does not carry. overlayForDay never throws and never rejects.
  const overlay = await overlayForDay(day, games, { today });
  games = applyOverlay(games, overlay.map);

  // THE REQUEST TIME, used twice and read once. bandState() already takes it as an argument; the
  // grid's now marker takes the same instant as a minute-of-viewing-day. Both are computed HERE, on
  // the server, so neither reaches the client as a clock - which is what keeps a time-aware line out
  // of the hydration path entirely (the trap prompt 42 fell into twice).
  const now = new Date();
  const programRows = toRows(programs, now);
  const allRows = [...games, ...programRows];
  // The marker is drawn on TODAY only. An archived day is immutable and a past day has no "now".
  const nowMinute = day === today ? viewingMinutes(now.toISOString()) : null;

  // R4: MY TEAMS is a scope - favourites only, chronological across every sport. `allRows` arrives
  // ordered by kickoff and splitFavorites keeps input order, so "chronological" is free.
  const favIds = favoriteIds(favoritesDoc);
  // R4 + register §18d. `allRows` arrives ordered by kickoff and splitMine keeps input order, so
  // "chronological across every sport" is free.
  const scoped = P.isMine ? splitMine(allRows, favIds).mine : allRows;
  // D4, restored and moved to the page (stage 4a). Decided ONCE here so the bands below render only
  // what is visible and the single count line at the foot describes all of them.
  const { visible: rows, hidden, summary } = splitHidden(scoped, favIds);

  // D1. Computed ONCE, here, from the request time - the page is force-dynamic, so this is the
  // clock the reader is actually looking at. It reaches the band as data; nothing recomputes it on
  // the client, which is what keeps a time-aware block out of the hydration path entirely.
  const band = bandState(rows, now, policies, { dayLabel: longDay(day) });

  return (
    <main>
      <Controls P={P} choices={null} />

      {error ? <p className="error">Could not read the database: {error}</p> : null}

      {!error && rows.length === 0 && !hidden.length ? (
        <p className="empty">
          {P.isMine ? (
            'None of your teams play on this viewing day.'
          ) : (
            <>
              Nothing on this viewing day{P.sport ? ` for ${SPORT_LABEL[P.sport] || P.sport}` : ''}.{' '}
              {(P.sport && SPORT_EMPTY[P.sport]) ||
                'The database currently holds loaded days only — try 2026-09-03 or 2026-09-04 (MLB), ' +
                  '2026-09-05 (CFB), 2026-09-13 (NFL), 2026-10-01 (NHL) or 2026-10-28 (NBA).'}
            </>
          )}
        </p>
      ) : null}

      {/* GRID VIEW ON DESKTOP: the archived PC grid is the grid, and it is promoted to the TOP.
       *
       * THE MOBILE GRID STAYS PHONE-ONLY and is deliberately not lifted here. The Mobile Grid
       * Addendum's deviations are phone-only - M5 is explicit that "PC keeps v1.2 labels" - so above
       * 699px the desktop grid is the archived PC render and nothing else.
       *
       * CSS-GATED, NOT JS-GATED. Both this and the phone grid are rendered and one is hidden by a
       * media query, because every breakpoint in this app is CSS-gated at 699px precisely so there
       * is no server/client hydration mismatch. A JS width state here would reintroduce one.
       *
       * ALL SPORTS HAS NO ARCHIVED GRID TO PROMOTE: it is per (sport, day) by construction, which is
       * why ArchivedGrid returns null without a sport. One honest line instead, in the same voice as
       * its own empty state, rather than falling back to a phone grid stretched across a desktop
       * column - which is the thing prompt 50 removed. */}
      {P.isGrid ? (
        <div className="deskgrid-only">
          {P.sport ? (
            !error && games.length ? (
              <Suspense fallback={null}>
                <ArchivedGrid sport={P.sport} day={day} />
              </Suspense>
            ) : null
          ) : (
            <p className="gridnone">
              The desktop grid is rendered per league — pick one above to see it. On a phone, GRID
              VIEW shows every sport on one timeline.
            </p>
          )}
        </div>
      ) : null}

      {/* D1 above, the day below. .today-split only becomes two columns at 1592px (D5); under that
          it is a plain block, so the band sits ABOVE the grid and never after it.
          The D1 band is a LIST-view thing: in GRID VIEW there is no list beneath it for "See all
          today" to jump to, so it does not render. */}
      <div className="today-split">
        {!error && rows.length && !P.isGrid ? (
          <FirstBand band={band} standingsRows={standingsRows} rankingsRows={rankingsRows}
                     day={day} sport={P.sport} floatFavorites={!P.isMine} />
        ) : null}

        <div id="all-today">
          <Listing games={rows} standingsRows={standingsRows} rankingsRows={rankingsRows}
                   day={day} sport={P.sport} grid bands={!P.isGrid} gridOnly={P.isGrid}
                   nowMinute={nowMinute} floatFavorites={!P.isMine} />
        </div>
      </div>

      {!error && (rows.length || hidden.length) ? (
        <PageCount summary={summary} hidden={hidden} standingsRows={standingsRows}
                       rankingsRows={rankingsRows} />
      ) : null}

      {!error && rows.length ? <DataAsOf day={day} today={today} overlay={overlay} /> : null}

      {/* LIST VIEW keeps the archived grid where it has always been - at the FOOT, after the list.
          In GRID VIEW it is promoted to the top instead (above); rendering it in both places would
          put two copies on a desktop grid page. */}
      {!P.isGrid && P.sport && !error && games.length ? (
        <Suspense fallback={null}>
          <ArchivedGrid sport={P.sport} day={day} />
        </Suspense>
      ) : null}
    </main>
  );
}

/**
 * THE CONTROL STACK, and its order is the whole point (prompt 50 stage 2a).
 *
 * The page reads downward as a sentence: I am looking at the DAY view, ALL GAMES, LIST VIEW, ALL
 * SPORTS (or one league), and here is the day I picked. That is why the picker sits BELOW the tiles
 * rather than above them, which is where it was on all three of the retired routes.
 *
 * The DATE / WEEK heading that used to sit beside the picker is gone: the DAY | WEEK toggle at the
 * top of this stack is now the label, and repeating it is noise. That supersedes prompt 45's
 * heading ruling, and it takes the pickers' accessible names with it - which is why each picker
 * carries `aria-labelledby` pointing at the active mode segment (see Filters.js).
 */
function Controls({ P, choices }) {
  return (
    <div className="hubctl">
      {/* 1. DAY | WEEK - the time prism, and since prompt 50 also the pickers' visible label. */}
      <ModeToggle mode={P.mode} />
      {/* 2. ALL GAMES | MY TEAMS and LIST VIEW | GRID VIEW, four buttons on ONE row (spec §9). */}
      <ScopeViewToggles scope={P.scope} view={P.view} />
      {/* 3-4. The ALL SPORTS bar, then the eight league tiles. Untouched by the restack except for
              the bar's height (stage 2c); register §16 froze the tile row's geometry. */}
      <div className="controls controls-stack">
        <SportFilter sport={P.sport} />
      </div>
      {/* 5. The picker, with its prev/next arrows. */}
      <div className="pickrow">
        {P.isWeek ? (
          <WeekPicker choices={choices} sport={P.sport} />
        ) : (
          <DayPicker day={P.day} />
        )}
      </div>
    </div>
  );
}
