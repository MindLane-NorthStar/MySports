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
import {
  weekIndexRows,
  gamesForRange,
  gamesForSeasonWeek,
  standingsForGames,
} from '../../lib/queries.js';
import { calendarWeeksFrom, seasonWeeksFrom, daySpan, isoWeekNumber } from '../../lib/weeks.js';
import { daySpanLabel, shortDay } from '../../lib/format.js';
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
 * browser will even rasterize. The week MODEL is unchanged; only how many of them are on screen is.
 */
function WeekPicker({ weeks, view, selected, label }) {
  if (weeks.length < 2) return null;
  return (
    <div className="controls">
      <span className="control-label">Week</span>
      <div className="chiprow">
        {weeks.map((w) => (
          <Link
            key={w.key}
            className="chip"
            data-active={w.key === selected}
            href={`/weeks?view=${view}&w=${encodeURIComponent(w.key)}`}
          >
            {label(w)}
          </Link>
        ))}
      </div>
    </div>
  );
}

async function CalendarWeeks({ index, pick }) {
  const all = calendarWeeksFrom(index).map((w) => ({ ...w, key: w.start }));
  if (!all.length) return <p className="empty">No games loaded.</p>;
  const selected = all.find((w) => w.key === pick) || all[0];
  const weeks = [selected];
  const loaded = await Promise.all(weeks.map((w) => gamesForRange(w.start, w.end)));
  const standings = await Promise.all(loaded.map((g) => standingsForGames(g)));
  return (
    <>
      <WeekPicker weeks={all} view="calendar" selected={selected.key} label={(w) => `Wk ${isoWeekNumber(w.start)}`} />
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
  const selected = all.find((w) => w.key === pick) || all[0];
  const weeks = [selected];
  const loaded = await Promise.all(weeks.map((w) => gamesForSeasonWeek(w.sport, w.season, w.week)));
  const standings = await Promise.all(loaded.map((g) => standingsForGames(g)));
  return (
    <>
      <WeekPicker
        weeks={all}
        view="season"
        selected={selected.key}
        label={(w) => `${(SPORT_LABEL[w.sport] || w.sport).split(' ')[0]} wk ${w.week}`}
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
              <span className="span">
                {daySpanLabel(w.start, w.end)} <em>(derived from the games)</em>
              </span>
              <span className="span">
                {w.count} {w.count === 1 ? 'game' : 'games'} · {days.length} days
              </span>
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
        <SeasonWeeks index={index} pick={pick} />
      ) : (
        <CalendarWeeks index={index} pick={pick} />
      )}
    </main>
  );
}
