// THE 35 WATCH LINKS, CHECKED NIGHTLY (prompt 78 block C3, Joe's ruling 2026-09-09).
//
// `WATCH` in lib/config.js is a hand-maintained map of "where do I actually watch this" URLs with
// nothing checking any of them. One rotted — `guardians-tv` pointed at `/guardians/watch`, a hard
// 404 — and it surfaced because Joe tapped it. This is the control that should have caught it.
//
//     node web/scripts/probes/watch-links.mjs          # from anywhere; paths are relative to itself
//
// IT MUST NEVER FAIL THE WORKFLOW — Joe's ruling, and it is the whole reason this is useful. Thirty-
// five external hosts WILL produce transient failures that have nothing to do with this repo, and a
// nightly job that goes red for somebody else's outage gets ignored — which is precisely how the dead
// link survived. It exits 0 whatever it finds; the workflow step also carries `continue-on-error`.
//
// HOW THE REPORT IS SEEN, because a report nobody reads is the same as no report. It writes a
// markdown table to `$GITHUB_STEP_SUMMARY`, which GitHub renders on the run's own summary page — no
// log-opening, no artifact download. Locally it just prints. `## WATCH LINKS` with a count of
// anything not plainly alive is the first thing on that page.
//
// A 403 IS "COULD NOT CHECK", NOT "DEAD", and that lesson is already paid for: lib/livescores.js
// records an Akamai 403 on 2026-09-03 against a browser UA, and adapters/common.py records that an
// honest bot UA got through where a half-disguised Chrome one did not. Five of these hosts 403 an
// honest bot outright (hbo-max, tbs, tnt, trutv and the local affiliate). Calling those dead would
// train the reader to ignore the report, which is the failure mode being designed against.
//
// ---------------------------------------------------------------------------------------------
// WHAT THIS CANNOT DO, and it is important enough to be in the file rather than only in a doc.
//
// A STATUS CHECK PROVES A URL IS ALIVE, NOT THAT IT IS RIGHT. Three known cases it cannot see:
//
//   * the local affiliate entry points at a DIFFERENT STATION's site and returns a clean 200;
//   * `the-cw` returns 200 after redirecting to `?sorry-page-not-found`, which is a 404 page
//     wearing a 200 — this run found it, and only because the FINAL URL is reported;
//   * `fs1` and `big-ten-network` redirect to a network homepage and an About page respectively.
//
// Reporting the FINAL URL after redirects is what makes the second and third visible at all. The
// first is invisible to any status check and needs a human. The one-off audit table for those
// judgements is in docs/research/watch-links-2026-09-09.md.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WATCH } from '../../lib/config.js';

const UA = 'MySports-adapters/0.1 (+https://github.com/MindLane-NorthStar/MySports)';
const TIMEOUT_MS = 15000;

/**
 * GET, not HEAD, and redirects followed.
 *
 * Some of these hosts refuse HEAD outright and others answer it differently from GET, so HEAD would
 * report on a request no reader ever makes. Following redirects and reporting where it LANDED is
 * what turns a silent redirect to a marketing page into something a person can see.
 */
async function check(url) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return { status: res.status, final: res.url };
  } catch (e) {
    return { status: null, final: null, error: `${e.name}` };
  }
}

/** ALIVE / COULD NOT CHECK / DEAD — and the middle one is the point. */
function verdict({ status, error }) {
  if (error) return 'could not check';
  if (status === 403 || status === 429) return 'could not check';
  if (status >= 200 && status < 400) return 'alive';
  return 'DEAD';
}

const ids = Object.keys(WATCH).sort();
const rows = [];
for (const id of ids) {
  const url = WATCH[id];
  const r = await check(url);
  const v = verdict(r);
  const moved = r.final && r.final !== url && r.final !== `${url}/`;
  rows.push({ id, url, status: r.error || r.status, final: moved ? r.final : '', verdict: v });
  console.log(`  ${v.padEnd(15)} ${String(r.error || r.status).padEnd(6)} ${id.padEnd(20)} ${moved ? `-> ${r.final}` : ''}`);
}

const dead = rows.filter((r) => r.verdict === 'DEAD');
const unchecked = rows.filter((r) => r.verdict === 'could not check');
const moved = rows.filter((r) => r.final);
console.log(`\n${rows.length} checked - ${dead.length} DEAD, ${unchecked.length} could not check, ${moved.length} redirected`);

// The GitHub run summary, so this is read without opening a log.
const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) {
  const line = (r) => `| \`${r.id}\` | ${r.verdict} | ${r.status} | ${r.final ? `\`${r.final}\`` : ''} |`;
  const interesting = [...dead, ...moved.filter((r) => r.verdict !== 'DEAD'), ...unchecked];
  const body = [
    `## WATCH LINKS — ${dead.length} dead, ${unchecked.length} unverifiable, ${moved.length} redirected`,
    '',
    dead.length
      ? `**${dead.length} link(s) are DEAD and need a human.** A reader who taps one gets nothing.`
      : 'No link returned a dead status. A 200 is not proof the page is RIGHT — see the file header.',
    '',
    '| service | verdict | status | landed on (if redirected) |',
    '|---|---|---|---|',
    ...interesting.map(line),
    '',
    `_${rows.length} checked. A 403 is "could not check", not "dead" — several of these hosts refuse`,
    'an honest bot UA, and calling them dead would train the reader to ignore this table._',
  ].join('\n');
  try {
    readFileSync(summaryPath, 'utf8');
  } catch { /* the file may not exist yet; appendFile creates it */ }
  const { appendFileSync } = await import('node:fs');
  appendFileSync(summaryPath, `${body}\n`);
}

// ALWAYS ZERO. See the header — this reports, it does not gate.
process.exit(0);
