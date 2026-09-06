'use client';

// The Today page's date picker and sport filter. Both are thin: they only rewrite the query string
// and let the server component re-fetch. No client-side data access anywhere in this app.

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Picker from './Picker.js';
import WeekSelect from './WeekSelect.js';
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

/**
 * THE THREE HUB TOGGLES - DAY | WEEK, ALL GAMES | MY TEAMS, LIST VIEW | GRID VIEW.
 *
 * SEMANTICS: `role="radiogroup"` with `role="radio"` and `aria-checked`, not `aria-pressed` buttons.
 * The audit's section H3 laid out the choice; this is its recommendation, and the reason is meaning
 * rather than syntax. Each of these is EXACTLY ONE OF TWO, and `aria-pressed` describes N
 * independent toggles that happen to sit next to each other - a reader hearing "All games, pressed /
 * My teams, not pressed" has to infer the exclusivity, where "All games, radio button, 1 of 2,
 * checked" is told it.
 *
 * THE EIGHT LEAGUE TILES DELIBERATELY KEEP `aria-pressed` (SportFilter, below). ALL SPORTS plus
 * eight tiles is a filter that can be CLEARED, not a one-of-N choice, so the two patterns are
 * different on purpose. Register section 17 records that split so nobody harmonises one to the other.
 *
 * Arrow keys move between segments, which is what a radiogroup promises; the group is one tab stop.
 */
function Segmented({ label, name, value, options, onPick }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const onKey = (e) => {
    const back = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
    const fwd = e.key === 'ArrowRight' || e.key === 'ArrowDown';
    if (!back && !fwd) return;
    e.preventDefault();
    const next = options[(idx + (fwd ? 1 : options.length - 1)) % options.length];
    onPick(next.value);
  };
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            data-active={on}
            // One tab stop for the group: only the checked segment is reachable by Tab, and the
            // arrow keys move within. That is the roving-tabindex a radiogroup is expected to have.
            tabIndex={on ? 0 : -1}
            onKeyDown={onKey}
            onClick={() => onPick(o.value)}
            id={`${name}-${o.value}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** DAY | WEEK. The time prism, and since prompt 50 it is also the pickers' visible label. */
export function ModeToggle({ mode }) {
  const setParam = useSetParam();
  return (
    <div className="segrow segrow-mode">
      <Segmented
        label="Time range"
        name="mode"
        value={mode}
        options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }]}
        // `day` and `w` are both left in the URL: each is read only in its own mode, so switching
        // back returns you to the day you were on rather than resetting to today.
        onPick={(v) => setParam('mode', v === 'day' ? null : v)}
      />
    </div>
  );
}

/** ALL GAMES | MY TEAMS and LIST VIEW | GRID VIEW, on ONE row (spec section 9). */
export function ScopeViewToggles({ scope, view }) {
  const setParam = useSetParam();
  return (
    <div className="segrow segrow-pair">
      <Segmented
        label="Scope"
        name="scope"
        value={scope}
        options={[{ value: 'all', label: 'All games' }, { value: 'mine', label: 'My teams' }]}
        onPick={(v) => setParam('scope', v === 'all' ? null : v)}
      />
      <Segmented
        label="Presentation"
        name="view"
        value={view}
        options={[{ value: 'list', label: 'List view' }, { value: 'grid', label: 'Grid view' }]}
        onPick={(v) => setParam('view', v === 'list' ? null : v)}
      />
    </div>
  );
}

/**
 * THE PREV / NEXT ARROWS (prompt 50 stage 2d, and Joe's renderings show them either side of the
 * picker). They did not exist: the date control was a native input behind a drawn face with no way
 * to step a day without opening the calendar.
 *
 * REAL BUTTONS, not styled spans, and each says WHAT it steps - "Previous day" / "Next day" becomes
 * "Previous week" / "Next week" with the mode, because "Previous" alone is meaningless to a screen
 * reader out of context. They keep the 44px target; the shortened ALL SPORTS bar is the one
 * deliberate exception to that rule (register §17) and it does not extend here.
 *
 * A DISABLED ARROW IS A HONEST ARROW. At the ends of the loaded week list there is nowhere to step,
 * and an enabled control that does nothing is worse than a dimmed one that explains itself.
 */
function Arrow({ dir, label, onClick, disabled = false }) {
  return (
    <button type="button" className="pk-arrow" aria-label={label}
            disabled={disabled} onClick={onClick}>
      <span aria-hidden="true">{dir === 'prev' ? '‹' : '›'}</span>
    </button>
  );
}

/** ISO day arithmetic, in UTC so it cannot be dragged across a boundary by the local zone. */
function shiftDay(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * DAY MODE's picker row: < , the drawn date face over the native input, > .
 *
 * THE ACCESSIBLE NAME MOVED HERE, and this is the part that would break silently. Until prompt 50
 * the name came from `<h1><label htmlFor="viewing-day">DATE</label></h1>`, and pagehead.test.mjs
 * forbade an aria-label on the control because one would OVERRIDE that visible text. Stage 2d
 * retires the heading - the DAY | WEEK toggle above is the label now - which would have left the
 * input with NO accessible name at all, because the drawn face is aria-hidden.
 *
 * So the input is named by `aria-labelledby="mode-day"`: the DAY segment of the toggle. The name is
 * still VISIBLE, still says what the picker selects, and is still exactly one of it - which is what
 * prompt 25 insisted on and what the heading was only ever a way of providing.
 */
export function DayPicker({ day }) {
  const setParam = useSetParam();
  return (
    <>
      <Arrow dir="prev" label="Previous day" onClick={() => setParam('day', shiftDay(day, -1))} />
      <DatePicker day={day} />
      <Arrow dir="next" label="Next day" onClick={() => setParam('day', shiftDay(day, 1))} />
    </>
  );
}

/**
 * WEEK MODE's picker row. The arrows step the SPORT'S OWN WEEK LIST, not seven days - an NFL week
 * steps to the next NFL week, and CFB week 1 is ten days long, so a date step would be wrong on
 * both counts. The list is `choices.all`, already derived once on the page, so the arrows and the
 * select cannot disagree about what comes next.
 */
export function WeekPicker({ choices, sport }) {
  const setParam = useSetParam();
  const all = choices?.all || [];
  const selected = choices?.selected || null;
  const i = selected ? all.findIndex((w) => w.key === selected.key) : -1;
  const step = (n) => {
    const next = all[i + n];
    if (next) setParam('w', next.key);
  };
  return (
    <>
      <Arrow dir="prev" label="Previous week" disabled={i <= 0} onClick={() => step(-1)} />
      {selected ? (
        <WeekSelect sport={sport} selected={selected.key} options={choices.options}
                    selectedParts={choices.selectedParts} />
      ) : null}
      <Arrow dir="next" label="Next week" disabled={i < 0 || i >= all.length - 1} onClick={() => step(1)} />
    </>
  );
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
        // NOT aria-label: that would be a second, invisible name competing with the visible one.
        // aria-labelledby points at the DAY segment of the mode toggle, which is on screen, says
        // what this control selects, and is the only place it is said. See DayPicker's note.
        aria-labelledby="mode-day"
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
