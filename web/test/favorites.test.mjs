// THE FAVOURITE MARK, and the file that resolves it.
//
// D6 (prompt 20) floated favourites to the top of their band; prompt 82 block D2 retired that float
// and marks the card instead, because Joe's 2026-09-09 ordering ruling makes position meaningful and
// a hoist contradicts a list sorted by the clock.
//
// The resolution itself is frozen in data/favorites.json - these tests assert the FILE (that the
// thirteen teams are there as ids, and that the four resolution traps did not bite), the PREDICATE
// the mark is computed from, and the SORT that replaced the hoist.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { favoriteIds, isFavorite, chronological } from '../lib/favorites.js';
import { after, before } from './region.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const doc = JSON.parse(readFileSync(join(HERE, '..', '..', 'data', 'favorites.json'), 'utf8'));
const ids = favoriteIds(doc);

test('all thirteen teams are present, as ids', () => {
  assert.equal(ids.size, 13);
  for (const id of ids) assert.equal(typeof id, 'string');
});

test('each sport holds the expected count', () => {
  assert.equal(doc.teams.nfl.length, 2);
  assert.equal(doc.teams.mlb.length, 1);
  assert.equal(doc.teams.nba.length, 1);
  assert.equal(doc.teams.nhl.length, 3);
  assert.equal(doc.teams.cfb.length, 6);
});

test('TRAP: Ohio is the Bobcats and is a DIFFERENT row from Ohio State', () => {
  assert.ok(ids.has('195'), 'Ohio (MAC)');
  assert.ok(ids.has('194'), 'Ohio State');
  assert.notEqual('195', '194');
  assert.equal(doc._names['195'], 'Ohio');
  assert.equal(doc._names['194'], 'Ohio State');
});

test('TRAP: Panthers is the CAROLINA Panthers, not the Florida Panthers', () => {
  assert.ok(doc.teams.nfl.includes('nfl-29'));
  assert.equal(doc._names['nfl-29'], 'Carolina Panthers');
  // Resolved within nfl, so no nhl row can be selected at all.
  for (const id of doc.teams.nhl) assert.doesNotMatch(doc._names[id], /Panthers/);
});

test('TRAP: Ole Miss is not Mississippi State', () => {
  assert.ok(ids.has('145'));
  assert.equal(doc._names['145'], 'Ole Miss');
  assert.ok(!ids.has('344'), 'Mississippi State must not be selected');
});

test('TRAP: Tennessee is the Volunteers, not State/Tech/Middle', () => {
  assert.ok(ids.has('2633'));
  assert.equal(doc._names['2633'], 'Tennessee');
});

test('MLB resolved on the nickname, which is how that sport names teams', () => {
  assert.ok(doc.teams.mlb.includes('mlb-114'));
  assert.equal(doc._names['mlb-114'], 'Guardians');
});

test('a game is a favourite when either side is one', () => {
  assert.equal(isFavorite({ home_team_id: 'nfl-5', away_team_id: 'nfl-1' }, ids), true);
  assert.equal(isFavorite({ home_team_id: 'nfl-1', away_team_id: 'nfl-5' }, ids), true);
  assert.equal(isFavorite({ home_team_id: 'nfl-1', away_team_id: 'nfl-2' }, ids), false);
  assert.equal(isFavorite({ home: { id: '194' }, away: { id: '1' } }, ids), true, 'fixture shape too');
});

// `splitFavorites` AND ITS THREE TESTS LIVED HERE AND ARE GONE (prompt 82 block D2).
//
// They pinned that the hoist preserved chronological order INSIDE each group - "a promotion, not a
// re-sort". That care is exactly why the hoist had to go: preserving order within two groups still
// lifts one group out of the day's timeline, and since Joe's 2026-09-09 ruling the timeline carries
// meaning. THE COVERAGE MOVED rather than disappearing - the property is now "the whole band reads
// in clock order with a favourite winning only a tie", pinned against `chronological` in the D1
// block below and in pageorder.test.mjs.

test('a favourite is DISTINGUISHED without being MOVED, which is the whole change', () => {
  // `isFavorite` survives because the mark needs exactly it; what is gone is the partition that used
  // the same predicate to reorder the list.
  const g = (id, home) => ({ id, home_team_id: home, away_team_id: 'zzz' });
  const day = [g('1', 'x'), g('2', 'nfl-5'), g('3', 'y'), g('4', '194'), g('5', 'z')];
  assert.deepEqual(day.filter((x) => isFavorite(x, ids)).map((x) => x.id), ['2', '4'],
    'the same two rows the split used to lift');
  assert.deepEqual(day.map((x) => x.id), ['1', '2', '3', '4', '5'],
    'and the list is untouched - marking is not reordering');
});

