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

/**
 * Kickoff instant -> '7:05 PM', or 'TBD' when the time is not set.
 *
 * NO " ET" SUFFIX since prompt 31 - Joe's ruling. It was appended on every clock on every surface,
 * which is four repetitions of a fact that never varies: the card's time column, the grid block's
 * tray, the detail panel and the data-as-of line all call THIS function, so removing it here
 * removes it everywhere. One italic footnote at the page bottom carries it instead.
 *
 * DISPLAY_TIMEZONE in lib/config.js is untouched. The app still renders Eastern; it just says so
 * once rather than on every row.
 */
export function etTime(instant, kickoffStatus) {
  if (kickoffStatus === 'tbd' || !instant) return 'TBD';
  const d = new Date(instant);
  if (Number.isNaN(d.getTime())) return 'TBD';
  return TIME.format(d);
}

/** 'YYYY-MM-DD' -> 'Monday, August 31, 2026'. Day strings are calendar dates, formatted in UTC. */
export function longDay(day) {
  return day ? DAY_LONG.format(new Date(`${day}T00:00:00Z`)) : '';
}

/**
 * R8, prompt 56: the empty day's second sentence, from `nearestLoadedDay`'s answer.
 *
 * IT MUST NEVER BE ABLE TO ERROR. An empty state is the page a reader reaches when something has
 * already gone quiet; a throw there turns "nothing loaded" into a 500. So a null, a malformed
 * answer or a failed lookup all fall through to the generic line, which names no date and so
 * cannot go stale - which is the whole reason the six hardcoded dates came out.
 *
 * @param {{day: string, past: boolean}|null} nearest
 */
export function loadedDayLine(nearest) {
  const d = nearest && typeof nearest.day === 'string' ? longDay(nearest.day) : '';
  if (!d) return 'The database currently holds loaded days only.';
  return nearest.past
    ? `Nothing later is loaded — the most recent loaded day is ${d}.`
    : `The next loaded day is ${d}.`;
}

/** 'YYYY-MM-DD' -> 'Mon, Aug 31'. */
export function shortDay(day) {
  return day ? DAY_SHORT.format(new Date(`${day}T00:00:00Z`)) : '';
}

const WEEKDAY_LONG = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' });

/**
 * B4: the listings date stamp as TWO parts - { weekday: 'Wednesday', monthDay: 'Sep 2' }.
 *
 * shortDay() renders 'Wed, Sep 2' as one string, and in the card's 56px date column that wrapped
 * wherever it ran out of room - which put the bare day NUMBER on its own second line. Joe's ruling is
 * that the break should be deliberate and in the right place: the full weekday on line 1, the month
 * and date on line 2. Returning the parts rather than a joined string is what lets the card do that
 * without re-parsing a formatted date.
 *
 * shortDay() stays: /weeks still wants the one-line form for its day headings, where there is room.
 */
export function dayParts(day) {
  if (!day) return null;
  const d = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return null;
  return { weekday: WEEKDAY_LONG.format(d), monthDay: MONTH_DAY.format(d) };
}

/** 'Aug 29 - Sep 7, 2026' for a derived span. */
export function daySpanLabel(start, end) {
  if (!start) return '';
  if (!end || end === start) return `${MONTH_DAY.format(new Date(`${start}T00:00:00Z`))}, ${start.slice(0, 4)}`;
  return `${MONTH_DAY.format(new Date(`${start}T00:00:00Z`))} – ${MONTH_DAY.format(
    new Date(`${end}T00:00:00Z`)
  )}, ${end.slice(0, 4)}`;
}

/**
 * 'Mon Aug 24 - Sun Aug 30, 2026' - a span with the weekday on BOTH ends.
 *
 * A SIBLING rather than a change to daySpanLabel. All four of daySpanLabel's callers live in
 * weeks/page.js and all four want this form, so changing it in place would have compiled - but it is
 * exported and generically named, and silently changing what an exported formatter returns is how the
 * next surface gets a shape it never asked for. daySpanLabel keeps its en-dash bare-month form.
 *
 * DAY_SHORT already emits 'Mon, Aug 24' - weekday, month and day together - so this drops its comma
 * rather than composing a second month/day, which would have read 'Mon Aug 24 Aug 24'.
 */
