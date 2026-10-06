// THE ADDRESS ANOTHER APP READS JOE'S GAMES FROM (prompt 127, Joe's ruling 2026-10-05).
//
// MyDash draws small score boxes for Joe's own teams. It reads the games from MySports'
// `/api/my-games` and works out nothing for itself, so every field here is what the list card
// shows, taken from the card's own functions - `cardName`, `cardMark`, `slotContent`, `etTime`'s TBD
// test, `isPlaceholderTeam` - and no rule is restated (rule 32). app/api/my-games/route.js does the
// reads and calls these two.
//
// PURE: neither reads a file or the network, so `node --test` runs them on fixture rows. The one
// clock read is the card's own, inside `slotContent` (`isStaleLive`, lib/format.js). The favourite
// ids are passed in, as lib/favorites.js takes them, because a bare JSON import fails under
// `node --test`.
//
// WHAT THE ANSWER DOES NOT CARRY, on purpose: odds, programs, and whether Joe can watch (off-service,
// market pending, network TBD - lib/offservice.js). The last is Joe's call for another day.

import { isFavorite, chronological } from './favorites.js';
import { applyOverlay } from './livepoll.js';
import { etTime, slotContent } from './format.js';
import { teamLogoDarkUrl } from './config.js';
import { isPlaceholderTeam } from './placeholders.js';
import { cardName } from './cardname.js';
import { cardMark, broadcastName } from './cardbroadcast.js';

/**
 * The current viewing day and the seven after it: eight viewing days.
 *
 * THE FIRST DAY IS THE VIEWING DAY, NOT THE PAGE'S CALENDAR "TODAY". A game is filed under its viewing
 * day, which changes at 03:00 ET, while the page's today (`todayET()`) changes at midnight - so from
 * midnight to 3 AM the page gives a late game still in progress no live score. A score box would
 * lose a West Coast game at midnight, mid-play. The route takes its day from `viewingDayOf()`
 * (lib/programs.js), the app's own 3 AM rule; the page is unchanged, and docs/queue.md describes it.
 */
export const DAYS_AHEAD = 7;

/**
 * The rows the live overlay is handed: Joe's teams' games on `today`, and nothing else.
 *
 * As the week page hands it `grouped[today]` (app/page.js): `sportsWorthFetching` collects every sport
 * with an unfinished row among the games it is given, so the whole range would ask the NHL about
 * Friday's game on a day with no NHL game in it.
 */
export function overlayRows(rows, favIds, today) {
  return (rows || []).filter((g) => g.viewing_day === today && isFavorite(g, favIds));
}

/** One side of a game, as the card draws it. `score` is passed in, already null unless the card shows one. */
function side(team, teamId, sport, score) {
  const id = team?.id || teamId || null;
  return {
    id,
    name: cardName(team, teamId),
    abbreviation: team?.abbreviation ?? null,
    // TeamMark's own test, with the game's sport because the embed carries none (TeamMark.js). A
    // placeholder has no file at all; a real team's file can still 404, and the reader falls back to
    // a badge as the card does - this cannot know whether a file exists.
    logoUrl: isPlaceholderTeam(team ? { ...team, sport } : null) ? null : teamLogoDarkUrl(id),
    primaryColor: team?.primary_color ?? null,
    secondaryColor: team?.secondary_color ?? null,
    score,
  };
}

/** What the card names for the broadcast, its mark made absolute on `origin`; null with no active row. */
function broadcast(game, origin) {
  const m = cardMark(game);
  if (!m.broadcast) return null;
  return {
    // Under a composite the row `cardBroadcast` names is one outlet of several, and its name beside
    // the composite's mark would be wrong - so a reader with no mark to draw gets no name either.
    name: m.composite ? null : broadcastName(m.broadcast),
    // `markUrl()` is a path under this site (lib/config.js) and the app has no setting for its own
    // origin, so the request's own origin makes it absolute. The `?v=` rides along.
    markUrl: m.url ? new URL(m.url, origin).href : null,
  };
}

/** One game of the answer. Every value is null rather than absent, so the keys survive JSON. */
function entry(g, origin) {
  // The card's right slot, by the card's own function with no favourite passed. The card passes one
  // and draws a betting line on a priced scheduled game; this carries no odds, so that game reads
  // `none`. A stale live row reads `stale` with no score, exactly as the card suppresses it.
  const slot = slotContent(g);
  const scored = slot.kind === 'score';
  const v = g.venue;
  return {
    id: g.id,
    sport: g.sport,
    viewingDay: g.viewing_day,
    // Null wherever the card prints TBD - `etTime`'s own test. A TBD game carries a placeholder
    // instant (midnight ET, pipeline/reconcile.py) that a reader must never print as a time.
    startsAt: etTime(g.canonical_kickoff_at_utc, g.kickoff_status) === 'TBD' ? null : g.canonical_kickoff_at_utc,
    kickoffStatus: g.kickoff_status ?? null,
    status: g.result_status ?? null,
    clock: g.live_clock ?? null,
    period: g.live_period ?? null,
    card: { kind: slot.kind, label: slot.row3 ?? null },
    neutralSite: g.neutral_site ?? null,
    home: side(g.home, g.home_team_id, g.sport, scored ? g.home_score : null),
    away: side(g.away, g.away_team_id, g.sport, scored ? g.away_score : null),
    venue: v ? { name: v.name ?? null, city: v.city ?? null, state: v.state ?? null } : null,
    broadcast: broadcast(g, origin),
  };
}

const byViewingDay = (a, b) => (a.viewing_day < b.viewing_day ? -1 : a.viewing_day > b.viewing_day ? 1 : 0);

/**
 * The whole answer.
 *
 * `rows` are `gamesForRange(today, end)`'s, in the query's order. `overlay` is
 * `overlayForDay(today, overlayRows(...))`'s, or null. `error` is the failed read's: the games are
 * then empty and the reason is cut to 200 characters, as /api/live cuts it, so a reader checks
 * `error` before it blanks its boxes.
 */
export function myGamesAnswer({ today, end, rows, favIds, overlay = null, origin, error = null }) {
  const answer = { today, start: today, end, fetchedAt: overlay?.fetchedAt ?? null, games: [] };
  if (error) return { ...answer, error: String(error?.message ?? error).slice(0, 200) };
  const mine = (rows || []).filter((g) => isFavorite(g, favIds));
  // The overlay holds only the games `overlayRows` handed it, which are today's, so applying it to
  // every favourite patches today's and leaves the rest as the database has them.
  const patched = applyOverlay(mine, overlay?.map);
  // THE PAGE'S OWN ORDER: `chronological` on rows in the query's order, then grouped by viewing day as
  // `byDay` groups the week page (app/page.js). Both sorts are stable, so a TBD game - its
  // placeholder instant is midnight ET - leads its day, two games at one instant keep the query's id
  // order, and a late game past midnight stays on its own viewing day ahead of the next day's games.
  const ordered = chronological(patched, favIds).sort(byViewingDay);
  return { ...answer, games: ordered.map((g) => entry(g, origin)) };
}
