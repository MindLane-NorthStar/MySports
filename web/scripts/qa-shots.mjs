#!/usr/bin/env node
// QA screenshot pass - every view at mobile (390x844 @2x) and desktop (1440x900).
//
//     node scripts/qa-shots.mjs <outDir> [baseUrl]
//
// Also runs the two behavioural assertions the spec audit cannot make from a static image:
//   * the mobile rail stays at x=0 after a horizontal pan (addendum M4);
//   * no team name wraps to a second line anywhere on the mobile grid (M2, "by construction").
//
// Results print as PASS/FAIL lines and land in <outDir>/assertions.json.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const outDir = process.argv[2] || 'qa';
const base = (process.argv[3] || 'http://localhost:3000').replace(/\/+$/, '');
mkdirSync(outDir, { recursive: true });

const VIEWS = [
  { name: 'today-mlb', path: '/?day=2026-09-03&sport=mlb' },
  { name: 'today-mlb-2', path: '/?day=2026-09-04&sport=mlb' },
  { name: 'today-cfb', path: '/?day=2026-09-05&sport=cfb' },
  { name: 'today-nfl', path: '/?day=2026-09-13&sport=nfl' },
  { name: 'today-nhl', path: '/?day=2026-10-01&sport=nhl' },
  { name: 'today-nba', path: '/?day=2026-10-28&sport=nba' },
  { name: 'today-all', path: '/?day=2026-09-03' },
  // PROMPT 50: one route. These were `/weeks`, `/weeks?sport=nfl` and `/history`; all three still
  // resolve (they redirect), but the shots are taken at the hub URLs they redirect TO, so a failure
  // points at the page rather than at a redirect hop.
  //
  // The SPORT still chooses the week concept - no chip is the calendar week over every sport, and
  // nfl is a season-week sport, so its own chip is what puts the page in season weeks.
  { name: 'weeks-calendar', path: '/?mode=week' },
  { name: 'weeks-season', path: '/?mode=week&sport=nfl' },
  // HISTORY IS RETIRED AS NAVIGATION, NOT AS FUNCTIONALITY (R1): a past day is how finals are
  // reached now, so that is what this shot proves.
  { name: 'history', path: '/?day=2026-08-31&sport=mlb' },
];