test('an empty favourites list marks nothing and changes nothing', () => {
  const g = (id, home) => ({ id, home_team_id: home, away_team_id: 'zzz' });
  const day = [g('1', 'nfl-5'), g('2', 'x')];
  assert.deepEqual(day.filter((x) => isFavorite(x, new Set())).map((x) => x.id), []);
});

test('the file documents that these are TEAM ids, not game ids', () => {
  assert.match(doc._about, /TEAM ids/);
  assert.match(doc._resolved, /EXACT match/);
});

// ---------------------------------------------------------------- prompt 51 stage 4b: the scope
//
// MY TEAMS is the thirteen clubs AND the five team-less sports (Joe's ruling, register §18d). These
// pin the rule with FIXTURES rather than a DOM, because the failure mode is a silent one: a scope
// that quietly drops 196 rows looks exactly like a quiet day.

import { isMine, splitMine, TEAMLESS_SPORTS } from '../lib/favorites.js';

const FAVS = new Set(['cle', 'osu']);
const teamGame = (id, sport, home, away) => ({ id, sport, home_team_id: home, away_team_id: away });
const program = (id, sport, program_type = 'race_session') => ({ id, sport, program_type, title: id });

test('a favourite team\'s game qualifies, on either side', () => {
  assert.equal(isMine(teamGame('1', 'nfl', 'cle', 'pit'), FAVS), true, 'home');
  assert.equal(isMine(teamGame('2', 'cfb', 'mich', 'osu'), FAVS), true, 'away');
});

test('a non-favourite team\'s game does NOT qualify', () => {
  assert.equal(isMine(teamGame('3', 'nfl', 'pit', 'bal'), FAVS), false);
  assert.equal(isMine(teamGame('4', 'mlb', 'nyy', 'bos'), FAVS), false);
});

test('a NASCAR race qualifies with no team on it at all', () => {
  // This is the whole point: favoriteIds() matches team ids and a race has none, so before the
  // sport rule `scope=mine` showed zero of the 98 loaded races.
  assert.equal(isMine(program('r1', 'nascar'), FAVS), true);
  assert.equal(isMine(program('r1', 'nascar'), new Set()), true, 'even with no favourites at all');
});

test('all five team-less sports qualify, and only those five', () => {
  assert.deepEqual(TEAMLESS_SPORTS, ['nascar', 'indycar', 'ufc', 'wwe', 'aew']);
  for (const s of TEAMLESS_SPORTS) {
    assert.equal(isMine(program(`p-${s}`, s), new Set()), true, `${s} must qualify`);
  }
  for (const s of ['nfl', 'cfb', 'mlb', 'nba', 'nhl']) {
    assert.equal(isMine(program(`p-${s}`, s), new Set()), false, `${s} must NOT qualify by sport`);
  }
});

test('a STUDIO SHOW does not qualify - it carries the sport it bookends', () => {
  // Measured against the live database: studio shows carry sport `nfl` (80) or `cfb` (31), never a
  // sport of their own. So they are excluded BY CONSTRUCTION rather than by a special case - which
  // is also why the exclusion is right: a GameDay instance is a pregame show attached to a sport
  // that does have teams, not a thing to follow in its own right.
  assert.equal(isMine(program('gameday', 'cfb', 'studio_show'), new Set()), false);
  assert.equal(isMine(program('fnia', 'nfl', 'studio_show'), new Set()), false);
  // ...unless one of its teams is a favourite, which a studio show never carries anyway
  assert.equal(isMine({ id: 'x', sport: 'cfb', program_type: 'studio_show' }, FAVS), false);
});

test('a row with a null or missing sport does not crash and does not qualify', () => {
  assert.equal(isMine({ id: 'n1', sport: null }, FAVS), false);
  assert.equal(isMine({ id: 'n2' }, FAVS), false);
  assert.equal(isMine({}, FAVS), false);
  assert.equal(isMine(null, FAVS), false);
  assert.equal(isMine(undefined, new Set()), false);
});

