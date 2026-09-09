/**
 * THE ASSET VERSION, resolved ONCE at build time.
 *
 * `lib/config.js` appends this to every asset URL so that new bytes get a new address. See the note
 * there for why a header could not do this on its own.
 *
 * `VERCEL_GIT_COMMIT_SHA` is a Vercel system variable available to the BUILD, not to the browser,
 * which is why it is read here and handed across through `env` rather than referenced in a component.
 * Exposing it as `NEXT_PUBLIC_*` from the dashboard would work too and was not used: that puts the
 * value in a place a person can change without changing the code that depends on it.
 *
 * A LOCAL `npm run dev` HAS NO SUCH VARIABLE and falls back to `dev`, which is correct - a dev server
 * recompiles on every edit and has no stale-cache problem to solve. The fallback is a constant rather
 * than a timestamp on purpose: a timestamp would change on every restart and defeat the browser cache
 * during development for no gain.
 */
const ASSET_VERSION = (process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 8);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Team and network art is served straight from the public R2 bucket as <img>; the built-in image
  // optimizer is deliberately not in play, so no remotePatterns are needed and no extra deps are pulled.
  reactStrictMode: true,
  env: { NEXT_PUBLIC_ASSET_VERSION: ASSET_VERSION },
};

export default nextConfig;
