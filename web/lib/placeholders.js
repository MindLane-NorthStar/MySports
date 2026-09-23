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
const MLB_POSTSEASON_PLACEHOLDER = /^(AL|NL) (#\d+ Seed|Wild Card #\d+)$/;

/**
 * True when a `teams` row is a placeholder rather than a club: its id ends in `-TBD` (the rule that
 * stood alone until prompt 114 rev B), or it is an MLB row named for a postseason seed or wild card
 * slot in one of the two published forms.
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
