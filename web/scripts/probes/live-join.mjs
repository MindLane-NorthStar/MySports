// DOES THE LIVE OVERLAY ACTUALLY JOIN? (prompt 78)
//
// MLB live scores never worked. The fetch succeeded, the parse succeeded, fifteen rows came back,
// `stats` was populated, nothing warned - and not one id matched, so every card silently kept the
// database's score. The cause was that `/api/v1/schedule?sportId=1` with no date answers for MLB's
// own idea of today, which on 2026-09-09 was 2026-09-08. It was found because Joe asked why a score
// had not moved, which is not a control.
//
//     node scripts/probes/live-join.mjs
//
// IT IS A PROBE AND NOT A GATE, deliberately. It talks to five external hosts, and a gate that goes
// red for someone else's outage is one that gets ignored - which is how the original defect survived.
// The RULE it applies is `joinFailures` in lib/livescores.js, the same function the unit tests pin
// against fixtures, so the two cannot disagree about what "broken" means.
import { overlayForDay, joinFailures } from '../../lib/livescores.js';
import { restAll } from '../../lib/rest.js';
import { todayET } from '../../lib/format.js';

const DAY = todayET();
const games = await restAll(`games?select=id,sport,result_status&viewing_day=eq.${DAY}`);
const overlay = await overlayForDay(DAY, games, { today: DAY });

console.log(`${DAY} - ${games.length} games in the database, sports fetched: ${overlay.sports.join(', ') || '(none)'}\n`);
console.log('sport   returned   joined   unjoined');
for (const [sport, s] of Object.entries(overlay.stats)) {
  console.log(`${sport.padEnd(7)} ${String(s.returned).padStart(8)} ${String(s.joined).padStart(8)} ${String(s.unjoined).padStart(10)}`);
}

const broken = joinFailures(overlay.stats);
if (broken.length) {
  console.log(`\nFAIL  returned rows and joined NONE: ${broken.join(', ')}`);
  console.log('      the overlay is fetching a different set of games than the slate holds -');
  console.log('      check the day each source is being asked for before suspecting the id scheme.');
  process.exit(1);
}
console.log(`\nPASS  no sport returned rows and joined none of them`);