test('splitMine keeps input order, so the scope stays chronological', () => {
  const day = [
    teamGame('1', 'nfl', 'cle', 'pit'),   // favourite
    teamGame('2', 'mlb', 'nyy', 'bos'),   // not
    program('3', 'nascar'),               // team-less sport
    teamGame('4', 'cfb', 'osu', 'mich'),  // favourite
    program('5', 'cfb', 'studio_show'),   // studio show - excluded
    program('6', 'aew', 'weekly_show'),   // team-less sport
  ];
  const { mine, rest } = splitMine(day, FAVS);
  assert.deepEqual(mine.map((g) => g.id), ['1', '3', '4', '6'], 'order preserved');
  assert.deepEqual(rest.map((g) => g.id), ['2', '5']);
  assert.equal(mine.length + rest.length, day.length, 'nothing dropped');
});

test('splitMine is a SUBSET of the day, never an invention', () => {
  const day = [teamGame('a', 'nfl', 'x', 'y'), program('b', 'wwe', 'weekly_show')];
  const { mine } = splitMine(day, new Set());
  for (const g of mine) assert.ok(day.includes(g), 'every scoped row came from the day');
});

// ---------------------------------------------------------------------------------------------
// R2, prompt 56: THE MY TEAMS SCOPE LINE, and the coverage that keeps it honest.
//
// The line's whole job is to stop MY TEAMS from silently under-describing itself. If a sixth
// team-less sport is ever added to TEAMLESS_SPORTS and not placed in a category, the line would go
// on saying "RACING + COMBAT SPORTS" over a scope that also contained something else - which is
// exactly the failure the line exists to fix. That is what the first test below refuses to allow.

import { TEAMLESS_CATEGORIES, scopeLine } from '../lib/favorites.js';

test('R2: the two category words cover TEAMLESS_SPORTS exactly - no gap, no invention', () => {
  const covered = Object.values(TEAMLESS_CATEGORIES).flat();
  assert.deepEqual([...covered].sort(), [...TEAMLESS_SPORTS].sort(),
    'every team-less sport falls into exactly one category, and no category names a sport that is ' +
    'not in the scope');
  assert.equal(covered.length, new Set(covered).size, 'no sport is in two categories');
  // `racing` is the app's OWN filter token for those two, not new vocabulary invented for the line.
  assert.deepEqual(TEAMLESS_CATEGORIES.racing, ['nascar', 'indycar']);
});

test('R2: `combat sports` is a display label and must never become a filter token', async () => {
  const { SPORT_FILTERS, SPORTS, expandSport } = await import('../lib/config.js');
  for (const label of Object.keys(TEAMLESS_CATEGORIES)) {
    if (label === 'racing') continue;                 // racing IS a token, deliberately
    assert.ok(!SPORT_FILTERS.includes(label), `${label} must not be a chip token`);
    assert.ok(!SPORTS.includes(label), `${label} must not be a sport value`);
    assert.deepEqual(expandSport(label), [], `${label} must not resolve to any query`);
  }
});

test('R2: the line is Joe\u2019s wording, and its club count is derived', () => {
  assert.equal(scopeLine(ids.size), 'MY TEAMS \u00b7 13 CLUBS + RACING + COMBAT SPORTS');
  // Derived, never written down: the day Joe adds a team the line follows on its own.
  assert.equal(scopeLine(14), 'MY TEAMS \u00b7 14 CLUBS + RACING + COMBAT SPORTS');
  assert.equal(scopeLine(1), 'MY TEAMS \u00b7 1 CLUB + RACING + COMBAT SPORTS', 'singular');
  assert.equal(scopeLine(0), 'MY TEAMS \u00b7 0 CLUBS + RACING + COMBAT SPORTS');
});

// ------------------------------------------- pregame shows sort before their game (prompt 71 s3)
//
// Joe, 2026-09-08: "please have all pregame shows render in their respective sport at the time they
// air. In that window - if the pregame show airs the same time as a game starts, the pregame show is
// listed first."
//
// Prompt 60 recorded this as open in app/page.js rather than fixing it in passing, and was right to;
// Joe has now answered the question. `allRows` is `[...games, ...programRows]`, two separately
// ordered reads concatenated, so ALL GAMES rendered a band's games and then its studio shows.

test('at an equal start time a studio show sorts BEFORE the game', () => {
  const game = { id: 'game', canonical_kickoff_at_utc: '2026-09-12T17:00:00Z' };
  const show = { id: 'show', program_id: 'p1', start_at: '2026-09-12T17:00:00Z' };
  // BOTH INPUT ORDERS, because a stable sort would otherwise let the database decide it - and decide
  // it differently on different days, which is what made this look intermittent.
  assert.deepEqual(chronological([game, show]).map((r) => r.id), ['show', 'game']);
  assert.deepEqual(chronological([show, game]).map((r) => r.id), ['show', 'game']);
});

