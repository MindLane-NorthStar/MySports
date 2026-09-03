'use client';

// The week control: one chip-styled trigger wrapping a real native <select>, grouped by sport.
//
// It replaces a chip row that grew one chip per week - fine at three weeks, a wrapped block of 33 by
// mid-season. A native select stays one line at every width, and on a phone it opens the platform's
// own picker, which is a better list than anything rendered here.
//
// THE URL REMAINS THE SOURCE OF TRUTH. Changing the select NAVIGATES to /weeks?view=...&w=<key>, so
// ?w= deep links, browser back/forward and a shared link all keep working exactly as they did with
// the links. The select is a navigation control wearing a chip, not a piece of client state.
//
// Accessibility: a real <select> with a real <label>, so it is keyboard operable and announced as a
// listbox. The chip look is a wrapper around it, never a div pretending to be a control.

import { useRouter } from 'next/navigation';

export default function WeekSelect({ options, selected, view, label = 'Week' }) {
  const router = useRouter();
  if (!options?.length) return null;

  const groups = [];
  for (const o of options) {
    const g = groups.find((x) => x.name === (o.group || ''));
    if (g) g.items.push(o);
    else groups.push({ name: o.group || '', items: [o] });
  }
  const grouped = groups.length > 1 || groups[0].name;

  return (
    <div className="controls">
      <label className="control-label" htmlFor="week-select">
        {label}
      </label>
      {/* NOT data-active. The gold plate is the SELECTED-chip style, and this control renders
          directly beneath the gold "Season week" chip - two stacked gold pills read as two
          selected chips. This is a trigger you open, so it takes the inactive chip style; the
          caret (.chip-select::after) inherits currentColor and follows automatically. */}
      <span className="chip chip-select">
        <select
          id="week-select"
          value={selected ?? ''}
          onChange={(e) => router.push(`/weeks?view=${view}&w=${encodeURIComponent(e.target.value)}`)}
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
    </div>
  );
}
