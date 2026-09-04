// Where a club stands, split the way the listings card splits it: the RECORD goes on line 1 beside the
// team's name, and everything that qualifies it goes on line 2 underneath.
//
// The shape differs per league because the leagues genuinely differ, and a column left null by
// pipeline/standings.py means the league does not publish that number - never that it is zero:
//
//   mlb  70-68  /  2nd AL Central · 3.0 GB
//   nhl  55-16-11  /  121 pts · 1st Atlantic        (no games back - the NHL does not publish one)
//   nba  52-30  /  4th East · 2.0 GB                (division_rank carries the CONFERENCE seed)
//   nfl  3-0  /  1st AFC East        , or just  AFC North  before anyone has played
//   cfb  8-1  /  AP #14 · Big Ten     , the poll and its rank BESIDE the conference, not instead of it
//
// **ABSENT MEANS ABSENT, on each line separately** (Joe, 2026-09-04). A record that does not exist
// renders nothing - and a record of 0-0 does not exist, it is the absence of a season. But a club with
// no standings row still has a CONFERENCE, and Joe's rule is explicit that the conference name shows
// on its own "until a place does exist". So the two lines appear and disappear independently: an NFL
// card in early September has no record line and still says AFC North.
//
// That last part REVERSES what this file used to do, which was to render nothing at all without a
// team_records row. It is a deliberate change, not drift: naming the division is useful and true even
// before a single game, where a stale record from last season would be neither.

/** 'American League Central' -> 'AL Central'; a name already short is returned untouched. */
export function shortGroup(name) {
  if (!name) return null;
  return String(name)
    .replace(/^American League\s+/i, 'AL ')
    .replace(/^National League\s+/i, 'NL ')
    .replace(/^Eastern Conference$/i, 'East')
    .replace(/^Western Conference$/i, 'West')
    .trim();
}

function ordinal(n) {
  if (!Number.isInteger(n) || n < 1) return null;
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
}

/** '70-68' / '55-16-11' (NHL carries OT losses) / '3-0-1' (NFL ties, only when non-zero). */
export function recordText(row, sport) {
  if (!row) return null;
  const w = row.wins ?? 0;
  const l = row.losses ?? 0;
  if (sport === 'nhl') return `${w}-${l}-${row.ot_losses ?? 0}`;
  if (row.ties) return `${w}-${l}-${row.ties}`;
  return `${w}-${l}`;
}

/** A record of all zeroes is a record that does not exist yet, not a record of no wins. */
function realRecord(row, sport) {
  const t = recordText(row, sport);
  return t && !/^0-0(-0)?$/.test(t.trim()) ? t : null;
}

function gamesBack(row) {
  return row.games_back != null && Number(row.games_back) > 0
    ? `${Number(row.games_back).toFixed(1)} GB`
    : null;
}

/**
 * C2/C3 - the card's two pieces, split where the card splits them.
 *
 *   { record }  line 1, beside the team's name
 *   { rest }    line 2, on its own - the placement and whatever qualifies it
 *
 * Joe's per-sport spec, 2026-09-04, and the two rulings on top of it:
 *
 *   nfl, nhl   place in DIVISION
 *   nba        place in CONFERENCE - division_rank carries the conference seed (0008, and 0011 seeds
 *              the two conference rows shortGroup() folds to East / West)
 *   cfb        the poll rank AND the conference, joined - see below
 *   mlb        unchanged: place in division, then games back
 *
 * **NHL keeps its points.** The spec says games back, but the NHL does not publish it - games_back is
 * null on all 96 NHL rows while points is set on all 96 - so line 2 stays "104 pts · 2nd Atlantic".
 * Rendering an empty games-back would be inventing a number the league does not keep.
 *
 * **No placement means the GROUP NAME ALONE**, for every team sport: "if a place in division standings
 * does not exist, ONLY display the conference name until a place does exist". That is what an NFL card
 * shows all September, when division_rank is null on all 32 clubs because nobody has played.
 *
 * **A record of 0-0 is not a record.** "If a record does not yet exist, display nothing until one
 * does" - and before week 1 every NFL club reads 0-0, which is the absence of a season, not a start.
 *
 * **CFB IS A COMBINATION, NOT AN EITHER/OR** (Joe's clarification, 2026-09-04, on the live Fresno
 * State at USC card: *"the line below USC should read `AP #14 - Big Ten` - NOT simply `#14`"*). The
 * rank and the conference are two independent facts and each renders when it exists:
 *
 *     CFP-ranked, placed        CFP #4 · 3rd ACC
 *     AP-ranked, placed         AP #14 · 2nd Big Ten
 *     AP-ranked, not placed     AP #14 · Big Ten          <- every ranked card in week 1
 *     unranked, placed          3rd ACC
 *     unranked, not placed      Big Ten
 *
 * The earlier reading - rank INSTEAD of conference - was a fair reading of the written spec, which
 * listed these as alternatives, so this is a clarification of the rule rather than a defect in the
 * code that implemented it. CFP still outranks AP when both exist; only the label is new, and it is
 * why `ranked` carries the poll rather than a bare integer.
 *
 * `ranked` is `{ poll, rank }` from rankFor(), or null. It is passed in rather than looked up so this
 * stays pure, and so the card cannot accidentally read games.away_rank, which carries no poll at all
 * and therefore cannot honour the CFP-before-AP precedence OR print the label.
 */
