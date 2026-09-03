'use client';

// Picks the page chrome by route: the full banner on the home page, the compact bar everywhere else.
//
// The banner arrives as a PROP, already rendered on the server. A client component cannot import a
// server component, but it can place one it was handed - so Banner keeps reading the layout JSON at
// build time and ships no JavaScript, while the one thing that genuinely needs the client (the
// pathname) stays here.

import { usePathname } from 'next/navigation';
import NavBanner from './NavBanner.js';
import PrimaryNav from './PrimaryNav.js';

export default function Chrome({ banner }) {
  // The home route gets the full banner PLUS a nav row beneath it. Banner.js is untouched - it is
  // pure SVG with no links - so the row is added under it rather than drawn into it.
  //
  // Without this row the installed app is a dead end: display:"standalone" removes the address bar
  // and the back button, the app opens on "/", and there would be no way to reach Weeks or History.
  if (usePathname() === '/') {
    return (
      <>
        {banner}
        <div className="homenav">
          <PrimaryNav className="hn-nav" />
        </div>
      </>
    );
  }
  return <NavBanner />;
}
