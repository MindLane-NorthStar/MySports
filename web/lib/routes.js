// The primary routes, as DATA rather than as markup.
//
// Kept out of the component so it can be imported without React or Next - which is what lets
// web/test/nav.test.mjs assert the navigation GRAPH (every route reaches every other route) on a
// machine where the bundler cannot run. It is also the single definition PrimaryNav renders, so the
// test and the UI cannot disagree about which routes exist.

export const PRIMARY_ROUTES = [
  { href: '/', label: 'Today' },
  { href: '/weeks', label: 'Weeks' },
  { href: '/history', label: 'History' },
];
