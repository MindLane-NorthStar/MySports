// D2: the prime viewing window for one day.
//
// PURE. No fetch, no clock, no database - the day's games and the policy go in, a window comes out.
// Nothing consumes this yet; prompt 21's time-adaptive band does. Shipping the policy settled and
// tested first is deliberate, so the band prompt is pure layout and not layout plus a policy argument.
//
// The window is DERIVED, never stored:
//
//   opensAt   the EARLIEST prime_window_start among the sports that actually have a game that day.
//             A Saturday with college football opens at noon; a Tuesday with only baseball opens at
//             six; a Sunday with both NFL and CFB opens at noon, because CFB is the earlier of the two.
//   closesAt  the last program end on the day - each game's kickoff plus that sport's block_minutes,
//             maximised. It is the real end of the slate, not a nominal hour.
//
// NO GAMES THAT DAY RETURNS null, not a default window. A default would be a lie the band would then
// render: "prime time" for an evening with nothing in it. The caller decides what to show for null.
//
// THE POLICY IS INJECTED, never imported here. Two reasons. It keeps this module genuinely pure - no
// filesystem, no bundler magic, testable under plain `node --test` where a bare JSON import is a hard
// error (Node ESM demands `with { type: 'json' }`). And it matches the signature D2 asks for: "given a
// day's games and the policy". App code gets the default from web/lib/policies.js, which does the one
// JSON import in the place Next already handles it.

/** 'HH:MM' -> minutes since local midnight. Returns null for anything malformed. */
export function parseHHMM(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** minutes since midnight -> 'HH:MM', zero-padded. */
export function formatHHMM(minutes) {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return null;
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * @param {Array} games  rows carrying at least { sport }, and for closesAt a kickoff instant
 * @param {object} opts  { policy, timeZone } - `policy` is REQUIRED (see web/lib/policies.js)
 * @returns {{opensAt: string, closesAt: string|null, sports: string[]}|null}
 */
export function primeWindow(games, { policy, timeZone = 'America/New_York' } = {}) {
  if (!policy) return null;
  const rows = Array.isArray(games) ? games : [];
  const sports = [...new Set(rows.map((g) => g?.sport).filter((s) => s && policy[s]))].sort();
  if (sports.length === 0) return null;

  let opensMin = null;
  for (const s of sports) {
    const v = parseHHMM(policy[s]?.prime_window_start);
    if (v === null) continue;                       // a sport with no policy simply does not vote
    opensMin = opensMin === null ? v : Math.min(opensMin, v);
  }
  if (opensMin === null) return null;

  let closesMin = null;
  for (const g of rows) {
    const pol = policy[g?.sport];
    if (!pol) continue;
    const start = kickoffMinutes(g, timeZone);
    if (start === null) continue;                   // a TBD kickoff cannot extend the window
    const end = start + Number(pol.block_minutes || 0);
    closesMin = closesMin === null ? end : Math.max(closesMin, end);
  }

  return { opensAt: formatHHMM(opensMin), closesAt: formatHHMM(closesMin), sports };
}

/** A game's kickoff as minutes since local midnight in `timeZone`, or null when it has none. */
export function kickoffMinutes(game, timeZone = 'America/New_York') {
  const iso = game?.canonical_kickoff_at_utc ?? game?.startDate ?? null;
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === 'hour')?.value);
  const m = Number(parts.find((p) => p.type === 'minute')?.value);
  return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
}
