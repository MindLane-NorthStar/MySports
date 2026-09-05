'use client';

// The Today page's date picker and sport filter. Both are thin: they only rewrite the query string
// and let the server component re-fetch. No client-side data access anywhere in this app.

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Picker from './Picker.js';
import { longDay } from '../lib/format.js';
import { SPORT_FILTERS, SPORT_LABEL } from '../lib/config.js';

function useSetParam() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (key, value) => {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === undefined || value === '') next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };
}

export function DatePicker({ day }) {
  const setParam = useSetParam();
  return (
    // THE LABEL IS NOT HERE ANY MORE - it is the page's <h1>. Prompt 25 made this a REAL <label for>
    // rather than the bare span it was, because a control whose own text is a date needs a visible
    // name; prompt 45 moved that name up to the heading, which now reads DATE and is wired to this
    // input by htmlFor. Still exactly one label for one control, and still no aria-label - one would
    // OVERRIDE the visible text and lose the word to a screen reader, which was the original point.
    //
    // PROMPT 46 1C: the input keeps its job and loses its looks. A native date input renders the
    // browser's own locale string - "Sep 4, 2026" - and no CSS reaches inside it, so Joe's
    // "Friday, September 4, 2026" has to be drawn by us. longDay() already produced exactly that
    // for the old <h1>, so the face reuses it rather than adding a second formatter.
    <Picker control={
      <input
        id="viewing-day"
        type="date"
        value={day}
        onChange={(e) => setParam('day', e.target.value)}
      />
    }>
      <span className="pk-range pk-range--solo">{longDay(day)}</span>
    </Picker>
  );
}

// web/public/leagues has no `cfb` asset; the CFP mark is what the band headers and the banner use
// for college football, so the chips follow rather than inventing a second convention.
// The four added in prompt 25 map to themselves; every file is present in web/public/leagues.
// `racing` is one chip over two sports (§16) and has its own composited mark: NASCAR's wordmark
// over IndyCar's badge. nascar/indycar keep their marks for a hand-typed ?sport=nascar.
const CHIP_MARK = {
  cfb: 'cfp', nfl: 'nfl', nba: 'nba', nhl: 'nhl', mlb: 'mlb',
  racing: 'racing', nascar: 'nascar', indycar: 'indycar', ufc: 'ufc', wwe: 'wwe',
};

export function SportFilter({ sport, available }) {
  const setParam = useSetParam();
  const shown = available && available.length
    ? SPORT_FILTERS.filter((s) => available.includes(s))
    : SPORT_FILTERS;
  return (
    <>
      {/* The <span>Sport</span> that used to sit here was a bare span wired to nothing - not a
          <label for>, so it carried no accessible name and only read as a detached word above the
          chips. role="group" + aria-label IS the name it was pretending to be, and it names the
          row rather than floating beside it. The Day label above stays: it is visible work in
          front of a control whose own text is a date. */}
      {/* §16: ALL leaves the tile row and becomes a full-width bar directly above it, one tile
          tall, edges flush with the row beneath. It is the largest control on the page, which is
          the point - and it takes a member out of the tile row, which is half of what let the row
          stop scrolling. role="group" is on the WRAPPER so All is inside the named group. */}
      <div className="sportbar" role="group" aria-label="Sport">
        <button type="button" className="spbtn spbtn-all spbtn-bar" data-active={!sport}
                aria-pressed={!sport} onClick={() => setParam('sport', null)}>
          {/* Joe, 2026-09-04: "Make the ALL chip ALL SPORTS and keep its size as-is. I don't want
              to interrupt the balance horizontally that we've accomplished with this chip and the
              tiles below it." Written out in the markup because nothing uppercases it - neither
              .spbtn nor .sportbar sets text-transform - and the bar's accessible name is this text,
              so the name follows the label rather than needing an aria-label to restate it. The box
              is untouched: it is still one tile tall and exactly as wide as the row beneath it.
              MobileGrid.js:267 already calls the unfiltered grid "All Sports Broadcasts", so this
              is the same words in both places rather than a new phrase. */}
          ALL SPORTS
        </button>
        <div className="sportrow">
        {/* data-active stays - it is the styling hook the gold plate depends on. aria-pressed is
            added ALONGSIDE it, never instead: selection was carried entirely by CSS, so a screen
            reader heard "NFL, button" with no way to know which filter was active. */}
        {shown.map((s) => (
          <button
            key={s}
            type="button"
            className="spbtn"
            data-active={sport === s}
            aria-pressed={sport === s}
            aria-label={SPORT_LABEL[s] || s}
            onClick={() => setParam('sport', s === sport ? null : s)}
          >
            {/* The _dark variant, not the raw: these chips float on charcoal, and contract v1.3e is
                explicit that the raw art is for cap endcaps and light tint plates only (addendum M12).
                College football uses the CFP mark, matching the band headers and the home banner.
                alt="" because the label beside it already carries the meaning - a screen reader should
                hear "NFL" once, not twice. */}
            {/* SINGLE CONTEXT per register §14: the active chip is a charcoal plate with a gold
                border, not a gold fill, so every chip floats on charcoal in both states and takes
                _dark always. There is no state branch here any more. */}
            {/* Section 13: the mark IS the chip - no text beside it. Ten chips of mark-plus-word do
                not fit 390px at any sane size, and the marks are the thing Joe recognises. The label
                moves to aria-label on the BUTTON: removing visible text removes the accessible name,
                and an unlabelled button is worse than a wide one. The img stays alt="" so a screen
                reader hears "NFL" once, not twice.

                REGISTER §15: the img carries NO class and NO dimensions of its own. It is sized
                entirely by .spbtn's box - max-width/max-height 100% with object-fit: contain, the
                reference's own rule. The old .chip-mark set an explicit height, which is precisely
                what was holding every mark down inside a 44px tile. */}
            <img
              src={`/leagues/${CHIP_MARK[s] || s}_dark.png`}
              alt=""
              loading="lazy"
            />
          </button>
        ))}
        </div>
      </div>
    </>
  );
}

export function SearchBox({ q, placeholder }) {
  const setParam = useSetParam();
  return (
    <>
      <span className="control-label">Search</span>
      <input
        type="search"
        defaultValue={q || ''}
        placeholder={placeholder}
        aria-label="Search completed games"
        onKeyDown={(e) => {
          if (e.key === 'Enter') setParam('q', e.currentTarget.value);
        }}
        onBlur={(e) => setParam('q', e.currentTarget.value)}
      />
    </>
  );
}
