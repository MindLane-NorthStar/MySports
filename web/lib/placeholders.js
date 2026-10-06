// A PLACEHOLDER TEAM is a `teams` row that stands in for a club nobody knows yet - a seed, a wild
// card slot, a "TBD" - and so has no logo file and no grid colour ruling. The smoke test's
// "the only unruled pro rows are TBD placeholders" check exists to catch a REAL pro team arriving
// without a colour ruling, and it needs to tell the two apart.
//
// JOE'S RULING, 2026-09-23 (prompt 114 rev B, register §60): WIDEN THE PLACEHOLDER RULE, do not rule
// colours for these ids. The 2026-09-23 08:00Z refresh loaded seven MLB postseason placeholders -
// "AL #3 Seed", "NL Wild Card #1" and the like, ids `mlb-4614`, `-4617`, `-4619`, `-4944`..`-4947`,
// carried by four 2026-09-29 Wild Card games - whose ids do not end in `-TBD`, and the smoke check
// went red. They are not teams: MLB replaces them with real clubs as the seeds clinch and adds new
// placeholders for each later round, so a colour ruling per id would go stale every week of October.
//
// THE PATTERN IS NARROW ON PURPOSE. It covers exactly the two forms MLB has actually published:
// "AL|NL #N Seed" and "AL|NL Wild Card #N". A later round's placeholder with a different name - a
// Division Series winner, say - is MEANT to turn the smoke check red, so that someone looks at it
// and widens the pattern by a ruling. That is the check working, not a defect to design around, and
// it is why this does not guess at forms MLB has not published.
//
// AND IT DID, AND IT WAS (Joe's ruling 2026-09-28, prompt 123's gate run, register §60). The
// Division Series rows loaded with sides named "AL 3/6 Winner", "AL 4/5 Winner", "NL 3/6 Winner" and
// "NL 4/5 Winner" (`mlb-5528`, `-5529`, `-5532`, `-5533`; games on 2026-10-03 and -04), smoke went
// red on them, and Joe widened the rule to that form as published: `AL|NL N/M Winner`, the winner of
// the series between seeds N and M. The LCS and World Series rows will arrive in a form nobody has
// seen yet, and they are meant to turn the check red in their turn.
//
// THE LCS HALF DID, AND IT WAS (Joe's ruling 2026-10-05, prompt 127's gate run, register §60). The
// League Championship Series rows loaded with sides named "NL Higher Seed" and "NL Lower Seed"
// (`mlb-5517`, `-5525`), smoke went red on them, and Joe ruled the form in as published:
// `AL|NL Higher Seed` and `AL|NL Lower Seed`, exactly those two words and no others. The World Series
// rows are still to come, and the World Series form is deliberately not guessed: it is meant to turn
// the check red in its turn.
const MLB_POSTSEASON_PLACEHOLDER = /^(AL|NL) (#\d+ Seed|Wild Card #\d+|\d+\/\d+ Winner|Higher Seed|Lower Seed)$/;

/**
 * True when a `teams` row is a placeholder rather than a club: its id ends in `-TBD` (the rule that
 * stood alone until prompt 114 rev B), or it is an MLB row named for a postseason seed, wild card
 * slot, series winner, or higher or lower seed, in one of the four published forms.
 */
export function isPlaceholderTeam(team) {
  if (!team) return false;
  if (String(team.id ?? '').endsWith('-TBD')) return true;
  return team.sport === 'mlb' && MLB_POSTSEASON_PLACEHOLDER.test(String(team.canonical_name ?? ''));
}

/** Why a row counts as a placeholder, for a smoke detail string; null when it does not. */
export function placeholderReason(team) {
  if (!team) return null;
  if (String(team.id ?? '').endsWith('-TBD')) return 'suffix';
  if (team.sport === 'mlb' && MLB_POSTSEASON_PLACEHOLDER.test(String(team.canonical_name ?? ''))) return 'mlb-pattern';
  return null;
}