test('the tie-break NEVER outranks the clock', () => {
  // A show at 4pm does not jump a game at 1pm. The tie-break applies only at an equal instant.
  const rows = [
    { id: 'game-1pm', canonical_kickoff_at_utc: '2026-09-12T17:00:00Z' },
    { id: 'game-4pm', canonical_kickoff_at_utc: '2026-09-12T20:00:00Z' },
    { id: 'show-12pm', program_id: 'p', start_at: '2026-09-12T16:00:00Z' },
    { id: 'show-4pm', program_id: 'p', start_at: '2026-09-12T20:00:00Z' },
  ];
  assert.deepEqual(chronological(rows).map((r) => r.id),
                   ['show-12pm', 'game-1pm', 'show-4pm', 'game-4pm']);
});

test('two shows at one instant keep database order - the tie-break is show-vs-game only', () => {
  const a = { id: 'a', program_id: 'p', start_at: '2026-09-12T17:00:00Z' };
  const b = { id: 'b', program_id: 'p', start_at: '2026-09-12T17:00:00Z' };
  assert.deepEqual(chronological([a, b]).map((r) => r.id), ['a', 'b']);
  assert.deepEqual(chronological([b, a]).map((r) => r.id), ['b', 'a']);
});

test('a TBD still sorts last, show or not', () => {
  const rows = [
    { id: 'tbd-show', program_id: 'p' },
    { id: 'game', canonical_kickoff_at_utc: '2026-09-12T17:00:00Z' },
  ];
  assert.deepEqual(chronological(rows).map((r) => r.id), ['game', 'tbd-show']);
});

test('ALL GAMES goes through the same sort - not a second one', () => {
  const page = readFileSync(new URL('../app/page.js', import.meta.url), 'utf8');
  // `, favIds)` SINCE PROMPT 80 D1 - the sort learned a third term and the ids come from the call
  // site. What this test is about is unchanged: ONE sort, not a second one for ALL GAMES.
  assert.match(page, /const scoped = chronological\(P\.isMine \? splitMine\(allRows, favIds\)\.mine : allRows, favIds\)/);
  // and the comment recording it as an open question is gone with the question
  assert.doesNotMatch(page, /ALL GAMES IS UNTOUCHED, deliberately/);
});

// ---------------------------------------------------------------- D1: time, then show, then favourite
//
// JOE'S RULING, 2026-09-09: "Organize qualifying events by TIME, including pregame shows and MyTeams
// games. THEN when events start at the same time, prioritize by: Pregame shows, MyTeams, Other
// events." The two tie-breaks are strictly ranked - a studio show beats a favourite game at the same
// minute - which is his "1) TIME 2) pre/post THEN myteams THEN other events" read literally.

const HERE_D1 = dirname(fileURLToPath(import.meta.url));
const src = (p) => readFileSync(join(HERE_D1, '..', p), 'utf8');

const ET = (hhmm) => `2026-09-13T${hhmm}:00.000Z`;
const show = (id, t) => ({ id, program_id: id, start_at: ET(t) });
const game = (id, t, home, away) => ({ id, canonical_kickoff_at_utc: ET(t), home_team_id: home, away_team_id: away });
const BROWNS = 'nfl-CLE';
const PANTHERS = 'nfl-CAR';
const D1_FAVS = new Set([BROWNS, PANTHERS]);

test("D1: Joe's Sunday NFL example comes out in his order", () => {
  // Six rows, two favourites, three studio shows, and TWO PAIRS TYING at 12:00 - which is the whole
  // point of the example. Deliberately shuffled going in, so a pass cannot come from input order.
  const rows = [
    game('panthers-bucs', '20:15', 'nfl-TB', PANTHERS),
    show('cbs-nfl-today', '12:00'),
    game('browns-steelers', '13:00', 'nfl-PIT', BROWNS),
    show('fox-nfl-kickoff', '11:00'),
    show('fnia', '19:00'),
    show('fox-nfl-sunday', '12:00'),
  ];
  const out = chronological(rows, D1_FAVS).map((r) => r.id);
  // THE FOUR POSITIONS THE COMPARATOR DECIDES. The two 12:00 SHOWS tie on time AND on being shows,
  // so the comparator returns 0 and their order is the order they arrived in - it is not something
  // this sort promises, and asserting Joe's listing order for them would be pinning the database's
  // luck. (The first version of this test did exactly that and failed for that reason.)
  assert.equal(out[0], 'fox-nfl-kickoff', '11:00, alone');
  assert.deepEqual(out.slice(1, 3).sort(), ['cbs-nfl-today', 'fox-nfl-sunday'],
    'both 12:00 SHOWS come next, ahead of the 13:00 game');
  assert.deepEqual(out.slice(3), ['browns-steelers', 'fnia', 'panthers-bucs'],
    '13:00, 19:00, 20:15 - in the clock order Joe asked for');
});

