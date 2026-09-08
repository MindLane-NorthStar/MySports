// THE RESHAPED GEOMETRY CHECK (prompt 54 stage 3).
//
// Prompt 53 found the MLB tripwire firing with NO CODE CHANGE: block widths and scrollWidth derive
// from `widest`, the widest rendered team line on the slate, and that line carries the team's RECORD
// and its CFB POLL RANK. Both drift all season. Re-baselining resets a clock; a tripwire that fires
// on the standings gets ignored, and an ignored tripwire catches nothing.
//
// So the checks are split by what they are a function of:
//   HARD STOP   code-derived, immune to data
//   REPORT      data-derived, recorded WITH `widest` so the next run can tell data from code
//
// Usage:  node qa/tools/geometry.mjs [baseUrl]
import { chromium } from 'playwright';

const BASE = (process.argv[2] || 'http://localhost:3001').replace(/\/+$/, '');
const fails = [];
const hard = (ok, label, detail) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) fails.push(label);
};

const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
});
const page = await ctx.newPage();
const go = async (url) => {
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
};

const shape = () => page.evaluate(() => {
  const cv = document.querySelector('.mgrid-canvas');
  if (!cv) return null;
  const rows = [...document.querySelectorAll('.mgrid-row')].map((r) => ({
    id: r.id,
    blocks: r.querySelectorAll('.mblock').length,
    lanes: Math.round(r.querySelector('.mgrid-lanes')?.getBoundingClientRect().height || 0),
  }));
  const bw = [...document.querySelectorAll('.mblock')].map((e) => +e.getBoundingClientRect().width.toFixed(1));
  const names = [...document.querySelectorAll('.mname')];
  return {
    rows, rowCount: rows.length, blocks: bw.length,
    widths: [...new Set(bw.map(Math.round))].sort((a, x) => x - a),
    minBlock: bw.length ? Math.min(...bw) : null,
    scrollWidth: document.querySelector('.mgrid-scroll').scrollWidth,
    widest: +cv.dataset.widest,
    pxPerMin: +cv.dataset.pxpermin,
    // OVERFLOW, not height/line-height. `.mname` is a FIXED-HEIGHT box (29.1px) whose line-height
    // moves with the fitted font size, so a ratio test flags names that are perfectly on one line -
    // a first pass called "UT RIO GRANDE VALLEY" wrapped at 1.52x when it is not. scrollHeight vs
    // clientHeight is the actual question: did the content need more room than the box gives it.
    wrapped: names.filter((n) => n.scrollHeight > n.clientHeight + 1).length,
    clipped: names.filter((n) => n.scrollWidth > n.clientWidth + 1).length,
  };
});

// ------------------------------------------------------------------ 1. HARD STOPS, day mode
console.log('HARD STOPS - code-derived, immune to the standings');
console.log('');
for (const [d, sport] of [['2026-09-05', 'cfb'], ['2026-09-03', 'mlb'], ['2026-09-13', 'nfl']]) {
  await go(`/?day=${d}&sport=${sport}&view=grid`);
  const m = await shape();
  hard(m && m.blocks > 0 && m.rowCount > 0, `${d} ${sport}: renders`,
    m ? `${m.blocks} blocks / ${m.rowCount} network rows` : 'no canvas');
  hard(m.minBlock >= 46, `${d} ${sport}: no block below the 46px floor`, `min ${m.minBlock}px`);
  hard(m.wrapped === 0, `${d} ${sport}: no team name wraps`, `${m.wrapped} wrapped`);
  hard(m.clipped === 0, `${d} ${sport}: no team name truncated`, `${m.clipped} clipped`);
}

