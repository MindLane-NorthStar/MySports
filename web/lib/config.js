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

// The sports the pipeline currently loads. Order is the order the filters render in.
export const SPORTS = ['cfb', 'nfl', 'nba', 'nhl', 'mlb'];

export const SPORT_LABEL = {
  cfb: 'College Football',
  nfl: 'NFL',
  nba: 'NBA',
  nhl: 'NHL',
  mlb: 'MLB',
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
