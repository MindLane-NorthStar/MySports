// THE SCORE PATCH MOVES NOTHING - the measurement behind prompt 77 stage 1.
//
// WHY IT EXISTS. Prompt 73 pins the banner on mount and on navigation; prompt 71 lands the page on
// today when the path or query changes. Both live in `AutoScroll`, keyed on `${pathname}?${params}`.
// If a poll remounts `Listing` or re-runs either effect, the banner re-pins and the page re-scrolls
// EVERY SIXTY SECONDS, which is unusable. Rule 34: measured, never reasoned about from what React
// ought to do - that is the exact class of claim this project has been wrong about repeatedly.
//
// `web/test/livepoll.test.mjs` pins the MECHANISM in the gate (no router, no navigation, state only).
// This pins the BEHAVIOUR, which needs a browser and a clock.
//
//     node scripts/probes/live-poll.mjs [baseUrl]     # base defaults to http://localhost:3000
//
// IT CONFIGURES ITSELF FROM THE DATABASE, and that is deliberate rather than tidy. A first version
// hardcoded a date, a clock time and one game id; all three rot the next day, and a probe that rots
// is a probe nobody runs. This reads today's slate and stubs EVERY id on the day, so it does not need
// to know which of them survived the service filter onto the screen.
//
// IT SEARCHES FOR THE CLOCK RATHER THAN COMPUTING IT, because the one thing it CANNOT know from the
// database is which games are VISIBLE - the off-service filter runs in the app. Setting the clock
// from the slate's earliest kickoff put it at 17:40Z on a day whose first visible game was at 22:35Z,
// `anyInFlight` was false, and the run passed every "did not move" check while proving nothing. So it
// walks the day's distinct kickoffs and stops at the first that actually arms the poll, and reports
// FAILURE if none of them does.
//
// THE STUB IS WHAT MAKES THE RESULT MEAN ANYTHING. A real poll returns whatever is live right now,
// which at most hours is nothing - and "nothing moved" is not evidence when nothing happened. The
// first run of this proved exactly that and was caught by its own `the patch landed` assertion, which
// is why that assertion is first and why the probe FAILS rather than passes when the poll is silent.
import { chromium } from 'playwright';
import { restAll } from '../../lib/rest.js';
import { todayET } from '../../lib/format.js';
import { probeBase } from './landmark.mjs';

const BASE = probeBase();
const DAY = todayET();

const slate = await restAll(
  `games?select=id,canonical_kickoff_at_utc&viewing_day=eq.${DAY}&order=canonical_kickoff_at_utc.asc`,
);
if (!slate.length) {
  console.log(`  SKIP  no games on ${DAY} - nothing to patch, and a probe with no subject reports nothing`);
  process.exit(0);
}
// Each distinct kickoff + 30 minutes: inside anyInFlight's 4-hours-after arm for that game.
const CANDIDATES = [...new Set(slate.map((g) => g.canonical_kickoff_at_utc).filter(Boolean))]
  .map((t) => new Date(new Date(t).getTime() + 30 * 60_000));

const browser = await chromium.launch();

async function attempt(WHEN) {
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
});
const page = await ctx.newPage();

let polls = 0;
await page.route('**/api/live**', async (route) => {
  polls += 1;
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      day: DAY,
      today: DAY,
      fetchedAt: new Date().toISOString(),
      sports: ['mlb'],
      stats: {},
      rows: slate.map((g) => ({
        gameId: g.id, status: 'in_progress', homeScore: 4, awayScore: 2, clock: 'Top 7th', period: 7,
      })),
    }),
  });
});

await page.clock.install({ time: WHEN });
await page.goto(`${BASE}/?day=${DAY}`, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(900);

const snap = () => page.evaluate(() => ({
  y: Math.round(window.scrollY),
  pin: document.documentElement.getAttribute('data-pin'),
  hdr: document.documentElement.getAttribute('data-hdr'),
  url: location.pathname + location.search,
  cards: document.querySelectorAll('.mcard').length,
  live: document.querySelectorAll('.mcard[data-live="1"]').length,
}));

// Scrolled somewhere deliberate, so "did not move" is a claim about a page that HAD somewhere to move
// from - starting at 0 and staying there would prove nothing.
await page.mouse.move(195, 500);
await page.mouse.wheel(0, 420);
await page.waitForTimeout(700);
const before = await snap();

// SAMPLED PER FRAME across the cycle, the same way qa-shots samples the header collapse: a jump that
// happens and is corrected within the interval is invisible to a before/after pair, and that is
// precisely the shape of the fault being ruled out.
const frames = await page.evaluate(() => new Promise((resolve) => {
  const seen = [];
  let stop = false;
  const tick = () => {
    seen.push({ y: Math.round(window.scrollY),
                pin: document.documentElement.getAttribute('data-pin') });
    if (!stop) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  setTimeout(() => { stop = true; resolve(seen); }, 4000);
}));

await page.clock.runFor(61_000);
await page.waitForTimeout(1200);
const after = await snap();
await ctx.close();
return { WHEN, polls, before, after, frames };
}

// The first candidate that arms the poll is the one measured. Bounded by the day's kickoff count.
let r = null;
for (const when of CANDIDATES) {
  r = await attempt(when);
  if (r.polls >= 1) break;
  console.log(`  (no poll armed at ${when.toISOString()} - nothing visible was in flight; trying the next kickoff)`);
}
await browser.close();
const { WHEN, polls, before, after, frames } = r;

const ys = [...new Set(frames.map((f) => f.y))];
const pins = [...new Set(frames.map((f) => f.pin))];
console.log(`
day ${DAY}, fake clock ${WHEN.toISOString()}, ${slate.length} games stubbed live`);
console.log(`before ${JSON.stringify(before)}`);
console.log(`after  ${JSON.stringify(after)}`);
console.log(`${frames.length} frames sampled; scrollY ${JSON.stringify(ys)}, data-pin ${JSON.stringify(pins)}\n`);

const fails = [];
const check = (name, pass, detail) => {
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!pass) fails.push(name);
};
check('the poll fired at all', polls >= 1, `${polls} request(s) to /api/live`);
check('the patch LANDED - a card went live', after.live > before.live,
      `live cards ${before.live} -> ${after.live}`);
check('scrollY did not move', after.y === before.y, `${before.y} -> ${after.y}`);
check('scrollY never moved mid-cycle', ys.length <= 1, JSON.stringify(ys));
check('the banner pin was not re-armed', after.pin === before.pin, `${before.pin} -> ${after.pin}`);
check('the pin never changed mid-cycle', pins.length <= 1, JSON.stringify(pins));
check('the header state is unchanged', after.hdr === before.hdr, `${before.hdr} -> ${after.hdr}`);
check('no navigation happened', after.url === before.url, after.url);
check('no cards were added or lost', after.cards === before.cards, `${before.cards} -> ${after.cards}`);

console.log(`\n${fails.length ? 'FAILURES' : 'ALL PASSED'}`);
process.exit(fails.length ? 1 : 0);