export function daySpanWeekdays(start, end) {
  if (!start) return '';
  const one = (d) => DAY_SHORT.format(new Date(`${d}T00:00:00Z`)).replace(',', '');
  if (!end || end === start) return `${one(start)}, ${start.slice(0, 4)}`;
  return `${one(start)} - ${one(end)}, ${end.slice(0, 4)}`;
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

/**
 * THE RIGHT SLOT'S PRIORITY LADDER (contract v1.6.6).
 *
 * Pure, and deliberately not inline in the component: the ordering below is the whole point of this
 * function, and an ordering that lives in JSX can only be tested through a DOM.
 *
 * `fav` is passed IN rather than derived here - favourite() lives in MatchupCard.js, which imports
 * this module, so deriving it here would close a circular import for no gain.
 *
 * WHAT THIS FIXES. The shipped card ran score -> odds -> status, with the odds branch gated only on
 * `!score`. A postponed game has no score, so once odds were posted the card printed the moneyline
 * and never printed the postponement - and the status branch below it was unreachable. Zero games in
 * the loaded season are postponed, so it had never fired; it would have gone live on the first
 * rain-out. The locked reference (docs/design/mobile_demo.html, rcol()) already tested result_status
 * before odds; the shipped card had inverted it. Exceptions outrank odds.
 *
 * Rungs 1, 3 and 5 return a single row. The slot never reserves an empty one.
 */
/**
 * Row 2's size, in px. 17 normally; 15 when a three-digit score would otherwise widen the slot track.
 *
 * A three-digit score is the NBA and nothing else - every CFB, NFL, MLB and NHL final is two digits.
 * Measured in portrait, "116 - 104" needs 86.06px at 17px and 75.9px at 15px, so it is the one string
 * that pushed the fixed slot track past its next-widest content. Stepping it down one size is cheaper
 * than spending six permanent pixels of the matchup column on the widest score basketball can produce.
 */
export const ROW2_PX = { normal: 17, wide: 15 };

/**
 * Takes the two SCORES, not the rendered string. A regex for three digits over the string would also
 * catch a "-162" moneyline, which is 40px at 17px and never crowded anything - only a three-digit
 * SCORE, which is "116 - 104", is wide enough to matter.
 */
export function row2Size(awayScore, homeScore) {
  const wide = [awayScore, homeScore].some((v) => Number.isFinite(Number(v)) && Math.abs(Number(v)) >= 100);
  return wide ? ROW2_PX.wide : ROW2_PX.normal;
}

/**
 * THE FAVOURITE'S OWN LINE FOR ROW 2 - the point spread, falling back to the moneyline.
 *
 * Joe's ruling: the right rail shows the POINT SPREAD, not the moneyline, with the favourite's mark
 * above it. The mark stays in the right rail only; the matchup keeps away-on-top and does not
 * reorder.
 *
 * `game_odds.spread` IS HOME-RELATIVE - negative means the home side is favoured (`0003_games.sql`).
 * So a home favourite reads its own number and an away favourite reads the negation: at spread
 * +7.5 the away side is favoured by 7.5 and its line is `-7.5`. THE SIGN IS ALWAYS NEGATIVE FOR THE
 * FAVOURITE, because that is what a spread means.
 *
 * THE MONEYLINE IS THE FALLBACK, not a legacy path (Joe's ruling). MLB is usually priced on the
 * moneyline and the run line, so this is the common route there rather than an edge case, and
 * nothing renders blank where a number exists.
 *
 * AND IT FALLS BACK WHEN THE TWO SOURCES DISAGREE ABOUT WHO IS FAVOURED, which is not hypothetical:
 * measured 2026-09-08 over 119 rows, SEVEN disagree - all MLB near-pick'ems where the moneyline has
 * home by four cents (-110 / -106) while the run line has home at +1.5, i.e. the underdog by runs.
 * `favourite()` picks the side from the moneylines first, so on those rows the spread belongs to the
 * OTHER team and would render as a positive number beside the favourite's mark. A `+3.5` under a
 * favourite's badge is a card that contradicts itself; the moneyline that chose the side is shown
 * instead.
 *
 * A PICK'EM IS NOT A FAVOURITE and never reaches here - `favourite()` returns null at spread 0.
 */
function favLine(fav) {
  const sp = Number(fav.odds?.spread);
  if (Number.isFinite(sp) && sp !== 0) {
    const own = fav.side === 'home' ? sp : -sp;
    if (own < 0) return String(own);
  }
  return fav.ml === null || !Number.isFinite(Number(fav.ml))
    ? '-'
    : (fav.ml > 0 ? `+${fav.ml}` : String(fav.ml));
}

export function slotContent(game, fav = null) {
  const status = game?.result_status ?? null;

  // 1. An exception outranks everything, odds included.
  if (status === 'postponed' || status === 'cancelled') {
    return { kind: 'exception', markSide: null, tied: false, row2: null, row2Px: ROW2_PX.normal,
             row3: resultLabel(game), tone: 'sched' };
  }

  // 1b. In progress, but hours past any plausible finish. It must not keep claiming LIVE, and it must
  //     not show the score either, because a stale row's score is a MID-GAME SNAPSHOT rather than a
  //     partial-looking final. When the twelve were reconciled on 2026-09-04 all twelve stored scores
  //     turned out wrong, and not only the three reading 0 - 0: Mariners at Red Sox was stored 9 - 1
  //     and finished 9 - 6. Suppressing every stale score, not just the empty-looking ones, is what
  //     made this guard right rather than lucky. One quiet row, no number.
  if (isStaleLive(game)) {
    return { kind: 'stale', markSide: null, tied: false, row2: null, row2Px: ROW2_PX.normal,
             row3: 'Final pending', tone: 'sched' };
  }

  // 2. A played or playing game with both numbers. hasScore reads game.result_status directly, so
  //    it is guarded here rather than made null-safe there - every other caller passes a game.
  if (game && hasScore(game)) {
    const a = game.away_score;
    const h = game.home_score;
    const tied = a === h;
    const tone = status === 'final' ? 'final' : 'live';
    return {
      kind: 'score',
      // The WINNER's mark, not the home side's. Null when level - the row carries the word TIED.
      markSide: tied ? null : (h > a ? 'home' : 'away'),
      tied,
      // Higher number first, whichever side that is. When level the numbers are the same, so the
      // away-home order is kept rather than reversed for no reason.
      row2: tied ? `${a} - ${h}` : `${Math.max(a, h)} - ${Math.min(a, h)}`,
      row2Px: row2Size(a, h),
      row3: resultLabel(game),
      tone,
    };
  }

  // 3. Playing, but the provider has not sent numbers yet.
  if (status === 'in_progress') {
    return { kind: 'live', markSide: null, tied: false, row2: null, row2Px: ROW2_PX.normal,
             row3: resultLabel(game), tone: 'live' };
  }

  // 4. Scheduled, with a line. Restacked to the same three rows as a score, so a mixed Saturday does
  //    not alternate between two silhouettes in the same column.
  if (status === 'scheduled' && fav) {
    const total = fav.odds?.total;
    return {
      kind: 'odds',
      markSide: fav.side,
      tied: false,
      row2: favLine(fav),
      // NEITHER LINE NEEDS THE STEP-DOWN, and the spread is the narrower of the two. The widest
      // moneyline, "-1200", is 54.95px at 17px. The widest favourite-spread in the data is "-49.5"
      // - the same five characters, but one of them is a full stop, which is narrower than a digit.
      // Measured rather than inherited from that claim: see prompt 63's report.
      row2Px: ROW2_PX.normal,
      row3: total != null ? `O/U ${Number(total)}` : null,
      tone: 'sched',
    };
  }

  // 5. Everything else - about four future games in five. The dash replaces the word "Sched", which
  //    restated what the gold kickoff time two columns to the left already said.
  return { kind: 'none', markSide: null, tied: false, row2: null, row2Px: ROW2_PX.normal,
           row3: '—', tone: 'none' };
}


/**
 * A game cannot be LIVE indefinitely.
 *
 * Twelve MLB rows sat at result_status='in_progress' with kickoffs on 2026-09-01, so the card claimed
 * LIVE for days. Those twelve were reconciled against statsapi on 2026-09-04
 * (scripts/backfill_stale_finals.py) and are all `final` now, so this guard currently catches nothing.
 * IT STAYS ANYWAY: it is the display's answer to a class of pipeline failure, not to those twelve rows,
 * and the next dropped status update will need it before anyone notices the data.
 *
 * THE THRESHOLD IS NOT MEASURED FROM completed_at, and the brief's suggestion to do that does not
 * survive contact with the column. completed_at is the PIPELINE's write timestamp, not the moment the
 * game ended: across the loaded finals it reads 70.64-80.64 hours for CFB and up to 26.37 for MLB,
 * which are refresh lags, not games. Its MLB minimum, 2.99 hours, is the only figure in it that looks
 * like a real ball game.
 *
 * So the cut comes from the sport instead, with margin: the longest MLB games on record run about
 * seven hours, and a weather-delayed football game reaches six. EIGHT HOURS clears both and caught the
 * twelve stale rows by a factor of six - they were more than 48 hours past kickoff.
 */
export const STALE_LIVE_HOURS = 8;

export function isStaleLive(game, now = Date.now()) {
  if (game?.result_status !== 'in_progress') return false;
  const t = Date.parse(game?.canonical_kickoff_at_utc ?? '');
  if (!Number.isFinite(t)) return false;   // no kickoff is not evidence of staleness
  return now - t > STALE_LIVE_HOURS * 3600 * 1000;
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
