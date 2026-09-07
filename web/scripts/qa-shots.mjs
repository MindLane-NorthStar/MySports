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

// ------------------------------------------------ the collapsed header, list only (prompt 58)
//
// PROVED, NOT ASSERTED. The bar must be ABSENT FROM THE DOM in every grid view, not merely hidden:
// `.mgrid-scroll` sets `touch-action: pan-x pan-y` and the grid runs a pinch handler, and a fixed
// element that is only `opacity: 0` still takes touches in some engines. Invisible is not enough;
// gone is the requirement.
//
// The exclusion is DELIBERATE AND TEMPORARY. It is not that the bar would break the grid - a header
// mounted beside `Chrome` is a sibling of `.shell` and can never be an ancestor of `.mrail-cell`,
// so it cannot become its containing block. It is that a fixed bar over the top 44px of a pinch
// scroller has never been tried on a real device, and week mode stacks N of those. Ship list, prove
// it on the phone, then extend.
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  const DAY = '2026-09-05';
  const WEEK = '2026-08-31';
  const views = [
    ['day / all games / GRID', `/?day=${DAY}&view=grid`, false],
    ['day / my teams / GRID', `/?day=${DAY}&scope=mine&view=grid`, false],
    ['week / all games / GRID', `/?mode=week&w=${WEEK}&view=grid`, false],
    ['week / my teams / GRID', `/?mode=week&w=${WEEK}&scope=mine&view=grid`, false],
    ['day / all games / list', `/?day=${DAY}`, true],
    ['day / my teams / list', `/?day=${DAY}&scope=mine`, true],
    ['week / all games / list', `/?mode=week&w=${WEEK}`, true],
    ['week / my teams / list', `/?mode=week&w=${WEEK}&scope=mine`, true],
  ];
  for (const [name, path, shouldExist] of views) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
    // scrolled well past the sentinel, which is where the bar would be showing if it existed
    await page.evaluate(() => window.scrollTo(0, 900));
    await page.waitForTimeout(450);
    const n = await page.locator('.chdr').count();
    record(`collapsed bar ${shouldExist ? 'present in' : 'ABSENT from'} ${name}`,
           shouldExist ? n === 1 : n === 0, `${n} in the DOM`);
  }
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
  record('2. scrolling past the header COLLAPSES it',
         h.attr === 'collapsed' && h.banner === 'none' && h.stack === 'none',
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
  record('the collapse moves NOTHING under the reader', moved === 0, `card moved ${moved}px`);

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

await browser.close();
writeFileSync(join(outDir, 'assertions.json'), JSON.stringify(results, null, 2) + '\n', 'utf8');
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${failed === 0 ? 'OK' : 'FAILURES'} - ${results.length - failed}/${results.length} assertions passed`);
console.log(`shots + assertions.json -> ${outDir}`);
process.exit(0);
