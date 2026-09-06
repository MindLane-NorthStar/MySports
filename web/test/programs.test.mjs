// Rendering contract v1.7 - the program card's arithmetic, pinned at the RUNTIME path.
//
// Working rule 24: a count computed on the Python side is no evidence the JS runtime agrees. These
// exercise the same functions web/components/MobileGrid.js and ProgramCard.js call, on every kind of
// input they can receive - a program with a brand and one without, a colour that parses and one that
// does not, a crew that fits and one that cannot.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  brandFor, crewNames, eligibilityMissing, fitCrew, hex, isOpenEnded, isProgram, programMinutes,
  provisionalBrands, rgb, rgba, seamGradient, slotWord, subtitleFor, tintToWhite, titleFor, toRow,
  toRows, typeOpenEnded, viewingDayOf, washGradient, WASH_PEAK, ENDCAP_TOP, ENDCAP_BOTTOM,
} from '../lib/programs.js';
import brandsDoc from '../../data/brands.json' with { type: 'json' };
import policies from '../../data/render_policies.json' with { type: 'json' };

const race = {
  program_id: 4699, sport: 'nascar', program_type: 'race_session',
  title: 'Cook Out Southern 500', start_at: '2026-09-06T21:00:00+00:00',
  expected_duration_min: 210, open_ended: true, brand_key: 'nascar',
  location_text: 'Darlington Raceway', hosts_crew: [],
  eligibility: [{ eligible: true, reason: 'linear usa-network', market_pending: false }],
};

// --------------------------------------------------------------------- the endcap is the RAIL TILE
test('the endcap gradient is the rail tile\'s own charcoal, not a retyped pair', () => {
  // globals.css --panel-top / --panel-bottom. Working rule 16: read, never quoted from a mockup.
  assert.equal(ENDCAP_TOP, '#31363d');
  assert.equal(ENDCAP_BOTTOM, '#1e2126');
});

// --------------------------------------------------------------------- the mirrored wash
test('the wash is symmetric about the centre, and the centre is charcoal', () => {
  const g = washGradient('#E60029');
  const stops = g.match(/rgba\([^)]+\)\s+\d+%/g);
  assert.equal(stops.length, 5);
  // stop 0 and stop 4 must be the same colour at the same distance from their own edge
  const [c0, p0] = [stops[0].slice(0, stops[0].lastIndexOf(' ')), stops[0].slice(stops[0].lastIndexOf(' ') + 1)];
  const [c4, p4] = [stops[4].slice(0, stops[4].lastIndexOf(' ')), stops[4].slice(stops[4].lastIndexOf(' ') + 1)];
  assert.equal(c0, c4, 'both edges carry the same colour');
  assert.equal(p0, '0%');
  assert.equal(p4, '100%');
  const [c1, p1] = [stops[1].slice(0, stops[1].lastIndexOf(' ')), stops[1].slice(stops[1].lastIndexOf(' ') + 1)];
  const [c3, p3] = [stops[3].slice(0, stops[3].lastIndexOf(' ')), stops[3].slice(stops[3].lastIndexOf(' ') + 1)];
  assert.equal(c1, c3, 'the two shoulders match');
  assert.equal(Number(p1.replace('%', '')) + Number(p3.replace('%', '')), 100, 'mirrored about 50%');
  assert.match(stops[2], /rgba\(230, 0, 41, 0\) 50%/, 'the centre is fully transparent brand = charcoal');
});

test('the peak is Joe\'s strong-edge 55%, not the soft variant', () => {
  assert.equal(WASH_PEAK, 0.55);
  assert.match(washGradient('#000000'), /rgba\(0, 0, 0, 0\.55\) 0%/);
});

test('the seam mirrors the wash: brand at both ends, charcoal at the centre', () => {
  assert.equal(
    seamGradient('#F0C850'),
    'linear-gradient(90deg, #F0C850 0%, #31363d 50%, #F0C850 100%)',
  );
});

test('an unparseable colour degrades to the charcoal rather than throwing', () => {
  assert.equal(rgb('not a colour'), null);
  assert.match(rgba('nope', 0.5), /^rgba\(49, 54, 61, 0\.5\)$/);
  assert.doesNotThrow(() => washGradient(undefined));
});

