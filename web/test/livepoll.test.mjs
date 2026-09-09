// THE SCORE POLL (prompt 77 stage 1, Joe's ruling 2026-09-09) — the decisions, and the mechanism.
//
// WHAT THIS COVERS AND WHAT IT DOES NOT. That a poll actually moves nothing on screen is a BROWSER
// fact and is measured in one: `scripts/probes/live-poll.mjs` installs a fake clock, stubs the route
// with a live score, runs a full 60-second cycle and samples scrollY and the pin per frame. Those
// figures are in the prompt-77 report and in handoff-status.md.
//
// What is pinned HERE is the MECHANISM that makes the measurement come out that way, because that is
// the half a later edit can quietly undo:
//
//   * the poll sets CLIENT STATE and never navigates - one `router.refresh()` put back would
//     re-render the page on the server every sixty seconds, and prompt 73's banner would re-pin and
//     prompt 71's landing would re-scroll on every one of them;
//   * `AutoScroll` keys its effect on the URL alone, which is what makes "no navigation" sufficient;
//   * only TODAY's Listing polls, and it is told so rather than deciding for itself;
//   * the interval is the server cache's, and the two numbers are asserted equal rather than each
//     being asserted to be 60.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { LIVE_POLL_SECONDS, anyInFlight, overlayMapFromRows, shouldFetchLive } from '../lib/livepoll.js';
import { applyOverlay } from '../lib/livescores.js';
import { region, after } from './region.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE, '..', p), 'utf8');
const code = (p) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const MIN = 60_000;
const at = (t) => new Date(t).toISOString();
const NOW = Date.parse('2026-09-09T23:00:00Z');

// ------------------------------------------------------------------------------ the interval
test('the poll interval IS the server cache, not merely 60', () => {
  // MATCHING IS THE POINT. livescores.js caches every upstream fetch for REVALIDATE_SECONDS, so an
  // interval equal to it means every fetch crosses a cache boundary and returns genuinely new data
  // and none is wasted. Asserting "=== 60" twice would let the two drift apart while both tests
  // passed; asserting they are EQUAL is the property Joe's ruling actually rests on.
  const revalidate = Number(/const REVALIDATE_SECONDS = (\d+);/.exec(src('lib/livescores.js'))?.[1]);
  assert.equal(revalidate, 60, 'the upstream cache window');
  assert.equal(LIVE_POLL_SECONDS, revalidate,
    'going below the cache buys nothing without shortening it too, which means more calls to ESPN');
});

test('REFRESH_SECONDS is retired, not left exported with no reader', () => {
  // Its one reader spent it on router.refresh(). An exported constant nothing imports is a trapdoor
  // for a future edit - the ruling lib/headerstate.js records for `resetHeader()`.
  assert.doesNotMatch(code('lib/config.js'), /export const REFRESH_SECONDS/);
  for (const f of ['components/Listing.js', 'lib/livepoll.js', 'app/page.js']) {
    assert.doesNotMatch(code(f), /REFRESH_SECONDS/, `${f} still reads the retired constant`);
  }
});

// -------------------------------------------------------------------------------- the gate
test('anyInFlight: in_progress is in flight whatever the clock says', () => {
  assert.equal(anyInFlight([{ result_status: 'in_progress' }], NOW), true);
});

test('anyInFlight: final is never in flight, and neither is a row with no kickoff', () => {
  assert.equal(anyInFlight([{ result_status: 'final', canonical_kickoff_at_utc: at(NOW) }], NOW), false);
  assert.equal(anyInFlight([{ result_status: 'scheduled', canonical_kickoff_at_utc: null }], NOW), false);
  assert.equal(anyInFlight([], NOW), false);
  assert.equal(anyInFlight(null, NOW), false);
});

test('anyInFlight: the window is 15 minutes before kickoff to 4 hours after', () => {
  const win = (offsetMs) => anyInFlight(
    [{ result_status: 'scheduled', canonical_kickoff_at_utc: at(NOW + offsetMs) }], NOW,
  );
  // MOVED FROM components/Listing.js UNCHANGED (prompt 77) - the bracket is prompt 53's, and this
  // prompt was about where the poll goes, never about when it is allowed to start.
  assert.equal(win(16 * MIN), false, '16 minutes before kickoff: not yet');
  assert.equal(win(15 * MIN), true, 'exactly 15 minutes before: in');
  assert.equal(win(0), true, 'at kickoff');
  assert.equal(win(-4 * 60 * MIN), true, 'exactly 4 hours after: still in');
  assert.equal(win(-4 * 60 * MIN - MIN), false, '4 hours and a minute after: out');
});

