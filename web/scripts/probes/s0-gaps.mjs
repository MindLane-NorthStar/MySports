// Prompt 51 stage 0: the seven measurements stages 1-3 are defined against.
// Gaps are RENDERED distances - one box's bottom to the next box's top - not stylesheet arithmetic.
// .hubctl is a flex column, so margins do NOT collapse and the gap is the SUM of the two adjacent
// margins; that is exactly the thing a stylesheet read gets wrong.
//
// PROMOTED OUT OF web/qa/tools/ IN PROMPT 70, and the original was deleted rather than left behind -
// two copies of a measurement tool drift, and the untracked one drifts invisibly, which is the
// defect being closed. See register 30 for why exactly two of the 84 are tracked.
//
//     node web/scripts/probes/s0-gaps.mjs [base]     # base defaults to http://localhost:3000
//
// EVERY LANDMARK LOOKUP THROWS IF IT MISSES (landmark.mjs). This file used to open with
// `querySelector('.fband') || querySelector('.today-split')`, and `.fband` was deleted in prompt 67;
// for two prompts the `||` swallowed the miss and the probe kept reporting a gap.
import { chromium } from 'playwright';
import { installLandmark, probeBase } from './landmark.mjs';

const base = probeBase();
const browser = await chromium.launch();

const probe = async (w, view) => {
  const ctx = await browser.newContext({
    viewport: { width: w, height: 900 }, deviceScaleFactor: 2,
    isMobile: w < 700, hasTouch: w < 700,
  });
  const page = await ctx.newPage();
  await installLandmark(page);
  const q = view === 'grid' ? '/?day=2026-09-05&sport=cfb&view=grid' : '/?day=2026-09-05&sport=cfb';
  await page.goto(base + q, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
  const m = await page.evaluate(() => {
    const R = (s) => { const e = window.__landmark(s);
      const b = e.getBoundingClientRect();
      return { top: Math.round(b.top*10)/10, bottom: Math.round(b.bottom*10)/10, h: Math.round(b.height*10)/10 }; };
    const gap = (a, b) => (a && b) ? Math.round((b.top - a.bottom) * 10) / 10 : null;
    const banner = R('.banner'), mode = R('.segrow-mode'), pair = R('.segrow-pair');
    const ctl = R('.controls'), bar = R('.spbtn-bar'), tiles = R('.sportrow'), pick = R('.pickrow');
    // The first content element below the control stack. ONE SELECTOR, GUARDED - it was
    // `querySelector('.fband') || querySelector('.today-split')` until prompt 69, and `.fband` died
    // in prompt 67. `.today-split` is what that chain resolved to anyway, so the numbers were right
    // by luck; the guard is what makes the next removal loud instead of lucky.
    // G4 MEASURES THE EXPANDED HEADER, which is why prompt 69's 16px buffer does not show here:
    // that margin is on `html[data-hdr='collapsed'] .pickrow` only. Measured 2026-09-08 at 390:
    // expanded 8 (unchanged, `.hubctl`'s padding-bottom), collapsed 0 -> 16.
    const firstContent = window.__landmark('.today-split');
    const fc = (() => { const b = firstContent.getBoundingClientRect();
      return { top: Math.round(b.top*10)/10, bottom: 0, cls: (firstContent.className||'').toString().slice(0,24) }; })();
    const cs = (s, p) => { const e = window.__optional(s); return e ? getComputedStyle(e)[p] : null; };
    return {
      G1_mode_to_pair: gap(mode, pair),
      G2_banner_to_mode: gap(banner, mode),
      G3_pair_to_allsports: gap(pair, ctl),
      G4_picker_to_content: Math.round((fc.top - pick.bottom) * 10) / 10,
      G5a_bar_to_tiles: gap(bar, tiles),
      G5b_tiles_to_picker: gap(tiles, pick),
      H_segButton: R('.seg button').h,
      H_allSportsBar: bar.h,
      firstContentTop: fc.top,
      firstContentCls: fc.cls,
      css: {
        segrow_margin: cs('.segrow', 'margin'),
        controls_margin: cs('.controls', 'margin'),
        pickrow_margin: cs('.pickrow', 'margin'),
        hubctl_display: cs('.hubctl', 'display'),
        hubctl_gap: cs('.hubctl', 'rowGap'),
        shell_paddingTop: cs('.shell', 'paddingTop'),
        segButton_fontSize: cs('.seg button', 'fontSize'),
      },
    };
  });
  await ctx.close();
  return m;
};

console.log('=== 390px, view=list (the canonical measurement) ===');
const m390 = await probe(390, 'list');
console.log(JSON.stringify(m390, null, 2));

console.log('\n=== 390px, view=grid (G4 only differs) ===');
const g = await probe(390, 'grid');
console.log(JSON.stringify({ G4_picker_to_content: g.G4_picker_to_content,
                             firstContentCls: g.firstContentCls, firstContentTop: g.firstContentTop }, null, 2));

console.log('\n=== the same gaps at 360 / 430 / 1440 ===');
for (const w of [360, 430, 1440]) {
  const m = await probe(w, 'list');
  console.log(`${String(w).padStart(4)}  G1=${m.G1_mode_to_pair}  G2=${m.G2_banner_to_mode}  G3=${m.G3_pair_to_allsports}  G4=${m.G4_picker_to_content}  |  bar->tiles=${m.G5a_bar_to_tiles}  tiles->picker=${m.G5b_tiles_to_picker}  |  seg=${m.H_segButton}  bar=${m.H_allSportsBar}  firstContent=${m.firstContentTop}`);
}
await browser.close();
