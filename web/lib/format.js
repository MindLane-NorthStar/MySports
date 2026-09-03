// Display formatting. Every clock time on every page is ET, formatted from the stored instant -
// the same rule the renderer follows. The database's canonical_kickoff_at_et column currently
// carries the identical instant to canonical_kickoff_at_utc, so the UTC column is the one read and
// America/New_York is applied here, in one place.

import { DISPLAY_TIMEZONE } from './config.js';

const TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: DISPLAY_TIMEZONE,
  hour: 'numeric',
  minute: '2-digit',
});

const DAY_LONG = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const DAY_SHORT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

const MONTH_DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });

/** Kickoff instant -> '7:05 PM ET', or 'TBD' when the time is not set. */
export function etTime(instant, kickoffStatus) {
  if (kickoffStatus === 'tbd' || !instant) return 'TBD';
  const d = new Date(instant);
  if (Number.isNaN(d.getTime())) return 'TBD';
  return `${TIME.format(d)} ET`;
}

/** 'YYYY-MM-DD' -> 'Monday, August 31, 2026'. Day strings are calendar dates, formatted in UTC. */
export function longDay(day) {
  return day ? DAY_LONG.format(new Date(`${day}T00:00:00Z`)) : '';
}

/** 'YYYY-MM-DD' -> 'Mon, Aug 31'. */
export function shortDay(day) {
  return day ? DAY_SHORT.format(new Date(`${day}T00:00:00Z`)) : '';
}

/** 'Aug 29 - Sep 7, 2026' for a derived span. */
export function daySpanLabel(start, end) {
  if (!start) return '';
  if (!end || end === start) return `${MONTH_DAY.format(new Date(`${start}T00:00:00Z`))}, ${start.slice(0, 4)}`;
  return `${MONTH_DAY.format(new Date(`${start}T00:00:00Z`))} – ${MONTH_DAY.format(
    new Date(`${end}T00:00:00Z`)
  )}, ${end.slice(0, 4)}`;
}

/** Today's date in ET as 'YYYY-MM-DD' - the default the Today page opens on. */
export function todayET() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DISPLAY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts; // en-CA yields YYYY-MM-DD
}

/**
 * The state line a card shows instead of, or beside, the time.
 * Scores are only ever shown for a game that has actually started (the loader guarantees the
 * columns are null otherwise, and this does not second-guess that).
 */
/**
 * E1: the live clock and period for a game in progress, in the sport's own idiom.
 *
 *   ESPN sports (nfl, cfb, nba)  Q2 7:12      period number + status.displayClock
 *   nhl                          P3 04:11     period + time remaining
 *   mlb                          B4           inning half + inning; baseball has no clock
 *
 * Returns null unless the overlay actually supplied a clock or period, so the pill falls back to
 * the word it has always shown rather than rendering a half-empty label.
 *
 * NHL uses P for period rather than the T in the brief's example ON PURPOSE: T is already taken by
 * baseball's Top-of-the-inning here, and one letter meaning two things across sports on the same
 * page is exactly the kind of ambiguity a scannable label cannot afford.
 */
export function liveClockLabel(game) {
  if (game.result_status !== 'in_progress') return null;
  const period = game.live_period;
  const clock = game.live_clock;
  if (period === null || period === undefined) return null;
  if (game.sport === 'mlb') {
    const half = typeof clock === 'string' && clock ? (clock[0].toUpperCase() === 'B' ? 'B' : 'T') : '';
    return half ? `${half}${period}` : null;
  }
  const label = `${game.sport === 'nhl' ? 'P' : 'Q'}${period}`;
  return clock ? `${label} ${clock}` : label;
}

export function resultLabel(game) {
  switch (game.result_status) {
    case 'final':
      return 'Final';
    case 'in_progress':
      // E1: the live clock REPLACES the word "Live" in the same pill - same element, same tone, no
      // new anatomy. Falls back to "Live" whenever the overlay carried no clock.
      return liveClockLabel(game) || 'Live';
    case 'postponed':
      return 'Postponed';
    case 'cancelled':
      return 'Cancelled';
    default:
      return null;
  }
}

export function hasScore(game) {
  return (
    (game.result_status === 'final' || game.result_status === 'in_progress') &&
    Number.isInteger(game.home_score) &&
    Number.isInteger(game.away_score)
  );
}

/** A colour that is safe to paint on the dark chrome; falls back to the dim ink. */
export function teamColor(hex, fallback = '#9AA0A8') {
  return /^#[0-9a-fA-F]{6}$/.test(hex || '') ? hex : fallback;
}
