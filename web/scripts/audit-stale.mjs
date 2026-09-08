#!/usr/bin/env node
// Which loaded games never got their result? READ ONLY - it writes nothing, anywhere.
//
//     node scripts/audit-stale.mjs                 # the last 7 viewing days
//     node scripts/audit-stale.mjs 2026-09-01 2026-09-08
//
// WHY THIS EXISTS. Joe, 2026-09-08: "any game that has completed is still showing betting odds."
// The UI was not at fault - `slotContent` returns the score rung for anything `final` and only
// reaches the odds rung when a game is still `scheduled`, so a completed game showing odds means
// the ROW never left `scheduled`. This is the tool that says so with numbers instead of a screenshot.
//
// TWO STALE SHAPES, AND THE REPO ONLY HAD A TOOL FOR ONE. `scripts/backfill_stale_finals.py` closes
// out rows stuck in `in_progress` long after they can still be playing. A row stuck in `scheduled`
// is the adjacent case and had nothing: it means no fetch ever covered the game AFTER it finished,
// so the provider's final never arrived at all.
//
// Anon PostgREST reads, and `restAll` throughout - an unbounded select silently caps at 1000 rows
// with no error (working rule 19).

import { restAll } from '../lib/rest.js';

const STALE_AFTER_H = 5;   // a game that kicked off this long ago has finished, in every sport here

function isoDay(d) { return d.toISOString().slice(0, 10); }

const today = new Date();
const from = process.argv[2] || isoDay(new Date(today.getTime() - 7 * 864e5));
const to = process.argv[3] || isoDay(today);

const rows = await restAll(
  `games?select=id,sport,viewing_day,canonical_kickoff_at_utc,result_status,home_score,away_score,`
  + `completed_at&viewing_day=gte.${from}&viewing_day=lte.${to}`
  + `&order=viewing_day.asc,canonical_kickoff_at_utc.asc`);

const now = Date.now();
const started = rows.filter((g) => {
  const t = Date.parse(g.canonical_kickoff_at_utc);
  return Number.isFinite(t) && now - t > STALE_AFTER_H * 3600e3;
});

const bucket = (g) => (g.result_status === 'final' ? 'final'
  : g.result_status === 'in_progress' ? 'in_progress (backfill_stale_finals.py covers this)'
    : `${g.result_status || 'null'} (NO tool covers this)`);

const counts = {};
for (const g of started) counts[bucket(g)] = (counts[bucket(g)] || 0) + 1;

console.log(`viewing days ${from} .. ${to}`);
console.log(`  ${rows.length} games loaded, ${started.length} kicked off more than ${STALE_AFTER_H}h ago`);
for (const k of Object.keys(counts).sort()) console.log(`    ${String(counts[k]).padStart(4)}  ${k}`);

const stale = started.filter((g) => g.result_status !== 'final');
if (!stale.length) {
  console.log('\n  nothing stale - every started game has its result');
} else {
  console.log(`\n  ${stale.length} STALE:`);
  const byDay = {};
  for (const g of stale) (byDay[g.viewing_day] ||= []).push(g);
  for (const d of Object.keys(byDay).sort()) {
    const list = byDay[d];
    const sports = [...new Set(list.map((g) => g.sport))].join(',');
    console.log(`    ${d}  ${String(list.length).padStart(3)} game(s)  [${sports}]`);
    for (const g of list.slice(0, 6)) {
      console.log(`        ${g.id.padEnd(16)} ${String(g.result_status).padEnd(12)} `
        + `scores ${g.away_score}/${g.home_score}  completed_at ${g.completed_at}`);
    }
    if (list.length > 6) console.log(`        ... and ${list.length - 6} more`);
  }
}

// The freshest thing the loader wrote, which is what says whether a refresh has run at all.
const newest = rows.map((g) => g.completed_at).filter(Boolean).sort().slice(-1)[0];
console.log(`\n  newest completed_at in range: ${newest || '(none)'}`);
console.log('  compare against: gh run list --workflow schedule_refresh.yml -L 1');