// ------------------------------------------------------------------ 2. HARD STOPS, zoom (prompt 30)
console.log('');
for (const z of [1, 2.5, 0.6]) {
  await go('/?day=2026-09-05&sport=cfb&view=grid');
  if (z !== 1) {
    await page.locator('.mgrid-canvas').evaluate((canvas, zz) => {
      const r = canvas.getBoundingClientRect(); const cy = r.top + 100;
      const mk = (dd) => [
        new Touch({ identifier: 1, target: canvas, clientX: 100, clientY: cy }),
        new Touch({ identifier: 2, target: canvas, clientX: 100 + dd, clientY: cy }),
      ];
      canvas.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: mk(200) }));
      canvas.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: mk(Math.max(6, Math.round(200 * zz))) }));
      canvas.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [] }));
    }, z);
    await page.waitForTimeout(400);
  }
  await page.locator('.mgrid-scroll').evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => {
    const s = document.querySelector('.mgrid-scroll');
    const cv = document.querySelector('.mgrid-canvas');
    const rail = document.querySelector('.mrail-cell');
    return {
      delta: rail.getBoundingClientRect().left - s.getBoundingClientRect().left,
      painted: Math.round(cv.getBoundingClientRect().width),
      laid: Math.round(parseFloat(getComputedStyle(cv).width)),
      scrolled: s.scrollLeft,
    };
  });
  hard(Math.abs(m.delta) < 1.5 && m.scrolled > 0, `M4: rail pinned at zoom ${z}`, `delta ${m.delta.toFixed(1)}px`);
  hard(m.painted === m.laid, `M6: painted width == laid-out width at zoom ${z}`, `${m.painted} vs ${m.laid}`);
}

// ------------------------------------------------------------------ 3. THE WEEK'S OWN CHECK
//
// A grid inside a week must produce IDENTICAL geometry to the same day rendered in day mode - same
// component, same data, same everything. That comparison is COMPLETELY IMMUNE to data drift, because
// both sides see the same standings on the same run. It is the strongest check available here and is
// the week grid's primary guard: if the two differ, the week path is handing MobileGrid different
// input, and that is the bug.
console.log('');
console.log('DAY / WEEK GEOMETRY EQUALITY - immune to drift: both sides see the same standings');
console.log('');

const gridFor = (day) => page.evaluate((dd) => {
  const cv = [...document.querySelectorAll('.mgrid-canvas')].find((c) => c.dataset.day === dd);
  if (!cv) return null;
  const scope = cv.closest('.weekday') || document;
  const rows = [...scope.querySelectorAll('.mgrid-row')].map((r) => ({
    id: r.id,
    blocks: r.querySelectorAll('.mblock').length,
    lanes: Math.round(r.querySelector('.mgrid-lanes')?.getBoundingClientRect().height || 0),
  }));
  const bw = [...scope.querySelectorAll('.mblock')].map((e) => +e.getBoundingClientRect().width.toFixed(1));
  return {
    rows, rowCount: rows.length, blocks: bw.length,
    widths: [...new Set(bw.map(Math.round))].sort((a, x) => x - a),
    scrollWidth: cv.closest('.mgrid-scroll').scrollWidth,
    widest: +cv.dataset.widest, pxPerMin: +cv.dataset.pxpermin,
  };
}, day);

