// The page chrome, identical on every route: the full banner, then the primary nav row beneath it.
//
// It used to branch on the pathname - the banner on `/`, a compact 60px bar (NavBanner) everywhere
// else. Joe's ruling of 2026-09-04 retired that split: every route gets what the home route gets, so
// there is one masthead in the app rather than two that had to be kept in sync.
//
// The banner arrives as a PROP, already rendered on the server. That was originally so a client
// component could still place a server one; with the pathname branch gone this component needs
// nothing from the client at all, so it is no longer 'use client' and ships no JavaScript. Banner
// stays a prop because layout.js is where it belongs - the chrome sits outside .shell and the layout
// is what owns that structure.
//
// The nav row is a row UNDER the banner rather than links drawn into it, because Banner is pure SVG
// and its only href attributes are <image> sources. Without it the installed app is a dead end:
// display:"standalone" removes the address bar and the back button, so a route the app cannot link
// to is a route the user cannot leave. That reason held on `/` before and holds on every route now.

import PrimaryNav from './PrimaryNav.js';

export default function Chrome({ banner }) {
  return (
    <>
      {banner}
      <div className="homenav">
        <PrimaryNav className="hn-nav" />
      </div>
    </>
  );
}
