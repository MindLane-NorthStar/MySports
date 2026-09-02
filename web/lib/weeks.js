// The two-week-concept model (Joe's blessed design).
//
// A "week" means two different things in this product and the app never conflates them:
//
//   SEASON WEEK  - cfb and nfl only. The week is the PROVIDER's week label (games.week); its date
//                  span is DERIVED from the games that carry that label, never assumed. CFB week 1
//                  spans Sat Aug 29 -> Mon Sep 7 2026, which is ten days and crosses two calendar
//                  weeks. That is the correct span because that is what the provider labelled.
//
//   CALENDAR WEEK - nba, nhl, mlb and the all-sports view. ISO Monday -> Sunday over viewing_day
//                  (the 03:00 ET cutover day, so a game that ends at 1am lands on the night it
//                  belongs to, not the next morning).
//
// Everything here is pure date arithmetic on YYYY-MM-DD strings, done in UTC to keep it away from
// the host machine's timezone. Display formatting lives in format.js.

import { SEASON_WEEK_SPORTS } from './config.js';

/** 'YYYY-MM-DD' -> Date at UTC midnight. */
export function parseDay(day) {
  const [y, m, d] = String(day).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Date -> 'YYYY-MM-DD' (UTC fields, so it round-trips with parseDay). */
export function toDay(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(day, n) {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() + n);
  return toDay(d);
}

/** The ISO Monday on or before `day`. */
export function isoMonday(day) {
  const d = parseDay(day);
  const dow = d.getUTCDay(); // 0 Sun .. 6 Sat
  return addDays(day, dow === 0 ? -6 : 1 - dow);
}

/** { start, end, days[7] } for the ISO Monday-Sunday week containing `day`. */
export function isoWeek(day) {
  const start = isoMonday(day);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return { start, end: days[6], days };
}

/** ISO week number, for labelling only. */
export function isoWeekNumber(day) {
  const d = parseDay(isoMonday(day));
  const thursday = new Date(d);
  thursday.setUTCDate(thursday.getUTCDate() + 3);
  const jan1 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  return Math.ceil(((thursday - jan1) / 86400000 + 1) / 7);
}

export function usesSeasonWeeks(sport) {
  return SEASON_WEEK_SPORTS.includes(sport);
}

/**
 * Group rows of {sport, season, week, viewing_day} into season weeks with DERIVED spans.
 * Rows whose sport does not use season weeks, or that carry no week label, are ignored.
 * Returns [{ sport, season, week, start, end, days[], count }] ordered by (sport, season, week).
 */
export function seasonWeeksFrom(rows) {
  const buckets = new Map();
  for (const r of rows) {
    if (!usesSeasonWeeks(r.sport) || r.week === null || r.week === undefined) continue;
    const key = `${r.sport}|${r.season}|${r.week}`;
    let b = buckets.get(key);
    if (!b) {
      b = { sport: r.sport, season: r.season, week: r.week, days: new Set(), count: 0 };
      buckets.set(key, b);
    }
    b.days.add(r.viewing_day);
    b.count += 1;
  }
  return [...buckets.values()]
    .map((b) => {
      const days = [...b.days].sort();
      return { ...b, days, start: days[0], end: days[days.length - 1] };
    })
    .sort((a, b) => a.sport.localeCompare(b.sport) || a.season - b.season || a.week - b.week);
}

/**
 * Group the same rows into ISO calendar weeks (all sports together).
 * Returns [{ start, end, days[7], count, sports[] }] ordered by start.
 */
export function calendarWeeksFrom(rows) {
  const buckets = new Map();
  for (const r of rows) {
    if (!r.viewing_day) continue;
    const start = isoMonday(r.viewing_day);
    let b = buckets.get(start);
    if (!b) {
      b = { start, count: 0, sports: new Set(), byDay: new Map() };
      buckets.set(start, b);
    }
    b.count += 1;
    b.sports.add(r.sport);
    b.byDay.set(r.viewing_day, (b.byDay.get(r.viewing_day) || 0) + 1);
  }
  return [...buckets.values()]
    .map((b) => {
      const { days, end } = isoWeek(b.start);
      return {
        start: b.start,
        end,
        days,
        count: b.count,
        sports: [...b.sports].sort(),
        countsByDay: Object.fromEntries(days.map((d) => [d, b.byDay.get(d) || 0])),
      };
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** Every distinct day in a derived span, inclusive - so a season week renders one column per day. */
export function daySpan(start, end) {
  const out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}