export function standingParts(row, sport, groupName, ranked = null) {
  const group = shortGroup(groupName);
  const record = row ? realRecord(row, sport) : null;
  const place = row ? ordinal(row.division_rank) : null;
  const placed = place ? (group ? `${place} ${group}` : place) : null;

  let rest = null;
  if (sport === 'cfb') {
    // Two independent facts joined, each rendering only when it exists. The placement is preferred
    // over the bare conference name exactly as it is for every other sport - being ranked does not
    // stop a club also having a place in its conference table.
    rest = [rankLabel(ranked), placed || group].filter(Boolean).join(' · ') || null;
  } else if (sport === 'nhl') {
    const pts = Number.isInteger(row?.points) ? `${row.points} pts` : null;
    rest = [pts, placed || group].filter(Boolean).join(' · ') || null;
  } else {
    rest = [placed || group, row ? gamesBack(row) : null].filter(Boolean).join(' · ') || null;
  }
  return { record, rest };
}

/**
 * The joined form - record and placement on one line.
 *
 * KEPT because the detail panel wants it: GameDetail.js renders one wide line per club where there is
 * room for all of it, and splitting it there would be a change nobody asked for. The listings card is
 * the surface that needed the split, and it calls standingParts() instead. Both read the same rules
 * from the same place, so the two surfaces cannot drift.
 */
export function standingLine(row, sport, groupName, ranked = null) {
  const { record, rest } = standingParts(row, sport, groupName, ranked);
  return [record, rest].filter(Boolean).join(' · ') || null;
}

/**
 * Index the standings rows a page fetched: newest as_of wins for each (team_id, season).
 * The table keeps one row per club PER DAY, so a page must not simply take the first row it sees.
 */
export function indexStandings(rows) {
  const best = new Map();
  for (const r of rows || []) {
    const key = `${r.team_id}|${r.season}`;
    const prev = best.get(key);
    if (!prev || String(r.as_of) > String(prev.as_of)) best.set(key, r);
  }
  return best;
}

export function standingFor(index, teamId, season) {
  return index.get(`${teamId}|${season}`) || null;
}

// ---------------------------------------------------------------- college football poll ranks
//
// Joe's precedence, verbatim: "CFP Rank (if one exists) - if no CFP Rank, then AP Rank (if one
// exists)". The Coaches poll is LOADED by pipeline/rankings.py and deliberately not consulted here -
// it is stored because the provider publishes it, not because the card shows it.
//
// **This reads mysports.rankings, never games.away_rank / games.home_rank.** The game row carries a
// bare number with no poll attached to it, so it physically cannot express "the CFP has them 4th but
// the AP has them 7th" - it cannot honour a precedence it does not record. The rankings table can,
// which is the whole reason it gets loaded.

/** Index ranking rows for lookup, keyed team|season|week|poll. */
export function indexRankings(rows) {
  const by = new Map();
  for (const r of rows || []) {
    by.set(`${r.team_id}|${r.season}|${r.week}|${r.poll_type}`, r);
  }
  return by;
}

/**
 * Which poll ranks this club this week, and where: `{ poll, rank }` - CFP if the committee has ranked
 * them, else AP, else null.
 *
 * **It returns the POLL with the number.** It used to return a bare integer, which threw away the one
 * thing the card now has to print: `#14` cannot be labelled `AP #14` by a caller that was never told
 * which poll answered. The precedence was always here; only the identity was being discarded.
 *
 * Null still means UNRANKED, and it never falls through to a lower poll or to a previous week, because
 * "unranked this week" and "we have no poll for this week" must not look alike.
 */
export function rankFor(index, teamId, season, week) {
  if (!index || teamId == null) return null;
  for (const poll of ['CFP', 'AP']) {
    const row = index.get(`${teamId}|${season}|${week}|${poll}`);
    const rank = row?.rank;
    if (Number.isInteger(rank) && rank > 0) return { poll, rank };
  }
  return null;
}

/** `{ poll: 'AP', rank: 14 }` -> 'AP #14'. Anything malformed renders nothing rather than half a label. */
export function rankLabel(ranked) {
  const rank = ranked?.rank;
  if (!ranked?.poll || !Number.isInteger(rank) || rank <= 0) return null;
  return `${ranked.poll} #${rank}`;
}
