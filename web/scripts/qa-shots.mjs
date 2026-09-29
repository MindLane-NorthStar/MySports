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

import { readBanner, bannerChecks } from './lib/bannerdom.mjs';

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

/**
 * WAIT ON THE CONDITION, NEVER ON A DURATION (prompt 79 stage 1).
 *
 * `handoff-status.md` has recorded since prompt 66 that this file waits a fixed number of
 * milliseconds after an action and then asserts, and that the real fix is waiting on the thing that
 * was supposed to happen. Prompt 78 made the debt come due: a client navigation measured 808, 815,
 * 862, 878, 961 and 2597 ms against a fixed 900ms wait - over budget on 2 of 6 - and the gate fell
 * to 1 clean run in 6 while the app was working perfectly.
 *
 * THIS IS NOT LOOSENING THE GATE, and the distinction is the whole justification. A fixed duration
 * ASSERTS NOTHING: it guesses how long the app takes and then reads whatever state it happens to
 * find. Waiting on the real condition is strictly STRONGER - the assertion that follows now runs
 * against the state it was written for, on a fast machine and a slow one.
 *
 * THE CEILING IS 30 SECONDS AND IT STILL FAILS. That is the point: a condition that never arrives
 * throws and the run goes red, exactly as it should when the app is genuinely broken. It is an order
 * of magnitude above the 2597ms worst case measured, so it cannot fire on load alone, and far below
 * anything a person would sit through.
 *
 * WHAT IS DELIBERATELY LEFT AS A DURATION, so the next reader does not "finish the job": the waits
 * that follow a `goto`, a programmatic scroll or a synthetic pinch, where what is being waited for is
 * a SETTLE with no observable end - fonts, layout, a scroll that may already be at its target, or a
 * state that is asserted NOT to change. There is no condition to wait on when the assertion is "this
 * stayed as it was", and inventing one would be a worse test, not a better one.
 */
const COND_TIMEOUT = 30_000;

/** The URL has actually changed. `waitForURL` takes a predicate, so this reads as the assertion. */
const urlHas = (page, needle) =>
  page.waitForURL((u) => u.href.includes(needle), { timeout: COND_TIMEOUT });
const urlLacks = (page, needle) =>
  page.waitForURL((u) => !u.href.includes(needle), { timeout: COND_TIMEOUT });

/** The header has reached a state. `null` is EXPANDED, which is the absence of the attribute. */
const hdrIs = (page, state) => page.waitForFunction(
  (want) => document.documentElement.getAttribute('data-hdr') === want,
  state, { timeout: COND_TIMEOUT });

/**
 * `--stack-h` HAS CAUGHT UP WITH THE BAR, which is a later moment than the row existing.
 *
 * THE FIRST VERSION OF THIS FIX WAITED FOR `#chdr-sports` AND THAT WAS TOO EARLY. The row is
 * attached the instant React renders it; `--stack-h` is written afterwards by the ResizeObserver in
 * components/CollapsedHeader.js. Three runs failed with `bar grew 83px, picker moved 0px` and
 * `--stack-h 44px` against a 127px bar - the assertion read a value that was correct for the frame
 * before. The old fixed 350ms happened to straddle both, which is exactly the kind of luck a fixed
 * duration trades on.
 *
 * SO THE CONDITION IS THE ONE THE ASSERTION ACTUALLY DEPENDS ON, not a proxy that usually precedes
 * it. That is the whole discipline this stage is about, and getting it wrong once is the clearest
 * possible argument for it.
 */
const stackSynced = (page) => page.waitForFunction(() => {
  const bar = document.querySelector('.chdr');
  if (!bar) return false;
  const painted = bar.getBoundingClientRect().height;
  const declared = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--stack-h'));
  return Number.isFinite(declared) && Math.abs(declared - painted) < 0.5;
}, null, { timeout: COND_TIMEOUT });

/** A selector is present, or gone. */
const shown = (page, sel) => page.waitForSelector(sel, { state: 'attached', timeout: COND_TIMEOUT });
const gone = (page, sel) => page.waitForSelector(sel, { state: 'detached', timeout: COND_TIMEOUT });

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
    await shown(page, '.dpanel');
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
    await shown(page, '.dpanel');
    const box = await page.locator('.dpanel .dlink', { hasText: 'Box score' }).count();
    record('a final game exposes a box-score link in its panel', box > 0);
    await page.screenshot({ path: join(outDir, 'mobile__detail-final.png'), fullPage: false });
  } else {
    record('a final game exposes a box-score link in its panel', false, 'no final card');
  }
  await ctx.close();
}

