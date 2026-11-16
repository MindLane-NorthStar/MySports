// SMOKE (i): SUNDAY'S REGIONAL WINDOWS WERE DECIDED BY THURSDAY (prompt 132 block C, Joe approved
// 2026-11-16 with the threshold "Thursday"; register §77).
//
// WHY IT EXISTS. On 2026-11-01 EntitledSports changed its market blocks from four windows to three; the
// windows reader (adapters/es_windows.py) dropped every week as a page error, by design wrote no file and
// exited 0, and every regional CBS/FOX game fell to rule 6, UNVERIFIED - shown as MARKET TBD. Nothing
// went red for NINE DAYS: Joe found it on his phone (prompt 131). Prompt 131 fixed the reader and put its
// result in `refresh_runs.notes`; this is the alarm it named and left for Joe's threshold.
//
// THE RULE. For the coming Sunday (today, on a Sunday), take every active CBS or FOX row on an NFL game
// kicking off in the Sunday-afternoon regional window - the SAME 12:00-17:00 ET window as rule 1,
// adapters/espn.py SUNDAY_WINDOW, so the national telecasts outside it (a London morning, Sunday night)
// are excluded exactly as the adapter excludes them. RED when it is Thursday or later in ET AND there is
// at least one such row AND EVERY ONE of them is still `unverified`.
//
//   * THURSDAY: the maps post Tuesday or Wednesday. Monday to Wednesday an all-unverified Sunday is
//     simply early; from Thursday it means the source failed again. Sunday counts as "later".
//   * ALL, NOT ANY: one row still unverified is a normal state - a late window the page itself marks
//     TBD, a game the listings have not reached. ALL of them unverified is the outage's signature.
//   * THE MARKET'S OWN CLUB'S GAME IS LEFT OUT, and without that the check could never fire. Rule 3
//     decides the Browns' game from the team alone, with no windows source at all, so on 2026-11-01 and
//     -08 the regional rows read 1 available and 10 unverified - "all unverified" was false on both
//     outage Sundays. The rows this check reads are the ones rule 4b exists to decide: 10 of 10.
//   * NO ROWS IS GREEN: a Sunday not yet loaded is not this check's failure to report.
//
// WHAT IT CANNOT NAME. The brief asked for the reader's last `nfl_windows` result in the red message "if
// that read is cheap". It is not available at all: `refresh_runs` is unreadable by the anon key on purpose
// (lib/rest.js:4-6; smoke check (d) asserts it), so the message points at where the cause is recorded.

import { addDays } from './weeks.js';

/** adapters/espn.py SUNDAY_WINDOW - kickoffs at or after 12:00 and before 17:00 ET. Pinned to it by test. */
export const SUNDAY_WINDOW_ET = [12, 17];
/** ISO weekday (Mon 1 .. Sun 7) from which an all-unverified Sunday is red: Thursday, Joe 2026-11-16. */
export const THRESHOLD_ISO_WEEKDAY = 4;
export const REGIONAL_SERVICES = ['cbs', 'fox'];

/** ISO weekday of a YYYY-MM-DD calendar day: Monday 1 .. Sunday 7. */
export function isoWeekday(day) {
  const [y, m, d] = String(day).split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();     // 0 Sunday .. 6 Saturday
  return wd === 0 ? 7 : wd;
}

/** The Sunday this check is about: today if today is Sunday, else the next one. */
export function comingSunday(today) {
  return addDays(today, 7 - isoWeekday(today));
}

/** ET hour and ET weekday of an instant. */
function etParts(instant) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23', weekday: 'short' });
  const parts = Object.fromEntries(f.formatToParts(new Date(instant)).map((p) => [p.type, p.value]));
  return { hour: Number(parts.hour), weekday: parts.weekday };
}

/** Rule 1's test, the same as adapters/espn.py sunday_afternoon_window. */
export function inSundayWindow(instant) {
  if (!instant) return false;
  const { hour, weekday } = etParts(instant);
  return weekday === 'Sun' && hour >= SUNDAY_WINDOW_ET[0] && hour < SUNDAY_WINDOW_ET[1];
}

/**
 * The regional rows: active CBS/FOX rows on the given games that kick off in the window.
 * @param {Array<{id: string, canonical_kickoff_at_utc: string}>} games
 * @param {Array<{game_id: string, service_id: string, access_status: string, active?: boolean}>} rows
 */
export function regionalRows(games, rows) {
  const inWindow = new Set((games || []).filter((g) => inSundayWindow(g.canonical_kickoff_at_utc)).map((g) => g.id));
  return (rows || []).filter((b) => b && b.active !== false && inWindow.has(b.game_id)
    && REGIONAL_SERVICES.includes(String(b.service_id || '').toLowerCase()));
}

/**
 * The verdict over the regional rows of every game EXCEPT the market's own club's (`localGameIds`), which
 * rule 3 decides without the windows - see the header. `decided` counts the rows that are not `unverified`.
 */
export function sundayWindowsVerdict(today, games, rows, localGameIds = []) {
  const sunday = comingSunday(today);
  const local = new Set(localGameIds);
  const regional = regionalRows(games, rows).filter((b) => !local.has(b.game_id));
  const unverified = regional.filter((b) => b.access_status === 'unverified').length;
  const past = isoWeekday(today) >= THRESHOLD_ISO_WEEKDAY;
  const red = past && regional.length > 0 && unverified === regional.length;
  return { sunday, past, regional: regional.length, unverified, decided: regional.length - unverified, red };
}
