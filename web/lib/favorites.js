// D6: Joe's teams float to the top.
//
// The list is data/favorites.json - TEAM ids, not names. Names would re-resolve on every read and
// could silently pick a different school: "Ohio" and "Ohio State" are two rows, and a substring match
// on "Panthers" spans two sports. Ids are resolved ONCE, by exact match within the sport, and frozen.
//
// PURE, and the policy is injected exactly as primewindow.js takes its policy - so this is testable
// under plain `node --test`, where a bare JSON import is a hard error.

/** The favourite team ids as one flat Set, from the {teams: {sport: [id...]}} document. */
export function favoriteIds(doc) {
  const out = new Set();
  for (const ids of Object.values(doc?.teams || {})) {
    for (const id of ids || []) out.add(String(id));
  }
  return out;
}

export function isFavorite(game, ids) {
  if (!ids || ids.size === 0) return false;
  return ids.has(String(game?.home_team_id ?? game?.home?.id ?? '')) ||
         ids.has(String(game?.away_team_id ?? game?.away?.id ?? ''));
}

/**
 * Split a listing into [favourites, everything else], PRESERVING the incoming order inside each group.
 *
 * That order preservation is the whole point: the rows arrive chronologically, so both groups stay
 * chronological and the day still reads as a timeline - it is a promotion, not a re-sort.
 */
export function splitFavorites(games, ids) {
  const rows = Array.isArray(games) ? games : [];
  if (!ids || ids.size === 0) return { favorites: [], rest: rows };
  const favorites = [];
  const rest = [];
  for (const g of rows) (isFavorite(g, ids) ? favorites : rest).push(g);
  return { favorites, rest };
}

/**
 * THE FIVE TEAM-LESS SPORTS, permanently part of MY TEAMS (Joe's ruling, register §18d).
 *
 * A race, a fight card and a weekly wrestling show have no home and away club, so `isFavorite()` can
 * never match one and `scope=mine` showed NONE of them - 196 rows in the database, invisible to the
 * scope that is supposed to be everything Joe follows. There is nothing to pick from in these five,
 * so following the sport IS following all of it.
 *
 * MEASURED, not assumed - the sport values on non-game programs are exactly:
 *   nascar 98 · aew 35 · wwe 36 · indycar 18 · ufc 9   (196)   <- these five
 *   nfl 80 · cfb 31                                    (111)   <- STUDIO SHOWS
 *
 * SO STUDIO SHOWS ARE EXCLUDED BY CONSTRUCTION and need no special case: they carry the sport they
 * bookend, `nfl` or `cfb`, not a sport of their own. That is also why they SHOULD be excluded - a
 * GameDay instance is a pregame show attached to a sport that does have teams, not a thing to follow
 * in its own right, and Joe's ruling named five sports of which it is not one.
 *
 * `aew` IS ITS OWN SPORT VALUE and is deliberately absent from config.js's SPORTS and SPORT_FILTERS
 * (register §13: it loads and renders but gets no chip). So this list cannot be derived from either
 * of those and is written out.
 */
export const TEAMLESS_SPORTS = ['nascar', 'indycar', 'ufc', 'wwe', 'aew'];

/**
 * Is this row part of MY TEAMS? A favourite team's game, OR anything in a team-less sport.
 *
 * The two tests are deliberately different questions. `isFavorite` asks whether a row carries one of
 * Joe's thirteen clubs; this asks whether a row belongs in the scope at all. The band-level YOUR
 * TEAMS marker under ALL GAMES keeps using `isFavorite`, because that marker means "this is one of
 * your teams" and a race has no team to be one of.
 */
export function isMine(row, ids) {
  if (isFavorite(row, ids)) return true;
  const sport = row?.sport;
  return typeof sport === 'string' && TEAMLESS_SPORTS.includes(sport);
}

/**
 * The MY TEAMS scope, preserving input order - so the rows stay chronological, exactly as
 * `splitFavorites` does and for the same reason.
 */
export function splitMine(rows, ids) {
  const list = Array.isArray(rows) ? rows : [];
  const mine = [];
  const rest = [];
  for (const g of list) (isMine(g, ids) ? mine : rest).push(g);
  return { mine, rest };
}
