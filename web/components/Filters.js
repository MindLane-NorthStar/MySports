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
const CHIP_MARK = { cfb: 'cfp', nfl: 'nfl', nba: 'nba', nhl: 'nhl', mlb: 'mlb' };

export function SportFilter({ sport, available }) {
  const setParam = useSetParam();
  const shown = available && available.length ? SPORTS.filter((s) => available.includes(s)) : SPORTS;
  return (
    <>
      <span className="control-label">Sport</span>
      <div className="chiprow">
        <button type="button" className="chip" data-active={!sport} onClick={() => setParam('sport', null)}>
          All
        </button>
        {shown.map((s) => (
          <button
            key={s}
            type="button"
            className="chip chip-league"
            data-active={sport === s}
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
            <img
              className="chip-mark"
              src={`/leagues/${CHIP_MARK[s] || s}${sport === s ? '' : '_dark'}.png`}
              alt=""
              loading="lazy"
            />
            <span>{SPORT_LABEL[s] || s.toUpperCase()}</span>
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
