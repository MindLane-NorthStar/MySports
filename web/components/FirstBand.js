// D1: the Today page's first band - Tonight / On now · Next up / Finals · Tomorrow.
//
// A server component. Everything it needs was decided by web/lib/bandstate.js from the request time
// and handed down as props, so there is no clock here, no effect, and nothing to hydrate. That is
// deliberate: prompt 42 spent a stage recovering from a useLayoutEffect/useEffect swap keyed on
// `typeof window`, which is exactly the hydration mismatch React refuses to patch.
//
// IT RENDERS MatchupCard AS IT IS. The card, its CSS, useTextMeasurer, fitNameAndRecord, row2Size
// and cardGeometry are all off limits to this feature - so the band imports the card rather than
// growing a row of its own that would need its own fit rules. If the band ever needs a different
// row, it imports the card's fit function; it never forks it.

import Listing from './Listing.js';
import { BAND_TITLE } from '../lib/bandstate.js';

export default function FirstBand({ band, standingsRows, rankingsRows, day, sport }) {
  if (!band) return null;

  return (
    <section className="fband" aria-labelledby="fband-title">
      <div className="fband-head">
        <h2 className="fband-title" id="fband-title">{BAND_TITLE[band.state]}</h2>
        {/* THE HEADER STATES THE DAY AND THE CLOCK IT USED. Joe reconfirmed this on 2026-09-05:
            now that the page heading reads DATE, this is the one place the viewing day is spelled
            out in words - and a band that changes with the time has to say which time it read. */}
        {band.heading ? <p className="fband-when">{band.heading}</p> : null}
        {/* There is ALWAYS an escape to the full day. A band that filters has to say where the rest
            went, or it reads as a page that lost games. */}
        <a className="fband-all" href="#all-today">See all today</a>
      </div>

      {band.empty ? (
        <p className="empty">
          Nothing loaded for this viewing day yet — the rest of the page shows what the database
          holds.
        </p>
      ) : (
        <Listing
          games={band.rows}
          standingsRows={standingsRows}
          rankingsRows={rankingsRows}
          day={day}
          sport={sport}
          headingClass="favlabel"
        />
      )}
    </section>
  );
}