const DEVICES = [
  { key: 'mobile', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { key: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
];

const results = [];
function record(label, pass, detail) {
  results.push({ label, pass, detail });
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
}

const browser = await chromium.launch();

for (const dev of DEVICES) {
  const ctx = await browser.newContext({
    viewport: dev.viewport,
    deviceScaleFactor: dev.deviceScaleFactor,
    isMobile: dev.isMobile,
    hasTouch: dev.hasTouch,
  });
  const page = await ctx.newPage();
  for (const v of VIEWS) {
    await page.goto(`${base}${v.path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(450);
    const shot = join(outDir, `${dev.key}__${v.name}.png`);
    try {
      await page.screenshot({ path: shot, fullPage: true });
    } catch (e) {
      // Chromium refuses to rasterize a page past ~16k px; fall back to the viewport and say so.
      await page.screenshot({ path: shot, fullPage: false });
      console.log(`  note  ${dev.key}/${v.name}: page too tall for a full-page capture, viewport only`);
    }
  }
  await ctx.close();
}

// ------------------------------------------------------------------ behavioural assertions (mobile)
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  // THE GRID LIVES IN GRID VIEW NOW (prompt 55 stage 1, Joe: "I only want list cards on list view
  // and only grids on grid view"). This block used to load a bare day URL because 05 section 11 put
  // the grid INSIDE the list - a pre-toggle arrangement, ruled 2026-09-03, three days before the
  // LIST | GRID toggle existed. The M2/M4/M6/M11 assertions below are about the GRID and are
  // unchanged; only the URL that reaches one moved.
  await page.goto(`${base}/?day=2026-09-03&sport=mlb&view=grid`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const hasGrid = await page.locator('.mgrid').count();
  record('mobile grid renders', hasGrid > 0, `${hasGrid} grid(s)`);

  // M4 - the rail stays pinned at x=0 through a horizontal pan
  const railBefore = await page.locator('.mrail-cell').first().boundingBox();
  await page.locator('.mgrid-scroll').evaluate((el) => {
    el.scrollLeft = el.scrollWidth;
  });
  await page.waitForTimeout(300);
  const railAfter = await page.locator('.mrail-cell').first().boundingBox();
  const scrolled = await page.locator('.mgrid-scroll').evaluate((el) => el.scrollLeft);
  record(
    'M4: rail stays fixed at x=0 after a horizontal pan',
    railBefore && railAfter && Math.abs(railAfter.x - railBefore.x) < 1.5 && scrolled > 0,
    `x ${railBefore?.x?.toFixed(1)} -> ${railAfter?.x?.toFixed(1)}, scrollLeft ${scrolled}`
  );
  await page.screenshot({ path: join(outDir, 'mobile__grid-panned.png'), fullPage: false });

  // M4 UNDER ZOOM (prompt 30). The rule above only ever tested zoom 1, which is why the transform bug
  // survived: `transform: scale(zoom)` on .mgrid-canvas made it the containing block for the sticky
  // rail inside it, so the rail resolved against the scaled content and slid across the screen. Joe
  // found it on the installed app; Chromium reproduces it at +124.6px right of the scroller at zoom
  // 2.5. Zoom is a layout width now, and these three levels are the guard.
  for (const z of [1, 2.5, 0.6]) {
    // Reload between levels: the pinch handler is RELATIVE to the current zoom, so without this a
    // "0.6" pass after a "2.5" pass would land somewhere in between and the label would be a lie.
    if (z !== 1) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.mgrid-canvas', { timeout: 30000 });
      await page.waitForTimeout(800);
    }
    if (z !== 1) {
      await page.locator('.mgrid-canvas').evaluate((canvas, zz) => {
        const r = canvas.getBoundingClientRect();
        const cy = r.top + 100;
        const mk = (d) => [
          new Touch({ identifier: 1, target: canvas, clientX: 100, clientY: cy }),
          new Touch({ identifier: 2, target: canvas, clientX: 100 + d, clientY: cy }),
        ];
        canvas.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: mk(200) }));
        canvas.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, cancelable: true, touches: mk(Math.max(6, Math.round(200 * zz))) }));
        canvas.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [] }));
      }, z);
      await page.waitForTimeout(350);
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
        laidOut: cv.offsetWidth,
        scrolled: Math.round(s.scrollLeft),
      };
    });
    record(
      `M4: rail pinned at the scroller edge at zoom ${z}`,
      Math.abs(m.delta) < 1.5 && m.scrolled > 0,
      `delta ${m.delta.toFixed(1)}px, scrollLeft ${m.scrolled}`
    );
    record(
      `M6: canvas painted width equals its laid-out width at zoom ${z}`,
      Math.abs(m.painted - m.laidOut) <= 1,
      `${m.painted} vs ${m.laidOut}`
    );
    if (z === 2.5) {
      // The GRID element, not the viewport: the page is scrolled to the top, so a viewport shot here
      // would photograph the banner and prove nothing about the rail.
      const grid = await page.$('.mgrid');
      if (grid) await grid.screenshot({ path: join(outDir, 'mobile__grid-zoom-max-right-edge.png') });
    }
  }
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.mgrid', { timeout: 30000 });
  await page.waitForTimeout(800);


  // M2 - computed PX means no team name ever wraps to a second line
  const wraps = await page.$$eval('.mgrid .mname', (nodes) =>
    nodes
      .map((n) => {
        const lh = parseFloat(getComputedStyle(n).lineHeight) || n.getBoundingClientRect().height;
        return { text: n.textContent.trim(), h: n.getBoundingClientRect().height, lh };
      })
      .filter((x) => x.h > x.lh * 1.6)
  );
  record('M2: no team name wraps to a second line', wraps.length === 0, `${wraps.length} wrapped`);

  // M5 - axis labels are hour-only, gold, uppercase
  const labels = await page.$$eval('.maxis-label', (nodes) =>
    nodes.map((n) => ({ text: n.textContent.trim(), color: getComputedStyle(n).color }))
  );
  const shorthand = /^(NOON|MIDNIGHT|\d{1,2}(AM|PM))$/;
  record(
    'M5: every axis label is hour-only shorthand',
    labels.length > 0 && labels.every((l) => shorthand.test(l.text)),
    `${labels.length} labels, e.g. ${labels.slice(0, 4).map((l) => l.text).join(' ')}`
  );
  record(
    'M5: axis labels are gold',
    // PROMPT 52 STAGE 3: the metallic gold. --gold moved #f0c850 -> #C6AF7A (handoff §4), so the
    // computed colour moves with it. The assertion is RE-BASED on the new token, not weakened -
    // it still pins that every axis label carries the app's gold and no other colour. Addendum
    // M5 is amended to match in the same run.
    labels.length > 0 && labels.every((l) => l.color === 'rgb(198, 175, 122)'),
    labels[0]?.color || 'none'
  );

  // the detail panel opens from a block tap (M11)
  const block = page.locator('.mblock').first();
  if (await block.count()) {
    await block.click();
    await page.waitForTimeout(350);
    const open = await page.locator('.dpanel').count();
    record('M11: tapping a block opens the detail panel', open > 0);
    if (open) await page.screenshot({ path: join(outDir, 'mobile__detail-panel.png'), fullPage: false });
    await page.keyboard.press('Escape');
  } else {
    record('M11: tapping a block opens the detail panel', false, 'no block to tap');
  }

  // no white backing plate behind any logo anywhere
  const plates = await page.$$eval('img', (nodes) =>
    nodes
      .map((n) => {
        const bg = getComputedStyle(n).backgroundColor;
        const parentBg = getComputedStyle(n.parentElement || n).backgroundColor;
        return { src: n.getAttribute('src') || '', bg, parentBg };
      })
      .filter((x) => /^rgb\(2[3-5]\d, 2[3-5]\d, 2[3-5]\d\)$/.test(x.bg))
  );
  record('no white backing card behind any logo', plates.length === 0, `${plates.length} found`);

  await ctx.close();
}

// ------------------------------------------------------------------ a final, with its box score
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  // R1: History is retired as a ROUTE, so the finals it existed to show are reached by picking a
  // past day on the hub. 2026-08-31 is the MLB slate the smoke test pins as 12 finals, every one
  // carrying a box-score URL - so if this fails, the functionality was lost, not just the route.
  await page.goto(`${base}/?day=2026-08-31&sport=mlb`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const card = page.locator('.mcard').first();
  if (await card.count()) {
    await card.click();
    await page.waitForTimeout(350);
    const box = await page.locator('.dpanel .dlink', { hasText: 'Box score' }).count();
    record('a final game exposes a box-score link in its panel', box > 0);
    await page.screenshot({ path: join(outDir, 'mobile__detail-final.png'), fullPage: false });
  } else {
    record('a final game exposes a box-score link in its panel', false, 'no final card');
  }
  await ctx.close();
}

// ------------------------------------------ the navbar renders in EVERY view (prompt 58, lifted)
//
// IT USED TO BE ABSENT FROM THE DOM IN ALL FOUR GRID VIEWS, and this block asserted that. The
// exclusion cost more than it bought: tapping GRID in the bar sets `view=grid` with
// `{ scroll: false }`, so the reader does not move - but the component then vanished, the collapsed
// state was cleared, and ~340px of banner and control stack returned to the flow above them, with
// no compensation. The control deleted itself with the tap that used it.
//
// WHAT THE EXCLUSION WAS HEDGING AGAINST IS REAL, and it is measured in the block below rather than
// denied. It was never that the bar would break the grid's sticky rail - a header mounted beside
// `Chrome` is a sibling of `.shell` and can never be an ancestor of `.mrail-cell`. It is that the
// bar's 45px sits over the top of `.mgrid-scroll`, which owns the pinch.
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  const DAY = '2026-09-05';
  const WEEK = '2026-08-31';
  const views = [
    ['day / all games / GRID', `/?day=${DAY}&view=grid`],
    ['day / my teams / GRID', `/?day=${DAY}&scope=mine&view=grid`],
    ['week / all games / GRID', `/?mode=week&w=${WEEK}&view=grid`],
    ['week / my teams / GRID', `/?mode=week&w=${WEEK}&scope=mine&view=grid`],
    ['day / all games / list', `/?day=${DAY}`],
    ['day / my teams / list', `/?day=${DAY}&scope=mine`],
    ['week / all games / list', `/?mode=week&w=${WEEK}`],
    ['week / my teams / list', `/?mode=week&w=${WEEK}&scope=mine`],
  ];
  for (const [name, path] of views) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    // scrolled well past the sentinel, which is where the bar shows
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(450);
    const n = await page.locator('.chdr').count();
    record(`navbar present in ${name}`, n === 1, `${n} in the DOM`);
  }

  // THE DEFECT THE EXCLUSION CAUSED, pinned so it cannot come back: tapping GRID in the bar must
  // keep the collapse AND keep the reader where they were.
  await page.goto(`${base}/?day=${DAY}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(600);
  const gridTap = await page.evaluate(() => ({
    hdr: document.documentElement.getAttribute('data-hdr'),
    top: document.querySelector('.hubctl') ? null : null,
  }));
  await page.click('.chdr-toggle[data-key="view"]');
  await page.waitForTimeout(900);
  const afterTap = await page.evaluate(() => ({
    hdr: document.documentElement.getAttribute('data-hdr'),
    bar: document.querySelectorAll('.chdr').length,
    banner: getComputedStyle(document.querySelector('.banner')).display,
    grid: document.querySelectorAll('.mgrid-scroll').length,
    url: location.search,
  }));
  record('tapping GRID in the navbar keeps the collapse',
         gridTap.hdr === 'collapsed' && afterTap.hdr === 'collapsed' && afterTap.bar === 1
         && afterTap.banner === 'none' && /view=grid/.test(afterTap.url),
         `data-hdr=${afterTap.hdr}, ${afterTap.bar} bar, banner ${afterTap.banner}, ${afterTap.url}`);
  // and back again, which is the half the old one-way door could not do at all
  await page.click('.chdr-toggle[data-key="view"]');
  await page.waitForTimeout(900);
  const backToList = await page.evaluate(() => ({
    hdr: document.documentElement.getAttribute('data-hdr'), url: location.search,
    name: document.querySelector('.chdr-toggle[data-key="view"]').getAttribute('aria-label'),
  }));
  record('and GRID -> LIST works from the same control',
         backToList.hdr === 'collapsed' && !/view=/.test(backToList.url)
         && backToList.name === 'Presentation: List view. Switch to Grid view',
         `${backToList.url || '(no view param)'} / ${backToList.name}`);
  await ctx.close();
}

// ------------------------------------- what the grid exclusion was hedging against, MEASURED
//
// The hedge was never tested and it is real. `.chdr` is `position: fixed` over the top 45px of the
// viewport and a SIBLING of `.shell`, so a touch landing there targets the bar and never reaches
// `.mgrid-scroll`'s pinch listeners. This block records the cost as a number so it cannot grow
// quietly, and records the two things that make it acceptable: the band is INERT - a drag starting
// on any control activates nothing, because a drag cancels the click - and the gesture works
// normally a few pixels lower.
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const touch = async (type, pts) => {
    await cdp.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: pts.map(([x, y], i) => ({ x, y, id: i, radiusX: 12, radiusY: 12, force: 1 })),
    });
    await page.waitForTimeout(50);
  };
  await page.goto(`${base}/?day=2026-09-05&sport=cfb&view=grid`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, 3000));
  await page.waitForTimeout(700);

  const g = await page.evaluate(() => {
    const br = document.querySelector('.chdr').getBoundingClientRect();
    const sr = document.querySelector('.mgrid-scroll').getBoundingClientRect();
    return { barBottom: Math.round(br.bottom),
             overlap: Math.max(0, Math.min(br.bottom, sr.bottom) - Math.max(br.top, sr.top)) };
  });
  record('the bar overlays exactly its own height of the grid scroller', g.overlap === g.barBottom,
         `${g.overlap}px of overlap, bar is ${g.barBottom}px`);

  const sw = () => page.evaluate(() => document.querySelector('.mgrid-scroll').scrollWidth);
  const pinchAt = async (y) => {
    const before = await sw();
    await touch('touchStart', [[120, y], [270, y]]);
    for (const s of [0.85, 0.7, 0.55]) await touch('touchMove', [[195 - 75 * s, y], [195 + 75 * s, y]]);
    await touch('touchEnd', []);
    await page.waitForTimeout(250);
    return { before, after: await sw() };
  };
  const inBand = await pinchAt(Math.round(g.barBottom / 2));
  record('a pinch inside the bar band does NOT reach the grid - the known cost',
         inBand.before === inBand.after, `scrollWidth ${inBand.before} -> ${inBand.after}`);
  const below = await pinchAt(g.barBottom + 60);
  record('and the same pinch 60px lower works normally - the cost is bounded to the band',
         below.before !== below.after, `scrollWidth ${below.before} -> ${below.after}`);

  // INERT, NOT HAZARDOUS. A drag that starts on a control must not activate it.
  await page.goto(`${base}/?day=2026-09-05&sport=cfb&view=grid`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, 3000));
  await page.waitForTimeout(700);
  const start = await page.evaluate(() => ({
    hdr: document.documentElement.getAttribute('data-hdr'), url: location.search,
    x: Math.round(document.querySelector('.chdr-wm').getBoundingClientRect().width / 2),
  }));
  await touch('touchStart', [[start.x, 23]]);
  for (const x of [start.x - 40, start.x - 90, start.x - 140]) await touch('touchMove', [[x, 23]]);
  await touch('touchEnd', []);
  await page.waitForTimeout(600);
  const end = await page.evaluate(() => ({
    hdr: document.documentElement.getAttribute('data-hdr'), url: location.search,
  }));
  record('a drag starting on a navbar control activates nothing',
         end.hdr === start.hdr && end.url === start.url, `data-hdr=${end.hdr}, ${end.url}`);
  await ctx.close();
}

