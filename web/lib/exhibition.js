// NAMED EXHIBITION OPPONENTS (Joe's ruling 2026-10-06, prompt 128, register §73).
//
// A league schedule can list a club from outside the league for one exhibition - London Lions at
// Portland, 2026-10-12 (`nba-401914130`). That is a real `teams` row with no colour ruling, so smoke's
// unruled-pro-rows check went red on it. Joe ruled it exempt BY NAME: one id per entry, in
// data/grid_colors_pro.json `exhibitionOpponents`, with no colour ruling and no class exemption.
//
// NEVER BY A PROPERTY. A real club whose id changed arrives looking exactly like London Lions - no
// conference, empty external ids, no colours, no logo - and that is the arrival the check exists to
// catch. So nothing here reads a property to decide; it reads the name Joe wrote down.
//
// NOT A PLACEHOLDER, and kept out of lib/placeholders.js on purpose. `isPlaceholderTeam` puts a TBD
// badge where a logo would be (components/TeamMark.js) and nulls the logo in /api/my-games
// (lib/mygames.js). An exhibition opponent is a real club and must get neither.
//
// PURE: the document is passed in, as lib/favorites.js takes its document.

/** The named entries, `[id, entry]`, with `_`-prefixed keys (`_about`) skipped. */
function named(doc) {
  return Object.entries(doc?.exhibitionOpponents || {}).filter(([id]) => !id.startsWith('_'));
}

/**
 * The entry naming this `teams` row, or null.
 *
 * EXACT ON THE ID, AND CROSS-CHECKED on the sport and the name (working rule 18): a row that carries
 * the id but not the sport and the name the ruling recorded is not the club Joe ruled on.
 */
export function exhibitionEntry(team, doc) {
  if (!team) return null;
  const hit = named(doc).find(([id]) => id === String(team.id ?? ''));
  if (!hit) return null;
  const entry = hit[1] || {};
  return entry.sport === team.sport && entry.name === team.canonical_name ? entry : null;
}

/** Is this `teams` row a named exhibition opponent? */
export function isExhibitionOpponent(team, doc) {
  return exhibitionEntry(team, doc) !== null;
}

/**
 * What is wrong with the named list against the teams the database holds; empty when nothing is.
 *
 * A named id that is not a team in the sport its entry states names nothing - a stale or mistyped
 * ruling - and one that is also in `teams` would be ruled and exempt at once. Either is a fault, and
 * smoke goes red on it in the same check that applies the exemption.
 */
export function exhibitionFaults(doc, teams) {
  const byId = new Map((teams || []).map((t) => [String(t.id), t]));
  const ruled = doc?.teams || {};
  const out = [];
  for (const [id, entry] of named(doc)) {
    const team = byId.get(id);
    if (!team) out.push(`${id}: no such team`);
    else if (team.sport !== entry?.sport) out.push(`${id}: a ${team.sport} team, the entry says ${entry?.sport}`);
    else if (team.canonical_name !== entry?.name) out.push(`${id}: named "${team.canonical_name}", the entry says "${entry?.name}"`);
    if (Object.hasOwn(ruled, id)) out.push(`${id}: also ruled in teams`);
  }
  return out;
}