test('shouldFetchLive needs all three - today, visible, and something in flight', () => {
  const games = [{ result_status: 'in_progress' }];
  assert.equal(shouldFetchLive({ live: true, visible: true, games, now: NOW }), true);
  assert.equal(shouldFetchLive({ live: false, visible: true, games, now: NOW }), false,
    'a Listing that is not today never polls - week mode mounts one per day');
  assert.equal(shouldFetchLive({ live: true, visible: false, games, now: NOW }), false,
    'a backgrounded PWA asking every minute is pure waste');
  assert.equal(shouldFetchLive({ live: true, visible: true, games: [], now: NOW }), false,
    'a quiet page makes no request at all - the gate prompt 77 kept');
});

// ------------------------------------------------------------------------------ the patching
test('overlayMapFromRows keys by STRING, which is what applyOverlay looks up with', () => {
  // livescores.js does `overlayMap.get(String(g.id))`. A number-keyed map misses every row, silently.
  const map = overlayMapFromRows([{ gameId: 'mlb-1', status: 'in_progress' }, { gameId: 42 }]);
  assert.equal(map.get('mlb-1').status, 'in_progress');
  assert.equal(map.get('42').gameId, 42, 'a numeric id is stringified on the way in');
  assert.equal(overlayMapFromRows(null).size, 0);
  assert.equal(overlayMapFromRows([null, {}]).size, 0, 'a row with no gameId is dropped, not thrown on');
});

test('the round trip patches exactly the live fields and nothing else', () => {
  // The route sends `[...map.values()]` because a Map does not survive JSON; this is the other end.
  const games = [{ id: 'mlb-1', result_status: 'scheduled', home_score: null, away_score: null,
                   venue: 'Camden Yards', broadcasts: ['x'] }];
  const rows = [{ gameId: 'mlb-1', status: 'in_progress', homeScore: 4, awayScore: 2,
                  clock: 'Top 7th', period: 7 }];
  const [g] = applyOverlay(games, overlayMapFromRows(rows));
  assert.equal(g.result_status, 'in_progress');
  assert.equal(g.home_score, 4);
  assert.equal(g.away_score, 2);
  assert.equal(g.live, true);
  // THE DATABASE STAYS AUTHORITATIVE for everything the overlay does not carry.
  assert.equal(g.venue, 'Camden Yards');
  assert.deepEqual(g.broadcasts, ['x']);
});

test('an empty answer leaves the cards exactly as the server rendered them', () => {
  const games = [{ id: 'mlb-1', result_status: 'scheduled', home_score: null }];
  assert.equal(applyOverlay(games, overlayMapFromRows([])), games, 'the same array, not a copy');
});

// ------------------------------------------------------------ the mechanism, asserted in source
test('THE POLL NEVER NAVIGATES - no router, no refresh, anywhere in Listing', () => {
  // THIS IS THE HAZARD (prompt 77). `router.refresh()` re-renders the page on the SERVER, and prompt
  // 73's banner pin arms on navigation while prompt 71's landing fires on a path or query change.
  // One of these put back is a page that re-pins and re-scrolls every sixty seconds.
  const c = code('components/Listing.js');
  assert.doesNotMatch(c, /useRouter/, 'the router is gone from this component entirely');
  // NAMED, NOT A WILDCARD. A first version banned `.push(` outright and matched the band grouping's
  // `by.get(g.sport).push(g)` - an array push. A test that fails on an unrelated line teaches the
  // next reader to loosen it, which is how a real guard gets thrown away.
  for (const nav of [/router\.refresh/, /router\.push/, /router\.replace/, /window\.location\s*=/]) {
    assert.doesNotMatch(c, nav, `nothing in Listing may navigate: ${nav}`);
  }
  assert.match(c, /setLiveRows\(data\.rows\)/, 'a poll sets client state and that is all it does');
});

test('AutoScroll still keys on the URL ALONE, which is what makes state changes safe', () => {
  // The other half of the same argument, and it is not this file's code - so it is asserted rather
  // than assumed. If the landing effect ever gained a dependency that a re-render can change, the
  // poll would start re-triggering it and the measurement above would silently stop being true.
  const c = code('components/AutoScroll.js');
  assert.match(c, /const key = `\$\{pathname\}\?\$\{params\}`;/);
  assert.match(c, /\}, \[key\]\);/, 'one dependency, and it is the URL');
});

test('the interval does NOT depend on the merged list, or it would re-arm on every poll', () => {
  // `games` changes identity on every successful poll. Depending on it would tear the interval down
  // and rebuild it each time, so the period would be the network's rather than the one Joe chose.
  // ANCHORED ON THE GUARD AND ON WHAT FOLLOWS THE EFFECT. A first version used 'useEffect' as the
  // CLOSING anchor and got the empty string back - `region` looks for the closing anchor at or after
  // the opening one, and the opening one it was given began with `useEffect` itself.
  const effect = region(code('components/Listing.js'),
    'if (!live || !anyInFlight(serverGames))', 'const grouped = useMemo', 'the poll effect');
  assert.match(effect, /\}, \[live, day, serverGames\]\);/);
});

