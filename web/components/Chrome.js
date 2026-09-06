// The page chrome, identical on every route: the full banner, and nothing else.
//
// It used to branch on the pathname - the banner on `/`, a compact 60px bar (NavBanner) everywhere
// else. Joe's ruling of 2026-09-04 retired that split, and a `.homenav` tab row carrying
// TODAY / WEEKS / HISTORY took its place under the banner on every route.
//
// PROMPT 50 RETIRED THE TAB ROW TOO, and not as a design choice: the hub is ONE route (R1), so those
// three tabs point at the page you are already on. What they used to select - the day, the week, the
// finals - is now `?mode=`, `?day=` and `?w=`, set by the toggles in the page's own control stack.
//
// The old reason for the row was `display: "standalone"`: no address bar and no back button means a
// route the app cannot link to is a route the user cannot leave. With one route there is nowhere to
// be stranded - every state is reachable from the controls, and every parameter has a default, so
// `start_url: "/"` always lands somewhere valid. web/test/nav.test.mjs asserts that property in
// place of the route graph it used to assert.
//
// The banner arrives as a PROP, already rendered on the server, because layout.js is where it
// belongs - the chrome sits outside .shell and the layout is what owns that structure.

export default function Chrome({ banner }) {
  return <>{banner}</>;
}
