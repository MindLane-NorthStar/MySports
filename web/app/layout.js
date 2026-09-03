import './globals.css';
import Banner from '../components/Banner.js';
import Chrome from '../components/Chrome.js';

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
        <div className="shell">
          {children}
          <p className="footnote">
            Every game is kept in the database — nothing is deleted. Reads are anon, read-only, live.
          </p>
        </div>
      </body>
    </html>
  );
}