test('the prop is SHADOWED, so every downstream reader is patched by construction', () => {
  // Eight readers below the merge - the band grouping, the off-service filter, the grid's list,
  // showGrid and the two SportBand call sites. Renaming them one by one invites a ninth to be added
  // beside them reading the unpatched list; shadowing makes that impossible.
  const c = code('components/Listing.js');
  assert.match(c, /export default function Listing\(\{ games: serverGames,/);
  assert.match(c, /const games = useMemo\(\(\) => applyOverlay\(serverGames, liveMap\), \[serverGames, liveMap\]\);/);
  // and the merge is livescores.js's own, not a second copy of it (rule 32)
  assert.match(c, /import \{ applyOverlay \} from '\.\.\/lib\/livescores\.js';/);
  assert.doesNotMatch(c, /function applyOverlay/, 'no forked merge in the component');
});

test('`live` is PASSED at both call sites, never guessed', () => {
  // Week mode mounts one Listing PER DAY. A component that decided for itself would put up to ten
  // pollers on one page, which is the thing prompt 53 stage 4b was right to be afraid of.
  const page = code('app/page.js');
  assert.match(page, /live=\{d === today\}/, 'week mode: exactly one day is today');
  assert.match(page, /live=\{day === today\}/, 'day mode');
  assert.equal((page.match(/live=\{/g) || []).length, 2, 'two call sites, two decisions');
  assert.match(code('components/Listing.js'), /flatLabel = null, live = false \}\)/,
    'and it defaults to OFF, so a new call site polls nothing until it opts in');
});

test('the poll stops when the app is not on screen', () => {
  const c = code('components/Listing.js');
  assert.match(c, /addEventListener\('visibilitychange', onVisible\)/);
  assert.match(c, /removeEventListener\('visibilitychange', onVisible\)/, 'and is torn down');
  assert.match(c, /document\.visibilityState === 'visible'/);
});

// ------------------------------------------------------------------- the route, and the week
test('the route takes a DAY and re-reads the slate itself', () => {
  // Taking ids from the client would let a caller drive the fan-out. The server decides which sports
  // to fetch from the DATABASE, so this route cannot be made to fetch anything a page render would
  // not - and `restAll` because rule 19 forbids an unbounded select.
  const r = code('app/api/live/route.js');
  assert.match(r, /searchParams\.get\('day'\)/);
  assert.match(r, /\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$/, 'the day is validated, not coerced');
  assert.match(r, /restAll\(/);
  assert.match(r, /select=id,sport,result_status/, 'three columns, not the page read with its embeds');
  assert.doesNotMatch(r, /searchParams\.get\('ids'\)|body/, 'the client never names the games');
});

test('the WEEK fetches ONE overlay, for today, from today’s group only', () => {
  // PROMPT 53 STAGE 4b REVERSED (prompt 77). Its reasoning - "up to ten live calls on one render" -
  // described an implementation nobody had to write: only today's games can be live.
  //
  // `grouped[today]` AND NOT `rows` IS THE WHOLE CORRECTNESS ARGUMENT. `sportsWorthFetching` walks
  // the games it is handed and collects every sport with a non-final row, so the week's full list
  // would fetch NHL because a scheduled game sits on Friday, with no NHL game on today at all.
  const page = code('app/page.js');
  assert.match(page, /if \(weekHasToday\) weekOverlay = await overlayForDay\(today, grouped\[today\], \{ today \}\);/);
  assert.match(page, /const weekHasToday = Boolean\(days\.includes\(today\) && grouped\[today\]\?\.length\);/);
});

test('a week without today makes no upstream call, by the gate that already existed', () => {
  // Read rather than assumed (the brief asked for exactly this): sportsWorthFetching returns [] for
  // any day that is not today, and overlayForDay returns the empty overlay without fetching when
  // that list is empty. So the week gate is a saving on the DATABASE read, not on the provider call.
  const ls = code('lib/livescores.js');
  assert.match(ls, /if \(!day \|\| !today \|\| day !== today\) return \[\];/);
  const fn = after(ls, 'export async function overlayForDay', 'the overlay');
  assert.match(fn, /if \(!sports\.length\) return empty;/);
});

test('the footnote no longer claims a check it now performs', () => {
  // A page that SAYS it is not checking while it is checking is worse than one that never checked.
  const page = src('app/page.js');
  assert.doesNotMatch(page, /a week view does not check live scores/,
    'prompt 53 stage 4b’s line went with the behaviour it described');
  assert.match(page, /no live check — this week does not contain today/);
});
