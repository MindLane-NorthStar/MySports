'use client';

// The Today page's date picker and sport filter. Both are thin: they only rewrite the query string
// and let the server component re-fetch. No client-side data access anywhere in this app.

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { SPORTS, SPORT_LABEL } from '../lib/config.js';

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
    <>
      <span className="control-label">Day</span>
      <input
        type="date"
        value={day}
        onChange={(e) => setParam('day', e.target.value)}
        aria-label="Viewing day"
      />
    </>
  );
}

// web/public/leagues has no `cfb` asset; the CFP mark is what the band headers and the banner use
// for college football, so the chips follow rather than inventing a second convention.
// The four added in prompt 25 map to themselves; every file is present in web/public/leagues.
const CHIP_MARK = {
  cfb: 'cfp', nfl: 'nfl', nba: 'nba', nhl: 'nhl', mlb: 'mlb',
  nascar: 'nascar', indycar: 'indycar', ufc: 'ufc', wwe: 'wwe',
};

export function SportFilter({ sport, available }) {
  const setParam = useSetParam();
  const shown = available && available.length ? SPORTS.filter((s) => available.includes(s)) : SPORTS;
  return (
    <>
      {/* The <span>Sport</span> that used to sit here was a bare span wired to nothing - not a
          <label for>, so it carried no accessible name and only read as a detached word above the
          chips. role="group" + aria-label IS the name it was pretending to be, and it names the
          row rather than floating beside it. The Day label above stays: it is visible work in
          front of a control whose own text is a date. */}
      <div className="chiprow" role="group" aria-label="Sport">
        <button type="button" className="chip" data-active={!sport} aria-pressed={!sport}
                onClick={() => setParam('sport', null)}>
          All
        </button>
        {/* data-active stays - it is the styling hook the gold plate depends on. aria-pressed is
            added ALONGSIDE it, never instead: selection was carried entirely by CSS, so a screen
            reader heard "NFL, button" with no way to know which filter was active. */}
        {shown.map((s) => (
          <button
            key={s}
            type="button"
            className="chip chip-league"
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
            {/* CONTRACT v1.3e / addendum M12, both contexts on one control: an inactive chip is
                charcoal, so it takes the _dark variant; the ACTIVE chip is a gold plate, which is a
                light ground, so it takes the RAW art. Filtering the dark mark to black instead just
                flattened light marks into solid blocks - the MLB roundel became a black rectangle. */}
            {/* Section 13: the mark IS the chip - no text beside it. Ten chips of mark-plus-word do
                not fit 390px at any sane size, and the marks are the thing Joe recognises. The label
                moves to aria-label on the BUTTON: removing visible text removes the accessible name,
                and an unlabelled button is worse than a wide one. The img stays alt="" so a screen
                reader hears "NFL" once, not twice. Height only, never width - NASCAR's wordmark is
                126px at 21px tall and constraining width would squash it (section 13's measurements). */}
            <img
              className="chip-mark"
              src={`/leagues/${CHIP_MARK[s] || s}${sport === s ? '' : '_dark'}.png`}
              alt=""
              loading="lazy"
            />
          </button>
        ))}
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
