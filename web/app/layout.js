import './globals.css';
import { Suspense } from 'react';
import Banner from '../components/Banner.js';
import Chrome from '../components/Chrome.js';
import CollapsedHeader, { SENTINEL_ID } from '../components/CollapsedHeader.js';

export const metadata = {
  title: 'MySports TV',
  description: 'What is on today, this week, and what has already been played.',
  // The home-screen label iOS prints under the icon. iOS truncates around 12 characters and
  // "MySports TV" is 11, so it lands whole rather than as "MySports T...".
  //
  // There is deliberately no hand-written <link rel="apple-touch-icon"> anywhere in this file:
  // Next's App Router serves and links app/icon.png and app/apple-icon.png by file convention. If a
  // link tag ever seems necessary here, the icon file is in the wrong place.
  //
  // statusBarStyle was ABSENT, so Next emitted no apple-mobile-web-app-status-bar-style and iOS
  // fell back to `default` - an opaque LIGHT bar sitting above a #1b1b1b app. 'black-translucent'
  // makes the web view extend UNDER the status bar, which is only correct alongside the
  // safe-area work in globals.css and the viewport export below; the two ship together or not at
  // all. ('black' would be the no-layout-consequence fallback: a dark opaque bar.)
  appleWebApp: { title: 'MySports TV', statusBarStyle: 'black-translucent' },
};

// viewportFit: 'cover' is what lets the page paint into the notch and home-indicator areas, and
// is required for env(safe-area-inset-*) to report anything but 0. Declared through the App
// Router's viewport export rather than a hand-written <meta name="viewport">, for the same reason
// recorded above for apple-touch-icon: if a hand-written tag ever seems necessary, something is
// in the wrong place. width and initialScale are restated because exporting this object replaces
// Next's default viewport rather than extending it.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1b1b1b',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* The chrome sits OUTSIDE .shell so it can run the full width: the banner carries its own
            background and bottom rule and is meant to bleed, while the content below stays inside
            the 1100px column. Banner is rendered here, on the server, and handed to Chrome, which
            only decides whether this route gets it or the compact bar. */}
        <Chrome banner={<Banner />} />
        {/* THE SENTINEL, immediately after the banner and zero-height. When it leaves the viewport
            the collapsed bar shows; when it comes back the bar hides. It is the ONLY trigger -
            there is no scroll listener anywhere in this app and this does not add one. */}
        <div id={SENTINEL_ID} aria-hidden="true" />
        {/* MOUNTED HERE, BESIDE Chrome, AND THAT POSITION IS LOAD-BEARING. It makes the bar a
            sibling of `.shell` and therefore never an ancestor of `<main>` or of the mobile grid,
            so it cannot become a containing block for the grid's sticky rail. Wrapping the content
            instead would put it on that chain, which is the one thing globals.css tells you not to
            do to `.mrail-cell`. Suspense because it reads useSearchParams. */}
        <Suspense fallback={null}>
          <CollapsedHeader />
        </Suspense>
        <div className="shell">
          {children}
          {/* R5, prompt 56: the developer footnote is GONE. It read "Every game is kept in the
              database — nothing is deleted. Reads are anon, read-only, live." on all eight views -
              the data architecture described to someone who came to find out what is on
              television, and the only copy in the app written from the build's side of the screen.
              Joe approved its removal on 2026-09-06.

              THE ONE BELOW STAYS, and is now the only footnote. Prompt 31 took the ET suffix off
              every clock in the app, so the fact is stated once here instead; it is a fact the
              reader needs rather than one the build wanted to volunteer. `.footnote-tz` keeps both
              classes so its italic rule and the shared `.footnote` type both still apply. */}
          <p className="footnote footnote-tz">All times are Eastern · Cleveland market.</p>
        </div>
      </body>
    </html>
  );
}
