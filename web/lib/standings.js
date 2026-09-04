// Line 2 of a listings team column: the record and where that record places the club.
//
// The shape differs per league because the leagues genuinely differ, and a column left null by
// pipeline/standings.py means the league does not publish that number - never that it is zero:
//
//   mlb  70-68 · 2nd AL Central · 3.0 GB
//   nhl  55-16-11 · 121 pts · 1st Central
//   nba  52-30 · #4 in the conference          (division_rank carries the CONFERENCE seed - Joe's ruling)
//   nfl  3-0 · 1st AFC East
//
// **Absent means absent.** When there is no team_records row for that club and season the caller
// renders NO line at all - not an empty one. Before a season starts that is the honest answer, and it
// is why an NBA card in September shows two lines rather than a stale 60-22 from last spring.

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

/**
 * The full line. `group` is the club's conference/division name from teams.conference_id, which the
 * bootstrap fills from each adapter's teams file (MLB divisions, NHL divisions, NFL is null today).
 */
export function standingLine(row, sport, groupName) {
  if (!row) return null;
  const group = shortGroup(groupName);
  const parts = [recordText(row, sport)];
  const rank = ordinal(row.division_rank);

  if (sport === 'nhl') {
    if (Number.isInteger(row.points)) parts.push(`${row.points} pts`);
    if (rank) parts.push(group ? `${rank} ${group}` : `${rank} in division`);
  } else if (sport === 'nba') {
    // division_rank holds the CONFERENCE seed here; say so rather than implying a division.
    if (rank) parts.push(`#${row.division_rank} in the conference`);
  } else {
    if (rank) parts.push(group ? `${rank} ${group}` : `${rank} in division`);
    if (sport === 'mlb' && row.games_back != null && Number(row.games_back) > 0) {
      parts.push(`${Number(row.games_back).toFixed(1)} GB`);
    }
  }
  return parts.filter(Boolean).join(' · ');
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
 * The rank to show for one club in one week: CFP if the committee has ranked them, else AP, else null.
 * Null means UNRANKED and the caller renders nothing - it never falls through to a lower poll or to a
 * previous week, because "unranked this week" and "we have no poll for this week" must not look alike.
 */
export function rankFor(index, teamId, season, week) {
  if (!index || teamId == null) return null;
  for (const poll of ['CFP', 'AP']) {
    const row = index.get(`${teamId}|${season}|${week}|${poll}`);
    const rank = row?.rank;
    if (Number.isInteger(rank) && rank > 0) return rank;
  }
  return null;
}