// ------------------------------------------- the header's ONE-WAY state machine (prompt 60 st.1)
//
// Joe designed this on 2026-09-07 and every row of his table is here, because the one that would
// rot silently is row 5: `scroll only ever collapses` is one missing `else` away from being untrue,
// and nothing about the page LOOKS wrong when it stops holding - it just quietly goes back to
// prompt 58's behaviour.
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  const hdr = () => page.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-hdr'),
    y: Math.round(window.scrollY),
    banner: getComputedStyle(document.querySelector('.banner')).display,
    stack: getComputedStyle(document.querySelector('.hubctl')).display,
  }));

  await page.goto(`${base}/?day=2026-09-05`, { waitUntil: 'networkidle' });
  let h = await hdr();
  record('1. first paint is EXPANDED', h.attr === null && h.banner !== 'none' && h.stack !== 'none',
         `data-hdr=${h.attr}, banner ${h.banner}`);

  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(500);
  h = await hdr();
  // `stack === 'contents'`, NOT `'none'` (prompt 62 stage 2). Prompt 60's collapse took the whole
  // control stack away with the banner. The split keeps ONE of its five children - the picker - by
  // making `.hubctl` `display: contents` and hiding the other four, so the stack no longer has a box
  // and no longer has `display: none`. Asserting the new value rather than dropping the check: if
  // this ever reads `none` again the picker has gone with it, which is the regression to catch.
  record('2. scrolling past the header COLLAPSES it, and the stack becomes contents',
         h.attr === 'collapsed' && h.banner === 'none' && h.stack === 'contents',
         `data-hdr=${h.attr}, banner ${h.banner}, stack ${h.stack}`);

  // ROW 5, AND THE WHOLE POINT: scroll may not expand.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  h = await hdr();
  record('5. scrolling back to the top STAYS collapsed', h.attr === 'collapsed' && h.y === 0,
         `data-hdr=${h.attr} at scrollY ${h.y}`);

  // ROW 4: the wordmark is the only way back, and it returns the reader to the top.
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(300);
  await page.click('.chdr-wm');
  await page.waitForTimeout(400);
  h = await hdr();
  record('4. tapping MYSPORTS TV EXPANDS and returns to the top',
         h.attr === null && h.y === 0 && h.banner !== 'none',
         `data-hdr=${h.attr} at scrollY ${h.y}`);

  // ROW 3: a purposeful tap on the television.
  await page.click('.bn-tvtap--mobile');
  await page.waitForTimeout(400);
  h = await hdr();
  record('3. tapping the TV on the banner COLLAPSES it', h.attr === 'collapsed' && h.banner === 'none',
         `data-hdr=${h.attr}, banner ${h.banner}`);

  // THE COMPENSATION. Removing ~300px of header from the flow mid-scroll must not move the box the
  // reader is looking at. Sampled per animation frame so the deliberate scroll and the collapse can
  // be told apart - anything coarser measures both at once and proves nothing.
  await page.click('.chdr-wm');
  await page.waitForTimeout(400);
  const moved = await page.evaluate(async () => {
    const card = () => document.querySelector('#all-today .mcard');
    const frames = [];
    let stop = false;
    const tick = () => {
      const c = card();
      frames.push({ attr: document.documentElement.getAttribute('data-hdr'),
                    top: c ? c.getBoundingClientRect().top : null });
      if (!stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    window.scrollTo(0, 900);
    await new Promise((r) => setTimeout(r, 900));
    stop = true;
    const i = frames.findIndex((f) => f.attr === 'collapsed');
    if (i <= 0) return null;
    return Math.round((frames[i].top - frames[i - 1].top) * 100) / 100;
  });
  // SUB-PIXEL, NOT ZERO, AND THE LOOSENING IS DELIBERATE (prompt 61 stage 3). This asserted exact
  // equality with 0 and held while every header box was an integer. Dropping the picker arrows to
  // 31px made `.hubctl` 203.39 - the pill's own line box is 31.39 - so the height the compensation
  // removes now carries a fraction, and `window.scrollBy` lands on an integer scroll offset. The
  // residue is DETERMINISTIC at -0.39px over five runs, scrollY 900 -> 617 against a true delta of
  // 283.39. That is a third of a device pixel at 2x.
  //
  // The guard's job is to catch the ~300px jump, which is what this feature exists to prevent, and
  // a 1px bound still catches it by two orders of magnitude. The measured value is printed either
  // way, so a regression from 0.39 to something real is visible in the log rather than only in a
  // pass/fail bit.
  record('the collapse moves nothing visible under the reader', Math.abs(moved) < 1,
         `card moved ${moved}px (sub-pixel residue of the 31.39px picker row)`);

  // THE TV IS A REAL TARGET. 44px in both dimensions, measured rather than modelled.
  await page.goto(`${base}/?day=2026-09-05`, { waitUntil: 'networkidle' });
  const tv = await page.locator('.bn-tvtap--mobile').evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, tag: e.tagName };
  });
  record('the TV is a <button> and clears 44px in both dimensions',
         tv.tag === 'BUTTON' && tv.w >= 44 && tv.h >= 44, `${tv.tag} ${tv.w} x ${tv.h}`);
  await ctx.close();
}

