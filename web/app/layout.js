import './globals.css';
import Nav from '../components/Nav.js';

export const metadata = {
  title: 'MySports',
  description: 'What is on today, this week, and what has already been played.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="masthead">
            <div className="wordmark">
              My<span>Sports</span>
            </div>
            <Nav />
            <div className="tagline">all times ET · Cleveland (DMA 510)</div>
          </header>
          {children}
          <p className="footnote">
            Every game is kept in the database — nothing is deleted. Reads are anon, read-only, live.
          </p>
        </div>
      </body>
    </html>
  );
}
