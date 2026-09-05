'use client';

// The week control: one chip-styled trigger wrapping a real native <select>, grouped by sport.
//
// It replaces a chip row that grew one chip per week - fine at three weeks, a wrapped block of 33 by
// mid-season. A native select stays one line at every width, and on a phone it opens the platform's
// own picker, which is a better list than anything rendered here.
//
// THE URL REMAINS THE SOURCE OF TRUTH. Changing the select NAVIGATES to /weeks?sport=...&w=<key>, so
// ?w= deep links, browser back/forward and a shared link all keep working exactly as they did with
// the links. The select is a navigation control wearing a chip, not a piece of client state.
//
// Accessibility: a real <select> with a real <label>, so it is keyboard operable and announced as a
// listbox. Since prompt 46 the chip look is Picker's FACE and this select is stretched invisibly
// over it - still a real select, still the element that opens iOS's wheel and fires the change.
// Since prompt 45 that label is the page heading - <h1><label htmlFor="week-select">WEEK</label></h1>
// - so the accessible name is still a real one, and there is still exactly one of it.

import { useRouter } from 'next/navigation';
import Picker from './Picker.js';

export default function WeekSelect({ options, selected, selectedParts, sport = null }) {
  const router = useRouter();
  if (!options?.length) return null;

  const groups = [];
  for (const o of options) {
    const g = groups.find((x) => x.name === (o.group || ''));
    if (g) g.items.push(o);
    else groups.push({ name: o.group || '', items: [o] });
  }
  const grouped = groups.length > 1 || groups[0].name;

  // NO LABEL HERE. The label is the page's <h1>, wired by htmlFor="week-select" (prompt 45).
  //
  // The face reads the PARTS, never a split of the joined label: a season week shows the sport-week
  // in gold and the range in the standings-line grey, a calendar week shows only its range in the
  // trigger's own ink. Joe, 2026-09-05: "NFL Week 1 ... in app gold, then the date range in the
  // subtle gray" - and calendar weeks get no prefix, so nothing there is gold.
  const p = selectedParts || {};
  return (
    <Picker
      control={
        <select
          id="week-select"
          value={selected ?? ''}
          // C2: the sport rides the URL now, not ?view=. The week FORMAT is derived from the sport,
          // so a user-facing view switch would be a second control saying the same thing.
          onChange={(e) =>
            router.push(
              `/weeks?${sport ? `sport=${encodeURIComponent(sport)}&` : ''}w=${encodeURIComponent(e.target.value)}`,
            )
          }
        >
          {grouped
            ? groups.map((g) => (
                <optgroup key={g.name} label={g.name}>
                  {g.items.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))
            : groups[0].items.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
        </select>
      }
    >
      {p.prefix ? (
        <>
          <b className="pk-sport">{p.prefix}</b>
          <span className="pk-sep">·</span>
          <span className="pk-range">{p.range}</span>
        </>
      ) : (
        <span className="pk-range pk-range--solo">{p.range}</span>
      )}
    </Picker>
  );
}
