// MySports web app - where the app reads from.
//
// Every value here is PUBLISHABLE and every one has a committed default, so a clean checkout builds
// and runs with no secret provisioning at all. The anon key is a signed JWT whose only claim is
// role=anon; it can read exactly the tables an RLS policy grants anon SELECT on, and it can write
// nothing. The writer DSN and the R2 credentials live in the repo-root .env and never reach this app.
//
// Override any of them through web/.env.local (see .env.local.example).

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ztnppejmdwmhqstqsfks.supabase.co';

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0bnBwZWptZHdtaHFzdHFzZmtzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NDgzMDIsImV4cCI6MjA5MTMyNDMwMn0._CrGovWte9r1wNfW0jN01AFHa9p1GVe9BKAgZqK-POY';

// PostgREST exposes one schema per request via the Accept-Profile / Content-Profile headers.
export const SUPABASE_SCHEMA = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || 'mysports';

// Public R2 bucket: logos/{teamId}.png, network-logos/{slug}.png, grids/{sport}/grid_{date}.svg.
export const ASSET_BASE_URL = (
  process.env.NEXT_PUBLIC_ASSET_BASE_URL || 'https://pub-8373112ac08548d8af79fe58b7c2dcb9.r2.dev/'
).replace(/\/*$/, '/');

/**
 * AN ASSET URL CHANGES WHEN ITS BYTES CHANGE (prompt 71 stage 1).
 *
 * THREE FALSE BUG REPORTS CAME FROM ONE CAUSE. The last, 2026-09-08: "the logo updates we made for
 * rendering on dark did not deploy to all dark screens." They had deployed - private Safari showed
 * the new art while Joe's installed home-screen PWA served the old.
 *
 * `Cache-Control` DID NOT AND COULD NOT FIX IT. Prompts 66, 68 and 70 put `public, max-age=300` on
 * all 1,613 objects and that is worth having, but a header only tells a client WHEN TO RE-CHECK. A
 * client holding a copy it cached BEFORE that header existed was never told anything, and has no
 * reason to ask. Only a different URL reaches it.
 *
 * A BUILD-WIDE TOKEN, NOT A PER-FILE HASH, and the reason is drift rather than elegance. A per-file
 * manifest is the better mechanism on paper - only changed art re-downloads - but it needs a second
 * record of what the bucket holds, and this repo has a nightly job that changes bucket art WITHOUT a
 * deploy: `schedule_refresh.yml` runs `sync_assets.py --push --prefix logos/ --make-dark`. A manifest
 * committed to git goes stale exactly when it matters most, and a stale manifest is the bug we are
 * fixing wearing a new coat (rule 30). One value resolved from the commit sha has no second copy to
 * disagree with.
 *
 * WHAT IT COSTS: a deploy that changes no art still re-fetches it. ~40 small PNGs a screen, once per
 * deploy. WHAT IT DOES NOT FIX: art that changes with no deploy behind it. That case is now covered
 * by the header instead - every object carries max-age=300, so a client re-checks within five
 * minutes. The two together are complete; neither is alone. The permanent fix for the PWA holding
 * pre-header copies is this token, once.
 *
 * The bucket KEYS do not change, so `scripts/sync_assets.py` is untouched by this.
 */
export const ASSET_VERSION = process.env.NEXT_PUBLIC_ASSET_VERSION || 'dev';

/**
 * Append the version to any asset URL. Applied by EVERY builder below (rule 32) - the R2 ones and
 * the two that point into `web/public`, which Next serves without fingerprinting.
 *
 * Query-aware rather than a bare `?v=`: `gridAssetUrl()` passes legacy ABSOLUTE urls through, and one
 * of those arriving with a query of its own would otherwise be corrupted into `...?a=b?v=x`.
 */
export function withAssetVersion(url) {
  if (!url) return url;
  return `${url}${url.includes('?') ? '&' : '?'}v=${ASSET_VERSION}`;
}

// The sports the filters offer. Order is the order the chips render in.
//
// The last four have NO games loaded yet, and that is deliberate (register section 13): the chip
// row is the app's statement of what it covers, so a sport Joe watches belongs there before its
// adapter lands, selecting to an honest empty state that says when data arrives. Verified safe
// against the live database before widening this list - the sport column accepts all four and
// PostgREST returns 200 with an empty array, so queries.js:51 degrades to the empty-state path
// rather than erroring. The other consumers are all guards or groupers: page.js and
// history/page.js validate a URL param, and Listing.js only orders bands that HAVE games.
//
// AEW is deliberately absent (section 13, amending section 9). It still loads, still appears under
// All, and still renders on the grid on its networks - it just does not get a chip.
// Joe's order (prompt 35 A2): NFL, CFB, MLB, NBA, NHL, Racing, UFC, WWE. This list is the ENUM
// sports, so it carries nascar and indycar where the chip row carries one Racing tile; it is kept
// in the same order so the page's bands read in the order the chips do (Listing.js orders bands
// from it). Order affects DISPLAY only - the two other consumers, expandSport here and
// Listing.js's grouping, are membership tests.
export const SPORTS = ['nfl', 'cfb', 'mlb', 'nba', 'nhl', 'nascar', 'indycar', 'ufc', 'wwe'];

// REGISTER §16. The CHIP ROSTER is not the sport list: `racing` is one chip standing over two
// enum values. There is no `racing` in the database and there must not be - PostgREST answers
// `sport=eq.racing` with a 400, `invalid input value for enum sport`, verified against the live
// database. So the token is expanded to real sports before any query is built (queries.js), and
// SPORTS above stays exactly what the enum accepts.
export const SPORT_FILTERS = ['nfl', 'cfb', 'mlb', 'nba', 'nhl', 'racing', 'ufc', 'wwe'];

const FILTER_EXPANDS = { racing: ['nascar', 'indycar'] };

// REGISTER §9 AND §16 ARE SUPERSEDED HERE (prompt 52 stage 1). §9 gave NASCAR a Cup / O'Reilly /
// Truck SUB-FILTER and §16 placed it as a second row beneath the tiles. Joe reversed both: ALL
// NASCAR races render together, selected by SPORT alone. NASCAR_SERIES, SERIES_LABEL,
// resolveSeriesParam and showsNascar went with it.
//
// `programs.series` IS UNTOUCHED IN THE DATABASE. Migration 0015 keys a race session on
// `(sport, coalesce(series, ''), start_at, title)`; the coalesce exists because IndyCar carries no
// series, and prompt 48 measured that without it two loads of 18 IndyCar races produced 36 rows.
// This was a PRESENTATION change only.

/** A filter token -> the enum sports it covers. A plain sport expands to itself. */
export function expandSport(token) {
  if (!token) return [];
  return FILTER_EXPANDS[token] || (SPORTS.includes(token) ? [token] : []);
}

/**
 * The sport a URL param selects, or null for all sports.
 *
 * Accepts both a chip token and a bare enum sport, so a hand-typed or bookmarked `?sport=nascar`
 * keeps working even though NASCAR no longer has a chip of its own.
 */
export function resolveSportParam(value) {
  if (!value) return null;
  return SPORT_FILTERS.includes(value) || SPORTS.includes(value) ? value : null;
}

/**
 * THE SHORT LABEL, for surfaces with no room for the display name (prompt 58).
 *
 * `SPORT_LABEL` is the display name and one of them does not fit anywhere narrow: measured with the
 * real font at 12px, "College Football" is 93.3px against "ALL SPORTS" at 57.5px, so a collapsed
 * header showing the display name would break its own row the moment CFB was selected. Every other
 * label is already short enough - IndyCar, the next widest, is 40.8px.
 *
 * SO ONLY `cfb` ACTUALLY DIFFERS, and the map is written out in full anyway rather than as an
 * exception table: a caller should not have to know which sports are special.
 *
 * `CFB` IS THE APP'S OWN WORD for it - the register uses it, the fixtures use it, and page.js used
 * it for season-week prefixes ("CFB Week 1") in a local constant that this replaces. One short
 * label per sport, in one place.
 */
export const SPORT_SHORT = {
  cfb: 'CFB',
  nfl: 'NFL',
  nba: 'NBA',
  nhl: 'NHL',
  mlb: 'MLB',
  nascar: 'NASCAR',
  indycar: 'IndyCar',
  racing: 'Racing',
  ufc: 'UFC',
  wwe: 'WWE',
};

export const SPORT_LABEL = {
  cfb: 'College Football',
  nfl: 'NFL',
  nba: 'NBA',
  nhl: 'NHL',
  mlb: 'MLB',
  nascar: 'NASCAR',
  indycar: 'IndyCar',
  racing: 'Racing',
  ufc: 'UFC',
  wwe: 'WWE',
};

// Sports whose season is organised into provider-labelled weeks. Everything else - and the
// all-sports view - uses ISO Monday-Sunday calendar weeks over viewing_day. (The two-week-concept
// model; see docs/app-skeleton.md.)
export const SEASON_WEEK_SPORTS = ['cfb', 'nfl'];

// Every displayed clock time is ET. The database stores instants; ET is a display decision, exactly
// as it is in the renderer.
export const DISPLAY_TIMEZONE = 'America/New_York';

// R2 object keys are lowercased on upload by scripts/sync_assets.py. NBA team ids are uppercase
// abbreviations (nba-CLE), so a URL built from the raw id 404s. Lowercase, always.
export function teamLogoUrl(teamId) {
  if (!teamId) return null;
  return withAssetVersion(`${ASSET_BASE_URL}logos/${String(teamId).toLowerCase()}.png`);
}

/**
 * A generated_grids asset key -> an absolute URL.
 *
 * generated_grids stores BARE KEYS (`grids/cfb/grid_2026-09-05.svg`), never absolute URLs, so that a
 * custom domain in front of R2 does not strand every row already written. Consumers join the base.
 * Absolute values are passed through unchanged, so a legacy row cannot break the page.
 */
export function gridAssetUrl(key) {
  if (!key) return null;
  return withAssetVersion(
    /^https?:\/\//i.test(key) ? key : `${ASSET_BASE_URL}${String(key).replace(/^\/+/, '')}`);
}

/**
 * The dark-context team logo (mobile addendum M12). THREE contexts, three files:
 *   - grid cap endcaps and light tint plates use teamLogoUrl()  - RAW, never lightness-adjusted;
 *   - a logo FLOATING on charcoal (listings line 1, the odds slot) uses this one;
 *   - a grid endcap whose BAND IS BRIGHT uses teamLogoCapUrl() - a black silhouette (prompt 69).
 * Built by scripts/build_web_marks.py --team-logos, which keeps a provider's own dark art where ESPN
 * offers it and derives the rest.
 */
export function teamLogoDarkUrl(teamId) {
  if (!teamId) return null;
  return withAssetVersion(`${ASSET_BASE_URL}logos/${String(teamId).toLowerCase()}_dark.png`);
}

/**
 * THE THIRD CONTEXT (prompt 69, Joe's ruling 2026-09-08): the grid endcap's own art, black.
 *
 * Joe ruled the Giants' SF mark should go black on their orange band. Measured with
 * `build_cap_table.py`'s `edge_crisp` at render size, the two existing files and the black
 * silhouette are exact opposites:
 *
 *     art                on the band #fd5a1e     on charcoal #101214
 *     raw                              0.000                   1.000
 *     dark                             0.000                   1.000
 *     BLACK silhouette                 1.000                   0.000
 *
 * SO IT CANNOT GO IN `_dark.png`. That file is what a listings card floats on charcoal - read at
 * MatchupCard.js:108 and :250 and GameDetail.js:98 and :102 - and a black Giants mark scores 0.000
 * there. The two contexts genuinely want opposite art for this team, which is what makes a third
 * file the answer instead of a preference between the two.
 *
 * ONLY REACHED WHEN THE CAP TABLE SAYS `art: "cap"`, so a team with no `_cap.png` never asks for one
 * and renders exactly as it does today. `logo_conditioning.json`'s three `split_by_context` teams
 * are the same architecture one context earlier.
 */
export function teamLogoCapUrl(teamId) {
  if (!teamId) return null;
  return withAssetVersion(`${ASSET_BASE_URL}logos/${String(teamId).toLowerCase()}_cap.png`);
}

/**
 * The league mark slug for a sport - web/public/leagues/{slug}_dark.png.
 *
 * D4: lifted out of SportBand.js, which owned it privately, because the mobile grid header now needs
 * the same mark and the alternative was a second copy that could drift from the first.
 *
 * College football has no mark of its own; the banner uses the CFP mark for the college slot, so
 * everything follows the banner rather than inventing a second convention.
 */
export const SPORT_MARK = { cfb: 'cfp', nfl: 'nfl', nba: 'nba', nhl: 'nhl', mlb: 'mlb' };

/** The league mark for a sport, or null when that sport has none. */
export function sportMarkUrl(sport) {
  const slug = SPORT_MARK[sport];
  return slug ? withAssetVersion(`/leagues/${slug}_dark.png`) : null;
}

export function networkLogoUrl(slug) {
  if (!slug) return null;
  return withAssetVersion(`${ASSET_BASE_URL}network-logos/${String(slug).toLowerCase()}.png`);
}

/** The processed marks the app ships itself (web/public/marks), NOT the raw bucket art. */
export function markUrl(slug) {
  return slug ? withAssetVersion(`/marks/${String(slug).toLowerCase()}.png`) : null;
}

/** Poll interval while games are in flight (addendum M11: near-live 15-minute refresh). */
export const REFRESH_SECONDS = 900;

/** Where a viewer can actually watch a service. Curated; anything unlisted falls back to DirecTV Stream. */
export const DIRECTV_STREAM = 'https://stream.directv.com';

export const WATCH = {
  espn: 'https://www.espn.com/watch/',
  espn2: 'https://www.espn.com/watch/',
  espnu: 'https://www.espn.com/watch/',
  'espn-plus': 'https://plus.espn.com/',
  'espn-unlimited': 'https://plus.espn.com/',
  abc: 'https://abc.com/watch-live',
  cbs: 'https://www.cbs.com/live-tv/stream/',
  'cbs-sports-network': 'https://www.cbssports.com/cbs-sports-network/',
  nbc: 'https://www.nbc.com/live',
  peacock: 'https://www.peacocktv.com/',
  fox: 'https://www.fox.com/live/',
  fs1: 'https://www.fox.com/live/',
  'the-cw': 'https://www.cwtv.com/shows/cw-live/',
  tnt: 'https://www.tntdrama.com/watchtnt',
  tbs: 'https://www.tbs.com/watchtbs',
  trutv: 'https://www.trutv.com/watchtrutv',
  'usa-network': 'https://www.usanetwork.com/live',
  'big-ten-network': 'https://www.btn.com/watch/',
  'sec-network': 'https://www.espn.com/watch/',
  'sec-network-plus': 'https://www.espn.com/watch/',
  'acc-network': 'https://www.espn.com/watch/',
  'paramount-plus': 'https://www.paramountplus.com/',
  'hbo-max': 'https://www.hbomax.com/',
  'prime-video': 'https://www.amazon.com/gp/video/storefront',
  'apple-tv': 'https://tv.apple.com/',
  netflix: 'https://www.netflix.com/',
  'disney-plus': 'https://www.disneyplus.com/',
  hulu: 'https://www.hulu.com/live-tv',
  youtube: 'https://tv.youtube.com/',
  'nfl-network': 'https://www.nfl.com/network/',
  'mlb-network': 'https://www.mlb.com/network',
  'guardians-tv': 'https://www.mlb.com/guardians/watch',
  dazn: 'https://www.dazn.com/',
  'wuab-43': 'https://www.fox8.com/',
};

export function watchUrl(serviceId) {
  return WATCH[String(serviceId || '').toLowerCase()] || DIRECTV_STREAM;
}
