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
