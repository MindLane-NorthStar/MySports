import './globals.css';
import { Suspense } from 'react';
import Banner from '../components/Banner.js';
import Chrome from '../components/Chrome.js';
import AutoScroll from '../components/AutoScroll.js';
import CollapsedHeader from '../components/CollapsedHeader.js';

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
  // statusBarStyle IS 'black' (prompt 99, 2026-09-15): iOS draws its own dark opaque bar and the
  // web view starts BELOW it. From `ba05819` (2026-09-03) it was the translucent style, which lays
  // the web view UNDER the status bar - and iOS 27 composites a progressive blur over that band,
  // muddying whatever of the app sits in it. THE BLUR IS ABOVE THE WEB VIEW, NOT IN IT: `.chdr`
  // already paints opaque --spot-2 across the whole band (globals.css, padding-top:
  // env(safe-area-inset-top)) and Joe saw the wash over it anyway, so no background the page paints
  // can defeat it. Handing the band back to iOS is the fix, and there is deliberately no fixed
  // status-bar element anywhere: `.chdr` already was one, and it did not work.
  //
  // NOT `default`: when statusBarStyle was ABSENT, Next emitted no apple-mobile-web-app-status-bar-
  // style and iOS fell back to `default` - an opaque LIGHT bar sitting above a #1b1b1b app.
  //
  // WHAT THE TOP LOOKS LIKE NOW. Below the bar the top inset is 0, so globals.css's three
  // top-inset rules fall to 0 on their own guards and the banner artwork starts at the bar's lower
  // edge. The wordmark's first ink is then the artwork's own headroom: stage y 4.392 (baseline 29.88
  // minus 708/1000 x 36 - the O and S tops in public/fonts/BarlowCondensed-Bold.ttf), which is
  // 4.41 CSS px at 430 wide and 4.00 at 390. Under the translucent style it sat 5.6 px (at 430)
  // INSIDE the band. Register §48 has the arithmetic and the one-line pull-up, not applied.
  //
  // viewportFit: 'cover' below STAYS: the left, right and bottom insets still need it. Treat any
  // change here as needing the home-screen app removed and re-added from Safari - iOS is taken to
  // read this tag at install (prompt 99's brief; not something this repo has measured).
  appleWebApp: { title: 'MySports TV', statusBarStyle: 'black' },
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
        {/* THE SENTINEL MOVED OUT OF THIS FILE (prompt 60), and the move is the reason the collapse
            no longer jumps the page. It used to sit HERE, immediately after the banner, so it left
            the viewport once ~123px of banner had scrolled away - while the 216px control stack was
            still on screen. That was harmless when collapsing only ADDED a fixed bar; now that it
            REMOVES the banner and the stack from the flow, the trigger has to fire when the whole
            collapsible region has gone, or the compensation has nothing like the right number to
            work with. It is rendered by `Controls` in app/page.js, immediately after `.hubctl` and
            deliberately OUTSIDE it - hidden by the collapse, it would have no box to measure. */}
        {/* MOUNTED HERE, BESIDE Chrome, AND THAT POSITION IS LOAD-BEARING. It makes the bar a
            sibling of `.shell` and therefore never an ancestor of `<main>` or of the mobile grid,
            so it cannot become a containing block for the grid's sticky rail. Wrapping the content
            instead would put it on that chain, which is the one thing globals.css tells you not to
            do to `.mrail-cell`. Suspense because it reads useSearchParams. */}
        <Suspense fallback={null}>
          <CollapsedHeader />
        </Suspense>
        {/* Lands the reader on what is on now (prompt 67 stage 2). Mounted HERE for the same reason
            CollapsedHeader is: a sibling of `.shell`, never an ancestor of `<main>` or of the mobile
            grid, so it can never become a containing block for the grid's sticky rail. It renders
            nothing at all, but the rule is about the element chain and not about the pixels.
            Suspense because it reads useSearchParams. */}
        <Suspense fallback={null}>
          <AutoScroll />
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
