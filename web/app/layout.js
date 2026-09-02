import './globals.css';
import Banner from '../components/Banner.js';
import Chrome from '../components/Chrome.js';

export const metadata = {
  title: 'MySports TV',
  description: 'What is on today, this week, and what has already been played.',
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
