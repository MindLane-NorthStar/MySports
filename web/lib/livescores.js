// Live score overlay — READ ONLY, and narrow on purpose.
//
// It reads exactly THREE things per game from the providers: state, score, and clock/period. It is
// not a second adapter. Teams, venues, broadcasts, odds, records, eligibility and reconciliation all
// still come from the database, which stays the source of truth for everything except the in-flight
// score. Nothing here is ever persisted — no database connection, no writer credential, no DML. That
// is the shape of the amended D3 (docs/feature-study/05-home-page-decisions.md §6, 2026-09-03):
// the page overlays what the providers say right now on top of what the database already holds.
//
// FAIL OPEN IS THE WHOLE CONTRACT. Any provider error, timeout, HTTP failure or malformed payload
// yields NO overlay for that sport and one logged line. A provider being down must never blank a
// card, throw, or fail the page render — the page renders from the database regardless, and the
// overlay is purely additive. Every exported function returns a value; none of them reject.
//
// UA: the honest project string adapters/common.py sends, never a browser UA. On 2026-09-03 the
// Actions run on the honest UA fetched NFL, NBA and CFB cleanly, and the very next run — identical
// except for a Chrome UA — took a 403 on its first ESPN call (run 33673744218). Akamai scores a
// Chrome UA arriving without the headers a real Chrome sends as a spoofing client. Half a disguise is
// worse than none.

export const USER_AGENT = 'MySports-adapters/0.1 (+https://github.com/MindLane-NorthStar/MySports)';

const REVALIDATE_SECONDS = 60;
const TIMEOUT_MS = 6000;

// ---------------------------------------------------------------- the mapping, ported exactly
//
// This is a PORT of adapters/common.py's _PROVIDER_STATE / result_status / score_int, not a
// reinterpretation of them. web/test/livescores.test.mjs asserts it against the same recorded
// fixtures tests/test_scores.py uses, so the two readers cannot silently disagree about a payload.

const PROVIDER_STATE = {
  pre: 'scheduled', in: 'in_progress', post: 'final',                    // ESPN status.type.state
  FUT: 'scheduled', PRE: 'scheduled', LIVE: 'in_progress',               // NHL gameState
  CRIT: 'in_progress', FINAL: 'final', OFF: 'final',
  Preview: 'scheduled', Live: 'in_progress', Final: 'final',             // MLB abstractGameState
};

function titleCase(s) {
  return s.length ? s[0].toUpperCase() + s.slice(1).toLowerCase() : s;
}

/**
 * Provider state -> result status. Postponed/cancelled in `detail` WINS over `state`.
 *
 * Fail honest: a state this table does not know maps to null with one warning, and is NEVER guessed
 * to 'final'. A wrong 'final' is the specific failure this mapping exists to prevent — downstream it
 * freezes completed_at and a boxscore link on a game that has not been played.
 */
export function resultStatus(state, { detail = null, context = '' } = {}) {
  const d = String(detail ?? '').toUpperCase();
  if (d.includes('POSTPONE')) return 'postponed';
  if (d.includes('CANCEL')) return 'cancelled';     // ESPN spells it CANCELED, MLB Cancelled
  if (state === null || state === undefined) return null;
  const key = String(state).trim();
  const mapped = PROVIDER_STATE[key] ?? PROVIDER_STATE[key.toUpperCase()] ?? PROVIDER_STATE[titleCase(key)] ?? null;
  if (mapped === null) {
    console.warn(`  warn: unrecognized provider status ${JSON.stringify(state)}` +
      `${context ? ` (${context})` : ''} - status left null`);
  }
  return mapped;
}

/** Scores only exist once a game is under way; ESPN sends the string '0' on scheduled games. */
export function scoreInt(value, status) {
  if (status !== 'in_progress' && status !== 'final') return null;
  if (value === null || value === undefined || value === '') return null;
  const n = Number.parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
}

// ---------------------------------------------------------------- per-sport readers
//
// cfb, nfl and nba share ESPN's scoreboard shape, so that reader is written once. nhl and mlb each
// get their own because their payloads are genuinely different.

const ESPN_PATH = {
  cfb: 'football/college-football',
  nfl: 'football/nfl',
  nba: 'basketball/nba',
};

/** ESPN ids: cfb keeps ESPN's bare integer (CFBD ids ARE ESPN ids); every other league is namespaced. */
function espnGameId(sport, eventId) {
  return sport === 'cfb' ? String(eventId) : `${sport}-${eventId}`;
}

export function readEspnScoreboard(payload, sport) {
  const events = Array.isArray(payload?.events) ? payload.events : [];
  const out = [];
  for (const ev of events) {
    const comp = (ev.competitions || [])[0] || {};
    const type = (ev.status || comp.status || {}).type || {};
    const status = resultStatus(type.state, { detail: type.name || type.description || '', context: `espn ${sport}` });
    const sides = {};
    for (const c of comp.competitors || []) sides[c.homeAway] = c;
    const st = ev.status || comp.status || {};
    out.push({
      gameId: espnGameId(sport, ev.id),
      status,
      homeScore: scoreInt(sides.home?.score, status),
      awayScore: scoreInt(sides.away?.score, status),
      clock: st.displayClock ?? null,
      period: st.period ?? null,
    });
  }
  return out;
}

export function readNhlSchedule(payload) {
  // api-web returns gameWeek[] -> games[]; a single-day payload may carry games[] directly.
  const days = Array.isArray(payload?.gameWeek) ? payload.gameWeek : [];
  const games = days.length ? days.flatMap((d) => d.games || []) : (payload?.games || []);
  return games.map((g) => {
    const status = resultStatus(g.gameState, { context: `nhl ${g.id}` });
    return {
      gameId: `nhl-${g.id}`,
      status,
      homeScore: scoreInt(g.homeTeam?.score, status),
      awayScore: scoreInt(g.awayTeam?.score, status),
      clock: g.clock?.timeRemaining ?? null,
      period: g.periodDescriptor?.number ?? null,
    };
  });
}

