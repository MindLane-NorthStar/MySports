// D1: the Today page's first band, and the ONE place its state is derived.
//
// 05-home-page-decisions.md D1 has been ruled since prompt 20 and unconsumed since. Three states,
// chosen by where the clock sits relative to the viewing day's prime window:
//
//   before the window opens   TONIGHT          the games from the window onward
//   inside it                 ON NOW / NEXT UP in-progress games, then the next kickoffs
//   after the last game ends  FINALS · TOMORROW today's finals, then tomorrow's first games
//
// WHY IT IS A MODULE AND NOT A COMPONENT. The header line has to be true at render time and the
// state has to be pinned by fixtures that a Python renderer can read later (contract v1.7 §11.9's
// Tonight line is the same question asked of the same day), so the derivation takes `now` as an
// ARGUMENT and returns data. No Date.now() inside, no clock, no fetch, no React. That is also what
// makes the hydration story simple: the server computes this once from the request time and hands
// the result down as props, and the client does not recompute it until M11's 15-minute refresh.
//
// TWO TRAPS PROMPT 42 FELL INTO AND CLIMBED OUT OF, both of which a time-aware band invites:
//   * a useLayoutEffect/useEffect swap keyed on `typeof window` produced exactly the hydration
//     mismatch React refuses to patch, and the cards froze at their server sizes;
//   * gating the first paint on document.fonts.ready left seconds of wrong sizes on an 80-card page.
// Neither is possible here, because nothing in this file runs on the client at all.

import { primeWindow, kickoffMinutes } from './primewindow.js';

/** The three states, as the strings the component and the tests both use. */
export const BAND_STATES = ['tonight', 'live', 'finals'];

// THE VIEWING DAY RUNS TO 03:00 ET, exactly as gridmodel.js's viewingMinutes has it: a 10:40pm tip
// and its 12:30am finish are the same evening. Every minute-of-day in this module goes through here,
// so 00:30 reads as 1470 rather than 30 - otherwise a band asked at half past midnight would compare
// 30 against a 12:00 window opening and conclude the day had not started yet.
const CUTOVER_MIN = 3 * 60;

function pastCutover(mins) {
  return mins === null ? null : (mins < CUTOVER_MIN ? mins + 24 * 60 : mins);
}

/** Minutes into the VIEWING day for `now`. */
function nowMinutes(now, timeZone = 'America/New_York') {
  const d = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === 'hour')?.value);
  const m = Number(parts.find((p) => p.type === 'minute')?.value);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return pastCutover(h * 60 + m);
}

/** A game's kickoff, on the same viewing-day clock. */
function kickMinutes(game, timeZone) {
  return pastCutover(kickoffMinutes(game, timeZone));
}

/** `9:14 PM` - the clock the header states, in the same zone every other time on the page uses. */
export function clockLabel(now, timeZone = 'America/New_York') {
  const d = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', {
    timeZone, hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(d).replace(/ /g, ' ');
}

const LIVE_STATES = new Set(['in_progress', 'live']);
const FINAL_STATES = new Set(['final', 'completed']);

const isLive = (g) => LIVE_STATES.has(String(g?.result_status || '').toLowerCase());
const isFinal = (g) => FINAL_STATES.has(String(g?.result_status || '').toLowerCase());

/**
 * The band's state, its header text and the games it shows.
 *
 * R9, prompt 56: THE HEADING IS THE CLOCK ALONE - `as of 7:12 PM`.
 *
 * It read `${dayLabel} · ${clock} ET` - "Friday, September 4, 2026 · 7:12 PM ET" - and prompt 46
 * recorded Joe reconfirming that, because at the time the page heading read the bare word DATE and
 * this band was the only place the viewing day was spelled out. THAT IS NO LONGER TRUE: prompt 50
 * retired the DATE heading and the picker two rows above now shows the date in exactly those words,
 * so the band was repeating what the reader had just read. Joe approved dropping the day half on
 * 2026-09-06 and keeping the clock, which is the part a band that changes with the time must state.
 *
 * NO " ET" EITHER. Prompt 31 took that suffix off every clock in the app and the footnote in
 * layout.js carries it once; this string was the one place it survived, and reintroducing it here
 * would put the duplicate back.
 *
 * `dayLabel` IS GONE WITH IT. It fed nothing else, and a parameter callers keep passing that
 * nothing reads is the exact shape of the `sectionLabel` fault R4 cleaned up in the same run.
 *
 * @param {Array}  games     today's games, already the rows the page renders
 * @param {Date}   now       the request time - ALWAYS passed, never read from the clock here
 * @param {object} policy    render_policies (web/lib/policies.js), for prime_window_start
 * @param {object} opts      { tomorrow, timeZone }
 * @returns {{state, heading, rows, empty}}
 */
