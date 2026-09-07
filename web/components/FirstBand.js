// D1: the Today page's first band - Tonight / Live & Upcoming / Finals & Tomorrow.
// (Those were `On now · Next up` and `Finals · Tomorrow` until prompt 56 renamed all three as a
//  set, so one connector does the job two were doing. Joe's ruling, 2026-09-06.)
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

export default function FirstBand({ band, standingsRows, rankingsRows, day, sport,
                                    floatFavorites = true }) {
  if (!band) return null;

  return (
    <section className="fband" aria-labelledby="fband-title">
      <div className="fband-head">
        <h2 className="fband-title" id="fband-title">{BAND_TITLE[band.state]}</h2>
        {/* THE HEADER STATES THE CLOCK IT USED, and only that (R9, prompt 56).
            It stated the DAY as well - "Friday, September 4, 2026 · 7:12 PM ET" - and prompt 46
            recorded Joe reconfirming that, because the page heading then read the bare word DATE
            and this was the one place the viewing day was spelled out. Prompt 50 retired that
            heading; the PICKER two rows above now shows the date in exactly those words, so the
            band was repeating what the reader had just read.
            A band that changes with the time still has to say which time it read, which is why the
            clock stays. R11 - adding "2 of 14 today" beside it - was CONSIDERED AND DECLINED by Joe
            on the same day: the subtext is the clock alone, and nothing should re-propose it. */}
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
        /* `floatFavorites` is forwarded so MY TEAMS can switch the in-band float off here too.
           Item 9 falls out of the same change: a favourite hoisted into this band must not be
           labelled "Your teams" HERE and again in its own sport band below. */
        <Listing
          games={band.rows}
          standingsRows={standingsRows}
          rankingsRows={rankingsRows}
          day={day}
          sport={sport}
          floatFavorites={floatFavorites}
          headingClass="favlabel"
        />
      )}
    </section>
  );
}
