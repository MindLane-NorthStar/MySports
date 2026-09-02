// WEEKS - the two-week-concept model, side by side, as day-column LISTINGS. Never a grid: a grid is
// one archived rendering of one day, and it lives on the Today page.
//
//   ?view=calendar (default) - ISO Monday-Sunday over viewing_day, all sports together.
//   ?view=season             - NFL / CFB provider week labels, each with its span DERIVED from the
//                              games carrying that label. CFB week 1 spans Aug 29 -> Sep 7 2026:
//                              ten days across two calendar weeks, because that is what the
//                              provider labelled, and the app does not second-guess the provider.

import Link from 'next/link';
import DayColumn from '../../components/DayColumn.js';
import {
  weekIndexRows,
  gamesForRange,
  gamesForSeasonWeek,
} from '../../lib/queries.js';
import { calendarWeeksFrom, seasonWeeksFrom, daySpan, isoWeekNumber } from '../../lib/weeks.js';
import { daySpanLabel } from '../../lib/format.js';
import { SPORT_LABEL } from '../../lib/config.js';
import { RestError } from '../../lib/rest.js';

export const dynamic = 'force-dynamic';

function byDay(games, days) {
  const map = Object.fromEntries(days.map((d) => [d, []]));
  for (const g of games) if (map[g.viewing_day]) map[g.viewing_day].push(g);
  return map;
}

async function CalendarWeeks({ index }) {
  const weeks = calendarWeeksFrom(index);
  if (!weeks.length) return <p className="empty">No games loaded.</p>;
  const loaded = await Promise.all(weeks.map((w) => gamesForRange(w.start, w.end)));
  return (
    <>
      {weeks.map((w, i) => {
        const grouped = byDay(loaded[i], w.days);
        return (
          <section className="weekblock" key={w.start}>
            <div className="weekblock-head">
              <h3>Week {isoWeekNumber(w.start)}</h3>
              <span className="span">{daySpanLabel(w.start, w.end)}</span>
              <span className="span">
                {w.count} {w.count === 1 ? 'game' : 'games'} ·{' '}
                {w.sports.map((s) => SPORT_LABEL[s] || s.toUpperCase()).join(', ')}
              </span>
            </div>
            <div className="daycols">
              {w.days.map((d) => (
                <DayColumn key={d} day={d} games={grouped[d]} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

async function SeasonWeeks({ index }) {
  const weeks = seasonWeeksFrom(index);
  if (!weeks.length) return <p className="empty">No NFL or college football weeks loaded.</p>;
  const loaded = await Promise.all(weeks.map((w) => gamesForSeasonWeek(w.sport, w.season, w.week)));
  return (
    <>
      {weeks.map((w, i) => {
        const days = daySpan(w.start, w.end);
        const grouped = byDay(loaded[i], days);
        return (
          <section className="weekblock" key={`${w.sport}-${w.season}-${w.week}`}>
            <div className="weekblock-head">
              <h3>
                {SPORT_LABEL[w.sport] || w.sport.toUpperCase()} · Week {w.week}
              </h3>
              <span className="span">
                {daySpanLabel(w.start, w.end)} <em>(derived from the games)</em>
              </span>
              <span className="span">
                {w.count} {w.count === 1 ? 'game' : 'games'} · {days.length} days
              </span>
            </div>
            <div className="daycols">
              {days.map((d) => (
                <DayColumn key={d} day={d} games={grouped[d]} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

export default async function WeeksPage({ searchParams }) {
  const params = await searchParams;
  const view = params?.view === 'season' ? 'season' : 'calendar';

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
      <p className="sub">
        Two different weeks, kept apart on purpose: the calendar week is ISO Monday–Sunday over the
        viewing day; the season week is the provider’s own label, and its span is derived from the
        games that carry it.
      </p>

      <div className="controls">
        <span className="control-label">View</span>
        <div className="chiprow">
          <Link className="chip" data-active={view === 'calendar'} href="/weeks?view=calendar">
            Calendar week · all sports
          </Link>
          <Link className="chip" data-active={view === 'season'} href="/weeks?view=season">
            Season week · NFL &amp; CFB
          </Link>
        </div>
      </div>

      {error ? (
        <p className="error">Could not read the database: {error}</p>
      ) : view === 'season' ? (
        <SeasonWeeks index={index} />
      ) : (
        <CalendarWeeks index={index} />
      )}
    </main>
  );
}
