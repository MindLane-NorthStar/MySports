// WEEKS - the two-week-concept model, side by side, as day-column LISTINGS. Never a grid: a grid is
// one archived rendering of one day, and it lives on the Today page.
//
//   ?view=calendar (default) - ISO Monday-Sunday over viewing_day, all sports together.
//   ?view=season             - NFL / CFB provider week labels, each with its span DERIVED from the
//                              games carrying that label. CFB week 1 spans Aug 29 -> Sep 7 2026:
//                              ten days across two calendar weeks, because that is what the
//                              provider labelled, and the app does not second-guess the provider.

import Link from 'next/link';
import Listing from '../../components/Listing.js';
import WeekSelect from '../../components/WeekSelect.js';
import {
  weekIndexRows,
  gamesForRange,
  gamesForSeasonWeek,
  standingsForGames,
} from '../../lib/queries.js';
import { calendarWeeksFrom, seasonWeeksFrom, daySpan, isoWeekNumber, currentWeekKey } from '../../lib/weeks.js';
import { daySpanLabel, shortDay, todayET } from '../../lib/format.js';
import { SPORT_LABEL } from '../../lib/config.js';
import { RestError } from '../../lib/rest.js';

export const dynamic = 'force-dynamic';

function byDay(games, days) {
  const map = Object.fromEntries(days.map((d) => [d, []]));
  for (const g of games) if (map[g.viewing_day]) map[g.viewing_day].push(g);
  return map;
}

/**
 * v0.2: a week's days render as the LOCKED matchup card, the same card the Today page uses - one
 * listing design for every listings view. The week MODEL is untouched: which days belong to a week,
 * and where its span comes from, is still lib/weeks.js.
 */
function WeekDays({ days, grouped, standingsRows }) {
  return (
    <>
      {days.map((d) =>
        grouped[d]?.length ? (
          <div key={d} className="weekday">
            <h3>{shortDay(d)}</h3>
            <Listing games={grouped[d]} standingsRows={standingsRows} day={d} />
          </div>
        ) : null
      )}
    </>
  );
}

/**
 * ONE week at a time. The locked card is a three-line card, so every loaded week at once would be a
 * page tens of thousands of pixels tall - past the point where anyone scrolls it, and past what a
 * browser will even rasterize. The week MODEL is unchanged; only how many are on screen is.
 *
 * The picker itself is now a grouped <select> (components/WeekSelect.js) rather than a chip per week:
 * a season holds 33 of them once loaded, and 33 chips is a wrapped block, not a control.
 */

// SPORT_LABEL is the display name ("College Football"), and the old label did .split(' ')[0] on it -
// which is exactly why the picker read "College wk 1". The week label wants the short sport tag.
const SPORT_TAG = { cfb: 'CFB', nfl: 'NFL', nba: 'NBA', nhl: 'NHL', mlb: 'MLB' };

async function CalendarWeeks({ index, pick }) {
  const all = calendarWeeksFrom(index).map((w) => ({ ...w, key: w.start }));
  if (!all.length) return <p className="empty">No games loaded.</p>;
  // Default to the CURRENT week, not all[0] - see currentWeekKey. Applied to the calendar view as
  // well as the season one: leaving one landing on today and the other on January reads as a bug.
  const selected = all.find((w) => w.key === pick) || all.find((w) => w.key === currentWeekKey(all, todayET())) || all[0];
  const weeks = [selected];
  const loaded = await Promise.all(weeks.map((w) => gamesForRange(w.start, w.end)));
  const standings = await Promise.all(loaded.map((g) => standingsForGames(g)));
  return (
    <>
      <WeekSelect
        view="calendar"
        selected={selected.key}
        options={all.map((w) => ({ key: w.key, label: `Week ${isoWeekNumber(w.start)} · ${daySpanLabel(w.start, w.end)}` }))}
      />
      {weeks.map((w, i) => {
        const grouped = byDay(loaded[i], w.days);
        return (
          <section className="weekblock" key={w.start}>
            <div className="weekblock-head">
              <h3>Week {isoWeekNumber(w.start)}</h3>
              <span className="span">{daySpanLabel(w.start, w.end)}</span>
            </div>
            <WeekDays days={w.days} grouped={grouped} standingsRows={standings[i]} />
          </section>
        );
      })}
    </>
  );
}

async function SeasonWeeks({ index, pick }) {
  const all = seasonWeeksFrom(index).map((w) => ({ ...w, key: `${w.sport}-${w.season}-${w.week}` }));
  if (!all.length) return <p className="empty">No NFL or college football weeks loaded.</p>;
  // Default to the CURRENT week, not all[0] - see currentWeekKey. Applied to the calendar view as
  // well as the season one: leaving one landing on today and the other on January reads as a bug.
  const selected = all.find((w) => w.key === pick) || all.find((w) => w.key === currentWeekKey(all, todayET())) || all[0];
  const weeks = [selected];
  const loaded = await Promise.all(weeks.map((w) => gamesForSeasonWeek(w.sport, w.season, w.week)));
  const standings = await Promise.all(loaded.map((g) => standingsForGames(g)));
  return (
    <>
      <WeekSelect
        view="season"
        selected={selected.key}
        options={all.map((w) => ({
          key: w.key,
          group: SPORT_LABEL[w.sport] || w.sport.toUpperCase(),
          label: `${SPORT_TAG[w.sport] || w.sport.toUpperCase()} Week ${w.week} · ${daySpanLabel(w.start, w.end)}`,
        }))}
      />
      {weeks.map((w, i) => {
        const days = daySpan(w.start, w.end);
        const grouped = byDay(loaded[i], days);
        return (
          <section className="weekblock" key={`${w.sport}-${w.season}-${w.week}`}>
            <div className="weekblock-head">
              <h3>
                {SPORT_LABEL[w.sport] || w.sport.toUpperCase()} · Week {w.week}
              </h3>
              <span className="span">{daySpanLabel(w.start, w.end)}</span>
            </div>
            <WeekDays days={days} grouped={grouped} standingsRows={standings[i]} />
          </section>
        );
      })}
    </>
  );
}

export default async function WeeksPage({ searchParams }) {
  const params = await searchParams;
  const view = params?.view === 'season' ? 'season' : 'calendar';
  const pick = typeof params?.w === 'string' ? params.w : null;

  let index = [];
  let error = null;
  try {
    index = await weekIndexRows();
  } catch (e) {
    error = e instanceof RestError ? `${e.status} — ${e.body}` : String(e);
  }

  return (
    <main>
      <h1>Weeks</h1>
      <div className="controls">
        {/* Same as the Sport row: the bare <span>View</span> was decoration wired to nothing, so
            the group carries the name instead. These are <Link>s, not buttons, so the state is
            aria-current="page" rather than aria-pressed - the view IS the page you are on. */}
        <div className="chiprow" role="group" aria-label="View">
          <Link className="chip" data-active={view === 'calendar'}
                aria-current={view === 'calendar' ? 'page' : undefined}
                href="/weeks?view=calendar">
            Calendar week
          </Link>
          <Link className="chip" data-active={view === 'season'}
                aria-current={view === 'season' ? 'page' : undefined}
                href="/weeks?view=season">
            Season week
          </Link>
        </div>
      </div>

      {error ? (
        <p className="error">Could not read the database: {error}</p>
      ) : view === 'season' ? (
        <SeasonWeeks index={index} pick={pick} />
      ) : (
        <CalendarWeeks index={index} pick={pick} />
      )}
    </main>
  );
}