export function readMlbSchedule(payload) {
  const dates = Array.isArray(payload?.dates) ? payload.dates : [];
  const out = [];
  for (const d of dates) {
    for (const g of d.games || []) {
      const s = g.status || {};
      const status = resultStatus(s.abstractGameState, {
        detail: `${s.detailedState ?? ''} ${s.codedGameState ?? ''}`,
        context: `mlb ${g.gamePk}`,
      });
      const ls = g.linescore || {};
      out.push({
        gameId: `mlb-${g.gamePk}`,
        status,
        homeScore: scoreInt(g.teams?.home?.score, status),
        awayScore: scoreInt(g.teams?.away?.score, status),
        clock: ls.inningHalf ?? null,
        period: ls.currentInning ?? null,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------- fetching
//
// Next's fetch cache with revalidate:60 means rapid reloads share ONE upstream call. That is both a
// courtesy to the providers and the thing that keeps a refresh-on-open page from behaving like a
// poller.

const SOURCES = {
  cfb: { url: () => `https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH.cfb}/scoreboard`, read: (p) => readEspnScoreboard(p, 'cfb') },
  nfl: { url: () => `https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH.nfl}/scoreboard`, read: (p) => readEspnScoreboard(p, 'nfl') },
  nba: { url: () => `https://site.api.espn.com/apis/site/v2/sports/${ESPN_PATH.nba}/scoreboard`, read: (p) => readEspnScoreboard(p, 'nba') },
  nhl: { url: () => 'https://api-web.nhle.com/v1/schedule/now', read: readNhlSchedule },
  mlb: { url: () => 'https://statsapi.mlb.com/api/v1/schedule?sportId=1', read: readMlbSchedule },
};

/** One sport. Returns [] on ANY failure, after logging one line. Never throws, never rejects. */
export async function fetchSport(sport, { fetchImpl = fetch } = {}) {
  const src = SOURCES[sport];
  if (!src) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(src.url(), {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      console.warn(`  warn: livescores ${sport} HTTP ${res.status} - no overlay for this sport`);
      return [];
    }
    const payload = await res.json();
    const rows = src.read(payload);
    return Array.isArray(rows) ? rows.filter((r) => r && r.gameId) : [];
  } catch (e) {
    // Includes abort/timeout, network failure, and malformed JSON. All of them mean the same thing
    // to the page: no overlay for this sport, and the database's own values stand.
    console.warn(`  warn: livescores ${sport} failed (${e?.name ?? 'Error'}: ${String(e?.message ?? e).slice(0, 160)}) - no overlay`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Should we fetch at all?
 *
 * Only for TODAY, and only for sports that actually have a game on the requested day. A page for a
 * past date, the History page, or a day with no games in a sport asks the providers nothing — there
 * is no live state to learn, and an unnecessary call is a bot-score cost for no benefit.
 */
export function sportsWorthFetching(day, games, today) {
  if (!day || !today || day !== today) return [];
  const present = new Set();
  for (const g of games || []) {
    if (!g?.sport || !SOURCES[g.sport]) continue;
    // A final game needs no overlay; a scheduled or in-progress one might.
    if (g.result_status === 'final' || g.result_status === 'postponed' || g.result_status === 'cancelled') continue;
    present.add(g.sport);
  }
  return [...present];
}

/**
 * The overlay for one day, as a Map keyed by games.id.
 *
 * Returns { map, fetchedAt, sports, stats } — `stats` is per-sport { returned, joined, unjoined } so
 * a drifting id scheme shows up as a number instead of as cards that quietly never go live.
 */
export async function overlayForDay(day, games, { today = null, fetchImpl = fetch } = {}) {
  const empty = { map: new Map(), fetchedAt: null, sports: [], stats: {} };
  try {
    const sports = sportsWorthFetching(day, games, today);
    if (!sports.length) return empty;

    const known = new Set((games || []).map((g) => String(g.id)));
    const settled = await Promise.all(sports.map((s) => fetchSport(s, { fetchImpl })));

    const map = new Map();
    const stats = {};
    sports.forEach((sport, i) => {
      const rows = settled[i] || [];
      let joined = 0;
      for (const r of rows) {
        if (known.has(String(r.gameId))) {
          map.set(String(r.gameId), r);
          joined += 1;
        }
      }
      stats[sport] = { returned: rows.length, joined, unjoined: rows.length - joined };
    });
    return { map, fetchedAt: new Date().toISOString(), sports, stats };
  } catch (e) {
    // Belt and braces: nothing above should throw, and if it somehow does the page still renders.
    console.warn(`  warn: livescores overlay failed entirely (${e?.name ?? 'Error'}) - rendering from the database only`);
    return empty;
  }
}

/**
 * Merge the overlay onto database rows. The database stays authoritative for everything the overlay
 * does not carry, and a null from the overlay never overwrites a value the database already has.
 */
export function applyOverlay(games, overlayMap) {
  if (!overlayMap || overlayMap.size === 0) return games || [];
  return (games || []).map((g) => {
    const o = overlayMap.get(String(g.id));
    if (!o || !o.status) return g;
    return {
      ...g,
      result_status: o.status,
      home_score: o.homeScore ?? g.home_score,
      away_score: o.awayScore ?? g.away_score,
      live_clock: o.clock ?? null,
      live_period: o.period ?? null,
      live: true,
    };
  });
}