// --------------------------------------------------------------------- the subtitle tint
test('the subtitle is the brand colour 70% of the way to white', () => {
  assert.equal(tintToWhite('#000000'), '#b3b3b3');   // 0 + 255*0.7 = 178.5 -> b3
  assert.equal(tintToWhite('#ffffff'), '#ffffff');
  assert.equal(hex([255.6, -3, 128]), '#ff0080');    // clamped both ways
});

// --------------------------------------------------------------------- brands
test('every brand the design of record fixes carries its exact constant', () => {
  assert.equal(brandFor('gameday').color, '#F96302');  // Home Depot orange, Joe's ruling
  assert.equal(brandFor('ufc').color, '#D40707');
  assert.equal(brandFor('wwe').color, '#FD2F25');
  assert.equal(brandFor('nascar').color, '#E60029');
  assert.equal(brandFor('aew').color, '#F0C850');
});

test('a brand with no art in the tree has a null mark, so the endcap goes typographic', () => {
  // RE-BASED TWICE, and that is why it no longer names a brand. Stage 6 moved it off `gameday`
  // (whose art existed all along and was simply unwired) onto `foxnflsunday`, and stage 7 then
  // sourced art for that one too. Hardcoding a slug here just schedules the next failure, so the
  // case now PICKS a brand that still has none - and asserts there is one to pick.
  const bare = Object.entries(brandsDoc.brands).filter(([, v]) => !v.mark && !v.mark_dark);
  assert.ok(bare.length, 'if every brand has art this test is retired, not edited to pass');
  for (const [key] of bare) {
    const fb = brandFor(key);
    assert.equal(fb.mark, null, key);
    assert.equal(fb.mark_dark, null, key);
    assert.ok(fb.short_title, `${key} has a short title to set instead`);
  }
  const nascar = brandFor('nascar');
  assert.equal(nascar.mark_dark, '/leagues/nascar_dark.png');
});

test('the two studio marks that were built and never wired up now render', () => {
  // web/public/programs/ held both PNGs and a manifest with real ink-area factors since 2026-09-02,
  // and `git grep` found NOTHING under web/ referencing the folder. Two of the four shows Joe named
  // as "missing logos" were a wiring bug, not a sourcing problem.
  assert.equal(brandFor('gameday').mark_dark, '/programs/college-gameday.png');
  assert.equal(brandFor('bignoon').mark_dark, '/programs/big-noon-kickoff.png');
  // ONLY mark_dark is read - ProgramCard.js:73 and MobileGrid.js:764. Program brands publish one
  // file, already processed for a dark context, so `mark` is deliberately not populated.
  assert.equal(brandFor('gameday').mark, null);
  assert.equal(brandFor('bignoon').mark, null);
  // Wiring the mark does NOT re-derive the colour: Home Depot orange is Joe's explicit ruling.
  assert.equal(brandFor('gameday').color, '#F96302');
});

test('bignoon is no longer provisional - the mark exists, so a colour could be derived', () => {
  const bn = brandFor('bignoon');
  assert.equal(bn.provisional, undefined, 'the flag is cleared, not set to false');
  assert.equal(bn.color, '#33B1FF');
  assert.match(bn.color_source, /derived from web\/public\/programs\/big-noon-kickoff\.png/);
  // The old note - "no mark in the tree; FOX's cached wordmark is monochrome, so no colour to
  // derive" - became FALSE the moment the art landed. It is not deleted (it is part of the record)
  // and it is not left standing as if true: the note now QUOTES it and says why it was wrong.
  assert.match(bn.note, /PROVISIONAL CLEARED/);
  assert.match(bn.note, /was FALSE/, 'the correction is explicit, not implied by deletion');
});

test('an unknown brand key is a neutral card, never a blank or a throw', () => {
  const b = brandFor('no-such-brand');
  assert.equal(b.mark, null);
  assert.equal(b.color, brandsDoc._neutral);
  assert.equal(b.provisional, true);
});

