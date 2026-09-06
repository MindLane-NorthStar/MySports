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
// Since prompt 50 that label is the WEEK segment of the DAY | WEEK toggle, reached by
// aria-labelledby: prompt 45's page heading was retired with the restack, and without a replacement
// this select would have had no accessible name at all (the drawn face is aria-hidden).

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

  // NO LABEL HERE, and none is needed: aria-labelledby on the select points at the WEEK segment of
  // the mode toggle (prompt 50; it was the page's <h1> from prompt 45 until then).
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
          // PROMPT 50: the `<h1><label htmlFor="week-select">WEEK</label></h1>` that named this
          // control was retired with the heading (stage 2d) - the DAY | WEEK toggle above the stack
          // is the label now. So the name comes from the WEEK segment of that toggle: still
          // visible, still saying what this control selects, still said exactly once. An aria-label
          // would be a second, invisible name competing with the one on screen.
          aria-labelledby="mode-week"
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
