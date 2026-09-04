'use client';

// The compact banner every route except the home page wears: the TV cutout and wordmark shrunk to a
// 60px bar (50px on a phone), the three primary links, and a context slot on the right.
//
// Client component only because the active link is decided by pathname. Everything else is static.

import PrimaryNav from './PrimaryNav.js';

// The context slot renders ONLY what it is given. A page that knows its sport and week says so; a
// page that does not shows nothing rather than an empty pill or a placeholder dash. The standing
// "all times ET · Cleveland" tag is different - it is true on every page, so it always rides along
// (the stylesheet hides it, with the rest of the slot, on phones where there is no room).
export default function NavBanner({ sport, week, day }) {
  return (
    <header className="navbar">
      <div className="nb-brand">
        <img className="nb-tv" src="/brand/tv-cutout.png" alt="" />
        <span className="wordmark nb-wm">
          MySports <b>TV</b>
        </span>
      </div>
      <PrimaryNav className="nb-nav" />
      <div className="nb-ctx">
        {sport ? <span className="pill">{sport}</span> : null}
        {week || day ? (
          <span>
            {week ? <>Week <b>{week}</b></> : null}
            {week && day ? ' · ' : null}
            {day}
          </span>
        ) : null}
      </div>
    </header>
  );
}
