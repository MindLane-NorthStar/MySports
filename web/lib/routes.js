// The primary routes, as DATA rather than as markup.
//
// Kept out of the component so it can be imported without React or Next - which is what lets
// web/test/nav.test.mjs assert the navigation facts on a machine where the bundler cannot run. It is
// also the single definition anything rendering navigation reads, so the test and the UI cannot
// disagree about which routes exist.
//
// SINCE PROMPT 50 THERE IS ONE ROUTE. `/` is the Schedule Hub and its entire state is the query
// string (R1), so TODAY / WEEKS / HISTORY are no longer places - they are `?mode=`, `?day=` and
// `?w=` on the same page. The `.homenav` tab row that rendered this list is gone with them: a tab
// row over one route is three links to where you already are.
//
// WHAT THAT DOES TO `display: 'standalone'`. The installed app has no address bar and no back
// button, so the old rule was "a route the app cannot link to is a route the user cannot leave".
// With one route there is nowhere to be stranded: every state is reachable from the controls on the
// page, and the parameters that produce it all have defaults, so `start_url: '/'` always lands
// somewhere valid. That is the property nav.test.mjs now asserts in place of the route graph.
export const PRIMARY_ROUTES = [
  { href: '/', label: 'Schedule' },
];

// The retired routes, and where each now goes. Kept as DATA for the same reason the list above is:
// the redirects live in app/weeks/page.js and app/history/page.js, and this is what lets a test
// assert that every one of them still resolves rather than 404s.
export const RETIRED_ROUTES = [
  { href: '/weeks', to: 'mode=week', file: 'app/weeks/page.js' },
  { href: '/history', to: 'day mode at today', file: 'app/history/page.js' },
];
