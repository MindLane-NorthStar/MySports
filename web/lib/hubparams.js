// The Schedule Hub's URL contract, in one place.
//
// The app is ONE route and its entire state is the query string (R1). This module is the only thing
// that decides what a query string means, so the page, the redirects and the tests cannot disagree
// about it - which is exactly how `?view=` drifted on the old Weeks page before prompt 36 deleted it.
//
// PURE. No React, no Next, no clock, no `window`. `today` is injected the same way `currentWeekKey`
// takes it, so this is testable under plain `node --test` and the server and client can never
// disagree about what day it is.
//
// NOTHING IS PERSISTED. No localStorage, no sessionStorage, no cookie. Every breakpoint in this app
// is CSS-gated and every piece of state is in the URL, precisely so there is no hydration mismatch
// to chase; storage would put that back. Absent means default, always.
//
// WHY `mode` IS A REAL PARAMETER AND NOT DERIVED from the presence of `day` versus `w`, which the
// brief left open: a derived mode cannot represent "week mode, default week". Pressing WEEK before
// picking one would have to produce a URL with neither `day` nor `w`, and that is byte-identical to
// the default DAY state - so the toggle would visibly fail to latch. Explicit `mode=week` says it in
// one token. It also lets `day` and `w` COEXIST harmlessly, each read only in its own mode, so
// switching DAY -> WEEK -> DAY returns you to the day you were on instead of resetting to today.

import { resolveSportParam, resolveSeriesParam } from './config.js';

export const MODES = ['day', 'week'];
export const SCOPES = ['all', 'mine'];
export const VIEWS = ['list', 'grid'];

export const DEFAULTS = { mode: 'day', scope: 'all', view: 'list' };

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** One of `allowed`, or the default. An unrecognised value never errors - it resolves. */
function oneOf(value, allowed, fallback) {
  return typeof value === 'string' && allowed.includes(value) ? value : fallback;
}

/**
 * Resolve a raw searchParams object into the hub's state.
 *
 * Every unknown or malformed value RESOLVES to a default rather than throwing or 404ing. A shared
 * link with a typo should show the reader a schedule, not an error - and a stale `?w=` from another
 * sport is a case this app has always treated as a feature (see `weekChoices`, which falls back to
 * that sport's current week).
 *
 * @param {object} params  the awaited `searchParams`
 * @param {string} today   'YYYY-MM-DD' ET viewing day, injected
 */
export function resolveHubParams(params, today) {
  const p = params || {};
  const mode = oneOf(p.mode, MODES, DEFAULTS.mode);
  const scope = oneOf(p.scope, SCOPES, DEFAULTS.scope);
  const view = oneOf(p.view, VIEWS, DEFAULTS.view);

  // `day` keeps the format and the guard it has always had (page.js:117 before the hub).
  const day = typeof p.day === 'string' && DAY_RE.test(p.day) ? p.day : today;

  // `w` is NOT validated against a list here: which keys exist depends on what is loaded, and the
  // fallback for one that does not match lives in weekChoices, where the list is. Carrying a stale
  // key through is deliberate - it is what makes a link from another sport land on that sport's
  // current week instead of on an error.
  const w = typeof p.w === 'string' && p.w ? p.w : null;

  return {
    mode,
    day,
    w,
    sport: resolveSportParam(p.sport),
    series: resolveSeriesParam(p.series),
    scope,
    view,
    // convenience predicates, so no caller re-derives them and gets one backwards
    isWeek: mode === 'week',
    isGrid: view === 'grid',
    isMine: scope === 'mine',
  };
}

/**
 * The canonical query string for a state - DEFAULTS OMITTED.
 *
 * A clean `/` must mean day / all sports / all games / list, so writing `?mode=day&scope=all&view=list`
 * would be three tokens saying "nothing". Omitting them is what keeps a shared link short and what
 * makes `start_url: '/'` open the same page the toggles produce.
 *
 * The key ORDER is fixed so the same state always produces the same string - otherwise `router.push`
 * would sometimes navigate to a URL the reader is already on.
 */
export function hubHref(state = {}, { today = null } = {}) {
  const q = new URLSearchParams();
  const put = (k, v) => { if (v !== null && v !== undefined && v !== '') q.set(k, String(v)); };

  if (state.mode && state.mode !== DEFAULTS.mode) put('mode', state.mode);
  // `day` is omitted when it IS today: the default is "today", so naming it adds nothing and makes a
  // shared link go stale the moment tomorrow arrives.
  if (state.day && state.day !== today) put('day', state.day);
  put('w', state.w);
  put('sport', state.sport);
  put('series', state.series);
  if (state.scope && state.scope !== DEFAULTS.scope) put('scope', state.scope);
  if (state.view && state.view !== DEFAULTS.view) put('view', state.view);

  const s = q.toString();
  return s ? `/?${s}` : '/';
}