// ------------------------------------------ THE GAME LINK SITS BESIDE THE STATUS (prompt 87 block C)
//
// Joe's Option A: Status left, link right, two explicit columns, the link as tall as the status pair.
// MEASURED at phone width AND at 560px - the panel's own maximum, where `.dgrid` takes a third column
// and a link appended to it would have landed in the wrong corner. And the closing paragraph says
// nothing about the link: "we don't need a sentence describing any of the three."
for (const width of [390, 560]) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const readRow = () => page.evaluate(() => {
    const r = (e) => (e ? e.getBoundingClientRect() : null);
    const row = document.querySelector('.dpanel .dstatusrow');
    const label = row?.querySelector('.dstatus-label');
    const value = row?.querySelector('.dstatus-value');
    const link = row?.querySelector('a.dlink');
    const round = (x) => (x == null ? null : Math.round(x * 100) / 100);
    return {
      row: Boolean(row),
      children: row ? row.children.length : 0,
      labelTop: round(r(label)?.top), valueBottom: round(r(value)?.bottom),
      linkTop: round(r(link)?.top), linkBottom: round(r(link)?.bottom), linkText: link?.textContent || null,
      linkLeft: round(r(link)?.left), rowMid: row ? round(r(row).left + r(row).width / 2) : null,
      linksInLinkRows: document.querySelectorAll('.dpanel .dlinks a.dlink:not(.dlink-watch)').length,
      stamp: document.querySelector('.dpanel .dstamp')?.textContent || '',
    };
  });
  // a final with a stored link - the MLB slate smoke pins as 12 finals, every one carrying one
  await page.goto(`${base}/?day=2026-08-31&sport=mlb`, { waitUntil: 'networkidle' });
  await page.locator('.mcard').first().click();
  await shown(page, '.dpanel .dstatusrow');
  const g = await readRow();
  record(`status row (${width}px): the ${g.linkText} link spans the status pair, label top to value bottom`,
         g.linkTop !== null && Math.abs(g.linkTop - g.labelTop) < 0.6 && Math.abs(g.linkBottom - g.valueBottom) < 0.6,
         `link ${g.linkTop}..${g.linkBottom} vs label top ${g.labelTop}, value bottom ${g.valueBottom}`);
  record(`status row (${width}px): the link is in the RIGHT column and in no links row`,
         g.linkLeft !== null && g.linkLeft >= g.rowMid - 0.6 && g.linksInLinkRows === 0,
         `link left ${g.linkLeft} vs row middle ${g.rowMid}, ${g.linksInLinkRows} in a links row`);
  record(`status row (${width}px): the closing line says nothing about the game link`,
         /Watch links are best effort/.test(g.stamp) && !/preview|box score|own page/i.test(g.stamp),
         JSON.stringify(g.stamp.slice(0, 90)));
  await page.screenshot({ path: join(outDir, `mobile__detail-statusrow-${width}.png`), fullPage: false });

  // a program has no link at all: the row renders, the right slot is empty, nothing stands in for it
  await page.keyboard.press('Escape');
  await page.goto(`${base}/?day=2026-09-13`, { waitUntil: 'networkidle' });
  await page.locator('.mcard', { hasText: 'SUNDAY NFL COUNTDOWN' }).first().click();
  await shown(page, '.dpanel .dstatusrow');
  const p = await readRow();
  record(`status row (${width}px): a program's row renders with its right slot EMPTY`,
         p.row && p.children === 1 && p.linkText === null,
         `${p.children} child(ren), link ${JSON.stringify(p.linkText)}`);
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
    await hdrIs(page, 'collapsed');   // the sentinel crossing, not a guess at how long it takes
    const n = await page.locator('.chdr').count();
    record(`navbar present in ${name}`, n === 1, `${n} in the DOM`);
  }

  // THE DEFECT THE EXCLUSION CAUSED, pinned so it cannot come back: tapping GRID in the bar must
  // keep the collapse AND keep the reader where they were.
  await page.goto(`${base}/?day=${DAY}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, 1200));
  await hdrIs(page, 'collapsed');   // the sentinel crossing, not a guess at how long it takes
  const gridTap = await page.evaluate(() => ({
    hdr: document.documentElement.getAttribute('data-hdr'),
    top: document.querySelector('.hubctl') ? null : null,
  }));
  await page.click('.chdr-toggle[data-key="view"]');
  await urlHas(page, 'view=grid');
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
  await urlLacks(page, 'view=grid');
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
  await hdrIs(page, 'collapsed');   // the sentinel crossing, not a guess at how long it takes
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
  await hdrIs(page, null);
  h = await hdr();
  record('4. tapping MYSPORTS TV EXPANDS and returns to the top',
         h.attr === null && h.y === 0 && h.banner !== 'none',
         `data-hdr=${h.attr} at scrollY ${h.y}`);

  // ROW 3: a purposeful tap on the television.
  await page.click('.bn-tvtap--mobile');
  await hdrIs(page, 'collapsed');
  h = await hdr();
  record('3. tapping the TV on the banner COLLAPSES it', h.attr === 'collapsed' && h.banner === 'none',
         `data-hdr=${h.attr}, banner ${h.banner}`);

  // THE COMPENSATION. Removing ~300px of header from the flow mid-scroll must not move the box the
  // reader is looking at. Sampled per animation frame so the deliberate scroll and the collapse can
  // be told apart - anything coarser measures both at once and proves nothing.
  await page.click('.chdr-wm');
  await hdrIs(page, null);
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
    await hdrIs(page, 'collapsed');   // the sentinel crossing, not a guess at how long it takes
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
    await hdrIs(page, 'collapsed');   // the sentinel crossing, not a guess at how long it takes
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
  /**
   * Get this page into the COLLAPSED state, whatever its length.
   *
   * IT USED TO SCROLL A FIXED 900px AND WAIT 450ms, AND ON A SHORT PAGE IT COLLAPSED NOTHING. The
   * sentinel sits below ~347px of header, and a single-sport day can be shorter than the viewport -
   * so `scrollTo(0, 900)` saturated below the sentinel, the header stayed EXPANDED, and every
   * measurement below was then taken on a `.chdr` that is `display: none`. Those return a width of
   * 0, and `widest = Math.max(widest, 0)` swallows it silently.
   *
   * WAITING ON THE CONDITION IS WHAT EXPOSED IT (prompt 79): the fixed wait moved on regardless and
   * the numbers looked plausible. Scrolling to the END of the document collapses any page tall
   * enough to; a page too short for that CANNOT collapse by scrolling at all, and the television is
   * the deliberate route Joe designed for exactly that - so the fallback is a real user action, not
   * a loosened assertion.
   */
  const collapse = async (path) => {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    const scrolled = await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
      return window.scrollY;
    });
    if (scrolled > 0) {
      try {
        await hdrIs(page, 'collapsed');
        return;
      } catch { /* short page: the sentinel never left the viewport. Tap the television instead. */ }
    }
    await page.click('.bn-tvtap--mobile');
    await hdrIs(page, 'collapsed');
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
  await shown(page, '#chdr-sports');
  await stackSynced(page);
  t = await tile();
  const moved = Math.round(((await top()) - before) * 100) / 100;
  const tiles = await page.locator('#chdr-sports .spbtn').count();
  record('tapping it OPENS the league row, ALL SPORTS bar plus eight tiles',
         t.expanded === 'true' && t.row === 1 && tiles === 9,
         `aria-expanded=${t.expanded}, ${tiles} controls`);
  record('the row OVERLAYS rather than pushing the content', moved === 0, `content moved ${moved}px`);

  await page.locator('#chdr-sports .spbtn').nth(1).click();
  await urlHas(page, 'sport=');
  await gone(page, '#chdr-sports');
  t = await tile();
  record('picking a league puts its MARK where the words were',
         t.shows === 'mark' && /nfl_dark/.test(t.src || '') && t.row === 0,
         `${t.src}, ${t.row} row(s) left open`);

  // THE ONLY WAY BACK.
  await page.click('.chdr-tile');
  await shown(page, '#chdr-sports');
  await stackSynced(page);
  await page.locator('#chdr-sports .spbtn-all').click();
  await urlLacks(page, 'sport=');
  await gone(page, '#chdr-sports');
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

// ------------------------------------------------ the favourite MARK, ALL GAMES only (prompt 82)
//
// It was a BRACKET (`.favgroup`, prompt 59) around a floated group. Block D2 retired the float - it
// hoisted favourites out of the clock order the page had just sorted them into - and the gesture
// moved onto the card as a recoloured border. These three assertions moved with it rather than being
// deleted: marked under ALL GAMES, the gold token and not a new colour, never under MY TEAMS.
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(`${base}/?day=2026-09-05`, { waitUntil: 'networkidle' });
  await shown(page, '.mcard');
  const allGames = await page.locator('.fav-row').count();
  record('the favourite mark appears on cards under ALL GAMES', allGames > 0, `${allGames} card(s)`);

  // THE BORDER IS READ OFF THE CARD, not the wrapper - the wrapper has no border of its own, and
  // reading the wrapper would return `rgb(0, 0, 0)` and pass a colour test for the wrong reason.
  const gold = await page.locator('.fav-row > .mcard').first()
    .evaluate((e) => getComputedStyle(e).borderTopColor);
  record('the mark is the gold token, not a new colour', gold === 'rgb(198, 175, 122)', gold);

  // AND AN UNMARKED CARD IS STILL THE FAINT LINE. Without this the colour test above passes just as
  // well if EVERY card went gold, which is the failure MY TEAMS suppression exists to prevent.
  const plainCount = await page.locator('.cards > div:not(.fav-row) > .mcard').count();
  const plain = plainCount
    ? await page.locator('.cards > div:not(.fav-row) > .mcard').first()
      .evaluate((e) => getComputedStyle(e).borderTopColor)
    : null;
  record('an unmarked card keeps the faint border', plainCount > 0 && plain !== 'rgb(198, 175, 122)',
         `${plainCount} unmarked, border ${plain}`);

  // THE MARK COSTS NO LAYOUT, which is the whole reason it is a recoloured border rather than the
  // `outline` Joe asked for by name or the inset the retired bracket used. Measured on the body
  // track `fitNameAndRecord` sizes names against.
  const tracks = await page.evaluate(() => {
    const w = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return Math.round(getComputedStyle(el).gridTemplateColumns.split(' ')[1].replace('px', '') * 10) / 10;
    };
    return { fav: w('.fav-row > .mcard'), plain: w('.cards > div:not(.fav-row) > .mcard') };
  });
  record('the mark costs ZERO layout - the body track is identical either way',
         tracks.fav !== null && tracks.plain !== null && tracks.fav === tracks.plain,
         `favourite ${tracks.fav}px vs unmarked ${tracks.plain}px`);

  // THE FOCUS RING MUST STILL BE TELLABLE FROM THE MARK. A gold `outline` would have been the ring
  // character for character; a gold BORDER is 1px hugging the card edge against 2px standing 2px
  // off it. Shot so Joe can see the two together rather than read that they differ.
  await page.locator('.fav-row > .mcard').first().evaluate((e) => e.focus());
  await page.screenshot({ path: join(outDir, 'mobile__favourite-focus-vs-mark.png'), fullPage: false });
  await page.locator('.fav-row > .mcard').first().evaluate((e) => e.blur());

  // THE 1px READ AND THE 2px READ, SIDE BY SIDE. Joe picks from a picture. The escalation is one
  // line - `box-shadow: 0 0 0 1px var(--gold)` - and still costs no layout, because a box-shadow
  // paints outside the border box exactly as an outline does. It is NOT shipped; this only renders
  // it so the choice is a look rather than a description.
  await page.screenshot({ path: join(outDir, 'mobile__favourite-mark-1px.png'), fullPage: false });
  await page.addStyleTag({ content: '.fav-row > .mcard { box-shadow: 0 0 0 1px var(--gold); }' });
  await page.waitForTimeout(120);
  await page.screenshot({ path: join(outDir, 'mobile__favourite-mark-2px.png'), fullPage: false });

  // A MIXED BAND, so the ORDERING is visible in an artifact and not only in a test: favourites sit
  // where the clock puts them, marked, rather than hoisted above the strangers.
  await page.goto(`${base}/?day=2026-09-05`, { waitUntil: 'networkidle' });
  await shown(page, '.mcard');
  const mixed = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.cards > div')];
    const marks = rows.map((r) => (r.classList.contains('fav-row') ? 'F' : '.'));
    return { pattern: marks.join(''), interleaved: /\.F|F\./.test(marks.join('')) };
  });
  record('favourites are INTERLEAVED, not hoisted - the band reads as a timeline',
         mixed.interleaved, mixed.pattern.slice(0, 40));
  await page.screenshot({ path: join(outDir, 'mobile__favourite-mixed-band.png'), fullPage: true });

  // THE MARK UNDER THE OFF-SERVICE DIM - the one combination where it could vanish (prompt 83 1a).
  //
  // `.offsvc-row` is `opacity: .45; filter: saturate(.7)`, and BOTH ARE COMPOSITING EFFECTS: a
  // dimmed favourite still reports `border-color: var(--gold)` from getComputedStyle, so the style
  // read below proves the classes compose and proves NOTHING about whether a reader can see it.
  // That distinction cost this run a correction, so the shot is the artifact and the painted figure
  // is recorded in the register: measured with Pillow on 2026-09-12, the gold border reads
  // rgb(103, 96, 79) against a card ground of rgb(36, 37, 39) - a max delta of 67, against 156
  // undimmed and 13 for an ordinary unmarked card's border. It survives at ~5x the contrast of the
  // border it replaces, which is why 1px was shipped unchanged.
  await page.goto(`${base}/?day=2026-09-12`, { waitUntil: 'networkidle' });
  await shown(page, '.mcard');
  const bothCount = await page.locator('.fav-row.offsvc-row').count();
  record('a favourite that is ALSO off-service carries both cues', bothCount > 0,
         `${bothCount} row(s) both marked and dimmed`);
  if (bothCount) {
    const el = page.locator('.fav-row.offsvc-row').first();
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const both = await el.evaluate((e) => ({
      dim: getComputedStyle(e).opacity,
      border: getComputedStyle(e.querySelector('.mcard')).borderTopColor,
    }));
    record('the dim and the gold both apply - neither silently wins',
           both.dim === '0.45' && both.border === 'rgb(198, 175, 122)',
           `opacity ${both.dim}, border ${both.border}`);
    await el.screenshot({ path: join(outDir, 'mobile__favourite-offservice.png') });
  }

  // MY TEAMS marks nothing: every row there is a favourite, so a border on all of them distinguishes
  // nothing and only adds noise.
  await page.goto(`${base}/?day=2026-09-05&scope=mine`, { waitUntil: 'networkidle' });
  await shown(page, '.mcard');
  const mine = await page.locator('.fav-row').count();
  record('and never appears under MY TEAMS', mine === 0, `${mine} marked card(s)`);
  await page.screenshot({ path: join(outDir, 'mobile__favourite-myteams.png'), fullPage: false });
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

  // ALL GAMES STILL BANDS BY SPORT, and NOTHING renders a first band any more.
  //
  // These three rows used to assert the band's presence - 1 in day mode, 0 in week - and the counts
  // were themselves a correction, read from the app after a probe run under `scope=mine` had been
  // mistaken for ALL GAMES. Joe removed the band outright on 2026-09-08 (prompt 67): the preview
  // repeated rows that the chronological list below already carried. The expectation is now 0
  // everywhere, and it is kept rather than deleted so that a band reappearing fails a gate.
  for (const [name, path] of [
    ['day / all games', '/?day=2026-09-05'],
    ['day / all games (a second day)', '/?day=2026-09-13'],
    ['week / all games', '/?mode=week&w=2026-08-31'],
  ]) {
    const r = await read(path);
    record(`${name}: still bands by sport, and carries NO first band`,
           r.headers > 0 && r.fbands === 0,
           `${r.fbands} first band(s), ${r.headers} sport header(s)`);
  }
  await ctx.close();
}

// ------------------------------------------------ THE TIME ROW LOCKS UNDER THE PICKER (prompt 86 block C)
//
// The axis was hoisted out of `.mgrid-scroll` so it can pin under the picker, and a transform on its
// track keeps it over the columns. A screenshot shows the row is pinned; ONLY THE MEASUREMENT shows
// the times still sit over their own columns - a strip one frame behind, or not synced at all, looks
// pinned and reads wrong. So both are measured, at a KNOWN vertical scroll and a KNOWN pan.
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  const PAN = 200;
  await page.goto(`${base}/?day=2026-09-05&sport=cfb&view=grid`, { waitUntil: 'networkidle' });
  await shown(page, '.mgrid-axis');
  const scrollTo = await page.evaluate(() =>
    Math.round(document.querySelector('.mgrid').getBoundingClientRect().top + window.scrollY + 400));
  await page.evaluate((y) => window.scrollTo(0, y), scrollTo);
  await hdrIs(page, 'collapsed');
  await stackSynced(page);
  await page.waitForFunction(() => {                       // --pick-h has caught up with the picker
    const d = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--pick-h'));
    return Number.isFinite(d) && Math.abs(d - document.querySelector('.pickrow').getBoundingClientRect().height) < 0.5;
  }, null, { timeout: COND_TIMEOUT });
  await page.locator('.mgrid-scroll').evaluate((el, x) => { el.scrollLeft = x; }, PAN);
  // the sync writes on the next animation frame; wait for THAT, not for a duration
  await page.waitForFunction((x) => {
    const t = getComputedStyle(document.querySelector('.mgrid-axis-track')).transform;
    return document.querySelector('.mgrid-scroll').scrollLeft === x && t !== 'none'
      && Math.abs(new DOMMatrix(t).m41 + x) < 0.5;
  }, PAN, { timeout: COND_TIMEOUT }).catch(() => {});   // a missing sync is the FAILURE below, not a timeout
  const m = await page.evaluate(() => {
    const L = (e) => (e ? Math.round(e.getBoundingClientRect().left * 100) / 100 : null);
    const root = getComputedStyle(document.documentElement);
    const axis = document.querySelector('.mgrid-axis');
    const label = document.querySelector('.maxis-label[data-minute="720"]');
    const rail = document.querySelector('.mrail-cell');
    const scroller = document.querySelector('.mgrid-scroll');
    const transformed = [];
    for (let n = rail.parentElement; n && n !== scroller; n = n.parentElement) {
      if (getComputedStyle(n).transform !== 'none') transformed.push(n.className);
    }
    return {
      scrollY: Math.round(window.scrollY),
      pan: scroller.scrollLeft,
      axisTop: Math.round(axis.getBoundingClientRect().top * 100) / 100,
      stackH: parseFloat(root.getPropertyValue('--stack-h')),
      pickH: parseFloat(root.getPropertyValue('--pick-h')),
      labelText: label?.textContent,
      labelLeft: L(label),
      labelShift: label ? new DOMMatrix(getComputedStyle(label).transform).m41 : null,
      axisNoon: L(document.querySelector('.mgrid-axis-track .mgrid-line[data-minute="720"]')),
      laneNoon: L(document.querySelector('.mgrid-lanes .mgrid-line[data-minute="720"]')),
      axisInScroller: Boolean(axis.closest('.mgrid-scroll')),
      transformed,
      railDelta: Math.round((rail.getBoundingClientRect().left - scroller.getBoundingClientRect().left) * 100) / 100,
    };
  });
  const want = Math.round((m.stackH + m.pickH) * 100) / 100;
  record(`M5 pinned: the time row sits flush under the picker (scrollY ${m.scrollY}, pan ${m.pan})`,
         Math.abs(m.axisTop - want) < 0.5,
         `axis top ${m.axisTop} vs --stack-h ${m.stackH} + --pick-h ${m.pickH} = ${want}`);
  record(`M5 pinned: the axis's noon gridline sits on the lanes' noon gridline (pan ${m.pan})`,
         m.axisNoon !== null && m.laneNoon !== null && Math.abs(m.axisNoon - m.laneNoon) < 0.5,
         `axis ${m.axisNoon} vs lanes ${m.laneNoon}`);
  // THE LABEL'S LEFT EDGE IS 2px LEFT OF ITS LINE BY DESIGN - `.maxis-label` carries
  // `transform: translateX(-2px)`, an optical offset older than this block. It is READ from the
  // computed style and taken back out, never typed in here, so the label's ANCHOR is what is compared.
  record(`M5 pinned: the ${m.labelText} label sits over its own column (pan ${m.pan})`,
         m.labelText === 'NOON' && Math.abs((m.labelLeft - m.labelShift) - m.laneNoon) < 0.5,
         `label left ${m.labelLeft} (own offset ${m.labelShift}px) vs lanes' noon gridline ${m.laneNoon}`);
  record('M4: the axis is outside the scroller and the rail has no transformed ancestor',
         !m.axisInScroller && m.transformed.length === 0 && Math.abs(m.railDelta) < 1.5,
         `axis in scroller ${m.axisInScroller}, transformed ${JSON.stringify(m.transformed)}, rail delta ${m.railDelta}px`);
  await page.screenshot({ path: join(outDir, 'mobile__axis-pinned.png'), fullPage: false });

  // THE LAST HOUR IS STILL REACHABLE. CFB 2026-09-05 ends on 2AM, whose label starts at the
  // canvas's right edge and runs 26.56px past it. Hoisted out, that overhang stopped counting toward
  // scrollWidth and a full pan left the label just past the screen - geometry's day-span stop is
  // what caught it. Pan fully right and the label must sit wholly inside the visible axis.
  await page.locator('.mgrid-scroll').evaluate((el) => { el.scrollLeft = el.scrollWidth; });
  await page.waitForFunction(() => {
    const el = document.querySelector('.mgrid-scroll');
    const t = getComputedStyle(document.querySelector('.mgrid-axis-track')).transform;
    return t !== 'none' && Math.abs(new DOMMatrix(t).m41 + el.scrollLeft) < 0.5;
  }, null, { timeout: COND_TIMEOUT }).catch(() => {});
  const end = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.mgrid-axis-track .maxis-label')];
    const last = labels[labels.length - 1].getBoundingClientRect();
    const axis = document.querySelector('.mgrid-axis').getBoundingClientRect();
    const corner = document.querySelector('.mgrid-axis-rail').getBoundingClientRect();
    return { text: labels[labels.length - 1].textContent, left: +last.left.toFixed(2), right: +last.right.toFixed(2),
             axisRight: +axis.right.toFixed(2), cornerRight: +corner.right.toFixed(2) };
  });
  record(`M5 pinned: at full pan the day's last label (${end.text}) is wholly on screen`,
         end.left >= end.cornerRight && end.right <= end.axisRight + 0.5,
         `label ${end.left}..${end.right} inside ${end.cornerRight}..${end.axisRight}`);
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
    await hdrIs(page, 'collapsed');   // the sentinel crossing, not a guess at how long it takes
    // AND `--stack-h` HAS CAUGHT UP WITH IT (prompt 86). `data-hdr` flips first; the offset is
    // written by the ResizeObserver a frame later, so a read on the flip can still see the EXPANDED
    // value, 0px, and the picker parked at the top. Measured: 1 run in 8 read picker 0 / --stack-h
    // 0px on the flip and 44 / 44 two frames later, and 2 of 3 gate runs failed exactly here on an
    // unmodified tree. The same race `stackSynced` was written for, one read earlier.
    await stackSynced(page);
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
    await shown(page, '#chdr-sports');
    await stackSynced(page);
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

  // ---- THE PLATE REACHES THE EDGES, AND --stack-h SURVIVES AN INSET (prompt 63 stage 2).
  await page.goto(`${base}/?day=2026-09-05`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, 1200));
  await hdrIs(page, 'collapsed');   // the sentinel crossing, not a guess at how long it takes
  const plate = await page.evaluate(() => {
    const r = (s) => document.querySelector(s).getBoundingClientRect();
    return {
      chdr: [Math.round(r('.chdr').left), Math.round(r('.chdr').right)],
      pick: [Math.round(r('.pickrow').left), Math.round(r('.pickrow').right)],
      arrow: Math.round(r('.pk-arrow').left),
      vw: window.innerWidth,
    };
  });
  // THE COLOUR WAS NEVER WRONG - the REACH was. `.pickrow` lived inside `.shell`'s 12px padding, so
  // the page's radial ground showed through at #242424 down both edges against a full-bleed navbar.
  record('the picker plate reaches both edges, exactly as the navbar does',
         plate.pick[0] === plate.chdr[0] && plate.pick[1] === plate.chdr[1] && plate.pick[1] === plate.vw,
         `navbar ${plate.chdr.join('-')}, picker ${plate.pick.join('-')}, viewport ${plate.vw}`);
  // and the CONTENT stays in the column - the bleed is the box, not the controls
  record('the picker controls stay inside the column', plate.arrow >= 12,
         `first arrow at x=${plate.arrow}`);

  // --stack-h MUST TRACK THE BORDER BOX. `.chdr` pads itself by env(safe-area-inset-top); a
  // content-box ResizeObserver never sees an inset change, so --stack-h went stale and the picker
  // stuck 59px too high, opening a strip of schedule above it. Simulated by setting the same
  // padding the env() sets.
  const inset = await page.evaluate(async () => {
    const el = document.querySelector('.chdr');
    el.style.paddingTop = '59px';
    await new Promise((r) => setTimeout(r, 200));
    const h = el.getBoundingClientRect().height;
    const v = getComputedStyle(document.documentElement).getPropertyValue('--stack-h').trim();
    const gap = document.querySelector('.pickrow').getBoundingClientRect().top - el.getBoundingClientRect().bottom;
    el.style.paddingTop = '';
    return { h: Math.round(h), v, gap: Math.round(gap) };
  });
  record('--stack-h tracks the bar through a safe-area inset change',
         inset.v === `${inset.h}px` && inset.gap === 0,
         `bar ${inset.h}px, --stack-h ${inset.v}, gap to picker ${inset.gap}px`);

  // ---- THE THREE GOLD HAIRLINES, TIERED (prompt 62 stage 3). Joe's ruling from the renderings:
  // the OUTER edge of the block leads at .55, the divisions inside it stay divisions at .28. All
  // three are 1px - the renderings drew them at 2px so they would read at that size and said so.
  await page.goto(`${base}/?day=2026-09-05`, { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, 1200));
  await hdrIs(page, 'collapsed');   // the sentinel crossing, not a guess at how long it takes
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
  await shown(page, '#chdr-sports');
  await stackSynced(page);
  L = await lines();
  record('open: the league row gets the third line, at the same faint weight',
         L.inner === FAINT && L.sports === FAINT && L.pick === OUTER,
         `navbar ${L.inner} / row ${L.sports} / picker ${L.pick}`);
  await ctx.close();
}