// ------------------------------------------ the vertical slider toggles (prompt 60 stage 2)
//
// The three properties a later edit can quietly undo: that the pair is ONE target rather than two,
// that exactly one word carries the gold, and that nothing is clipped at 360 - where the whole run
// has 0.16px of spare room and a clip would look like a row rather than like a fault.
{
  for (const w of [360, 390]) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    });
    const page = await ctx.newPage();
    await page.goto(`${base}/?day=2026-09-05`, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(500);
    const t = await page.evaluate(() => {
      const outs = [...document.querySelectorAll('.chdr-toggle')].map((e) => {
        const r = e.getBoundingClientRect();
        const opts = [...e.querySelectorAll('.chdr-opt')];
        return {
          key: e.dataset.key,
          w: Math.round(r.width * 100) / 100,
          h: Math.round(r.height * 100) / 100,
          words: opts.length,
          gold: opts.filter((s) => getComputedStyle(s).color === 'rgb(198, 175, 122)').length,
          clipped: opts.some((s) => s.scrollWidth > s.clientWidth + 0.5),
          name: e.getAttribute('aria-label'),
        };
      });
      const run = document.querySelector('.chdr-run');
      return { outs, over: run.scrollWidth > run.clientWidth + 0.5 };
    });
    record(`${w}: three toggles, each ONE target of two words`,
           t.outs.length === 3 && t.outs.every((o) => o.words === 2),
           t.outs.map((o) => `${o.key}:${o.words}`).join(' '));
    record(`${w}: exactly one word per toggle carries the gold`,
           t.outs.every((o) => o.gold === 1), t.outs.map((o) => `${o.key}:${o.gold}`).join(' '));
    record(`${w}: every toggle is 44px in BOTH dimensions`,
           t.outs.every((o) => o.w >= 44 && o.h >= 44),
           t.outs.map((o) => `${o.key} ${o.w}x${o.h}`).join('  '));
    record(`${w}: nothing is clipped and the run does not overflow`,
           !t.over && t.outs.every((o) => !o.clipped),
           t.over ? 'run overflows' : 'clean');
    await ctx.close();
  }

  // THE ACCESSIBLE NAMES, in BOTH states of the two toggles that have two. A sighted reader learns
  // the state from the gold; `aria-label` replaces the visible text rather than adding to it, so if
  // the name stopped naming the live half a screen-reader user would hear the pair and never the
  // answer.
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  const nameOf = async (path, key) => {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(450);
    return page.locator(`.chdr-toggle[data-key="${key}"]`).getAttribute('aria-label');
  };
  const want = [
    ['/?day=2026-09-05', 'mode', 'Time range: Day. Switch to Week'],
    ['/?mode=week&w=2026-08-31', 'mode', 'Time range: Week. Switch to Day'],
    ['/?day=2026-09-05', 'scope', 'Scope: All games. Switch to My teams'],
    ['/?day=2026-09-05&scope=mine', 'scope', 'Scope: My teams. Switch to All games'],
    ['/?day=2026-09-05', 'view', 'Presentation: List view. Switch to Grid view'],
  ];
  for (const [path, key, expect] of want) {
    const got = await nameOf(path, key);
    record(`the ${key} toggle names its state and its action`, got === expect, got);
  }
  await ctx.close();
}