test('D1: at an equal time a STUDIO SHOW beats a favourite game', () => {
  // The ranking between the two tie-breaks, which is the half that could silently invert.
  const rows = [game('fav', '12:00', 'x', BROWNS), show('pre', '12:00')];
  assert.deepEqual(chronological(rows, D1_FAVS).map((r) => r.id), ['pre', 'fav']);
});

test('D1: at an equal time a FAVOURITE beats a non-favourite game', () => {
  const rows = [game('other', '12:00', 'x', 'y'), game('fav', '12:00', 'x', BROWNS)];
  assert.deepEqual(chronological(rows, D1_FAVS).map((r) => r.id), ['fav', 'other']);
});

test('D1: TIME still outranks both - a later favourite does not jump an earlier stranger', () => {
  // The failure this whole ordering exists to prevent: a favourites group floating out of the clock.
  const rows = [game('fav-late', '20:00', 'x', BROWNS), game('other-early', '12:00', 'x', 'y')];
  assert.deepEqual(chronological(rows, D1_FAVS).map((r) => r.id), ['other-early', 'fav-late']);
});

test('D1: the term is INERT under MY TEAMS, measured rather than assumed', () => {
  // Every row is a favourite there, so the comparator returns 0 for every pair and the order is
  // exactly what it was before this change. Asserted by comparing the two sorts directly rather than
  // by reasoning about it - "inert" is the assumption most likely to be wrong.
  const mine = [
    game('a', '13:00', 'x', BROWNS), show('pre', '13:00'),
    game('b', '12:00', 'x', PANTHERS), game('c', '20:00', PANTHERS, 'y'),
  ];
  assert.deepEqual(chronological(mine, D1_FAVS).map((r) => r.id),
                   chronological(mine).map((r) => r.id));
});

test('D1: with no ids at all the sort is byte-for-byte what it was', () => {
  const rows = [game('g', '12:00', 'x', 'y'), show('p', '12:00'), game('h', '11:00', 'x', 'y')];
  assert.deepEqual(chronological(rows, null).map((r) => r.id), chronological(rows).map((r) => r.id));
  assert.deepEqual(chronological(rows, new Set()).map((r) => r.id), chronological(rows).map((r) => r.id));
});

test('D1: BOTH call sites pass favIds - rule 32', () => {
  // Prompt 71's brief named day mode only and the week had the same defect. Two call sites, and the
  // week's is the one that has been forgotten before.
  // MATCHED TO END OF LINE, not with `[^)]*` - the call contains nested parens
  // (`splitMine(rows, favIds).mine`), and a paren class stops at the first one, which counted four
  // "call sites" where there are two.
  const code = src('app/page.js').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const calls = code.match(/const scoped = chronological\(.*$/gm) || [];
  assert.equal(calls.length, 2, `exactly two call sites, got ${calls.length}`);
  for (const c of calls) assert.match(c, /, favIds\);$/, `${c.trim()} must pass the ids`);
});

test('D1: the comparator does not restate isProgram or the favourite test', () => {
  const f = src('lib/favorites.js');
  assert.match(f, /import \{ isProgram \}/);
  // COMMENTS STRIPPED FIRST. The note above the tie-break SAYS `row.program_id != null` while
  // explaining why it is imported rather than restated, so a doesNotMatch over the raw source
  // matches the prose arguing the opposite - the trap prompt 73 found and prompt 74 swept for.
  const code = f.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  // `after`/`before` FROM test/region.mjs, never a bare anchored slice - prompt 74's structural
  // guard caught this the moment it was written, which is exactly what it is for.
  const fn = after(code, 'export function chronological', 'the comparator');
  assert.doesNotMatch(before(fn, '\n}', 'the end of the comparator'), /program_id\s*!=|home_team_id/,
    'both predicates are imported, never copied - they drift the moment there are two');
  assert.match(fn, /isProgram\(a\)/);
  assert.match(fn, /isFavorite\(a, favIds\)/);
});
