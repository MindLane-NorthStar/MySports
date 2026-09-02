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
  { name: 'weeks-calendar', path: '/weeks?view=calendar' },
  { name: 'weeks-season', path: '/weeks?view=season' },
  { name: 'history', path: '/history' },
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
  await page.goto(`${base}/?day=2026-09-03&sport=mlb`, { waitUntil: 'networkidle' });
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
    labels.length > 0 && labels.every((l) => l.color === 'rgb(240, 200, 80)'),
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
  await page.goto(`${base}/history`, { waitUntil: 'networkidle' });
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

await browser.close();
writeFileSync(join(outDir, 'assertions.json'), JSON.stringify(results, null, 2) + '\n', 'utf8');
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${failed === 0 ? 'OK' : 'FAILURES'} - ${results.length - failed}/${results.length} assertions passed`);
console.log(`shots + assertions.json -> ${outDir}`);
process.exit(0);
