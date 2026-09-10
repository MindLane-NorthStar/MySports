#!/usr/bin/env node
// DOES THE BANNER'S RUNTIME GUARD ACTUALLY CATCH ANYTHING? (prompt 84)
//
//     node scripts/probes/banner-mutation.mjs [baseUrl]     # needs `next dev` already running
//
// Prompt 84's finding was that Block E's banner change had FIVE green gates and no assertion
// anywhere on the served page — every guard was a Python test reading JSX as text (rule 24). The
// answer was `scripts/lib/bannerdom.mjs`, read by `qa-shots`. This is the second half of that
// answer, because AN ASSERTION NOBODY HAS BROKEN ON PURPOSE IS A CLAIM, NOT A GUARD.
//
// For each fact Block E changed, this reverts that one fact in the component source, waits for the
// dev server to actually serve the reverted markup, re-reads the DOM through the SAME predicates
// `qa-shots` uses, and requires the matching check to FAIL — and every other check to keep passing,
// which is what stops a check from being a blunt "something changed" alarm.
//
// THE SAFETY PROPERTY, because this rewrites tracked files: the original BYTES are captured before
// the first mutation, restored in a `finally` so an exception still puts the tree back, and then
// compared byte-for-byte at the end - a restore that silently half-worked is reported as a failure
// of this probe. It deliberately does NOT require a clean git tree: Block E is uncommitted by
// design, and a guard that cannot run on the change it was written for is not a guard.
//
// Rule 20: every mutation is an anchored single-occurrence replace that asserts its own count, not
// a bare repeated string replace.

import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

import { readBanner, bannerChecks } from '../lib/bannerdom.mjs';

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/+$/, '');
const MOBILE = 'components/BannerMobileV2.jsx';
const DESKTOP = 'components/BannerDesktopV2.jsx';

// ---------------------------------------------------------------------- the mutations
// Each reverts ONE fact to what it was before prompt 81 block E, and names the check id in
// `bannerdom.mjs` that must go red. `key` is the breakpoint the check belongs to.
const MUTATIONS = [
  {
    name: 'the lit television comes back (E3)',
    file: MOBILE, key: 'mobile', breaks: 'cutout',
    from: 'href="/banner/tv-cutout-dark.png"', to: 'href="/banner/tv-cutout.png"',
  },
  {
    name: 'the halo goes gold again (E2)',
    file: MOBILE, key: 'mobile', breaks: 'halo',
    from: 'fill="#000000" filter="url(#bnTitleHalo)"',
    to: 'fill="#C6AF7A" opacity=".55" filter="url(#bnTitleHalo)"',
  },
  {
    name: 'one glow tail is left short of zero (E4)',
    file: MOBILE, key: 'mobile', breaks: 'glow0',
    from: '<stop offset="100%" stopColor="rgb(255,170,60)" stopOpacity="0"/></radialGradient>\n    <radialGradient id="bnGlow1"',
    to: '<stop offset="100%" stopColor="rgb(255,170,60)" stopOpacity="0.021"/></radialGradient>\n    <radialGradient id="bnGlow1"',
  },
  {
    name: 'the 95% stop is dropped, so the tail is ZEROED not re-tapered (E4)',
    file: MOBILE, key: 'mobile', breaks: 'glow1',
    from: '<stop offset="95%" stopColor="rgb(255,170,60)" stopOpacity="0.0413"/>',
    to: '',
  },
  // THE DESKTOP HALF IS THE POINT OF DOING THIS AT ALL. It is hand-transcribed, it has no
  // generator and no `--check`, and nothing on a phone viewport would ever show a fault in it.
  {
    name: 'DESKTOP only: the lit television comes back (E3)',
    file: DESKTOP, key: 'desktop', breaks: 'cutout',
    from: 'href="/banner/tv-cutout-dark.png"', to: 'href="/banner/tv-cutout.png"',
  },
  {
    name: 'DESKTOP only: the halo goes gold again (E2)',
    file: DESKTOP, key: 'desktop', breaks: 'halo',
    from: 'fill="#000000" filter="url(#bdTitleHalo)"',
    to: 'fill="#C6AF7A" opacity=".55" filter="url(#bdTitleHalo)"',
  },
];

