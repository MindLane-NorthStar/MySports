// Rendering contract v1.7 - the program card's shared arithmetic.
//
// THE DESIGN OF RECORD IS docs/design/program-card-design-v1.md, approved for build as written
// (Joe, 2026-09-05). Everything here implements it; nothing here decides it.
//
// WHY A MODULE AND NOT TWO COMPONENTS. The grid block and the list card draw the same brand: the
// same endcap gradient, the same mirrored wash, the same subtitle tint, the same crew-fit rule. Two
// copies of that would drift the way the reason/network_status pair drifted twice before prompt 46
// pulled it into one function. So both surfaces call these, and every number below is either a token
// read from web/app/globals.css or a constant from the design doc, never a colour retyped from a
// mockup (working rule 16).
//
// PURE. No DOM, no React, no clock - `nowMinutes` takes its instant as an argument. That is what
// lets tests exercise the wash, the fade and the crew fit without a browser, and what keeps the now
// marker out of the hydration path (it is positioned from the request time on the server).

import brandsDoc from '../../data/brands.json' with { type: 'json' };
import durationDefaults from '../../data/duration_defaults.json' with { type: 'json' };

const BRANDS = brandsDoc.brands || {};

/** globals.css --panel-top / --panel-bottom: the rail tile's charcoal, reused verbatim (contract §2). */
export const ENDCAP_TOP = '#31363d';
export const ENDCAP_BOTTOM = '#1e2126';
/** The wash's centre and the seam's centre. The card centre is ALWAYS charcoal - that is the design. */
export const WASH_CENTER = ENDCAP_TOP;
/** Peak wash opacity at the two edges. Joe picked "strong edges" over the ~28% soft variant. */
export const WASH_PEAK = 0.55;
/** The brand bar on the endcap's right edge, in design px (contract §3 geometry, before M1's scale). */
export const BRAND_BAR_W = 3;
/** Subtitle tint: the brand colour 70% of the way to white. */
export const SUBTITLE_TINT = 0.7;
/** globals.css: the tray's muted run. Same token the pills use. */
export const CREW_INK = '#b4bac0';

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** '#abc' | '#aabbcc' -> [r, g, b]; anything else -> null. Never throws on feed data. */
export function rgb(hex) {
  const m = HEX.exec(String(hex || '').trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

export function hex(parts) {
  return `#${parts.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

/** `color` moved `amount` of the way toward white. The design doc's subtitle rule at 0.7. */
export function tintToWhite(color, amount = SUBTITLE_TINT) {
  const c = rgb(color);
  if (!c) return CREW_INK;
  return hex(c.map((v) => v + (255 - v) * amount));
}

/** `color` at `alpha` over nothing - an rgba() string, for the wash stops. */
export function rgba(color, alpha) {
  const c = rgb(color);
  if (!c) return `rgba(49, 54, 61, ${alpha})`;
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
}

/**
 * THE SIGNATURE: the mirrored stage wash.
 *
 * Brand colour at BOTH edges, fading to charcoal at the centre, peak ~55%. The centre being charcoal
 * is not a compromise - it is what keeps the title on maximum contrast and what keeps two adjacent
 * red-branded cards (NASCAR, UFC, WWE and GameDay all cluster red) telling themselves apart by mark
 * and subtitle rather than by a colour they share.
 *
 * Symmetric BY CONSTRUCTION: the same stop list, mirrored around 50%. The acceptance pass samples
 * luminance at x and width-x to prove it rather than trusting this comment.
 */
export function washGradient(color, { peak = WASH_PEAK } = {}) {
  const edge = rgba(color, peak);
  const mid = rgba(color, peak * 0.35);
  const centre = rgba(color, 0);
  return `linear-gradient(90deg, ${edge} 0%, ${mid} 22%, ${centre} 50%, ${mid} 78%, ${edge} 100%)`;
}

/** The seam, mirrored to match: charcoal at centre, brand at both ends (design doc, "Seam"). */
export function seamGradient(color) {
  return `linear-gradient(90deg, ${color} 0%, ${WASH_CENTER} 50%, ${color} 100%)`;
}

/** The endcap's charcoal rail tile. Never brand-coloured, never white-backed. */
export const ENDCAP_GRADIENT = `linear-gradient(180deg, ${ENDCAP_TOP}, ${ENDCAP_BOTTOM})`;

/**
 * The brand record for a key, with a safe shape for a key data/brands.json does not carry.
 *
 * An unknown brand is not an error and must not blank a card: it renders the programme's own title
 * as its typographic mark on the neutral, which is exactly what a brand awaiting art looks like.
 */
export function brandFor(key) {
  const b = BRANDS[key];
  if (b) return { key, ...b };
  return {
    key: key || null,
    title: null,
    short_title: null,
    color: brandsDoc._neutral || '#4a505a',
    color_source: 'unknown brand key - the neutral',
    mark: null,
    mark_dark: null,
    provisional: true,
  };
}

/** Every brand whose colour is a placeholder, for the report and for a dev warning. */
export function provisionalBrands() {
  return Object.entries(BRANDS).filter(([, v]) => v.provisional).map(([k]) => k);
}

/**
 * `open_ended` - THE RECONCILIATION prompt 17 flagged and this contract closes.
 *
 * THE RULE: the per-program column wins when it is set; the per-type default in
 * data/duration_defaults.json is what applies when it is not.
 *
 * WHAT THE SCHEMA ACTUALLY ALLOWS, which is the part worth knowing. `programs.open_ended` is
 * `boolean NOT NULL default false` (migration 0009), so a row read from the database ALWAYS carries
 * a value and the policy branch below can only be reached by a feed that omits the field - a
 * fixture, or a select that did not ask for it. The rule is still implemented as written, because
 * making it conditional on today's nullability would silently change meaning the day the column
 * becomes nullable. The consequence is recorded rather than papered over: the 98 NASCAR races
 * loaded before this contract all carry `false` while duration_defaults says a race_session is
 * open-ended, and the fix is in the ADAPTERS (which now emit it) and not in a renderer override -
 * a renderer that second-guesses a stored boolean is a renderer nobody can debug.
 */
export function isOpenEnded(program) {
  const own = program?.open_ended;
  if (own === true || own === false) return own;
  return typeOpenEnded(program?.program_type);
}

/** The per-type default, or false for a type the file does not know. */
export function typeOpenEnded(programType) {
  const row = durationDefaults?.[programType];
  return row?.open_ended_default === true;
}

/** Display minutes for a program: its own value, else the type default, else 180. */
export function programMinutes(program) {
  const own = Number(program?.expected_duration_min);
  if (Number.isFinite(own) && own > 0) return own;
  const row = durationDefaults?.[program?.program_type];
  const fallback = Number(row?.default);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : 180;
}

/**
 * THE CREW-FIT RULE (design doc, "Tray").
 *
 * The crew run renders ONLY when the tray width allows - never collides, never truncates mid-name.
 * TWO behaviours are possible and the contract has to pick one, so: NAMES ARE DROPPED FROM THE
 * RIGHT until the run fits, and if even one name will not fit, the whole run goes. A name is never
 * cut in half and an ellipsis is never used, because "COLE, GRA…" is worse than no crew line at all
 * - it looks like a rendering fault rather than an editorial choice.
 *
 * @param {string[]} crew    the ordered names
 * @param {number}   room    pixels available to the run
 * @param {Function} measure (text, font) -> px, the same measurer the grid's names use
 * @param {string}   font    the run's font shorthand
 * @returns {{ names: string[], text: string, dropped: number }}
 */
export function fitCrew(crew, room, measure, font) {
  const names = (Array.isArray(crew) ? crew : []).map((n) => String(n || '').trim()).filter(Boolean);
  if (!names.length || !(room > 0) || typeof measure !== 'function') {
    return { names: [], text: '', dropped: names.length };
  }
  for (let n = names.length; n >= 1; n -= 1) {
    const take = names.slice(0, n);
    const text = take.join(' · ');
    if (measure(text, font) <= room) return { names: take, text, dropped: names.length - n };
  }
  return { names: [], text: '', dropped: names.length };
}

/** A program's crew as an array, whatever shape hosts_crew arrived in. */
export function crewNames(program) {
  const c = program?.hosts_crew;
  if (Array.isArray(c)) return c.map((x) => (typeof x === 'string' ? x : x?.name)).filter(Boolean);
  if (c && Array.isArray(c.crew)) return c.crew.map((x) => (typeof x === 'string' ? x : x?.name)).filter(Boolean);
  return [];
}

/**
 * The subtitle a program prints beneath its title.
 *
 * The design doc assigns a different fact per type - a studio show's location, a fight card's
 * headliner, a race's series and venue - and `programs.subtitle` is where an adapter writes the one
 * it found. A studio show in-studio has NO subtitle at all (docs/research/events-summary-2.md §6:
 * studio-city display is road-only), which is why an empty string here is a real answer.
 */
export function subtitleFor(program) {
  const sub = String(program?.subtitle || '').trim();
  if (sub) return sub.toUpperCase();
  if (program?.program_type === 'studio_show') return '';   // road-only; in-studio prints nothing
  const loc = String(program?.location_text || '').trim();
  return loc ? loc.toUpperCase() : '';
}

/** The title, uppercase, never empty - a program with no title is a data defect, not a blank card. */
export function titleFor(program) {
  return String(program?.title || 'UNTITLED PROGRAM').toUpperCase();
}

/**
 * Is this row a program rather than a game? ONE test, imported everywhere.
 *
 * `program_id` is the discriminator and not a `__program` flag, because the flag would have to be
 * stamped by whoever built the list and could therefore be forgotten; the id is on the row itself.
 */
export function isProgram(row) {
  return Boolean(row && row.program_id != null);
}

// --------------------------------------------------------------------------- the normalizer
//
// ONE SHAPE FOR BOTH KINDS OF ROW, so that offservice.js, bandstate.js, primewindow.js and every
// count line keep working with no branch in them. A program is given the four fields those modules
// read off a game - `id`, `canonical_kickoff_at_utc`, `kickoff_status`, `result_status` - and keeps
// everything of its own beside them. Nothing is invented: each mapped field is the program's own
// value under the name the shared code already knows.
//
// `result_status` IS DERIVED FROM A CLOCK, and that clock is passed in. A program has no observed
// result - nobody reports that a race is over the way a scoreboard reports a final - so the honest
// answer is the one the schedule implies: before its start it is scheduled, inside its window it is
// live, after it is final. Taking `now` as an argument is what keeps that off the client: page.js
// calls this once on the server from the request time, exactly as bandstate() is called.

/**
 * The viewing day an instant belongs to: the ET calendar date, with anything before 03:00 ET
 * counted to the previous day.
 *
 * `games` carries this as a pipeline-computed COLUMN; `programs` does not, so it is derived here
 * from the one fact the row has. Same 03:00 cutover gridmodel.js's viewingMinutes uses and the same
 * one the pipeline applies, which is what lets a race and a game land on the same day heading.
 */
export function viewingDayOf(instant) {
  const d = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(d.getTime())) return null;
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
    hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  if (Number(p.hour) >= 3) return date;
  const prev = new Date(`${date}T12:00:00Z`);
  prev.setUTCDate(prev.getUTCDate() - 1);
  return prev.toISOString().slice(0, 10);
}

/** Milliseconds a program is expected to occupy, from its own duration or the type default. */
function spanMs(program) {
  return programMinutes(program) * 60000;
}

/**
 * A program as a row the shared components understand.
 *
 * @param {object} program the PostgREST row
 * @param {Date|number} now the request time - ALWAYS passed, never read from a clock here
 */
export function toRow(program, now) {
  if (!program) return null;
  const startMs = Date.parse(program.start_at);
  const t = now instanceof Date ? now.getTime() : Number(now);
  let result = null;
  if (Number.isFinite(startMs) && Number.isFinite(t)) {
    if (t < startMs) result = 'scheduled';
    else if (t < startMs + spanMs(program)) result = 'in_progress';
    else result = 'final';
  }
  return {
    ...program,
    // `program-<id>` and not the bare number: these ids share a Map and a React key space with game
    // ids, and a game id is a string like `nhl-2026020011`. A bare 4699 could collide with nothing
    // today and something tomorrow.
    id: `program-${program.program_id}`,
    canonical_kickoff_at_utc: program.start_at,
    kickoff_status: program.start_at ? 'set' : 'tbd',
    result_status: result,
    // The grid and the bands read this to place a row on a day; programs are read by a start_at
    // range, so the value is carried rather than queried.
    viewing_day: program.viewing_day || viewingDayOf(program.start_at),
  };
}

/** Every program on a day as rows, ordered as they arrived (start_at ascending). */
export function toRows(programs, now) {
  return (Array.isArray(programs) ? programs : []).map((p) => toRow(p, now)).filter(Boolean);
}

/**
 * The right slot's word, matching the game card's vocabulary.
 *
 * `Sched` / `Live` / `Final` - the same three the listings card shows, so a race and a game read
 * the same way in the same column.
 */
export function slotWord(row) {
  switch (row?.result_status) {
    case 'in_progress': return { text: 'Live', tone: 'live' };
    case 'final': return { text: 'Final', tone: 'final' };
    default: return { text: 'Sched', tone: null };
  }
}

/**
 * THE ELIGIBILITY DEFECT CUE (contract v1.7 §2a').
 *
 * A program with NO eligibility row at all has not been judged by pipeline/reconcile.py, which means
 * either the reconcile has not run since it loaded or 0014's table is missing a row it should have.
 * Either way it is a DATA DEFECT and not a state the reader should be shown as watchable. The card
 * carries a visible cue and the run counts it; it is never rendered as though it were fine.
 */
export function eligibilityMissing(row) {
  const e = row?.eligibility;
  const first = Array.isArray(e) ? e[0] : e;
  return !first;
}
