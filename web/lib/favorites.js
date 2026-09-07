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
 * R2, prompt 56: THE TWO WORDS THE SCOPE LINE USES FOR THOSE FIVE SPORTS.
 *
 * Nothing on a MY TEAMS page named the scope. In LIST views the only signal was the ABSENCE of the
 * "Your teams" labels prompt 53 stage 6 correctly removed there; in GRID views there was no signal
 * at all, so Day · My Teams · Grid was structurally identical to Day · All Teams · Grid and only
 * the number of blocks differed.
 *
 * TWO CATEGORY WORDS, NOT FIVE SPORT NAMES. Joe pinned the wording on 2026-09-06 and the phrasing
 * was chosen over naming the sports individually because five names is a list, not a scope.
 *
 * `racing` IS NOT NEW VOCABULARY - it is already this app's own filter token for exactly nascar and
 * indycar (`FILTER_EXPANDS`, config.js), so the line and the Racing tile agree by construction.
 * `combat sports` IS A DISPLAY LABEL ONLY: it is deliberately NOT a filter token and NOT a sport
 * value, and must never become one. `aew` sits inside it and still has no chip (register §13).
 *
 * THE MAP IS EXPORTED SO A TEST CAN ASSERT IT COVERS `TEAMLESS_SPORTS` EXACTLY. A sixth team-less
 * sport added above and not placed here fails that test, and the line gets revisited rather than
 * silently under-describing the scope - which is the whole failure this line exists to fix.
 */
export const TEAMLESS_CATEGORIES = {
  racing: ['nascar', 'indycar'],
  'combat sports': ['ufc', 'wwe', 'aew'],
};

/**
 * `MY TEAMS · 13 CLUBS + RACING + COMBAT SPORTS` - Joe's wording, 2026-09-06.
 *
 * The club count is ALWAYS derived by the caller from `favoriteIds(doc).size` and never written
 * down: it changes the day Joe adds a team, and a line reading "13 clubs" above fourteen clubs'
 * games is worse than no line at all. The category words come from TEAMLESS_CATEGORIES above, so
 * the line cannot drift from the coverage the test pins.
 *
 * This is also the first surface in the app that states MY TEAMS silently includes EVERY race,
 * fight card and wrestling show, not just the clubs. Register §18d ruled it; nothing said it.
 */
export function scopeLine(clubCount) {
  const n = Number.isFinite(clubCount) ? clubCount : 0;
  const cats = Object.keys(TEAMLESS_CATEGORIES).map((c) => c.toUpperCase()).join(' + ');
  return `MY TEAMS · ${n} CLUB${n === 1 ? '' : 'S'} + ${cats}`;
}

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

/**
 * R4's "chronological across every sport", MADE TRUE (prompt 60 stage 4).
 *
 * IT LIVES HERE BECAUSE THIS IS WHERE THE FALSE CLAIM LIVED. app/page.js said, twice:
 *
 *   "`allRows` arrives ordered by kickoff and splitMine keeps input order,
 *    so 'chronological across every sport' is free."
 *
 * The second half is true and the first half is not. `allRows` is `[...games, ...programRows]` - a
 * CONCATENATION of two separately-ordered reads. `queries.js` orders games by
 * `canonical_kickoff_at_utc.asc` and programs by `start_at.asc`, each within itself, so the joined
 * list is every game in order followed by every program in order. On 2026-09-06 under MY TEAMS that
 * is 1:40 PM, 7:30 PM, then 2:30 PM, 5:00 PM, 8:00 PM.
 *
 * IT WAS INVISIBLE UNTIL THIS STAGE, which is why it survived: with sport bands on, `Listing`
 * regroups by sport and the concatenation's order never reaches the screen. Turning the bands off
 * is what exposes it - so the fix ships in the same commit as the change that reveals it.
 *
 * ABSOLUTE TIME, NOT MINUTES-OF-DAY. `bandstate.js` sorts by minute of the VIEWING day because it
 * has to reason about a window that runs past midnight; this only has to put rows in order, and the
 * ISO instant does that correctly across a viewing day's 03:00 cutover and across a whole week
 * without knowing anything about either.
 *
 * A ROW WITH NO KICKOFF SORTS LAST, never first - the same rule `byKickoff` uses in bandstate.js,
 * because a TBD is not "earliest", it is "unknown".
 *
 * STABLE: `Array.prototype.sort` is required to be stable, so rows sharing an instant keep the
 * order the database gave them rather than shuffling between renders.
 */
export function chronological(rows) {
  const at = (r) => {
    const t = Date.parse(r?.canonical_kickoff_at_utc ?? r?.start_at ?? '');
    return Number.isFinite(t) ? t : null;
  };
  return [...(Array.isArray(rows) ? rows : [])].sort((a, b) => {
    const ta = at(a);
    const tb = at(b);
    if (ta === null && tb === null) return 0;
    if (ta === null) return 1;
    if (tb === null) return -1;
    return ta - tb;
  });
}