// ------------------------------------------------------- capture the bytes before anything moves
const ORIGINAL = new Map([[MOBILE, readFileSync(MOBILE)], [DESKTOP, readFileSync(DESKTOP)]]);
const restore = () => { for (const [f, buf] of ORIGINAL) writeFileSync(f, buf); };
const restored = () => [...ORIGINAL].every(([f, buf]) => readFileSync(f).equals(buf));

const browser = await chromium.launch();
let failures = 0;

/** Read both breakpoints, and wait until the served DOM reflects whatever was just written. */
async function readBoth(page, expect) {
  // HMR is not instant and `networkidle` alone races it. Reload until the fact under test matches
  // what the file on disk now says, or give up loudly rather than measuring the previous bundle -
  // which is precisely the mistake prompt 84 was written to rule out.
  for (let i = 0; i < 20; i += 1) {
    await page.goto(`${base}/?day=2026-09-03`, { waitUntil: 'networkidle' });
    const b = { mobile: await readBanner(page, 'mobile'), desktop: await readBanner(page, 'desktop') };
    if (!expect || expect(b)) return b;
    await page.waitForTimeout(500);
  }
  throw new Error('the dev server never served the mutated markup - is `next dev` running?');
}

try {
  // ONE CONTEXT READS BOTH BREAKPOINTS. `Banner.js` mounts both components at every viewport and
  // CSS only chooses which one paints, so `readBanner` selects by root and the viewport is
  // irrelevant to what it finds. `qa-shots` still visits both device profiles, because there the
  // point is the shot as well as the assertion.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // ---- the control: with the tree as committed, every check passes at both breakpoints.
  const clean = await readBoth(page);
  const cleanChecks = ['mobile', 'desktop'].flatMap((k) => bannerChecks(clean[k], k));
  const cleanBad = cleanChecks.filter((c) => !c.pass);
  console.log(`CONTROL  ${cleanBad.length === 0 ? 'PASS' : 'FAIL'}  `
            + `${cleanChecks.length - cleanBad.length}/${cleanChecks.length} checks green on the unmutated tree`);
  cleanBad.forEach((c) => console.log(`           red: ${c.label}  (${c.detail})`));
  if (cleanBad.length) failures += 1;

  // ---- each mutation must turn exactly its own check red.
  for (const m of MUTATIONS) {
    const src = ORIGINAL.get(m.file).toString('utf8');   // captured as bytes; mutated as text
    const n = src.split(m.from).length - 1;
    if (n !== 1) {
      console.log(`SKIP     ${m.name}  (anchor matched ${n} times, expected 1)`);
      failures += 1;
      continue;
    }
    writeFileSync(m.file, src.replace(m.from, m.to), { encoding: 'utf8' });

    let b;
    try {
      b = await readBoth(page, (x) => JSON.stringify(bannerChecks(x[m.key], m.key))
                                   !== JSON.stringify(bannerChecks(clean[m.key], m.key)));
    } catch (e) {
      console.log(`FAIL     ${m.name}  (${e.message})`);
      failures += 1;
      restore();
      continue;
    }

    const now = bannerChecks(b[m.key], m.key);
    const target = now.find((c) => c.id === m.breaks);
    const others = now.filter((c) => c.id !== m.breaks && !c.pass);
    const caught = target && !target.pass;
    // COLLATERAL IS REPORTED, NOT IGNORED. A mutation that reddens four checks is an alarm, not a
    // guard - it means the checks are not independent and one fault will be reported four ways.
    console.log(`${caught && others.length === 0 ? 'PASS' : 'FAIL'}     ${m.name}`);
    console.log(`           ${m.breaks} went ${caught ? 'RED as required' : 'GREEN - THE GUARD DID NOT CATCH IT'}`
              + (others.length ? `; collateral: ${others.map((c) => c.id).join(', ')}` : ''));
    if (!caught || others.length) failures += 1;

    restore();
    await readBoth(page, (x) => JSON.stringify(bannerChecks(x[m.key], m.key))
                             === JSON.stringify(bannerChecks(clean[m.key], m.key)));
  }
  await ctx.close();
} finally {
  restore();
  await browser.close();
}

const ok = restored();
console.log(`
both components are ${ok ? 'byte-identical to how they started'
  : 'NOT RESTORED - THIS IS A BUG IN THIS PROBE'}`);
if (!ok) failures += 1;

console.log(failures === 0
  ? '\nOK - every runtime banner check is a guard, not a claim'
  : `\nFAILURES - ${failures}`);
process.exit(failures === 0 ? 0 : 1);