// ------------------------------------------------- the live tile (prompt 60 stage 3)
//
// Joe: "a tiny arrow gets embedded under 'All Sports' ... In the event the user selects a tile -
// that tile then takes the place of 'All Sports' in the navbar." Picking ALL SPORTS in that row is
// THE ONLY WAY BACK to the words, so it is the one direction that must never quietly stop working.
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  const collapse = async (path) => {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(550);
  };
  const tile = () => page.evaluate(() => {
    const e = document.querySelector('.chdr-tile');
    const img = e.querySelector('.chdr-mark');
    const run = document.querySelector('.chdr-run');
    return {
      w: Math.round(e.getBoundingClientRect().width * 100) / 100,
      shows: img ? 'mark' : (e.querySelector('.chdr-opt') || {}).textContent,
      src: img ? img.getAttribute('src') : null,
      expanded: e.getAttribute('aria-expanded'),
      controls: e.getAttribute('aria-controls'),
      row: document.querySelectorAll('#chdr-sports').length,
      caret: !!e.querySelector('.chdr-caret'),
      runW: Math.round(run.getBoundingClientRect().width * 100) / 100,
      over: run.scrollWidth > run.clientWidth + 0.5,
    };
  });

  await collapse('/?day=2026-09-05');
  let t = await tile();
  record('the tile shows ALL SPORTS with a caret, and the row is CLOSED',
         t.shows === 'ALL SPORTS' && t.caret && t.expanded === 'false' && t.row === 0,
         `${t.shows}, aria-expanded=${t.expanded}, ${t.row} row(s)`);
  record('aria-controls names an element that exists when it is open', t.controls === 'chdr-sports',
         t.controls);

  const top = () => page.evaluate(
    () => document.querySelector('#all-today .mcard').getBoundingClientRect().top);
  const before = await top();
  await page.click('.chdr-tile');
  await page.waitForTimeout(350);
  t = await tile();
  const moved = Math.round(((await top()) - before) * 100) / 100;
  const tiles = await page.locator('#chdr-sports .spbtn').count();
  record('tapping it OPENS the league row, ALL SPORTS bar plus eight tiles',
         t.expanded === 'true' && t.row === 1 && tiles === 9,
         `aria-expanded=${t.expanded}, ${tiles} controls`);
  record('the row OVERLAYS rather than pushing the content', moved === 0, `content moved ${moved}px`);

  await page.locator('#chdr-sports .spbtn').nth(1).click();
  await page.waitForTimeout(700);
  t = await tile();
  record('picking a league puts its MARK where the words were',
         t.shows === 'mark' && /nfl_dark/.test(t.src || '') && t.row === 0,
         `${t.src}, ${t.row} row(s) left open`);

  // THE ONLY WAY BACK.
  await page.click('.chdr-tile');
  await page.waitForTimeout(300);
  await page.locator('#chdr-sports .spbtn-all').click();
  await page.waitForTimeout(700);
  t = await tile();
  record('picking ALL SPORTS in the row puts the WORDS back', t.shows === 'ALL SPORTS' && t.row === 0,
         `${t.shows}, url ${page.url().replace(base, '')}`);

  // THE ONE COLUMN THAT CHANGES SHAPE CANNOT BREAK THE ROW. Measured against the widest mark the
  // app can reach, which is NASCAR's 6:1 wordmark via a hand-typed ?sport=nascar - not the widest
  // of the eight tiles, and certainly not ALL SPORTS.
  await collapse('/?day=2026-09-05');
  const allSports = (await tile()).w;
  let widest = 0;
  for (const sport of ['nascar', 'ufc', 'mlb', 'wwe', 'racing', 'nhl', 'nfl', 'cfb', 'nba', 'indycar']) {
    await collapse(`/?day=2026-09-05&sport=${sport}`);
    const s2 = await tile();
    widest = Math.max(widest, s2.w);
    if (s2.over) widest = Infinity;
  }
  record('no league mark can widen the tile past the words it replaces',
         widest <= allSports, `widest league ${widest}px vs ALL SPORTS ${allSports}px`);
  await ctx.close();
}