// SEASON-WEEK SPORTS ARE KEYED BY THEIR SEASON WEEK, NOT BY A DATE (corrected 2026-09-08).
// CFB and NFL run on season weeks, so their `?w=` keys are `cfb-2026-1` / `nfl-2026-1`; MLB and ALL
// SPORTS run on calendar weeks and are keyed by the Monday, which is why those two are dates here.
//
// BOTH SEASON CASES USED TO PASS A DATE, AND BOTH PASSED BY ACCIDENT. A `?w=` that matches nothing
// falls back to the CURRENT week, which happened to be the week containing the case's day - until
// the date rolled past Sunday Sep 7 and CFB's fallback moved to week 2 (Sep 10-12). The gate then
// reported "missing (day true, week false)" for a day the app renders perfectly well. NFL's case was
// the same time bomb and had simply not gone off yet.
//
// This is a correction to the gate's INPUT, not a re-baseline of a measured figure: the day/week
// equality it checks is unchanged, and it is now immune to the date rather than quietly dependent
// on it.
const CASES = [
  ['2026-09-05', 'cfb', 'cfb-2026-1'],
  ['2026-09-03', 'mlb', '2026-08-31'],
  ['2026-09-13', 'nfl', 'nfl-2026-1'],
  ['2026-09-03', null, '2026-08-31'],   // ALL SPORTS - a slate spanning more than one sport
];
for (const [day, sport, wk] of CASES) {
  const sp = sport ? `&sport=${sport}` : '';
  await go(`/?day=${day}${sp}&view=grid`);
  const inDay = await gridFor(day);
  await go(`/?mode=week&w=${wk}${sp}&view=grid`);
  const inWeek = await gridFor(day);
  const label = `${day} ${sport || 'ALL SPORTS'} in week ${wk}`;
  if (!inDay || !inWeek) {
    hard(false, label, `missing (day ${Boolean(inDay)}, week ${Boolean(inWeek)})`);
    continue;
  }
  const same = (a, x) => JSON.stringify(a) === JSON.stringify(x);
  hard(inDay.blocks === inWeek.blocks, `${label} - block count`, `${inDay.blocks} vs ${inWeek.blocks}`);
  hard(inDay.rowCount === inWeek.rowCount, `${label} - network rows`, `${inDay.rowCount} vs ${inWeek.rowCount}`);
  hard(same(inDay.rows, inWeek.rows), `${label} - per-row blocks and lanes`, `${inDay.rowCount} rows`);
  hard(same(inDay.widths, inWeek.widths), `${label} - block widths`,
    `{${inDay.widths.join(',')}} vs {${inWeek.widths.join(',')}}`);
  hard(inDay.scrollWidth === inWeek.scrollWidth, `${label} - scrollWidth`,
    `${inDay.scrollWidth} vs ${inWeek.scrollWidth}`);
  hard(inDay.widest === inWeek.widest, `${label} - widest`, `${inDay.widest} vs ${inWeek.widest}`);
}

// ------------------------------------------------------------------ 4. REPORTED, not asserted
console.log('');
console.log('REPORTED - data-derived, drifts with the standings and the CFB poll.');
// THE RATIO TO WATCH IS sw/(widest+182), NOT sw/widest (corrected 2026-09-08, prompt 66).
// pxPerMinute = (widest + 2*CAP + NAME_PAD) / blockMinutes = (widest + 182) / blockMinutes
// (gridmodel.js:46), so scrollWidth scales with widest+182. sw/widest therefore moves whenever
// widest moves, on pure standings drift with no code involved - it called the MLB row a CODE change
// in prompt 64 and the cause was the records. Both are printed so an old report still lines up.
const K = 2 * 74 + 34;   // 2*CAP + NAME_PAD, the offset in pxPerMinute
console.log('The tell is sw/(widest+182): it HOLDS under standings drift.');
console.log('sw/widest moves whenever widest moves and is NOT the test. sw/(widest+182) moved -> CODE.');
console.log('');
console.log('  day         sport  blocks  rows  widths                     widest  scrollWidth  sw/widest  sw/(w+182)');
for (const [d, sport] of [['2026-09-05', 'cfb'], ['2026-09-03', 'mlb'], ['2026-09-13', 'nfl']]) {
  await go(`/?day=${d}&sport=${sport}&view=grid`);
  const m = await shape();
  console.log(`  ${d}  ${sport.padEnd(5)} ${String(m.blocks).padStart(6)} ${String(m.rowCount).padStart(5)}  `
    + `{${m.widths.join(', ')}}`.padEnd(27)
    + `${m.widest.toFixed(2).padStart(7)} ${String(m.scrollWidth).padStart(12)} `
    + `${(m.scrollWidth / m.widest).toFixed(4).padStart(10)}`
    + `${(m.scrollWidth / (m.widest + K)).toFixed(4).padStart(12)}`);
}

await b.close();
console.log('');
console.log(fails.length ? `FAILED: ${fails.length}` : 'ALL HARD STOPS PASSED');
process.exit(fails.length ? 1 : 0);