test('provisional now means the COLOUR is a placeholder, which is not the same as having no art', () => {
  // THE OLD INVARIANT WAS "the colour and the art are missing together", and prompt 52 stage 7
  // broke it for a real reason rather than a sloppy one. Football Night in America HAS art now, and
  // still has no derivable colour: after the dark-context lift the wordmark is white and only 1.3%
  // of opaque pixels are saturated at all - the NBC peacock, which is multicolour by design. There
  // is no single hue that represents the brand, and picking one arm of a peacock would be an
  // invented fact. So it keeps the neutral AND keeps the flag.
  //
  // What still holds, and is the part worth pinning: a provisional brand carries the NEUTRAL.
  for (const key of provisionalBrands()) {
    assert.equal(brandFor(key).color, brandsDoc._neutral, `${key} is provisional, so it is neutral`);
  }
  // and every brand that is NOT provisional has a real colour of its own
  for (const [key, v] of Object.entries(brandsDoc.brands)) {
    if (v.provisional) continue;
    assert.notEqual(brandFor(key).color, brandsDoc._neutral, `${key} is not provisional`);
    assert.ok(brandFor(key).color_source, `${key} says where its colour came from`);
  }
});

test('every sourced mark records its provenance - a mark with no recorded source does not ship', () => {
  for (const [key, v] of Object.entries(brandsDoc.brands)) {
    if (!v.mark_dark) continue;
    if (v.mark_dark.startsWith('/leagues/')) continue;   // league marks, provenance in the contract
    assert.ok(v.mark_source, `${key} ships art with no recorded source`);
  }
});

// --------------------------------------------------------------------- open_ended
test('the per-program column wins when it is set', () => {
  assert.equal(isOpenEnded({ program_type: 'race_session', open_ended: false }), false);
  assert.equal(isOpenEnded({ program_type: 'game', open_ended: true }), true);
});

test('the per-type default applies when the column is absent', () => {
  assert.equal(isOpenEnded({ program_type: 'race_session' }), true);
  assert.equal(isOpenEnded({ program_type: 'fight_card' }), true);
  assert.equal(isOpenEnded({ program_type: 'weekly_show' }), false);
  assert.equal(typeOpenEnded('special_event'), true);
  assert.equal(typeOpenEnded('nothing_like_this'), false);
});

test('duration is the program\'s own, then the type default, then 180', () => {
  assert.equal(programMinutes({ program_type: 'race_session', expected_duration_min: 210 }), 210);
  assert.equal(programMinutes({ program_type: 'fight_card' }), 360);
  assert.equal(programMinutes({ program_type: 'studio_show' }), 120);
  assert.equal(programMinutes({ program_type: 'unknown' }), 180);
  assert.equal(programMinutes({ program_type: 'race_session', expected_duration_min: 0 }), 210);
});

// --------------------------------------------------------------------- the crew-fit rule
test('the crew run drops names from the RIGHT until it fits, and never truncates one', () => {
  const measure = (t) => t.length * 6;
  const crew = ['Mike Joy', 'Clint Bowyer', 'Kevin Harvick'];
  const all = fitCrew(crew, 400, measure, 'f');
  assert.deepEqual(all.names, crew);
  assert.equal(all.dropped, 0);
  const two = fitCrew(crew, 150, measure, 'f');
  assert.deepEqual(two.names, ['Mike Joy', 'Clint Bowyer']);
  assert.equal(two.dropped, 1);
  const one = fitCrew(crew, 60, measure, 'f');
  assert.deepEqual(one.names, ['Mike Joy']);
});

test('when not even one name fits, the WHOLE run goes - never an ellipsis', () => {
  const measure = (t) => t.length * 6;
  const out = fitCrew(['Mike Joy'], 10, measure, 'f');
  assert.deepEqual(out.names, []);
  assert.equal(out.text, '');
  assert.equal(out.dropped, 1);
});

test('no crew, no room and no measurer are all "no run", not a crash', () => {
  assert.equal(fitCrew([], 400, (t) => t.length, 'f').text, '');
  assert.equal(fitCrew(['A'], 0, (t) => t.length, 'f').text, '');
  assert.equal(fitCrew(['A'], 400, null, 'f').text, '');
});

test('hosts_crew is read from every shape an adapter can write', () => {
  assert.deepEqual(crewNames({ hosts_crew: ['A', 'B'] }), ['A', 'B']);
  assert.deepEqual(crewNames({ hosts_crew: [{ name: 'A' }, { name: 'B' }] }), ['A', 'B']);
  assert.deepEqual(crewNames({ hosts_crew: { crew: ['A'] } }), ['A']);
  assert.deepEqual(crewNames({ hosts_crew: [] }), []);
  assert.deepEqual(crewNames({}), []);
});

