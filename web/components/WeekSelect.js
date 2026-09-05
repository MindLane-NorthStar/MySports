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
// listbox. The chip look is a wrapper around it, never a div pretending to be a control. Since
// prompt 45 that label is the page heading - <h1><label htmlFor="week-select">WEEK</label></h1> -
// so the accessible name is still a real one, and there is still exactly one of it.

import { useRouter } from 'next/navigation';

export default function WeekSelect({ options, selected, sport = null }) {
  const router = useRouter();
  if (!options?.length) return null;

  const groups = [];
  for (const o of options) {
    const g = groups.find((x) => x.name === (o.group || ''));
    if (g) g.items.push(o);
    else groups.push({ name: o.group || '', items: [o] });
  }
  const grouped = groups.length > 1 || groups[0].name;

  // NO LABEL AND NO WRAPPER HERE. The label is the page's <h1>, which reads WEEK and is wired to this
  // select by htmlFor="week-select" (prompt 45). Rendering one here as well would be a second name
  // for one control; the caller supplies the .pagehead row that puts the two side by side.
  //
  // NOT data-active. The gold plate is the SELECTED-chip style, and this control used to render
  // directly beneath the gold SELECTED SPORT chip - two stacked gold pills read as two selected
  // chips. This is a trigger you open, so it takes the inactive chip style; the caret
  // (.chip-select::after) inherits currentColor and follows automatically.
  return (
    <span className="chip chip-select">
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
    </span>
  );
}
