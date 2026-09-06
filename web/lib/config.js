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
  return `${ASSET_BASE_URL}logos/${String(teamId).toLowerCase()}.png`;
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
  return /^https?:\/\//i.test(key) ? key : `${ASSET_BASE_URL}${String(key).replace(/^\/+/, '')}`;
}

/**
 * The dark-context team logo (mobile addendum M12). TWO contexts, two files:
 *   - grid cap endcaps and light tint plates use teamLogoUrl()  - RAW, never lightness-adjusted;
 *   - a logo FLOATING on charcoal (listings line 1, the odds slot) uses this one.
 * Built by scripts/build_web_marks.py --team-logos, which keeps a provider's own dark art where ESPN
 * offers it and derives the rest.
 */
export function teamLogoDarkUrl(teamId) {
  if (!teamId) return null;
  return `${ASSET_BASE_URL}logos/${String(teamId).toLowerCase()}_dark.png`;
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
  return slug ? `/leagues/${slug}_dark.png` : null;
}

export function networkLogoUrl(slug) {
  if (!slug) return null;
  return `${ASSET_BASE_URL}network-logos/${String(slug).toLowerCase()}.png`;
}

/** The processed marks the app ships itself (web/public/marks), NOT the raw bucket art. */
export function markUrl(slug) {
  return slug ? `/marks/${String(slug).toLowerCase()}.png` : null;
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