// ------------------------------------------- THE BANNER, READ OFF THE SERVED DOM (prompt 84, rule 24)
//
// PROMPT 81 BLOCK E CHANGED THE BANNER THREE WAYS AND PINNED NONE OF THEM AT RUNTIME. Every guard
// it shipped with lives in `tests/test_banner_generator.py` - Python, reading JSX as text. Rule 24
// is exactly that: a fact established on the Python side is no evidence the JS runtime agrees, and
// the runtime path has to be pinned. The two guards prove different things and both are wanted -
// that file proves the generator writes what the JSON says, this proves the browser receives it.
// Block E's own gate run went green at 96/96 with nobody having checked the second.
//
// The reader and the predicates live in `scripts/lib/bannerdom.mjs` so that
// `scripts/probes/banner-mutation.mjs` can attack THESE checks rather than a second copy of them.
for (const dev of DEVICES) {
  const ctx = await browser.newContext(dev);
  const page = await ctx.newPage();
  await page.goto(`${base}/?day=2026-09-03`, { waitUntil: 'networkidle' });
  const b = await readBanner(page, dev.key);
  for (const c of bannerChecks(b, dev.key)) record(c.label, c.pass, c.detail);
  await ctx.close();
}

// ------------------------------------------ THE TBD BADGE, AFTER HYDRATION, AND A LOGO THAT 404s (prompt 116)
//
// A placeholder team (a postseason seed with no club yet) shows a grey TBD badge where its logo
// would be; a REAL team whose logo fails to load gets the same badge from the <img>'s error path.
// Both are checked on a COLD load, after server rendering and hydration, because an <img> that
// errors before React attaches its handler would otherwise keep the browser's broken icon: the
// component's mount check (`img.complete && img.naturalWidth === 0`) is what this proves.
//
// THE ROWS ARE A FIXTURE NOW (prompt 124, register §67). This block read LIVE postseason rows and
// moved twice in five days: `cards === 4 && badges === 7` went red on 2026-09-25 when the Braves
// clinched a seed, and "at least one side on 2026-09-29" went red on 2026-09-28 when every Wild Card
// side resolved. It was repointed to 2026-10-03, whose Division Series sides resolve when the Wild
// Card series finish. A check that fails on who is still playing measures the standings, not the
// badge. It now loads /qa/tbd (app/qa/tbd/page.js): the real Listing with fixture rows in
// gamesForDay()'s exact shape, dev-only and a 404 in production. So THE COUNTS ARE CODE AND ARE
// ASSERTED EXACTLY: five cards, four placeholder sides (one per MLB name form lib/placeholders.js
// recognizes, plus a `-TBD` id), five clubs whose logos paint, and the Yankees. A fixture side
// removed, or a badge painted on a club, moves a count.
//
// AND IT PROVES WHICH PATH PAINTED EACH BADGE. Every placeholder id's logo 404s on R2 (measured
// 2026-09-29), so TeamMark's error path would badge a placeholder the predicate had MISSED. A badge
// count alone cannot tell the two apart. So every logo the page requests is recorded, and a
// placeholder side must have requested none: the predicate decides from the row before any request
// is made (TeamMark.js:12-13). The six clubs' logos must all have been requested, so a zero from a
// recorder that saw nothing proves nothing and fails instead.
//
// THE NAMES BELOW ARE TYPED BY HAND, NOT IMPORTED FROM THE FIXTURE, because the count is the check:
// a list derived from the fixture would shrink with it.
{
  const PLACEHOLDER_NAMES = ['AL Wild Card #2', 'NL #3 Seed', 'AL 3/6 Winner', 'TBD'];
  const PLACEHOLDER_LOGO = /\/logos\/(mlb-4944|mlb-4617|mlb-5528|mlb-tbd)_dark\.png$/;
  const CLUB_LOGO = /\/logos\/mlb-(111|117|119|135|136|147)_dark\.png$/;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const logoRequests = [];
  page.on('request', (req) => {
    const path = new URL(req.url()).pathname;
    if (path.includes('/logos/')) logoRequests.push(path);
  });
  // the Yankees' logo is made to 404, so their card exercises the error path beside the Red Sox
  await page.route((u) => /\/logos\/mlb-147_dark\.png/.test(u.pathname), (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto(`${base}/qa/tbd`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const r = await page.evaluate((names) => {
    const rows = [...document.querySelectorAll('.mcard .tl1')];
    const nameOf = (row) => row.querySelector('b')?.textContent.trim();
    const placeholders = rows.filter((row) => names.includes(nameOf(row)));
    const clubs = rows.filter((row) => !names.includes(nameOf(row)) && nameOf(row) !== 'Yankees');
    const badges = placeholders.flatMap((row) => [...row.querySelectorAll('.tbd-mark')]);
    const badged = placeholders.filter((row) => row.querySelector('.tbd-mark')).length;
    const clubLogos = clubs.filter((row) => {
      const img = row.querySelector('img');
      return img && img.complete && img.naturalWidth > 0 && !row.querySelector('.tbd-mark');
    }).length;
    const brokenImgs = [...document.querySelectorAll('.tl1 img, .dpanel-head img, .mslot img')].filter((i) => i.complete && i.naturalWidth === 0);
    const yankees = rows.find((row) => nameOf(row) === 'Yankees');
    const style = badges[0] ? getComputedStyle(badges[0]) : null;
    return { cards: document.querySelectorAll('.mcard').length, sides: placeholders.length, badged, badges: badges.length,
             clubs: clubs.length, clubLogos, pageBadges: document.querySelectorAll('.tl1 .tbd-mark').length,
             brokenImgs: brokenImgs.length, yankeeBadge: yankees ? Boolean(yankees.querySelector('.tbd-mark')) : null,
             badgeBox: badges[0] ? [Math.round(badges[0].getBoundingClientRect().width), Math.round(badges[0].getBoundingClientRect().height)] : null,
             badgeText: badges[0]?.textContent, fill: style?.backgroundColor, ink: style?.color };
  }, PLACEHOLDER_NAMES);
  const placeholderRequests = logoRequests.filter((p) => PLACEHOLDER_LOGO.test(p));
  const clubRequests = new Set(logoRequests.filter((p) => CLUB_LOGO.test(p)));
  record('TBD badge: every placeholder team on /qa/tbd shows the badge in its logo box after hydration, decided before any logo request',
         r.cards === 5 && r.sides === 4 && r.badged === 4 && r.badges === 4 && r.badgeText === 'TBD'
           && placeholderRequests.length === 0 && clubRequests.size === 6 && r.clubs === 5 && r.clubLogos === 5,
         `${r.cards} cards, ${r.sides} placeholder sides, ${r.badged} badged (${r.badges} badges), text ${r.badgeText}; `
           + `${placeholderRequests.length} placeholder logo requests${placeholderRequests.length ? ` (${placeholderRequests.join(', ')})` : ''}, `
           + `${clubRequests.size} of 6 club logos requested; ${r.clubLogos} of ${r.clubs} clubs painted a logo`);
  record('TBD badge: it fills the 20px list logo box, from the neutral tokens', r.badgeBox && r.badgeBox[0] === 20 && r.badgeBox[1] === 20 && r.fill === 'rgb(59, 59, 59)' && r.ink === 'rgb(154, 160, 168)',
         `box ${JSON.stringify(r.badgeBox)}, fill ${r.fill} (--spot-0), ink ${r.ink} (--dim)`);
  record('TBD badge: a REAL team whose logo 404s swaps to the badge, and no broken image is painted',
         r.yankeeBadge === true && r.brokenImgs === 0 && r.pageBadges === 5,
         `Yankees badge ${r.yankeeBadge}, broken <img> elements ${r.brokenImgs}, ${r.pageBadges} badges on the page (4 placeholders + the Yankees)`);
  await ctx.close();
}

// ------------------------------------------ THE iPAD'S HEADROOM, MEASURED AT FIVE VIEWPORTS (prompt 114)
//
// On the iPad the collapsed navbar and the tap-restored banner sit under iOS 27's scroll-edge scrim
// (Joe's shots, 2026-09-22); the phone is clean. globals.css spends `--ipad-top-clear` (32px) as a
// `::before` spacer inside `.chdr` and as padding on `.bn-pc`, scoped to
// `(min-width: 700px) and (min-height: 600px) and (pointer: coarse)`. Chromium matches that with
// `hasTouch: true` (measured, prompt 114 block B.1), so the geometry is provable here even though the
// scrim itself is not: THESE ROWS PROVE GEOMETRY AND SAY NOTHING ABOUT LEGIBILITY. The phone rows
// are the other half of the guard - every one must read exactly as it did before the block existed.
{
  const VPS = [
    { key: 'iPad 1366x1024 coarse', w: 1366, h: 1024, coarse: true, clear: 32 },
    { key: 'iPad 1024x1366 coarse', w: 1024, h: 1366, coarse: true, clear: 32 },
    { key: 'phone 390x844 coarse', w: 390, h: 844, coarse: true, clear: 0 },
    { key: 'phone 932x430 coarse', w: 932, h: 430, coarse: true, clear: 0 },
    { key: 'desktop 1440x900 fine', w: 1440, h: 900, coarse: false, clear: 0 },
  ];
  const read = () => ({
    beforeH: (() => { const st = getComputedStyle(document.querySelector('.chdr'), '::before'); return st.content === 'none' ? 0 : parseFloat(st.height) || 0; })(),
    chdrH: Math.round(document.querySelector('.chdr').getBoundingClientRect().height * 100) / 100,
    innerTop: Math.round(document.querySelector('.chdr-inner').getBoundingClientRect().top * 100) / 100,
    stackH: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--stack-h')),
    pickTop: Math.round(document.querySelector('.pickrow').getBoundingClientRect().top * 100) / 100,
    bnPcPad: parseFloat(getComputedStyle(document.querySelector('.bn-pc')).paddingTop),
    bnPcSvgTop: Math.round(document.querySelector('.bn-pc svg').getBoundingClientRect().top * 100) / 100,
  });
  for (const vp of VPS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2,
      ...(vp.coarse ? { isMobile: true, hasTouch: true } : {}),
    });
    const page = await ctx.newPage();
    await page.goto(`${base}/?day=2026-09-05&sport=cfb`, { waitUntil: 'networkidle' });
    const fresh = await page.evaluate(read);
    record(`${vp.key}: the desktop banner carries ${vp.clear}px of headroom on .bn-pc`,
           fresh.bnPcPad === vp.clear && fresh.bnPcSvgTop === vp.clear,
           `padding ${fresh.bnPcPad}, svg top ${fresh.bnPcSvgTop}`);
    await page.evaluate(() => window.scrollTo(0, 900));
    await hdrIs(page, 'collapsed');
    await stackSynced(page);
    const c = await page.evaluate(read);
    record(`${vp.key}: the navbar's ::before spacer is ${vp.clear}px and the row sits below it`,
           c.beforeH === vp.clear && c.innerTop === vp.clear, `spacer ${c.beforeH}, .chdr-inner top ${c.innerTop}`);
    record(`${vp.key}: .chdr is ${44 + vp.clear}px and --stack-h carries it`,
           c.chdrH === 44 + vp.clear && c.stackH === 44 + vp.clear, `.chdr ${c.chdrH}, --stack-h ${c.stackH}`);
    if (vp.w !== 1024) {
      // At 1024 wide the picker's offset under the bar was seen at both 44 and 52 before this block
      // existed (the live day and an archived day differ there for a reason older than this change),
      // so the flush pin is made only where it was constant. The +32 rows above still hold at 1024.
      record(`${vp.key}: the picker is flush under the taller bar`, c.pickTop === c.stackH,
             `picker top ${c.pickTop} vs --stack-h ${c.stackH}`);
    }
    await ctx.close();
  }

  // THE COLLAPSE STILL COMPENSATES ON THE iPAD, AND THE WORDMARK STILL RE-ARMS THE PIN. Prompt 60's
  // promise - removing the header from the flow mid-scroll must not move the box the reader is
  // looking at - has to hold with the taller bar, and register §50's Block B re-arm has to leave
  // `data-pin` at `banner` one frame after the tap.
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 1024 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(`${base}/?day=2026-09-05&sport=cfb`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const moved = await page.evaluate(async () => {
      const card = () => document.querySelector('.mcard');
      const frames = [];
      let stop = false;
      const tick = () => {
        const el = card();
        frames.push({ attr: document.documentElement.getAttribute('data-hdr'), scrollY: window.scrollY,
                      top: el ? el.getBoundingClientRect().top : null });
        if (!stop) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      // two frames of the EXPANDED state first, so the collapsing frame always has a predecessor to
      // be compared with - a scroll issued in the same task as the first sample can collapse at
      // frame 0 and leave nothing to diff against.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      window.scrollTo(0, 900);
      await new Promise((r) => setTimeout(r, 900));
      stop = true;
      const i = frames.findIndex((f) => f.attr === 'collapsed');
      if (i <= 0) return { moved: null, frames: frames.length, collapsedAt: i };
      // On a tall viewport the programmatic scroll and the sentinel crossing land on the SAME frame,
      // so the card's screen movement on that frame is the 900px the reader asked for PLUS whatever
      // the collapse did. The compensation's promise is that the second term is zero: the header
      // leaves the flow and scrollY is pulled back by the same height, so the card moves by exactly
      // the requested scroll and not a pixel more. `scrolled` is what scrollY actually changed by,
      // and 900 - scrolled is the header height the compensation absorbed.
      const scrolled = frames[i].scrollY - frames[i - 1].scrollY;
      return { moved: Math.round((frames[i].top - frames[i - 1].top) * 100) / 100,
               scrolled, frames: frames.length, collapsedAt: i };
    });
    record('iPad 1366x1024: the collapse does not move the first card beyond the scroll asked for (prompt 60, taller bar)',
           moved.moved !== null && Math.abs(moved.moved + 900) < 1.5,
           `first card moved ${moved.moved}px for a 900px scroll on the collapsing frame; scrollY moved ${moved.scrolled}, so the compensation absorbed ${moved.scrolled === undefined ? '?' : 900 - moved.scrolled}px of header (frame ${moved.collapsedAt} of ${moved.frames})`);
    await page.click('.chdr-wm');
    await hdrIs(page, null);
    const pin = await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(document.documentElement.getAttribute('data-pin')))));
    record('iPad 1366x1024: tapping the wordmark re-arms the banner pin (register §50 block B)', pin === 'banner', `data-pin=${pin}`);
    await ctx.close();
  }
}

await browser.close();
writeFileSync(join(outDir, 'assertions.json'), JSON.stringify(results, null, 2) + '\n', 'utf8');
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${failed === 0 ? 'OK' : 'FAILURES'} - ${results.length - failed}/${results.length} assertions passed`);
console.log(`shots + assertions.json -> ${outDir}`);
// THIS USED TO BE `process.exit(0)` UNCONDITIONALLY, and prompt 84 is why it is not.
//
// Rule 26 says the runner's exit code AND its parsed counts decide a gate. This runner had no exit
// code to read: it exited 0 with failures sitting in `assertions.json` and `FAILURES - n/m` on
// stdout. So the printed line was the only signal, and in prompt 83 that line was read through
// `| tail -4`, which reported TAIL's status - 0 - over a node process that had died on a
// TimeoutError. A gate that cannot fail its own exit code leaves that mistake available to every
// run that follows.
process.exit(failed === 0 ? 0 : 1);
