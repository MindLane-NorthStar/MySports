/** @type {import('next').NextConfig} */
const nextConfig = {
  // Team and network art is served straight from the public R2 bucket as <img>; the built-in image
  // optimizer is deliberately not in play, so no remotePatterns are needed and no extra deps are pulled.
  reactStrictMode: true,
};

export default nextConfig;
