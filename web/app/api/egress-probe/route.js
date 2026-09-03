// Egress probe — a read-only diagnostic that answers ONE question:
//
//   Can server-side code running on Vercel reach the sports APIs, or does Akamai 403 it the way it
//   403s the Cowork cloud workspace?
//
// That answer settles decision **D3** in docs/feature-study/05-home-page-decisions.md. If these come
// back 200 from a deployed function, v1.1 can refresh on open and the GitHub Actions poll drops to a
// 30-minute backstop. If they come back 403, the window-gated 15-minute Actions poll stays exactly as
// it is. Either way this route changes no behaviour — it only reports.
//
// **This route may be deleted once D3 is closed.** It is safe to leave deployed in the meantime: it
// reads nothing secret, accepts no query parameters, writes nothing, and touches no database.
//
// USER-AGENT: this deliberately sends the same honest project UA that adapters/common.py sends
// (`UA`), NOT a browser UA. That is a measured decision, not an oversight — see the comment block in
// adapters/common.py: on 2026-09-03 the Actions run on the honest UA fetched NFL, NBA and CFB fine,
// and the very next run, identical except for a Chrome UA, took a 403 on its first ESPN call
// (run 33673744218). Akamai scores a Chrome UA arriving without any of the headers a real Chrome
// sends as a spoofing client, which is a worse signal than an honest bot. Half a disguise is worse
// than none. A browser UA is opt-in behind MYSPORTS_ESPN_BROWSER_UA=1 there for that reason, and this
// probe would tell us nothing useful about the adapters' real fetch if it sent a different UA than
// they do.

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Kept byte-identical to `UA` in adapters/common.py. If that string changes, change it here too, or
// the probe stops describing the fetch the adapters actually make.
const USER_AGENT = 'MySports-adapters/0.1 (+https://github.com/MindLane-NorthStar/MySports)';

const TIMEOUT_MS = 6000;

const TARGETS = [
  'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
  'https://statsapi.mlb.com/api/v1/schedule?sportId=1',
  'https://api-web.nhle.com/v1/schedule/now',
];

/**
 * Flatten an error into something that actually names the failure.
 *
 * Node's fetch reports nearly every connection-level problem as the bare, useless string
 * `TypeError: fetch failed`, and puts the real reason — ECONNRESET, ENOTFOUND, a TLS
 * `CERTIFICATE_VERIFY_FAILED`, an IPv6 route that does not work — in `error.cause`, sometimes nested a
 * couple of levels deep. Swallowing that would make this route useless in precisely the case it was
 * built for: a 403 from Akamai is legible on its own, but a connection-level refusal would read as
 * "fetch failed" and tell Joe nothing about whether the fix is a header, a retry or a different host.
 * Observed on this laptop while proving the route: `api-web.nhle.com` intermittently failed this way.
 */
function describe(e) {
  const parts = [`${e?.name ?? 'Error'}: ${String(e?.message ?? e)}`];
  let cause = e?.cause;
  for (let depth = 0; cause && depth < 3; depth += 1) {
    const code = cause.code ? ` [${cause.code}]` : '';
    parts.push(`caused by ${cause.name ?? 'Error'}${code}: ${String(cause.message ?? cause)}`);
    cause = cause.cause;
  }
  return parts.join(' <- ').slice(0, 400);
}

/**
 * Fetch one URL and describe what happened. NEVER THROWS — a probe that throws on the first blocked
 * host would hide the status of every other host, which is the opposite of what it is for. A refusal
 * is a result, not an error.
 */
async function probe(url) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      cache: 'no-store',
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    });
    // Drain the body so `bytes` is the real payload size rather than a header guess, and so the
    // connection is not left half-read.
    const body = await res.arrayBuffer();
    return {
      url,
      status: res.status,
      ms: Date.now() - started,
      bytes: body.byteLength,
      error: null,
    };
  } catch (e) {
    const aborted = e?.name === 'AbortError' || e?.name === 'TimeoutError';
    return {
      url,
      status: null,
      ms: Date.now() - started,
      bytes: 0,
      error: aborted ? `timeout after ${TIMEOUT_MS}ms` : describe(e),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  // In parallel: four sequential 6s timeouts would be a 24s worst case, and Vercel's default function
  // timeout is shorter than that on the free plan.
  const results = await Promise.all(TARGETS.map(probe));

  return Response.json(
    {
      checked_at: new Date().toISOString(),
      runtime: 'nodejs',
      region: process.env.VERCEL_REGION || 'local',
      user_agent: USER_AGENT,
      results,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