// --------------------------------------------------------------------- titles and subtitles
test('a studio show in-studio prints NO subtitle - studio city is road-only', () => {
  assert.equal(subtitleFor({ program_type: 'studio_show', location_text: 'Los Angeles' }), '');
  assert.equal(subtitleFor({ program_type: 'studio_show', subtitle: 'Live from Columbus, OH' }),
               'LIVE FROM COLUMBUS, OH');
});

test('a race falls back to its venue when it has no subtitle', () => {
  assert.equal(subtitleFor(race), 'DARLINGTON RACEWAY');
});

test('a program with no title renders a defect label, never a blank card', () => {
  assert.equal(titleFor({}), 'UNTITLED PROGRAM');
});

// --------------------------------------------------------------------- the normalizer
test('a program becomes a row every shared module already understands', () => {
  const row = toRow(race, new Date('2026-09-06T20:00:00Z'));
  assert.equal(row.id, 'program-4699');
  assert.equal(row.canonical_kickoff_at_utc, race.start_at);
  assert.equal(row.kickoff_status, 'set');
  assert.equal(row.sport, 'nascar');
  assert.equal(row.viewing_day, '2026-09-06');
});

test('the id is namespaced, so a program can never collide with a game id', () => {
  assert.match(toRow(race, Date.now()).id, /^program-/);
  assert.equal(isProgram(race), true);
  assert.equal(isProgram({ id: 'nhl-2026020011' }), false);
  assert.equal(isProgram(null), false);
});

test('result_status is derived from the instant passed in, never from a clock', () => {
  assert.equal(toRow(race, new Date('2026-09-06T20:00:00Z')).result_status, 'scheduled');
  assert.equal(toRow(race, new Date('2026-09-06T22:00:00Z')).result_status, 'in_progress');
  assert.equal(toRow(race, new Date('2026-09-07T02:00:00Z')).result_status, 'final');
});

test('the right slot says the same three words the game card says', () => {
  assert.equal(slotWord({ result_status: 'scheduled' }).text, 'Sched');
  assert.equal(slotWord({ result_status: 'in_progress' }).text, 'Live');
  assert.equal(slotWord({ result_status: 'final' }).text, 'Final');
  assert.equal(slotWord({}).text, 'Sched');
});

test('the viewing day runs to 03:00 ET, the same cutover the pipeline uses', () => {
  assert.equal(viewingDayOf('2026-09-06T21:00:00Z'), '2026-09-06');
  assert.equal(viewingDayOf('2026-09-07T06:59:00Z'), '2026-09-06');   // 02:59 ET, still that evening
  assert.equal(viewingDayOf('2026-09-07T07:00:00Z'), '2026-09-07');   // 03:00 ET, the next day
  assert.equal(viewingDayOf('2026-01-15T05:30:00Z'), '2026-01-14');   // EST, and it still rolls back
  assert.equal(viewingDayOf('nonsense'), null);
});

test('toRows keeps order and drops nothing that is real', () => {
  assert.equal(toRows([race, race], Date.now()).length, 2);
  assert.deepEqual(toRows(null, Date.now()), []);
});

// --------------------------------------------------------------------- the eligibility defect cue
test('a program with no eligibility row is a DEFECT, never silently watchable', () => {
  assert.equal(eligibilityMissing(race), false);
  assert.equal(eligibilityMissing({ ...race, eligibility: [] }), true);
  assert.equal(eligibilityMissing({ ...race, eligibility: null }), true);
  assert.equal(eligibilityMissing({}), true);
});

// --------------------------------------------------------------------- register section 12
test('the five program sports carry a prime_window_start, so D1 can see them', () => {
  for (const s of ['nascar', 'indycar', 'ufc', 'wwe', 'aew']) {
    assert.ok(policies[s], `${s} has no render policy`);
    assert.match(policies[s].prime_window_start, /^\d{2}:\d{2}$/);
    assert.ok(policies[s]._source, `${s} must say where its numbers came from`);
    assert.ok(Number(policies[s].block_minutes) > 0);
  }
});

test('the five game sports are untouched by that addition', () => {
  assert.equal(policies.cfb.prime_window_start, '12:00');
  assert.equal(policies.nfl.prime_window_start, '13:00');
  assert.equal(policies.mlb.block_minutes, 180);
  assert.equal(policies.nhl.block_minutes, 150);
  assert.equal(policies.nba.open_ended, false);
});
