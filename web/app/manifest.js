// Web app manifest, via Next's route convention (app/manifest.js -> /manifest.webmanifest).
//
// display: 'standalone' removes Safari's chrome, which is the app feel this was asked for - but it
// also removes the ADDRESS BAR AND THE BROWSER BACK BUTTON, so the app's own navigation has to carry
// every route on its own. The .homenav row under the banner links Today / Weeks / History from every
// page - it is the same row on every route since the compact bar was retired - and the game detail
// panel has its own dismiss, so every route is reachable and escapable from inside the app. If that
// ever stops being true, the revert is one line: display: 'browser'.

export default function manifest() {
  return {
    name: 'MySports TV',
    short_name: 'MySports',
    description: 'What is on today, this week, and what has already been played.',
    start_url: '/',
    display: 'standalone',
    // #1b1b1b is --spot-2 in globals.css, the settled tone of the page's radial ground. (There is no
    // token literally named --ground; the value was read from the stylesheet rather than retyped.)
    background_color: '#1b1b1b',
    theme_color: '#1b1b1b',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
