// Stage 3: the measured vertical budget. Gaps are computed from RENDERED rects - the space between
// one box's bottom and the next box's top - not from the stylesheet, because margins collapse,
// flex suppresses collapsing, and the stylesheet cannot tell you which happened.
//
// PROMOTED OUT OF web/qa/tools/ IN PROMPT 70, original deleted rather than left behind - two copies
// of a measurement tool drift, and the untracked one drifts invisibly. Register 30 says why exactly
// two of the 84 are tracked.
//
//     node web/scripts/probes/s3-spacing.mjs [base] [label]   # base defaults to http://localhost:3000
//
// EVERY LANDMARK LOOKUP THROWS IF IT MISSES (landmark.mjs). `gap_picker_to_content` opened with
// `querySelector('.fband') || querySelector('.today-split')` and `.fband` died in prompt 67; the
// `||` swallowed it for two prompts while the probe kept printing a gap.
import { chromium } from 'playwright';
import { installLandmark, probeBase } from './landmark.mjs';

const base = probeBase();
const label = process.argv[3] || '';
const browser = await chromium.launch();
for (const w of [390]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await installLandmark(page);
  await page.goto(`${base}/?day=2026-09-05&sport=cfb`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => {
    const R = (s) => { const e = window.__landmark(s); const b = e.getBoundingClientRect();
      return { top: Math.round(b.top*10)/10, bottom: Math.round(b.bottom*10)/10, h: Math.round(b.height*10)/10 }; };
    const banner = R('.banner'), shell = R('.shell'), mode = R('.segrow-mode'), pair = R('.segrow-pair');
    const ctl = R('.controls'), tiles = R('.sportrow'), pick = R('.pickrow');
    // the first thing under the picker, whatever it is
    // ONE SELECTOR, GUARDED. `.fband` led this until prompt 69 and had been dead since prompt 67.
    // `gap_picker_to_content` below is the EXPANDED figure, 8px, and prompt 69's buffer does not
    // move it - that 16px is on the collapsed picker only.
    const firstBelow = window.__landmark('.today-split');
    const below = firstBelow ? Math.round(firstBelow.getBoundingClientRect().top*10)/10 : null;
    const bannerArt = window.__optional('.banner svg, .banner img');
    return {
      innerH: window.innerHeight,
      bannerTop: banner?.top, bannerH: banner?.h, bannerBottom: banner?.bottom,
      bannerPadTop: getComputedStyle(window.__landmark('.banner')).paddingTop,
      firstInkTop: bannerArt ? Math.round(bannerArt.getBoundingClientRect().top*10)/10 : null,
      shellTop: shell?.top,
      modeTop: mode?.top,
      gap_banner_to_mode: mode && banner ? Math.round((mode.top - banner.bottom)*10)/10 : null,
      gap_mode_to_pair: pair && mode ? Math.round((pair.top - mode.bottom)*10)/10 : null,
      gap_pair_to_sport: ctl && pair ? Math.round((ctl.top - pair.bottom)*10)/10 : null,
      gap_tiles_to_picker: pick && tiles ? Math.round((pick.top - tiles.bottom)*10)/10 : null,
      gap_picker_to_content: below && pick ? Math.round((below - pick.bottom)*10)/10 : null,
      pickTop: pick?.top, pickBottom: pick?.bottom, pickH: pick?.h,
      contentTop: below,
    };
  });
  console.log(label, JSON.stringify(m, null, 2));
  await ctx.close();
}
await browser.close();
