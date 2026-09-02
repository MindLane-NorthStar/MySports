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

export function networkLogoUrl(slug) {
  if (!slug) return null;
  return `${ASSET_BASE_URL}network-logos/${String(slug).toLowerCase()}.png`;
}