// -------------------------------------------------- the favourites bracket, ALL GAMES only (p59)
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(`${base}/?day=2026-09-05`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(450);
  const allGames = await page.locator('.favgroup').count();
  record('the favourites bracket marks the group under ALL GAMES', allGames > 0, `${allGames} group(s)`);
  const border = await page.locator('.favgroup').first()
    .evaluate((e) => getComputedStyle(e).borderLeftColor);
  record('the bracket is the gold token, not a new colour', border === 'rgb(198, 175, 122)', border);
  // MY TEAMS floats nothing, so a band that is entirely favourites has nothing to bracket.
  await page.goto(`${base}/?day=2026-09-05&scope=mine`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(450);
  const mine = await page.locator('.favgroup').count();
  record('and never appears under MY TEAMS', mine === 0, `${mine} group(s)`);
  await ctx.close();
}

// ------------------------------------------------ MY TEAMS is said once, and in order (p60 st.4)
//
// The property, stated once: on every day and in both modes, MY TEAMS is ONE section whose rows run
// strictly forward in time. Three separate mechanisms broke that and all three are covered by the
// single assertion, which is the point - a later edit that reintroduces any of them fails here.
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  const read = async (path) => {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    return page.evaluate(() => {
      const mins = (t) => {
        const m = /(\d{1,2}):(\d{2})\s*(AM|PM)/.exec(t);
        if (!m) return null;
        return ((Number(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0)) * 60 + Number(m[2]);
      };
      const cards = [...document.querySelectorAll('.mcard')]
        .map((c) => mins(c.innerText.replace(/\s+/g, ' ')));
      return {
        fbands: document.querySelectorAll('.fband').length,
        headers: document.querySelectorAll('.band-headrow').length,
        sections: [...document.querySelectorAll('section.band')]
          .map((x) => x.getAttribute('aria-label')),
        cards,
        // WITHIN a section, not across the page: week mode is one section per DAY and each day
        // restarts the clock, so a page-wide comparison would flag a correct week.
        inversions: [...document.querySelectorAll('section.band')].reduce((n, sec) => {
          const t = [...sec.querySelectorAll('.mcard')]
            .map((c) => mins(c.innerText.replace(/\s+/g, ' ')));
          for (let i = 1; i < t.length; i += 1) {
            if (t[i] !== null && t[i - 1] !== null && t[i] < t[i - 1]) return n + 1;
          }
          return n;
        }, 0),
      };
    });
  };

  for (const [name, path] of [
    ['day / my teams', '/?day=2026-09-06&scope=mine'],
    ['day / my teams (mixed)', '/?day=2026-09-05&scope=mine'],
    ['day / my teams (the day Joe reported)', '/?day=2026-09-07&scope=mine'],
    ['week / my teams', '/?mode=week&w=2026-08-31&scope=mine'],
  ]) {
    const r = await read(path);
    record(`${name}: said ONCE - no first band, no sport headers`,
           r.fbands === 0 && r.headers === 0, `${r.fbands} first band(s), ${r.headers} header(s)`);
    record(`${name}: strictly chronological`, r.inversions === 0,
           `${r.cards.length} cards, ${r.inversions} inversion(s)`);
    record(`${name}: the flat section is named`,
           r.sections.length > 0 && r.sections.every((x) => x === 'My teams'),
           r.sections.join(' / ') || 'no section');
  }

  // ALL GAMES IS UNTOUCHED, asserted rather than assumed. The first band, the sport headers and the
  // favourites bracket are all still there, in the arrangement prompt 59 left.
  //
  // THE EXPECTED FIRST-BAND COUNTS ARE READ FROM THE APP, NOT GUESSED. 2026-09-05 was written as 0
  // here on the strength of a probe run under `scope=mine`, where it IS 0; under ALL GAMES the same
  // day has one. Day mode always renders the band and week mode never does - which is the actual
  // rule, and is what these three rows now say.
  for (const [name, path, wantFband] of [
    ['day / all games', '/?day=2026-09-05', 1],
    ['day / all games (a second day)', '/?day=2026-09-13', 1],
    ['week / all games - week mode has no first band', '/?mode=week&w=2026-08-31', 0],
  ]) {
    const r = await read(path);
    record(`${name}: still bands, and still carries its first band`,
           r.headers > 0 && r.fbands === wantFband,
           `${r.fbands} first band(s), ${r.headers} sport header(s)`);
  }
  await ctx.close();
}

// ------------------------------------------------ THE SPLIT (prompt 62 stage 2)
//
// Joe's ruling: the league row opens BETWEEN the navbar and the picker and pushes the picker and the
// schedule down. The source test pins the CSS; this pins that it actually happens, in both modes,
// and that the offset is right ON THE FRAME THE ROW OPENS rather than one frame later.
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  const read = () => page.evaluate(() => {
    const q = (x) => document.querySelector(x);
    const r = (e) => (e ? e.getBoundingClientRect() : null);
    const pick = q('.pickrow');
    const chdr = q('.chdr');
    return {
      pickers: document.querySelectorAll('.pickrow').length,
      dateInputs: document.querySelectorAll('#viewing-day').length,
      pickTop: pick ? Math.round(r(pick).top * 100) / 100 : null,
      chdrBottom: chdr ? Math.round(r(chdr).bottom * 100) / 100 : null,
      chdrH: chdr ? Math.round(r(chdr).height * 100) / 100 : null,
      hub: q('.hubctl') ? getComputedStyle(q('.hubctl')).display : null,
      pickPos: pick ? getComputedStyle(pick).position : null,
      pickBg: pick ? getComputedStyle(pick).backgroundColor : null,
      stackH: getComputedStyle(document.documentElement).getPropertyValue('--stack-h').trim(),
      hdr: document.documentElement.getAttribute('data-hdr'),
    };
  });

  for (const [mode, path] of [['day', '/?day=2026-09-05'], ['week', '/?mode=week&w=2026-08-31']]) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(350);
    let v = await read();
    record(`${mode}: expanded renders ONE picker and a normal stack`,
           v.pickers === 1 && v.hub === 'flex' && v.pickPos === 'static',
           `${v.pickers} picker(s), .hubctl ${v.hub}, position ${v.pickPos}`);

    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(600);
    v = await read();
    const closedTop = v.pickTop;
    record(`${mode}: collapsed keeps ONE picker, and the stack becomes display:contents`,
           v.pickers === 1 && v.hub === 'contents' && v.pickPos === 'sticky',
           `${v.pickers} picker(s), .hubctl ${v.hub}, position ${v.pickPos}`);
    // THE PICKER SITS DIRECTLY UNDER THE BAR - not one pixel of the schedule between them.
    record(`${mode}: the picker sits flush under the bar`,
           Math.abs(v.pickTop - v.chdrBottom) < 0.6,
           `picker top ${v.pickTop} vs bar bottom ${v.chdrBottom}`);
    record(`${mode}: the picker is opaque, or the schedule scrolls through it`,
           v.pickBg === 'rgb(27, 27, 27)', v.pickBg);

    // THE SPLIT: opening the row must PUSH the picker down by the row's own height, not cover it.
    const before = v.chdrH;
    await page.click('.chdr-tile');
    await page.waitForTimeout(400);
    v = await read();
    const grew = Math.round((v.chdrH - before) * 100) / 100;
    const moved = Math.round((v.pickTop - closedTop) * 100) / 100;
    record(`${mode}: opening the league row PUSHES the picker down by the row's height`,
           grew > 40 && Math.abs(moved - grew) < 0.6,
           `bar grew ${grew}px, picker moved ${moved}px`);
    record(`${mode}: and the offset tracked it - still flush, no overlap`,
           Math.abs(v.pickTop - v.chdrBottom) < 0.6 && v.stackH === `${v.chdrH}px`,
           `picker top ${v.pickTop} vs bar bottom ${v.chdrBottom}, --stack-h ${v.stackH}`);
  }

  // ---- THE THREE GOLD HAIRLINES, TIERED (prompt 62 stage 3). Joe's ruling from the renderings:
  // the OUTER edge of the block leads at .55, the divisions inside it stay divisions at .28. All
  // three are 1px - the renderings drew them at 2px so they would read at that size and said so.
  await page.goto(`${base}/?day=2026-09-05`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, 1200));
  await page.waitForTimeout(600);
  const lines = () => page.evaluate(() => {
    const g = (sel) => {
      const e = document.querySelector(sel);
      if (!e) return null;
      const c = getComputedStyle(e);
      return `${c.borderBottomWidth} ${c.borderBottomColor}`;
    };
    return { chdr: g('.chdr'), inner: g('.chdr-inner'), sports: g('.chdr-sports'), pick: g('.pickrow') };
  });
  const FAINT = '1px rgba(198, 175, 122, 0.28)';
  const OUTER = '1px rgba(198, 175, 122, 0.55)';
  let L = await lines();
  record('closed: the navbar line is faint and the picker line is the outer edge',
         L.inner === FAINT && L.pick === OUTER && L.sports === null,
         `navbar ${L.inner} / picker ${L.pick}`);
  // `.chdr` itself carries NONE: its border would sit under whatever its last child is, so it could
  // be the navbar's line or the row's but never both, and Joe asked for both.
  record('closed: .chdr carries no border of its own', L.chdr.startsWith('0px'), L.chdr);
  await page.click('.chdr-tile');
  await page.waitForTimeout(400);
  L = await lines();
  record('open: the league row gets the third line, at the same faint weight',
         L.inner === FAINT && L.sports === FAINT && L.pick === OUTER,
         `navbar ${L.inner} / row ${L.sports} / picker ${L.pick}`);
  await ctx.close();
}

await browser.close();
writeFileSync(join(outDir, 'assertions.json'), JSON.stringify(results, null, 2) + '\n', 'utf8');
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${failed === 0 ? 'OK' : 'FAILURES'} - ${results.length - failed}/${results.length} assertions passed`);
console.log(`shots + assertions.json -> ${outDir}`);
process.exit(0);
