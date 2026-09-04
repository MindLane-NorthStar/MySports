// WEEKS - the two-week-concept model, side by side, as day-column LISTINGS. Never a grid: a grid is
// one archived rendering of one day, and it lives on the Today page.
//
// C2: THE SPORT CHOOSES THE WEEK CONCEPT. ?view= is gone. The same chip row the Today page uses now
// sits under the heading, and the week model follows from what it selects - because which concept of
// "week" is right was never the user's decision to make, it is a property of the sport:
//
//   no chip / a sport with no provider weeks - ISO Monday-Sunday over viewing_day.
//   nfl or cfb (usesSeasonWeeks)             - provider week labels, each with its span DERIVED from
//                                              the games carrying that label. CFB week 1 spans
//                                              Aug 29 -> Sep 7 2026: ten days across two calendar
//                                              weeks, because that is what the provider labelled,
//                                              and the app does not second-guess the provider.
//
// ?w= still names the week and is still the source of truth for WHICH one. A ?w= left over from a
// different sport simply does not match, and the page falls back to that sport's current week - which
// is where you want to land anyway, so the stale key is a feature rather than a case to guard.

import Listing from '../../components/Listing.js';
import WeekSelect from '../../components/WeekSelect.js';
import {
  weekIndexRows,
  gamesForRange,
  gamesForSeasonWeek,
  standingsForGames,
  rankingsForGames,
} from '../../lib/queries.js';
import { calendarWeeksFrom, seasonWeeksFrom, daySpan, currentWeekKey, usesSeasonWeeks } from '../../lib/weeks.js';
import { daySpanWeekdays, shortDay, todayET } from '../../lib/format.js';
import { SportFilter } from '../../components/Filters.js';
import { SPORT_LABEL, resolveSportParam } from '../../lib/config.js';
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
function WeekDays({ days, grouped, standingsRows, rankingsRows }) {
  return (
    <>
      {days.map((d) =>
        grouped[d]?.length ? (
          <div key={d} className="weekday">
            {/* C3: the day heading renders THROUGH Listing -> SportBand now, so it shares the header
                row with the count exactly as a sport band does. It was an <h3> here, which is why
                the count could only ever sit on the line below it. */}
            <Listing games={grouped[d]} standingsRows={standingsRows} rankingsRows={rankingsRows}
                     day={d} heading={shortDay(d)} headingClass="weekday-head" />
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

/**
 * What a week with no rows says. A chip can legitimately select a sport that has nothing loaded -
 * Racing has zero rows in the database today - and the honest sentence is that none are LOADED, not
 * that none are scheduled. The app cannot tell the difference and must not imply that it can.
 */
function emptyFor(sport) {
  return sport
    ? `No ${SPORT_LABEL[sport] || sport} games loaded for this week.`
    : 'No games loaded for this week.';
}

async function CalendarWeeks({ index, pick, sport }) {
  const all = calendarWeeksFrom(index).map((w) => ({ ...w, key: w.start }));
  if (!all.length) return <p className="empty">No games loaded.</p>;
  // Default to the CURRENT week, not all[0] - see currentWeekKey. Applied to the calendar view as
  // well as the season one: leaving one landing on today and the other on January reads as a bug.
  const selected = all.find((w) => w.key === pick) || all.find((w) => w.key === currentWeekKey(all, todayET())) || all[0];
  const weeks = [selected];
  const loaded = await Promise.all(weeks.map((w) => gamesForRange(w.start, w.end, sport)));
  const standings = await Promise.all(loaded.map((g) => standingsForGames(g)));
  const ranks = await Promise.all(loaded.map((g) => rankingsForGames(g)));
  return (
    <>
      {/* C1: no ISO week number, in the picker or in the heading. It was a number nobody navigates
          by - "Week 35" answers a question no one asked, while the dates answer the one they did. */}
      <WeekSelect
        sport={sport}
        selected={selected.key}
        options={all.map((w) => ({ key: w.key, label: daySpanWeekdays(w.start, w.end) }))}
      />
      {weeks.map((w, i) => {
        const grouped = byDay(loaded[i], w.days);
        return (
          <section className="weekblock" key={w.start}>
            <div className="weekblock-head">
              <h3>{daySpanWeekdays(w.start, w.end)}</h3>
            </div>
            {loaded[i].length ? (
              <WeekDays days={w.days} grouped={grouped} standingsRows={standings[i]}
                        rankingsRows={ranks[i]} />
            ) : (
              <p className="empty">{emptyFor(sport)}</p>
            )}
          </section>
        );
      })}
    </>
  );
}

async function SeasonWeeks({ index, pick, sport }) {
  const all = seasonWeeksFrom(index)
    .filter((w) => !sport || w.sport === sport)
    .map((w) => ({ ...w, key: `${w.sport}-${w.season}-${w.week}` }));
  if (!all.length) return <p className="empty">No NFL or college football weeks loaded.</p>;
  // Default to the CURRENT week, not all[0] - see currentWeekKey. Applied to the calendar view as
  // well as the season one: leaving one landing on today and the other on January reads as a bug.
  const selected = all.find((w) => w.key === pick) || all.find((w) => w.key === currentWeekKey(all, todayET())) || all[0];
  const weeks = [selected];
  const loaded = await Promise.all(weeks.map((w) => gamesForSeasonWeek(w.sport, w.season, w.week)));
  const standings = await Promise.all(loaded.map((g) => standingsForGames(g)));
  const ranks = await Promise.all(loaded.map((g) => rankingsForGames(g)));
  return (
    <>
      <WeekSelect
        sport={sport}
        selected={selected.key}
        options={all.map((w) => ({
          key: w.key,
          group: SPORT_LABEL[w.sport] || w.sport.toUpperCase(),
          label: `${SPORT_TAG[w.sport] || w.sport.toUpperCase()} Week ${w.week} · ${daySpanWeekdays(w.start, w.end)}`,
        }))}
      />
      {weeks.map((w, i) => {
        const days = daySpan(w.start, w.end);
        const grouped = byDay(loaded[i], days);
        return (
          <section className="weekblock" key={`${w.sport}-${w.season}-${w.week}`}>
            <div className="weekblock-head">
              <h3>
                {SPORT_TAG[w.sport] || w.sport.toUpperCase()} Week {w.week} · {daySpanWeekdays(w.start, w.end)}
              </h3>
            </div>
            <WeekDays days={days} grouped={grouped} standingsRows={standings[i]}
                     rankingsRows={ranks[i]} />
          </section>
        );
      })}
    </>
  );
}

export default async function WeeksPage({ searchParams }) {
  const params = await searchParams;
  const sport = resolveSportParam(params?.sport);
  const pick = typeof params?.w === 'string' ? params.w : null;
  // The one line that replaces ?view=. usesSeasonWeeks is the existing answer to "does this sport
  // have provider week labels", already used by the week model - so the page DERIVES the concept
  // from the sport rather than keeping a second, hand-set copy of the same fact in the URL.
  const seasonMode = Boolean(sport) && usesSeasonWeeks(sport);

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
      {/* C2: the Today page's own chip row, IMPORTED rather than reimplemented - useSetParam reads
          usePathname(), so SportFilter was never coupled to "/" and needed no fork to land here.
          ALL stays the first control, as the full-width bar above the tiles. */}
      <div className="controls">
        <SportFilter sport={sport} />
      </div>

      {error ? (
        <p className="error">Could not read the database: {error}</p>
      ) : seasonMode ? (
        <SeasonWeeks index={index} pick={pick} sport={sport} />
      ) : (
        <CalendarWeeks index={index} pick={pick} sport={sport} />
      )}
    </main>
  );
}
