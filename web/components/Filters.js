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
            className="chip"
            data-active={sport === s}
            onClick={() => setParam('sport', s === sport ? null : s)}
          >
            {SPORT_LABEL[s] || s.toUpperCase()}
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
