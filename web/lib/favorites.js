// D6: Joe's teams float to the top.
//
// The list is data/favorites.json - TEAM ids, not names. Names would re-resolve on every read and
// could silently pick a different school: "Ohio" and "Ohio State" are two rows, and a substring match
// on "Panthers" spans two sports. Ids are resolved ONCE, by exact match within the sport, and frozen.
//
// PURE, and the policy is injected exactly as primewindow.js takes its policy - so this is testable
// under plain `node --test`, where a bare JSON import is a hard error.

/** The favourite team ids as one flat Set, from the {teams: {sport: [id...]}} document. */
import { isProgram } from './programs.js';

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

/* `splitFavorites` LIVED HERE AND IS GONE (prompt 82 block D2).
 *
 * It split a listing into [favourites, everything else] so `SportBand` could render the first group
 * above the second, and its docstring was careful that the split PRESERVED chronological order
 * inside each group - "a promotion, not a re-sort".
 *
 * THAT CARE IS EXACTLY WHY IT HAD TO GO. Preserving order within two groups still hoists one group
 * out of the day's timeline, and since Joe's 2026-09-09 ruling the timeline carries meaning:
 * `chronological()` sorts by time, then a studio show, then a favourite at a tie. The page sorted
 * and the band un-sorted it. The favourite is a MARK on the card now (`fav-row`), not a position.
 *
 * DELETED RATHER THAN LEFT EXPORTED WITH NO CALLER - the ruling lib/headerstate.js records for
 * `resetHeader()`, and the same one prompt 67 applied to `bandstate.js`. `favoriteIds` and
 * `isFavorite` both stay: the mark needs exactly that predicate. */

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
 * The MY TEAMS scope, preserving input order - so the rows stay chronological. (It used to say
 * "exactly as `splitFavorites` does"; that function was retired in prompt 82 and the reason is
 * recorded where it stood.)
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
 * ABSOLUTE TIME, NOT MINUTES-OF-DAY. `bandstate.js` sorted by minute of the VIEWING day because it
 * has to reason about a window that runs past midnight; this only has to put rows in order, and the
 * ISO instant does that correctly across a viewing day's 03:00 cutover and across a whole week
 * without knowing anything about either.
 *
 * A ROW WITH NO KICKOFF SORTS LAST, never first - the same rule `byKickoff` used in bandstate.js,
 * because a TBD is not "earliest", it is "unknown".
 *
 * STABLE: `Array.prototype.sort` is required to be stable, so rows sharing an instant keep the
 * order the database gave them rather than shuffling between renders - except where the tie-break
 * below has something to say.
 *
 * AT AN EQUAL START TIME A STUDIO SHOW SORTS FIRST (prompt 71 stage 3, Joe 2026-09-08): "if the
 * pregame show airs the same time as a game starts, the pregame show is listed first." A pregame
 * show that begins on the hour with the game it precedes is the ordinary case, not an edge one, and
 * database order decides it otherwise - which means it decides it differently on different days.
 *
 * IT LIVES HERE RATHER THAN AT THE CALL SITE so both scopes get it. MY TEAMS is chronological across
 * every sport and ALL GAMES bands by sport, but they are looking at the same two rows; a tie-break
 * applied to one would have them disagree about which comes first.
 *
 * ---------------------------------------------------------------------------------------------
 * AND A FAVOURITE OUTRANKS A NON-FAVOURITE, THIRD (prompt 80 block D1, Joe 2026-09-09):
 *
 *   "Organize qualifying events by TIME, including pregame shows and MyTeams games. THEN when events
 *    start at the same time, prioritize by: Pregame shows, MyTeams, Other events."
 *
 * So the full order is TIME -> STUDIO SHOW -> FAVOURITE -> everything else, and the two tie-breaks
 * are strictly ranked: a studio show beats a favourite game at the same minute, which is Joe's
 * "1) TIME 2) pre/post THEN myteams THEN other events" read literally.
 *
 * `favIds` IS A PARAMETER RATHER THAN A THING THIS MODULE LOOKS UP, and that is deliberate. Both
 * call sites in app/page.js already hold it - `favoriteIds(favoritesDoc)` is computed there for the
 * scope filter - so threading it costs nothing, while importing the document here would give this
 * module an opinion about WHOSE favourites it is sorting. It is optional, and omitted the sort
 * behaves exactly as it did before this change.
 *
 * `isFavorite` IS IMPORTED, NOT RESTATED, for the same reason `isProgram` is: it reads two id shapes
 * off a row (`home_team_id` or `home.id`, and the away pair), and a copy of that would drift the
 * first time a third shape appeared. The comment above `isProgram`'s use says this already; it
 * applies twice now.
 */
export function chronological(rows, favIds = null) {
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
    if (ta !== tb) return ta - tb;
    // TIE-BREAK 1: a studio show first. `isProgram` is IMPORTED rather than restated - it is one
    // line (`programs.js:250`, `row.program_id != null`), and one line is exactly the kind of
    // predicate that gets copied and then drifts.
    const pa = isProgram(a) ? 0 : 1;
    const pb = isProgram(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    // TIE-BREAK 2: then a favourite. Inert when no ids are given, and inert under MY TEAMS where
    // every row is a favourite - measured rather than assumed, see favorites.test.mjs.
    if (!favIds || favIds.size === 0) return 0;
    return (isFavorite(a, favIds) ? 0 : 1) - (isFavorite(b, favIds) ? 0 : 1);
  });
}