export function bandState(games, now, policy, { tomorrow = [], timeZone = 'America/New_York' } = {}) {
  const rows = Array.isArray(games) ? games : [];
  const win = primeWindow(rows, { policy, timeZone });
  const mins = nowMinutes(now, timeZone);
  const clock = clockLabel(now, timeZone);
  const heading = clock ? `as of ${clock}` : null;

  // E10: a day with no games says so. It does not pretend to be Tonight. (It named the day too
  // until R9; the picker two rows above says which day this is.)
  if (rows.length === 0) {
    return { state: 'tonight', heading, rows: [], empty: true };
  }

  const opens = win ? hhmmToMinutes(win.opensAt) : null;
  // primeWindow reports closesAt as a wall clock, so a 20:20 kickoff with a 210-minute block closes
  // at 23:50 but a 22:00 one closes at "01:00" - which is 60, not 1500, until the cutover is applied.
  let closes = pastCutover(win ? hhmmToMinutes(win.closesAt) : null);
  // AND THE CUTOVER IS NOT ENOUGH ON ITS OWN, which a UFC card is what found. `pastCutover` only
  // lifts a value BEFORE 03:00, so a day whose last program ends at exactly 03:00 or later comes
  // back as 180 or 240 - a number smaller than the window's own opening. A window cannot close
  // before it opens, so that is a wrap, and it is read as one. Measured: UFC 331 starts at 9 PM
  // with a 360-minute block, closes at "03:00", and the band decided the evening was already over
  // and rendered "Nothing loaded for this viewing day yet" over a card that had not started.
  if (closes !== null && opens !== null && closes < opens) closes += 24 * 60;

  const live = rows.filter(isLive);
  const finals = rows.filter(isFinal);

  // AFTER THE LAST GAME: today is over, so the band stops being about today.
  if (closes !== null && mins !== null && mins >= closes && live.length === 0) {
    return {
      state: 'finals',
      heading,
      rows: [...finals, ...upcoming(tomorrow, timeZone)],
      empty: finals.length === 0 && tomorrow.length === 0,
    };
  }

  // INSIDE THE WINDOW: whatever is on, then whatever is next.
  if (opens !== null && mins !== null && mins >= opens) {
    const notStarted = rows
      .filter((g) => !isLive(g) && !isFinal(g))
      .filter((g) => {
        const k = kickMinutes(g, timeZone);
        return k === null || k >= mins;
      });
    return { state: 'live', heading, rows: [...live, ...byKickoff(notStarted, timeZone)], empty: live.length === 0 && notStarted.length === 0 };
  }

  // BEFORE IT OPENS: the evening, from the window onward.
  const fromWindow = rows.filter((g) => {
    const k = kickMinutes(g, timeZone);
    return k === null || opens === null || k >= opens;
  });
  return { state: 'tonight', heading, rows: byKickoff(fromWindow, timeZone), empty: fromWindow.length === 0 };
}

function hhmmToMinutes(hhmm) {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm).trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function byKickoff(rows, timeZone) {
  return [...rows].sort((a, b) => {
    const ka = kickMinutes(a, timeZone);
    const kb = kickMinutes(b, timeZone);
    if (ka === null && kb === null) return 0;
    if (ka === null) return 1;          // a TBD kickoff sorts last, never first
    if (kb === null) return -1;
    return ka - kb;
  });
}

function upcoming(rows, timeZone) {
  return byKickoff((Array.isArray(rows) ? rows : []).filter((g) => !isFinal(g)), timeZone);
}

/**
 * The label the band's own heading uses for each state.
 *
 * ALL THREE WERE RENAMED AS A SET, prompt 56, Joe's ruling of 2026-09-06. He asked for one and then
 * ruled that all three should match rather than leaving two different connectors doing one job:
 *
 *   tonight  Tonight            -> Tonight            (unchanged - it never had a connector)
 *   live     On now · Next up   -> Live & Upcoming
 *   finals   Finals · Tomorrow  -> Finals & Tomorrow
 *
 * THIS SUPERSEDES 05 §D1b's wording, which named the states `On now / Next up` and `Finals ·
 * Tomorrow`. The three STATES are unchanged and are still exactly the three D1b specced - only what
 * they are called. The feature study and the prompt archive still quote the old names, correctly:
 * they record what was decided when, and the register carries the supersession.
 */
export const BAND_TITLE = {
  tonight: 'Tonight',
  live: 'Live & Upcoming',
  finals: 'Finals & Tomorrow',
};
