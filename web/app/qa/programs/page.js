// DEV-ONLY acceptance harness for rendering-contract v1.7.
//
// WHY IT EXISTS. The contract's acceptance list needs one card per program type - a race, a fight
// card, a weekly show, a special event and a studio bookend, plus a `pre` and a `post` against a
// loaded anchor and one with none. Four of those types have no rows in the database until stages
// 3-7 load them, and two of the brands have no art at all, so there is no live day that shows them
// side by side.
//
// WHY IT IS NOT A SECOND IMPLEMENTATION. It renders the REAL components with fixture props -
// ProgramCard and MobileGrid, the same ones Today renders - so what it proves is what ships. A
// hand-built HTML mock of the card would prove only that the mock was built to match, which is
// exactly the second derivation working rule 22 exists to prevent.
//
// IT IS NOT REACHABLE IN PRODUCTION. `notFound()` on NODE_ENV=production, so a Vercel build serves
// a 404 for this path; the fixtures below never reach a reader. Guarded rather than gitignored,
// because the acceptance pass has to be re-runnable by whoever picks this up next.

import { notFound } from 'next/navigation';
import Listing from '../../../components/Listing.js';
import { toRows } from '../../../lib/programs.js';

export const dynamic = 'force-dynamic';

const AT = (h, m = 0) => `2026-09-05T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`;

const bc = (id, name, surface = 'LINEAR', extra = {}) => ({
  service_id: id, label: name, delivery_surface: surface, feed_side: 'NATIONAL', is_primary: true,
  access_status: 'available', carriage_certainty: 'CONFIRMED', active: true,
  network: { id, canonical_name: name, type: surface === 'LINEAR' ? 'linear_cable' : 'streaming', default_sort_order: 10 },
  ...extra,
});

const elig = [{ eligible: true, reason: 'linear', eligible_via_network_id: 'x', market_pending: false }];

// One per program_type, plus the cases the contract names by hand.
const FIXTURES = [
  { program_id: 9001, sport: 'nascar', program_type: 'race_session', brand_key: 'nascar',
    title: 'Cook Out Southern 500', subtitle: 'Cup Series · Darlington Raceway',
    location_text: 'Darlington Raceway', start_at: AT(17), expected_duration_min: 210,
    open_ended: true, hosts_crew: ['Mike Joy', 'Clint Bowyer', 'Kevin Harvick'],
    broadcasts: [bc('usa-network', 'USA Network')], eligibility: elig },

  { program_id: 9002, sport: 'nascar', program_type: 'race_session', brand_key: 'nascar',
    title: 'Fleetio 200', subtitle: "O'Reilly Series · Darlington",
    location_text: 'Darlington Raceway', start_at: AT(19, 30), expected_duration_min: 180,
    open_ended: false, hosts_crew: [], broadcasts: [bc('the-cw', 'The CW')], eligibility: elig },

  { program_id: 9003, sport: 'ufc', program_type: 'fight_card', brand_key: 'ufc',
    title: 'UFC 331', subtitle: 'Van vs. Pantoja 2', location_text: 'Los Angeles, CA',
    start_at: AT(22), expected_duration_min: 360, open_ended: true, hosts_crew: [],
    segments: [{ name: 'early_prelims', start: AT(22) }, { name: 'main_card', start: AT(1) }],
    broadcasts: [bc('paramount-plus', 'Paramount+', 'STREAMING'),
                 bc('cbs', 'CBS', 'LINEAR', { is_primary: false, window_start: AT(0), window_end: AT(2) })],
    eligibility: elig },

  { program_id: 9004, sport: 'wwe', program_type: 'weekly_show', brand_key: 'wwe',
    title: 'Monday Night Raw', subtitle: 'Atlanta, GA', location_text: 'State Farm Arena',
    start_at: AT(0), expected_duration_min: 180, open_ended: false, hosts_crew: [],
    broadcasts: [bc('netflix', 'Netflix', 'STREAMING')], eligibility: elig },

  { program_id: 9005, sport: 'aew', program_type: 'weekly_show', brand_key: 'aew',
    title: 'AEW Dynamite', subtitle: 'Cleveland, OH', location_text: 'Rocket Arena',
    start_at: AT(0), expected_duration_min: 120, open_ended: false, hosts_crew: ['Excalibur', 'Tony Schiavone'],
    broadcasts: [bc('tbs', 'TBS')], eligibility: elig },

  { program_id: 9006, sport: 'wwe', program_type: 'special_event', brand_key: 'wwe',
    title: "Sunday Night's Main Event", subtitle: 'Atlanta, GA', location_text: 'State Farm Arena',
    start_at: AT(0), expected_duration_min: 240, open_ended: true, hosts_crew: [],
    broadcasts: [bc('peacock', 'Peacock', 'STREAMING')], eligibility: elig },

  // GAMEDAY - the exact-colour case, AND a brand with no art, so this is also the typographic endcap.
  { program_id: 9007, sport: 'cfb', program_type: 'studio_show', brand_key: 'gameday',
    title: 'College GameDay', subtitle: 'Live from Columbus, OH', location_text: 'Ohio State',
    start_at: AT(13), expected_duration_min: 180, open_ended: false, bookend: 'pre',
    anchor_program_id: 9010,
    hosts_crew: ['Rece Davis', 'Kirk Herbstreit', 'Desmond Howard', 'Pat McAfee', 'Nick Saban'],
    broadcasts: [bc('espn', 'ESPN')], eligibility: elig },

  // A `post` bookend WITH an anchor, and a `pre` bookend with NONE - the two branches of the rule.
  { program_id: 9008, sport: 'cfb', program_type: 'studio_show', brand_key: 'bignoon',
    title: 'Big Noon Kickoff', subtitle: null, location_text: null,
    start_at: AT(14), expected_duration_min: 120, open_ended: false, bookend: 'pre',
    anchor_program_id: null, hosts_crew: [], broadcasts: [bc('fox', 'FOX')], eligibility: elig },

  { program_id: 9009, sport: 'nascar', program_type: 'studio_show', brand_key: 'nascarpostrace',
    title: 'NASCAR Post-Race', subtitle: null, location_text: null,
    start_at: AT(20, 30), expected_duration_min: 30, open_ended: true, bookend: 'post',
    anchor_program_id: 9001, hosts_crew: [], broadcasts: [bc('usa-network', 'USA Network')],
    eligibility: elig },

  // THE DEFECT CASE: no eligibility row at all. It must be visibly marked, never shown as watchable.
  { program_id: 9011, sport: 'indycar', program_type: 'race_session', brand_key: 'indycar',
    title: 'Firestone Grand Prix of Monterey', subtitle: 'WeatherTech Raceway Laguna Seca',
    location_text: 'Laguna Seca', start_at: AT(18, 30), expected_duration_min: 150,
    open_ended: true, hosts_crew: [], broadcasts: [bc('fox', 'FOX')], eligibility: [] },
];

export default async function ProgramQaPage({ searchParams }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const params = await searchParams;
  const now = new Date(params?.now || '2026-09-05T18:00:00Z');
  const rows = toRows(FIXTURES, now);
  // The now marker at an INJECTED minute, so the acceptance shot can prove where it lands rather
  // than depending on when the pass happened to run.
  const nowMinute = params?.nowMinute ? Number(params.nowMinute) : null;

  return (
    <main>
      <h1>v1.7 program fixtures</h1>
      <p className="sub">Dev-only. One card per program type, through the shipping components.</p>
      <Listing games={rows} standingsRows={[]} rankingsRows={[]} day="2026-09-05" sport={null}
               grid bands nowMinute={nowMinute} />
    </main>
  );
}
